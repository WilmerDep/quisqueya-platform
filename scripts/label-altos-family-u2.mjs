/**
 * U2: add only approved presentation labels to the existing Altos DRAFT parent.
 *
 * node scripts/label-altos-family-u2.mjs           # local MySQL dry-run
 * node scripts/label-altos-family-u2.mjs --apply   # update parent displayJson only
 *
 * Historical child slugs, titles, providers, pricing and publication stay untouched.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import console from 'node:console';
import process from 'node:process';
import { inspectPreparation } from './create-altos-family-parent-u1.mjs';
import { buildPreview, PACKAGES, PARENT_ID, PARENT_SLUG } from './preview-altos-family-u0.mjs';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
export const PACKAGE_LABELS = Object.freeze(Object.fromEntries(
  PACKAGES.map(({ slug, label }) => [slug, label]),
));

function guard(condition, message) {
  if (!condition) throw new Error(`Altos U2 safety stop: ${message}`);
}

export async function inspectLabels(prisma, preview) {
  const preparation = await inspectPreparation(prisma, preview);
  guard(preparation.operation === 'NOOP_ALREADY_PREPARED',
    'the approved Altos DRAFT parent and primary la-romana relation must exist first');

  const parent = await prisma.experience.findUnique({
    where: { id: PARENT_ID },
    select: { id: true, slug: true, title: true, status: true, displayJson: true },
  });
  guard(parent?.slug === PARENT_SLUG && parent.status === 'DRAFT',
    'parent identity or DRAFT state changed');
  const display = parent.displayJson;
  guard(display && typeof display === 'object' && !Array.isArray(display),
    'parent displayJson must be an object');

  const existingLabels = display.experiencePackageLabels;
  guard(existingLabels === undefined || isDeepStrictEqual(existingLabels, PACKAGE_LABELS),
    'existing presentation labels conflict with the four confirmed package names');

  return {
    operation: existingLabels === undefined ? 'ADD_PRESENTATION_LABELS' : 'NOOP_LABELS_READY',
    parent: { id: parent.id, slug: parent.slug, status: parent.status },
    displayJson: display,
    packageCount: preparation.packageCount,
    labels: PACKAGE_LABELS,
    warnings: preparation.warnings,
  };
}

export async function applyLabels(prisma, preview) {
  const inspection = await inspectLabels(prisma, preview);
  if (inspection.operation === 'NOOP_LABELS_READY') {
    return { operation: inspection.operation, writesPerformed: false, parent: inspection.parent };
  }

  return prisma.$transaction(async tx => {
    const verified = await inspectLabels(tx, preview);
    guard(verified.operation === 'ADD_PRESENTATION_LABELS', 'presentation labels changed after preflight');
    const updated = await tx.experience.update({
      where: { id: PARENT_ID },
      data: { displayJson: { ...verified.displayJson, experiencePackageLabels: PACKAGE_LABELS } },
      select: { id: true, slug: true, status: true, displayJson: true },
    });
    return { operation: 'ADD_PRESENTATION_LABELS', writesPerformed: true,
      parent: { id: updated.id, slug: updated.slug, status: updated.status } };
  });
}

async function loadPreview() {
  const [first, second] = await Promise.all([
    readFile(new URL('../data/content/client-experiences-2026-09.seed.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/content/client-experiences-2026-09-second-part.seed.json', import.meta.url), 'utf8'),
  ]);
  return buildPreview(JSON.parse(first), JSON.parse(second));
}

async function main() {
  const args = process.argv.slice(2);
  guard(args.length === 0 || (args.length === 1 && args[0] === '--apply'),
    'usage: node scripts/label-altos-family-u2.mjs [--apply]');
  const apply = args.includes('--apply');
  await import('dotenv/config');

  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const database = process.env.MYSQL_DATABASE || 'quisqueya_core';
  guard(LOCAL_HOSTS.has(host), `non-local database host is forbidden: ${host}`);
  guard(database === 'quisqueya_core', `unexpected database: ${database}`);
  guard(!['staging', 'production'].includes((process.env.APP_ENV || '').toLowerCase()),
    'staging/production APP_ENV is forbidden');
  guard(Number.isInteger(port) && port > 0 && port <= 65535, 'invalid local MySQL port');

  const preview = await loadPreview();
  const [{ PrismaClient }, { PrismaMariaDb }] = await Promise.all([
    import('@prisma/client'), import('@prisma/adapter-mariadb'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
    host, port, database,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    connectionLimit: 2,
  }) });
  try {
    const inspection = await inspectLabels(prisma, preview);
    const outcome = apply
      ? await applyLabels(prisma, preview)
      : { operation: inspection.operation, writesPerformed: false, parent: inspection.parent };
    console.log(JSON.stringify({
      mode: apply ? 'local-apply' : 'local-dry-run',
      target: { host, port, database },
      ...outcome,
      labels: inspection.labels,
      checks: { packageCount: inspection.packageCount, warnings: inspection.warnings,
        originalChildTitlesModified: false, originalSlugsModified: false,
        publishedContentModified: false },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    let detail = String(error?.message ?? 'Unknown error');
    for (const secret of [process.env.MYSQL_PASSWORD, process.env.DATABASE_URL]
      .filter(value => typeof value === 'string' && value.length >= 3)) {
      detail = detail.replaceAll(secret, '[REDACTED]');
    }
    console.error(JSON.stringify({ status: 'STOP', detail: detail.slice(0, 900) }));
    process.exitCode = 1;
  });
}
