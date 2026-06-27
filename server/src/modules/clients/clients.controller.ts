import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ClientCreditRating, ClientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { assertBranchScope } from '../../shared/scope.js';

interface ClientRow {
  id: string;
  companyId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  cedula: string;
  phone: string;
  address: string;
  assignedUserId: string;
  creditRating: string | null;
  isBlocked: boolean;
  status: string;
  photo: string | null;
  createdAt: Date | string;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.client.findMany({
      where: {
        companyId: user.companyId,
        ...(user.role === 'Super Admin' || user.role === 'Administrador' ? {} : { branchId: user.branchId }),
        ...(user.role === 'Cobrador' ? { assignedUserId: user.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(rows.map(row => this.toClient(row)));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const firstName = this.clean(body.firstName);
    const lastName = this.clean(body.lastName);
    const cedula = this.clean(body.cedula);
    const phone = this.clean(body.phone);
    const address = this.clean(body.address);
    const branchId = this.clean(body.branchId) || user.branchId;
    const assignedUserId = user.role === 'Cobrador' ? user.id : (this.clean(body.assignedUserId) || user.id);

    if (!firstName || !lastName || !cedula || !phone || !address) {
      throw new BadRequestException('Complete los datos requeridos del cliente.');
    }
    assertBranchScope(user, branchId);
    await this.assertPlanLimit(user.companyId, 'CLIENT');

    const duplicated = await this.prisma.client.findUnique({
      where: { companyId_cedula: { companyId: user.companyId, cedula } },
      select: { id: true },
    });
    if (duplicated) {
      throw new ConflictException('Ya existe un cliente con esa cedula en esta empresa.');
    }

    const id = randomUUID();
    const created = await this.prisma.$transaction(async tx => {
      const saved = await tx.client.create({
        data: {
          id,
          companyId: user.companyId,
          branchId,
          firstName,
          lastName,
          nickname: this.clean(body.nickname) || null,
          cedula,
          phone,
          address,
          assignedUserId,
          creditRating: ClientCreditRating.BUENA,
          isBlocked: false,
          status: ClientStatus.PENDIENTE,
          photo: this.clean(body.photo) || null,
        },
      });
      await this.audit(tx, user, branchId, 'CLIENT_CREATED', id, { cedula });
      return saved;
    });
    return ok(this.toClient(created));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Patch(':clientId')
  async update(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body() body: Record<string, unknown>) {
    const existing = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: user.companyId },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new BadRequestException('Cliente no encontrado.');
    assertBranchScope(user, existing.branchId);

    const status = this.clean(body.status);
    if (status && !['Pendiente', 'Aprobado', 'Rechazado'].includes(status)) {
      throw new BadRequestException('Estado de cliente invalido.');
    }

    const creditRating = this.clean(body.creditRating);
    if (creditRating && !['BUENA', 'REGULAR', 'MALA'].includes(creditRating)) {
      throw new BadRequestException('Calificacion de cliente invalida.');
    }

    const cedula = this.clean(body.cedula);
    if (cedula) {
      const duplicated = await this.prisma.client.findFirst({
        where: { companyId: user.companyId, cedula, id: { not: clientId } },
        select: { id: true },
      });
      if (duplicated) throw new ConflictException('Ya existe un cliente con esa cedula en esta empresa.');
    }

    const nextBranchId = this.clean(body.branchId);
    if (nextBranchId) assertBranchScope(user, nextBranchId);

    const updated = await this.prisma.$transaction(async tx => {
      const saved = await tx.client.update({
        where: { id: clientId },
        data: {
          ...(this.clean(body.firstName) ? { firstName: this.clean(body.firstName) } : {}),
          ...(this.clean(body.lastName) ? { lastName: this.clean(body.lastName) } : {}),
          ...(body.nickname !== undefined ? { nickname: this.clean(body.nickname) || null } : {}),
          ...(cedula ? { cedula } : {}),
          ...(this.clean(body.phone) ? { phone: this.clean(body.phone) } : {}),
          ...(this.clean(body.address) ? { address: this.clean(body.address) } : {}),
          ...(nextBranchId ? { branchId: nextBranchId } : {}),
          ...(this.clean(body.assignedUserId) ? { assignedUserId: this.clean(body.assignedUserId) } : {}),
          ...(creditRating ? { creditRating: creditRating as ClientCreditRating } : {}),
          ...(typeof body.isBlocked === 'boolean' ? { isBlocked: body.isBlocked } : {}),
          ...(status ? { status: this.toClientStatus(status) } : {}),
          ...(body.photo !== undefined ? { photo: this.clean(body.photo) || null } : {}),
        },
      });
      await this.audit(tx, user, nextBranchId || existing.branchId, 'CLIENT_UPDATED', clientId, { status: status || undefined, creditRating: creditRating || undefined });
      return saved;
    });
    return ok(this.toClient(updated));
  }

  private selectClient(companyId: string, clientId: string) {
    return this.prisma.client.findFirst({ where: { companyId, id: clientId } });
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private async assertPlanLimit(companyId: string, resource: 'CLIENT') {
    if (resource !== 'CLIENT') return;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: { select: { maxClients: true } } },
    });
    if (!company) return;
    const total = await this.prisma.client.count({ where: { companyId } });
    if (total >= company.plan.maxClients) {
      throw new BadRequestException('Tu plan ya alcanzo el limite de clientes.');
    }
  }

  private async audit(tx: Prisma.TransactionClient, user: AuthUser, branchId: string, action: string, entityId: string, metadata: Record<string, unknown>) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        companyId: user.companyId,
        branchId,
        actorUserId: user.id,
        action,
        entityType: 'client',
        entityId,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private toClient(row: ClientRow) {
    return {
      ...row,
      nickname: row.nickname || '',
      creditRating: row.creditRating || 'BUENA',
      isBlocked: Boolean(row.isBlocked),
      status: this.fromClientStatus(row.status),
      photo: row.photo || '',
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  private toClientStatus(status: string) {
    const map: Record<string, ClientStatus> = {
      Pendiente: ClientStatus.PENDIENTE,
      Aprobado: ClientStatus.APROBADO,
      Rechazado: ClientStatus.RECHAZADO,
    };
    return map[status];
  }

  private fromClientStatus(status: string) {
    const map: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      APROBADO: 'Aprobado',
      RECHAZADO: 'Rechazado',
    };
    return map[status] || status;
  }
}
