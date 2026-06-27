import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CashController } from './cash.controller.js';

@Module({ imports: [AuthModule], controllers: [CashController] })
export class CashModule {}
