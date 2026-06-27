import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { assertBranchScope } from '../../shared/scope.js';

const allowedCashTypes = new Set(['IN', 'OUT']);
const allowedCashCategories = new Set(['COBRO', 'PRESTAMO', 'GASTO', 'APORTE', 'COMISION', 'DIETA', 'GASOLINA', 'RETIRO', 'OTRO']);

interface CashRow {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  user?: { name: string | null } | null;
  type: 'IN' | 'OUT';
  category: string;
  amount: unknown;
  note: string;
  createdAt: Date | string;
}

interface CashClosureRow {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  branch?: { name: string | null } | null;
  user?: { name: string | null } | null;
  businessDate: Date | string;
  theoreticalAmount: unknown;
  countedAmount: unknown;
  differenceAmount: unknown;
  status: string;
  note: string | null;
  createdAt: Date | string;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class CashController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('cash-movements')
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.cashMovement.findMany({
      where: { companyId: user.companyId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return ok(rows.map(row => this.toMovement(row)));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post('cash-movements')
  async createMovement(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const branchId = this.clean(body.branchId) || user.branchId;
    assertBranchScope(user, branchId);

    const type = this.clean(body.type).toUpperCase();
    if (!allowedCashTypes.has(type)) throw new BadRequestException('Tipo de movimiento no valido.');

    const category = this.clean(body.category).toUpperCase();
    if (!allowedCashCategories.has(category)) throw new BadRequestException('Categoria de caja no valida.');

    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('El monto debe ser mayor que cero.');

    const note = this.clean(body.note) || 'Movimiento manual de caja';

    const movement = await this.prisma.$transaction(async tx => {
      await this.ensureBranch(tx, user.companyId, branchId);
      const created = await tx.cashMovement.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId,
          userId: user.id,
          type: type as 'IN' | 'OUT',
          category,
          amount: new Prisma.Decimal(amount),
          note,
        },
        include: { user: { select: { name: true } } },
      });

      await this.audit(tx, user, branchId, 'CASH_MOVEMENT_CREATED', 'cash_movement', created.id, {
        type,
        category,
        amount,
      });

      return created;
    });

    return ok(this.toMovement(movement));
  }

  @Get('cash-closures')
  async listClosures(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.cashClosure.findMany({
      where: { companyId: user.companyId },
      include: {
        branch: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    });

    return ok(rows.map(row => this.toClosure(row)));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post('cash-closures')
  async closeCash(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const branchId = this.clean(body.branchId) || user.branchId;
    assertBranchScope(user, branchId);

    const countedAmount = Number(body.countedAmount || 0);
    if (!Number.isFinite(countedAmount) || countedAmount < 0) {
      throw new BadRequestException('El monto contado debe ser un numero valido mayor o igual a cero.');
    }

    const note = this.clean(body.note);
    const businessDate = this.resolveBusinessDate(body.businessDate);

    const closure = await this.prisma.$transaction(async tx => {
      await this.ensureBranch(tx, user.companyId, branchId);

      const existing = await tx.cashClosure.findFirst({
        where: {
          companyId: user.companyId,
          branchId,
          businessDate,
        },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un cierre de caja registrado para esta sucursal en la fecha seleccionada.');
      }

      const theoreticalAmount = await this.calculateTheoreticalBalance(tx, user.companyId, branchId);
      const differenceAmount = Number((countedAmount - theoreticalAmount).toFixed(2));

      if (differenceAmount !== 0 && !note) {
        throw new BadRequestException('Debes registrar una observacion cuando exista diferencia en el cierre.');
      }

      const created = await tx.cashClosure.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId,
          userId: user.id,
          businessDate,
          theoreticalAmount: new Prisma.Decimal(theoreticalAmount),
          countedAmount: new Prisma.Decimal(countedAmount),
          differenceAmount: new Prisma.Decimal(differenceAmount),
          status: differenceAmount === 0 ? 'BALANCED' : 'WITH_DIFFERENCE',
          note: note || null,
        },
        include: {
          branch: { select: { name: true } },
          user: { select: { name: true } },
        },
      });

      await this.audit(tx, user, branchId, 'CASH_CLOSED', 'cash_closure', created.id, {
        businessDate: businessDate.toISOString().slice(0, 10),
        theoreticalAmount,
        countedAmount,
        differenceAmount,
      });

      return created;
    });

    return ok(this.toClosure(closure));
  }

  private toMovement(row: CashRow) {
    return {
      id: row.id,
      companyId: row.companyId,
      branchId: row.branchId,
      userId: row.userId,
      userName: row.user?.name || row.userId,
      type: row.type,
      category: row.category,
      amount: Number(row.amount),
      note: row.note,
      date: new Date(row.createdAt).toISOString(),
    };
  }

  private toClosure(row: CashClosureRow) {
    return {
      id: row.id,
      companyId: row.companyId,
      branchId: row.branchId,
      branchName: row.branch?.name || row.branchId,
      userId: row.userId,
      userName: row.user?.name || row.userId,
      businessDate: new Date(row.businessDate).toISOString().slice(0, 10),
      theoreticalAmount: Number(row.theoreticalAmount),
      countedAmount: Number(row.countedAmount),
      differenceAmount: Number(row.differenceAmount),
      status: row.status,
      note: row.note || '',
      closedAt: new Date(row.createdAt).toISOString(),
    };
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private resolveBusinessDate(value: unknown) {
    const raw = this.clean(value);
    const candidate = raw ? new Date(`${raw}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(candidate.getTime())) {
      throw new BadRequestException('La fecha operativa del cierre no es valida.');
    }
    candidate.setUTCHours(0, 0, 0, 0);
    return candidate;
  }

  private async ensureBranch(tx: Prisma.TransactionClient, companyId: string, branchId: string) {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, companyId },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException('Sucursal no encontrada para esta compania.');
  }

  private async calculateTheoreticalBalance(tx: Prisma.TransactionClient, companyId: string, branchId: string) {
    const [cashIn, cashOut] = await Promise.all([
      tx.cashMovement.aggregate({
        where: { companyId, branchId, type: 'IN' },
        _sum: { amount: true },
      }),
      tx.cashMovement.aggregate({
        where: { companyId, branchId, type: 'OUT' },
        _sum: { amount: true },
      }),
    ]);

    return Number(cashIn._sum.amount || 0) - Number(cashOut._sum.amount || 0);
  }

  private async audit(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    branchId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        companyId: user.companyId,
        branchId,
        actorUserId: user.id,
        action,
        entityType,
        entityId,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
