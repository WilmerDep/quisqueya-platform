import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../infra/prisma.service.js';
import { AuthUser } from '../../shared/current-user.js';
import { RoutesController } from './routes.controller.js';
import { calculateTrackingConnectivity, validateLocationPayload } from './tracking-validation.js';

interface MockPrismaService {
  collectionRoute: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  routeTrackingPoint: {
    create: ReturnType<typeof vi.fn>;
  };
}

describe('RoutesController.saveLocation (direct controller integration tests)', () => {
  const mockRoute = {
    id: 'route-1',
    companyId: 'company-A',
    branchId: 'branch-A1',
    collectorId: 'collector-123',
    date: new Date(),
    status: 'EN_CURSO',
  };

  const createMockPrisma = (findResult: typeof mockRoute | null = mockRoute): MockPrismaService => {
    return {
      collectionRoute: {
        findFirst: vi.fn().mockResolvedValue(findResult),
      },
      routeTrackingPoint: {
        create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => ({
          id: 'point-1',
          createdAt: new Date(),
          ...(typeof data === 'object' && data !== null ? data : {}),
        })),
      },
    };
  };

  it('rejects roles distinct from Cobrador', async () => {
    const prisma = createMockPrisma();
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const adminUser: AuthUser = { id: 'admin-1', role: 'Administrador', companyId: 'company-A', branchId: 'branch-A1', username: 'admin' };

    await expect(controller.saveLocation(adminUser, 'route-1', { lat: 18.4861, lng: -69.9312 }))
      .rejects.toThrow(ForbiddenException);

    expect(prisma.routeTrackingPoint.create).not.toHaveBeenCalled();
  });

  it('rejects another tenant route access', async () => {
    const prisma = createMockPrisma(null);
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const cobradorUser: AuthUser = { id: 'collector-123', role: 'Cobrador', companyId: 'company-A', branchId: 'branch-A1', username: 'cobrador' };

    await expect(controller.saveLocation(cobradorUser, 'route-other-tenant', { lat: 18.4861, lng: -69.9312 }))
      .rejects.toThrow(BadRequestException);

    expect(prisma.routeTrackingPoint.create).not.toHaveBeenCalled();
  });

  it('rejects branch scope mismatch', async () => {
    const prisma = createMockPrisma();
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const cobradorUserOtherBranch: AuthUser = { id: 'collector-123', role: 'Cobrador', companyId: 'company-A', branchId: 'branch-A2', username: 'cobrador' };

    await expect(controller.saveLocation(cobradorUserOtherBranch, 'route-1', { lat: 18.4861, lng: -69.9312 }))
      .rejects.toThrow(ForbiddenException);

    expect(prisma.routeTrackingPoint.create).not.toHaveBeenCalled();
  });

  it('rejects unassigned collector', async () => {
    const prisma = createMockPrisma();
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const unassignedCollector: AuthUser = { id: 'collector-999', role: 'Cobrador', companyId: 'company-A', branchId: 'branch-A1', username: 'cobrador999' };

    await expect(controller.saveLocation(unassignedCollector, 'route-1', { lat: 18.4861, lng: -69.9312 }))
      .rejects.toThrow(ForbiddenException);

    expect(prisma.routeTrackingPoint.create).not.toHaveBeenCalled();
  });

  it('rejects non-active routes (e.g. CERRADA)', async () => {
    const closedRoute = { ...mockRoute, status: 'CERRADA' };
    const prisma = createMockPrisma(closedRoute);
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const assignedCollector: AuthUser = { id: 'collector-123', role: 'Cobrador', companyId: 'company-A', branchId: 'branch-A1', username: 'cobrador' };

    await expect(controller.saveLocation(assignedCollector, 'route-1', { lat: 18.4861, lng: -69.9312 }))
      .rejects.toThrow(BadRequestException);

    expect(prisma.routeTrackingPoint.create).not.toHaveBeenCalled();
  });

  it('rejects invalid telemetry data (e.g. invalid latitude or speed)', async () => {
    const prisma = createMockPrisma();
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const assignedCollector: AuthUser = { id: 'collector-123', role: 'Cobrador', companyId: 'company-A', branchId: 'branch-A1', username: 'cobrador' };

    await expect(controller.saveLocation(assignedCollector, 'route-1', { lat: 150, lng: -69.9312 }))
      .rejects.toThrow(BadRequestException);

    expect(prisma.routeTrackingPoint.create).not.toHaveBeenCalled();
  });

  it('prevents collectorId spoofing and persists with collectorId: user.id', async () => {
    const prisma = createMockPrisma();
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const assignedCollector: AuthUser = { id: 'collector-123', role: 'Cobrador', companyId: 'company-A', branchId: 'branch-A1', username: 'cobrador' };

    await controller.saveLocation(assignedCollector, 'route-1', { collectorId: 'spoofed-id', lat: 18.4861, lng: -69.9312 });

    expect(prisma.routeTrackingPoint.create).toHaveBeenCalledTimes(1);
    expect(prisma.routeTrackingPoint.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routeId: 'route-1',
          collectorId: 'collector-123',
        }),
      })
    );
  });

  it('accepts assigned collector on active route and creates tracking point', async () => {
    const prisma = createMockPrisma();
    const controller = new RoutesController(prisma as unknown as PrismaService);
    const assignedCollector: AuthUser = { id: 'collector-123', role: 'Cobrador', companyId: 'company-A', branchId: 'branch-A1', username: 'cobrador' };

    const res = await controller.saveLocation(assignedCollector, 'route-1', { lat: 18.4861, lng: -69.9312, accuracy: 0 });

    expect(res.data).toBeDefined();
    expect(prisma.routeTrackingPoint.create).toHaveBeenCalledTimes(1);
  });
});
;

describe('tracking location payload validation (accuracy 0 handling)', () => {
  it('accepts accuracy = 0', () => {
    const res = validateLocationPayload({
      lat: 18.4861,
      lng: -69.9312,
      accuracy: 0,
    });
    expect(res.isValid).toBe(true);
  });
});

describe('tracking connectivity calculation & future tolerance', () => {
  const now = 1700000000000;
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const FIFTEEN_MIN_MS = 15 * 60 * 1000;

  it('returns OFFLINE if no last point date or invalid date string', () => {
    expect(calculateTrackingConnectivity(null, now)).toBe('OFFLINE');
    expect(calculateTrackingConnectivity(undefined, now)).toBe('OFFLINE');
    expect(calculateTrackingConnectivity('invalid-date', now)).toBe('OFFLINE');
  });

  it('evaluates exact boundary at 5 minutes (300,000 ms)', () => {
    expect(calculateTrackingConnectivity(new Date(now - FIVE_MIN_MS), now)).toBe('ONLINE');
    expect(calculateTrackingConnectivity(new Date(now - (FIVE_MIN_MS + 1)), now)).toBe('STALE');
  });

  it('evaluates exact boundary at 15 minutes (900,000 ms)', () => {
    expect(calculateTrackingConnectivity(new Date(now - FIFTEEN_MIN_MS), now)).toBe('STALE');
    expect(calculateTrackingConnectivity(new Date(now - (FIFTEEN_MIN_MS + 1)), now)).toBe('OFFLINE');
  });

  it('evaluates future timestamp with 60s tolerance', () => {
    // Hasta 60s en el futuro -> ONLINE
    const future60s = new Date(now + 60 * 1000);
    expect(calculateTrackingConnectivity(future60s, now)).toBe('ONLINE');

    // Más de 60s en el futuro -> OFFLINE
    const future61s = new Date(now + 61 * 1000);
    expect(calculateTrackingConnectivity(future61s, now)).toBe('OFFLINE');
  });
});


