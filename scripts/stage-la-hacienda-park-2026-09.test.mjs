import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL, fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  applyProposal, buildProposal, localConfig, mutableClientContent, validatePayload,
} from './stage-la-hacienda-park-2026-09.mjs';

const seed = JSON.parse(await readFile(new URL(
  '../data/content/client-experiences-2026-09-la-hacienda-park.seed.json', import.meta.url), 'utf8'));
const { family, experience } = validatePayload(seed);
const clone = value => JSON.parse(JSON.stringify(value));

function fakeDatabase(options = {}) {
  const state = {
    experiences: clone(options.experiences ?? []),
    destinations: clone(options.destinations ?? [
      { id: 'wp-destination-48', slug: 'punta-cana', name: 'Punta Cana', status: 'PUBLISHED' },
    ]),
    links: [],
    writes: 0,
    transactions: 0,
  };
  const prisma = {
    destination: {
      async findMany({ where }) {
        return state.destinations.filter(row => where.slug.in.includes(row.slug));
      },
    },
    experience: {
      async findUnique({ where }) {
        const [field, value] = Object.entries(where)[0];
        return state.experiences.find(row => row[field] === value) ?? null;
      },
      async create({ data }) {
        assert.equal(state.experiences.length, 0);
        state.experiences.push(clone(data));
        state.writes++;
        return data;
      },
      async update() { throw new Error('update forbidden'); },
      async upsert() { throw new Error('upsert forbidden'); },
      async delete() { throw new Error('delete forbidden'); },
    },
    experienceDestination: {
      async create({ data }) {
        if (options.failRelation) throw new Error('relation insert failed');
        state.links.push(clone(data));
        state.writes++;
        return data;
      },
      async deleteMany() { throw new Error('relation deletion forbidden'); },
    },
    async $transaction(callback) {
      state.transactions++;
      const before = { experiences: clone(state.experiences), links: clone(state.links), writes: state.writes };
      try { return await callback(prisma); }
      catch (error) {
        state.experiences = before.experiences;
        state.links = before.links;
        state.writes = before.writes;
        throw error;
      }
    },
  };
  return { prisma, state };
}

test('original seed validates one experience with five fixed rates and provisional age bands', () => {
  const data = mutableClientContent(experience);
  assert.equal(data.pricingMode, 'FIXED');
  assert.equal(data.pricingJson.ratePlans.length, 5);
  assert.deepEqual(data.pricingJson.ratePlans.map(item => [item.key, item.price]), [
    ['general-admission-only', 85], ['standard', 99], ['standard-with-lunch', 109],
    ['vip', 250], ['dominican-resident', 75],
  ]);
  assert.equal(data.pricingJson.ageReference.status, 'provisional_normalization');
  assert.equal(data.includedItemsJson.length, experience.included.length);
  assert.deepEqual(data.editorialFlagsJson, experience.editorialFlags);
});

test('rejects edited prices, passenger bands, and different destination', () => {
  const changed = clone(seed);
  changed.experiences[0].pricing.ratePlans[1].price = 1;
  assert.throws(() => validatePayload(changed), /rate plan standard/);
  const ageChanged = clone(seed);
  ageChanged.experiences[0].pricing.ageReference.normalizedAgeBands[0].minAge = 18;
  assert.throws(() => validatePayload(ageChanged), /provisional age bands/);
  const destinationChanged = clone(seed);
  destinationChanged.experiences[0].destinationSlugs = ['la-romana'];
  assert.throws(() => validatePayload(destinationChanged), /only to the existing Punta Cana/);
});

test('database dry-run proposes exactly one MANUAL DRAFT without writes', async () => {
  const { prisma, state } = fakeDatabase();
  const proposal = await buildProposal(prisma, seed, family, experience);
  assert.equal(proposal.data.id, 'manual-exp-la-hacienda-park-7-aventuras');
  assert.equal(proposal.data.slug, 'la-hacienda-park-7-aventuras');
  assert.equal(proposal.data.sourceProvider, 'MANUAL');
  assert.equal(proposal.data.status, 'DRAFT');
  assert.equal(proposal.data.provenanceJson.family.mediaStatus, 'pending_collaborator_library_review');
  assert.equal(proposal.destinations[0].id, 'wp-destination-48');
  assert.equal(state.writes, 0);
  assert.equal(state.transactions, 0);
});

test('apply creates one draft and primary Punta Cana link only once', async () => {
  const { prisma, state } = fakeDatabase();
  const proposal = await buildProposal(prisma, seed, family, experience);
  const created = await applyProposal(prisma, seed, family, experience, proposal);
  assert.equal(created.status, 'DRAFT');
  assert.equal(state.experiences.length, 1);
  assert.equal(state.experiences[0].pricingJson.ratePlans.length, 5);
  assert.deepEqual(state.links, [{
    experienceId: 'manual-exp-la-hacienda-park-7-aventuras',
    destinationId: 'wp-destination-48', isPrimary: true,
  }]);
  assert.equal(state.writes, 2);
  assert.equal(state.transactions, 1);
  await assert.rejects(buildProposal(prisma, seed, family, experience), /already exists/);
  assert.equal(state.writes, 2);
});

test('refuses matching slug, matching ID, and missing or draft destination', async () => {
  const cases = [
    { experiences: [{ id: 'other', slug: 'la-hacienda-park-7-aventuras' }] },
    { experiences: [{ id: 'manual-exp-la-hacienda-park-7-aventuras', slug: 'other' }] },
    { destinations: [] },
    { destinations: [{ id: 'wp-destination-48', slug: 'punta-cana', status: 'DRAFT' }] },
  ];
  for (const options of cases) {
    const { prisma, state } = fakeDatabase(options);
    await assert.rejects(buildProposal(prisma, seed, family, experience), /Safety stop/);
    assert.equal(state.writes, 0);
    assert.equal(state.transactions, 0);
  }
});

test('rolls back new draft when creating destination link fails', async () => {
  const { prisma, state } = fakeDatabase({ failRelation: true });
  const proposal = await buildProposal(prisma, seed, family, experience);
  await assert.rejects(applyProposal(prisma, seed, family, experience, proposal), /relation insert failed/);
  assert.equal(state.experiences.length, 0);
  assert.equal(state.links.length, 0);
  assert.equal(state.writes, 0);
  assert.equal(state.transactions, 1);
});

test('local-only config prevents remote and staging/production databases', () => {
  assert.equal(localConfig({ MYSQL_HOST: 'localhost', MYSQL_DATABASE: 'quisqueya_core' }).port, 3306);
  for (const env of [
    { MYSQL_HOST: 'db.example.com', MYSQL_DATABASE: 'quisqueya_core' },
    { MYSQL_HOST: 'localhost', MYSQL_DATABASE: 'other' },
    { MYSQL_HOST: 'localhost', MYSQL_DATABASE: 'quisqueya_core', APP_ENV: 'staging' },
    { MYSQL_HOST: 'localhost', MYSQL_DATABASE: 'quisqueya_core', APP_ENV: 'production' },
  ]) assert.throws(() => localConfig(env), /only the explicit local/);
});

test('CLI rejects unsupported commands before a database connection', () => {
  const script = fileURLToPath(new URL('./stage-la-hacienda-park-2026-09.mjs', import.meta.url));
  for (const args of [['--publish'], ['--database'], ['--apply', '--publish']]) {
    const run = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Usage: node scripts\/stage-la-hacienda-park-2026-09.mjs/);
  }
});
