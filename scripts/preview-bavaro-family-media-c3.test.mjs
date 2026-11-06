import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  inspectDatabaseMedia,
  validateMediaManifest,
} from './preview-bavaro-family-media-c3.mjs';

const manifest = JSON.parse(await readFile(
  new URL('../data/content/bavaro-family-media-reviewed-c3-2026-11-05.json', import.meta.url), 'utf8',
));
const seed = JSON.parse(await readFile(
  new URL('../data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json', import.meta.url), 'utf8',
));

const files = manifest.experiences.flatMap(item => [item.featured, ...item.gallery]);
const assets = files.map((file, index) => ({
  id: `media-${index + 1}`,
  storageProvider: 'google-drive',
  storageKey: file.driveFileId,
  fileName: file.fileName,
}));
const experiences = manifest.experiences.map((item, index) => ({
  id: `exp-${index + 1}`,
  slug: item.slug,
  status: 'DRAFT',
  featuredMediaId: null,
  galleryMediaIds: [],
}));

test('acepta las 13 modalidades y las 44 fotos verificadas sin repetición', () => {
  const report = validateMediaManifest(manifest, seed);
  assert.equal(report.packages, 13);
  assert.equal(report.featured, 13);
  assert.equal(report.gallery, 31);
  assert.equal(report.uniqueDriveFiles, 44);
  assert.deepEqual(report.warnings, ['PARTY_BOAT_MEDIA_NOT_VERIFIED']);
});

test('se detiene si dos modalidades comparten una fotografía Drive', () => {
  const corrupted = structuredClone(manifest);
  corrupted.experiences[1].featured.driveFileId = corrupted.experiences[0].featured.driveFileId;
  corrupted.experiences[1].featured.sourceUrl = corrupted.experiences[0].featured.sourceUrl;
  assert.throws(() => validateMediaManifest(corrupted, seed), /IDs Drive repetidos/);
});

test('se detiene si se intenta incluir una fotografía descartada por Wilmer', () => {
  const corrupted = structuredClone(manifest);
  const omit = manifest.visualDuplicateReview.find(item => item.omit).omit;
  corrupted.experiences[0].gallery[0].fileName = omit;
  assert.throws(() => validateMediaManifest(corrupted, seed), /fotografía descartada/);
});

test('preflight informa faltantes sin generar enlaces ni modificar datos', () => {
  const report = inspectDatabaseMedia(manifest, experiences, assets.slice(0, 2));
  assert.equal(report.status, 'CHECKED_READ_ONLY');
  assert.equal(report.mediaAssetsFound, 2);
  assert.equal(report.missingAssets.length, 42);
  assert.equal(report.readyForReviewedDraftLinks, false);
  assert.deepEqual(report.proposedLinks, []);
  assert.equal(report.publicationApproved, false);
});

test('preflight propone las 13 asociaciones solo cuando existen los 44 assets', () => {
  const report = inspectDatabaseMedia(manifest, experiences, assets);
  assert.equal(report.readyForReviewedDraftLinks, true);
  assert.equal(report.proposedLinks.length, 13);
  assert.equal(report.proposedLinks.reduce((sum, row) => sum + 1 + row.galleryMediaIds.length, 0), 44);
  assert.deepEqual(report.blockReasons, []);
});

test('bloquea si una experiencia no está DRAFT o su galería previa difiere', () => {
  const rows = structuredClone(experiences);
  rows[0].status = 'PUBLISHED';
  rows[1].galleryMediaIds = ['approved-existing-id'];
  const report = inspectDatabaseMedia(manifest, rows, assets);
  assert.equal(report.readyForReviewedDraftLinks, false);
  assert.deepEqual(report.blockReasons, ['NON_DRAFT_EXPERIENCES', 'EXISTING_MEDIA_RELATIONS_REQUIRE_REVIEW']);
  assert.equal(report.conflicts[0].slug, rows[1].slug);
  assert.equal(report.proposedLinks.length, 0);
});
