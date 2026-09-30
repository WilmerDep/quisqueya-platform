import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { GoogleDriveController } from './google-drive.controller.js';
import { GoogleDriveService } from './google-drive.service.js';

@Module({
  imports: [AuthModule],
  controllers: [GoogleDriveController],
  providers: [GoogleDriveService],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
