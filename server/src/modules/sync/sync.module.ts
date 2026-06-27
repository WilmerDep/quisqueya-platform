import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SyncController } from './sync.controller.js';

@Module({ imports: [AuthModule], controllers: [SyncController] })
export class SyncModule {}
