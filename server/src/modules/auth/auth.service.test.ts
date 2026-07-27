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
          if (id) return Object.values(usersMap).find(user => user.id === id) || null;
          return null;
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async promises => promises),
    } as unknown as PrismaService;

    const mockJwt = {
      signAsync: vi.fn().mockResolvedValue('mocked-jwt-token'),
    } as unknown as JwtService;

    const mockConfig = {
      get: vi.fn().mockImplementation((_key, defaultValue) => defaultValue),
    } as unknown as ConfigService;

    return { authService: new AuthService(mockPrisma, mockJwt, mockConfig), mockPrisma };
  };

  it('authenticates an administrator with a valid bcrypt password', async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Quisqueya Admin',
        email: 'admin@quisqueya.local',
        role: 'ADMINISTRADOR',
        passwordHash,
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: null,
      },
    };

    const { authService } = createMockServices(mockUsers);
    const result = await authService.login('admin', 'admin123');

    expect(result.user.role).toBe('Administrador');
    expect(result.accessToken).toBe('mocked-jwt-token');
  });

  it('authenticates a super admin with a valid bcrypt password', async () => {
    const passwordHash = await bcrypt.hash('master123', 10);
    const mockUsers = {
      master: {
        id: 'M1',
        companyId: 'SYSTEM',
        branchId: 'MAIN',
        username: 'master',
        name: 'Quisqueya Platform Admin',
        email: 'master@quisqueya.local',
        role: 'SUPER_ADMIN',
        passwordHash,
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: null,
      },
    };

    const { authService } = createMockServices(mockUsers);
    const result = await authService.login('master', 'master123');

    expect(result.user.role).toBe('Super Admin');
    expect(result.user.companyId).toBe('SYSTEM');
  });

  it('rejects legacy SHA-256 hashes instead of migrating them at login', async () => {
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Quisqueya Admin',
        role: 'ADMINISTRADOR',
        passwordHash: 'b5e2eb46bf1cf64c76d35b63f2513418f618181708451a80490054bf7b812c94',
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService, mockPrisma } = createMockServices(mockUsers);

    await expect(authService.login('admin', 'admin123')).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects malformed password hashes', async () => {
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Quisqueya Admin',
        role: 'ADMINISTRADOR',
        passwordHash: 'invalid-short-hash-12345',
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService, mockPrisma } = createMockServices(mockUsers);

    await expect(authService.login('admin', 'admin123')).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid bcrypt password', async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Quisqueya Admin',
        role: 'ADMINISTRADOR',
        passwordHash,
        isActive: true,
        createdAt: new Date(),
      },
    };

    const { authService } = createMockServices(mockUsers);
    await expect(authService.login('admin', 'wrongpass')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a non-existent user', async () => {
    const { authService } = createMockServices({});
    await expect(authService.login('nonexistent', 'admin123')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an inactive user', async () => {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const mockUsers = {
      admin: {
        id: 'U1',
        companyId: 'C1',
        branchId: 'MAIN',
        username: 'admin',
        name: 'Quisqueya Admin',
        role: 'ADMINISTRADOR',
        passwordHash,
        isActive: false,
        createdAt: new Date(),
      },
    };

    const { authService } = createMockServices(mockUsers);
    await expect(authService.login('admin', 'admin123')).rejects.toThrow(UnauthorizedException);
  });
});
