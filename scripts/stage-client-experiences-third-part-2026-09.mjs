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
const seedPath = path.join(process.cwd(), 'data', 'content', 'client-experiences-2026-09-third-part.seed.json');

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

async function buildNewDraft(payload, experience) {
  const operation = requiredText(experience.operation, `${experience.slug || 'experience'}.operation`);
  if (operation !== 'create_draft') {
    throw new Error(`Unsupported third-part operation ${operation}. Only create_draft is allowed in this staging workflow.`);
  }

  const slug = requiredText(experience.slug, 'experience.slug');
  const id = requiredText(experience.id, `${slug}.id`);
  const destinations = await findDestinations(experience.destinationSlugs, slug);
  const primary = destinations[0];

  const existing = await prisma.experience.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      sourceProvider: true,
      status: true,
      provenanceJson: true,
      updatedAt: true,
    },
  });

  if (existing && existing.sourceProvider !== ContentSourceProvider.MANUAL) {
    throw new Error(`Safety stop: ${slug} already exists with sourceProvider ${existing.sourceProvider}.`);
  }
  if (existing && existing.status === ContentRecordStatus.PUBLISHED) {
    throw new Error(`Safety stop: ${slug} is already PUBLISHED. This staging workflow never modifies published experiences.`);
  }

  const explicitGallery = asArray(experience.galleryMediaSourceIds);
  const inheritedGallery = asArray(primary.galleryMediaSourceIds);
  const usesTemporaryDestinationMedia =
    !experience.featuredMediaId &&
    explicitGallery.length === 0 &&
    Boolean(primary.featuredMediaId || inheritedGallery.length);

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
      dataset: 'client-experiences-2026-09-third-part.seed.json',
      temporaryMediaFromDestination: usesTemporaryDestinationMedia ? primary.slug : null,
      note: usesTemporaryDestinationMedia
        ? `Protected MANUAL draft. Temporary media inherited from ${primary.slug}; replace after the collaborator media library is reviewed.`
        : 'Protected MANUAL draft. Final media will be selected after the collaborator media library is reviewed.',
    },
  };

  return {
    operation: 'stage_new_draft',
    experience,
    existing,
    destinations,
    data,
    previewSlug: slug,
    usesTemporaryDestinationMedia,
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
  if (!experiences.length) throw new Error('Third-part client dataset contains no experiences.');

  const proposals = [];
  for (const experience of experiences) {
    proposals.push(await buildNewDraft(payload, experience));
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'preview-staging',
      writePerformed: false,
      seedPath,
      experiences: proposals.map(item => ({
        operation: item.operation,
        slug: item.previewSlug,
        existingDraft: item.existing,
        statusAfterStage: 'DRAFT',
        destinations: item.destinations.map(destination => ({
          slug: destination.slug,
          name: destination.name,
          status: destination.status,
        })),
        pricing: item.data.pricingJson,
        duration: item.data.duration,
        temporaryMedia: item.usesTemporaryDestinationMedia
          ? {
              inheritedFromDestination: item.destinations[0].slug,
              featuredMediaId: item.data.featuredMediaId,
              galleryMediaSourceIds: item.data.galleryMediaSourceIds,
            }
          : null,
        editorialFlags: item.data.editorialFlagsJson,
      })),
      safeguards: [
        'This workflow creates or refreshes MANUAL DRAFT records only.',
        'It refuses to overwrite inherited/non-MANUAL records.',
        'It refuses to modify an already PUBLISHED record.',
        'No third-part experience is published by this command.',
      ],
      nextCommand: 'npm run stage:client-experiences-third-part',
    }, null, 2));
    return;
  }

  const results = [];
  for (const proposal of proposals) {
    const result = await prisma.$transaction(async tx => {
      if (proposal.existing) {
        const current = await tx.experience.findUnique({
          where: { slug: proposal.previewSlug },
          select: { id: true, sourceProvider: true, status: true, updatedAt: true },
        });
        if (!current || current.sourceProvider !== ContentSourceProvider.MANUAL || current.status === ContentRecordStatus.PUBLISHED) {
          throw new Error(`Safety stop: ${proposal.previewSlug} changed identity/status after preview.`);
        }
        if (current.updatedAt.getTime() !== proposal.existing.updatedAt.getTime()) {
          throw new Error(`Safety stop: ${proposal.previewSlug} changed after preview. Re-run preview first.`);
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
          editorialFlagsJson: true,
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
    reminders: [
      'Do not publish third-part experiences until factual gaps and media are reviewed.',
      'Scape Park operating days and minimum-passenger/solo-booking rules remain pending.',
      'Final Scape Park media remains pending the collaborator media library review.',
    ],
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
