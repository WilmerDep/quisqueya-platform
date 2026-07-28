import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const baseUrl = (process.env.WP_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Missing WP_BASE_URL. Example: WP_BASE_URL=https://example.com node scripts/import-wordpress-content.mjs');
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

const rawDir = join(process.cwd(), 'data', 'wordpress', 'raw');
const contentDir = join(process.cwd(), 'data', 'content');
await mkdir(rawDir, { recursive: true });
await mkdir(contentDir, { recursive: true });

const endpoints = {
  pages: '/wp-json/wp/v2/pages',
  media: '/wp-json/wp/v2/media',
  experiences: '/wp-json/wp/v2/tf_tours',
  destinations: '/wp-json/wp/v2/tour_destination',
  taxonomies: {
    tour_type: '/wp-json/wp/v2/tour_type',
    tour_activities: '/wp-json/wp/v2/tour_activities',
    tour_attraction: '/wp-json/wp/v2/tour_attraction',
    tour_features: '/wp-json/wp/v2/tour_features',
  },
};

const decodeHtml = value => String(value || '')
  .replace(/&#8211;|&ndash;/g, '–')
  .replace(/&#8212;|&mdash;/g, '—')
  .replace(/&#8217;|&rsquo;/g, '’')
  .replace(/&#8220;|&ldquo;/g, '“')
  .replace(/&#8221;|&rdquo;/g, '”')
  .replace(/&#038;|&amp;/g, '&')
  .replace(/&nbsp;/g, ' ')
  .replace(/<[^>]+>/g, '')
  .trim();

const asDate = value => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

async function fetchAll(path) {
  const rows = [];
  let page = 1;

  while (true) {
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('_embed', '1');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (response.status === 400 && page > 1) break;
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} while fetching ${url}`);

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);

    const totalPages = Number(response.headers.get('x-wp-totalpages') || 1);
    if (page >= totalPages) break;
    page += 1;
  }

  return rows;
}

function embeddedMedia(item) {
  const media = item?._embedded?.['wp:featuredmedia']?.[0];
  if (!media) return null;
  return {
    id: `wp-media-${media.id}`,
    sourceId: media.id,
    sourceUrl: media.link || media.source_url,
    url: media.source_url || '',
    alt: media.alt_text || '',
    width: media.media_details?.width,
    height: media.media_details?.height,
    mimeType: media.mime_type,
  };
}

function normalizeExperience(item) {
  return {
    id: `wp-tour-${item.id}`,
    sourceId: item.id,
    slug: item.slug,
    title: decodeHtml(item.title?.rendered),
    excerpt: decodeHtml(item.excerpt?.rendered),
    description: item.content?.rendered || '',
    duration: item.meta?.duration || item.meta?.tour_duration || null,
    featuredMedia: embeddedMedia(item),
    sourceUrl: item.link,
    status: item.status,
    modifiedAt: item.modified_gmt || item.modified,
    raw: item,
  };
}

function normalizePage(item) {
  return {
    id: `wp-page-${item.id}`,
    sourceId: item.id,
    slug: item.slug,
    title: decodeHtml(item.title?.rendered),
    content: item.content?.rendered || '',
    excerpt: decodeHtml(item.excerpt?.rendered),
    featuredMedia: embeddedMedia(item),
    sourceUrl: item.link,
    status: item.status,
    modifiedAt: item.modified_gmt || item.modified,
    raw: item,
  };
}

function normalizeMedia(item) {
  return {
    id: `wp-media-${item.id}`,
    sourceId: item.id,
    sourceUrl: item.link || item.source_url,
    url: item.source_url || '',
    fileName: item.media_details?.file?.split('/').pop() || null,
    alt: item.alt_text || '',
    caption: decodeHtml(item.caption?.rendered),
    width: item.media_details?.width,
    height: item.media_details?.height,
    sizeBytes: item.media_details?.filesize || null,
    mimeType: item.mime_type,
    raw: item,
  };
}

function normalizeTerm(item, taxonomy) {
  return {
    id: `wp-term-${taxonomy}-${item.id}`,
    sourceId: item.id,
    taxonomy,
    slug: item.slug,
    name: decodeHtml(item.name),
    description: item.description || null,
    raw: item,
  };
}

function publishedStatus(status) {
  if (status === 'publish') return 'PUBLISHED';
  if (status === 'trash') return 'ARCHIVED';
  return 'DRAFT';
}

function taxonomyIds(item, taxonomy) {
  const value = item?.[taxonomy];
  return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
}

async function persist({ normalizedMedia, normalizedPages, normalizedExperiences, destinationTerms, otherTerms }) {
  const mediaBySourceId = new Map();

  for (const media of normalizedMedia) {
    const row = await prisma.mediaAsset.upsert({
      where: { sourceProvider_sourceId: { sourceProvider: 'WORDPRESS', sourceId: String(media.sourceId) } },
      create: {
        id: media.id,
        sourceProvider: 'WORDPRESS',
        sourceId: String(media.sourceId),
        sourceUrl: media.sourceUrl || null,
        storageKey: `wordpress/source/${media.sourceId}`,
        publicUrl: media.url,
        fileName: media.fileName,
        mimeType: media.mimeType || null,
        altText: media.alt || null,
        caption: media.caption || null,
        width: media.width || null,
        height: media.height || null,
        sizeBytes: media.sizeBytes ? BigInt(media.sizeBytes) : null,
        provenanceJson: media.raw,
      },
      update: {
        sourceUrl: media.sourceUrl || null,
        publicUrl: media.url,
        fileName: media.fileName,
        mimeType: media.mimeType || null,
        altText: media.alt || null,
        caption: media.caption || null,
        width: media.width || null,
        height: media.height || null,
        sizeBytes: media.sizeBytes ? BigInt(media.sizeBytes) : null,
        provenanceJson: media.raw,
      },
    });
    mediaBySourceId.set(String(media.sourceId), row.id);
  }

  for (const term of destinationTerms) {
    await prisma.destination.upsert({
      where: { sourceProvider_sourceId: { sourceProvider: 'WORDPRESS', sourceId: String(term.sourceId) } },
      create: {
        id: `wp-destination-${term.sourceId}`,
        slug: term.slug,
        name: term.name,
        description: term.description,
        status: 'PUBLISHED',
        sourceProvider: 'WORDPRESS',
        sourceId: String(term.sourceId),
        sourceUrl: `${baseUrl}/tour-destination/${term.slug}/`,
        provenanceJson: term.raw,
      },
      update: {
        slug: term.slug,
        name: term.name,
        description: term.description,
        status: 'PUBLISHED',
        provenanceJson: term.raw,
      },
    });
  }

  for (const term of [...destinationTerms, ...otherTerms]) {
    await prisma.taxonomyTerm.upsert({
      where: {
        sourceProvider_taxonomy_sourceId: {
          sourceProvider: 'WORDPRESS',
          taxonomy: term.taxonomy,
          sourceId: String(term.sourceId),
        },
      },
      create: {
        id: term.id,
        taxonomy: term.taxonomy,
        slug: term.slug,
        name: term.name,
        description: term.description,
        sourceProvider: 'WORDPRESS',
        sourceId: String(term.sourceId),
        provenanceJson: term.raw,
      },
      update: {
        slug: term.slug,
        name: term.name,
        description: term.description,
        provenanceJson: term.raw,
      },
    });
  }

  const destinations = await prisma.destination.findMany({ where: { sourceProvider: 'WORDPRESS' } });
  const destinationBySourceId = new Map(destinations.map(row => [String(row.sourceId), row.id]));
  const persistedTerms = await prisma.taxonomyTerm.findMany({ where: { sourceProvider: 'WORDPRESS' } });
  const termByKey = new Map(persistedTerms.map(row => [`${row.taxonomy}:${row.sourceId}`, row.id]));

  for (let index = 0; index < normalizedExperiences.length; index += 1) {
    const experience = normalizedExperiences[index];
    const featuredMediaId = experience.featuredMedia?.sourceId
      ? mediaBySourceId.get(String(experience.featuredMedia.sourceId)) || null
      : null;

    const row = await prisma.experience.upsert({
      where: { sourceProvider_sourceId: { sourceProvider: 'WORDPRESS', sourceId: String(experience.sourceId) } },
      create: {
        id: experience.id,
        slug: experience.slug,
        title: experience.title,
        excerpt: experience.excerpt || null,
        description: experience.description || null,
        duration: experience.duration || null,
        featuredMediaId,
        status: publishedStatus(experience.status),
        sortOrder: index,
        sourceProvider: 'WORDPRESS',
        sourceId: String(experience.sourceId),
        sourceUrl: experience.sourceUrl || null,
        sourceModifiedAt: asDate(experience.modifiedAt),
        provenanceJson: experience.raw,
      },
      update: {
        slug: experience.slug,
        title: experience.title,
        excerpt: experience.excerpt || null,
        description: experience.description || null,
        duration: experience.duration || null,
        featuredMediaId,
        status: publishedStatus(experience.status),
        sortOrder: index,
        sourceUrl: experience.sourceUrl || null,
        sourceModifiedAt: asDate(experience.modifiedAt),
        provenanceJson: experience.raw,
      },
    });

    await prisma.experienceDestination.deleteMany({ where: { experienceId: row.id } });
    const destinationIds = taxonomyIds(experience.raw, 'tour_destination')
      .map(sourceId => destinationBySourceId.get(String(sourceId)))
      .filter(Boolean);
    if (destinationIds.length) {
      await prisma.experienceDestination.createMany({
        data: destinationIds.map((destinationId, position) => ({
          experienceId: row.id,
          destinationId,
          isPrimary: position === 0,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.experienceTaxonomyTerm.deleteMany({ where: { experienceId: row.id } });
    const taxonomyLinks = Object.keys(endpoints.taxonomies).flatMap(taxonomy =>
      taxonomyIds(experience.raw, taxonomy)
        .map(sourceId => termByKey.get(`${taxonomy}:${sourceId}`))
        .filter(Boolean)
        .map(termId => ({ experienceId: row.id, termId })),
    );
    if (taxonomyLinks.length) {
      await prisma.experienceTaxonomyTerm.createMany({ data: taxonomyLinks, skipDuplicates: true });
    }
  }

  for (const page of normalizedPages) {
    const featuredMediaId = page.featuredMedia?.sourceId
      ? mediaBySourceId.get(String(page.featuredMedia.sourceId)) || null
      : null;
    await prisma.contentPage.upsert({
      where: { sourceProvider_sourceId: { sourceProvider: 'WORDPRESS', sourceId: String(page.sourceId) } },
      create: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        excerpt: page.excerpt || null,
        content: page.content || null,
        featuredMediaId,
        status: publishedStatus(page.status),
        sourceProvider: 'WORDPRESS',
        sourceId: String(page.sourceId),
        sourceUrl: page.sourceUrl || null,
        sourceModifiedAt: asDate(page.modifiedAt),
        provenanceJson: page.raw,
      },
      update: {
        slug: page.slug,
        title: page.title,
        excerpt: page.excerpt || null,
        content: page.content || null,
        featuredMediaId,
        status: publishedStatus(page.status),
        sourceUrl: page.sourceUrl || null,
        sourceModifiedAt: asDate(page.modifiedAt),
        provenanceJson: page.raw,
      },
    });
  }

  return {
    media: await prisma.mediaAsset.count({ where: { sourceProvider: 'WORDPRESS' } }),
    experiences: await prisma.experience.count({ where: { sourceProvider: 'WORDPRESS' } }),
    pages: await prisma.contentPage.count({ where: { sourceProvider: 'WORDPRESS' } }),
    destinations: await prisma.destination.count({ where: { sourceProvider: 'WORDPRESS' } }),
    taxonomyTerms: await prisma.taxonomyTerm.count({ where: { sourceProvider: 'WORDPRESS' } }),
    experienceDestinations: await prisma.experienceDestination.count(),
    experienceTaxonomyTerms: await prisma.experienceTaxonomyTerm.count(),
  };
}

console.log(`Importing public WordPress content from ${baseUrl}`);

try {
  const taxonomyEntries = Object.entries(endpoints.taxonomies);
  const [pages, media, experiences, destinations, ...taxonomyRows] = await Promise.all([
    fetchAll(endpoints.pages),
    fetchAll(endpoints.media),
    fetchAll(endpoints.experiences),
    fetchAll(endpoints.destinations),
    ...taxonomyEntries.map(([, path]) => fetchAll(path)),
  ]);

  const fetchedAt = new Date().toISOString();
  const rawWrites = [
    writeFile(join(rawDir, 'pages.json'), JSON.stringify({ fetchedAt, endpoint: endpoints.pages, rows: pages }, null, 2)),
    writeFile(join(rawDir, 'media.json'), JSON.stringify({ fetchedAt, endpoint: endpoints.media, rows: media }, null, 2)),
    writeFile(join(rawDir, 'tf_tours.json'), JSON.stringify({ fetchedAt, endpoint: endpoints.experiences, rows: experiences }, null, 2)),
    writeFile(join(rawDir, 'tour_destination.json'), JSON.stringify({ fetchedAt, endpoint: endpoints.destinations, rows: destinations }, null, 2)),
    ...taxonomyEntries.map(([taxonomy, path], index) =>
      writeFile(join(rawDir, `${taxonomy}.json`), JSON.stringify({ fetchedAt, endpoint: path, rows: taxonomyRows[index] }, null, 2)),
    ),
  ];
  await Promise.all(rawWrites);

  const normalizedMedia = media.map(normalizeMedia);
  const normalizedExperiences = experiences.map(normalizeExperience);
  const normalizedPages = pages.map(normalizePage);
  const destinationTerms = destinations.map(item => normalizeTerm(item, 'tour_destination'));
  const otherTerms = taxonomyEntries.flatMap(([taxonomy], index) => taxonomyRows[index].map(item => normalizeTerm(item, taxonomy)));

  const snapshot = {
    generatedAt: fetchedAt,
    source: 'wordpress',
    experiences: normalizedExperiences.map(({ raw, modifiedAt, ...item }) => item),
    destinations: destinationTerms.map(item => ({
      id: `wp-destination-${item.sourceId}`,
      sourceId: item.sourceId,
      slug: item.slug,
      name: item.name,
      description: item.description,
      sourceUrl: `${baseUrl}/tour-destination/${item.slug}/`,
    })),
    pages: normalizedPages.map(({ raw, modifiedAt, status, ...item }) => item),
    media: normalizedMedia.map(({ raw, fileName, caption, sizeBytes, ...item }) => item),
  };
  await writeFile(join(contentDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));

  const counts = await persist({ normalizedMedia, normalizedPages, normalizedExperiences, destinationTerms, otherTerms });

  console.log(`Fetched ${experiences.length} experiences, ${pages.length} pages, ${media.length} media items and ${destinations.length} destinations.`);
  console.log(`Persisted ${counts.experiences} experiences, ${counts.pages} pages, ${counts.media} media items, ${counts.destinations} destinations and ${counts.taxonomyTerms} taxonomy terms.`);
  console.log(`Created ${counts.experienceDestinations} experience-destination links and ${counts.experienceTaxonomyTerms} experience-taxonomy links.`);
} finally {
  await prisma.$disconnect();
}
