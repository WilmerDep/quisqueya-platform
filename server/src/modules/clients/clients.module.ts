import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientsController } from './clients.controller.js';

@Module({ imports: [AuthModule], controllers: [ClientsController] })
export class ClientsModule {}
