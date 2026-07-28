import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const baseUrl = (process.env.WP_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Missing WP_BASE_URL.');
  process.exit(1);
}

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quisqueya_core',
  connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
});

const prisma = new PrismaClient({ adapter });
const rawPath = join(process.cwd(), 'data', 'wordpress', 'raw', 'tf_tours.json');

const decodeAttribute = value => String(value || '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#039;|&#39;/g, "'");

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) return null;
  return response.json();
}

async function recoverFromMediaEndpoint(mediaSourceId) {
  const item = await fetchJson(`${baseUrl}/wp-json/wp/v2/media/${mediaSourceId}`);
  if (!item?.source_url) return null;

  return prisma.mediaAsset.upsert({
    where: {
      sourceProvider_sourceId: {
        sourceProvider: 'WORDPRESS',
        sourceId: String(mediaSourceId),
      },
    },
    create: {
      id: `wp-media-${mediaSourceId}`,
      sourceProvider: 'WORDPRESS',
      sourceId: String(mediaSourceId),
      sourceUrl: item.link || item.source_url,
      storageKey: `wordpress/source/${mediaSourceId}`,
      publicUrl: item.source_url,
      fileName: item.media_details?.file?.split('/').pop() || null,
      mimeType: item.mime_type || null,
      altText: item.alt_text || null,
      caption: item.caption?.rendered || null,
      width: item.media_details?.width || null,
      height: item.media_details?.height || null,
      sizeBytes: item.media_details?.filesize ? BigInt(item.media_details.filesize) : null,
      provenanceJson: { recovery: 'direct-media-endpoint', raw: item },
    },
    update: {
      sourceUrl: item.link || item.source_url,
      publicUrl: item.source_url,
      fileName: item.media_details?.file?.split('/').pop() || null,
      mimeType: item.mime_type || null,
      altText: item.alt_text || null,
      caption: item.caption?.rendered || null,
      width: item.media_details?.width || null,
      height: item.media_details?.height || null,
      sizeBytes: item.media_details?.filesize ? BigInt(item.media_details.filesize) : null,
      provenanceJson: { recovery: 'direct-media-endpoint', raw: item },
    },
    select: { id: true },
  });
}

async function recoverFromTourPage(tour, mediaSourceId) {
  if (!tour?.link) return null;

  const response = await fetch(tour.link, {
    headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) return null;

  const html = await response.text();
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];

  const publicUrl = patterns
    .map(pattern => html.match(pattern)?.[1])
    .find(Boolean);

  if (!publicUrl) return null;
  const decodedUrl = decodeAttribute(publicUrl);
  const fileName = (() => {
    try {
      return new URL(decodedUrl).pathname.split('/').pop() || null;
    } catch {
      return null;
    }
  })();

  return prisma.mediaAsset.upsert({
    where: {
      sourceProvider_sourceId: {
        sourceProvider: 'WORDPRESS',
        sourceId: String(mediaSourceId),
      },
    },
    create: {
      id: `wp-media-${mediaSourceId}`,
      sourceProvider: 'WORDPRESS',
      sourceId: String(mediaSourceId),
      sourceUrl: `${baseUrl}/wp-json/wp/v2/media/${mediaSourceId}`,
      storageKey: `wordpress/source/${mediaSourceId}`,
      publicUrl: decodedUrl,
      fileName,
      provenanceJson: {
        recovery: 'tour-page-open-graph',
        tourId: tour.id,
        tourUrl: tour.link,
        featuredMediaSourceId: mediaSourceId,
      },
    },
    update: {
      publicUrl: decodedUrl,
      fileName,
      provenanceJson: {
        recovery: 'tour-page-open-graph',
        tourId: tour.id,
        tourUrl: tour.link,
        featuredMediaSourceId: mediaSourceId,
      },
    },
    select: { id: true },
  });
}

async function resolveMedia(tour, featuredMediaSourceId) {
  const existing = await prisma.mediaAsset.findUnique({
    where: {
      sourceProvider_sourceId: {
        sourceProvider: 'WORDPRESS',
        sourceId: String(featuredMediaSourceId),
      },
    },
    select: { id: true },
  });
  if (existing) return { media: existing, recoveredBy: null };

  const direct = await recoverFromMediaEndpoint(featuredMediaSourceId);
  if (direct) return { media: direct, recoveredBy: 'direct-media-endpoint' };

  const page = await recoverFromTourPage(tour, featuredMediaSourceId);
  if (page) return { media: page, recoveredBy: 'tour-page-open-graph' };

  return { media: null, recoveredBy: null };
}

try {
  const payload = JSON.parse(await readFile(rawPath, 'utf8'));
  const tours = Array.isArray(payload?.rows) ? payload.rows : [];

  let linked = 0;
  let missingMedia = 0;
  let withoutFeaturedMedia = 0;
  let recoveredDirectly = 0;
  let recoveredFromPages = 0;

  for (const tour of tours) {
    const sourceId = String(tour?.id ?? '');
    const featuredMediaSourceId = Number(tour?.featured_media || 0);

    if (!sourceId || !featuredMediaSourceId) {
      withoutFeaturedMedia += 1;
      continue;
    }

    const experience = await prisma.experience.findUnique({
      where: {
        sourceProvider_sourceId: {
          sourceProvider: 'WORDPRESS',
          sourceId,
        },
      },
      select: { id: true },
    });
    if (!experience) continue;

    const { media, recoveredBy } = await resolveMedia(tour, featuredMediaSourceId);
    if (!media) {
      missingMedia += 1;
      continue;
    }

    await prisma.experience.update({
      where: { id: experience.id },
      data: { featuredMediaId: media.id },
    });

    if (recoveredBy === 'direct-media-endpoint') recoveredDirectly += 1;
    if (recoveredBy === 'tour-page-open-graph') recoveredFromPages += 1;
    linked += 1;
  }

  console.log(`Linked ${linked} WordPress featured media records from numeric featured_media IDs.`);
  if (recoveredDirectly) console.log(`Recovered ${recoveredDirectly} missing media records through direct WordPress media endpoints.`);
  if (recoveredFromPages) console.log(`Recovered ${recoveredFromPages} missing media records from public tour page Open Graph images.`);
  if (missingMedia) console.warn(`${missingMedia} tours still reference media that could not be recovered.`);
  if (withoutFeaturedMedia) console.log(`${withoutFeaturedMedia} tours do not declare a numeric featured_media ID.`);
} finally {
  await prisma.$disconnect();
}
