import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoutesController } from './routes.controller.js';

@Module({ imports: [AuthModule], controllers: [RoutesController] })
export class RoutesModule {}
