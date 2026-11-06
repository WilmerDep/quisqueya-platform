/**
 * C3: preflight de solo lectura para las 44 imágenes editoriales de Bávaro.
 *
 * node scripts/preview-bavaro-family-media-c3.mjs
 * node --env-file=.env.local scripts/preview-bavaro-family-media-c3.mjs --database
 *
 * No tiene modo de escritura: no registra MediaAsset ni enlaza experiencias.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = 'data/content/bavaro-family-media-reviewed-c3-2026-11-05.json';
const SEED = 'data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json';

function assert(condition, message) {
  if (!condition) throw new Error(`C3 media safety stop: ${message}`);
}

export function validateMediaManifest(manifest, seed) {
  assert(manifest?.schemaVersion === 'qt-bavaro-family-media-c3-reviewed-1', 'schemaVersion desconocida');
  assert(manifest.familySlug === 'bavaro-adventure-park', 'familia inesperada');
  assert(manifest.review?.status === 'EDITORIALLY_APPROVED_NOT_APPLIED', 'selección no aprobada');
  assert(Array.isArray(manifest.experiences) && manifest.experiences.length === 13, 'se requieren 13 modalidades');
  assert(Array.isArray(seed?.experiences) && seed.experiences.length === 13, 'semilla editorial inválida');

  const seedSlugs = new Set(seed.experiences.map(item => item.slug));
  const selectionSlugs = manifest.experiences.map(item => item.slug);
  assert(new Set(selectionSlugs).size === 13 && selectionSlugs.every(slug => seedSlugs.has(slug)),
    'las modalidades deben coincidir con la semilla editorial');

  const media = [];
  for (const experience of manifest.experiences) {
    assert(experience.featured && Array.isArray(experience.gallery), `${experience.slug}: falta portada o galería`);
    assert(experience.gallery.length > 0, `${experience.slug}: galería sin candidatos`);
    media.push(experience.featured, ...experience.gallery);
  }
  assert(media.length === 44, 'la selección aprobada contiene exactamente 44 fotografías');

  const fileIds = media.map(item => item.driveFileId);
  const fileNames = media.map(item => item.fileName);
  assert(fileIds.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)), 'ID Drive inválido');
  assert(fileNames.every(name => typeof name === 'string' && /^[a-z0-9-]+\.webp$/.test(name)), 'nombre o formato inválido');
  assert(media.every(item => typeof item.sourceFolder === 'string' && item.sourceFolder.trim() &&
    typeof item.sourceUrl === 'string' &&
    item.sourceUrl.startsWith(`https://drive.google.com/file/d/${item.driveFileId}/`)),
  'falta trazabilidad del archivo en Drive');
  assert(new Set(fileIds).size === 44, 'hay IDs Drive repetidos entre modalidades');
  assert(new Set(fileNames).size === 44, 'hay archivos repetidos entre modalidades');

  const omitted = (manifest.visualDuplicateReview ?? []).map(item => item.omit).filter(Boolean);
  assert(omitted.every(name => !fileNames.includes(name)), 'una fotografía descartada figura entre las 44');

  const partyBoat = manifest.experiences.find(item => item.slug === 'bavaro-adventure-park-buggy-party-boat');
  assert(partyBoat?.openIssue?.includes('PARTY_BOAT_MEDIA_NOT_VERIFIED'),
    'se debe mantener explícita la ausencia de fotografías verificadas de Party Boat');

  return {
    familySlug: manifest.familySlug,
    packages: selectionSlugs.length,
    featured: manifest.experiences.length,
    gallery: media.length - manifest.experiences.length,
    uniqueDriveFiles: new Set(fileIds).size,
    excludedNearDuplicates: omitted.length,
    warnings: ['PARTY_BOAT_MEDIA_NOT_VERIFIED'],
  };
}

export function inspectDatabaseMedia(manifest, experiences, assets) {
  const selected = manifest.experiences;
  const bySlug = new Map(experiences.map(item => [item.slug, item]));
  const allFiles = selected.flatMap(item => [item.featured, ...item.gallery]);
  const expectedKeys = new Set(allFiles.map(item => item.driveFileId));
  const assetsByKey = new Map();
  const duplicateStorageKeys = [];

  for (const asset of assets) {
    if (asset.storageProvider !== 'google-drive' || !expectedKeys.has(asset.storageKey)) continue;
    if (assetsByKey.has(asset.storageKey)) duplicateStorageKeys.push(asset.storageKey);
    else assetsByKey.set(asset.storageKey, asset);
  }

  const missingAssets = allFiles.filter(file => !assetsByKey.has(file.driveFileId))
    .map(file => ({ fileName: file.fileName, driveFileId: file.driveFileId }));
  const metadataMismatches = allFiles.flatMap(file => {
    const asset = assetsByKey.get(file.driveFileId);
    // Los nombres .webp del manifiesto son etiquetas editoriales. En Drive
    // el original puede ser JPEG/PNG; el importador conserva su nombre real.
    const reviewedName = asset?.provenanceJson?.reviewedFileName ?? asset?.fileName;
    return asset && reviewedName !== file.fileName
      ? [{ driveFileId: file.driveFileId, expectedFileName: file.fileName, foundFileName: reviewedName }]
      : [];
  });

  const missingExperiences = selected.filter(item => !bySlug.has(item.slug)).map(item => item.slug);
  const nonDraftExperiences = selected.filter(item => {
    const row = bySlug.get(item.slug);
    return row && row.status !== 'DRAFT';
  }).map(item => ({ slug: item.slug, status: bySlug.get(item.slug).status }));

  const conflicts = [];
  const proposedLinks = [];
  for (const item of selected) {
    const row = bySlug.get(item.slug);
    if (!row) continue;
    const featuredMediaId = assetsByKey.get(item.featured.driveFileId)?.id ?? null;
    const galleryMediaIds = item.gallery.map(file => assetsByKey.get(file.driveFileId)?.id ?? null);
    const existingGallery = Array.isArray(row.galleryMediaIds) ? row.galleryMediaIds : [];
    if (row.featuredMediaId && row.featuredMediaId !== featuredMediaId) {
      conflicts.push({ slug: item.slug, field: 'featuredMediaId', reason: 'EXISTING_FEATURED_MUST_BE_REVIEWED' });
    }
    if (existingGallery.length > 0 &&
        JSON.stringify(existingGallery) !== JSON.stringify(galleryMediaIds)) {
      conflicts.push({ slug: item.slug, field: 'galleryMediaIds', reason: 'EXISTING_GALLERY_MUST_BE_REVIEWED' });
    }
    proposedLinks.push({ slug: item.slug, experienceId: row.id, featuredMediaId, galleryMediaIds });
  }

  const blockReasons = [];
  if (missingAssets.length) blockReasons.push('MEDIA_ASSETS_NOT_REGISTERED');
  if (duplicateStorageKeys.length) blockReasons.push('DUPLICATE_STORAGE_KEYS');
  if (metadataMismatches.length) blockReasons.push('MEDIA_METADATA_MISMATCH');
  if (missingExperiences.length) blockReasons.push('MISSING_EXPERIENCES');
  if (nonDraftExperiences.length) blockReasons.push('NON_DRAFT_EXPERIENCES');
  if (conflicts.length) blockReasons.push('EXISTING_MEDIA_RELATIONS_REQUIRE_REVIEW');

  return {
    status: 'CHECKED_READ_ONLY',
    mediaAssetsFound: assetsByKey.size,
    mediaAssetsRequired: expectedKeys.size,
    missingAssets,
    duplicateStorageKeys,
    metadataMismatches,
    missingExperiences,
    nonDraftExperiences,
    conflicts,
    readyForReviewedDraftLinks: blockReasons.length === 0,
    blockReasons,
    proposedLinks: blockReasons.length === 0 ? proposedLinks : [],
    publicationApproved: false,
  };
}

async function run() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--database') || args.filter(arg => arg === '--database').length > 1) {
    console.error('Usage: node scripts/preview-bavaro-family-media-c3.mjs [--database]');
    process.exitCode = 2;
    return;
  }

  const [manifest, seed] = await Promise.all([
    readFile(resolve(MANIFEST), 'utf8').then(JSON.parse),
    readFile(resolve(SEED), 'utf8').then(JSON.parse),
  ]);
  const report = {
    mode: args.includes('--database') ? 'database-read-only' : 'manifest-only',
    writesPerformed: false,
    checks: validateMediaManifest(manifest, seed),
    database: { status: 'NOT_RUN' },
  };

  if (args.includes('--database')) {
    const [{ PrismaClient }, { PrismaMariaDb }, { default: mariadb }] = await Promise.all([
      import('@prisma/client'),
      import('@prisma/adapter-mariadb'),
      import('mariadb'),
    ]);
    const host = process.env.MYSQL_HOST || '127.0.0.1';
    const password = process.env.MYSQL_PASSWORD || '';
    const localDevelopment = process.env.NODE_ENV === 'development' &&
      ['127.0.0.1', 'localhost', '::1'].includes(host);
    const pool = mariadb.createPool({
      host,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      ...(password ? { password } : {}),
      database: process.env.MYSQL_DATABASE || 'quisqueya_core',
      connectionLimit: 2,
      prepareCacheLength: 0,
      ...(localDevelopment && !password ? { allowPublicKeyRetrieval: true } : {}),
    });
    const prisma = new PrismaClient({ adapter: new PrismaMariaDb(pool) });
    try {
      const slugs = manifest.experiences.map(item => item.slug);
      const driveIds = manifest.experiences.flatMap(item => [item.featured, ...item.gallery])
        .map(item => item.driveFileId);
      const [experiences, assets] = await Promise.all([
        prisma.experience.findMany({
          where: { slug: { in: slugs } },
          select: { id: true, slug: true, status: true, featuredMediaId: true, galleryMediaIds: true },
        }),
        prisma.mediaAsset.findMany({
          where: { storageProvider: 'google-drive', storageKey: { in: driveIds } },
          select: { id: true, storageProvider: true, storageKey: true, fileName: true, provenanceJson: true },
        }),
      ]);
      report.database = inspectDatabaseMedia(manifest, experiences, assets);
    } catch (error) {
      report.database = { status: 'DATABASE_READ_FAILED', code: error?.code || 'UNKNOWN' };
      process.exitCode = 1;
    } finally {
      try {
        await prisma.$disconnect();
      } finally {
        await pool.end();
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
