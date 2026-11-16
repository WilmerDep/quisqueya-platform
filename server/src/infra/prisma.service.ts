import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const host = config.get<string>('MYSQL_HOST', '127.0.0.1');
    const password = config.get<string>('MYSQL_PASSWORD', '');
    const isLocalDevelopment =
      config.get<string>('NODE_ENV') === 'development' &&
      ['127.0.0.1', 'localhost', '::1'].includes(host);

    // Construct the pool inside the Prisma adapter. Passing an external
    // mariadb@3.5.4 pool hangs during Prisma queries in C15.4, while the
    // adapter-owned pool passes both SELECT 1 and experience.findUnique.
    //
    // IMPORTANT: package.json overrides every MariaDB driver resolution
    // to the patched root dependency. Do not drop that override: the
    // adapter otherwise resolves an older connector version.
    const adapter = new PrismaMariaDb({
      host,
      port: Number(config.get<string>('MYSQL_PORT', '3306')),
      user: config.get<string>('MYSQL_USER', 'root'),
      ...(password ? { password } : {}),
      database: config.get<string>('MYSQL_DATABASE', 'quisqueya_core'),
      connectionLimit: Number(config.get<string>('MYSQL_POOL_LIMIT', '10')),
      prepareCacheLength: 0,
      ...(isLocalDevelopment && !password ? { allowPublicKeyRetrieval: true } : {}),
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
