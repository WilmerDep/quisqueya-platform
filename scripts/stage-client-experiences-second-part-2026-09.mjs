import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, ContentRecordStatus, ContentSourceProvider } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quisqueya_core',
  connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
});

const prisma = new PrismaClient({ adapter });
const APPLY = process.argv.includes('--apply');
const seedPath = path.join(process.cwd(), 'data', 'content', 'client-experiences-2026-09-second-part.seed.json');
const REVIEW_SUFFIX = 'revision-2026-09';

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required text: ${label}`);
  }
  return value.trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mutableClientContent(experience) {
  return {
    title: requiredText(experience.title, `${experience.slug}.title`),
    excerpt: experience.excerpt || null,
    description: experience.description || null,
    featuredText: experience.featuredText || null,
    duration: experience.duration || null,
    durationValue: nullableNumber(experience.durationValue),
    durationUnit: experience.durationUnit || null,
    categoryLabel: experience.categoryLabel || null,
    pricingMode: 'FIXED',
    pricingJson: experience.pricing || null,
    bookingJson: experience.booking || null,
    availabilityJson: experience.availability || null,
    practicalInfoJson: experience.practicalInfo || null,
    includedItemsJson: asArray(experience.included),
    excludedItemsJson: asArray(experience.excluded),
    itineraryJson: asArray(experience.itinerary),
    displayJson: experience.display || null,
    editorialFlagsJson: asArray(experience.editorialFlags),
  };
}

async function findDestinations(slugs, label) {
  const unique = [...new Set(asArray(slugs).map(slug => requiredText(slug, `${label}.destinationSlug`)))];
  if (!unique.length) throw new Error(`Safety stop: ${label} has no destinations.`);

  const rows = await prisma.destination.findMany({
    where: { slug: { in: unique } },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      featuredMediaId: true,
      galleryMediaSourceIds: true,
    },
  });
  const bySlug = new Map(rows.map(row => [row.slug, row]));
  return unique.map(slug => {
    const row = bySlug.get(slug);
    if (!row) throw new Error(`Safety stop: destination ${slug} was not found for ${label}.`);
    return row;
  });
}

async function buildPublishedRevision(payload, experience) {
  const target = experience.target || {};
  const sourceProvider = requiredText(target.sourceProvider, `${experience.slug}.target.sourceProvider`);
  const sourceId = requiredText(target.sourceId, `${experience.slug}.target.sourceId`);
  const expectedSlug = requiredText(target.expectedSlug, `${experience.slug}.target.expectedSlug`);

  const published = await prisma.experience.findFirst({
    where: { sourceProvider, sourceId },
    select: {
      id: true,
      sourceProvider: true,
      sourceId: true,
      slug: true,
      title: true,
      status: true,
      featuredMediaId: true,
      galleryMediaSourceIds: true,
      locationJson: true,
      contactJson: true,
      faqsJson: true,
      provenanceJson: true,
      updatedAt: true,
    },
  });

  if (!published) throw new Error(`Safety stop: ${sourceProvider}/${sourceId} was not found.`);
  if (published.slug !== expectedSlug) throw new Error(`Safety stop: expected slug ${expectedSlug}, found ${published.slug}.`);
  if (published.status !== ContentRecordStatus.PUBLISHED) {
    throw new Error(`Safety stop: expected published source record for ${expectedSlug}, found ${published.status}.`);
  }

  const reviewSlug = `${expectedSlug}-${REVIEW_SUFFIX}`;
  const reviewId = `manual-review-${expectedSlug}-2026-09`;
  const existingReview = await prisma.experience.findUnique({
    where: { slug: reviewSlug },
    select: { id: true, slug: true, sourceProvider: true, status: true },
  });
  if (existingReview && existingReview.sourceProvider !== ContentSourceProvider.MANUAL) {
    throw new Error(`Safety stop: review slug ${reviewSlug} is owned by ${existingReview.sourceProvider}.`);
  }

  const destinations = await findDestinations(experience.destinationSlugs, experience.slug);
  const data = {
    id: reviewId,
    slug: reviewSlug,
    ...mutableClientContent(experience),
    featuredMediaId: published.featuredMediaId || null,
    galleryMediaSourceIds: asArray(published.galleryMediaSourceIds),
    locationJson: published.locationJson || null,
    contactJson: published.contactJson || null,
    faqsJson: published.faqsJson || null,
    sortOrder: 998,
    status: ContentRecordStatus.DRAFT,
    sourceProvider: ContentSourceProvider.MANUAL,
    provenanceJson: {
      source: payload.source,
      receivedAt: payload.receivedAt,
      dataset: 'client-experiences-2026-09-second-part.seed.json',
      reviewOf: {
        id: published.id,
        sourceProvider: published.sourceProvider,
        sourceId: published.sourceId,
        slug: published.slug,
        updatedAt: published.updatedAt,
      },
      note: 'Protected review copy. The current published experience is intentionally untouched until explicit finalization.',
    },
  };

  return {
    operation: 'stage_revision',
    experience,
    published,
    existingReview,
    destinations,
    data,
    previewSlug: reviewSlug,
  };
}

async function buildNewDraft(payload, experience) {
  const slug = requiredText(experience.slug, 'experience.slug');
  const id = requiredText(experience.id, `${slug}.id`);
  const destinations = await findDestinations(experience.destinationSlugs, slug);
  const primary = destinations[0];
  const existing = await prisma.experience.findUnique({
    where: { slug },
    select: { id: true, slug: true, sourceProvider: true, status: true },
  });
  if (existing && existing.sourceProvider !== ContentSourceProvider.MANUAL) {
    throw new Error(`Safety stop: ${slug} already exists with sourceProvider ${existing.sourceProvider}.`);
  }

  const explicitGallery = asArray(experience.galleryMediaSourceIds);
  const inheritedGallery = asArray(primary.galleryMediaSourceIds);
  const data = {
    id,
    slug,
    ...mutableClientContent(experience),
    featuredMediaId: experience.featuredMediaId || primary.featuredMediaId || null,
    galleryMediaSourceIds: explicitGallery.length ? explicitGallery : inheritedGallery,
    sortOrder: nullableNumber(experience.sortOrder) ?? 999,
    status: ContentRecordStatus.DRAFT,
    sourceProvider: ContentSourceProvider.MANUAL,
    provenanceJson: {
      source: payload.source,
      receivedAt: payload.receivedAt,
      dataset: 'client-experiences-2026-09-second-part.seed.json',
      temporaryMediaFromDestination: !experience.featuredMediaId && explicitGallery.length === 0 ? primary.slug : null,
      note: 'Client-supplied experience staged as a separate MANUAL draft.',
    },
  };

  return {
    operation: 'stage_new_draft',
    experience,
    existingReview: existing,
    destinations,
    data,
    previewSlug: slug,
  };
}

async function applyRelations(tx, experienceId, destinations) {
  await tx.experienceDestination.deleteMany({ where: { experienceId } });
  for (const [index, destination] of destinations.entries()) {
    await tx.experienceDestination.create({
      data: {
        experienceId,
        destinationId: destination.id,
        isPrimary: index === 0,
      },
    });
  }
}

async function main() {
  const payload = JSON.parse(await readFile(seedPath, 'utf8'));
  const experiences = asArray(payload.experiences);
  if (!experiences.length) throw new Error('Second-part client dataset contains no experiences.');

  const proposals = [];
  for (const experience of experiences) {
    const operation = requiredText(experience.operation, `${experience.slug || 'experience'}.operation`);
    if (operation === 'overlay_existing') proposals.push(await buildPublishedRevision(payload, experience));
    else if (operation === 'create_draft') proposals.push(await buildNewDraft(payload, experience));
    else throw new Error(`Unsupported operation ${operation}.`);
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'preview-staging',
      writePerformed: false,
      seedPath,
      experiences: proposals.map(item => ({
        operation: item.operation,
        sourceSlug: item.experience.slug,
        previewSlug: item.previewSlug,
        publishedTarget: item.published
          ? {
              id: item.published.id,
              slug: item.published.slug,
              status: item.published.status,
              sourceProvider: item.published.sourceProvider,
              sourceId: item.published.sourceId,
            }
          : null,
        existingDraft: item.existingReview,
        statusAfterStage: 'DRAFT',
        destinations: item.destinations.map(destination => ({ slug: destination.slug, name: destination.name })),
        pricing: item.data.pricingJson,
        editorialFlags: item.data.editorialFlagsJson,
      })),
      safeguards: [
        'The published Santo Domingo City Tour is never updated by this staging workflow.',
        'Its client revision uses a separate MANUAL DRAFT slug for protected visual review.',
        'The combined Santo Domingo + Altos experience remains an independent MANUAL DRAFT.',
      ],
      nextCommand: 'npm run stage:client-experiences-second-part',
    }, null, 2));
    return;
  }

  const results = [];
  for (const proposal of proposals) {
    const result = await prisma.$transaction(async tx => {
      if (proposal.published) {
        const current = await tx.experience.findUnique({
          where: { id: proposal.published.id },
          select: { id: true, sourceProvider: true, sourceId: true, slug: true, status: true, updatedAt: true },
        });
        if (!current || current.status !== ContentRecordStatus.PUBLISHED || current.slug !== proposal.published.slug || current.sourceId !== proposal.published.sourceId) {
          throw new Error('Safety stop: published City Tour identity/status changed before staging.');
        }
        if (current.updatedAt.getTime() !== proposal.published.updatedAt.getTime()) {
          throw new Error('Safety stop: published City Tour changed after staging preview. Re-run preview first.');
        }
      }

      const { id, ...mutable } = proposal.data;
      const row = await tx.experience.upsert({
        where: { slug: proposal.previewSlug },
        create: { id, ...mutable },
        update: mutable,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          sourceProvider: true,
          duration: true,
          pricingJson: true,
          featuredMediaId: true,
          galleryMediaSourceIds: true,
          updatedAt: true,
        },
      });
      await applyRelations(tx, row.id, proposal.destinations);
      return row;
    });

    results.push({ operation: proposal.operation, previewSlug: proposal.previewSlug, result });
  }

  console.log(JSON.stringify({
    mode: 'stage',
    updated: true,
    publishedExperienceModified: false,
    results,
    previewRoutes: results.map(item => `/preview/experiencias/${item.previewSlug}?token=<PREVIEW_TOKEN>`),
    reminder: 'Do not finalize the published Santo Domingo City Tour until the protected revision is visually approved.',
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
