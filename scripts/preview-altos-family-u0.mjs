/**
 * U0: read-only preview of the four editorially confirmed Altos de Chavón packages.
 *
 * node scripts/preview-altos-family-u0.mjs             # reviewed seeds only
 * node scripts/preview-altos-family-u0.mjs --database  # local MySQL read-only check
 *
 * Does not create, update, publish or delete any database record.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';

export const PARENT_SLUG = 'altos-de-chavon';
export const PARENT_ID = 'manual-exp-altos-de-chavon-family';
const DESTINATION_SLUG = 'la-romana';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export const PACKAGES = Object.freeze([
  {
    slug: 'altos-de-chavon-medio-dia',
    id: 'manual-exp-altos-chavon-medio-dia',
    provider: 'MANUAL',
    label: 'Altos de Chavón – Medio Día',
    adult: 69,
    child: 35,
  },
  {
    slug: 'altos-de-chavon-cueva-de-las-maravillas',
    id: 'manual-exp-altos-chavon-cueva-maravillas',
    provider: 'MANUAL',
    label: 'Altos de Chavón + Cueva de las Maravillas',
    adult: 125,
    child: 65,
  },
  {
    slug: 'santo-domingo-city-tour-altos-de-chavon',
    id: 'manual-exp-santo-domingo-altos-chavon',
    provider: 'MANUAL',
    label: 'Altos de Chavón + Santo Domingo City Tour',
    adult: 145,
    child: 70,
  },
  {
    slug: 'aventura-en-buggies-y-altos-de-chavon',
    id: null, // Existing WordPress ID must be read from MySQL; never fabricate it.
    provider: 'WORDPRESS',
    label: 'Altos de Chavón + Aventura en Buggies',
    adult: null,
    child: null,
  },
]);

function ensure(condition, message) {
  if (!condition) throw new Error(`Altos U0 stop: ${message}`);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildPreview(primarySeed, secondSeed) {
  const incoming = [...(primarySeed?.experiences ?? []), ...(secondSeed?.experiences ?? [])];
  const packageSlugs = PACKAGES.map(item => item.slug);
  ensure(new Set(packageSlugs).size === 4 && !packageSlugs.includes(PARENT_SLUG),
    'package slugs must be unique and distinct from the parent');

  for (const item of PACKAGES.filter(entry => entry.provider === 'MANUAL')) {
    const matches = incoming.filter(row => row.slug === item.slug);
    ensure(matches.length === 1, `${item.slug}: expected one client seed record`);
    const source = matches[0];
    ensure(source.id === item.id, `${item.slug}: source ID drift`);
    ensure(source.pricing?.currency === 'USD' && source.pricing?.basis === 'person' &&
      Number(source.pricing?.adult) === item.adult && Number(source.pricing?.child) === item.child,
    `${item.slug}: pricing drift from the reviewed client document`);
  }

  return {
    parent: {
      id: PARENT_ID,
      slug: PARENT_SLUG,
      title: 'Altos de Chavón',
      status: 'DRAFT',
      sourceProvider: 'MANUAL',
      pricingMode: 'ON_REQUEST',
      displayJson: { experienceFamily: { version: 2, mode: 'multi_inquiry', packageSlugs } },
    },
    packageLabels: PACKAGES.map(({ slug, label }) => ({ slug, label })),
    sourceCoverage: {
      reviewedClientSeeds: 3,
      wordpressExistingRecordRequiresDatabaseVerification: PACKAGES[3].slug,
    },
  };
}

export async function inspectDatabase(prisma, preview) {
  const blockers = [];
  const warnings = [];
  const expected = preview.parent.displayJson.experienceFamily.packageSlugs;
  const [rows, existingById, possibleParents, destination] = await Promise.all([
    prisma.experience.findMany({
      where: { slug: { in: [...expected, PARENT_SLUG] } },
      select: {
        id: true, slug: true, status: true, sourceProvider: true, pricingMode: true,
        pricingJson: true, displayJson: true, featuredMediaId: true,
      },
    }),
    prisma.experience.findUnique({ where: { id: PARENT_ID }, select: { id: true, slug: true } }),
    prisma.experience.findMany({ select: { slug: true, displayJson: true } }),
    prisma.destination.findUnique({
      where: { slug: DESTINATION_SLUG }, select: { id: true, status: true, slug: true },
    }),
  ]);
  const bySlug = new Map(rows.map(row => [row.slug, row]));
  const existingParent = bySlug.get(PARENT_SLUG);
  if (existingById && existingById.slug !== PARENT_SLUG) blockers.push('parent ID belongs to another slug');
  if (existingParent && (existingParent.id !== PARENT_ID ||
    existingParent.sourceProvider !== 'MANUAL' ||
    existingParent.pricingMode !== 'ON_REQUEST' ||
    !['DRAFT', 'PUBLISHED'].includes(existingParent.status) ||
    !sameJson(existingParent.displayJson?.experienceFamily, preview.parent.displayJson.experienceFamily))) {
    blockers.push('existing parent conflicts with the confirmed four-package family');
  }
  if (!destination || destination.status !== 'PUBLISHED') {
    blockers.push('la-romana destination is absent or not PUBLISHED');
  }

  const packages = PACKAGES.map(item => {
    const row = bySlug.get(item.slug);
    if (!row) blockers.push(`missing package: ${item.slug}`);
    else {
      if (row.sourceProvider !== item.provider) blockers.push(`${item.slug}: unexpected source provider`);
      if (item.id && row.id !== item.id) blockers.push(`${item.slug}: seed ID mismatch`);
      if (item.provider === 'MANUAL' &&
        (row.pricingJson?.currency !== 'USD' || row.pricingJson?.basis !== 'person' ||
         Number(row.pricingJson?.adult) !== item.adult ||
         Number(row.pricingJson?.child) !== item.child)) {
        blockers.push(`${item.slug}: pricing differs from client seed`);
      }
      if (row.status !== 'PUBLISHED') warnings.push(`${item.slug}: ${row.status}; cannot appear as a public package yet`);
      if (!row.featuredMediaId) warnings.push(`${item.slug}: no featuredMediaId`);
    }
    return {
      slug: item.slug,
      displayLabel: item.label,
      exists: Boolean(row),
      status: row?.status ?? null,
      sourceProvider: row?.sourceProvider ?? null,
      hasFeaturedMedia: Boolean(row?.featuredMediaId),
    };
  });

  for (const other of possibleParents) {
    if (other.slug === PARENT_SLUG) continue;
    const claimed = other.displayJson?.experienceFamily?.packageSlugs;
    if (Array.isArray(claimed)) {
      for (const slug of expected) {
        if (claimed.includes(slug)) blockers.push(`${slug}: already claimed by parent ${other.slug}`);
      }
    }
  }

  return {
    operation: 'READ_ONLY',
    parent: existingParent ? { slug: existingParent.slug, status: existingParent.status } : null,
    proposedParentSlug: PARENT_SLUG,
    proposedPackageCount: expected.length,
    packages,
    destination: destination?.slug ?? null,
    blockers,
    warnings,
    readyForDraftParentPreparation: blockers.length === 0,
    readyForPublicFamily: blockers.length === 0 && packages.every(p => p.status === 'PUBLISHED') &&
      existingParent?.status === 'PUBLISHED',
    writesPerformed: false,
  };
}

async function main() {
  const args = process.argv.slice(2);
  ensure(args.length === 0 || (args.length === 1 && args[0] === '--database'),
    'usage: node scripts/preview-altos-family-u0.mjs [--database] (no --apply)');

  const primarySeed = JSON.parse(await readFile(new URL(
    '../data/content/client-experiences-2026-09.seed.json', import.meta.url), 'utf8'));
  const secondSeed = JSON.parse(await readFile(new URL(
    '../data/content/client-experiences-2026-09-second-part.seed.json', import.meta.url), 'utf8'));
  const preview = buildPreview(primarySeed, secondSeed);
  if (!args.includes('--database')) {
    console.log(JSON.stringify({ mode: 'seed-only', ...preview, writesPerformed: false }, null, 2));
    return;
  }

  await import('dotenv/config');
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const database = process.env.MYSQL_DATABASE || 'quisqueya_core';
  ensure(LOCAL_HOSTS.has(host), `non-local database host is not allowed: ${host}`);
  ensure(!['staging', 'production'].includes((process.env.APP_ENV || '').toLowerCase()),
    'APP_ENV staging/production is not allowed for local preflight');
  ensure(Number.isInteger(port) && port > 0 && port <= 65535, 'invalid local database port');

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
    const inspection = await inspectDatabase(prisma, preview);
    console.log(JSON.stringify({ mode: 'local-database-read-only', target: { host, port, database },
      ...inspection }, null, 2));
    if (inspection.blockers.length) process.exitCode = 2;
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
