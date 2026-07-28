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
const mediaPath = join(process.cwd(), 'data', 'wordpress', 'authenticated', 'tour-featured-media.json');
const toursPath = join(process.cwd(), 'data', 'wordpress', 'raw', 'tf_tours.json');

try {
  const [mediaPayload, toursPayload] = await Promise.all([
    readFile(mediaPath, 'utf8').then(JSON.parse),
    readFile(toursPath, 'utf8').then(JSON.parse),
  ]);

  const mediaRows = Array.isArray(mediaPayload) ? mediaPayload : [];
  const tours = Array.isArray(toursPayload?.rows) ? toursPayload.rows : [];
  const mediaById = new Map(mediaRows.filter(row => row?.ok && row?.id && row?.source_url).map(row => [Number(row.id), row]));

  let imported = 0;
  let linked = 0;
  let missingEvidence = 0;

  for (const tour of tours) {
    const mediaId = Number(tour?.featured_media || 0);
    if (!mediaId) continue;

    const media = mediaById.get(mediaId);
    if (!media) {
      missingEvidence += 1;
      continue;
    }

    const mediaAsset = await prisma.mediaAsset.upsert({
      where: {
        sourceProvider_sourceId: {
          sourceProvider: 'WORDPRESS',
          sourceId: String(mediaId),
        },
      },
      create: {
        id: `wp-media-${mediaId}`,
        sourceProvider: 'WORDPRESS',
        sourceId: String(mediaId),
        sourceUrl: media.link || media.source_url,
        storageKey: `wordpress/source/${mediaId}`,
        publicUrl: media.source_url,
        fileName: media.file?.split('/').pop() || null,
        mimeType: media.mime_type || null,
        altText: media.alt_text || null,
        width: media.width || null,
        height: media.height || null,
        provenanceJson: {
          recovery: 'authenticated-wordpress-api',
          evidenceFile: 'data/wordpress/authenticated/tour-featured-media.json',
          raw: media,
        },
      },
      update: {
        sourceUrl: media.link || media.source_url,
        publicUrl: media.source_url,
        fileName: media.file?.split('/').pop() || null,
        mimeType: media.mime_type || null,
        altText: media.alt_text || null,
        width: media.width || null,
        height: media.height || null,
        provenanceJson: {
          recovery: 'authenticated-wordpress-api',
          evidenceFile: 'data/wordpress/authenticated/tour-featured-media.json',
          raw: media,
        },
      },
      select: { id: true },
    });
    imported += 1;

    const experience = await prisma.experience.findUnique({
      where: {
        sourceProvider_sourceId: {
          sourceProvider: 'WORDPRESS',
          sourceId: String(tour.id),
        },
      },
      select: { id: true },
    });

    if (!experience) continue;
    await prisma.experience.update({
      where: { id: experience.id },
      data: { featuredMediaId: mediaAsset.id },
    });
    linked += 1;
  }

  console.log(`Imported ${imported} authenticated WordPress media records.`);
  console.log(`Linked ${linked} experiences to authenticated featured media.`);
  if (missingEvidence) console.warn(`${missingEvidence} tour media references were missing from authenticated evidence.`);
} finally {
  await prisma.$disconnect();
}
