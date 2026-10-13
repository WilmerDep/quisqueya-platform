import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../infra/prisma.service.js';
import { ContentPreviewService } from './content-preview.service.js';

const media = (id: string, url: string, sourceId: string | null = null) => ({
  id,
  sourceId,
  sourceUrl: null,
  publicUrl: url,
  altText: null,
  width: null,
  height: null,
  mimeType: sourceId ? 'image/jpeg' : 'image/webp',
});

const createService = ({
  galleryMediaIds = [] as string[],
  galleryMediaSourceIds = [] as number[],
  managed = [] as ReturnType<typeof media>[],
  legacy = [] as ReturnType<typeof media>[],
} = {}) => {
  const experience = {
    id: 'draft-exp-1',
    slug: 'sacred-river',
    title: 'Sacred River',
    status: 'DRAFT',
    pricingMode: 'ON_REQUEST',
    featuredMediaId: null,
    galleryMediaIds,
    galleryMediaSourceIds,
    latitude: null,
    longitude: null,
    locationAddress: null,
    mapZoom: null,
  };
  const findMany = vi.fn(async ({ where }: { where: { id?: { in: string[] }; sourceProvider?: string } }) =>
    where.id ? managed : legacy,
  );
  const prisma = {
    experience: { findUnique: vi.fn().mockResolvedValue(experience) },
    mediaAsset: { findUnique: vi.fn(), findMany },
  } as unknown as PrismaService;
  return { service: new ContentPreviewService(prisma), findMany };
};

describe('ContentPreviewService managed gallery precedence', () => {
  it('shows managed Drive assets in declared order without mixing legacy WordPress gallery', async () => {
    const first = media('managed-1', 'https://example.test/api/v1/media/managed-1/content');
    const second = media('managed-2', 'https://example.test/api/v1/media/managed-2/content');
    const legacy = media('wp-1', 'https://example.test/wp-1.jpg', '10');
    const { service, findMany } = createService({
      galleryMediaIds: ['managed-2', 'managed-1'],
      galleryMediaSourceIds: [10],
      managed: [first, second],
      legacy: [legacy],
    });

    const result = await service.getExperience('sacred-river');

    expect(result?.gallery).toEqual([
      expect.objectContaining({ id: 'managed-2', url: second.publicUrl }),
      expect.objectContaining({ id: 'managed-1', url: first.publicUrl }),
    ]);
    expect(result?.galleryMediaIds).toEqual(['managed-2', 'managed-1']);
    expect(result?.galleryMediaSourceIds).toEqual([10]);
    expect(result?.status).toBe('draft');
    expect(result?.preview).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['managed-2', 'managed-1'] } } }),
    );
  });

  it('uses the legacy WordPress gallery when no managed gallery is linked', async () => {
    const legacy = media('wp-10', 'https://example.test/wp-10.jpg', '10');
    const { service, findMany } = createService({
      galleryMediaSourceIds: [10],
      legacy: [legacy],
    });

    const result = await service.getExperience('sacred-river');

    expect(result?.gallery).toEqual([
      expect.objectContaining({ id: 'wp-10', url: legacy.publicUrl }),
    ]);
    expect(result?.galleryMediaIds).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceProvider: 'WORDPRESS', sourceId: { in: ['10'] } },
      }),
    );
  });

  it('does not fall back to legacy if managed IDs are set but no assets resolve', async () => {
    const { service, findMany } = createService({
      galleryMediaIds: ['missing-managed'],
      galleryMediaSourceIds: [10],
      managed: [],
      legacy: [media('wp-10', 'https://example.test/wp-10.jpg', '10')],
    });

    const result = await service.getExperience('sacred-river');

    expect(result?.gallery).toEqual([]);
    expect(result?.galleryMediaIds).toEqual(['missing-managed']);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
