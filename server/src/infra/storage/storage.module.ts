import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleDriveModule } from '../../modules/integrations/google-drive/google-drive.module.js';
import { GoogleDriveStorageProvider } from '../../modules/integrations/google-drive/google-drive-storage.provider.js';
import {
  STORAGE_PROVIDER_TOKEN,
  type StorageProvider,
} from './storage-provider.js';
import { UnconfiguredStorageProvider } from './unconfigured-storage.provider.js';

@Module({
  imports: [GoogleDriveModule],
  providers: [
    UnconfiguredStorageProvider,
    {
      provide: STORAGE_PROVIDER_TOKEN,
      inject: [ConfigService, GoogleDriveStorageProvider, UnconfiguredStorageProvider],
      useFactory: (
        config: ConfigService,
        googleDrive: GoogleDriveStorageProvider,
        unconfigured: UnconfiguredStorageProvider,
      ): StorageProvider => {
        const provider = config.get<string>('STORAGE_PROVIDER')?.trim().toLowerCase();
        if (!provider) return unconfigured;
        if (provider === 'google-drive') return googleDrive;

        throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
      },
    },
  ],
  exports: [STORAGE_PROVIDER_TOKEN],
})
export class StorageModule {}
