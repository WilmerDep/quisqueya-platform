/**
 * C16 — Produce a READ-ONLY SQL inventory for phpMyAdmin against staging.
 * It does not connect to MySQL, import data, generate UPDATE or apply anything.
 * Authoritative source: Breidy's reviewed editorial proposals / 14 seed slugs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
const proposals = read('data/content/itinerary-proposals-2026-11-bavaro-hacienda.json');
const bavaro = read('data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json');
const hacienda = read('data/content/client-experiences-2026-09-la-hacienda-park.seed.json');
const seeds = [...bavaro.experiences, ...hacienda.experiences];

assert.equal(proposals.status, 'PROPOSED_NOT_APPLIED', 'Only proposals awaiting editorial review are supported');
assert.equal(seeds.length, 14);
assert.equal(proposals.items.length, 14);

const bySlug = new Map(seeds.map((item) => [item.slug, item]));
assert.equal(bySlug.size, 14, 'Duplicate seed slugs');
const expected = [];

for (const entry of proposals.items) {
  const seed = bySlug.get(entry.slug);
  assert.ok(seed, `Unknown proposal: ${entry.slug}`);
  assert.equal(entry.operatorSequenceConfirmed, false);
  assert.equal(entry.reviewStatus, 'editorial_proposal');
  assert.ok(Array.isArray(entry.itinerary) && entry.itinerary.length > 0);
  assert.ok(typeof seed.id === 'string' && seed.id.startsWith('manual-exp-'));
  expected.push({ id: seed.id, slug: entry.slug, steps: entry.itinerary.length });
}

expected.sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
console.log('-- C16 / STAGING — READ ONLY / NO INSERT, UPDATE, DELETE OR DDL');
console.log('-- Select database u424080957_quisqueya_core in phpMyAdmin first.');
console.log('-- This checks 14 EXACT source identities from seeds, with PUBLISHED and MANUAL guards.');
console.log('-- Do not use on a different database or assume local and staging are interchangeable.');
console.log('-- These are editorial proposals, NOT confirmed operating schedules.');
console.log('-- Paste only the SELECT statement below into phpMyAdmin SQL.');
console.log('SELECT');
console.log('    id,');
console.log('    slug,');
console.log('    title,');
console.log('    status,');
console.log('    source_provider,');
console.log('    updated_at,');
console.log('    COALESCE(JSON_LENGTH(itinerary_json), 0) AS itinerary_steps,');
console.log('    CASE');
console.log("      WHEN status = 'PUBLISHED'");
console.log("       AND source_provider = 'MANUAL'");
console.log('       AND (itinerary_json IS NULL OR JSON_LENGTH(itinerary_json) = 0)');
console.log("      THEN 'C16_CANDIDATE'");
console.log("      ELSE 'STOP_REVIEW'");
console.log('    END AS c16_preflight');
console.log('FROM experiences');
console.log('WHERE (id, slug) IN (');
console.log(expected.map(({ id, slug }) =>
  `    ('${id.replaceAll("'", "''")}', '${slug.replaceAll("'", "''")}')`
).join(',\n'));
console.log(')');
console.log('ORDER BY slug;');
console.error(`C16_EXPECTED_ROWS=${expected.length}`);
console.error(`C16_EXPECTED_STEPS=${expected.reduce((sum, item) => sum + item.steps, 0)}`);
console.error('C16_SQL_READ_ONLY=true');
console.error('C16_APPROVAL_REQUIRED=true');
