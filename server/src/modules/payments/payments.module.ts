import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsController } from './payments.controller.js';

@Module({ imports: [AuthModule], controllers: [PaymentsController] })
export class PaymentsModule {}
