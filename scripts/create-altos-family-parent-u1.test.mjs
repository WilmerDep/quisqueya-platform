import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyParent, inspectPreparation } from './create-altos-family-parent-u1.mjs';
import { buildPreview, PACKAGES, PARENT_ID, PARENT_SLUG } from './preview-altos-family-u0.mjs';

const firstSeed = JSON.parse(await readFile(new URL(
  '../data/content/client-experiences-2026-09.seed.json', import.meta.url), 'utf8'));
const secondSeed = JSON.parse(await readFile(new URL(
  '../data/content/client-experiences-2026-09-second-part.seed.json', import.meta.url), 'utf8'));
const preview = buildPreview(firstSeed, secondSeed);

function fakeDatabase(options = {}) {
  const children = PACKAGES.map(item => ({
    id: item.id ?? 'wordpress-real-id-from-database',
    slug: item.slug,
    status: item.provider === 'WORDPRESS' ? 'PUBLISHED' : 'DRAFT',
    sourceProvider: item.provider,
    pricingMode: 'FIXED',
    pricingJson: item.provider === 'WORDPRESS' ? null : {
      currency: 'USD', basis: 'person', adult: item.adult, child: item.child,
    },
    featuredMediaId: 'existing-media',
  }));
  if (options.childChange) Object.assign(children[0], options.childChange);
  const state = {
    children: options.removeChild ? children.slice(1) : children,
    parent: options.parent ?? null,
    otherParents: options.otherParents ?? [],
    destination: options.destination === undefined
      ? { id: 'la-romana-db-id', slug: 'la-romana', status: 'PUBLISHED' }
      : options.destination,
    relations: options.relations ?? [],
    created: [],
    modifiedChildren: 0,
    transactionCount: 0,
  };
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
      async create({ data }) {
        assert.equal(data.slug, PARENT_SLUG);
        assert.equal(state.parent, null);
        state.created.push(data);
        state.parent = data;
        return data;
      },
      async update() { state.modifiedChildren++; throw new Error('update forbidden'); },
      async delete() { state.modifiedChildren++; throw new Error('delete forbidden'); },
    },
    destination: {
      async findUnique() { return state.destination; },
    },
    experienceDestination: {
      async findMany() { return state.relations; },
      async create({ data }) {
        if (options.failDestinationCreate) throw new Error('destination association failed');
        state.relations.push(data);
        return data;
      },
    },
    async $transaction(callback) {
      state.transactionCount++;
      const before = { parent: state.parent, created: [...state.created], relations: [...state.relations] };
      try { return await callback(prisma); }
      catch (error) {
        state.parent = before.parent;
        state.created = before.created;
        state.relations = before.relations;
        throw error;
      }
    },
  };
  return { prisma, state };
}

test('dry-run proposes one MANUAL DRAFT parent with four ordered slugs and no inherited prices', async () => {
  const { prisma, state } = fakeDatabase();
  const result = await inspectPreparation(prisma, preview);
  assert.equal(result.operation, 'CREATE_DRAFT_PARENT');
  assert.equal(result.packageCount, 4);
  assert.equal(result.packageStatuses.filter(child => child.status === 'DRAFT').length, 3);
  assert.equal(result.packageStatuses[3].sourceProvider, 'WORDPRESS');
  assert.deepEqual(preview.parent.displayJson.experienceFamily.packageSlugs, PACKAGES.map(item => item.slug));
  assert.equal(preview.parent.status, 'DRAFT');
  assert.equal(Object.hasOwn(preview.parent, 'pricingJson'), false);
  assert.equal(state.created.length, 0);
});

test('creates only parent and primary la-romana relation, then safely no-ops', async () => {
  const { prisma, state } = fakeDatabase();
  const before = structuredClone(state.children);
  const first = await applyParent(prisma, preview);
  assert.equal(first.operation, 'CREATE_DRAFT_PARENT');
  assert.equal(first.writesPerformed, true);
  assert.equal(first.parent.id, PARENT_ID);
  assert.equal(first.parent.status, 'DRAFT');
  assert.equal(state.created.length, 1);
  assert.equal(state.transactionCount, 1);
  assert.deepEqual(state.relations, [{
    experienceId: PARENT_ID, destinationId: 'la-romana-db-id', isPrimary: true,
  }]);
  assert.deepEqual(state.children, before);
  assert.equal(state.modifiedChildren, 0);

  // MariaDB/Prisma may round-trip JSON object keys in a different order.
  state.parent.displayJson = { experienceFamily: {
    mode: 'multi_inquiry',
    version: 2,
    packageSlugs: [...preview.parent.displayJson.experienceFamily.packageSlugs],
  } };
  const second = await applyParent(prisma, preview);
  assert.equal(second.operation, 'NOOP_ALREADY_PREPARED');
  assert.equal(second.writesPerformed, false);
  assert.equal(state.created.length, 1);
  assert.equal(state.transactionCount, 1);
});

test('aborts on missing child, altered identity, provider or price', async () => {
  const broken = [
    { removeChild: true },
    { childChange: { id: 'different' } },
    { childChange: { sourceProvider: 'WORDPRESS' } },
    { childChange: { pricingJson: { currency: 'USD', basis: 'person', adult: 1, child: 1 } } },
  ];
  for (const options of broken) {
    const { prisma, state } = fakeDatabase(options);
    await assert.rejects(applyParent(prisma, preview), /Altos U1 safety stop/);
    assert.equal(state.created.length, 0);
    assert.equal(state.transactionCount, 0);
  }
});

test('stops for competing ownership and missing or unpublished destination', async () => {
  const cases = [
    { otherParents: [{ slug: 'other-experience', displayJson: {
      experienceFamily: { packageSlugs: [PACKAGES[0].slug] },
    } }] },
    { destination: null },
    { destination: { id: 'la-romana-db-id', slug: 'la-romana', status: 'DRAFT' } },
    { childChange: { status: 'ARCHIVED' } },
  ];
  for (const options of cases) {
    const { prisma, state } = fakeDatabase(options);
    await assert.rejects(applyParent(prisma, preview), /Altos U1 safety stop/);
    assert.equal(state.created.length, 0);
  }
});

test('refuses a published parent, altered title or missing primary destination association', async () => {
  const cases = [
    { parent: { ...preview.parent, status: 'PUBLISHED' } },
    { parent: { ...preview.parent, title: 'Changed without review' } },
    { parent: { ...preview.parent } },
    { parent: { ...preview.parent }, relations: [{ destinationId: 'different', isPrimary: true }] },
    { parent: { ...preview.parent }, relations: [{ destinationId: 'la-romana-db-id', isPrimary: false }] },
  ];
  for (const options of cases) {
    const { prisma, state } = fakeDatabase(options);
    await assert.rejects(applyParent(prisma, preview), /Altos U1 safety stop/);
    assert.equal(state.created.length, 0);
  }
});

test('rolls back parent if destination association fails during transaction', async () => {
  const { prisma, state } = fakeDatabase({ failDestinationCreate: true });
  await assert.rejects(applyParent(prisma, preview), /destination association failed/);
  assert.equal(state.parent, null);
  assert.equal(state.created.length, 0);
  assert.equal(state.relations.length, 0);
  assert.equal(state.transactionCount, 1);
});

test('CLI rejects unrecognized and multi-argument flags before any database connection', () => {
  const script = fileURLToPath(new URL('./create-altos-family-parent-u1.mjs', import.meta.url));
  for (const flags of [['--database'], ['--apply', '--database'], ['--publish']]) {
    const run = spawnSync(process.execPath, [script, ...flags], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /usage: node scripts\/create-altos-family-parent-u1.mjs/);
  }
});
