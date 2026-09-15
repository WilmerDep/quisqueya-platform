import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

function buildMutableContent(experience) {
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

function provenance(payload, experience, extra = {}) {
  return {
    source: payload.source,
    receivedAt: payload.receivedAt,
    dataset: 'client-experiences-2026-09-second-part.seed.json',
    notes: 'Client-supplied excursion content. Shared destinations do not imply shared pricing, itinerary, availability or media.',
    ...extra,
  };
}

async function findDestinations(slugs, slugLabel) {
  const unique = [...new Set(asArray(slugs).map(item => requiredText(item, `${slugLabel}.destinationSlug`)))];
  if (!unique.length) throw new Error(`Safety stop: ${slugLabel} has no destinations.`);

  const destinations = await prisma.destination.findMany({
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

  const bySlug = new Map(destinations.map(item => [item.slug, item]));
  const ordered = unique.map(slug => {
    const destination = bySlug.get(slug);
    if (!destination) throw new Error(`Safety stop: destination ${slug} was not found for ${slugLabel}.`);
    return destination;
  });

  return ordered;
}

async function buildOverlayProposal(payload, experience) {
  const target = experience.target || {};
  const sourceProvider = requiredText(target.sourceProvider, `${experience.slug}.target.sourceProvider`);
  const sourceId = requiredText(target.sourceId, `${experience.slug}.target.sourceId`);
  const expectedSlug = requiredText(target.expectedSlug, `${experience.slug}.target.expectedSlug`);

  const existing = await prisma.experience.findFirst({
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
      provenanceJson: true,
      updatedAt: true,
    },
  });

  if (!existing) throw new Error(`Safety stop: existing experience ${sourceProvider}/${sourceId} was not found.`);
  if (existing.slug !== expectedSlug) {
    throw new Error(`Safety stop: expected slug ${expectedSlug}, found ${existing.slug}.`);
  }

  const destinations = await findDestinations(experience.destinationSlugs, experience.slug);
  const data = {
    ...buildMutableContent(experience),
    provenanceJson: {
      ...(existing.provenanceJson && typeof existing.provenanceJson === 'object' && !Array.isArray(existing.provenanceJson)
        ? existing.provenanceJson
        : {}),
      clientValidation: provenance(payload, experience, {
        overlay: 'santo-domingo-city-tour-client-v1',
        replacesInheritedOperationalContent: true,
      }),
    },
  };

  return { type: 'overlay_existing', experience, existing, destinations, data };
}

async function buildDraftProposal(payload, experience) {
  const slug = requiredText(experience.slug, 'experience.slug');
  const id = requiredText(experience.id, `${slug}.id`);
  const destinations = await findDestinations(experience.destinationSlugs, slug);
  const primary = destinations[0];
  const existing = await prisma.experience.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, sourceProvider: true, status: true, updatedAt: true },
  });

  if (existing && existing.sourceProvider !== ContentSourceProvider.MANUAL) {
    throw new Error(`Safety stop: ${slug} already exists with sourceProvider ${existing.sourceProvider}. Refusing to overwrite inherited content.`);
  }

  const explicitGallery = asArray(experience.galleryMediaSourceIds);
  const inheritedGallery = asArray(primary.galleryMediaSourceIds);
  const usesTemporaryDestinationMedia = !experience.featuredMediaId && explicitGallery.length === 0;

  const data = {
    id,
    slug,
    ...buildMutableContent(experience),
    featuredMediaId: experience.featuredMediaId || primary.featuredMediaId || null,
    galleryMediaSourceIds: explicitGallery.length ? explicitGallery : inheritedGallery,
    sortOrder: nullableNumber(experience.sortOrder) ?? 999,
    status: ContentRecordStatus.DRAFT,
    sourceProvider: ContentSourceProvider.MANUAL,
    provenanceJson: provenance(payload, experience, {
      temporaryMediaFromDestination: usesTemporaryDestinationMedia ? primary.slug : null,
    }),
  };

  return { type: 'create_draft', experience, existing, destinations, data, usesTemporaryDestinationMedia };
}

async function writeOverlaySnapshot(proposal) {
  const directory = path.resolve('data/backups');
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join(directory, `santo-domingo-city-tour-before-client-overlay-${stamp}.json`);
  await writeFile(filepath, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    purpose: 'Rollback snapshot before Santo Domingo City Tour client overlay',
    row: proposal.existing,
  }, null, 2)}\n`, 'utf8');
  return filepath;
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
    if (operation === 'overlay_existing') {
      proposals.push(await buildOverlayProposal(payload, experience));
    } else if (operation === 'create_draft') {
      proposals.push(await buildDraftProposal(payload, experience));
    } else {
      throw new Error(`Unsupported operation ${operation}.`);
    }
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'preview',
      writePerformed: false,
      seedPath,
      experiences: proposals.map(item => ({
        operation: item.type,
        slug: item.experience.slug,
        existing: item.existing,
        destinations: item.destinations.map(destination => ({
          id: destination.id,
          slug: destination.slug,
          name: destination.name,
          status: destination.status,
        })),
        statusAfterApply: item.type === 'create_draft' ? 'DRAFT' : item.existing.status,
        duration: item.data.duration,
        pricing: item.data.pricingJson,
        temporaryMedia: item.type === 'create_draft' && item.usesTemporaryDestinationMedia
          ? {
              inheritedFromDestination: item.destinations[0].slug,
              featuredMediaId: item.data.featuredMediaId,
              galleryMediaSourceIds: item.data.galleryMediaSourceIds,
            }
          : null,
        editorialFlags: item.data.editorialFlagsJson,
      })),
      safeguards: [
        'Santo Domingo City Tour must match WORDPRESS sourceId 720 and slug santo-domingo-city-tour.',
        'The combined Santo Domingo + Altos product is created as a separate MANUAL DRAFT.',
        'Shared destination names never cause pricing, itinerary, availability or media to be copied between products.',
      ],
      nextCommand: 'npm run apply:client-experiences-second-part',
    }, null, 2));
    return;
  }

  const results = [];
  for (const proposal of proposals) {
    if (proposal.type === 'overlay_existing') {
      const snapshotPath = await writeOverlaySnapshot(proposal);
      const result = await prisma.$transaction(async tx => {
        const current = await tx.experience.findUnique({
          where: { id: proposal.existing.id },
          select: { id: true, sourceProvider: true, sourceId: true, slug: true, updatedAt: true },
        });
        if (!current || current.sourceProvider !== 'WORDPRESS' || current.sourceId !== '720' || current.slug !== 'santo-domingo-city-tour') {
          throw new Error('Safety stop: Santo Domingo City Tour identity changed before apply.');
        }
        if (current.updatedAt.getTime() !== proposal.existing.updatedAt.getTime()) {
          throw new Error('Safety stop: Santo Domingo City Tour changed after preview read. Re-run preview before applying.');
        }

        const row = await tx.experience.update({
          where: { id: proposal.existing.id },
          data: proposal.data,
          select: { id: true, slug: true, title: true, status: true, sourceProvider: true, duration: true, pricingJson: true, updatedAt: true },
        });
        await applyRelations(tx, row.id, proposal.destinations);
        return row;
      });
      results.push({ operation: proposal.type, snapshotPath, result });
    } else {
      const result = await prisma.$transaction(async tx => {
        const { id, ...mutable } = proposal.data;
        const row = await tx.experience.upsert({
          where: { slug: proposal.experience.slug },
          create: { id, ...mutable },
          update: mutable,
          select: { id: true, slug: true, title: true, status: true, sourceProvider: true, duration: true, pricingJson: true, featuredMediaId: true, galleryMediaSourceIds: true, updatedAt: true },
        });
        await applyRelations(tx, row.id, proposal.destinations);
        return row;
      });
      results.push({ operation: proposal.type, result, temporaryMediaInheritedFrom: proposal.usesTemporaryDestinationMedia ? proposal.destinations[0].slug : null });
    }
  }

  console.log(JSON.stringify({
    mode: 'apply',
    updated: true,
    results,
    reminders: [
      'Ages 0-3, operating days and minimum-passenger rules remain intentionally unresolved for both products.',
      'The new Santo Domingo + Altos experience remains DRAFT.',
      'Temporary destination media must be replaced when final experience-specific media is available.',
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
