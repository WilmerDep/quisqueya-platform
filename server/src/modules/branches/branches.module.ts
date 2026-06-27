import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BranchesController } from './branches.controller.js';

@Module({ imports: [AuthModule], controllers: [BranchesController] })
export class BranchesModule {}
