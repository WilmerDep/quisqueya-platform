import { ContentRecordStatus, ContentSourceProvider } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../infra/prisma.service.js';
import { ContentPreviewService } from './content-preview.service.js';

const media = (id: string, sourceId: string | null = null) => ({
  id,
  sourceId,
  sourceUrl: null,
  publicUrl: 'https://crmquisqueya.pholiodev.com/api/v1/media/' + id + '/content',
  altText: 'Fotografía de ' + id,
  width: null,
  height: null,
  mimeType: 'image/webp',
});

const experience = (overrides: Record<string, unknown> = {}) => ({
  id: 'manual-exp-bavaro-adventure-park-buggy-vip',
  slug: 'bavaro-adventure-park-buggy-vip',
  title: 'Buggy VIP – Bávaro Adventure Park',
  status: ContentRecordStatus.DRAFT,
  sourceId: null,
  featuredMediaId: 'cover',
  galleryMediaIds: ['gallery-b', 'gallery-a'],
  galleryMediaSourceIds: [198, 199],
  latitude: null,
  longitude: null,
  mapZoom: null,
  locationAddress: null,
  languagesJson: [],
  includedItemsJson: [],
  excludedItemsJson: [],
  itineraryJson: [],
  faqsJson: [],
  editorialFlagsJson: [],
  ...overrides,
});

function setup() {
  const prisma = {
    experience: { findUnique: vi.fn(), findMany: vi.fn() },
    mediaAsset: { findUnique: vi.fn(), findMany: vi.fn() },
  };
  const service = new ContentPreviewService(prisma as unknown as PrismaService);
  return { prisma, service };
}

describe('ContentPreviewService managed experience gallery precedence', () => {
  it('returns managed DRAFT gallery images in saved order without mixing WordPress legacy images', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue(experience());
    prisma.mediaAsset.findUnique.mockResolvedValue(media('cover'));
    // DB query order is intentionally different from the stored gallery order.
    prisma.mediaAsset.findMany.mockResolvedValue([media('gallery-a'), media('gallery-b')]);

    const result = await service.getExperience('bavaro-adventure-park-buggy-vip');

    expect(result?.status).toBe('draft');
    expect(result?.preview).toBe(true);
    expect(result?.featuredMedia?.id).toBe('cover');
    expect(result?.gallery.map(item => item.id)).toEqual(['gallery-b', 'gallery-a']);
    expect(result?.galleryMediaIds).toEqual(['gallery-b', 'gallery-a']);
    expect(result?.galleryMediaSourceIds).toEqual([198, 199]);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['gallery-b', 'gallery-a'] } } }),
    );
  });

  it('uses managed gallery even for already-published content with legacy references', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue(experience({
      id: 'wp-tour-724',
      status: ContentRecordStatus.PUBLISHED,
      galleryMediaIds: ['altos-1', 'altos-2'],
      galleryMediaSourceIds: [198, 199],
    }));
    prisma.mediaAsset.findUnique.mockResolvedValue(media('cover'));
    prisma.mediaAsset.findMany.mockResolvedValue([media('altos-2'), media('altos-1')]);

    const result = await service.getExperience('bavaro-adventure-park-buggy-vip');

    expect(result?.status).toBe('published');
    expect(result?.gallery.map(item => item.id)).toEqual(['altos-1', 'altos-2']);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original WordPress gallery when there are no managed gallery IDs', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue(experience({
      featuredMediaId: null,
      galleryMediaIds: [],
      galleryMediaSourceIds: [200, 100],
    }));
    prisma.mediaAsset.findMany.mockResolvedValue([media('wp-100', '100'), media('wp-200', '200')]);

    const result = await service.getExperience('bavaro-adventure-park-buggy-vip');

    expect(result?.featuredMedia).toBeNull();
    expect(result?.gallery.map(item => item.id)).toEqual(['wp-200', 'wp-100']);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceProvider: ContentSourceProvider.WORDPRESS,
          sourceId: { in: ['200', '100'] },
        },
      }),
    );
  });

  it('does not silently revive legacy photos when a managed gallery has missing assets', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue(experience({
      galleryMediaIds: ['missing-id', 'found-id'],
      galleryMediaSourceIds: [200],
    }));
    prisma.mediaAsset.findUnique.mockResolvedValue(media('cover'));
    prisma.mediaAsset.findMany.mockResolvedValue([media('found-id')]);

    const result = await service.getExperience('bavaro-adventure-park-buggy-vip');

    expect(result?.gallery.map(item => item.id)).toEqual(['found-id']);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(1);
  });

  it('handles empty galleries without issuing unnecessary media queries', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue(experience({
      featuredMediaId: null,
      galleryMediaIds: [],
      galleryMediaSourceIds: [],
    }));

    const result = await service.getExperience('bavaro-adventure-park-buggy-vip');

    expect(result?.gallery).toEqual([]);
    expect(result?.featuredMedia).toBeNull();
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
  });

  it('keeps a missing experience hidden', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue(null);

    expect(await service.getExperience('not-a-tour')).toBeNull();
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
  });

  it('resolves the protected DRAFT family in configured order without inheriting child prices', async () => {
    const { prisma, service } = setup();
    const slugs = Array.from({ length: 13 }, (_, i) => `bavaro-adventure-park-package-${i + 1}`);
    prisma.experience.findUnique.mockResolvedValue(experience({
      id: 'manual-exp-bavaro-adventure-park',
      slug: 'bavaro-adventure-park',
      title: 'Bávaro Adventure Park',
      featuredMediaId: null,
      galleryMediaIds: [],
      galleryMediaSourceIds: [],
      pricingMode: 'ON_REQUEST',
      pricingJson: null,
      displayJson: { experienceFamily: { version: 2, mode: 'multi_inquiry', packageSlugs: slugs } },
    }));
    const children = slugs.map((slug, i) => experience({
      id: `manual-exp-${slug}`,
      slug,
      title: `Modalidad ${i + 1}`,
      featuredMediaId: null,
      galleryMediaIds: [],
      galleryMediaSourceIds: [],
      pricingMode: 'FIXED',
      pricingJson: { currency: 'USD', basis: 'person', from: 100 + i * 10 },
      includedItemsJson: [`Incluido ${i + 1}`],
      excludedItemsJson: [`No incluido ${i + 1}`],
    }));
    prisma.experience.findMany.mockResolvedValue([...children].reverse());

    const result = await service.getExperience('bavaro-adventure-park');

    expect(result).toMatchObject({
      kind: 'package_family',
      status: 'draft',
      preview: true,
      packageCount: 13,
      packageSelection: { version: 2, mode: 'multi_inquiry' },
      pricingMode: 'on_request',
    });
    expect(result?.pricing).toBeUndefined();
    expect(result?.packages?.map(item => item.slug)).toEqual(slugs);
    expect(result?.packages?.[0]).toMatchObject({
      preview: true,
      status: 'draft',
      pricing: { from: 100, currency: 'USD', basis: 'person' },
      included: ['Incluido 1'],
      excluded: ['No incluido 1'],
    });
    expect(result?.packages?.[12].pricing?.from).toBe(220);
    expect(prisma.experience.findMany).toHaveBeenCalledWith({
      where: {
        slug: { in: slugs },
        status: { in: [ContentRecordStatus.DRAFT, ContentRecordStatus.PUBLISHED] },
      },
    });
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
  });

  it('does not query unrelated packages for a standalone preview', async () => {
    const { prisma, service } = setup();
    prisma.experience.findUnique.mockResolvedValue(experience({
      featuredMediaId: null,
      galleryMediaIds: [],
      galleryMediaSourceIds: [],
    }));

    const result = await service.getExperience('bavaro-adventure-park-buggy-vip');

    expect(result?.kind).toBeUndefined();
    expect(prisma.experience.findMany).not.toHaveBeenCalled();
  });
});
