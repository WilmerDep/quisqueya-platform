/**
 * C16 - offline-only generator. Never connects to staging.
 * Requires the real phpMyAdmin JSON backup of the 14 PUBLISHED records.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE = 'u424080957_quisqueya_core';
const EXPECTED = 14;
const hash = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const quote = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const hex = (s) => 'CONVERT(0x' + Buffer.from(s, 'utf8').toString('hex') + ' USING utf8mb4)';
const load = async (p) => JSON.parse((await readFile(p, 'utf8')).replace(/^\uFEFF/, ''));
const parameter = (flag) => { const i = process.argv.indexOf(flag); return i < 0 ? undefined : process.argv[i + 1]; };
const required = (v, name) => { assert.ok(typeof v === 'string' && v.trim(), 'Missing ' + name); return v; };

function reference(rows, includePayload, restore) {
  return rows.map((r, i) => {
    const bits = [
      quote(r.seed.id) + ' AS id', quote(r.seed.slug) + ' AS slug',
      quote(r.backup.updated_at) + ' AS expected_at',
      quote(restore ? hash(JSON.stringify(r.proposal.itinerary)) : r.backup.itinerary_checksum) + ' AS expected_sha',
    ];
    if (includePayload) bits.push(hex(restore ? r.backup.itinerary_json : JSON.stringify(r.proposal.itinerary)) + ' AS next_json');
    return (i ? 'UNION ALL SELECT ' : 'SELECT ') + bits.join(', ');
  }).join('\n');
}

function conditions(restore) {
  return [
    "e.status = 'PUBLISHED'", "e.source_provider = 'MANUAL'",
    "SHA2(COALESCE(CAST(e.itinerary_json AS CHAR), 'NULL'), 256) = r.expected_sha",
    ...(restore ? [] : ['e.updated_at = r.expected_at']),
  ].join(' AND ');
}

function verifySql(rows) {
  return [
    '-- C16 01 / READ ONLY / No database changes.',
    '-- Select database ' + DATABASE + ' in phpMyAdmin before executing.',
    'USE `'+ DATABASE +'`;',
    'SELECT e.id, e.slug, e.status, e.source_provider, e.updated_at,',
    '       COALESCE(JSON_LENGTH(e.itinerary_json),0) AS itinerary_steps,',
    "       CASE WHEN " + conditions(false) + " THEN 'C16_READY' ELSE 'STOP_REVIEW' END AS c16_result",
    'FROM experiences AS e JOIN (', reference(rows, false, false),
    ') AS r ON e.id=r.id AND e.slug=r.slug',
    'ORDER BY e.slug;', '',
  ].join('\n');
}

function mutationSql(rows, restore) {
  const flag = restore ? '@c16_allow_rollback' : '@c16_allow_apply';
  const ready = restore ? '@c16_rb_ready' : '@c16_apply_ready';
  const changed = restore ? '@c16_rb_changed' : '@c16_apply_changed';
  const verified = restore ? '@c16_rb_verified' : '@c16_apply_verified';
  const finish = restore ? '@c16_rb_finish' : '@c16_apply_finish';
  const rowsCondition = rows.map((r) => '  (' + quote(r.seed.id) + ', ' + quote(r.seed.slug) + ')').join(',\n');
  return [
    '-- C16 ' + (restore ? '03 RESTORE' : '02 APPLY') + ' / IMPORTANT: DISABLED BY DEFAULT.',
    '-- NEVER execute without a reviewed 14-row staging snapshot and editorial authorization.',
    '-- Intended for MariaDB. Paste the FULL SCRIPT as a SINGLE request in phpMyAdmin.',
    '-- Changes ONLY itinerary_json. If fewer than 14 rows qualify, ROLLBACK.',
    '-- If an SQL error occurs, do not issue COMMIT manually.',
    'SET NAMES utf8mb4;',
    'USE `'+DATABASE+'`;',
    'SET ' + flag + ' := 0;',
    'SET @c16_database_ok := (DATABASE() = ' + quote(DATABASE) + ');',
    'START TRANSACTION;',
    'SELECT id, slug FROM experiences WHERE (id,slug) IN (', rowsCondition, ') FOR UPDATE;',
    'SET ' + ready + ' := (SELECT COUNT(*) FROM experiences AS e JOIN (',
    reference(rows, false, restore),
    ') AS r ON e.id=r.id AND e.slug=r.slug WHERE ' + conditions(restore) + ');',
    'UPDATE experiences AS e JOIN (', reference(rows, true, restore),
    ') AS r ON e.id=r.id AND e.slug=r.slug',
    'SET e.itinerary_json = r.next_json',
    'WHERE ' + flag + ' = 1 AND @c16_database_ok = 1 AND ' + ready + ' = 14',
    '  AND ' + conditions(restore) + ';',
    'SET ' + changed + ' := ROW_COUNT();',
    '-- Validate the exact expected JSON content for all 14 records before COMMIT.',
    'SET ' + verified + ' := (SELECT COUNT(*) FROM experiences AS e JOIN (',
    reference(rows, false, !restore),
    ') AS r ON e.id = r.id AND e.slug = r.slug',
    'WHERE e.status = \'PUBLISHED\' AND e.source_provider = \'MANUAL\'',
    'AND SHA2(COALESCE(CAST(e.itinerary_json AS CHAR), \'NULL\'), 256) = r.expected_sha);',
    '-- Conditional COMMIT only after exactly 14 matched, updated AND checksum-verified. Otherwise ROLLBACK.',
    'SET ' + finish + ' := IF(' + flag + ' = 1 AND @c16_database_ok = 1 AND ' + ready + ' = 14 AND ' + changed + ' = 14 AND ' + verified + " = 14, 'COMMIT', 'SELECT 0 AS c16_not_committed');",
    'PREPARE c16_finish_statement FROM ' + finish + ';',
    'EXECUTE c16_finish_statement;',
    'DEALLOCATE PREPARE c16_finish_statement;',
    'ROLLBACK;',
    'SELECT @c16_database_ok AS c16_database_ok, ' + flag + ' AS c16_authorized,',
    '       ' + ready + ' AS c16_ready_rows, ' + changed + ' AS c16_written_rows, ' + verified + ' AS c16_verified_rows,',
    "       IF(" + flag + ' = 1 AND @c16_database_ok = 1 AND ' + ready + ' = 14 AND ' + changed + ' = 14 AND ' + verified + " = 14, 'C16_COMMITTED', 'C16_NOT_APPLIED') AS c16_status;",
    'SELECT id,slug,status,source_provider,updated_at,',
    '       COALESCE(JSON_LENGTH(itinerary_json),0) AS itinerary_steps,',
    "       SHA2(COALESCE(CAST(itinerary_json AS CHAR),'NULL'),256) AS itinerary_checksum",
    'FROM experiences WHERE (id,slug) IN (', rowsCondition, ') ORDER BY slug;', '',
  ].join('\n');
}

async function main() {
  const backupPath = parameter('--backup');
  const outputPath = parameter('--out-dir');
  assert.ok(backupPath && outputPath, 'Usage: node scripts/prepare-staging-itineraries-c16.mjs --backup "file.json" --out-dir "folder"');
  const source = await load(resolve(backupPath));
  assert.ok(Array.isArray(source));
  assert.ok(source.some((v) => v.type === 'database' && v.name === DATABASE), 'Wrong database in export');
  const tableItems = source.filter((v) => v.type === 'table');
  assert.equal(tableItems.length, 1, 'Exactly one table export required');
  assert.equal(tableItems[0].name, 'experiences');
  assert.equal(tableItems[0].database, DATABASE);
  const backups = tableItems[0].data;
  assert.equal(backups.length, EXPECTED, 'Backup must hold 14 rows');

  const [proposal, bavaro, hacienda] = await Promise.all([
    load(join(root, 'data/content/itinerary-proposals-2026-11-bavaro-hacienda.json')),
    load(join(root, 'data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json')),
    load(join(root, 'data/content/client-experiences-2026-09-la-hacienda-park.seed.json')),
  ]);
  assert.equal(proposal.status, 'PROPOSED_NOT_APPLIED');
  assert.equal(proposal.items.length, EXPECTED);
  const seeds = [...bavaro.experiences, ...hacienda.experiences];
  assert.equal(seeds.length, EXPECTED);
  const b = new Map(backups.map((row) => [row.slug, row]));
  const p = new Map(proposal.items.map((row) => [row.slug, row]));
  const s = new Map(seeds.map((row) => [row.slug, row]));
  assert.equal(b.size, EXPECTED, 'Duplicate backup slug');
  assert.equal(p.size, EXPECTED, 'Duplicate proposal slug');
  assert.equal(s.size, EXPECTED, 'Duplicate seed slug');
  const rows = [];
  for (const [slug, seed] of s) {
    const backup = b.get(slug), item = p.get(slug);
    assert.ok(backup && item, 'Backup and proposal required: ' + slug);
    assert.equal(backup.id, seed.id, 'ID mismatch: ' + slug);
    assert.equal(backup.status, 'PUBLISHED');
    assert.equal(backup.source_provider, 'MANUAL');
    assert.match(required(backup.updated_at, 'updated_at'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(backup.itinerary_json, '[]', 'Existing itinerary must not be overwritten');
    assert.equal(Number(backup.itinerary_steps), 0);
    assert.equal(backup.itinerary_checksum, hash(backup.itinerary_json));
    assert.equal(item.reviewStatus, 'editorial_proposal');
    assert.equal(item.operatorSequenceConfirmed, false);
    assert.ok(item.itinerary.length >= 3 && item.itinerary.length <= 6);
    for (const step of item.itinerary) {
      for (const key of ['time','title','desc']) required(step[key], slug + '.' + key);
      assert.ok(!/\b\d{1,2}:\d{2}\b/.test(step.time));
    }
    rows.push({ seed, backup, proposal: item });
  }
  rows.sort((a,b) => a.seed.slug.localeCompare(b.seed.slug, 'en'));
  const dir = resolve(outputPath);
  await mkdir(dir, { recursive: true });
  const outputs = [
    ['C16_01_PREVIA_SOLO_LECTURA.sql', verifySql(rows)],
    ['C16_02_APLICACION_DESACTIVADA.sql', mutationSql(rows, false)],
    ['C16_03_REVERSION_DESACTIVADA.sql', mutationSql(rows, true)],
  ];
  for (const [filename, text] of outputs) await writeFile(join(dir, filename), text, 'utf8');
  const manifest = {
    status: 'PREPARED_NOT_APPLIED', stagingDatabase: DATABASE,
    backupChecksum: hash(await readFile(resolve(backupPath), 'utf8')),
    records: rows.length,
    steps: rows.reduce((n,x) => n+x.proposal.itinerary.length, 0),
    statementsEnabled: false,
    sequencesConfirmedByOperator: false,
    items: rows.map(({ seed, backup, proposal }) => ({
      id: seed.id, slug: seed.slug, updatedAtAtBackup: backup.updated_at,
      originalHash: backup.itinerary_checksum,
      proposedHash: hash(JSON.stringify(proposal.itinerary)), steps: proposal.itinerary.length,
    })),
  };
  await writeFile(join(dir, 'C16_04_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('C16_BACKUP_VALID=14');
  console.log('C16_PROPOSED_STEPS=' + manifest.steps);
  console.log('C16_OUTPUT_FILES=4');
  console.log('C16_APPLY_ENABLED=false');
  console.log('C16_DB_WRITES=NONE');
  console.log('C16_OUTPUT=' + dir);
}

main().catch((error) => { console.error('C16_STOP=' + error.message); process.exitCode = 1; });
