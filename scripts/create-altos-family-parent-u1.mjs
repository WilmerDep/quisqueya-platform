/**
 * U1: prepare only the Altos de Chavón family parent in local MySQL.
 *
 * node scripts/create-altos-family-parent-u1.mjs           # local database dry-run
 * node scripts/create-altos-family-parent-u1.mjs --apply   # one MANUAL DRAFT parent + destination
 *
 * Never edits or publishes any of the four existing packages.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { buildPreview, inspectDatabase, PARENT_ID, PARENT_SLUG } from './preview-altos-family-u0.mjs';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function guard(condition, message) {
  if (!condition) throw new Error(`Altos U1 safety stop: ${message}`);
}

export async function inspectPreparation(prisma, preview) {
  const inspection = await inspectDatabase(prisma, preview);
  guard(inspection.blockers.length === 0, inspection.blockers.join('; '));
  guard(inspection.proposedPackageCount === 4, 'expected exactly four confirmed packages');
  guard(inspection.packages.every(child => child.exists && ['DRAFT', 'PUBLISHED'].includes(child.status)),
    'missing or archived package');

  const destination = await prisma.destination.findUnique({
    where: { slug: 'la-romana' }, select: { id: true, slug: true, status: true },
  });
  guard(destination?.status === 'PUBLISHED' && Boolean(destination.id),
    'la-romana destination has changed or has no ID');

  const parent = await prisma.experience.findUnique({
    where: { slug: PARENT_SLUG },
    select: { id: true, slug: true, title: true, status: true, sourceProvider: true,
      pricingMode: true, displayJson: true },
  });
  guard(!parent || (parent.id === PARENT_ID && parent.title === preview.parent.title &&
    parent.status === 'DRAFT' && parent.sourceProvider === 'MANUAL' &&
    parent.pricingMode === 'ON_REQUEST'),
  'existing parent is not the expected MANUAL DRAFT; review before proceeding');

  if (parent) {
    const relations = await prisma.experienceDestination.findMany({
      where: { experienceId: PARENT_ID }, select: { destinationId: true, isPrimary: true },
    });
    guard(relations.length === 1 && relations[0].destinationId === destination.id &&
      relations[0].isPrimary === true,
    'existing parent destination association differs from primary la-romana');
  }

  return {
    operation: parent ? 'NOOP_ALREADY_PREPARED' : 'CREATE_DRAFT_PARENT',
    parentBefore: parent ? { id: parent.id, slug: parent.slug, status: parent.status } : null,
    packageCount: inspection.packages.length,
    packageStatuses: inspection.packages.map(child => ({ slug: child.slug, status: child.status,
      sourceProvider: child.sourceProvider })),
    destination: { id: destination.id, slug: destination.slug },
    warnings: inspection.warnings,
  };
}

export async function applyParent(prisma, preview) {
  const inspection = await inspectPreparation(prisma, preview);
  if (inspection.operation === 'NOOP_ALREADY_PREPARED') {
    return { operation: inspection.operation, writesPerformed: false, parent: inspection.parentBefore };
  }

  return prisma.$transaction(async tx => {
    const verified = await inspectPreparation(tx, preview);
    guard(verified.operation === 'CREATE_DRAFT_PARENT', 'parent changed after preflight');
    const parent = await tx.experience.create({
      data: { ...preview.parent, editorialFlagsJson: [{
        code: 'MEDIA_PENDING_LIBRARY_REVIEW',
        severity: 'warning',
        message: 'Imagen del padre pendiente de revisión editorial; no usar imágenes externas sin atribución.',
      }] },
      select: { id: true, slug: true, title: true, status: true, sourceProvider: true, displayJson: true },
    });
    await tx.experienceDestination.create({
      data: { experienceId: parent.id, destinationId: verified.destination.id, isPrimary: true },
    });
    return { operation: 'CREATE_DRAFT_PARENT', writesPerformed: true, parent };
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
    'usage: node scripts/create-altos-family-parent-u1.mjs [--apply]');
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
    const inspection = await inspectPreparation(prisma, preview);
    const outcome = apply
      ? await applyParent(prisma, preview)
      : { operation: inspection.operation, proposedParent: preview.parent, writesPerformed: false };
    console.log(JSON.stringify({
      mode: apply ? 'local-apply' : 'local-dry-run',
      target: { host, port, database },
      ...outcome,
      checks: { packageCount: inspection.packageCount,
        packageStatuses: inspection.packageStatuses,
        destination: inspection.destination.slug,
        warnings: inspection.warnings,
        existingPackagesModified: false,
        publicContentModified: false },
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
