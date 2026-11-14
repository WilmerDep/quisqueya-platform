import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { applyLabels, inspectLabels, PACKAGE_LABELS } from './label-altos-family-u2.mjs';
import { buildPreview, PACKAGES, PARENT_ID } from './preview-altos-family-u0.mjs';

const clone = value => JSON.parse(JSON.stringify(value));

const first = JSON.parse(await readFile(new URL(
  '../data/content/client-experiences-2026-09.seed.json', import.meta.url), 'utf8'));
const second = JSON.parse(await readFile(new URL(
  '../data/content/client-experiences-2026-09-second-part.seed.json', import.meta.url), 'utf8'));
const preview = buildPreview(first, second);

function fakeDatabase(options = {}) {
  const children = PACKAGES.map(item => ({
    slug: item.slug,
    id: item.id ?? 'existing-wordpress-id',
    status: item.provider === 'WORDPRESS' ? 'PUBLISHED' : 'DRAFT',
    sourceProvider: item.provider,
    pricingMode: 'FIXED',
    pricingJson: item.id ? { currency: 'USD', basis: 'person', adult: item.adult, child: item.child } : null,
    title: item.slug,
    featuredMediaId: 'existing-media',
  }));
  const state = {
    children,
    parent: options.parent === undefined ? clone(preview.parent) : options.parent,
    relation: options.relation === undefined ? [{ destinationId: 'la-romana-db-id', isPrimary: true }] : options.relation,
    otherParents: options.otherParents ?? [],
    writes: [],
    transactions: 0,
  };
  if (options.labelOverrides && state.parent) {
    state.parent.displayJson.experiencePackageLabels = options.labelOverrides;
  }
  if (options.changeChild) Object.assign(children[0], options.changeChild);
  const prisma = {
    experience: {
      async findMany({ where } = {}) {
        const rows = [...state.children, ...(state.parent ? [state.parent] : [])];
        return where?.slug?.in ? rows.filter(row => where.slug.in.includes(row.slug)) :
          [...rows, ...state.otherParents].map(row => ({ slug: row.slug, displayJson: row.displayJson }));
      },
      async findUnique({ where }) {
        return where.slug ? state.parent?.slug === where.slug ? state.parent : null :
          state.parent?.id === where.id ? state.parent : null;
      },
      async update({ where, data }) {
        assert.deepEqual(where, { id: PARENT_ID });
        assert.deepEqual(Object.keys(data), ['displayJson']);
        state.writes.push({ where, data });
        state.parent.displayJson = clone(data.displayJson);
        return state.parent;
      },
      async create() { throw new Error('create forbidden'); },
      async delete() { throw new Error('delete forbidden'); },
    },
    destination: {
      async findUnique() { return { id: 'la-romana-db-id', slug: 'la-romana', status: 'PUBLISHED' }; },
    },
    experienceDestination: {
      async findMany() { return state.relation; },
      async create() { throw new Error('relation write forbidden'); },
    },
    async $transaction(callback) {
      state.transactions++;
      const previous = clone(state.parent);
      try { return await callback(prisma); }
      catch (error) {
        state.parent = previous;
        state.writes = [];
        throw error;
      }
    },
  };
  return { prisma, state };
}

test('preflight verifies four approved labels and performs no writes', async () => {
  const { prisma, state } = fakeDatabase();
  const inspection = await inspectLabels(prisma, preview);
  assert.equal(inspection.operation, 'ADD_PRESENTATION_LABELS');
  assert.equal(inspection.packageCount, 4);
  assert.deepEqual(Object.keys(inspection.labels), PACKAGES.map(item => item.slug));
  assert(inspection.labels[PACKAGES[3].slug].startsWith('Altos de Chavón'));
  assert.equal(state.writes.length, 0);
});

test('updates only draft parent displayJson and repeats without writing', async () => {
  const { prisma, state } = fakeDatabase();
  const originalChildren = clone(state.children);
  const originalFamily = clone(state.parent.displayJson.experienceFamily);

  const applied = await applyLabels(prisma, preview);
  assert.equal(applied.operation, 'ADD_PRESENTATION_LABELS');
  assert.equal(applied.writesPerformed, true);
  assert.equal(state.writes.length, 1);
  assert.equal(state.transactions, 1);
  assert.deepEqual(state.children, originalChildren);
  assert.deepEqual(state.parent.displayJson.experienceFamily, originalFamily);
  assert.deepEqual(state.parent.displayJson.experiencePackageLabels, PACKAGE_LABELS);
  assert.equal(state.parent.status, 'DRAFT');

  // Simulate JSON key reordering during a database round-trip.
  state.parent.displayJson.experiencePackageLabels = Object.fromEntries(
    Object.entries(PACKAGE_LABELS).reverse(),
  );
  const repeated = await applyLabels(prisma, preview);
  assert.equal(repeated.operation, 'NOOP_LABELS_READY');
  assert.equal(repeated.writesPerformed, false);
  assert.equal(state.writes.length, 1);
  assert.equal(state.transactions, 1);
});

test('refuses missing or published parent, conflicts and missing destination link', async () => {
  for (const options of [
    { parent: null },
    { parent: { ...preview.parent, status: 'PUBLISHED' } },
    { parent: { ...preview.parent, slug: 'different' } },
    { relation: [] },
    { labelOverrides: { [PACKAGES[0].slug]: 'Unexpected' } },
    { changeChild: { sourceProvider: 'WORDPRESS' } },
    { otherParents: [{ slug: 'another-parent', displayJson: {
      experienceFamily: { packageSlugs: [PACKAGES[3].slug] },
    } }] },
  ]) {
    const { prisma, state } = fakeDatabase(options);
    await assert.rejects(applyLabels(prisma, preview), /Altos U[12] safety stop/);
    assert.equal(state.writes.length, 0);
  }
});

test('CLI rejects unrelated flags without contacting the database', () => {
  const path = fileURLToPath(new URL('./label-altos-family-u2.mjs', import.meta.url));
  for (const args of [['--publish'], ['--database'], ['--apply', '--force']]) {
    const run = spawnSync(process.execPath, [path, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /usage: node scripts\/label-altos-family-u2.mjs/);
  }
});
