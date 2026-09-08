import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  PrismaClient,
  ContentRecordStatus,
  ContentSourceProvider,
} from '@prisma/client';
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
const PUBLISH = process.argv.includes('--publish');
const seedPath = join(process.cwd(), 'data', 'content', 'client-experiences-2026-09.seed.json');

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required text: ${label}`);
  }
  return value.trim();
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildData(experience, destination) {
  const explicitGallery = array(experience.galleryMediaSourceIds);
  const inheritedGallery = array(destination.galleryMediaSourceIds);
  const usesTemporaryDestinationMedia =
    !experience.featuredMediaId &&
    explicitGallery.length === 0 &&
    Boolean(destination.featuredMediaId || inheritedGallery.length);

  return {
    id: requiredText(experience.id, 'id'),
    slug: requiredText(experience.slug, 'slug'),
    title: requiredText(experience.title, 'title'),
    excerpt: experience.excerpt || null,
    description: experience.description || null,
    featuredText: experience.featuredText || null,
    duration: experience.duration || null,
    durationValue: nullableNumber(experience.durationValue),
    durationUnit: experience.durationUnit || null,
    categoryLabel: experience.categoryLabel || null,
    featuredMediaId: experience.featuredMediaId || destination.featuredMediaId || null,
    galleryMediaSourceIds: explicitGallery.length ? explicitGallery : inheritedGallery,
    pricingMode: 'FIXED',
    pricingJson: experience.pricing || null,
    bookingJson: experience.booking || null,
    availabilityJson: experience.availability || null,
    practicalInfoJson: experience.practicalInfo || null,
    includedItemsJson: array(experience.included),
    excludedItemsJson: array(experience.excluded),
    itineraryJson: array(experience.itinerary),
    displayJson: experience.display || null,
    editorialFlagsJson: array(experience.editorialFlags),
    sortOrder: nullableNumber(experience.sortOrder) ?? 999,
    status: PUBLISH ? ContentRecordStatus.PUBLISHED : ContentRecordStatus.DRAFT,
    sourceProvider: ContentSourceProvider.MANUAL,
    provenanceJson: {
      source: 'Breidy Solano / Quisqueya Travel',
      receivedAt: '2026-09-05',
      dataset: 'client-experiences-2026-09.seed.json',
      note: usesTemporaryDestinationMedia
        ? `Client-supplied experience content. Temporary media inherited from destination ${destination.slug}; replace when final experience media is supplied. Age 0-3 pricing remains unresolved.`
        : 'Client-supplied experience content. Media and unresolved age 0-3 pricing remain intentionally pending.',
      temporaryMediaFromDestination: usesTemporaryDestinationMedia ? destination.slug : null,
    },
    destinationId: destination.id,
    usesTemporaryDestinationMedia,
  };
}

async function main() {
  const raw = await readFile(seedPath, 'utf8');
  const payload = JSON.parse(raw);
  const experiences = array(payload.experiences);

  if (!experiences.length) {
    throw new Error('The client experience seed does not contain any experiences.');
  }

  const proposed = [];

  for (const experience of experiences) {
    const slug = requiredText(experience.slug, 'experience.slug');
    const destinationSlug = requiredText(experience.destinationSlug, `${slug}.destinationSlug`);
    const destination = await prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        featuredMediaId: true,
        galleryMediaSourceIds: true,
      },
    });

    if (!destination) {
      throw new Error(`Safety stop: destination ${destinationSlug} was not found for ${slug}.`);
    }

    const existing = await prisma.experience.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        sourceProvider: true,
        status: true,
        updatedAt: true,
      },
    });

    if (existing && existing.sourceProvider !== ContentSourceProvider.MANUAL) {
      throw new Error(
        `Safety stop: ${slug} already exists with sourceProvider ${existing.sourceProvider}. Refusing to overwrite inherited content.`,
      );
    }

    proposed.push({
      slug,
      existing,
      destination,
      statusAfterApply: PUBLISH ? 'PUBLISHED' : 'DRAFT',
      data: buildData(experience, destination),
    });
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'preview',
      writePerformed: false,
      publishRequested: PUBLISH,
      seedPath,
      experiences: proposed.map(item => ({
        slug: item.slug,
        existing: item.existing,
        destination: {
          id: item.destination.id,
          slug: item.destination.slug,
          name: item.destination.name,
          status: item.destination.status,
        },
        statusAfterApply: item.statusAfterApply,
        pricing: item.data.pricingJson,
        duration: item.data.duration,
        durationValue: item.data.durationValue,
        temporaryMedia: item.data.usesTemporaryDestinationMedia
          ? {
              inheritedFromDestination: item.destination.slug,
              featuredMediaId: item.data.featuredMediaId,
              galleryMediaSourceIds: item.data.galleryMediaSourceIds,
            }
          : null,
        editorialFlags: item.data.editorialFlagsJson,
      })),
      nextCommand: PUBLISH
        ? 'node scripts/seed-client-experiences-2026-09.mjs --apply --publish'
        : 'npm run apply:client-experiences-draft',
    }, null, 2));
    return;
  }

  const results = [];

  for (const item of proposed) {
    const {
      destinationId,
      id,
      usesTemporaryDestinationMedia,
      ...mutableExperienceData
    } = item.data;
    const createData = { id, ...mutableExperienceData };

    const result = await prisma.$transaction(async tx => {
      const row = await tx.experience.upsert({
        where: { slug: item.slug },
        create: createData,
        update: mutableExperienceData,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          sourceProvider: true,
          duration: true,
          durationValue: true,
          featuredMediaId: true,
          galleryMediaSourceIds: true,
          pricingJson: true,
          updatedAt: true,
        },
      });

      await tx.experienceDestination.deleteMany({ where: { experienceId: row.id } });
      await tx.experienceDestination.create({
        data: {
          experienceId: row.id,
          destinationId,
          isPrimary: true,
        },
      });

      return {
        ...row,
        temporaryMediaInheritedFrom: usesTemporaryDestinationMedia ? item.destination.slug : null,
      };
    });

    results.push(result);
  }

  console.log(JSON.stringify({
    mode: 'apply',
    updated: true,
    publishRequested: PUBLISH,
    results,
    reminders: [
      'Destination media is temporary and should be replaced when final experience-specific images are supplied.',
      'Pricing for ages 0-3 remains intentionally unresolved because the client document did not define it.',
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
