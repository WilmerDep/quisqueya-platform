import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import mariadb from 'mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: ReturnType<typeof mariadb.createPool>;

  constructor(config: ConfigService) {
    // Use the independently patched MariaDB connector rather than the adapter's
    // bundled connector. The external pool is owned and closed by this service.
    const pool = mariadb.createPool({
      host: config.get<string>('MYSQL_HOST', '127.0.0.1'),
      port: Number(config.get<string>('MYSQL_PORT', '3306')),
      user: config.get<string>('MYSQL_USER', 'root'),
      password: config.get<string>('MYSQL_PASSWORD', ''),
      database: config.get<string>('MYSQL_DATABASE', 'quisqueya_core'),
      connectionLimit: Number(config.get<string>('MYSQL_POOL_LIMIT', '10')),
      // Match PrismaMariaDb's internal-pool behavior for prepared statements.
      prepareCacheLength: 0,
    });

    super({ adapter: new PrismaMariaDb(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } finally {
      await this.pool.end();
    }
  }
}
