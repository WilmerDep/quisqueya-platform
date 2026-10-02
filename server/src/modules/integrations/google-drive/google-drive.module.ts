import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { GoogleDriveAdminController, GoogleDriveOAuthController } from './google-drive.controller.js';
import { GoogleDriveService } from './google-drive.service.js';
import { GoogleDriveStorageProvider } from './google-drive-storage.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [GoogleDriveOAuthController, GoogleDriveAdminController],
  providers: [GoogleDriveService, GoogleDriveStorageProvider],
  exports: [GoogleDriveService, GoogleDriveStorageProvider],
})
export class GoogleDriveModule {}
