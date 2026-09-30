import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentSourceProvider, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service.js';
import {
  STORAGE_PROVIDER_TOKEN,
  type StorageProvider,
} from '../../infra/storage/storage-provider.js';
import type {
  LinkExperienceMediaDto,
  RegisterStorageObjectDto,
} from './media.dto.js';

type MediaAssetRow = Prisma.MediaAssetGetPayload<Record<string, never>>;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: StorageProvider,
  ) {}

  async listStorageObjects(parentKey?: string) {
    return {
      provider: this.storage.name,
      parentKey: parentKey ?? null,
      objects: await this.storage.list(parentKey),
    };
  }

  async validateStorage() {
    const payload = Buffer.from(`Quisqueya storage validation ${new Date().toISOString()}\n`, 'utf8');
    const uploaded = await this.storage.upload({
      fileName: `.quisqueya-storage-check-${Date.now()}.txt`,
      mimeType: 'text/plain; charset=utf-8',
      data: payload,
    });

    let metadataValidated = false;
    let readValidated = false;

    try {
      const metadata = await this.storage.getMetadata(uploaded.key);
      metadataValidated = metadata.key === uploaded.key;

      const downloaded = await this.storage.read(uploaded.key);
      readValidated = downloaded.data.equals(payload);

      if (!metadataValidated || !readValidated) {
        throw new BadRequestException('Storage validation completed but read-back verification failed');
      }
    } finally {
      await this.storage.delete(uploaded.key);
    }

    return {
      provider: this.storage.name,
      writeValidated: true,
      metadataValidated,
      readValidated,
      cleanupValidated: true,
    };
  }

  async registerStorageObject(input: RegisterStorageObjectDto) {
    const storageKey = input.storageKey.trim();
    const metadata = await this.storage.getMetadata(storageKey);

    if (metadata.mimeType === 'application/vnd.google-apps.folder') {
      throw new BadRequestException('Folders cannot be registered as MediaAsset records');
    }

    const existing = await this.prisma.mediaAsset.findFirst({
      where: {
        storageProvider: this.storage.name,
        storageKey: metadata.key,
      },
    });
    const id = existing?.id ?? randomUUID();
    const publicUrl = metadata.deliveryUrl || this.buildProxyUrl(id);
    const storageMetadataJson = this.toJson(metadata.metadata);
    const sizeBytes = metadata.sizeBytes === undefined ? undefined : BigInt(metadata.sizeBytes);

    const row = existing
      ? await this.prisma.mediaAsset.update({
          where: { id: existing.id },
          data: {
            storageKey: metadata.key,
            publicUrl,
            fileName: metadata.name,
            mimeType: metadata.mimeType,
            checksum: metadata.checksum,
            ...(sizeBytes === undefined ? {} : { sizeBytes }),
            ...(storageMetadataJson === undefined ? {} : { storageMetadataJson }),
            ...(input.altText === undefined ? {} : { altText: input.altText.trim() || null }),
            ...(input.caption === undefined ? {} : { caption: input.caption.trim() || null }),
          },
        })
      : await this.prisma.mediaAsset.create({
          data: {
            id,
            sourceProvider: ContentSourceProvider.MANUAL,
            storageProvider: this.storage.name,
            storageKey: metadata.key,
            publicUrl,
            fileName: metadata.name,
            mimeType: metadata.mimeType,
            altText: input.altText?.trim() || null,
            caption: input.caption?.trim() || null,
            sizeBytes: sizeBytes ?? null,
            checksum: metadata.checksum ?? null,
            storageMetadataJson,
            provenanceJson: {
              registeredFrom: 'storage-provider',
              registeredAt: new Date().toISOString(),
              provider: this.storage.name,
            },
          },
        });

    return this.serializeAsset(row);
  }

  async getAssetContent(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media asset not found');

    if (asset.storageProvider !== this.storage.name) {
      throw new BadRequestException(
        `Media asset belongs to storage provider ${asset.storageProvider}, not ${this.storage.name}`,
      );
    }

    const content = await this.storage.read(asset.storageKey);
    return {
      data: content.data,
      mimeType: content.mimeType || asset.mimeType || 'application/octet-stream',
      sizeBytes: content.sizeBytes ?? content.data.byteLength,
      fileName: asset.fileName ?? undefined,
    };
  }

  async linkExperienceMedia(experienceId: string, input: LinkExperienceMediaDto) {
    if (input.featuredMediaId === undefined && input.galleryMediaIds === undefined) {
      throw new BadRequestException('Provide featuredMediaId, galleryMediaIds, or both');
    }

    const experience = await this.prisma.experience.findUnique({ where: { id: experienceId } });
    if (!experience) throw new NotFoundException('Experience not found');

    const mediaIds = [...new Set([
      ...(input.featuredMediaId ? [input.featuredMediaId] : []),
      ...(input.galleryMediaIds ?? []),
    ])];

    if (mediaIds.length) {
      const found = await this.prisma.mediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map(item => item.id));
      const missing = mediaIds.filter(id => !foundIds.has(id));
      if (missing.length) {
        throw new BadRequestException(`Unknown MediaAsset id(s): ${missing.join(', ')}`);
      }
    }

    const updated = await this.prisma.experience.update({
      where: { id: experienceId },
      data: {
        ...(input.featuredMediaId === undefined
          ? {}
          : { featuredMediaId: input.featuredMediaId }),
        ...(input.galleryMediaIds === undefined
          ? {}
          : { galleryMediaIds: input.galleryMediaIds as Prisma.InputJsonValue }),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        featuredMediaId: true,
        galleryMediaIds: true,
      },
    });

    return updated;
  }

  private buildProxyUrl(id: string) {
    const appUrl = this.config.get<string>('APP_URL')?.trim().replace(/\/+$/, '');
    const path = `/api/v1/media/${encodeURIComponent(id)}/content`;
    return appUrl ? `${appUrl}${path}` : path;
  }

  private toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
    if (!value) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private serializeAsset(row: MediaAssetRow) {
    return {
      id: row.id,
      sourceProvider: row.sourceProvider,
      storageProvider: row.storageProvider,
      storageKey: row.storageKey,
      publicUrl: row.publicUrl,
      fileName: row.fileName,
      mimeType: row.mimeType,
      altText: row.altText,
      caption: row.caption,
      width: row.width,
      height: row.height,
      sizeBytes: row.sizeBytes?.toString() ?? null,
      checksum: row.checksum,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
