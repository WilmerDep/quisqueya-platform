import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { canAccessAllCompanyBranches } from '../../shared/scope.js';

@UseGuards(AuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('exports')
  async listExports(
    @CurrentUser() user: AuthUser,
    @Query('branchId') requestedBranchId?: string,
    @Query('format') requestedFormat?: string,
  ) {
    const branchId = this.clean(requestedBranchId);
    const format = this.clean(requestedFormat).toUpperCase();

    if (branchId && !canAccessAllCompanyBranches(user) && branchId !== user.branchId) {
      throw new BadRequestException('Sucursal fuera de alcance.');
    }

    const rows = await this.prisma.reportExport.findMany({
      where: {
        companyId: user.companyId,
        ...(branchId ? { branchId } : !canAccessAllCompanyBranches(user) ? { branchId: user.branchId } : {}),
        ...(format ? { format } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return ok(
      rows.map(row => ({
        id: row.id,
        companyId: row.companyId,
        branchId: row.branchId,
        userId: row.userId,
        reportName: row.reportName,
        reportType: row.reportType,
        format: row.format,
        rangeLabel: row.rangeLabel,
        startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
        endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
        branchName: row.branchName,
        collectorId: row.collectorId,
        collectorName: row.collectorName,
        fileSizeLabel: row.fileSizeLabel,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  @Post('exports')
  async createExport(
    @CurrentUser() user: AuthUser,
    @Body()
    payload: {
      reportName?: string;
      reportType?: string;
      format?: string;
      rangeLabel?: string;
      startDate?: string;
      endDate?: string;
      branchId?: string;
      branchName?: string;
      collectorId?: string;
      collectorName?: string;
      fileSizeLabel?: string;
      filters?: Record<string, unknown>;
    },
  ) {
    const reportName = this.clean(payload.reportName);
    const reportType = this.clean(payload.reportType);
    const format = this.clean(payload.format).toUpperCase();
    const rangeLabel = this.clean(payload.rangeLabel);
    const branchId = this.clean(payload.branchId) || null;
    const branchName = this.clean(payload.branchName) || null;
    const collectorId = user.role === 'Cobrador' ? user.id : this.clean(payload.collectorId) || null;
    const collectorName = this.clean(payload.collectorName) || null;
    const fileSizeLabel = this.clean(payload.fileSizeLabel) || null;

    if (!reportName || !reportType || !format || !rangeLabel) {
      throw new BadRequestException('Exportacion incompleta.');
    }
    if (!['PDF', 'CSV'].includes(format)) {
      throw new BadRequestException('Formato de exportacion invalido.');
    }
    if (branchId && !canAccessAllCompanyBranches(user) && branchId !== user.branchId) {
      throw new BadRequestException('Sucursal fuera de alcance.');
    }

    const exportLog = await this.prisma.reportExport.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        branchId,
        userId: user.id,
        reportName,
        reportType,
        format,
        rangeLabel,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        branchName,
        collectorId,
        collectorName,
        fileSizeLabel,
        filtersJson: (payload.filters || null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
      },
    });

    return ok({
      id: exportLog.id,
      companyId: exportLog.companyId,
      branchId: exportLog.branchId,
      userId: exportLog.userId,
      reportName: exportLog.reportName,
      reportType: exportLog.reportType,
      format: exportLog.format,
      rangeLabel: exportLog.rangeLabel,
      startDate: exportLog.startDate ? exportLog.startDate.toISOString().slice(0, 10) : null,
      endDate: exportLog.endDate ? exportLog.endDate.toISOString().slice(0, 10) : null,
      branchName: exportLog.branchName,
      collectorId: exportLog.collectorId,
      collectorName: exportLog.collectorName,
      fileSizeLabel: exportLog.fileSizeLabel,
      createdAt: exportLog.createdAt.toISOString(),
    });
  }

  @Get('schedules')
  async listSchedules(
    @CurrentUser() user: AuthUser,
    @Query('branchId') requestedBranchId?: string,
  ) {
    const branchId = this.clean(requestedBranchId);

    if (branchId && !canAccessAllCompanyBranches(user) && branchId !== user.branchId) {
      throw new BadRequestException('Sucursal fuera de alcance.');
    }

    const rows = await this.prisma.reportSchedule.findMany({
      where: {
        companyId: user.companyId,
        ...(branchId ? { branchId } : !canAccessAllCompanyBranches(user) ? { branchId: user.branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return ok(
      rows.map(row => ({
        id: row.id,
        companyId: row.companyId,
        branchId: row.branchId,
        userId: row.userId,
        name: row.name,
        reportType: row.reportType,
        format: row.format,
        frequency: row.frequency,
        deliveryHour: row.deliveryHour,
        targetLabel: row.targetLabel,
        isActive: row.isActive,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  @Post('schedules')
  async createSchedule(
    @CurrentUser() user: AuthUser,
    @Body()
    payload: {
      name?: string;
      reportType?: string;
      format?: string;
      frequency?: string;
      deliveryHour?: string;
      targetLabel?: string;
      branchId?: string;
    },
  ) {
    const name = this.clean(payload.name);
    const reportType = this.clean(payload.reportType);
    const format = this.clean(payload.format).toUpperCase();
    const frequency = this.clean(payload.frequency);
    const deliveryHour = this.clean(payload.deliveryHour);
    const targetLabel = this.clean(payload.targetLabel);
    const branchId = this.clean(payload.branchId) || null;

    if (!name || !reportType || !format || !frequency || !deliveryHour || !targetLabel) {
      throw new BadRequestException('Programacion incompleta.');
    }
    if (!['PDF', 'CSV'].includes(format)) {
      throw new BadRequestException('Formato de programacion invalido.');
    }
    if (branchId && !canAccessAllCompanyBranches(user) && branchId !== user.branchId) {
      throw new BadRequestException('Sucursal fuera de alcance.');
    }

    const schedule = await this.prisma.reportSchedule.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        branchId,
        userId: user.id,
        name,
        reportType,
        format,
        frequency,
        deliveryHour,
        targetLabel,
      },
    });

    return ok({
      id: schedule.id,
      companyId: schedule.companyId,
      branchId: schedule.branchId,
      userId: schedule.userId,
      name: schedule.name,
      reportType: schedule.reportType,
      format: schedule.format,
      frequency: schedule.frequency,
      deliveryHour: schedule.deliveryHour,
      targetLabel: schedule.targetLabel,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt.toISOString(),
    });
  }

  @Get('templates')
  async listTemplates(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.reportTemplate.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    return ok(
      rows.map(row => {
        const payload = row.sectionsJson && typeof row.sectionsJson === 'object' && !Array.isArray(row.sectionsJson)
          ? row.sectionsJson as Record<string, unknown>
          : null;
        const sections = Array.isArray(payload?.sections)
          ? payload.sections.filter(item => typeof item === 'string')
          : Array.isArray(row.sectionsJson)
            ? row.sectionsJson.filter(item => typeof item === 'string')
            : [];
        const config = payload?.config && typeof payload.config === 'object'
          ? payload.config
          : undefined;

        return {
          id: row.id,
          companyId: row.companyId,
          userId: row.userId,
          name: row.name,
          reportType: row.reportType,
          status: row.status,
          isDefault: row.isDefault,
          sections,
          config,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    );
  }

  @Post('templates')
  async createTemplate(
    @CurrentUser() user: AuthUser,
    @Body()
    payload: {
      name?: string;
      reportType?: string;
      status?: string;
      isDefault?: boolean;
      sections?: string[];
      config?: Record<string, unknown>;
    },
  ) {
    const name = this.clean(payload.name);
    const reportType = this.clean(payload.reportType);
    const status = this.clean(payload.status);
    const isDefault = Boolean(payload.isDefault);
    const sections = Array.isArray(payload.sections) ? payload.sections.filter(item => typeof item === 'string' && item.trim()) : [];
    const config = payload.config && typeof payload.config === 'object' ? payload.config : undefined;

    if (!name || !reportType || !status) {
      throw new BadRequestException('Plantilla incompleta.');
    }

    const template = await this.prisma.$transaction(async tx => {
      if (isDefault) {
        await tx.reportTemplate.updateMany({
          where: { companyId: user.companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.reportTemplate.create({
        data: {
          id: crypto.randomUUID(),
          companyId: user.companyId,
          userId: user.id,
          name,
          reportType,
          status,
          isDefault,
          sectionsJson: { sections, config } as Prisma.InputJsonValue,
        },
      });
    });

    return ok({
      id: template.id,
      companyId: template.companyId,
      userId: template.userId,
      name: template.name,
      reportType: template.reportType,
      status: template.status,
      isDefault: template.isDefault,
      sections,
      config,
      createdAt: template.createdAt.toISOString(),
    });
  }

  @Patch('templates/:templateId')
  async updateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('templateId') templateId: string,
    @Body()
    payload: {
      name?: string;
      reportType?: string;
      status?: string;
      isDefault?: boolean;
      sections?: string[];
      config?: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, companyId: user.companyId },
    });
    if (!existing) throw new BadRequestException('Plantilla no encontrada.');

    const name = this.clean(payload.name) || existing.name;
    const reportType = this.clean(payload.reportType) || existing.reportType;
    const status = this.clean(payload.status) || existing.status;
    const isDefault = payload.isDefault === undefined ? existing.isDefault : Boolean(payload.isDefault);
    const existingPayload = existing.sectionsJson && typeof existing.sectionsJson === 'object' && !Array.isArray(existing.sectionsJson)
      ? existing.sectionsJson as Record<string, unknown>
      : null;
    const sections = Array.isArray(payload.sections)
      ? payload.sections.filter(item => typeof item === 'string' && item.trim())
      : Array.isArray(existingPayload?.sections)
        ? existingPayload.sections.filter(item => typeof item === 'string')
        : Array.isArray(existing.sectionsJson)
          ? existing.sectionsJson.filter(item => typeof item === 'string')
          : [];
    const config = payload.config && typeof payload.config === 'object'
      ? payload.config
      : existingPayload?.config && typeof existingPayload.config === 'object'
        ? existingPayload.config
        : undefined;

    const template = await this.prisma.$transaction(async tx => {
      if (isDefault) {
        await tx.reportTemplate.updateMany({
          where: { companyId: user.companyId, isDefault: true, id: { not: templateId } },
          data: { isDefault: false },
        });
      }

      return tx.reportTemplate.update({
        where: { id: templateId },
        data: {
          name,
          reportType,
          status,
          isDefault,
          sectionsJson: { sections, config } as Prisma.InputJsonValue,
        },
      });
    });

    return ok({
      id: template.id,
      companyId: template.companyId,
      userId: template.userId,
      name: template.name,
      reportType: template.reportType,
      status: template.status,
      isDefault: template.isDefault,
      sections,
      config,
      createdAt: template.createdAt.toISOString(),
    });
  }

  @Get('summary')
  async summary(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') requestedBranchId?: string,
    @Query('collectorId') requestedCollectorId?: string,
  ) {
    const branchId = this.clean(requestedBranchId);
    const collectorId = user.role === 'Cobrador' ? user.id : this.clean(requestedCollectorId);
    const start = this.clean(startDate);
    const end = this.clean(endDate);

    if (start && Number.isNaN(Date.parse(start))) throw new BadRequestException('Fecha inicial invalida.');
    if (end && Number.isNaN(Date.parse(end))) throw new BadRequestException('Fecha final invalida.');
    if (branchId && !canAccessAllCompanyBranches(user) && branchId !== user.branchId) {
      throw new BadRequestException('Sucursal fuera de alcance.');
    }

    const scope = this.scopeSql(user.companyId, branchId || user.branchId, canAccessAllCompanyBranches(user) && !branchId, collectorId);
    const dateScope = {
      start: start || '1900-01-01',
      end: end || '2999-12-31',
    };
    const collectorScope = collectorId
      ? Prisma.sql`AND c.assigned_user_id = ${collectorId}`
      : Prisma.empty;
    const routeCollectorScope = collectorId
      ? Prisma.sql`AND collector_id = ${collectorId}`
      : Prisma.empty;

    const [loans, payments, cash, overdue, routes] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT COUNT(*) total,
                SUM(CASE WHEN l.status = 'Activo' THEN 1 ELSE 0 END) active,
                SUM(CASE WHEN l.status = 'Saldado' THEN 1 ELSE 0 END) completed,
                COALESCE(SUM(l.balance), 0) portfolio,
                COALESCE(SUM(CASE WHEN l.created_at BETWEEN ${dateScope.start} AND DATE_ADD(${dateScope.end}, INTERVAL 1 DAY) THEN l.amount ELSE 0 END), 0) lent,
                COALESCE(SUM(CASE WHEN l.created_at BETWEEN ${dateScope.start} AND DATE_ADD(${dateScope.end}, INTERVAL 1 DAY) THEN (l.total_to_pay - l.amount) ELSE 0 END), 0) expectedInterest
         FROM loans l
         INNER JOIN clients c ON c.id = l.client_id
         WHERE l.company_id = ${scope.companyId}
           ${scope.branchFilter}
           ${collectorScope}`),
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT COALESCE(SUM(p.amount), 0) collected,
                COUNT(*) receipts,
                COALESCE(SUM(p.mora_paid), 0) moraCollected,
                (SELECT COUNT(*) FROM payment_voids pv WHERE pv.company_id = ${scope.companyId} AND pv.created_at BETWEEN ${dateScope.start} AND DATE_ADD(${dateScope.end}, INTERVAL 1 DAY)) voidedPayments
         FROM payments p
         INNER JOIN loans l ON l.id = p.loan_id
         INNER JOIN clients c ON c.id = l.client_id
         WHERE p.company_id = ${scope.companyId}
           AND p.created_at BETWEEN ${dateScope.start} AND DATE_ADD(${dateScope.end}, INTERVAL 1 DAY)
           ${scope.paymentBranchFilter}
           ${collectorScope}
           AND p.id NOT IN (SELECT payment_id FROM payment_voids WHERE company_id = ${scope.companyId})`),
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0) balance,
                COALESCE(SUM(CASE WHEN type = 'IN' AND created_at BETWEEN ${dateScope.start} AND DATE_ADD(${dateScope.end}, INTERVAL 1 DAY) THEN amount ELSE 0 END), 0) cashIn,
                COALESCE(SUM(CASE WHEN type = 'OUT' AND created_at BETWEEN ${dateScope.start} AND DATE_ADD(${dateScope.end}, INTERVAL 1 DAY) THEN amount ELSE 0 END), 0) cashOut
         FROM cash_movements
         WHERE company_id = ${scope.companyId}
           ${scope.rawBranchFilter}`),
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT COUNT(DISTINCT l.id) overdueLoans,
                COALESCE(SUM(GREATEST(i.expected_amount - i.paid_amount, 0)), 0) overdueAmount
         FROM installments i
         INNER JOIN loans l ON l.id = i.loan_id
         INNER JOIN clients c ON c.id = l.client_id
         WHERE l.company_id = ${scope.companyId}
           AND i.status <> 'PAGADO'
           AND i.due_date < CURRENT_DATE
           ${scope.branchFilter}
           ${collectorScope}`),
      this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT COUNT(*) totalRoutes,
                SUM(CASE WHEN status = 'Cerrada' THEN 1 ELSE 0 END) closedRoutes
         FROM collection_routes
         WHERE company_id = ${scope.companyId}
           AND date BETWEEN ${dateScope.start} AND ${dateScope.end}
           ${scope.rawBranchFilter}
           ${routeCollectorScope}`),
    ]);
    return ok({
      loans: this.numberize(loans[0]),
      payments: this.numberize(payments[0]),
      cash: this.numberize(cash[0]),
      overdue: this.numberize(overdue[0]),
      routes: this.numberize(routes[0]),
      filters: {
        startDate: start || null,
        endDate: end || null,
        branchId: branchId || null,
        collectorId: collectorId || null,
      },
    });
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private numberize(row: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(row || {}).map(([key, value]) => [
        key,
        typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))
          ? Number(value)
          : value,
      ]),
    );
  }

  private scopeSql(companyId: string, branchId: string, canSeeAllBranches: boolean, _collectorId: string) {
    return {
      companyId,
      branchFilter: canSeeAllBranches ? Prisma.empty : Prisma.sql`AND l.branch_id = ${branchId}`,
      paymentBranchFilter: canSeeAllBranches ? Prisma.empty : Prisma.sql`AND p.branch_id = ${branchId}`,
      rawBranchFilter: canSeeAllBranches ? Prisma.empty : Prisma.sql`AND branch_id = ${branchId}`,
    };
  }
}
