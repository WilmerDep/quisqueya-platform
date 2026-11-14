/**
 * C3: registrar enlaces a fotografías existentes en Google Drive y asociarlas
 * con las 13 modalidades DRAFT, sin descargar, convertir ni mover archivos.
 *
 * Solo lectura: node --env-file=.env.local scripts/register-bavaro-family-media-c3.mjs --verify-drive
 * Escritura local explícita: node --env-file=.env.local scripts/register-bavaro-family-media-c3.mjs --apply --confirm=BAVARO_C3_44_DRAFT_LOCAL
 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectDatabaseMedia, validateMediaManifest } from './preview-bavaro-family-media-c3.mjs';

const MANIFEST_PATH = 'data/content/bavaro-family-media-reviewed-c3-2026-11-05.json';
const SEED_PATH = 'data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files/';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_FIELDS = 'id,name,mimeType,webViewLink,trashed,size,md5Checksum,parents';
const CONFIRM = 'BAVARO_C3_44_DRAFT_LOCAL';

function stop(message) {
  throw new Error(`C3 media safety stop: ${message}`);
}

function requiredEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) stop(`falta configuración ${key}`);
  return value;
}

function allSelected(manifest) {
  return manifest.experiences.flatMap(item => [item.featured, ...item.gallery]);
}

export function validateDriveSelection(manifest, metadata) {
  const files = allSelected(manifest);
  const byId = new Map(metadata.map(item => [item.id, item]));
  if (byId.size !== 44 || metadata.length !== 44) stop('Drive debe confirmar exactamente 44 IDs distintos');
  for (const file of files) {
    const item = byId.get(file.driveFileId);
    if (!item) stop(`no se encontró la fotografía ${file.fileName}`);
    if (!item.insideRoot || item.trashed) stop(`archivo fuera de PAGINA WEB o en papelera: ${file.fileName}`);
    if (!/^image\/(jpeg|png|webp|avif)$/.test(item.mimeType ?? '')) {
      stop(`formato de imagen no compatible: ${file.fileName}`);
    }
    if (!item.name || typeof item.name !== 'string') stop(`sin nombre original: ${file.fileName}`);
    if (item.size !== undefined && !/^\d+$/.test(String(item.size))) stop(`tamaño inválido: ${file.fileName}`);
  }
  return { imageCount: 44, files, byId, formats: [...new Set(metadata.map(item => item.mimeType))] };
}

function assertLocalDatabase() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  if (process.env.NODE_ENV !== 'development' || !['127.0.0.1', 'localhost', '::1'].includes(host) ||
      (process.env.MYSQL_DATABASE || 'quisqueya_core') !== 'quisqueya_core' ||
      ['production', 'staging'].includes((process.env.APP_ENV || '').toLowerCase())) {
    stop('la escritura C3 solo está autorizada contra quisqueya_core en MySQL local/development');
  }
}

function safeProxyUrl(id) {
  const origin = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const path = `/api/v1/media/${encodeURIComponent(id)}/content`;
  return origin ? `${origin}${path}` : path;
}

async function fetchDriveSelection(manifest, fetcher = fetch) {
  if (requiredEnv('STORAGE_PROVIDER').toLowerCase() !== 'google-drive') {
    stop('STORAGE_PROVIDER debe ser google-drive para usar la API de imágenes');
  }
  const rootId = requiredEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID');
  const form = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_DRIVE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_DRIVE_CLIENT_SECRET'),
    refresh_token: requiredEnv('GOOGLE_DRIVE_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  });
  const tokenResponse = await fetcher(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (!tokenResponse.ok) stop('Google OAuth no permitió renovar el acceso (verificar configuración)');
  const token = (await tokenResponse.json()).access_token;
  if (!token) stop('Google OAuth no devolvió access_token');

  const cache = new Map();
  async function metadata(id) {
    if (!cache.has(id)) cache.set(id, (async () => {
      const params = new URLSearchParams({ fields: GOOGLE_FIELDS, supportsAllDrives: 'true' });
      const response = await fetcher(`${DRIVE_FILES}${encodeURIComponent(id)}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) stop(`no se pudo leer metadatos Drive (HTTP ${response.status}) para ${id}`);
      const item = await response.json();
      if (item.id !== id) stop('Drive devolvió un ID distinto al solicitado');
      return item;
    })());
    return cache.get(id);
  }

  async function withinRoot(id, seen = new Set()) {
    if (id === rootId) return true;
    if (seen.has(id)) stop('ciclo detectado en carpetas Drive');
    const nextSeen = new Set([...seen, id]);
    const parent = await metadata(id);
    if (parent.trashed) return false;
    for (const parentId of parent.parents ?? []) {
      if (await withinRoot(parentId, nextSeen)) return true;
    }
    return false;
  }

  const files = allSelected(manifest);
  const confirmed = [];
  // Concurrencia moderada: evita 44 renovaciones OAuth y respeta cuotas Drive.
  for (let start = 0; start < files.length; start += 4) {
    confirmed.push(...await Promise.all(files.slice(start, start + 4).map(async file => {
      const item = await metadata(file.driveFileId);
      return { ...item, insideRoot: await withinRoot(file.driveFileId) };
    })));
  }
  return validateDriveSelection(manifest, confirmed);
}

function sameIds(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Cambios atómicos: si una asociación falla, tampoco quedan altas huérfanas. */
export async function registerAndLinkReviewedMedia(prisma, manifest, verified, now = new Date()) {
  validateDriveSelection(manifest, [...verified.byId.values()]);
  return prisma.$transaction(async tx => {
    const slugs = manifest.experiences.map(item => item.slug);
    const driveIds = allSelected(manifest).map(item => item.driveFileId);
    const [parent, experiences, assets] = await Promise.all([
      tx.experience.findUnique({ where: { slug: manifest.familySlug }, select: { slug: true, status: true } }),
      tx.experience.findMany({ where: { slug: { in: slugs } }, select: {
        id: true, slug: true, status: true, updatedAt: true, featuredMediaId: true, galleryMediaIds: true,
      } }),
      tx.mediaAsset.findMany({ where: { storageProvider: 'google-drive', storageKey: { in: driveIds } } }),
    ]);
    if (parent?.status !== 'DRAFT') stop('experiencia padre ausente o distinta de DRAFT');
    const preflight = inspectDatabaseMedia(manifest, experiences, assets);
    const blockers = preflight.blockReasons.filter(reason => reason !== 'MEDIA_ASSETS_NOT_REGISTERED');
    if (blockers.length) stop(`preflight bloqueado: ${blockers.join(', ')}`);

    const known = new Map(assets.map(item => [item.storageKey, item]));
    let createdAssets = 0;
    let reusedAssets = 0;
    for (const file of allSelected(manifest)) {
      const old = known.get(file.driveFileId);
      if (old) {
        if (old.provenanceJson?.registeredFrom !== 'bavaro-family-c3-reviewed' ||
            old.provenanceJson?.reviewedFileName !== file.fileName) {
          stop(`asset existente requiere revisión: ${file.fileName}`);
        }
        reusedAssets++;
        continue;
      }
      const meta = verified.byId.get(file.driveFileId);
      const id = randomUUID();
      const row = await tx.mediaAsset.create({ data: {
        id, sourceProvider: 'MANUAL', sourceUrl: file.sourceUrl,
        storageProvider: 'google-drive', storageKey: file.driveFileId,
        publicUrl: safeProxyUrl(id), fileName: meta.name,
        mimeType: meta.mimeType, sizeBytes: meta.size === undefined ? null : BigInt(meta.size),
        checksum: meta.md5Checksum || null,
        storageMetadataJson: {
          webViewLink: meta.webViewLink || null, trashed: false, parents: meta.parents ?? [],
        },
        provenanceJson: {
          registeredFrom: 'bavaro-family-c3-reviewed', registeredAt: now.toISOString(),
          reviewedFileName: file.fileName, sourceFolder: file.sourceFolder,
          manifest: MANIFEST_PATH, provider: 'google-drive',
        },
      } });
      known.set(file.driveFileId, row);
      createdAssets++;
    }

    const postflight = inspectDatabaseMedia(manifest, experiences, [...known.values()]);
    if (!postflight.readyForReviewedDraftLinks) {
      stop(`asociación bloqueada: ${postflight.blockReasons.join(', ')}`);
    }
    let linkedExperiences = 0;
    let unchangedExperiences = 0;
    for (const link of postflight.proposedLinks) {
      const old = experiences.find(item => item.id === link.experienceId);
      const existingGallery = Array.isArray(old.galleryMediaIds) ? old.galleryMediaIds : [];
      if (old.featuredMediaId === link.featuredMediaId && sameIds(existingGallery, link.galleryMediaIds)) {
        unchangedExperiences++;
        continue;
      }
      // El updatedAt protege frente a modificaciones concurrentes del editor.
      const updated = await tx.experience.updateMany({
        where: { id: old.id, status: 'DRAFT', updatedAt: old.updatedAt },
        data: { featuredMediaId: link.featuredMediaId, galleryMediaIds: link.galleryMediaIds },
      });
      if (updated.count !== 1) stop(`la modalidad cambió durante la operación: ${link.slug}`);
      linkedExperiences++;
    }
    return {
      createdAssets, reusedAssets, linkedExperiences, unchangedExperiences,
      familyStatus: 'DRAFT', publicationApproved: false,
    };
  }, { maxWait: 10000, timeout: 60000 });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.length === 1 && args[0] === '--verify-drive';
  const apply = args.length === 2 && args.includes('--apply') && args.includes(`--confirm=${CONFIRM}`);
  if (!dryRun && !apply) {
    console.error(`Uso: --verify-drive (solo lectura) | --apply --confirm=${CONFIRM} (MySQL local)`);
    process.exitCode = 2;
    return;
  }
  const [manifest, seed] = await Promise.all([
    readFile(resolve(MANIFEST_PATH), 'utf8').then(JSON.parse),
    readFile(resolve(SEED_PATH), 'utf8').then(JSON.parse),
  ]);
  const checks = validateMediaManifest(manifest, seed);
  if (apply) assertLocalDatabase();
  const verified = await fetchDriveSelection(manifest);
  const report = {
    mode: dryRun ? 'google-drive-read-only' : 'local-database-apply',
    checks,
    drive: { status: 'VERIFIED', files: verified.imageCount, formats: verified.formats, rootValidated: true },
    writesPerformed: false,
  };
  if (apply) {
    const [{ PrismaClient }, { PrismaMariaDb }, { default: mariadb }] = await Promise.all([
      import('@prisma/client'), import('@prisma/adapter-mariadb'), import('mariadb'),
    ]);
    const password = process.env.MYSQL_PASSWORD || '';
    const pool = mariadb.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root', ...(password ? { password } : {}),
      database: 'quisqueya_core', connectionLimit: 2, prepareCacheLength: 0,
      ...(!password ? { allowPublicKeyRetrieval: true } : {}),
    });
    const prisma = new PrismaClient({ adapter: new PrismaMariaDb(pool) });
    try {
      report.database = await registerAndLinkReviewedMedia(prisma, manifest, verified);
      report.writesPerformed = true;
    } finally {
      try { await prisma.$disconnect(); } finally { await pool.end(); }
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) {
    // No imprimir tokens, contraseñas, respuestas OAuth ni URLs de secretos.
    console.error(error?.message?.startsWith('C3 media safety stop:')
      ? error.message : `C3 media failed: ${error?.code || error?.name || 'UNKNOWN'}`);
    process.exitCode = 1;
  }
}
