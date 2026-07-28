import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ContactStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';

@UseGuards(AuthGuard, RolesGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const normalizedStatus = this.parseStatus(status);
    const term = this.clean(search);
    const rows = await this.prisma.contact.findMany({
      where: {
        companyId: user.companyId,
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...(term
          ? {
              OR: [
                { firstName: { contains: term } },
                { lastName: { contains: term } },
                { email: { contains: term } },
                { phone: { contains: term } },
                { whatsapp: { contains: term } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return ok(rows);
  }

  @Get(':contactId')
  async getOne(@CurrentUser() user: AuthUser, @Param('contactId') contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId: user.companyId },
    });
    if (!contact) throw new NotFoundException('Contacto no encontrado.');
    return ok(contact);
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const firstName = this.clean(body.firstName);
    const lastName = this.clean(body.lastName);
    if (!firstName || !lastName) {
      throw new BadRequestException('Nombre y apellido son requeridos.');
    }

    const ownerUserId = this.clean(body.ownerUserId) || null;
    if (ownerUserId) await this.assertOwner(user.companyId, ownerUserId);

    const id = randomUUID();
    const created = await this.prisma.$transaction(async tx => {
      const contact = await tx.contact.create({
        data: {
          id,
          companyId: user.companyId,
          ownerUserId,
          firstName,
          lastName,
          email: this.clean(body.email) || null,
          phone: this.clean(body.phone) || null,
          whatsapp: this.clean(body.whatsapp) || null,
          countryCode: this.clean(body.countryCode) || null,
          preferredLanguage: this.clean(body.preferredLanguage) || null,
          source: this.clean(body.source) || null,
          notes: this.clean(body.notes) || null,
          status: this.parseStatus(this.clean(body.status)) || ContactStatus.ACTIVE,
          provenanceJson: this.asJson(body.provenanceJson),
        },
      });
      await this.audit(tx, user, 'CONTACT_CREATED', id, { source: contact.source || undefined });
      return contact;
    });
    return ok(created);
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Patch(':contactId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('contactId') contactId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId: user.companyId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Contacto no encontrado.');

    const ownerUserId = body.ownerUserId === null ? null : this.clean(body.ownerUserId) || undefined;
    if (typeof ownerUserId === 'string') await this.assertOwner(user.companyId, ownerUserId);
    const status = body.status !== undefined ? this.parseStatus(this.clean(body.status), true) : undefined;

    const updated = await this.prisma.$transaction(async tx => {
      const contact = await tx.contact.update({
        where: { id: contactId },
        data: {
          ...(this.clean(body.firstName) ? { firstName: this.clean(body.firstName) } : {}),
          ...(this.clean(body.lastName) ? { lastName: this.clean(body.lastName) } : {}),
          ...(body.email !== undefined ? { email: this.clean(body.email) || null } : {}),
          ...(body.phone !== undefined ? { phone: this.clean(body.phone) || null } : {}),
          ...(body.whatsapp !== undefined ? { whatsapp: this.clean(body.whatsapp) || null } : {}),
          ...(body.countryCode !== undefined ? { countryCode: this.clean(body.countryCode) || null } : {}),
          ...(body.preferredLanguage !== undefined ? { preferredLanguage: this.clean(body.preferredLanguage) || null } : {}),
          ...(body.source !== undefined ? { source: this.clean(body.source) || null } : {}),
          ...(body.notes !== undefined ? { notes: this.clean(body.notes) || null } : {}),
          ...(ownerUserId !== undefined ? { ownerUserId } : {}),
          ...(status ? { status } : {}),
          ...(body.provenanceJson !== undefined ? { provenanceJson: this.asJson(body.provenanceJson) } : {}),
        },
      });
      await this.audit(tx, user, 'CONTACT_UPDATED', contactId, { status: status || undefined });
      return contact;
    });
    return ok(updated);
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private parseStatus(value?: string, strict = false): ContactStatus | undefined {
    if (!value) return undefined;
    if (Object.values(ContactStatus).includes(value as ContactStatus)) return value as ContactStatus;
    if (strict || value) throw new BadRequestException('Estado de contacto invalido.');
    return undefined;
  }

  private async assertOwner(companyId: string, ownerUserId: string) {
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerUserId, companyId, isActive: true },
      select: { id: true },
    });
    if (!owner) throw new BadRequestException('El responsable seleccionado no pertenece a la empresa o esta inactivo.');
  }

  private asJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        companyId: user.companyId,
        branchId: user.branchId,
        actorUserId: user.id,
        action,
        entityType: 'contact',
        entityId,
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
