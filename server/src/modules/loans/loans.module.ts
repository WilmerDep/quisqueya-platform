import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LoansController } from './loans.controller.js';

@Module({ imports: [AuthModule], controllers: [LoansController] })
export class LoansModule {}
