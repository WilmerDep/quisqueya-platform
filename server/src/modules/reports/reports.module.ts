import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ReportsController } from './reports.controller.js';

@Module({ imports: [AuthModule], controllers: [ReportsController] })
export class ReportsModule {}
