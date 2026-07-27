import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const resolveAccessSecret = (config: ConfigService) => {
  const configuredSecret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  if (configuredSecret) return configuredSecret;
  if (isProduction) {
    throw new Error('JWT_ACCESS_SECRET is required in production');
  }

  return 'quisqueya-development-access-secret';
};

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveAccessSecret(config),
        signOptions: { expiresIn: (config.get<string>('JWT_ACCESS_TTL', '15m') as `${number}m`) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
