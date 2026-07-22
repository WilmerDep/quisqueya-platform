import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../infra/prisma.service.js';
import { AuthService } from './auth.service.js';

interface TestUserMock {
  id: string;
  companyId: string;
  branchId: string;
  username: string;
  name: string;
  email?: string;
  role: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date | null;
}

describe('AuthService (Authentication & Authorization unit tests)', () => {
  const createMockServices = (usersMap: Record<string, TestUserMock>) => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockImplementation(async ({ where: { username, id } }: { where: { username?: string; id?: string } }) => {
          if (username) return usersMap[username] || null;
          if (id) return Object.values(usersMap).find(u => u.id === id) || null;
          return null;
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (promises) => promises),
    } as unknown as PrismaService;


    const mockJwt = {
      signAsync: vi.fn().mockResolvedValue('mocked-jwt-token'),
    } as unknown as JwtService;

    const mockConfig = {
      get: vi.fn().mockImplementation((key, defaultVal) => defaultVal),
    } as unknown as ConfigService;

    return { authService: new AuthService(mockPrisma, mockJwt, mockConfig), mockPrisma, mockJwt };
  };

  it('authenticates Admin Empresa with valid bcrypt password', async () => {
    const adminHash = await bcrypt.hash('admin123', 10);
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        email: 'admin@prestafacil.local',
        role: 'ADMINISTRADOR',
        passwordHash: adminHash,
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: null,
      },
    };

    const { authService } = createMockServices(mockUsers);
    const res = await authService.login('admin', 'admin123');

    expect(res.user.role).toBe('Administrador');
    expect(res.accessToken).toBe('mocked-jwt-token');
  });

  it('authenticates Master / Super Admin with valid bcrypt password', async () => {
    const masterHash = await bcrypt.hash('master123', 10);
    const mockUsers = {
      master: {
        id: 'M1',
        companyId: 'SYSTEM',
        branchId: 'MAIN',
        username: 'master',
        name: 'Nexus Master',
        email: 'master@prestafacil.local',
        role: 'SUPER_ADMIN',
        passwordHash: masterHash,
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: null,
      },
    };

    const { authService } = createMockServices(mockUsers);
    const res = await authService.login('master', 'master123');

    expect(res.user.role).toBe('Super Admin');
    expect(res.user.companyId).toBe('SYSTEM');
  });

  it('authenticates legacy SHA-256 seed password and auto-migrates hash', async () => {
    // SHA-256 de "prestafacil-admin:admin123"
    const legacyHash = 'b5e2eb46bf1cf64c76d35b63f2513418f618181708451a80490054bf7b812c94';
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        role: 'ADMINISTRADOR',
        passwordHash: legacyHash,
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService, mockPrisma } = createMockServices(mockUsers);
    const res = await authService.login('admin', 'admin123');

    expect(res.user.username).toBe('admin');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'U1' },
        data: expect.objectContaining({ passwordHash: expect.stringMatching(/^\$2[ayb]\$/) }),
      })
    );
  });

  it('rejects legacy user with incorrect password without migrating hash', async () => {
    const legacyHash = 'b5e2eb46bf1cf64c76d35b63f2513418f618181708451a80490054bf7b812c94';
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        role: 'ADMINISTRADOR',
        passwordHash: legacyHash,
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService, mockPrisma } = createMockServices(mockUsers);
    await expect(authService.login('admin', 'wrongpass')).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('allows second login with migrated bcrypt password', async () => {
    const legacyHash = 'b5e2eb46bf1cf64c76d35b63f2513418f618181708451a80490054bf7b812c94';
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        role: 'ADMINISTRADOR',
        passwordHash: legacyHash,
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService, mockPrisma } = createMockServices(mockUsers);
    // 1. Primer login con legacy hash
    await authService.login('admin', 'admin123');

    // Simular que la BD actualizó el hash a bcrypt
    const calls = (mockPrisma.user.update as unknown as { mock: { calls: Array<[{ data: { passwordHash: string } }]> } }).mock.calls;
    const updatedHash = calls[0][0].data.passwordHash;
    mockUsers.admin.passwordHash = updatedHash;

    // 2. Segundo login directo con Bcrypt
    const secondRes = await authService.login('admin', 'admin123');
    expect(secondRes.user.username).toBe('admin');
  });

  it('propagates error when migration persistence fails during legacy login', async () => {
    const legacyHash = 'b5e2eb46bf1cf64c76d35b63f2513418f618181708451a80490054bf7b812c94';
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        role: 'ADMINISTRADOR',
        passwordHash: legacyHash,
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService, mockPrisma } = createMockServices(mockUsers);
    (mockPrisma.user.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Database write failure'));

    await expect(authService.login('admin', 'admin123')).rejects.toThrow('Database write failure');
  });

  it('rejects password hash that is neither bcrypt nor valid 64-hex SHA-256 legacy', async () => {
    const invalidFormatHash = 'invalid-short-hash-12345';
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        role: 'ADMINISTRADOR',
        passwordHash: invalidFormatHash,
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService, mockPrisma } = createMockServices(mockUsers);
    await expect(authService.login('admin', 'admin123')).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects invalid Bcrypt password', async () => {
    const adminHash = await bcrypt.hash('admin123', 10);
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        role: 'ADMINISTRADOR',
        passwordHash: adminHash,
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService } = createMockServices(mockUsers);
    await expect(authService.login('admin', 'wrongpass')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects non-existent user', async () => {
    const { authService } = createMockServices({});
    await expect(authService.login('nonexistent', 'admin123')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects inactive user', async () => {
    const adminHash = await bcrypt.hash('admin123', 10);
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Admin PrestaFácil',
        role: 'ADMINISTRADOR',
        passwordHash: adminHash,
        isActive: false,
        createdAt: new Date(),
      },
    };

    const { authService } = createMockServices(mockUsers);
    await expect(authService.login('admin', 'admin123')).rejects.toThrow(UnauthorizedException);
  });
});
