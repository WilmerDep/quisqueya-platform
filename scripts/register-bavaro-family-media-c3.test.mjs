import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  registerAndLinkReviewedMedia,
  validateDriveSelection,
} from './register-bavaro-family-media-c3.mjs';

const manifest = JSON.parse(await readFile(
  new URL('../data/content/bavaro-family-media-reviewed-c3-2026-11-05.json', import.meta.url), 'utf8',
));
const files = manifest.experiences.flatMap(item => [item.featured, ...item.gallery]);
const metadata = files.map(file => ({
  id: file.driveFileId,
  name: file.fileName.replace(/\.webp$/, '.jpg'),
  mimeType: 'image/jpeg',
  size: '10000',
  md5Checksum: 'abcd',
  parents: ['folder-bavaro'],
  insideRoot: true,
  trashed: false,
}));
const verified = validateDriveSelection(manifest, metadata);

function fakeDatabase({ published = false, legacy = false, failOnUpdate = false, withExisting = false } = {}) {
  const initial = manifest.experiences.map((item, index) => ({
    id: `exp-${index + 1}`,
    slug: item.slug,
    status: published && index === 0 ? 'PUBLISHED' : 'DRAFT',
    updatedAt: new Date('2026-11-05T00:00:00.000Z'),
    featuredMediaId: legacy && index === 0 ? 'old-id' : null,
    galleryMediaIds: [],
  }));
  const state = {
    experiences: initial,
    assets: [],
  };
  const getState = () => structuredClone(state);

  function txFor(copy) {
    return {
      experience: {
        async findUnique() { return { slug: manifest.familySlug, status: 'DRAFT' }; },
        async findMany() { return copy.experiences; },
        async updateMany({ where, data }) {
          if (failOnUpdate) return { count: 0 };
          const row = copy.experiences.find(item => item.id === where.id && item.status === where.status &&
            item.updatedAt.getTime() === where.updatedAt.getTime());
          if (!row) return { count: 0 };
          Object.assign(row, structuredClone(data));
          row.updatedAt = new Date(row.updatedAt.getTime() + 1000);
          return { count: 1 };
        },
      },
      mediaAsset: {
        async findMany() { return copy.assets; },
        async create({ data }) {
          if (copy.assets.some(item => item.storageKey === data.storageKey)) throw Error('duplicate asset');
          const row = structuredClone(data);
          copy.assets.push(row);
          return row;
        },
      },
    };
  }

  const db = {
    async $transaction(fn) {
      const copy = getState();
      const result = await fn(txFor(copy));
      state.assets = copy.assets;
      state.experiences = copy.experiences;
      return result;
    },
  };
  if (withExisting) state.assets.push({
    id: 'external-asset', storageProvider: 'google-drive', storageKey: files[0].driveFileId,
    fileName: files[0].fileName,
    provenanceJson: { registeredFrom: 'another-importer' },
  });
  return { db, getState };
}

test('acepta 44 originales de Drive con nombres distintos de las etiquetas .webp', () => {
  assert.equal(verified.imageCount, 44);
  assert.deepEqual(verified.formats, ['image/jpeg']);
});

test('rechaza imágenes ausentes, fuera del árbol o que no sean imágenes', () => {
  assert.throws(() => validateDriveSelection(manifest, metadata.slice(1)), /44 IDs/);
  const outside = structuredClone(metadata);
  outside[0].insideRoot = false;
  assert.throws(() => validateDriveSelection(manifest, outside), /fuera de PAGINA WEB/);
  const pdf = structuredClone(metadata);
  pdf[0].mimeType = 'application/pdf';
  assert.throws(() => validateDriveSelection(manifest, pdf), /formato de imagen/);
});

test('registra 44 referencias y enlaza 13 modalidades DRAFT sin modificar contenido comercial', async () => {
  const { db, getState } = fakeDatabase();
  const result = await registerAndLinkReviewedMedia(db, manifest, verified);
  assert.deepEqual(result, {
    createdAssets: 44, reusedAssets: 0, linkedExperiences: 13, unchangedExperiences: 0,
    familyStatus: 'DRAFT', publicationApproved: false,
  });
  const state = getState();
  assert.equal(state.assets.length, 44);
  assert.equal(state.experiences.filter(item => item.featuredMediaId && item.galleryMediaIds.length).length, 13);
  assert.ok(state.assets.every(item => item.publicUrl.includes('/api/v1/media/') &&
    item.provenanceJson.reviewedFileName.endsWith('.webp') && item.mimeType === 'image/jpeg'));
  assert.ok(state.experiences.every(item => item.status === 'DRAFT'));
});

test('una segunda ejecución conserva los 44 assets y las 13 relaciones sin duplicar', async () => {
  const { db, getState } = fakeDatabase();
  await registerAndLinkReviewedMedia(db, manifest, verified);
  const second = await registerAndLinkReviewedMedia(db, manifest, verified);
  assert.equal(second.createdAssets, 0);
  assert.equal(second.reusedAssets, 44);
  assert.equal(second.linkedExperiences, 0);
  assert.equal(second.unchangedExperiences, 13);
  assert.equal(getState().assets.length, 44);
});

test('bloquea modalidades publicadas, relaciones antiguas y assets ajenos sin escribir', async () => {
  for (const options of [{ published: true }, { legacy: true }, { withExisting: true }]) {
    const { db, getState } = fakeDatabase(options);
    const before = getState();
    await assert.rejects(registerAndLinkReviewedMedia(db, manifest, verified), /C3 media safety stop/);
    assert.deepEqual(getState(), before);
  }
});

test('error concurrente revierte todo el lote: no quedan assets huérfanos', async () => {
  const { db, getState } = fakeDatabase({ failOnUpdate: true });
  await assert.rejects(registerAndLinkReviewedMedia(db, manifest, verified), /modalidad cambió/);
  assert.equal(getState().assets.length, 0);
  assert.ok(getState().experiences.every(item => item.featuredMediaId === null));
});
