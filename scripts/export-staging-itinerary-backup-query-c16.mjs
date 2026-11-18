/**
 * C16: build a read-only phpMyAdmin export query for the 14 published records.
 *
 * This command DOES NOT connect to MySQL or export remote data. Run its
 * generated SELECT against staging and save the *result* as JSON using
 * phpMyAdmin before considering any itinerary_json write.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const bavaro = load('data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json');
const hacienda = load('data/content/client-experiences-2026-09-la-hacienda-park.seed.json');
const proposed = load('data/content/itinerary-proposals-2026-11-bavaro-hacienda.json');

assert.equal(proposed.status, 'PROPOSED_NOT_APPLIED');
assert.equal(proposed.items.length, 14);
const sources = [...bavaro.experiences, ...hacienda.experiences];
assert.equal(sources.length, 14);
const bySlug = new Map(sources.map((s) => [s.slug, s]));
assert.equal(bySlug.size, 14);
const pairs = [];
for (const item of proposed.items) {
  const seed = bySlug.get(item.slug);
  assert.ok(seed, `Unknown proposed slug: ${item.slug}`);
  assert.equal(item.reviewStatus, 'editorial_proposal');
  assert.equal(item.operatorSequenceConfirmed, false);
  assert.match(seed.id, /^manual-exp-[a-z0-9-]+$/);
  assert.match(seed.slug, /^[a-z0-9-]+$/);
  pairs.push([seed.id, seed.slug]);
}
pairs.sort((a, b) => a[1].localeCompare(b[1], 'en'));
const literal = (v) => "'" + v.replaceAll("'", "''") + "'";

console.log('-- C16 BACKUP: READ ONLY; Select Hostinger database u424080957_quisqueya_core.');
console.log('-- Export EXACTLY 14 result rows as JSON from phpMyAdmin; store privately.');
console.log('-- Do not paste any INSERT/UPDATE/DELETE/ALTER query.');
console.log('SELECT');
console.log('    id,');
console.log('    slug,');
console.log('    title,');
console.log('    status,');
console.log('    source_provider,');
console.log('    updated_at,');
console.log('    itinerary_json,');
console.log('    COALESCE(JSON_LENGTH(itinerary_json), 0) AS itinerary_steps,');
console.log("    SHA2(COALESCE(CAST(itinerary_json AS CHAR), 'NULL'), 256) AS itinerary_checksum");
console.log('FROM experiences');
console.log('WHERE (id, slug) IN (');
console.log(pairs.map(([id, slug]) => `    (${literal(id)}, ${literal(slug)})`).join(',\n'));
console.log(')');
console.log('ORDER BY slug;');
console.error('C16_BACKUP_EXPECTED_ROWS=14');
console.error('C16_BACKUP_READ_ONLY=true');
console.error('C16_BACKUP_EXPORT_REQUIRED=true');
