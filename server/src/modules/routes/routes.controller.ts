import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, RouteStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { assertBranchScope } from '../../shared/scope.js';
import { calculateTrackingConnectivity, validateLocationPayload } from './tracking-validation.js';


interface RouteRow {
  id: string;
  companyId: string;
  branchId: string;
  collectorId: string;
  date: Date | string;
  status: string;
}

interface RouteItemRow {
  id: string;
  routeId: string;
  loanId: string;
  installmentId: string | null;
  clientId: string;
  clientName: string;
  address: string;
  amountToCollect: unknown;
  sortOrder?: number;
  order?: number;
  visitStatus: 'PENDING' | 'VISITED' | 'PAID' | 'PROMISED' | 'FAILED';
  visitResult: string | null;
  notes: string | null;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('routes')
export class RoutesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const routes = await this.prisma.collectionRoute.findMany({
      where: {
        companyId: user.companyId,
        ...(this.canSeeAllBranches(user) ? {} : {
          OR: [
            { branchId: user.branchId },
            { collectorId: user.id },
          ],
        }),
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return ok(routes.map(route => this.toRoute(route, route.items)));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const collectorId = this.clean(body.collectorId);
    const branchId = this.clean(body.branchId) || user.branchId;
    const date = this.clean(body.date);
    const items = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];

    if (!collectorId) throw new BadRequestException('Debe seleccionar un cobrador.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Fecha de ruta invalida.');
    if (!items.length) throw new BadRequestException('Debe seleccionar cuotas para la ruta.');
    assertBranchScope(user, branchId);

    const routeId = randomUUID();
    await this.prisma.$transaction(async tx => {
      await tx.collectionRoute.create({
        data: {
          id: routeId,
          companyId: user.companyId,
          branchId,
          collectorId,
          date: new Date(`${date}T00:00:00.000Z`),
          status: RouteStatus.ABIERTA,
        },
      });

      await tx.routeItem.createMany({
        data: items.map((item, index) => ({
          id: this.clean(item.id) || randomUUID(),
          routeId,
          loanId: this.clean(item.loanId),
          installmentId: this.clean(item.installmentId) || null,
          clientId: this.clean(item.clientId),
          clientName: this.clean(item.clientName),
          address: this.clean(item.address),
          amountToCollect: new Prisma.Decimal(Number(item.amountToCollect || 0)),
          sortOrder: Number(item.order || index + 1),
          visitStatus: 'PENDING',
        })),
      });

      await this.audit(tx, user, branchId, 'ROUTE_CREATED', 'route', routeId, { items: items.length, collectorId });
    });
    return ok(await this.getRoute(routeId, user.companyId));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor', 'Cobrador')
  @Patch(':routeId/status')
  async updateStatus(@CurrentUser() user: AuthUser, @Param('routeId') routeId: string, @Body('status') status: string) {
    if (!['Abierta', 'En Curso', 'Cerrada'].includes(status)) throw new BadRequestException('Estado de ruta invalido.');
    if (status === 'Cerrada') throw new BadRequestException('Use la liquidacion de ruta para cerrar.');
    const route = await this.ensureRoute(routeId, user.companyId);
    this.assertRouteScope(user, route);
    await this.prisma.$transaction(async tx => {
      await tx.collectionRoute.update({
        where: { id: routeId },
        data: { status: this.toRouteStatus(status) },
      });
      await this.audit(tx, user, route.branchId, 'ROUTE_STATUS_UPDATED', 'route', routeId, { status });
    });
    return ok(await this.getRoute(routeId, user.companyId));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor', 'Cobrador')
  @Patch(':routeId/items/:itemId')
  async updateItem(
    @CurrentUser() user: AuthUser,
    @Param('routeId') routeId: string,
    @Param('itemId') itemId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const route = await this.ensureRoute(routeId, user.companyId);
    this.assertRouteScope(user, route);
    const visitStatus = this.clean(body.visitStatus);
    const visitResult = this.clean(body.visitResult);
    if (visitStatus && !['PENDING', 'VISITED', 'PAID', 'PROMISED', 'FAILED'].includes(visitStatus)) {
      throw new BadRequestException('Estado de visita invalido.');
    }

    const updatedItem = await this.prisma.$transaction(async tx => {
      const item = await tx.routeItem.update({
        where: { id: itemId },
        data: {
          ...(visitStatus ? { visitStatus: visitStatus as 'PENDING' | 'VISITED' | 'PAID' | 'PROMISED' | 'FAILED' } : {}),
          ...(visitResult ? { visitResult } : {}),
          ...(this.clean(body.notes) ? { notes: this.clean(body.notes) } : {}),
        },
      });
      await this.audit(tx, user, route.branchId, 'ROUTE_ITEM_UPDATED', 'route_item', itemId, { routeId, visitStatus, visitResult });
      return item;
    });
    return ok(this.toItem(updatedItem));
  }

  @Roles('Super Admin', 'Administrador', 'Supervisor')
  @Post(':routeId/close')
  async close(@CurrentUser() user: AuthUser, @Param('routeId') routeId: string, @Body('cashInHand') cashInHand: unknown) {
    const route = await this.ensureRoute(routeId, user.companyId);
    this.assertRouteScope(user, route);
    if (route.status === 'Cerrada') throw new BadRequestException('La ruta ya fue cerrada.');
    const amount = Number(cashInHand || 0);
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('El monto de liquidacion no puede ser negativo.');

    await this.prisma.$transaction(async tx => {
      await tx.collectionRoute.update({
        where: { id: routeId },
        data: { status: RouteStatus.CERRADA },
      });
      await tx.cashMovement.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: route.branchId,
          userId: user.id,
          type: 'IN',
          category: 'COBRO',
          amount: new Prisma.Decimal(amount),
          note: `Liquidacion de ruta ${routeId}`,
        },
      });
      await this.audit(tx, user, route.branchId, 'ROUTE_CLOSED', 'route', routeId, { cashInHand: amount });
    });
    return ok(await this.getRoute(routeId, user.companyId));
  }

  private async ensureRoute(routeId: string, companyId: string) {
    const route = await this.prisma.collectionRoute.findFirst({
      where: { id: routeId, companyId },
    });
    if (!route) throw new BadRequestException('Ruta no encontrada.');
    return this.toRouteRow(route);
  }

  private async getRoute(routeId: string, companyId: string) {
    const route = await this.prisma.collectionRoute.findFirst({
      where: { id: routeId, companyId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!route) throw new BadRequestException('Ruta no encontrada.');
    return this.toRoute(route, route.items);
  }

  private toRoute(route: RouteRow, items: RouteItemRow[]) {
    return {
      id: route.id,
      companyId: route.companyId,
      branchId: route.branchId,
      collectorId: route.collectorId,
      date: new Date(route.date).toISOString().slice(0, 10),
      status: this.fromRouteStatus(route.status),
      items: items.map(item => this.toItem(item)),
    };
  }

  private toItem(item: RouteItemRow) {
    return {
      id: item.id,
      routeId: item.routeId,
      loanId: item.loanId,
      installmentId: item.installmentId,
      clientId: item.clientId,
      clientName: item.clientName,
      address: item.address,
      amountToCollect: Number(item.amountToCollect),
      order: item.order ?? item.sortOrder ?? 0,
      visitStatus: item.visitStatus,
      visitResult: item.visitResult || undefined,
      notes: item.notes || undefined,
    };
  }

  private clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private assertRouteScope(user: AuthUser, route: RouteRow) {
    if (user.role === 'Cobrador') {
      if (route.collectorId === user.id) return;
      throw new BadRequestException('Ruta no disponible para este cobrador.');
    }
    assertBranchScope(user, route.branchId);
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

  private canSeeAllBranches(user: AuthUser) {
    return user.role === 'Super Admin' || user.role === 'Administrador';
  }

  private toRouteStatus(status: string) {
    const map: Record<string, RouteStatus> = {
      Abierta: RouteStatus.ABIERTA,
      'En Curso': RouteStatus.EN_CURSO,
      Cerrada: RouteStatus.CERRADA,
    };
    return map[status];
  }

  private fromRouteStatus(status: string) {
    const map: Record<string, string> = {
      ABIERTA: 'Abierta',
      EN_CURSO: 'En Curso',
      CERRADA: 'Cerrada',
      Abierta: 'Abierta',
      'En Curso': 'En Curso',
      Cerrada: 'Cerrada',
    };
    return map[status] || status;
  }

  private toRouteRow(route: RouteRow): RouteRow {
    return {
      id: route.id,
      companyId: route.companyId,
      branchId: route.branchId,
      collectorId: route.collectorId,
      date: route.date,
      status: this.fromRouteStatus(route.status),
    };
  }

  @Roles('Cobrador')
  @Post(':routeId/tracking/location')
  async saveLocation(
    @CurrentUser() user: AuthUser,
    @Param('routeId') routeId: string,
    @Body() body: {
      collectorId?: string;
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number;
      heading?: number;
      battery?: number;
    }
  ) {
    if (user.role !== 'Cobrador') {
      throw new ForbiddenException('Solo los cobradores pueden publicar ubicación GPS.');
    }

    const route = await this.prisma.collectionRoute.findFirst({
      where: { id: routeId, companyId: user.companyId }
    });
    if (!route) throw new BadRequestException('Ruta no encontrada.');
    
    assertBranchScope(user, route.branchId);

    if (route.collectorId !== user.id) {
      throw new ForbiddenException('No está autorizado para publicar ubicación en esta ruta.');
    }

    const normalizedStatus = this.fromRouteStatus(route.status);
    if (normalizedStatus !== 'En Curso' && normalizedStatus !== 'Abierta') {
      throw new BadRequestException('Solo se permite publicar ubicación en rutas abiertas o en curso.');
    }

    const validation = validateLocationPayload(body);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const point = await this.prisma.routeTrackingPoint.create({
      data: {
        id: randomUUID(),
        routeId,
        collectorId: user.id,
        latitude: new Prisma.Decimal(body.lat),
        longitude: new Prisma.Decimal(body.lng),
        accuracy: new Prisma.Decimal(body.accuracy ?? 0),
        speed: new Prisma.Decimal(body.speed ?? 0),
        heading: new Prisma.Decimal(body.heading ?? 0),
        battery: body.battery ?? 100,
      }
    });

    return ok(point);
  }

  @Get(':routeId/tracking/live')
  async getLiveTracking(
    @CurrentUser() user: AuthUser,
    @Param('routeId') routeId: string
  ) {
    const route = await this.prisma.collectionRoute.findFirst({
      where: { id: routeId, companyId: user.companyId },
      include: {
        collector: {
          select: { id: true, name: true, phone: true }
        },
        items: {
          include: {
            client: {
              select: { nickname: true, firstName: true, lastName: true, photo: true }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!route) throw new BadRequestException('Ruta no encontrada.');
    this.assertRouteScope(user, route);

    const points = await this.prisma.routeTrackingPoint.findMany({
      where: { routeId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const latestPoint = points[0] || null;
    const connectivityStatus = calculateTrackingConnectivity(latestPoint?.createdAt);

    const defaultCoords = [
      { lat: 18.4742, lng: -69.9415 },
      { lat: 18.4770, lng: -69.9390 },
      { lat: 18.4810, lng: -69.9425 },
      { lat: 18.4845, lng: -69.9320 },
      { lat: 18.4872, lng: -69.9412 },
      { lat: 18.4900, lng: -69.9350 }
    ];

    const collectorData = {
      id: route.collectorId,
      name: route.collector.name,
      phone: route.collector.phone,
      lat: latestPoint ? Number(latestPoint.latitude) : 18.4861,
      lng: latestPoint ? Number(latestPoint.longitude) : -69.9312,
      accuracy: latestPoint ? Number(latestPoint.accuracy) : 0,
      speed: latestPoint ? Number(latestPoint.speed) : 0,
      heading: latestPoint ? Number(latestPoint.heading) : 0,
      battery: latestPoint ? latestPoint.battery : 100,
      status: connectivityStatus,
      updatedAt: latestPoint ? latestPoint.createdAt.toISOString() : null
    };

    const clientsData = route.items.map((item, idx) => {
      const d = defaultCoords[idx % defaultCoords.length];
      return {
        id: item.id,
        clientId: item.clientId,
        clientName: item.clientName,
        photo: item.client.photo || undefined,
        address: item.address,
        lat: d.lat,
        lng: d.lng,
        visitStatus: item.visitStatus,
        amountToCollect: Number(item.amountToCollect)
      };
    });

    return ok({
      routeId: route.id,
      collector: collectorData,
      clients: clientsData,
      history: points.map(p => ({
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        createdAt: p.createdAt.toISOString()
      }))
    });
  }
}

