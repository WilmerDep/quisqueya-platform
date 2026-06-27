import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { assertBranchScope } from '../../shared/scope.js';
import { applyPaymentToInstallments, reversePaymentFromInstallments } from './payment-rules.js';

interface PaymentRow {
  id: string;
  companyId: string;
  branchId: string;
  loanId: string;
  installmentId: string;
  amount: unknown;
  date?: Date | string;
  createdAt?: Date | string;
  moraPaid: unknown;
}

interface LoanRow {
  id: string;
  branchId: string;
  client: {
    assignedUserId: string;
  };
  balance: unknown;
  status: string;
}

interface InstallmentRow {
  id: string;
  loanId: string;
  number: number;
  dueDate: Date | string;
  expectedAmount: unknown;
  paidAmount: unknown;
  status: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.payment.findMany({
      where: {
        companyId: user.companyId,
        void: null,
        ...(this.canSeeAllBranches(user) ? {} : { branchId: user.branchId }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(rows.map(row => this.toPayment(row)));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor', 'Cobrador')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const loanId = this.clean(body.loanId);
    const installmentId = this.clean(body.installmentId);
    const amount = Number(body.amount);
    const moraPaid = Number(body.moraPaid || 0);

    if (!loanId || !installmentId) throw new BadRequestException('Debe indicar prestamo y cuota.');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('El monto del pago debe ser mayor que cero.');
    if (!Number.isFinite(moraPaid) || moraPaid < 0) throw new BadRequestException('La mora no puede ser negativa.');

    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, companyId: user.companyId },
      include: { client: { select: { assignedUserId: true } } },
    });
    if (!loan) throw new BadRequestException('Prestamo no encontrado.');
    assertBranchScope(user, loan.branchId);
    if (user.role === 'Cobrador' && loan.client.assignedUserId !== user.id) {
      throw new BadRequestException('Prestamo no asignado a este cobrador.');
    }
    if (loan.status === LoanStatus.SALDADO || loan.status === LoanStatus.CANCELADO) {
      throw new BadRequestException('Este prestamo no admite nuevos pagos.');
    }

    const balance = Number(loan.balance);
    if (amount > balance) throw new BadRequestException('El pago no puede exceder el balance pendiente.');

    const installments = await this.prisma.installment.findMany({
      where: { loanId },
      orderBy: { number: 'asc' },
    });
    const selected = installments.find(installment => installment.id === installmentId);
    if (!selected) throw new BadRequestException('Cuota no encontrada.');

    let changes;
    try {
      changes = applyPaymentToInstallments(
        installments.map(installment => ({
          id: installment.id,
          number: installment.number,
          expectedAmount: Number(installment.expectedAmount),
          paidAmount: Number(installment.paidAmount),
          status: installment.status,
        })),
        installmentId,
        amount,
      );
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid payment.');
    }

    const newBalance = Number((balance - amount).toFixed(2));
    const paymentId = `REC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const payment = await this.prisma.$transaction(async tx => {
      for (const change of changes) {
        await tx.installment.update({
          where: { id: change.id },
          data: {
            paidAmount: new Prisma.Decimal(change.paidAmount),
            status: change.status,
            paidAt: change.status === 'PAGADO' ? new Date() : undefined,
          },
        });
      }

      await tx.loan.update({
        where: { id: loanId },
        data: {
          balance: new Prisma.Decimal(Math.max(newBalance, 0)),
          ...(newBalance <= 0 ? { status: LoanStatus.SALDADO } : {}),
        },
      });

      const savedPayment = await tx.payment.create({
        data: {
          id: paymentId,
          companyId: user.companyId,
          branchId: loan.branchId,
          loanId,
          installmentId,
          userId: user.id,
          amount: new Prisma.Decimal(amount),
          moraPaid: new Prisma.Decimal(moraPaid),
        },
      });

      await tx.cashMovement.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: loan.branchId,
          userId: user.id,
          type: 'IN',
          category: 'COBRO',
          amount: new Prisma.Decimal(amount + moraPaid),
          note: `Cobro ${paymentId}`,
        },
      });

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: loan.branchId,
          actorUserId: user.id,
          action: 'PAYMENT_CREATED',
          entityType: 'payment',
          entityId: paymentId,
          metadataJson: { loanId, amount, installments: changes.map(change => change.id) },
        },
      });

      return savedPayment;
    });

    return ok(this.toPayment(payment));
  }

  @Roles('Super Admin', 'Administrador')
  @Post(':paymentId/void')
  async void(@CurrentUser() user: AuthUser, @Param('paymentId') paymentId: string, @Body('reason') reasonValue: unknown) {
    const reason = this.clean(reasonValue);
    if (!reason) throw new BadRequestException('Debe indicar la razon de anulacion.');

    const existingVoid = await this.prisma.paymentVoid.findFirst({
      where: { paymentId, companyId: user.companyId },
      select: { id: true },
    });
    if (existingVoid) throw new BadRequestException('Este pago ya fue anulado.');

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId: user.companyId },
    });
    if (!payment) throw new BadRequestException('Pago no encontrado.');

    const loan = await this.prisma.loan.findFirst({
      where: { id: payment.loanId, companyId: user.companyId },
      include: { client: { select: { assignedUserId: true } } },
    });
    if (!loan) throw new BadRequestException('Prestamo no encontrado.');
    assertBranchScope(user, loan.branchId);

    const installments = await this.prisma.installment.findMany({
      where: { loanId: payment.loanId },
      orderBy: { number: 'asc' },
    });
    const selected = installments.find(installment => installment.id === payment.installmentId);
    if (!selected) throw new BadRequestException('Cuota original no encontrada.');

    let changes;
    try {
      changes = reversePaymentFromInstallments(
        installments.map(installment => ({
          id: installment.id,
          number: installment.number,
          expectedAmount: Number(installment.expectedAmount),
          paidAmount: Number(installment.paidAmount),
          status: installment.status,
        })),
        payment.installmentId,
        Number(payment.amount),
      );
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid payment reversal.');
    }

    const newBalance = Number((Number(loan.balance) + Number(payment.amount)).toFixed(2));
    const voidId = randomUUID();
    await this.prisma.$transaction(async tx => {
      for (const change of changes) {
        await tx.installment.update({
          where: { id: change.id },
          data: {
            paidAmount: new Prisma.Decimal(change.paidAmount),
            status: change.status,
            paidAt: change.paidAmount <= 0 ? null : undefined,
          },
        });
      }

      await tx.loan.update({
        where: { id: payment.loanId },
        data: {
          balance: new Prisma.Decimal(newBalance),
          ...(loan.status === LoanStatus.CANCELADO ? {} : { status: LoanStatus.ACTIVO }),
        },
      });

      await tx.paymentVoid.create({
        data: {
          id: voidId,
          paymentId,
          companyId: user.companyId,
          actorUserId: user.id,
          reason,
        },
      });

      await tx.cashMovement.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: payment.branchId,
          userId: user.id,
          type: 'OUT',
          category: 'COBRO',
          amount: new Prisma.Decimal(Number(payment.amount) + Number(payment.moraPaid)),
          note: `Anulacion de recibo ${paymentId}: ${reason}`,
        },
      });

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: payment.branchId,
          actorUserId: user.id,
          action: 'PAYMENT_VOIDED',
          entityType: 'payment',
          entityId: paymentId,
          metadataJson: { reason, amount: Number(payment.amount) },
        },
      });
    });

    return ok({ id: voidId, paymentId });
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private canSeeAllBranches(user: AuthUser) {
    return user.role === 'Super Admin' || user.role === 'Administrador';
  }

  private toPayment(row: PaymentRow) {
    return {
      id: row.id,
      companyId: row.companyId,
      branchId: row.branchId,
      loanId: row.loanId,
      installmentId: row.installmentId,
      amount: Number(row.amount),
      date: new Date(row.date || row.createdAt || new Date()).toISOString(),
      moraPaid: Number(row.moraPaid),
    };
  }
}
