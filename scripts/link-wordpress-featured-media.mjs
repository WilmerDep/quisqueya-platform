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

try {
  const payload = JSON.parse(await readFile(rawPath, 'utf8'));
  const tours = Array.isArray(payload?.rows) ? payload.rows : [];

  let linked = 0;
  let missingMedia = 0;
  let withoutFeaturedMedia = 0;

  for (const tour of tours) {
    const sourceId = String(tour?.id ?? '');
    const featuredMediaSourceId = Number(tour?.featured_media || 0);

    if (!sourceId || !featuredMediaSourceId) {
      withoutFeaturedMedia += 1;
      continue;
    }

    const [experience, media] = await Promise.all([
      prisma.experience.findUnique({
        where: {
          sourceProvider_sourceId: {
            sourceProvider: 'WORDPRESS',
            sourceId,
          },
        },
        select: { id: true },
      }),
      prisma.mediaAsset.findUnique({
        where: {
          sourceProvider_sourceId: {
            sourceProvider: 'WORDPRESS',
            sourceId: String(featuredMediaSourceId),
          },
        },
        select: { id: true },
      }),
    ]);

    if (!experience) continue;
    if (!media) {
      missingMedia += 1;
      continue;
    }

    await prisma.experience.update({
      where: { id: experience.id },
      data: { featuredMediaId: media.id },
    });
    linked += 1;
  }

  console.log(`Linked ${linked} WordPress featured media records from numeric featured_media IDs.`);
  if (missingMedia) console.warn(`${missingMedia} tours reference media IDs that were not present in the imported media collection.`);
  if (withoutFeaturedMedia) console.log(`${withoutFeaturedMedia} tours do not declare a numeric featured_media ID.`);
} finally {
  await prisma.$disconnect();
}
