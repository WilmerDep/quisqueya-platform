import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { AuthUser, CurrentUser } from '../../shared/current-user.js';

@UseGuards(AuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('pull')
  async pull(@CurrentUser() user: AuthUser) {
    const routes = await this.prisma.collectionRoute.findMany({
      where: {
        companyId: user.companyId,
        collectorId: user.id,
        status: { not: 'CERRADA' },
      },
      include: { items: true },
      orderBy: { date: 'desc' },
    });
    const routeItems = routes.flatMap(route => route.items);
    return ok({ routes, routeItems, serverTime: new Date().toISOString() });
  }

  @Post('push')
  async push(@CurrentUser() user: AuthUser, @Body() body: { actions?: Array<Record<string, unknown>> }) {
    const actions = body.actions || [];
    await this.prisma.$transaction(actions.map(action => {
      const clientActionId = String(action.clientActionId || randomUUID());
      return this.prisma.syncQueue.upsert({
        where: {
          companyId_clientActionId: {
            companyId: user.companyId,
            clientActionId,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: user.branchId,
          userId: user.id,
          clientActionId,
          actionType: String(action.type || 'UNKNOWN'),
          payloadJson: action as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });
    }));
    return ok({ accepted: actions.length });
  }
}
