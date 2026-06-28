import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const adapter = new PrismaMariaDb({
      host: config.get<string>('MYSQL_HOST', 'localhost'),
      port: Number(config.get<string>('MYSQL_PORT', '3306')),
      user: config.get<string>('MYSQL_USER', 'root'),
      password: config.get<string>('MYSQL_PASSWORD', ''),
      database: config.get<string>('MYSQL_DATABASE', 'prestafacil'),
      connectionLimit: Number(config.get<string>('MYSQL_POOL_LIMIT', '10')),
      idleTimeout: 1000, // Libera de inmediato las conexiones inactivas acumuladas en Laragon
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
