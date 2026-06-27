import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service.js';

interface UserRow {
  id: string;
  companyId: string;
  branchId: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
  avatar: string | null;
  phone: string | null;
  photo: string | null;
  createdAt: Date | string;
  lastLoginAt: Date | string | null;
  passwordHash: string;
  isActive: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          companyId: user.companyId,
          branchId: user.branchId,
          actorUserId: user.id,
          action: 'LOGIN',
          entityType: 'user',
          entityId: user.id,
          metadataJson: { username: user.username },
        },
      }),
    ]);

    return {
      user: this.toPublicUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    };
  }

  async refresh(userId: string) {
    const user = await this.findActiveUser(userId);
    return {
      user: this.toPublicUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    };
  }

  async me(userId: string) {
    return this.toPublicUser(await this.findActiveUser(userId));
  }

  private async findActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid or inactive user');
    return user;
  }

  private signAccessToken(user: UserRow) {
    return this.jwt.signAsync({
      id: user.id,
      companyId: user.companyId,
      branchId: user.branchId,
      role: this.fromUserRole(user.role),
      username: user.username,
    });
  }

  private signRefreshToken(user: UserRow) {
    return this.jwt.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '7d') as any,
      },
    );
  }

  private toPublicUser(user: UserRow) {
    return {
      id: user.id,
      companyId: user.companyId,
      branchId: user.branchId,
      linkedCompanyIds: [],
      username: user.username,
      name: user.name,
      email: user.email || undefined,
      role: this.fromUserRole(user.role),
      avatar: user.avatar || undefined,
      phone: user.phone || undefined,
      photo: user.photo || undefined,
      isActive: Boolean(user.isActive),
      createdAt: new Date(user.createdAt).toISOString(),
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : undefined,
    };
  }

  private fromUserRole(role: string) {
    const map: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMINISTRADOR: 'Administrador',
      SUPERVISOR: 'Supervisor',
      COBRADOR: 'Cobrador',
    };
    return map[role] || role;
  }
}
