import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import {
  PARENT_ID,
  PARENT_SLUG,
  applyParent,
  buildProposal,
  inspectDatabase,
} from './create-bavaro-family-parent-c3.mjs';

const seed = JSON.parse(await readFile(
  new URL('../data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json', import.meta.url), 'utf8',
));
const proposal = buildProposal(seed);

function fakeDatabase(overrides = {}) {
  const children = seed.experiences.map(item => ({
    id: item.id,
    slug: item.slug,
    status: 'DRAFT',
    sourceProvider: 'MANUAL',
    includedItemsJson: item.included ?? [],
    excludedItemsJson: item.excluded ?? [],
    pricingJson: item.pricing,
    featuredMediaId: null,
  }));
  if (overrides.child) Object.assign(children[0], overrides.child);
  const state = {
    parent: overrides.parent ?? null,
    children: overrides.removeChild ? children.slice(1) : children,
    otherParents: overrides.otherParents ?? [],
    destination: overrides.destination === undefined
      ? { id: 'destination-punta-cana', slug: 'punta-cana', status: 'PUBLISHED' }
      : overrides.destination,
    created: [],
    relations: [],
    transactionCount: 0,
  };
  const prisma = {
    experience: {
      async findUnique({ where }) {
        return where.slug === PARENT_SLUG || where.id === PARENT_ID ? state.parent : null;
      },
      async findMany({ where }) {
        return where.slug.in ? state.children : state.otherParents;
      },
      async create({ data }) {
        state.created.push(data);
        state.parent = data;
        return data;
      },
    },
    experienceDestination: {
      async findUnique() {
        return state.relations[0] ?? null;
      },
      async create({ data }) {
        state.relations.push(data);
        return data;
      },
    },
    destination: { async findUnique() { return state.destination; } },
    async $transaction(callback) {
      state.transactionCount += 1;
      return callback(prisma);
    },
  };
  return { prisma, state };
}

test('prepares 13 ordered package references without inheriting price or editorial details', () => {
  assert.equal(proposal.id, PARENT_ID);
  assert.equal(proposal.slug, PARENT_SLUG);
  assert.equal(proposal.status, 'DRAFT');
  assert.equal(proposal.sourceProvider, 'MANUAL');
  assert.equal(proposal.pricingMode, 'ON_REQUEST');
  assert.equal(proposal.displayJson.experienceFamily.mode, 'multi_inquiry');
  assert.deepEqual(proposal.displayJson.experienceFamily.packageSlugs,
    seed.experiences.map(item => item.slug));
  assert.equal(Object.hasOwn(proposal, 'pricingJson'), false);
  assert.equal(Object.hasOwn(proposal, 'includedItemsJson'), false);
});

test('database dry-run identifies the only authorized operation without writes', async () => {
  const { prisma, state } = fakeDatabase();
  const inspection = await inspectDatabase(prisma, seed, proposal);
  assert.equal(inspection.operation, 'CREATE_DRAFT_PARENT');
  assert.equal(inspection.childCount, 13);
  assert.equal(inspection.childrenWithoutFeaturedMedia.length, 13);
  assert.equal(state.created.length, 0);
  assert.equal(state.relations.length, 0);
});

test('creates only the parent DRAFT and destination relation; a second run is a no-op', async () => {
  const { prisma, state } = fakeDatabase();
  const first = await applyParent(prisma, seed, proposal);
  assert.equal(first.writesPerformed, true);
  assert.equal(first.parent.status, 'DRAFT');
  assert.equal(state.transactionCount, 1);
  assert.equal(state.created.length, 1);
  assert.deepEqual(state.relations, [{
    experienceId: PARENT_ID, destinationId: 'destination-punta-cana', isPrimary: true,
  }]);

  const second = await applyParent(prisma, seed, proposal);
  assert.equal(second.operation, 'NOOP_ALREADY_PREPARED');
  assert.equal(second.writesPerformed, false);
  assert.equal(state.created.length, 1);
  assert.equal(state.transactionCount, 1);
});

test('stops if a package is missing', async () => {
  const { prisma } = fakeDatabase({ removeChild: true });
  await assert.rejects(inspectDatabase(prisma, seed, proposal), /packages are missing/);
});

test('stops if a package was published or its identity changed', async () => {
  for (const child of [{ status: 'PUBLISHED' }, { sourceProvider: 'WORDPRESS' }, { id: 'different' }]) {
    const { prisma, state } = fakeDatabase({ child });
    await assert.rejects(applyParent(prisma, seed, proposal), /expected the original MANUAL DRAFT/);
    assert.equal(state.created.length, 0);
  }
});

test('stops on editorial drift and price drift', async () => {
  for (const child of [{ includedItemsJson: ['unreviewed'] }, { pricingJson: { from: 1, currency: 'USD', basis: 'person' } }]) {
    const { prisma, state } = fakeDatabase({ child });
    await assert.rejects(applyParent(prisma, seed, proposal), /differ/);
    assert.equal(state.created.length, 0);
  }
});

test('stops on parent collisions and ownership conflicts', async () => {
  const differentParent = { ...proposal, status: 'PUBLISHED' };
  const { prisma: a } = fakeDatabase({ parent: differentParent });
  await assert.rejects(inspectDatabase(a, seed, proposal), /existing parent differs/);

  const { prisma: b } = fakeDatabase({ otherParents: [{
    slug: 'other-family',
    displayJson: { experienceFamily: { version: 2, packageSlugs: [seed.experiences[0].slug] } },
  }] });
  await assert.rejects(inspectDatabase(b, seed, proposal), /another parent/);
});

test('does not accept an existing parent with a missing destination link', async () => {
  const { prisma } = fakeDatabase({ parent: proposal });
  await assert.rejects(inspectDatabase(prisma, seed, proposal), /no primary Punta Cana destination/);
});

test('stops when the destination is missing or unpublished', async () => {
  for (const destination of [null, { id: 'dest', slug: 'punta-cana', status: 'DRAFT' }]) {
    const { prisma } = fakeDatabase({ destination });
    await assert.rejects(inspectDatabase(prisma, seed, proposal), /must exist and be PUBLISHED/);
  }
});
