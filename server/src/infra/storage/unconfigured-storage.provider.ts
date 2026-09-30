import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  StorageObjectMetadata,
  StorageProvider,
  StorageReadResult,
  StorageUploadInput,
} from './storage-provider.js';

@Injectable()
export class UnconfiguredStorageProvider implements StorageProvider {
  readonly name = 'unconfigured';

  private unavailable(): never {
    throw new ServiceUnavailableException(
      'Media storage is not configured. Set STORAGE_PROVIDER before using storage operations.',
    );
  }

  async list(_parentKey?: string): Promise<StorageObjectMetadata[]> {
    return this.unavailable();
  }

  async upload(_input: StorageUploadInput): Promise<StorageObjectMetadata> {
    return this.unavailable();
  }

  async getMetadata(_key: string): Promise<StorageObjectMetadata> {
    return this.unavailable();
  }

  async read(_key: string): Promise<StorageReadResult> {
    return this.unavailable();
  }

  async delete(_key: string): Promise<void> {
    return this.unavailable();
  }
}
