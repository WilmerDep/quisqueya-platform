import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { canAccessAllCompanyBranches } from '../../shared/scope.js';

interface UserRow {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  avatar: string | null;
  photo: string | null;
  isActive: boolean;
  phone: string | null;
  permissionsJson: Prisma.JsonValue | null;
  createdAt: Date | string;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.user.findMany({
      where: {
        ...(user.role === 'Super Admin' ? {} : { companyId: user.companyId }),
        ...(user.role === 'Super Admin' || canAccessAllCompanyBranches(user) ? {} : { branchId: user.branchId }),
      },
      orderBy: { name: 'asc' },
    });
    return ok(rows.map(row => this.toUser(row)));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const companyId = user.role === 'Super Admin' ? (this.clean(body.companyId) || user.companyId) : user.companyId;
    const branchId = this.clean(body.branchId) || user.branchId;
    const name = this.clean(body.name);
    const username = this.clean(body.username).toLowerCase();
    const role = this.clean(body.role) || 'Cobrador';
    const password = this.clean(body.password) || 'admin123';

    if (!name || !username) throw new BadRequestException('Nombre y usuario son obligatorios.');
    this.assertRoleCanManage(user, role);
    await this.assertBranchBelongsToCompany(companyId, branchId);
    await this.assertBranchScope(user, companyId, branchId);
    await this.assertPlanLimit(companyId);

    const duplicated = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (duplicated) throw new ConflictException('Ese nombre de usuario ya existe.');

    const id = `U-${randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await this.prisma.$transaction(async tx => {
      const saved = await tx.user.create({
        data: {
          id,
          companyId,
          branchId,
          name,
          username,
          email: this.clean(body.email) || null,
          passwordHash,
          role: this.toUserRole(role),
          avatar: this.clean(body.avatar) || this.getAvatar(name),
          photo: this.clean(body.photo) || null,
          isActive: body.isActive === false ? false : true,
          phone: this.clean(body.phone) || null,
          permissionsJson: this.asJsonRecord(body.permissions),
        },
      });
      await this.audit(tx, user, companyId, branchId, 'USER_CREATED', id, { username, role });
      return saved;
    });
    return ok(this.toUser(created));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Patch(':userId')
  async update(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body() body: Record<string, unknown>) {
    const existing = await this.selectUser(userId);
    if (!existing) throw new BadRequestException('Usuario no encontrado.');

    const nextCompanyId = existing.companyId;
    const nextBranchId = this.clean(body.branchId) || existing.branchId;
    const existingRole = this.fromUserRole(existing.role);
    const nextRole = this.clean(body.role) || existingRole;
    await this.assertBranchBelongsToCompany(nextCompanyId, nextBranchId);
    await this.assertBranchScope(user, nextCompanyId, existing.branchId);
    await this.assertBranchScope(user, nextCompanyId, nextBranchId);
    this.assertRoleCanManage(user, existingRole);
    this.assertRoleCanManage(user, nextRole);

    const nextUsername = this.clean(body.username).toLowerCase();
    if (nextUsername) {
      const duplicated = await this.prisma.user.findFirst({
        where: { username: nextUsername, id: { not: userId } },
        select: { id: true },
      });
      if (duplicated) throw new ConflictException('Ese nombre de usuario ya existe.');
    }

    const updated = await this.prisma.$transaction(async tx => {
      const saved = await tx.user.update({
        where: { id: userId },
        data: {
          branchId: nextBranchId,
          ...(this.clean(body.name) ? { name: this.clean(body.name) } : {}),
          ...(nextUsername ? { username: nextUsername } : {}),
          ...(body.email !== undefined ? { email: this.clean(body.email) || null } : {}),
          role: this.toUserRole(nextRole),
          ...(this.clean(body.avatar) ? { avatar: this.clean(body.avatar) } : {}),
          ...(body.photo !== undefined ? { photo: this.clean(body.photo) || null } : {}),
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
          ...(body.phone !== undefined ? { phone: this.clean(body.phone) || null } : {}),
          ...(body.permissions !== undefined ? { permissionsJson: this.asJsonRecord(body.permissions) } : {}),
        },
      });
      await this.audit(tx, user, nextCompanyId, nextBranchId, 'USER_UPDATED', userId, { role: nextRole });
      return saved;
    });
    return ok(this.toUser(updated));
  }

  private selectUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  private async assertPlanLimit(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: { select: { maxUsers: true } } },
    });
    const total = await this.prisma.user.count({ where: { companyId } });
    if (company && total >= company.plan.maxUsers) {
      throw new BadRequestException('Tu plan ya alcanzo el limite de usuarios.');
    }
  }

  private async assertBranchBelongsToCompany(companyId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, companyId }, select: { id: true } });
    if (!branch) throw new BadRequestException('Sucursal no valida para esta empresa.');
  }

  private async assertBranchScope(user: AuthUser, companyId: string, branchId: string) {
    if (user.role === 'Super Admin') return;
    if (user.companyId !== companyId) throw new BadRequestException('Empresa fuera de alcance.');
    if (canAccessAllCompanyBranches(user)) return;
    if (user.branchId === branchId) return;
    throw new BadRequestException('Sucursal fuera de alcance.');
  }

  private assertRoleCanManage(user: AuthUser, role: string) {
    const validRoles = ['Super Admin', 'Administrador', 'Supervisor', 'Cobrador'];
    if (!validRoles.includes(role)) throw new BadRequestException('Rol invalido.');
    if (user.role === 'Super Admin') return;
    if (role === 'Super Admin') throw new BadRequestException('Solo master puede crear o modificar super administradores.');
    if (user.role === 'Supervisor' && role !== 'Cobrador') {
      throw new BadRequestException('Supervisor solo puede gestionar cobradores.');
    }
  }

  private async audit(tx: Prisma.TransactionClient, user: AuthUser, companyId: string, branchId: string, action: string, entityId: string, metadata: Record<string, unknown>) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId,
        actorUserId: user.id,
        action,
        entityType: 'user',
        entityId,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private toUser(row: UserRow) {
    return {
      ...row,
      linkedCompanyIds: [row.companyId],
      email: row.email || undefined,
      role: this.fromUserRole(row.role),
      avatar: row.avatar || this.getAvatar(row.name),
      photo: row.photo || '',
      isActive: Boolean(row.isActive),
      phone: row.phone || '',
      permissions: this.asRecord(row.permissionsJson),
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private getAvatar(name: string) {
    return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, boolean> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, boolean>;
  }

  private asJsonRecord(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private toUserRole(role: string) {
    const map: Record<string, UserRole> = {
      'Super Admin': UserRole.SUPER_ADMIN,
      Administrador: UserRole.ADMINISTRADOR,
      Supervisor: UserRole.SUPERVISOR,
      Cobrador: UserRole.COBRADOR,
    };
    return map[role];
  }

  private fromUserRole(role: string) {
    const map: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMINISTRADOR: 'Administrador',
      SUPERVISOR: 'Supervisor',
      COBRADOR: 'Cobrador',
    };
    return map[role] || role;
  }
}
