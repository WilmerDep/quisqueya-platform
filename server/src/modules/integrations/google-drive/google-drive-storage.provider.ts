import { Injectable } from '@nestjs/common';
import type {
  StorageObjectMetadata,
  StorageProvider,
  StorageReadResult,
  StorageUploadInput,
} from '../../../infra/storage/storage-provider.js';
import {
  GoogleDriveService,
  type GoogleDriveFileMetadata,
} from './google-drive.service.js';

@Injectable()
export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = 'google-drive';

  constructor(private readonly googleDrive: GoogleDriveService) {}

  async list(parentKey?: string): Promise<StorageObjectMetadata[]> {
    const files = await this.googleDrive.listFolder(parentKey);
    return files.map(file => this.mapMetadata(file));
  }

  async upload(input: StorageUploadInput): Promise<StorageObjectMetadata> {
    const file = await this.googleDrive.uploadFile({
      fileName: input.fileName,
      mimeType: input.mimeType,
      data: input.data,
      parentFolderId: input.parentKey,
    });
    return this.mapMetadata(file);
  }

  async getMetadata(key: string): Promise<StorageObjectMetadata> {
    return this.mapMetadata(await this.googleDrive.getFileMetadata(key));
  }

  async read(key: string): Promise<StorageReadResult> {
    return this.googleDrive.downloadFile(key);
  }

  async delete(key: string): Promise<void> {
    await this.googleDrive.trashFile(key);
  }

  private mapMetadata(file: GoogleDriveFileMetadata): StorageObjectMetadata {
    return {
      key: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      modifiedAt: file.modifiedTime,
      parentKey: file.parents[0],
      metadata: {
        webViewLink: file.webViewLink,
        trashed: file.trashed,
        parents: file.parents,
      },
    };
  }
}
