import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const metadataPath = resolve(
  process.cwd(),
  process.env.TOURFIC_METADATA_PATH || 'data/content/wordpress-tourfic-authenticated-metadata.json',
);

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quisqueya_core',
  connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
});
const prisma = new PrismaClient({ adapter });

const asInteger = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const asDecimalString = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(value) : null;
};

const normalizeLanguages = value => String(value || '')
  .split(/\s+y\s+|,|\//i)
  .map(item => item.trim())
  .filter(Boolean);

const signature = value => JSON.stringify(value || []);

function editorialFlags(tour, duplicateItinerary, duplicateFaqs) {
  const flags = [];

  if (duplicateItinerary) {
    flags.push({
      code: 'POSSIBLE_CLONED_ITINERARY',
      severity: 'warning',
      message: 'The itinerary is identical to one or more other imported tours.',
    });
  }

  if (duplicateFaqs) {
    flags.push({
      code: 'POSSIBLE_CLONED_FAQS',
      severity: 'warning',
      message: 'The FAQ collection is identical to one or more other imported tours.',
    });
  }

  const pricesDisabled = Boolean(
    tour.pricing?.adultDisabled &&
    tour.pricing?.childDisabled &&
    tour.pricing?.infantDisabled,
  );
  const hasTechnicalPrice = Boolean(
    tour.pricing?.adult || tour.pricing?.child || tour.pricing?.infant,
  );

  if (pricesDisabled && hasTechnicalPrice) {
    flags.push({
      code: 'TECHNICAL_PRICES_DISABLED',
      severity: 'info',
      message: 'Tourfic contains price values, but all public price groups are disabled.',
    });
  }

  return flags;
}

async function main() {
  const payload = JSON.parse(await readFile(metadataPath, 'utf8'));
  const tours = Array.isArray(payload?.tours) ? payload.tours.filter(item => item?.ok) : [];

  if (!tours.length) {
    throw new Error(`No successful Tourfic tours found in ${metadataPath}`);
  }

  if (Number(payload.failed || 0) > 0) {
    throw new Error(`Tourfic evidence reports ${payload.failed} failed extraction(s).`);
  }

  const itineraryCounts = new Map();
  const faqCounts = new Map();
  for (const tour of tours) {
    itineraryCounts.set(signature(tour.itinerary), (itineraryCounts.get(signature(tour.itinerary)) || 0) + 1);
    faqCounts.set(signature(tour.faqs), (faqCounts.get(signature(tour.faqs)) || 0) + 1);
  }

  let updated = 0;
  const missing = [];

  for (const tour of tours) {
    const sourceId = String(tour.sourceId);
    const existing = await prisma.experience.findUnique({
      where: {
        sourceProvider_sourceId: {
          sourceProvider: 'WORDPRESS',
          sourceId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      missing.push(sourceId);
      continue;
    }

    const flags = editorialFlags(
      tour,
      (itineraryCounts.get(signature(tour.itinerary)) || 0) > 1,
      (faqCounts.get(signature(tour.faqs)) || 0) > 1,
    );

    const durationValue = asInteger(tour.duration?.value);
    const durationUnit = tour.duration?.unit || null;

    await prisma.experience.update({
      where: { id: existing.id },
      data: {
        featuredText: tour.featuredText || null,
        videoUrl: tour.videoUrl || null,
        duration: durationValue && durationUnit ? `${durationValue} ${durationUnit}` : null,
        durationValue,
        durationUnit,
        languagesJson: normalizeLanguages(tour.language),
        locationAddress: tour.location?.address || null,
        latitude: asDecimalString(tour.location?.latitude),
        longitude: asDecimalString(tour.location?.longitude),
        mapZoom: asInteger(tour.location?.zoom),
        galleryMediaSourceIds: Array.isArray(tour.galleryMediaIds) ? tour.galleryMediaIds : [],
        pricingMode: tour.pricing?.publicMode === 'FIXED' ? 'FIXED' : 'ON_REQUEST',
        pricingJson: tour.pricing || null,
        bookingJson: tour.booking || null,
        availabilityJson: tour.availability || null,
        contactJson: tour.contact || null,
        includedItemsJson: Array.isArray(tour.included) ? tour.included : [],
        excludedItemsJson: Array.isArray(tour.excluded) ? tour.excluded : [],
        itineraryJson: Array.isArray(tour.itinerary) ? tour.itinerary : [],
        faqsJson: Array.isArray(tour.faqs) ? tour.faqs : [],
        displayJson: tour.display || null,
        editorialFlagsJson: flags,
      },
    });

    updated += 1;
  }

  console.log(`Imported authenticated Tourfic metadata for ${updated}/${tours.length} experiences.`);
  console.log(`Editorial review flags were generated without modifying source copy.`);

  if (missing.length) {
    throw new Error(`Missing WordPress experiences in Prisma for source IDs: ${missing.join(', ')}`);
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
