import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './infra/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { CashModule } from './modules/cash/cash.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { LoansModule } from './modules/loans/loans.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { RoutesModule } from './modules/routes/routes.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuditModule } from './modules/audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'dist'),
      exclude: ['/api/{*path}'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    BranchesModule,
    UsersModule,
    ClientsModule,
    LoansModule,
    PaymentsModule,
    CashModule,
    RoutesModule,
    ReportsModule,
    AuditModule,
    SyncModule,
  ],
})
export class AppModule {}
