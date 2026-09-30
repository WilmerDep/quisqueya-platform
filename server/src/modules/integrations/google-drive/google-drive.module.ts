import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { GoogleDriveController } from './google-drive.controller.js';
import { GoogleDriveService } from './google-drive.service.js';
import { GoogleDriveStorageProvider } from './google-drive-storage.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [GoogleDriveController],
  providers: [GoogleDriveService, GoogleDriveStorageProvider],
  exports: [GoogleDriveService, GoogleDriveStorageProvider],
})
export class GoogleDriveModule {}
