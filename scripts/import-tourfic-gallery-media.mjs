import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const baseUrl = String(process.env.WP_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  throw new Error('Missing WP_BASE_URL. Example: $env:WP_BASE_URL="https://quisqueyatravel.com.do"');
}

const metadataPath = resolve(
  process.cwd(),
  process.env.TOURFIC_METADATA_PATH || 'data/content/wordpress-tourfic-authenticated-metadata.json',
);
const evidencePath = resolve(
  process.cwd(),
  process.env.TOURFIC_GALLERY_EVIDENCE_PATH || 'data/wordpress/authenticated/tour-gallery-media.json',
);

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quisqueya_core',
  connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
});
const prisma = new PrismaClient({ adapter });

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

async function readEvidence() {
  try {
    const payload = JSON.parse(await readFile(evidencePath, 'utf8'));
    const rows = Array.isArray(payload?.media) ? payload.media.filter(item => item?.ok) : [];
    return new Map(rows.map(item => [Number(item.id), item]));
  } catch (error) {
    if (error?.code === 'ENOENT') return new Map();
    throw error;
  }
}

async function fetchMedia(mediaId) {
  const url = `${baseUrl}/wp-json/wp/v2/media/${mediaId}?context=view`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    return {
      ok: false,
      mediaId,
      status: response.status,
      reason: `${response.status} ${response.statusText}`,
      endpoint: url,
    };
  }

  const row = await response.json();
  if (!row?.id || !row?.source_url) {
    return {
      ok: false,
      mediaId,
      status: response.status,
      reason: 'WordPress response did not contain id/source_url.',
      endpoint: url,
    };
  }

  return { ok: true, row, endpoint: url, recovery: 'tourfic-gallery-wordpress-api' };
}

function normalizeEvidenceRow(item) {
  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
  return {
    ...raw,
    id: Number(item.id),
    link: item.link || raw.link || null,
    source_url: item.source_url || raw.source_url || null,
    mime_type: item.mime_type || raw.mime_type || null,
    alt_text: item.alt_text ?? raw.alt_text ?? '',
    caption: raw.caption || { raw: item.caption || '', rendered: item.caption || '' },
    media_details: {
      ...(raw.media_details || {}),
      file: item.file || raw.media_details?.file || null,
      width: item.width || raw.media_details?.width || null,
      height: item.height || raw.media_details?.height || null,
      filesize: item.filesize || raw.media_details?.filesize || null,
    },
  };
}

async function upsertMedia(row, provenance) {
  const mediaId = Number(row.id);
  return prisma.mediaAsset.upsert({
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
      sourceUrl: row.link || row.source_url,
      storageKey: `wordpress/source/${mediaId}`,
      publicUrl: row.source_url,
      fileName: row.media_details?.file?.split('/').pop() || null,
      mimeType: row.mime_type || null,
      altText: row.alt_text || null,
      caption: decodeHtml(row.caption?.raw || row.caption?.rendered) || null,
      width: row.media_details?.width || null,
      height: row.media_details?.height || null,
      sizeBytes: row.media_details?.filesize ? BigInt(row.media_details.filesize) : null,
      provenanceJson: provenance,
    },
    update: {
      sourceUrl: row.link || row.source_url,
      publicUrl: row.source_url,
      fileName: row.media_details?.file?.split('/').pop() || null,
      mimeType: row.mime_type || null,
      altText: row.alt_text || null,
      caption: decodeHtml(row.caption?.raw || row.caption?.rendered) || null,
      width: row.media_details?.width || null,
      height: row.media_details?.height || null,
      sizeBytes: row.media_details?.filesize ? BigInt(row.media_details.filesize) : null,
      provenanceJson: provenance,
    },
    select: { id: true, sourceId: true },
  });
}

async function main() {
  const payload = JSON.parse(await readFile(metadataPath, 'utf8'));
  const tours = Array.isArray(payload?.tours) ? payload.tours.filter(item => item?.ok) : [];
  if (!tours.length) throw new Error(`No successful tours found in ${metadataPath}`);

  const evidenceById = await readEvidence();
  const referencedIds = [...new Set(
    tours.flatMap(tour => Array.isArray(tour.galleryMediaIds) ? tour.galleryMediaIds : [])
      .map(Number)
      .filter(Number.isFinite),
  )].sort((a, b) => a - b);

  const existing = await prisma.mediaAsset.findMany({
    where: {
      sourceProvider: 'WORDPRESS',
      sourceId: { in: referencedIds.map(String) },
    },
    select: { sourceId: true },
  });
  const existingIds = new Set(existing.map(row => Number(row.sourceId)).filter(Number.isFinite));
  const missingIds = referencedIds.filter(mediaId => !existingIds.has(mediaId));

  let importedFromEvidence = 0;
  let importedFromPublicApi = 0;
  const unresolved = [];

  for (const [index, mediaId] of missingIds.entries()) {
    console.log(`[${index + 1}/${missingIds.length}] Resolving WordPress media ${mediaId}...`);

    const evidence = evidenceById.get(mediaId);
    if (evidence) {
      const row = normalizeEvidenceRow(evidence);
      if (!row.source_url) {
        unresolved.push({ mediaId, reason: 'Authenticated evidence did not contain source_url.' });
        continue;
      }
      await upsertMedia(row, {
        recovery: 'tourfic-gallery-authenticated-evidence',
        evidenceFile: 'data/wordpress/authenticated/tour-gallery-media.json',
        raw: row,
      });
      importedFromEvidence += 1;
      continue;
    }

    try {
      const result = await fetchMedia(mediaId);
      if (!result.ok) {
        unresolved.push(result);
        continue;
      }
      await upsertMedia(result.row, {
        recovery: result.recovery,
        evidenceEndpoint: result.endpoint,
        raw: result.row,
      });
      importedFromPublicApi += 1;
    } catch (error) {
      unresolved.push({
        mediaId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const resolvedCount = referencedIds.length - unresolved.length;
  console.log(`Tourfic galleries reference ${referencedIds.length} unique WordPress media records.`);
  console.log(`${existingIds.size} were already present.`);
  console.log(`${importedFromEvidence} were imported from authenticated evidence.`);
  console.log(`${importedFromPublicApi} were imported from the public WordPress API.`);
  console.log(`${resolvedCount}/${referencedIds.length} gallery media references are now resolvable.`);

  if (unresolved.length) {
    console.warn('Unresolved gallery media:');
    for (const item of unresolved) console.warn(`- ${item.mediaId}: ${item.reason}`);
    process.exitCode = 2;
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
