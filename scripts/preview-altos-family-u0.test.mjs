import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PACKAGES, PARENT_ID, PARENT_SLUG, buildPreview, inspectDatabase,
} from './preview-altos-family-u0.mjs';

const primary = JSON.parse(await readFile(new URL(
  '../data/content/client-experiences-2026-09.seed.json', import.meta.url), 'utf8'));
const secondary = JSON.parse(await readFile(new URL(
  '../data/content/client-experiences-2026-09-second-part.seed.json', import.meta.url), 'utf8'));
const preview = buildPreview(primary, secondary);

function fakeDatabase(options = {}) {
  const rows = PACKAGES.map(item => ({
    slug: item.slug,
    id: item.id ?? 'wp-existing-id-from-db',
    sourceProvider: item.provider,
    status: options.allPublished ? 'PUBLISHED' : item.provider === 'WORDPRESS' ? 'PUBLISHED' : 'DRAFT',
    pricingMode: 'FIXED',
    pricingJson: item.provider === 'WORDPRESS' ? null : {
      currency: 'USD', basis: 'person', adult: String(item.adult), child: String(item.child),
    },
    featuredMediaId: 'media-existing',
  }));
  if (options.removeSlug) rows.splice(rows.findIndex(row => row.slug === options.removeSlug), 1);
  if (options.childChange) Object.assign(rows[0], options.childChange);
  if (options.parent) rows.push(options.parent);
  const state = { writes: 0, rows };
  const prisma = {
    experience: {
      async findMany({ where } = {}) {
        return where?.slug?.in ? rows.filter(row => where.slug.in.includes(row.slug)) :
          [...rows, ...(options.otherParents ?? [])].map(row => ({ slug: row.slug, displayJson: row.displayJson }));
      },
      async findUnique({ where }) {
        return rows.find(row => row.id === where.id) ?? null;
      },
      async create() { state.writes++; throw new Error('write forbidden'); },
      async update() { state.writes++; throw new Error('write forbidden'); },
    },
    destination: {
      async findUnique() { return options.destination === undefined
        ? { id: 'la-romana-id', slug: 'la-romana', status: 'PUBLISHED' } : options.destination; },
    },
  };
  return { prisma, state };
}

test('confirms exactly four ordered packages with Altos de Chavón-first labels', () => {
  assert.equal(preview.parent.slug, PARENT_SLUG);
  assert.equal(preview.parent.id, PARENT_ID);
  assert.equal(preview.parent.status, 'DRAFT');
  assert.equal(preview.parent.pricingMode, 'ON_REQUEST');
  assert.equal(preview.parent.displayJson.experienceFamily.mode, 'multi_inquiry');
  assert.deepEqual(preview.parent.displayJson.experienceFamily.packageSlugs, PACKAGES.map(item => item.slug));
  assert.equal(preview.packageLabels.length, 4);
  assert(preview.packageLabels.every(item => item.label.startsWith('Altos de Chavón')));
  assert.equal(PACKAGES[3].id, null);
  assert.equal(PACKAGES[3].provider, 'WORDPRESS');
  assert.equal(Object.hasOwn(preview.parent, 'pricingJson'), false);
});

test('stops on source ID, price, or missing reviewed seed instead of assuming data', () => {
  const missing = structuredClone(primary);
  missing.experiences.pop();
  assert.throws(() => buildPreview(missing, secondary), /expected one client seed record/);

  const drift = structuredClone(primary);
  drift.experiences[0].pricing.adult = '0';
  assert.throws(() => buildPreview(drift, secondary), /pricing drift/);

  const wrongId = structuredClone(secondary);
  wrongId.experiences[1].id = 'renamed';
  assert.throws(() => buildPreview(primary, wrongId), /source ID drift/);
});

test('database preflight reads mixed MANUAL/WORDPRESS children without any writes', async () => {
  const { prisma, state } = fakeDatabase();
  const result = await inspectDatabase(prisma, preview);
  assert.equal(result.operation, 'READ_ONLY');
  assert.equal(result.readyForDraftParentPreparation, true);
  assert.equal(result.readyForPublicFamily, false);
  assert.equal(result.packages.length, 4);
  assert.equal(result.packages[3].sourceProvider, 'WORDPRESS');
  assert.equal(result.blockers.length, 0);
  assert.equal(result.writesPerformed, false);
  assert.equal(state.writes, 0);
  assert.match(result.warnings.join(' '), /cannot appear as a public package yet/);
});

test('identifies missing legacy WordPress child and source mismatches', async () => {
  const missing = fakeDatabase({ removeSlug: PACKAGES[3].slug });
  const absent = await inspectDatabase(missing.prisma, preview);
  assert.equal(absent.readyForDraftParentPreparation, false);
  assert.match(absent.blockers.join(' '), /missing package: aventura-en-buggies/);

  const wrong = fakeDatabase({ childChange: { sourceProvider: 'WORDPRESS' } });
  const inspected = await inspectDatabase(wrong.prisma, preview);
  assert.match(inspected.blockers.join(' '), /unexpected source provider/);
  assert.equal(wrong.state.writes, 0);
});

test('blocks conflicting parent identities and child ownership collisions', async () => {
  const conflict = fakeDatabase({ parent: { id: PARENT_ID, slug: PARENT_SLUG,
    sourceProvider: 'MANUAL', displayJson: { experienceFamily: { version: 2, packageSlugs: ['other'] } } } });
  assert.match((await inspectDatabase(conflict.prisma, preview)).blockers.join(' '), /parent conflicts/);

  const claimed = fakeDatabase({ otherParents: [{ slug: 'another-family',
    displayJson: { experienceFamily: { version: 2, packageSlugs: [PACKAGES[2].slug] } } }] });
  assert.match((await inspectDatabase(claimed.prisma, preview)).blockers.join(' '), /already claimed/);
});

test('recognizes the same parent when MySQL returns JSON keys in a different order', async () => {
  const parent = {
    ...preview.parent,
    displayJson: { experienceFamily: {
      mode: 'multi_inquiry',
      version: 2,
      packageSlugs: [...preview.parent.displayJson.experienceFamily.packageSlugs],
    } },
  };
  const { prisma } = fakeDatabase({ parent });
  const inspection = await inspectDatabase(prisma, preview);
  assert.deepEqual(inspection.blockers, []);
  assert.equal(inspection.parent.status, 'DRAFT');

  parent.displayJson.experienceFamily.packageSlugs.reverse();
  const changed = await inspectDatabase(prisma, preview);
  assert.match(changed.blockers.join(' '), /parent conflicts/);
});

test('blocks missing destination and reports published-readiness only for complete family', async () => {
  const missing = fakeDatabase({ destination: null });
  assert.match((await inspectDatabase(missing.prisma, preview)).blockers.join(' '), /destination/);

  const publishedParent = { ...preview.parent, status: 'PUBLISHED' };
  const published = fakeDatabase({ allPublished: true, parent: publishedParent });
  const result = await inspectDatabase(published.prisma, preview);
  assert.equal(result.readyForPublicFamily, true);
  assert.equal(result.blockers.length, 0);
});

test('CLI refuses all write flags, including --apply', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./preview-altos-family-u0.mjs', import.meta.url)),
    '--apply'], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no --apply/);
});
