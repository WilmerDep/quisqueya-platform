import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const baseUrl = String(process.env.WP_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Missing WP_BASE_URL. Example: WP_BASE_URL=https://example.com npm run import:destination-editorials');
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

const decodeEntities = value => String(value || '')
  .replace(/&#8211;|&ndash;/g, '–')
  .replace(/&#8212;|&mdash;/g, '—')
  .replace(/&#8216;|&lsquo;/g, '‘')
  .replace(/&#8217;|&rsquo;/g, '’')
  .replace(/&#8220;|&ldquo;/g, '“')
  .replace(/&#8221;|&rdquo;/g, '”')
  .replace(/&#8230;|&hellip;/g, '…')
  .replace(/&#038;|&amp;/g, '&')
  .replace(/&nbsp;/g, ' ')
  .replace(/&quot;/g, '"')
  .replace(/&#039;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripTags = value => decodeEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const slugify = value => stripTags(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120);

const paragraphHtml = value => decodeEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/\s(?:class|style|id|data-[\w-]+|aria-[\w-]+)=("[^"]*"|'[^']*')/gi, '')
  .trim();

function mediaSourceIdFromTag(tag) {
  const classMatch = tag.match(/\bwp-image-(\d+)\b/i);
  if (classMatch) return Number(classMatch[1]);

  const dataIdMatch = tag.match(/\bdata-id=(?:"|')(\d+)(?:"|')/i);
  if (dataIdMatch) return Number(dataIdMatch[1]);

  return undefined;
}

function imageSourceIds(html) {
  const ids = [];
  for (const match of String(html || '').matchAll(/<img\b[^>]*>/gi)) {
    const id = mediaSourceIdFromTag(match[0]);
    if (Number.isFinite(id)) ids.push(id);
  }
  return [...new Set(ids)];
}

function extractListItems(html) {
  return [...String(html || '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => stripTags(match[1]))
    .filter(Boolean);
}

function firstParagraphText(html) {
  for (const match of String(html || '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(match[1]);
    if (text.length >= 40) return text;
  }
  return '';
}

function buildSections(html) {
  const source = String(html || '');
  const headingPattern = /<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings = [...source.matchAll(headingPattern)];
  const sections = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const title = stripTags(heading[2]);
    if (!title) continue;

    const start = (heading.index || 0) + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : source.length;
    const body = source.slice(start, end);
    const items = extractListItems(body);
    const mediaSourceIds = imageSourceIds(body);
    const content = paragraphHtml(
      body
        .replace(/<(?:ul|ol)\b[^>]*>[\s\S]*?<\/(?:ul|ol)>/gi, '')
        .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '')
        .replace(/<img\b[^>]*>/gi, ''),
    );
    const anchorBase = slugify(title) || `seccion-${index + 1}`;

    sections.push({
      id: `section-${index + 1}-${anchorBase}`,
      title,
      content: stripTags(content) ? content : undefined,
      items,
      mediaSourceId: mediaSourceIds[0],
      mediaPosition: mediaSourceIds.length ? (index % 2 === 0 ? 'right' : 'left') : undefined,
      anchor: anchorBase,
      order: sections.length,
    });
  }

  return sections;
}

async function fetchAllPosts() {
  const rows = [];
  let page = 1;

  while (true) {
    const url = new URL(`${baseUrl}/wp-json/wp/v2/posts`);
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
    if (!Array.isArray(batch) || !batch.length) break;
    rows.push(...batch);

    const totalPages = Number(response.headers.get('x-wp-totalpages') || 1);
    if (page >= totalPages) break;
    page += 1;
  }

  return rows;
}

function featuredMediaSourceId(post) {
  const embedded = post?._embedded?.['wp:featuredmedia']?.[0];
  const sourceId = Number(embedded?.id || post?.featured_media);
  return Number.isFinite(sourceId) && sourceId > 0 ? sourceId : undefined;
}

async function main() {
  const [posts, destinations, media] = await Promise.all([
    fetchAllPosts(),
    prisma.destination.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, slug: true, name: true, displayJson: true, provenanceJson: true },
    }),
    prisma.mediaAsset.findMany({
      where: { sourceProvider: 'WORDPRESS', sourceId: { not: null } },
      select: { id: true, sourceId: true },
    }),
  ]);

  const destinationBySlug = new Map(destinations.map(destination => [destination.slug, destination]));
  const mediaBySourceId = new Map(media.map(item => [String(item.sourceId), item.id]));
  let imported = 0;
  const skipped = [];

  for (const post of posts) {
    const destination = destinationBySlug.get(post.slug);
    if (!destination) continue;

    const html = String(post.content?.rendered || '');
    const sections = buildSections(html);
    const contentMediaIds = imageSourceIds(html);
    const featuredSourceId = featuredMediaSourceId(post);
    const galleryMediaSourceIds = [...new Set([
      ...(featuredSourceId ? [featuredSourceId] : []),
      ...contentMediaIds,
    ])];
    const featuredMediaId = featuredSourceId
      ? mediaBySourceId.get(String(featuredSourceId)) || null
      : null;
    const excerpt = stripTags(post.excerpt?.rendered) || firstParagraphText(html) || null;
    const featuredText = sections[0]?.title || null;
    const importedAt = new Date().toISOString();

    if (!html || !sections.length) {
      skipped.push(`${post.slug}: no structured editorial sections`);
      continue;
    }

    await prisma.destination.update({
      where: { id: destination.id },
      data: {
        name: stripTags(post.title?.rendered) || destination.name,
        excerpt,
        description: firstParagraphText(html) || excerpt,
        featuredText,
        featuredMediaId,
        galleryMediaSourceIds,
        contentSectionsJson: sections,
        displayJson: {
          ...(destination.displayJson && typeof destination.displayJson === 'object' && !Array.isArray(destination.displayJson)
            ? destination.displayJson
            : {}),
          editorialPostId: post.id,
          editorialPostSlug: post.slug,
          editorialSourceUrl: post.link,
          editorialImportedAt: importedAt,
          chapterNavigation: true,
        },
        editorialFlagsJson: [],
        sourceUrl: post.link || null,
        sourceModifiedAt: post.modified_gmt || post.modified ? new Date(post.modified_gmt || post.modified) : null,
        provenanceJson: {
          ...(destination.provenanceJson && typeof destination.provenanceJson === 'object' && !Array.isArray(destination.provenanceJson)
            ? destination.provenanceJson
            : {}),
          editorialPost: post,
        },
      },
    });

    imported += 1;
    console.log(`Imported destination editorial: ${post.slug} (${sections.length} sections, ${galleryMediaSourceIds.length} media references)`);
  }

  console.log(`Destination editorial import completed: ${imported} imported from ${posts.length} WordPress posts.`);
  if (skipped.length) console.warn(`Skipped ${skipped.length}: ${skipped.join('; ')}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
