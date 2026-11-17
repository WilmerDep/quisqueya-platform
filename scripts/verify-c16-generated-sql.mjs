/**
 * Offline QA of files created by prepare-staging-itineraries-c16.mjs.
 * Reads data only: no MySQL connection and no writes.
 *
 * node scripts/verify-c16-generated-sql.mjs --backup "path/backup.json" --out-dir "path/C16_STAGING_SQL_REVISAR"
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = 'u424080957_quisqueya_core';
const argv = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const sha = (value) => createHash('sha256').update(value).digest('hex');
const read = (path) => readFile(path, 'utf8');
const load = async (path) => JSON.parse((await read(path)).replace(/^\uFEFF/, ''));
const assertFlagOff = (sql, label) =>
  assert.match(sql, new RegExp('SET\\s+@c16_allow_' + label + '\\s*:=\\s*0\\s*;', 'i'));

async function main() {
  const backup = argv('--backup');
  const out = argv('--out-dir');
  assert.ok(backup && out, 'Pass --backup and --out-dir');

  const [snapshot, proposal, manifest, preview, apply, rollback] = await Promise.all([
    read(resolve(backup)),
    load(join(root, 'data/content/itinerary-proposals-2026-11-bavaro-hacienda.json')),
    load(join(resolve(out), 'C16_04_MANIFEST.json')),
    read(join(resolve(out), 'C16_01_PREVIA_SOLO_LECTURA.sql')),
    read(join(resolve(out), 'C16_02_APLICACION_DESACTIVADA.sql')),
    read(join(resolve(out), 'C16_03_REVERSION_DESACTIVADA.sql')),
  ]);

  assert.equal(manifest.status, 'PREPARED_NOT_APPLIED');
  assert.equal(manifest.stagingDatabase, target);
  assert.equal(manifest.records, 14);
  assert.equal(manifest.steps, 55);
  assert.equal(manifest.statementsEnabled, false);
  assert.equal(manifest.sequencesConfirmedByOperator, false);
  assert.equal(manifest.backupChecksum, sha(snapshot));
  assert.equal(proposal.status, 'PROPOSED_NOT_APPLIED');
  assert.equal(proposal.items.length, 14);
  assert.equal(proposal.items.reduce((n,x) => n + x.itinerary.length, 0), 55);

  const bySlug = new Map(proposal.items.map(x => [x.slug, x]));
  assert.equal(bySlug.size, 14);
  assert.equal(manifest.items.length, 14);
  for (const item of manifest.items) {
    const source = bySlug.get(item.slug);
    assert.ok(source, 'Unknown manifest slug ' + item.slug);
    assert.equal(item.steps, source.itinerary.length);
    assert.equal(item.proposedHash, sha(JSON.stringify(source.itinerary)));
    assert.equal(item.originalHash, sha('[]'));
  }

  for (const [label, sql] of [['preview', preview], ['apply', apply], ['rollback', rollback]]) {
    assert.match(sql, /USE \x60u424080957_quisqueya_core\x60;/,
      label + ' must select the intended schema');
  }

  assert.doesNotMatch(preview, /\b(?:UPDATE|INSERT|DELETE|DROP|TRUNCATE|ALTER)\s+(?:TABLE\s+)?experiences\b/i);
  assert.match(preview, /'C16_READY'/);
  for (const [label, sql, flag, verified] of [
    ['apply', apply, 'apply', '@c16_apply_verified'],
    ['rollback', rollback, 'rollback', '@c16_rb_verified'],
  ]) {
    assertFlagOff(sql, flag);
    assert.match(sql, /START TRANSACTION;/);
    assert.match(sql, /FOR UPDATE;/);
    assert.equal((sql.match(/\bUPDATE experiences AS e JOIN\b/g) || []).length, 1);
    assert.match(sql, /SET e\.itinerary_json = r\.next_json/);
    assert.equal((sql.match(/\bAS next_json\b/g) || []).length, 14);
    assert.match(sql, new RegExp('SET\\s+' + verified + '\\s*:=\\s*\\(SELECT COUNT\\(\\*\\)', 'i'));
    assert.match(sql, new RegExp(verified + "\\s*=\\s*14,\\s*'COMMIT'"));
    assert.match(sql, /ROLLBACK;/);
    assert.match(sql, /@c16_database_ok\s*=\s*1/);
    assert.doesNotMatch(sql, /\bSET\s+e\.(?!itinerary_json\b)/i,
      label + ' must not assign any other column');
  }
  for (const entry of proposal.items) {
    const encoded = Buffer.from(JSON.stringify(entry.itinerary), 'utf8').toString('hex');
    assert.ok(apply.includes('0x' + encoded), 'Missing exact payload for ' + entry.slug);
  }

  console.log('C16_SOURCE_STEPS=55');
  console.log('C16_BACKUP_HASH_MATCH=true');
  console.log('C16_SQL_PREVIEW_READ_ONLY=true');
  console.log('C16_SQL_APPLY_DISABLED=true');
  console.log('C16_SQL_ROLLBACK_DISABLED=true');
  console.log('C16_POST_UPDATE_HASH_GUARD=14');
  console.log('C16_SQL_WRITES_PERFORMED=NONE');
  console.log('C16_OFFLINE_SQL_QA_OK');
}

main().catch(err => { console.error('C16_OFFLINE_SQL_QA_STOP=' + err.message); process.exitCode = 1; });
