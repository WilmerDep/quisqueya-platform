import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
const rawPath = join(process.cwd(), 'data', 'wordpress', 'raw', 'tf_tours.json');

const decodeHtml = value => String(value || '')
  .replace(/&#8211;|&ndash;/g, '–')
  .replace(/&#8212;|&mdash;/g, '—')
  .replace(/&#8217;|&rsquo;/g, '’')
  .replace(/&#038;|&amp;/g, '&')
  .replace(/<[^>]+>/g, '')
  .trim();

const slugify = value => decodeHtml(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' y ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-');

try {
  const payload = JSON.parse(await readFile(rawPath, 'utf8'));
  const tours = Array.isArray(payload?.rows) ? payload.rows : [];
  const reservedSlugs = new Set(
    (await prisma.experience.findMany({
      where: { sourceProvider: { not: 'WORDPRESS' } },
      select: { slug: true },
    })).map(item => item.slug),
  );

  let updated = 0;
  let unchanged = 0;

  for (const tour of tours) {
    const sourceId = String(tour?.id ?? '');
    const sourceSlug = String(tour?.slug || '');
    const title = decodeHtml(tour?.title?.rendered);
    const baseSlug = slugify(title) || `experiencia-${sourceId}`;

    let canonicalSlug = baseSlug;
    if (reservedSlugs.has(canonicalSlug)) canonicalSlug = `${baseSlug}-${sourceId}`;
    reservedSlugs.add(canonicalSlug);

    const experience = await prisma.experience.findUnique({
      where: {
        sourceProvider_sourceId: {
          sourceProvider: 'WORDPRESS',
          sourceId,
        },
      },
      select: { id: true, slug: true },
    });

    if (!experience) continue;
    if (experience.slug === canonicalSlug) {
      unchanged += 1;
      continue;
    }

    await prisma.experience.update({
      where: { id: experience.id },
      data: { slug: canonicalSlug },
    });

    console.log(`${sourceId}: ${sourceSlug} -> ${canonicalSlug}`);
    updated += 1;
  }

  console.log(`Canonicalized ${updated} WordPress experience slugs; ${unchanged} were already canonical.`);
  console.log('Original WordPress slugs remain preserved in provenanceJson and sourceUrl.');
} finally {
  await prisma.$disconnect();
}
