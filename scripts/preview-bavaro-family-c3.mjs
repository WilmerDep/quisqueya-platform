/**
 * C3: preflight read-only for the Bávaro experience family.
 *
 * node scripts/preview-bavaro-family-c3.mjs              # seed only
 * node scripts/preview-bavaro-family-c3.mjs --database   # additionally inspect local MySQL via Prisma
 *
 * No --apply mode exists. This script never writes data.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PARENT_SLUG = 'bavaro-adventure-park';
const PARENT_ID = 'manual-exp-bavaro-adventure-park';
const args = process.argv.slice(2);

if (args.some(arg => arg !== '--database') || args.filter(arg => arg === '--database').length > 1) {
  console.error('Usage: node scripts/preview-bavaro-family-c3.mjs [--database]');
  process.exit(2);
}

const seedPath = resolve('data/content/client-experiences-2026-09-bavaro-adventure-park.seed.json');
const payload = JSON.parse(await readFile(seedPath, 'utf8'));
const experiences = payload.experiences;

function assert(condition, message) {
  if (!condition) throw new Error(`C3 safety stop: ${message}`);
}

assert(payload.family?.key === PARENT_SLUG, 'unexpected family key');
assert(Array.isArray(experiences) && experiences.length === 13, 'exactly 13 packages required');

const slugs = experiences.map(item => item.slug);
const ids = experiences.map(item => item.id);
assert(slugs.every(slug => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)), 'invalid slug');
assert(new Set(slugs).size === 13 && !slugs.includes(PARENT_SLUG), 'duplicate/self-referencing package');
assert(new Set(ids).size === 13 && !ids.includes(PARENT_ID), 'duplicate/self-referencing package ID');
assert(experiences.every(item => item.operation === 'create_draft' &&
  item.familyKey === PARENT_SLUG && item.familyContextRef === PARENT_SLUG), 'inconsistent family membership');

const expectedLunch = new Set([
  'buggy-vip', 'zipline-mega-splash', 'sacred-river', 'buggy-zipline',
  'buggy-party-boat', 'polaris-vip', 'polaris-zipline', 'full-access-buggy',
].map(suffix => `${PARENT_SLUG}-${suffix}`));
const expectedDinner = new Set([
  'sacred-river-de-noche', 'polaris-de-noche',
].map(suffix => `${PARENT_SLUG}-${suffix}`));
const lunchWithoutDrinks = new Set([
  'buggy-vip', 'zipline-mega-splash', 'sacred-river', 'buggy-zipline',
  'polaris-vip', 'full-access-buggy',
].map(suffix => `${PARENT_SLUG}-${suffix}`));
const noMealSpecified = new Set([
  'sacred-river-zipline', 'full-access-polaris',
].map(suffix => `${PARENT_SLUG}-${suffix}`));

const foodWarnings = [];
for (const item of experiences) {
  const includes = (item.included ?? []).join(' ').toLowerCase();
  const excludes = (item.excluded ?? []).join(' ').toLowerCase();
  if (includes.includes('desayuno')) foodWarnings.push(`${item.slug}: desayuno no respaldado por el Word`);
  if (expectedLunch.has(item.slug) && !includes.includes('almuerzo')) {
    foodWarnings.push(`${item.slug}: falta almuerzo documentado`);
  }
  if (expectedDinner.has(item.slug) && !includes.includes('cena')) {
    foodWarnings.push(`${item.slug}: falta cena documentada`);
  }
  if (lunchWithoutDrinks.has(item.slug) &&
      (!includes.includes('sin bebidas') || !excludes.includes('bebidas durante el almuerzo'))) {
    foodWarnings.push(`${item.slug}: debe explicitar almuerzo sin bebidas y su exclusión`);
  }
  if (noMealSpecified.has(item.slug) && /desayuno|almuerzo|cena/.test(includes)) {
    foodWarnings.push(`${item.slug}: alimentación sin respaldo documental específico`);
  }
  if (item.slug === `${PARENT_SLUG}-explorer-adventure-catamaran` &&
      (!includes.includes('nachos y salsas') || !includes.includes('bebidas nacionales'))) {
    foodWarnings.push(`${item.slug}: faltan detalles del snack y barra nacional`);
  }
  if (item.slug === `${PARENT_SLUG}-buggy-party-boat` &&
      (!includes.includes('snacks') || !includes.includes('barra libre de bebidas nacionales'))) {
    foodWarnings.push(`${item.slug}: faltan snacks o barra nacional`);
  }
  if (item.slug === `${PARENT_SLUG}-polaris-de-noche` && !includes.includes('tres tiempos')) {
    foodWarnings.push(`${item.slug}: no se especifica cena de tres tiempos`);
  }
}

const proposal = {
  id: PARENT_ID,
  slug: PARENT_SLUG,
  title: payload.family.label,
  status: 'DRAFT',
  displayJson: { experienceFamily: { version: 2, mode: 'multi_inquiry', packageSlugs: slugs } },
};

const report = {
  mode: args.includes('--database') ? 'database-read-only' : 'seed-only',
  writesPerformed: false,
  proposedParent: proposal,
  seedChecks: {
    packages: slugs.length,
    uniqueSlugs: new Set(slugs).size,
    allUsdPerPerson: experiences.every(item => item.pricing?.currency === 'USD' && item.pricing?.basis === 'person'),
    missingMediaInSeed: experiences.filter(item => !item.featuredMediaId).map(item => item.slug),
    mealsDocumentedAsExpected: foodWarnings.length === 0,
    foodWarnings,
  },
  databaseChecks: { status: 'NOT_RUN', note: 'The seed alone cannot establish current row statuses or collisions.' },
};

if (args.includes('--database')) {
  await import('dotenv/config');
  const [{ PrismaClient }, { PrismaMariaDb }] = await Promise.all([
    import('@prisma/client'),
    import('@prisma/adapter-mariadb'),
  ]);
  const adapter = new PrismaMariaDb({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'quisqueya_core',
    connectionLimit: 2,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const [parentBySlug, parentById, children, publishedParents] = await Promise.all([
      prisma.experience.findUnique({ where: { slug: PARENT_SLUG }, select: {
        id: true, slug: true, status: true, sourceProvider: true, displayJson: true,
      } }),
      prisma.experience.findUnique({ where: { id: PARENT_ID }, select: { id: true, slug: true } }),
      prisma.experience.findMany({ where: { slug: { in: slugs } }, select: {
        slug: true, status: true, featuredMediaId: true,
        includedItemsJson: true, excludedItemsJson: true,
      } }),
      prisma.experience.findMany({ where: { status: 'PUBLISHED' }, select: {
        slug: true, displayJson: true,
      } }),
    ]);
    const found = new Map(children.map(child => [child.slug, child]));
    const missingChildren = slugs.filter(slug => !found.has(slug));
    const unpublishedChildren = children.filter(child => child.status !== 'PUBLISHED')
      .map(child => ({ slug: child.slug, status: child.status }));
    const editorialDrift = children.map(child => {
      const fromSeed = experiences.find(item => item.slug === child.slug);
      const changedFields = [];
      if (JSON.stringify(child.includedItemsJson ?? []) !== JSON.stringify(fromSeed.included ?? [])) {
        changedFields.push('included');
      }
      if (JSON.stringify(child.excludedItemsJson ?? []) !== JSON.stringify(fromSeed.excluded ?? [])) {
        changedFields.push('excluded');
      }
      return { slug: child.slug, changedFields };
    }).filter(item => item.changedFields.length > 0);
    const conflictingParents = publishedParents
      .filter(row => row.slug !== PARENT_SLUG && row.displayJson?.experienceFamily?.version === 2)
      .map(row => ({ slug: row.slug, sharedChildren: (Array.isArray(row.displayJson.experienceFamily.packageSlugs)
        ? row.displayJson.experienceFamily.packageSlugs : [])
        .filter(slug => slugs.includes(slug)) }))
      .filter(row => row.sharedChildren.length > 0);
    const current = parentBySlug?.displayJson?.experienceFamily;
    const alreadyConfigured = parentBySlug?.sourceProvider === 'MANUAL' &&
      current?.version === 2 && current?.mode === 'multi_inquiry' &&
      JSON.stringify(current.packageSlugs) === JSON.stringify(slugs);
    const collision = Boolean((parentById && parentById.slug !== PARENT_SLUG) ||
      (parentBySlug && !alreadyConfigured));

    report.databaseChecks = {
      status: 'CHECKED_READ_ONLY',
      parent: parentBySlug ? { id: parentBySlug.id, status: parentBySlug.status,
        sourceProvider: parentBySlug.sourceProvider, alreadyConfigured } : null,
      parentIdCollision: parentById && parentById.slug !== PARENT_SLUG ? parentById.slug : null,
      missingChildren,
      unpublishedChildren,
      editorialDrift,
      editorialDataAligned: editorialDrift.length === 0 && missingChildren.length === 0,
      childrenWithoutFeaturedMedia: children.filter(child => !child.featuredMediaId).map(child => child.slug),
      conflictingParents,
      draftPreparationEligible: !collision && !conflictingParents.length && !missingChildren.length,
      childrenReadyForResolutionAfterParentPublication: !collision && !conflictingParents.length &&
        !missingChildren.length && !unpublishedChildren.length,
      currentlyResolvablePublicFamily: alreadyConfigured && parentBySlug.status === 'PUBLISHED' &&
        !conflictingParents.length && !missingChildren.length && !unpublishedChildren.length,
      operationIfApprovedLater: collision ? 'STOP_REVIEW_COLLISION' : alreadyConfigured ? 'NOOP' : 'CREATE_DRAFT_PARENT',
    };
  } catch (error) {
    let detail = String(error?.message ?? 'No database error details available.');
    for (const secret of [process.env.MYSQL_PASSWORD, process.env.DATABASE_URL].filter(value => value?.length >= 3)) {
      detail = detail.replaceAll(secret, '[REDACTED]');
    }
    detail = detail.replace(/(mysql|mariadb):\/\/[^\s`'"<>]+/gi, '$1://[REDACTED]');
    report.databaseChecks = {
      status: 'DATABASE_READ_FAILED',
      code: error?.code ?? 'UNKNOWN',
      detail: detail.slice(0, 1200),
    };
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

console.log(JSON.stringify(report, null, 2));
