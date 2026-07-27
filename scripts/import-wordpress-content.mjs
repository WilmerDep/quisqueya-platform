import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const baseUrl = (process.env.WP_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Missing WP_BASE_URL. Example: WP_BASE_URL=https://example.com node scripts/import-wordpress-content.mjs');
  process.exit(1);
}

const rawDir = join(process.cwd(), 'data', 'wordpress', 'raw');
const contentDir = join(process.cwd(), 'data', 'content');
await mkdir(rawDir, { recursive: true });
await mkdir(contentDir, { recursive: true });

const endpoints = {
  pages: '/wp-json/wp/v2/pages',
  media: '/wp-json/wp/v2/media',
  experiences: '/wp-json/wp/v2/tf_tours',
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
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} while fetching ${url}`);
    }

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
    featuredMedia: embeddedMedia(item),
    sourceUrl: item.link,
    status: item.status,
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
  };
}

function normalizeMedia(item) {
  return {
    id: `wp-media-${item.id}`,
    sourceId: item.id,
    sourceUrl: item.link || item.source_url,
    url: item.source_url || '',
    alt: item.alt_text || '',
    width: item.media_details?.width,
    height: item.media_details?.height,
    mimeType: item.mime_type,
  };
}

console.log(`Importing public WordPress content from ${baseUrl}`);

const [pages, media, experiences] = await Promise.all([
  fetchAll(endpoints.pages),
  fetchAll(endpoints.media),
  fetchAll(endpoints.experiences),
]);

const fetchedAt = new Date().toISOString();
await Promise.all([
  writeFile(join(rawDir, 'pages.json'), JSON.stringify({ fetchedAt, endpoint: endpoints.pages, rows: pages }, null, 2)),
  writeFile(join(rawDir, 'media.json'), JSON.stringify({ fetchedAt, endpoint: endpoints.media, rows: media }, null, 2)),
  writeFile(join(rawDir, 'tf_tours.json'), JSON.stringify({ fetchedAt, endpoint: endpoints.experiences, rows: experiences }, null, 2)),
]);

const normalizedMedia = media.map(normalizeMedia);
const snapshot = {
  generatedAt: fetchedAt,
  source: 'wordpress',
  experiences: experiences.map(normalizeExperience),
  destinations: [],
  pages: pages.map(normalizePage),
  media: normalizedMedia,
};

await writeFile(join(contentDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));

console.log(`Imported ${snapshot.experiences.length} experiences, ${snapshot.pages.length} pages and ${snapshot.media.length} media items.`);
console.log('Destinations remain empty until their confirmed REST taxonomy mapping is wired into this importer.');
