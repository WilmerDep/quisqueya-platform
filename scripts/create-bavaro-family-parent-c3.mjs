/**
 * C3: prepare the Bávaro Adventure Park parent in the authorized local MySQL database.
 *
 * node scripts/create-bavaro-family-parent-c3.mjs           # database dry-run
 * node scripts/create-bavaro-family-parent-c3.mjs --apply   # create one MANUAL DRAFT parent
 *
 * This script never publishes or updates experiences. Repeated --apply is a no-op
 * when the expected parent DRAFT already exists.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PARENT_SLUG = 'bavaro-adventure-park';
export const PARENT_ID = 'manual-exp-bavaro-adventure-park';
const SEED_FILE = 'data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function guard(condition, message) {
  if (!condition) throw new Error(`C3 safety stop: ${message}`);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildProposal(seed) {
  const packages = seed?.experiences;
  guard(seed?.family?.key === PARENT_SLUG, 'unexpected family key');
  guard(typeof seed.family.label === 'string' && seed.family.label.trim(), 'parent title is missing');
  guard(Array.isArray(seed.family.destinationSlugs) &&
    sameJson(seed.family.destinationSlugs, ['punta-cana']), 'unexpected parent destinations');
  guard(Array.isArray(packages) && packages.length === 13, 'exactly 13 packages are required');
  const slugs = packages.map(item => item.slug);
  const ids = packages.map(item => item.id);
  guard(slugs.every(slug => typeof slug === 'string' && SLUG_PATTERN.test(slug)), 'invalid package slug');
  guard(new Set(slugs).size === 13 && !slugs.includes(PARENT_SLUG), 'duplicate/self-referencing package slug');
  guard(ids.every(id => typeof id === 'string' && id.length > 0) &&
    new Set(ids).size === 13 && !ids.includes(PARENT_ID), 'duplicate/self-referencing package ID');
  guard(packages.every(item => item.operation === 'create_draft' &&
    item.familyKey === PARENT_SLUG && item.familyContextRef === PARENT_SLUG), 'inconsistent family membership');
  guard(packages.every(item => item.pricing?.currency === 'USD' && item.pricing?.basis === 'person' &&
    Number.isFinite(item.pricing?.from)), 'unexpected package pricing');

  return {
    id: PARENT_ID,
    slug: PARENT_SLUG,
    title: seed.family.label.trim(),
    status: 'DRAFT',
    sourceProvider: 'MANUAL',
    pricingMode: 'ON_REQUEST',
    displayJson: {
      experienceFamily: { version: 2, mode: 'multi_inquiry', packageSlugs: slugs },
    },
    editorialFlagsJson: [{
      code: 'MEDIA_PENDING_LIBRARY_REVIEW',
      severity: 'warning',
      message: 'Imagen principal del padre pendiente de selección y revisión editorial.',
    }],
    provenanceJson: {
      familyKey: PARENT_SLUG,
      source: seed.source ?? null,
      dataset: SEED_FILE.split('/').at(-1),
      receivedAt: seed.receivedAt ?? null,
      note: 'C3 MANUAL DRAFT: linked package slugs only; no inherited prices or inclusions.',
    },
  };
}

export async function inspectDatabase(prisma, seed, proposal) {
  const packages = seed.experiences;
  const slugs = proposal.displayJson.experienceFamily.packageSlugs;
  const parentBySlug = await prisma.experience.findUnique({
    where: { slug: PARENT_SLUG },
    select: { id: true, slug: true, status: true, sourceProvider: true, pricingMode: true, displayJson: true },
  });
  const parentById = await prisma.experience.findUnique({
    where: { id: PARENT_ID }, select: { id: true, slug: true },
  });

  guard(!parentById || parentById.slug === PARENT_SLUG, 'parent ID belongs to another slug');
  guard(!parentById || parentBySlug?.id === PARENT_ID, 'parent ID/slug lookup is inconsistent');
  guard(!parentBySlug || (parentBySlug.id === PARENT_ID &&
    parentBySlug.status === 'DRAFT' && parentBySlug.sourceProvider === 'MANUAL' &&
    parentBySlug.pricingMode === 'ON_REQUEST' &&
    sameJson(parentBySlug.displayJson?.experienceFamily, proposal.displayJson.experienceFamily)),
  'existing parent differs from the expected MANUAL DRAFT; no overwrite permitted');

  const children = await prisma.experience.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true, slug: true, status: true, sourceProvider: true,
      includedItemsJson: true, excludedItemsJson: true, pricingJson: true, featuredMediaId: true,
    },
  });
  const bySlug = new Map(children.map(child => [child.slug, child]));
  guard(children.length === 13 && packages.every(item => bySlug.has(item.slug)), 'one or more of the 13 packages are missing');
  for (const item of packages) {
    const child = bySlug.get(item.slug);
    guard(child.id === item.id && child.sourceProvider === 'MANUAL' && child.status === 'DRAFT',
      `${item.slug}: expected the original MANUAL DRAFT`);
    guard(sameJson(child.includedItemsJson ?? [], item.included ?? []) &&
      sameJson(child.excludedItemsJson ?? [], item.excluded ?? []),
    `${item.slug}: included/excluded items differ from the reviewed seed`);
    const price = child.pricingJson;
    guard(price?.currency === item.pricing.currency && price?.basis === item.pricing.basis &&
      Number(price?.from) === Number(item.pricing.from), `${item.slug}: price differs from the reviewed seed`);
  }

  const otherParents = await prisma.experience.findMany({
    where: { slug: { not: PARENT_SLUG } },
    select: { slug: true, displayJson: true },
  });
  for (const row of otherParents) {
    const family = row.displayJson?.experienceFamily;
    if (Array.isArray(family?.packageSlugs)) {
      guard(!family.packageSlugs.some(slug => slugs.includes(slug)),
        `package already belongs to another parent: ${row.slug}`);
    }
  }

  const destination = await prisma.destination.findUnique({
    where: { slug: 'punta-cana' }, select: { id: true, slug: true, status: true },
  });
  guard(destination?.status === 'PUBLISHED', 'destination punta-cana must exist and be PUBLISHED');
  if (parentBySlug) {
    const relation = await prisma.experienceDestination.findUnique({
      where: { experienceId_destinationId: { experienceId: PARENT_ID, destinationId: destination.id } },
      select: { isPrimary: true },
    });
    guard(relation?.isPrimary === true, 'existing parent has no primary Punta Cana destination; manual review required');
  }

  return {
    operation: parentBySlug ? 'NOOP_ALREADY_PREPARED' : 'CREATE_DRAFT_PARENT',
    parentBefore: parentBySlug ? { id: parentBySlug.id, status: parentBySlug.status } : null,
    childCount: children.length,
    childrenWithoutFeaturedMedia: children.filter(child => !child.featuredMediaId).map(child => child.slug),
    destination,
  };
}

export async function applyParent(prisma, seed, proposal) {
  const inspection = await inspectDatabase(prisma, seed, proposal);
  if (inspection.operation === 'NOOP_ALREADY_PREPARED') {
    return { operation: inspection.operation, writesPerformed: false, parent: inspection.parentBefore };
  }

  return prisma.$transaction(async tx => {
    const verified = await inspectDatabase(tx, seed, proposal);
    guard(verified.operation === 'CREATE_DRAFT_PARENT', 'parent changed after the preflight');
    const parent = await tx.experience.create({
      data: proposal,
      select: { id: true, slug: true, status: true, sourceProvider: true, displayJson: true },
    });
    await tx.experienceDestination.create({
      data: { experienceId: parent.id, destinationId: verified.destination.id, isPrimary: true },
    });
    return { operation: 'CREATE_DRAFT_PARENT', writesPerformed: true, parent };
  });
}

async function main() {
  const args = process.argv.slice(2);
  guard(args.length === 0 || (args.length === 1 && args[0] === '--apply'),
    'usage: node scripts/create-bavaro-family-parent-c3.mjs [--apply]');
  const apply = args.includes('--apply');
  await import('dotenv/config');

  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const database = process.env.MYSQL_DATABASE || 'quisqueya_core';
  guard(LOCAL_HOSTS.has(host), `remote MySQL host is not authorized for C3: ${host}`);
  guard(!['production', 'staging'].includes((process.env.APP_ENV || '').toLowerCase()),
    'staging/production APP_ENV is not authorized for C3');
  guard(Number.isInteger(port) && port > 0 && port <= 65535, 'invalid MySQL port');

  const seed = JSON.parse(await readFile(resolve(SEED_FILE), 'utf8'));
  const proposal = buildProposal(seed);
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
    const inspection = await inspectDatabase(prisma, seed, proposal);
    const result = apply
      ? await applyParent(prisma, seed, proposal)
      : { operation: inspection.operation, writesPerformed: false, proposedParent: proposal };
    console.log(JSON.stringify({
      mode: apply ? 'local-apply' : 'local-dry-run',
      target: { host, port, database },
      ...result,
      checks: {
        childCount: inspection.childCount,
        destination: inspection.destination.slug,
        childrenWithoutFeaturedMedia: inspection.childrenWithoutFeaturedMedia,
        publishedContentModified: false,
      },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    let detail = String(error?.message ?? 'Unknown error');
    for (const secret of [process.env.MYSQL_PASSWORD, process.env.DATABASE_URL]
      .filter(value => typeof value === 'string' && value.length >= 3)) {
      detail = detail.replaceAll(secret, '[REDACTED]');
    }
    console.error(JSON.stringify({ status: 'STOP', code: error?.code ?? 'C3_GUARD', detail: detail.slice(0, 1200) }));
    process.exitCode = 1;
  });
}
