import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { canAccessAllCompanyBranches } from '../../shared/scope.js';

interface AuditRow {
  id: string;
  companyId: string;
  branchId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date | string;
  actorUser?: {
    name: string | null;
    username: string | null;
  } | null;
}

@UseGuards(AuthGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') requestedBranchId?: string,
    @Query('userId') requestedUserId?: string,
    @Query('action') requestedAction?: string,
    @Query('entityId') requestedEntityId?: string,
    @Query('entityType') requestedEntityType?: string,
    @Query('search') requestedSearch?: string,
  ) {
    const branchId = this.clean(requestedBranchId);
    const userId = user.role === 'Cobrador' ? user.id : this.clean(requestedUserId);
    const action = this.clean(requestedAction);
    const entityId = this.clean(requestedEntityId);
    const entityType = this.clean(requestedEntityType);
    const search = this.clean(requestedSearch);
    const start = this.clean(startDate);
    const end = this.clean(endDate);

    if (start && Number.isNaN(Date.parse(start))) throw new BadRequestException('Fecha inicial invalida.');
    if (end && Number.isNaN(Date.parse(end))) throw new BadRequestException('Fecha final invalida.');
    if (branchId && !canAccessAllCompanyBranches(user) && branchId !== user.branchId) {
      throw new BadRequestException('Sucursal fuera de alcance.');
    }

    const branchNameById = await this.getBranchNameMap(user.companyId);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        companyId: user.companyId,
        ...(canAccessAllCompanyBranches(user) && !branchId ? {} : { branchId: branchId || user.branchId }),
        ...(userId ? { actorUserId: userId } : {}),
        ...(action ? { action } : {}),
        ...(entityId ? { entityId } : {}),
        ...(entityType ? { entityType } : {}),
        createdAt: {
          gte: new Date(`${start || '1900-01-01'}T00:00:00.000Z`),
          lt: this.nextDay(end || '2999-12-31'),
        },
        ...(search ? {
          OR: [
            { action: { contains: search } },
            { entityType: { contains: search } },
            { entityId: { contains: search } },
            { actorUser: { name: { contains: search } } },
            { actorUser: { username: { contains: search } } },
            ...this.branchIdsForSearch(branchNameById, search).map(matchedBranchId => ({ branchId: matchedBranchId })),
          ],
        } : {}),
      },
      include: { actorUser: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    return ok(rows.map(row => this.toAudit(row, branchNameById)));
  }

  private async getBranchNameMap(companyId: string) {
    const branches = await this.prisma.branch.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    return new Map(branches.map(branch => [branch.id, branch.name]));
  }

  private branchIdsForSearch(branchNameById: Map<string, string>, search: string) {
    const needle = search.toLowerCase();
    return Array.from(branchNameById.entries())
      .filter(([, name]) => name.toLowerCase().includes(needle))
      .map(([id]) => id);
  }

  private nextDay(date: string) {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return parsed;
  }

  private toAudit(row: AuditRow, branchNameById: Map<string, string>) {
    const metadata = typeof row.metadataJson === 'string'
      ? JSON.parse(row.metadataJson || '{}')
      : this.asRecord(row.metadataJson);

    return {
      id: row.id,
      companyId: row.companyId,
      branchId: row.branchId || '',
      branchName: row.branchId ? branchNameById.get(row.branchId) || '' : '',
      actorUserId: row.actorUserId || '',
      actorName: row.actorUser?.name || 'Sistema',
      actorUsername: row.actorUser?.username || '',
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId || '',
      metadata,
      createdAt: new Date(row.createdAt).toISOString(),
      title: this.titleFor(row.action),
      description: this.descriptionFor(row.action, row.entityType, metadata),
      activityType: this.activityTypeFor(row.action),
    };
  }

  private activityTypeFor(action: string) {
    if (action.includes('PAYMENT')) return 'PAGO';
    if (action.includes('LOAN')) return 'PRESTAMO';
    if (action.includes('CLIENT')) return 'APPROVAL';
    if (action.includes('ROUTE')) return 'ROUTE_CLOSE';
    if (action.includes('CASH')) return 'CASH_MOVE';
    if (action.includes('USER')) return 'USER_MGMT';
    if (action.includes('COMPANY')) return 'SECURITY';
    if (action.includes('LOGIN')) return 'SECURITY';
    return 'NOTA';
  }

  private titleFor(action: string) {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  private descriptionFor(action: string, entityType: string, metadata: Record<string, unknown>) {
    const details = Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' | ');
    return details || `${this.titleFor(action)} sobre ${entityType}`;
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
}
