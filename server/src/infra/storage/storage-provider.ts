export const STORAGE_PROVIDER_TOKEN = Symbol('STORAGE_PROVIDER');

export type StorageUploadInput = {
  fileName: string;
  mimeType: string;
  data: Buffer;
  parentKey?: string;
};

export type StorageObjectMetadata = {
  key: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  modifiedAt?: string;
  parentKey?: string;
  deliveryUrl?: string;
  metadata?: Record<string, unknown>;
};

export type StorageReadResult = {
  data: Buffer;
  mimeType?: string;
  sizeBytes?: number;
};

export interface StorageProvider {
  readonly name: string;

  list(parentKey?: string): Promise<StorageObjectMetadata[]>;
  upload(input: StorageUploadInput): Promise<StorageObjectMetadata>;
  getMetadata(key: string): Promise<StorageObjectMetadata>;
  read(key: string): Promise<StorageReadResult>;
  delete(key: string): Promise<void>;
}
