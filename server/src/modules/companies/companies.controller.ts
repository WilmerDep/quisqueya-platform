import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { BillingCycle, CompanyStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';

interface CompanyRow {
  id: string;
  name: string;
  rnc: string | null;
  logo: string | null;
  status: string;
  planId: string;
  billingCycle: string;
  expiresAt: Date | string | null;
  billingDay: number;
  subscriptionPrice: unknown;
  configJson: Prisma.JsonValue | null;
  createdAt: Date | string;
}

const DEFAULT_COMPANY_CONFIG = {
  defaultMoraAmount: 100,
  moraType: 'FLAT',
  graceDays: 2,
  currency: 'DOP',
  receiptFooter: 'Gracias por su puntualidad.',
  scoringThresholdRegular: 5,
  scoringThresholdMala: 15,
  skipSundays: true,
  whatsappWelcomeTemplate: '',
  whatsappReceiptTemplate: '',
};

@UseGuards(AuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const rows = await this.selectCompanies(user.companyId);
    if (!rows.length) throw new BadRequestException('Empresa no encontrada.');
    return ok(this.toCompany(rows[0]));
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = user.role === 'Super Admin'
      ? await this.selectCompanies()
      : await this.selectCompanies(user.companyId);
    return ok(rows.map(row => this.toCompany(row)));
  }

  @Roles('Super Admin')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const name = this.clean(body.name);
    const planId = this.clean(body.planId) || 'p2';
    const billingCycle = this.clean(body.billingCycle) === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
    const subscriptionPrice = Number(body.subscriptionPrice || 0);
    const adminUsername = this.clean(body.adminUsername) || this.slugUsername(name);
    const adminPassword = this.clean(body.adminPassword) || 'admin123';

    if (!name) throw new BadRequestException('La empresa necesita un nombre.');
    if (!Number.isFinite(subscriptionPrice) || subscriptionPrice < 0) throw new BadRequestException('Precio de suscripcion invalido.');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) throw new BadRequestException('Plan no encontrado.');

    const duplicatedUser = await this.prisma.user.findUnique({ where: { username: adminUsername }, select: { id: true } });
    if (duplicatedUser) throw new BadRequestException('Ese usuario administrador ya existe.');

    const companyId = `C-${randomUUID()}`;
    const branchId = `B-${randomUUID()}`;
    const adminId = `U-${randomUUID()}`;
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const expiresAt = billingCycle === 'YEARLY'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const company = await this.prisma.$transaction(async tx => {
      const savedCompany = await tx.company.create({
        data: {
          id: companyId,
          name,
          status: CompanyStatus.ACTIVE,
          planId,
          billingCycle: billingCycle === 'YEARLY' ? BillingCycle.YEARLY : BillingCycle.MONTHLY,
          expiresAt,
          billingDay: new Date().getDate(),
          subscriptionPrice: new Prisma.Decimal(subscriptionPrice),
          configJson: {},
        },
      });
      await tx.branch.create({
        data: {
          id: branchId,
          companyId,
          name: 'Sucursal Principal',
          address: 'Pendiente de configurar',
          managerName: name,
          monthlyGoal: new Prisma.Decimal(0),
        },
      });
      await tx.user.create({
        data: {
          id: adminId,
          companyId,
          branchId,
          name: `Admin ${name}`,
          username: adminUsername,
          email: this.clean(body.email) || null,
          passwordHash,
          role: UserRole.ADMINISTRADOR,
          avatar: name.slice(0, 2).toUpperCase(),
          isActive: true,
        },
      });
      await this.audit(tx, user, companyId, 'COMPANY_CREATED', 'company', companyId, { planId, adminUsername });
      return savedCompany;
    });
    return ok({ company: this.toCompany(company), branchId, adminUserId: adminId, adminUsername });
  }

  @Roles('Super Admin', 'Administrador')
  @Patch('me')
  async updateMyCompany(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    if (user.companyId === 'SYSTEM') throw new BadRequestException('La empresa SYSTEM no se edita desde esta operacion.');

    const existing = await this.selectCompanies(user.companyId);
    if (!existing.length) throw new BadRequestException('Empresa no encontrada.');

    const currentCompany = this.toCompany(existing[0]);
    const nextConfig = this.mergeConfig(currentCompany.config, body.config);

    const updated = await this.prisma.$transaction(async tx => {
      const saved = await tx.company.update({
        where: { id: user.companyId },
        data: {
          ...(this.clean(body.name) ? { name: this.clean(body.name) } : {}),
          ...(body.rnc !== undefined ? { rnc: this.clean(body.rnc) || null } : {}),
          ...(body.logo !== undefined ? { logo: this.clean(body.logo) || null } : {}),
          configJson: nextConfig as Prisma.InputJsonValue,
        },
      });
      await this.audit(tx, user, user.branchId, 'COMPANY_SETTINGS_UPDATED', 'company', user.companyId, {
        sections: Object.keys((body.config || {}) as Record<string, unknown>),
        identity: Boolean(body.name || body.rnc !== undefined || body.logo !== undefined),
      });
      return saved;
    });
    return ok(this.toCompany(updated));
  }

  @Roles('Super Admin')
  @Patch(':companyId')
  async update(@CurrentUser() user: AuthUser, @Param('companyId') companyId: string, @Body() body: Record<string, unknown>) {
    if (companyId === 'SYSTEM') throw new BadRequestException('La empresa SYSTEM no se edita desde esta operacion.');

    const existing = await this.selectCompanies(companyId);
    if (!existing.length) throw new BadRequestException('Empresa no encontrada.');

    const status = this.clean(body.status);
    if (status && !['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'TRIAL', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Estado de empresa invalido.');
    }
    const billingCycle = this.clean(body.billingCycle);
    if (billingCycle && !['MONTHLY', 'YEARLY'].includes(billingCycle)) {
      throw new BadRequestException('Ciclo de facturacion invalido.');
    }

    const updated = await this.prisma.$transaction(async tx => {
      const saved = await tx.company.update({
        where: { id: companyId },
        data: {
          ...(this.clean(body.name) ? { name: this.clean(body.name) } : {}),
          ...(status ? { status: status as CompanyStatus } : {}),
          ...(this.clean(body.planId) ? { planId: this.clean(body.planId) } : {}),
          ...(billingCycle ? { billingCycle: billingCycle as BillingCycle } : {}),
          ...(this.clean(body.expiresAt) ? { expiresAt: new Date(`${this.clean(body.expiresAt)}T00:00:00.000Z`) } : {}),
          ...(Number.isFinite(Number(body.subscriptionPrice)) ? { subscriptionPrice: new Prisma.Decimal(Number(body.subscriptionPrice)) } : {}),
        },
      });
      await this.audit(tx, user, companyId, 'COMPANY_UPDATED', 'company', companyId, {
        status: status || undefined,
        planId: this.clean(body.planId) || undefined,
      });
      return saved;
    });
    return ok(this.toCompany(updated));
  }

  private selectCompanies(companyId?: string) {
    return this.prisma.company.findMany({
      where: companyId ? { id: companyId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  private toCompany(row: CompanyRow) {
    const config = this.asRecord(row.configJson);
    return {
      ...row,
      logo: row.logo || undefined,
      rnc: row.rnc || undefined,
      subscriptionPrice: Number(row.subscriptionPrice),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString().slice(0, 10) : '',
      createdAt: new Date(row.createdAt).toISOString(),
      config: { ...DEFAULT_COMPANY_CONFIG, ...config },
      configJson: undefined,
    };
  }

  private slugUsername(name: string) {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 18);
    return base ? `admin_${base}` : `admin_${randomUUID().slice(0, 6)}`;
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private mergeConfig(currentConfig: Record<string, unknown>, incoming: unknown) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return { ...DEFAULT_COMPANY_CONFIG, ...currentConfig };
    }

    const input = incoming as Record<string, unknown>;
    const next = { ...DEFAULT_COMPANY_CONFIG, ...currentConfig };

    if (input.defaultMoraAmount !== undefined) next.defaultMoraAmount = this.nonNegativeNumber(input.defaultMoraAmount, 'Monto de mora invalido.');
    if (input.graceDays !== undefined) next.graceDays = this.nonNegativeNumber(input.graceDays, 'Dias de gracia invalidos.');
    if (input.scoringThresholdRegular !== undefined) next.scoringThresholdRegular = this.nonNegativeNumber(input.scoringThresholdRegular, 'Umbral regular invalido.');
    if (input.scoringThresholdMala !== undefined) next.scoringThresholdMala = this.nonNegativeNumber(input.scoringThresholdMala, 'Umbral mala paga invalido.');
    if (input.moraType !== undefined) {
      const moraType = this.clean(input.moraType);
      if (!['FLAT', 'PERCENT', 'DAILY'].includes(moraType)) throw new BadRequestException('Tipo de mora invalido.');
      next.moraType = moraType;
    }
    if (input.currency !== undefined) {
      const currency = this.clean(input.currency);
      if (currency !== 'DOP') throw new BadRequestException('Moneda no soportada.');
      next.currency = currency;
    }
    if (input.receiptFooter !== undefined) next.receiptFooter = this.clean(input.receiptFooter);
    if (input.whatsappWelcomeTemplate !== undefined) next.whatsappWelcomeTemplate = this.clean(input.whatsappWelcomeTemplate);
    if (input.whatsappReceiptTemplate !== undefined) next.whatsappReceiptTemplate = this.clean(input.whatsappReceiptTemplate);
    if (input.skipSundays !== undefined) next.skipSundays = Boolean(input.skipSundays);

    return next;
  }

  private nonNegativeNumber(value: unknown, message: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException(message);
    return parsed;
  }

  private async audit(tx: Prisma.TransactionClient, user: AuthUser, branchId: string | null, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
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

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
}
