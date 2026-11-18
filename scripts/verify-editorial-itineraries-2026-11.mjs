import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const load = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const proposed = load('../data/content/itinerary-proposals-2026-11-bavaro-hacienda.json');
const bavaro = load('../data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json').experiences;
const hacienda = load('../data/content/client-experiences-2026-09-la-hacienda-park.seed.json').experiences;
const source = [...bavaro, ...hacienda];
const expected = new Set(source.map((e) => e.slug));

assert.equal(source.length, 14, 'Expected 13 Bavaro packages + one La Hacienda experience');
assert.equal(expected.size, 14, 'Duplicate slug in source seeds');
assert.equal(proposed.status, 'PROPOSED_NOT_APPLIED', 'Proposals cannot be marked applied automatically');
assert.equal(proposed.items?.length, 14, 'Expected exactly 14 proposals');
const seen = new Set();
let steps = 0;

for (const item of proposed.items) {
  assert.equal(typeof item.slug, 'string');
  assert.ok(expected.has(item.slug), `Unknown proposal slug: ${item.slug}`);
  assert.ok(!seen.has(item.slug), `Repeated proposal slug: ${item.slug}`);
  seen.add(item.slug);
  assert.equal(item.operatorSequenceConfirmed, false, 'Do not promise provider-confirmed order');
  assert.equal(item.reviewStatus, 'editorial_proposal');
  assert.ok(Array.isArray(item.sourcePages) && item.sourcePages.length > 0);
  assert.ok(Array.isArray(item.itinerary) && item.itinerary.length >= 3 && item.itinerary.length <= 6);
  for (const step of item.itinerary) {
    for (const key of ['time', 'title', 'desc']) {
      assert.ok(typeof step[key] === 'string' && step[key].trim().length > 0,
        `Missing ${key} for ${item.slug}`);
    }
    assert.ok(!/\b\d{1,2}:\d{2}\b/.test(step.time), 'No clock times without provider confirmation');
    assert.ok(step.desc.length <= 400, 'Keep descriptions concise');
    steps += 1;
  }
}

for (const experience of source) {
  assert.ok(!('itinerary' in experience) || !experience.itinerary?.length,
    `Review existing itinerary before overriding: ${experience.slug}`);
}

console.log('C16_SOURCE_SEEDS=14');
console.log('C16_ITINERARY_PROPOSALS=' + proposed.items.length);
console.log('C16_EDITORIAL_STEPS=' + steps);
console.log('C16_FIXED_SEQUENCE_CONFIRMED=NO');
console.log('C16_DATABASE_WRITES=NONE');
console.log('C16_ITINERARY_PROPOSALS_VALIDATED');
