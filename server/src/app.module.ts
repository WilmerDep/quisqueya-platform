import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './infra/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { ContactsModule } from './modules/contacts/contacts.module.js';

const serverDistDir = dirname(fileURLToPath(import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    ServeStaticModule.forRoot({
      rootPath: join(serverDistDir, 'dist'),
      exclude: ['/api/{*path}'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    BranchesModule,
    UsersModule,
    ClientsModule,
    ReportsModule,
    AuditModule,
    SyncModule,
    ContentModule,
    ContactsModule,
  ],
})
export class AppModule {}
