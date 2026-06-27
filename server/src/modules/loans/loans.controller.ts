import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ClientStatus, LoanFrequency, LoanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { assertAssignedCollectorScope, assertBranchScope } from '../../shared/scope.js';

type Frequency = 'Diario' | 'Semanal' | 'Quincenal' | 'Mensual';

interface LoanRow {
  id: string;
  companyId: string;
  branchId: string;
  clientId: string;
  amount: unknown;
  interestRate: unknown;
  frequency: string;
  duration: number;
  startDate: Date | string;
  totalToPay: unknown;
  balance: unknown;
  status: string;
  createdAt: Date | string;
}

interface InstallmentRow {
  id: string;
  loanId: string;
  number: number;
  dueDate: Date | string;
  expectedAmount: unknown;
  paidAmount: unknown;
  status: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
  paidAt: Date | string | null;
}

interface ClientRow {
  id: string;
  branchId: string;
  assignedUserId: string;
  status: string;
  isBlocked: boolean;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const loans = await this.prisma.loan.findMany({
      where: {
        companyId: user.companyId,
        ...(this.canSeeAllBranches(user) ? {} : { branchId: user.branchId }),
      },
      include: { installments: { orderBy: { number: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return ok(loans.map(loan => this.toLoan(loan, loan.installments)));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const clientId = this.clean(body.clientId);
    const amount = Number(body.amount);
    const interestRate = Number(body.interestRate);
    const duration = Number(body.duration);
    const frequency = this.clean(body.frequency) as Frequency;
    const startDate = this.clean(body.startDate);

    if (!clientId) throw new BadRequestException('Debe seleccionar un cliente.');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('El capital debe ser mayor que cero.');
    if (!Number.isFinite(interestRate) || interestRate < 0) throw new BadRequestException('El interes no puede ser negativo.');
    if (!Number.isInteger(duration) || duration <= 0) throw new BadRequestException('El numero de cuotas debe ser mayor que cero.');
    if (!['Diario', 'Semanal', 'Quincenal', 'Mensual'].includes(frequency)) throw new BadRequestException('Frecuencia invalida.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new BadRequestException('Fecha de inicio invalida.');

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: user.companyId },
      select: {
        id: true,
        branchId: true,
        assignedUserId: true,
        status: true,
        isBlocked: true,
      },
    });
    if (!client) throw new BadRequestException('Cliente no encontrado.');
    if (client.status !== ClientStatus.APROBADO || client.isBlocked) {
      throw new BadRequestException('Solo puede desembolsar a clientes aprobados y activos.');
    }
    assertBranchScope(user, client.branchId);
    assertAssignedCollectorScope(user, client.assignedUserId);

    const installments = this.generateSchedule(amount, interestRate, duration, frequency, startDate);
    const totalToPay = Number(installments.reduce((sum, installment) => sum + installment.expectedAmount, 0).toFixed(2));
    const loanId = randomUUID();

    const loan = await this.prisma.$transaction(async tx => {
      await tx.loan.create({
        data: {
          id: loanId,
          companyId: user.companyId,
          branchId: client.branchId,
          clientId,
          amount: new Prisma.Decimal(amount),
          interestRate: new Prisma.Decimal(interestRate),
          frequency: this.toLoanFrequency(frequency),
          duration,
          startDate: new Date(`${startDate}T00:00:00.000Z`),
          totalToPay: new Prisma.Decimal(totalToPay),
          balance: new Prisma.Decimal(totalToPay),
          status: LoanStatus.ACTIVO,
        },
      });

      await tx.installment.createMany({
        data: installments.map(installment => ({
          id: randomUUID(),
          loanId,
          number: installment.number,
          dueDate: new Date(`${installment.dueDate}T00:00:00.000Z`),
          expectedAmount: new Prisma.Decimal(installment.expectedAmount),
        })),
      });

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: client.branchId,
          actorUserId: user.id,
          action: 'LOAN_CREATED',
          entityType: 'loan',
          entityId: loanId,
          metadataJson: { clientId, amount },
        },
      });

      return tx.loan.findUniqueOrThrow({
        where: { id: loanId },
        include: { installments: { orderBy: { number: 'asc' } } },
      });
    });

    return ok(this.toLoan(loan, loan.installments));
  }

  private generateSchedule(amount: number, interestRate: number, duration: number, frequency: Frequency, startDate: string) {
    const totalInterest = amount * (interestRate / 100);
    const totalToPay = amount + totalInterest;
    const amountPerQuota = Math.floor((totalToPay / duration) * 100) / 100;
    const schedule: Array<{ number: number; dueDate: string; expectedAmount: number }> = [];
    const [year, month, day] = startDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    let accumulated = 0;

    for (let number = 1; number <= duration; number += 1) {
      this.advanceDate(currentDate, frequency);
      const expectedAmount = number === duration
        ? Number((totalToPay - accumulated).toFixed(2))
        : Number(amountPerQuota.toFixed(2));
      if (number !== duration) accumulated += expectedAmount;
      schedule.push({
        number,
        dueDate: currentDate.toISOString().slice(0, 10),
        expectedAmount,
      });
    }

    return schedule;
  }

  private advanceDate(date: Date, frequency: Frequency) {
    if (frequency === 'Diario') date.setDate(date.getDate() + 1);
    if (frequency === 'Semanal') date.setDate(date.getDate() + 7);
    if (frequency === 'Quincenal') date.setDate(date.getDate() + 15);
    if (frequency === 'Mensual') date.setMonth(date.getMonth() + 1);
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private canSeeAllBranches(user: AuthUser) {
    return user.role === 'Super Admin' || user.role === 'Administrador';
  }

  private toLoanFrequency(frequency: Frequency) {
    const map: Record<Frequency, LoanFrequency> = {
      Diario: LoanFrequency.DIARIO,
      Semanal: LoanFrequency.SEMANAL,
      Quincenal: LoanFrequency.QUINCENAL,
      Mensual: LoanFrequency.MENSUAL,
    };
    return map[frequency];
  }

  private toLoan(row: LoanRow, installments: InstallmentRow[]) {
    return {
      id: row.id,
      companyId: row.companyId,
      branchId: row.branchId,
      clientId: row.clientId,
      amount: Number(row.amount),
      interestRate: Number(row.interestRate),
      frequency: this.fromLoanFrequency(row.frequency as string),
      duration: row.duration,
      totalToPay: Number(row.totalToPay),
      balance: Number(row.balance),
      status: this.fromLoanStatus(row.status),
      startDate: new Date(row.startDate).toISOString().slice(0, 10),
      createdAt: new Date(row.createdAt).toISOString(),
      installments: installments.map(installment => ({
        id: installment.id,
        loanId: installment.loanId,
        number: installment.number,
        expectedAmount: Number(installment.expectedAmount),
        paidAmount: Number(installment.paidAmount),
        status: installment.status,
        dueDate: new Date(installment.dueDate).toISOString(),
        paidAt: installment.paidAt ? new Date(installment.paidAt).toISOString() : undefined,
      })),
    };
  }

  private fromLoanFrequency(frequency: string) {
    const map: Record<string, Frequency> = {
      DIARIO: 'Diario',
      SEMANAL: 'Semanal',
      QUINCENAL: 'Quincenal',
      MENSUAL: 'Mensual',
      Diario: 'Diario',
      Semanal: 'Semanal',
      Quincenal: 'Quincenal',
      Mensual: 'Mensual',
    };
    return map[frequency] || frequency;
  }

  private fromLoanStatus(status: string) {
    const map: Record<string, string> = {
      ACTIVO: 'Activo',
      SALDADO: 'Saldado',
      EN_MORA: 'En Mora',
      CANCELADO: 'Cancelado',
      Activo: 'Activo',
      Saldado: 'Saldado',
      'En Mora': 'En Mora',
      Cancelado: 'Cancelado',
    };
    return map[status] || status;
  }
}
