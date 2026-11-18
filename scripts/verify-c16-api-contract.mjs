/**
 * C16: read-only source contract audit.
 * Verify the existing API already serializes Experience.itineraryJson to
 * "itinerary" in public AND preview routes, without inventing a new schema.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

const publicController = read('server/src/modules/content/content.controller.ts');
const publicService = read('server/src/modules/content/content.service.ts');
const previewController = read('server/src/modules/content/content-preview.controller.ts');
const previewService = read('server/src/modules/content/content-preview.service.ts');
const types = read('server/src/modules/content/content.types.ts');
const generator = read('scripts/prepare-staging-itineraries-c16.mjs');
const proposal = json('data/content/itinerary-proposals-2026-11-bavaro-hacienda.json');
const bavaro = json('data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json').experiences;
const hacienda = json('data/content/client-experiences-2026-09-la-hacienda-park.seed.json').experiences;

assert.match(publicController, /@Controller\('public'\)/);
assert.match(publicController, /@Get\('experiences\/:slug'\)/);
assert.match(previewController, /@Controller\('preview'\)/);
assert.match(previewController, /@Get\('experiences\/:slug'\)/);
assert.match(previewController, /@Headers\('x-preview-token'\)/);
assert.match(types, /itinerary:\s*Array<Record<string,\s*unknown>>;/);
assert.match(publicService, /itinerary:\s*this\.jsonArray<Record<string,\s*unknown>>\(row\.itineraryJson\)/);
assert.match(previewService, /itinerary:\s*this\.jsonArray<Record<string,\s*unknown>>\(row\.itineraryJson\)/);

assert.equal(proposal.status, 'PROPOSED_NOT_APPLIED');
assert.equal(proposal.items.length, 14);
assert.equal(bavaro.length, 13);
assert.equal(hacienda.length, 1);
const slugs = new Set([...bavaro, ...hacienda].map(x => x.slug));
assert.equal(slugs.size, 14);
assert.deepEqual(new Set(proposal.items.map(x => x.slug)), slugs);
assert.equal(proposal.items.reduce((n,item)=>n+item.itinerary.length,0), 55);
assert.ok(proposal.items.every(x=>x.operatorSequenceConfirmed===false));

assert.match(generator, /assert\.equal\(backups\.length,\s*EXPECTED/);
assert.match(generator, /assert\.equal\(backup\.itinerary_json,\s*'\[\]'/);
assert.match(generator, /assert\.equal\(backup\.id,\s*seed\.id/);
assert.match(generator, /SET e\.itinerary_json = r\.next_json/);
assert.match(generator, /@c16_database_ok/);
assert.match(generator, /const verified = restore \?/);
assert.match(generator, /AND ' \+ verified \+ " = 14, 'COMMIT'/);
assert.match(generator, /@c16_allow_apply/);
assert.match(generator, /@c16_allow_rollback/);

// Guard against accidental generic update or import/seed effects in this workflow.
assert.doesNotMatch(generator, /SET\s+e\.(?:pricing|booking|included|excluded|status|featuredMedia|gallery|sourceProvider)/i);

console.log('C16_API_PUBLIC_ITINERARY_CONTRACT=OK');
console.log('C16_API_PREVIEW_ITINERARY_CONTRACT=OK');
console.log('C16_SOURCE_TARGETS=13_BAVARO_PLUS_1_HACIENDA');
console.log('C16_SOURCE_STEPS=55');
console.log('C16_EXISTING_ITINERARIES=OUT_OF_SCOPE');
console.log('C16_SCHEMA_MIGRATION_REQUIRED=NO');
console.log('C16_DB_WRITES=NONE');
console.log('C16_API_DB_CONTRACT_OK');
