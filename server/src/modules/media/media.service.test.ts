import { ContentRecordStatus, ContentSourceProvider } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../infra/prisma.service.js';
import type { StorageProvider } from '../../infra/storage/storage-provider.js';
import { MediaService } from './media.service.js';

const asset = (id: string, storageKey = id, storageProvider = 'google-drive') => ({
  id,
  sourceProvider: ContentSourceProvider.MANUAL,
  sourceId: null,
  sourceUrl: null,
  storageProvider,
  storageKey,
  publicUrl: `https://crmquisqueya.pholiodev.com/api/v1/media/${id}/content`,
  fileName: `${id}.webp`,
  mimeType: 'image/webp',
  altText: null,
  caption: null,
  width: null,
  height: null,
  sizeBytes: 1234n,
  checksum: null,
  storageMetadataJson: null,
  provenanceJson: null,
  createdAt: new Date('2026-10-03T00:00:00Z'),
  updatedAt: new Date('2026-10-03T00:00:00Z'),
});

const setup = () => {
  const prisma = {
    experience: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    mediaAsset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  const config = {
    get: vi.fn((name: string) => name === 'APP_URL'
      ? 'https://crmquisqueya.pholiodev.com' : undefined),
  };
  const storage = {
    name: 'google-drive',
    getMetadata: vi.fn(),
  };

  return {
    prisma,
    storage,
    service: new MediaService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      storage as unknown as StorageProvider,
    ),
  };
};

describe('MediaService reconciliation inventory', () => {
  it('reads drafts and published experiences, tracking shared assets and missing references without writes', async () => {
    const { prisma, storage, service } = setup();
    prisma.experience.findMany.mockResolvedValue([
      {
        id: 'draft-1', slug: 'buggy-zipline', title: 'Buggy + Zipline',
        status: ContentRecordStatus.DRAFT, sourceProvider: ContentSourceProvider.MANUAL,
        excerpt: 'Circuito de tirolesas y buggy', description: 'Visita el parque',
        categoryLabel: 'Aventura', locationAddress: 'Bávaro, Punta Cana',
        includedItemsJson: ['Buggy', 'Tirolesas'],
        itineraryJson: [{ title: 'Recorrido' }],
        editorialFlagsJson: [{ code: 'MEDIA_PENDING_LIBRARY_REVIEW', severity: 'warning', message: 'Review media' }],
        featuredMediaId: 'shared', galleryMediaIds: ['shared', 'zipline', 'zipline'],
        galleryMediaSourceIds: [123],
      },
      {
        id: 'published-1', slug: 'buggies-chavon', title: 'Buggies y Altos de Chavón',
        status: ContentRecordStatus.PUBLISHED, sourceProvider: ContentSourceProvider.WORDPRESS,
        featuredMediaId: null, galleryMediaIds: ['shared', 'not-in-db'],
        galleryMediaSourceIds: [],
      },
    ]);
    prisma.mediaAsset.findMany.mockResolvedValue([
      asset('shared'), asset('zipline'), asset('unused', 'legacy-333', 'external'),
    ]);

    const result = await service.getExperienceMediaInventory();

    expect(result.mode).toBe('read-only');
    expect(result.summary).toEqual({
      draftExperiences: 1,
      publishedExperiences: 1,
      mediaAssets: 3,
      googleDriveMediaAssets: 2,
      experiencesWithMissingMedia: 1,
      experiencesWithManagedFeatured: 1,
      experiencesWithManagedGallery: 2,
      experiencesWithDuplicateGalleryIds: 1,
    });
    expect(prisma.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: [ContentRecordStatus.DRAFT, ContentRecordStatus.PUBLISHED],
          },
        },
      }),
    );
    expect(result.experiences[0]).toMatchObject({
      status: ContentRecordStatus.DRAFT,
      galleryMediaIds: ['shared', 'zipline', 'zipline'],
      galleryMediaSourceIds: [123],
      duplicateGalleryMediaIds: ['zipline'],
      missingMediaAssetIds: [],
      excerpt: 'Circuito de tirolesas y buggy',
      included: ['Buggy', 'Tirolesas'],
      editorialFlags: [expect.objectContaining({ code: 'MEDIA_PENDING_LIBRARY_REVIEW' })],
    });
    expect(result.experiences[1].missingMediaAssetIds).toEqual(['not-in-db']);

    const shared = result.mediaAssets.find(row => row.id === 'shared');
    expect(shared).toMatchObject({
      id: 'shared',
      sizeBytes: '1234',
      linkedExperienceCount: 2,
      usages: [
        { experienceId: 'draft-1', role: 'featured' },
        { experienceId: 'draft-1', role: 'gallery' },
        { experienceId: 'published-1', role: 'gallery' },
      ],
    });
    expect(result.mediaAssets.find(row => row.id === 'unused')?.usages).toEqual([]);
    expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    expect(prisma.experience.update).not.toHaveBeenCalled();
    expect(storage.getMetadata).not.toHaveBeenCalled();
  });

  it('returns an empty inventory safely', async () => {
    const { prisma, service } = setup();
    prisma.experience.findMany.mockResolvedValue([]);
    prisma.mediaAsset.findMany.mockResolvedValue([]);

    const result = await service.getExperienceMediaInventory();
    expect(result.summary.draftExperiences).toBe(0);
    expect(result.summary.publishedExperiences).toBe(0);
    expect(result.experiences).toEqual([]);
    expect(result.mediaAssets).toEqual([]);
  });

  it('reuses an existing MediaAsset when registering a previously registered Drive storageKey', async () => {
    const { prisma, storage, service } = setup();
    const existing = asset('same-media-id', 'drive-file-id');
    storage.getMetadata.mockResolvedValue({
      key: 'drive-file-id', name: 'sacred-river-68.webp',
      mimeType: 'image/webp', sizeBytes: 1234,
    });
    prisma.mediaAsset.findFirst.mockResolvedValue(existing);
    prisma.mediaAsset.update.mockResolvedValue(existing);

    const result = await service.registerStorageObject({ storageKey: 'drive-file-id' });

    expect(result.id).toBe('same-media-id');
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { storageProvider: 'google-drive', storageKey: 'drive-file-id' },
    });
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('preserves DRAFT status when associating shared MediaAsset IDs to an experience', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue({
      id: 'draft-1', slug: 'buggy-zipline', status: ContentRecordStatus.DRAFT,
    });
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 'shared' }, { id: 'zipline' }]);
    prisma.experience.update.mockResolvedValue({
      id: 'draft-1', slug: 'buggy-zipline', title: 'Buggy + Zipline',
      status: ContentRecordStatus.DRAFT,
      featuredMediaId: 'shared', galleryMediaIds: ['shared', 'zipline'],
    });

    const result = await service.linkExperienceMedia('draft-1', {
      featuredMediaId: 'shared',
      galleryMediaIds: ['shared', 'zipline'],
    });

    expect(result.status).toBe(ContentRecordStatus.DRAFT);
    expect(prisma.experience.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'draft-1' },
        data: {
          featuredMediaId: 'shared',
          galleryMediaIds: ['shared', 'zipline'],
        },
      }),
    );
    expect(prisma.experience.update.mock.calls[0][0].data).not.toHaveProperty('status');
  });
});
