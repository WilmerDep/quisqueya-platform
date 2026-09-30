import { Module } from '@nestjs/common';
import { StorageModule } from '../../infra/storage/storage.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MediaAdminController, MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MediaController, MediaAdminController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
