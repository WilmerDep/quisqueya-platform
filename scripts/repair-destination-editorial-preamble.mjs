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
    .replace(/<(?:ul|ol)\b[^>]*>[\s\S]*?<\/(?:ul|ol)>/gi, '')
    .replace(/\s(?:class|style|id|data-[\w-]+|aria-[\w-]+)=("[^"]*"|'[^']*')/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return stripTags(value).toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
}

function extractLeadBlock(html) {
  const source = String(html || '');
  const headings = [...source.matchAll(/<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  if (!headings.length) return undefined;

  const first = headings[0];
  const title = stripTags(first[2]);
  if (!title) return undefined;

  const start = (first.index || 0) + first[0].length;
  const end = headings[1]?.index ?? source.length;
  const content = cleanEditorialHtml(source.slice(start, end));

  return {
    title,
    content: stripTags(content) ? content : undefined,
  };
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
      featuredText: true,
      description: true,
      galleryMediaSourceIds: true,
      contentSectionsJson: true,
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
    const lead = extractLeadBlock(html);
    const currentSections = Array.isArray(destination.contentSectionsJson)
      ? destination.contentSectionsJson.filter(section => section && !Array.isArray(section) && typeof section === 'object')
      : [];
    const leadTitleNormalized = normalizeText(lead?.title);
    const normalizedSections = currentSections
      .filter((section, index) => {
        if (!leadTitleNormalized || index !== 0) return true;
        return normalizeText(section.title) !== leadTitleNormalized;
      })
      .map((section, index) => ({ ...section, order: index }));

    const currentGallery = Array.isArray(destination.galleryMediaSourceIds)
      ? destination.galleryMediaSourceIds.map(Number).filter(Number.isFinite)
      : [];
    const featuredSourceId = featuredMediaSourceId(post);
    const galleryMediaSourceIds = [...new Set([
      ...(featuredSourceId ? [featuredSourceId] : []),
      ...currentGallery,
    ])];

    const nextFeaturedText = lead?.title || destination.featuredText;
    const nextDescription = lead?.content || destination.description || destination.excerpt;
    const changed = Boolean(
      normalizeText(nextFeaturedText) !== normalizeText(destination.featuredText) ||
      normalizeText(nextDescription) !== normalizeText(destination.description) ||
      normalizedSections.length !== currentSections.length ||
      galleryMediaSourceIds.length !== currentGallery.length,
    );

    if (!changed) continue;

    await prisma.destination.update({
      where: { id: destination.id },
      data: {
        featuredText: nextFeaturedText,
        description: nextDescription,
        contentSectionsJson: normalizedSections,
        galleryMediaSourceIds,
        displayJson: {
          ...(destination.displayJson && !Array.isArray(destination.displayJson) && typeof destination.displayJson === 'object'
            ? destination.displayJson
            : {}),
          editorialLeadNormalized: Boolean(lead),
          editorialLeadLength: lead?.content ? stripTags(lead.content).length : 0,
          editorialLeadRemovedFromSections: currentSections.length - normalizedSections.length,
          editorialMediaCount: galleryMediaSourceIds.length,
        },
      },
    });

    updated += 1;
    console.log(
      `Normalized destination editorial: ${destination.slug} ` +
      `(${lead?.content ? stripTags(lead.content).length : 0} lead chars, ` +
      `${normalizedSections.length} chapters, ${galleryMediaSourceIds.length} media references)`,
    );
  }

  console.log(`Destination editorial normalization completed: ${updated} updated.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
