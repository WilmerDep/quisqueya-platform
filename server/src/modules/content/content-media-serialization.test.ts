import { ContentRecordStatus, ContentSourceProvider } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../infra/prisma.service.js';
import { ContentService } from './content.service.js';
import { ContentPreviewService } from './content-preview.service.js';

const ALLOWED_PUBLIC_MEDIA_KEYS = new Set([
  'id',
  'sourceId',
  'sourceUrl',
  'url',
  'alt',
  'caption',
  'width',
  'height',
  'mimeType',
]);

const FORBIDDEN_ADMIN_MEDIA_KEYS = [
  'sourceProvider',
  'storageProvider',
  'storageKey',
  'fileName',
  'sizeBytes',
  'checksum',
  'storageMetadataJson',
  'provenanceJson',
  'createdAt',
  'updatedAt',
];

function makeMediaRow(
  id: string,
  overrides: Partial<{
    sourceId: string | null;
    sourceUrl: string | null;
    publicUrl: string;
    altText: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
    mimeType: string | null;
  }> = {},
) {
  return {
    id,
    sourceId: null,
    sourceUrl: null,
    publicUrl: `https://crmquisqueya.pholiodev.com/api/v1/media/${id}/content`,
    altText: `Imagen ${id}`,
    caption: null,
    width: 1600,
    height: 1066,
    mimeType: 'image/webp',
    // Simulate administrative columns that must never leak into public payloads
    sourceProvider: ContentSourceProvider.MANUAL,
    storageProvider: 'google_drive',
    storageKey: `drive/internal/${id}.webp`,
    fileName: `${id}.webp`,
    sizeBytes: BigInt(123456),
    checksum: 'sha256-internal-checksum',
    storageMetadataJson: { driveFileId: 'secret-drive-id' },
    provenanceJson: { importedBy: 'admin' },
    createdAt: new Date('2026-11-20T00:00:00Z'),
    updatedAt: new Date('2026-11-21T00:00:00Z'),
    ...overrides,
  };
}

function makeExperienceRow(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `exp-${slug}`,
    slug,
    title: slug,
    excerpt: `Resumen ${slug}`,
    description: `Descripción ${slug}`,
    featuredText: null,
    videoUrl: null,
    duration: '8 horas',
    durationValue: 8,
    durationUnit: 'hour',
    categoryLabel: 'Aventura',
    status: ContentRecordStatus.PUBLISHED,
    sourceId: null,
    sourceUrl: null,
    locationAddress: 'La Romana, República Dominicana',
    latitude: 18.42,
    longitude: -68.89,
    mapZoom: 13,
    featuredMediaId: null,
    galleryMediaIds: [],
    galleryMediaSourceIds: [],
    languagesJson: ['Español', 'Inglés'],
    includedItemsJson: ['Transporte'],
    excludedItemsJson: ['Propinas'],
    itineraryJson: [{ time: '08:00', title: 'Salida', desc: 'Recogida' }],
    faqsJson: [],
    practicalInfoJson: null,
    editorialFlagsJson: [],
    pricingMode: 'FIXED',
    pricingJson: { currency: 'USD', basis: 'person', from: 99 },
    bookingJson: null,
    availabilityJson: null,
    contactJson: null,
    displayJson: null,
    ...overrides,
  };
}

function assertPublicMediaClean(media: Record<string, unknown> | null | undefined) {
  expect(media).toBeTruthy();
  const serialized = JSON.parse(JSON.stringify(media)) as Record<string, unknown>;
  for (const key of Object.keys(serialized)) {
    expect(ALLOWED_PUBLIC_MEDIA_KEYS.has(key)).toBe(true);
  }
  for (const forbidden of FORBIDDEN_ADMIN_MEDIA_KEYS) {
    expect(serialized).not.toHaveProperty(forbidden);
  }
}

describe('ContentService & ContentPreviewService public media caption/alt parity (C19.10)', () => {
  it('delivers caption and alt on featuredMedia and gallery for PUBLISHED Cueva de las Maravillas (CC BY-SA 4.0) without admin fields', async () => {
    const prisma = {
      experience: { findMany: vi.fn(), findFirst: vi.fn() },
      mediaAsset: { findMany: vi.fn() },
    };
    const service = new ContentService(prisma as unknown as PrismaService);

    const cuevaCaption1 =
      'File:Cuevas de las Maravillas.jpg. Autor: Danu Widjajanto. Fuente: https://commons.wikimedia.org/wiki/File:Cuevas_de_las_Maravillas.jpg. Licencia: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).';
    const cuevaCaption2 =
      'File:Taíno pictographs Cuevas de las Maravillas.jpg. Autor: Danu Widjajanto. Licencia: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).';

    const cuevaRow = makeExperienceRow('altos-de-chavon-cueva-de-las-maravillas', {
      title: 'Altos de Chavón + Cueva de las Maravillas',
      featuredMediaId: 'cueva-cover',
      galleryMediaIds: ['cueva-cover', 'cueva-pictographs', 'cueva-chavon'],
    });

    const coverMedia = makeMediaRow('cueva-cover', {
      altText: 'Interior de la Cueva de las Maravillas',
      caption: cuevaCaption1,
    });
    const pictographsMedia = makeMediaRow('cueva-pictographs', {
      altText: 'Pictografías taínas en la Cueva de las Maravillas',
      caption: cuevaCaption2,
    });
    const chavonMedia = makeMediaRow('cueva-chavon', {
      altText: 'Vista de Altos de Chavón',
      caption: null,
    });

    prisma.experience.findFirst.mockResolvedValue(cuevaRow);
    prisma.mediaAsset.findMany.mockResolvedValue([chavonMedia, pictographsMedia, coverMedia]);

    const detail = await service.getExperience('altos-de-chavon-cueva-de-las-maravillas');

    expect(detail).not.toBeNull();
    expect(detail?.status).toBe('published');
    expect(detail?.featuredMedia).toMatchObject({
      id: 'cueva-cover',
      alt: 'Interior de la Cueva de las Maravillas',
      caption: cuevaCaption1,
    });
    assertPublicMediaClean(detail?.featuredMedia as Record<string, unknown>);

    expect(detail?.gallery.map(item => item.id)).toEqual([
      'cueva-cover',
      'cueva-pictographs',
      'cueva-chavon',
    ]);
    expect(detail?.gallery[0].caption).toBe(cuevaCaption1);
    expect(detail?.gallery[1].caption).toBe(cuevaCaption2);
    expect(detail?.gallery[1].alt).toBe('Pictografías taínas en la Cueva de las Maravillas');
    expect(detail?.gallery[2].caption).toBeUndefined();
    expect(detail?.gallery[2].alt).toBe('Vista de Altos de Chavón');

    for (const item of detail?.gallery ?? []) {
      assertPublicMediaClean(item as unknown as Record<string, unknown>);
    }

    // Verify Prisma query selects caption & altText explicitly and excludes administrative columns
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['cueva-cover', 'cueva-pictographs', 'cueva-chavon'] } },
      select: {
        id: true,
        sourceId: true,
        sourceUrl: true,
        publicUrl: true,
        altText: true,
        caption: true,
        width: true,
        height: true,
        mimeType: true,
      },
    });
  });

  it('delivers identical PublicMedia shape on Scape Park DRAFT preview with MediaAsset c141e699-8538-45d7-b7a0-a8b48d9b6c5e (CC BY 2.0) and keeps DRAFT hidden from public endpoint', async () => {
    const scapeMediaId = 'c141e699-8538-45d7-b7a0-a8b48d9b6c5e';
    const scapeCaption =
      'Foto: adam w (asw909 / amodelofcontrol) · Licencia CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/) · Fuente: https://commons.wikimedia.org/wiki/File:Dominican_Republic_Blue_Hole.jpg';
    const scapeRow = makeExperienceRow('scape-park-full-admission-cap-cana', {
      title: 'Scape Park Full Admission – Cap Cana',
      status: ContentRecordStatus.DRAFT,
      featuredMediaId: scapeMediaId,
      galleryMediaIds: [],
      pricingJson: {
        version: 1,
        basis: 'person',
        currency: 'USD',
        from: 129,
        addOns: [
          { key: 'buggy', label: 'Buggy', price: 40, basis: 'person', currency: 'USD' },
          { key: 'party-boat', label: 'Party Boat', price: 40, basis: 'person', currency: 'USD' },
          { key: 'juanillo-vip', label: 'Juanillo VIP', price: 60, basis: 'person', currency: 'USD' },
        ],
      },
    });
    const scapeMediaRow = makeMediaRow(scapeMediaId, {
      altText: 'Hoyo Azul en Scape Park, Cap Cana',
      caption: scapeCaption,
    });

    // Preview path returns DRAFT with caption & alt
    const previewPrisma = {
      experience: { findUnique: vi.fn().mockResolvedValue(scapeRow), findMany: vi.fn() },
      mediaAsset: { findUnique: vi.fn().mockResolvedValue(scapeMediaRow), findMany: vi.fn() },
    };
    const previewService = new ContentPreviewService(previewPrisma as unknown as PrismaService);
    const previewResult = await previewService.getExperience('scape-park-full-admission-cap-cana');

    expect(previewResult?.status).toBe('draft');
    expect(previewResult?.preview).toBe(true);
    expect(previewResult?.featuredMedia).toMatchObject({
      id: scapeMediaId,
      url: `https://crmquisqueya.pholiodev.com/api/v1/media/${scapeMediaId}/content`,
      alt: 'Hoyo Azul en Scape Park, Cap Cana',
      caption: scapeCaption,
    });
    assertPublicMediaClean(previewResult?.featuredMedia as Record<string, unknown>);

    // Public path must keep DRAFT hidden and produce identical PublicMedia if later published
    const publicPrisma = {
      experience: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn() },
      mediaAsset: { findMany: vi.fn() },
    };
    const publicService = new ContentService(publicPrisma as unknown as PrismaService);
    expect(await publicService.getExperience('scape-park-full-admission-cap-cana')).toBeNull();
    expect(publicPrisma.experience.findFirst).toHaveBeenCalledWith({
      where: { slug: 'scape-park-full-admission-cap-cana', status: ContentRecordStatus.PUBLISHED },
    });

    // Parity check: if the exact same MediaAsset row is mapped through ContentService, keys & values match ContentPreviewService
    publicPrisma.experience.findFirst.mockResolvedValue({
      ...scapeRow,
      status: ContentRecordStatus.PUBLISHED,
    });
    publicPrisma.mediaAsset.findMany.mockResolvedValue([scapeMediaRow]);
    const simulatedPublished = await publicService.getExperience('scape-park-full-admission-cap-cana');
    expect(simulatedPublished?.featuredMedia).toEqual(previewResult?.featuredMedia);
    expect(simulatedPublished?.pricing).toEqual(scapeRow.pricingJson);
  });

  it('handles photos without caption or alt cleanly and preserves catalog + legacy gallery + public media serialization', async () => {
    const prisma = {
      experience: { findMany: vi.fn(), findFirst: vi.fn() },
      mediaAsset: { findMany: vi.fn() },
    };
    const service = new ContentService(prisma as unknown as PrismaService);

    const noCaptionExp = makeExperienceRow('isla-saona', {
      featuredMediaId: 'saona-cover',
      galleryMediaIds: ['saona-cover', 'saona-beach'],
    });
    const legacyExp = makeExperienceRow('santo-domingo-city-tour', {
      featuredMediaId: null,
      galleryMediaIds: [],
      galleryMediaSourceIds: [501, 502],
    });

    const saonaCover = makeMediaRow('saona-cover', { altText: null, caption: null });
    const saonaBeach = makeMediaRow('saona-beach', { altText: 'Playa Isla Saona', caption: null });
    const wp501 = makeMediaRow('wp-501', {
      sourceId: '501',
      altText: 'Zona Colonial',
      caption: 'Crédito editorial CC BY-SA 4.0',
    });
    const wp502 = makeMediaRow('wp-502', { sourceId: '502', altText: null, caption: null });

    prisma.experience.findMany.mockResolvedValue([noCaptionExp, legacyExp]);
    prisma.mediaAsset.findMany
      .mockResolvedValueOnce([saonaCover, saonaBeach])
      .mockResolvedValueOnce([wp501, wp502]);

    const catalog = await service.getExperiences();

    expect(catalog).toHaveLength(2);
    expect(catalog[0].featuredMedia).toEqual({
      id: 'saona-cover',
      sourceId: undefined,
      sourceUrl: undefined,
      url: 'https://crmquisqueya.pholiodev.com/api/v1/media/saona-cover/content',
      alt: undefined,
      caption: undefined,
      width: 1600,
      height: 1066,
      mimeType: 'image/webp',
    });
    const saonaJson = JSON.parse(JSON.stringify(catalog[0].featuredMedia)) as Record<string, unknown>;
    expect(saonaJson).not.toHaveProperty('caption');
    expect(saonaJson).not.toHaveProperty('alt');
    assertPublicMediaClean(saonaJson);

    expect(catalog[1].gallery).toHaveLength(2);
    expect(catalog[1].gallery[0].caption).toBe('Crédito editorial CC BY-SA 4.0');
    expect(catalog[1].gallery[0].alt).toBe('Zona Colonial');
    expect(catalog[1].gallery[1].caption).toBeUndefined();
    expect(catalog[0].pricing).toEqual({ currency: 'USD', basis: 'person', from: 99 });
    expect(catalog[0].itinerary).toEqual([{ time: '08:00', title: 'Salida', desc: 'Recogida' }]);

    // Public /media endpoint also includes caption without admin fields
    prisma.mediaAsset.findMany.mockResolvedValueOnce([wp501, saonaCover]);
    const mediaList = await service.getMedia();
    expect(mediaList[0].caption).toBe('Crédito editorial CC BY-SA 4.0');
    expect(mediaList[1].caption).toBeUndefined();
    mediaList.forEach(item => assertPublicMediaClean(item as unknown as Record<string, unknown>));
  });
});
