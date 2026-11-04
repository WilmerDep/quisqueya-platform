import { ContentRecordStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../infra/prisma.service.js';
import { ContentService } from './content.service.js';

function row(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: slug,
    slug,
    title: slug,
    status: ContentRecordStatus.PUBLISHED,
    sourceId: null,
    sourceUrl: null,
    latitude: null,
    longitude: null,
    mapZoom: null,
    featuredMediaId: null,
    galleryMediaIds: [],
    galleryMediaSourceIds: [],
    languagesJson: [],
    includedItemsJson: [],
    excludedItemsJson: [],
    itineraryJson: [],
    faqsJson: [],
    editorialFlagsJson: [],
    pricingMode: 'FIXED',
    pricingJson: { currency: 'USD', basis: 'person', from: 99 },
    displayJson: null,
    ...overrides,
  };
}

function setup() {
  const prisma = {
    experience: { findMany: vi.fn(), findFirst: vi.fn() },
    mediaAsset: { findMany: vi.fn() },
  };
  return { prisma, service: new ContentService(prisma as unknown as PrismaService) };
}

describe('ContentService /api/v1/public/experiences (familias)', () => {
  const mainSlug = 'bavaro-adventure-park';
  const slugs = Array.from({ length: 13 }, (_, i) => `bavaro-modalidad-${i + 1}`);
  const main = row(mainSlug, {
    displayJson: { experienceFamily: { version: 2, mode: 'multi_inquiry', packageSlugs: slugs } },
  });
  const variants = slugs.map((slug, i) => row(slug, {
    includedItemsJson: [`Incluido exclusivo ${i + 1}`],
    pricingJson: { currency: 'USD', basis: 'person', from: 99 + i * 10 },
  }));

  it('ofrece una sola tarjeta y mantiene la experiencia externa intacta', async () => {
    const { prisma, service } = setup();
    prisma.experience.findMany.mockResolvedValue([main, ...variants, row('saona')]);

    const catalog = await service.getExperiences();

    expect(catalog.map(item => item.slug)).toEqual([mainSlug, 'saona']);
    expect(catalog[0].packageCount).toBe(13);
    expect(catalog[0].packages).toBeUndefined();
    expect(prisma.experience.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: ContentRecordStatus.PUBLISHED } }),
    );
  });

  it('carga solo hijos publicados, ordena por la configuración y conserva sus incluidos propios', async () => {
    const { prisma, service } = setup();
    prisma.experience.findFirst.mockResolvedValue(main);
    prisma.experience.findMany.mockResolvedValue(variants.slice(0, 12).reverse());

    const detail = await service.getExperience(mainSlug);

    expect(detail?.packages?.map(item => item.slug)).toEqual(slugs.slice(0, 12));
    expect(detail?.packages?.[0].included).toEqual(['Incluido exclusivo 1']);
    expect(detail?.packages?.[11].pricing?.from).toBe(209);
    expect(detail?.packageSelection?.mode).toBe('multi_inquiry');
    expect(prisma.experience.findMany).toHaveBeenCalledWith({
      where: { slug: { in: slugs }, status: ContentRecordStatus.PUBLISHED },
    });
  });

  it('mantiene el detalle del slug histórico sin consulta adicional', async () => {
    const { prisma, service } = setup();
    prisma.experience.findFirst.mockResolvedValue(variants[0]);

    const legacy = await service.getExperience(slugs[0]);

    expect(legacy?.slug).toBe(slugs[0]);
    expect(legacy?.included).toEqual(['Incluido exclusivo 1']);
    expect(legacy?.kind).toBeUndefined();
    expect(prisma.experience.findMany).not.toHaveBeenCalled();
  });
});
