import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { canAccessAllCompanyBranches } from '../../shared/scope.js';

interface BranchRow {
  id: string;
  companyId: string;
  name: string;
  address: string;
  phone: string | null;
  logo: string | null;
  managerName: string | null;
  monthlyGoal: unknown;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.branch.findMany({
      where: user.role === 'Super Admin'
        ? {}
        : {
            companyId: user.companyId,
            ...(canAccessAllCompanyBranches(user) ? {} : { id: user.branchId }),
          },
      orderBy: { name: 'asc' },
    });
    return ok(rows.map(row => this.toBranch(row)));
  }

  @Roles('Super Admin', 'Administrador')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const companyId = user.role === 'Super Admin' ? (this.clean(body.companyId) || user.companyId) : user.companyId;
    const name = this.clean(body.name);
    if (!name) throw new BadRequestException('La sucursal necesita un nombre.');
    await this.assertCompanyScope(user, companyId);
    await this.assertPlanLimit(companyId);
    await this.assertUniqueName(companyId, name);

    const id = `B-${randomUUID()}`;
    const created = await this.prisma.$transaction(async tx => {
      const saved = await tx.branch.create({
        data: {
          id,
          companyId,
          name,
          address: this.clean(body.address) || 'Pendiente de configurar',
          phone: this.clean(body.phone) || null,
          logo: this.clean(body.logo) || null,
          managerName: this.clean(body.managerName) || null,
          monthlyGoal: new Prisma.Decimal(Number(body.monthlyGoal || 0)),
        },
      });
      await this.audit(tx, user, companyId, id, 'BRANCH_CREATED', id, { name });
      return saved;
    });
    return ok(this.toBranch(created));
  }

  @Roles('Super Admin', 'Administrador')
  @Patch(':branchId')
  async update(@CurrentUser() user: AuthUser, @Param('branchId') branchId: string, @Body() body: Record<string, unknown>) {
    const existing = await this.selectBranch(branchId);
    if (!existing) throw new BadRequestException('Sucursal no encontrada.');
    await this.assertCompanyScope(user, existing.companyId);

    const name = this.clean(body.name);
    if (name) await this.assertUniqueName(existing.companyId, name, branchId);

    const updated = await this.prisma.$transaction(async tx => {
      const saved = await tx.branch.update({
        where: { id: branchId },
        data: {
          ...(name ? { name } : {}),
          ...(this.clean(body.address) ? { address: this.clean(body.address) } : {}),
          ...(body.phone !== undefined ? { phone: this.clean(body.phone) || null } : {}),
          ...(body.logo !== undefined ? { logo: this.clean(body.logo) || null } : {}),
          ...(body.managerName !== undefined ? { managerName: this.clean(body.managerName) || null } : {}),
          ...(Number.isFinite(Number(body.monthlyGoal)) ? { monthlyGoal: new Prisma.Decimal(Number(body.monthlyGoal)) } : {}),
        },
      });
      await this.audit(tx, user, existing.companyId, branchId, 'BRANCH_UPDATED', branchId, { name: name || undefined });
      return saved;
    });
    return ok(this.toBranch(updated));
  }

  @Roles('Super Admin', 'Administrador')
  @Delete(':branchId')
  async remove(@CurrentUser() user: AuthUser, @Param('branchId') branchId: string) {
    const existing = await this.selectBranch(branchId);
    if (!existing) throw new BadRequestException('Sucursal no encontrada.');
    await this.assertCompanyScope(user, existing.companyId);

    const [totalBranches, totalUsers, totalClients, totalLoans] = await Promise.all([
      this.prisma.branch.count({ where: { companyId: existing.companyId } }),
      this.prisma.user.count({ where: { companyId: existing.companyId, branchId } }),
      this.prisma.client.count({ where: { companyId: existing.companyId, branchId } }),
      this.prisma.loan.count({ where: { companyId: existing.companyId, branchId } }),
    ]);
    if (totalBranches <= 1) throw new BadRequestException('No puede eliminar la unica sucursal de la empresa.');
    if (totalUsers || totalClients || totalLoans) {
      throw new BadRequestException('No puede eliminar una sucursal con personal, clientes o prestamos asignados.');
    }

    await this.prisma.$transaction(async tx => {
      await tx.branch.delete({ where: { id: branchId } });
      await this.audit(tx, user, existing.companyId, branchId, 'BRANCH_DELETED', branchId, { name: existing.name });
    });
    return ok({ id: branchId });
  }

  private selectBranch(branchId: string) {
    return this.prisma.branch.findUnique({ where: { id: branchId } });
  }

  private async assertCompanyScope(user: AuthUser, companyId: string) {
    if (user.role === 'Super Admin') return;
    if (user.companyId !== companyId) throw new BadRequestException('Empresa fuera de alcance.');
  }

  private async assertPlanLimit(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: { select: { maxBranches: true } } },
    });
    const total = await this.prisma.branch.count({ where: { companyId } });
    if (company && total >= company.plan.maxBranches) {
      throw new BadRequestException('Tu plan ya alcanzo el limite de sucursales.');
    }
  }

  private async assertUniqueName(companyId: string, name: string, ignoredBranchId = '') {
    const duplicated = await this.prisma.branch.findFirst({
      where: {
        companyId,
        name: { equals: name },
        ...(ignoredBranchId ? { id: { not: ignoredBranchId } } : {}),
      },
      select: { id: true },
    });
    if (duplicated) throw new BadRequestException('Ya existe una sucursal con ese nombre.');
  }

  private async audit(tx: Prisma.TransactionClient, user: AuthUser, companyId: string, branchId: string, action: string, entityId: string, metadata: Record<string, unknown>) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId,
        actorUserId: user.id,
        action,
        entityType: 'branch',
        entityId,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private toBranch(row: BranchRow) {
    return {
      ...row,
      phone: row.phone || '',
      logo: row.logo || '',
      managerName: row.managerName || '',
      monthlyGoal: Number(row.monthlyGoal || 0),
    };
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }
}
