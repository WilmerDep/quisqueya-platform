import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

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

function cleanEditorialHtml(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:figure|picture)\b[^>]*>[\s\S]*?<\/(?:figure|picture)>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\s(?:class|style|id|data-[\w-]+|aria-[\w-]+)=("[^"]*"|'[^']*')/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEditorialPreamble(html) {
  const source = String(html || '');
  const firstHeading = source.search(/<(?:h2|h3)\b/i);
  const preambleSource = firstHeading >= 0 ? source.slice(0, firstHeading) : source;
  const cleaned = cleanEditorialHtml(preambleSource);
  return stripTags(cleaned) ? cleaned : undefined;
}

function featuredMediaSourceId(post) {
  const embedded = post?._embedded?.['wp:featuredmedia']?.[0];
  const sourceId = Number(embedded?.id || post?.featured_media);
  return Number.isFinite(sourceId) && sourceId > 0 ? sourceId : undefined;
}

async function main() {
  const destinations = await prisma.destination.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      excerpt: true,
      galleryMediaSourceIds: true,
      provenanceJson: true,
      displayJson: true,
    },
  });

  let updated = 0;

  for (const destination of destinations) {
    const provenance = destination.provenanceJson;
    if (!provenance || Array.isArray(provenance) || typeof provenance !== 'object') continue;

    const post = provenance.editorialPost;
    if (!post || Array.isArray(post) || typeof post !== 'object') continue;

    const html = String(post.content?.rendered || '');
    const preamble = extractEditorialPreamble(html);
    const currentGallery = Array.isArray(destination.galleryMediaSourceIds)
      ? destination.galleryMediaSourceIds.map(Number).filter(Number.isFinite)
      : [];
    const featuredSourceId = featuredMediaSourceId(post);
    const galleryMediaSourceIds = [...new Set([
      ...(featuredSourceId ? [featuredSourceId] : []),
      ...currentGallery,
    ])];

    if (!preamble && galleryMediaSourceIds.length === currentGallery.length) continue;

    await prisma.destination.update({
      where: { id: destination.id },
      data: {
        description: preamble || destination.excerpt,
        galleryMediaSourceIds,
        displayJson: {
          ...(destination.displayJson && !Array.isArray(destination.displayJson) && typeof destination.displayJson === 'object'
            ? destination.displayJson
            : {}),
          editorialPreamblePreserved: Boolean(preamble),
          editorialPreambleLength: preamble ? stripTags(preamble).length : 0,
          editorialMediaCount: galleryMediaSourceIds.length,
        },
      },
    });

    updated += 1;
    console.log(`Repaired destination editorial: ${destination.slug} (${preamble ? stripTags(preamble).length : 0} intro chars, ${galleryMediaSourceIds.length} media references)`);
  }

  console.log(`Destination editorial repair completed: ${updated} updated.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
