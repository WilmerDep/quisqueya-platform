import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { CurrentUser, AuthUser } from '../../shared/current-user.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return ok(await this.auth.login(dto.username, dto.password));
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(refreshToken, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    });
    return ok(await this.auth.refresh(payload.sub));
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return ok(await this.auth.me(user.id));
  }
}
