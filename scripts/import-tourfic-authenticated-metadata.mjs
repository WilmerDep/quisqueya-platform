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

const asFiniteNumber = value => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asDecimalString = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(value) : null;
};

const asText = value => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const asTextList = value => {
  if (Array.isArray(value)) {
    return value
      .map(item => asText(item))
      .filter(Boolean);
  }

  if (typeof value !== 'string') return [];
  return value
    .split(/\r?\n|;|\u2022/)
    .map(item => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
};

const asObject = value => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
);

const compactObject = value => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null),
);

const normalizeLanguages = value => String(value || '')
  .split(/\s+y\s+|,|\//i)
  .map(item => item.trim())
  .filter(Boolean);

const normalizePhysicalLevel = value => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['low', 'bajo', 'baja', 'easy', 'fácil', 'facil'].includes(normalized)) return 'low';
  if (['moderate', 'moderado', 'moderada', 'medium', 'medio', 'media'].includes(normalized)) return 'moderate';
  if (['high', 'alto', 'alta', 'hard', 'difícil', 'dificil'].includes(normalized)) return 'high';
  if (['not_specified', 'not specified', 'no especificado', 'no especificada'].includes(normalized)) return 'not_specified';
  return null;
};

function normalizePracticalInfo(tour) {
  const source = asObject(tour.practicalInfo)
    || asObject(tour.practical)
    || asObject(tour.beforeYouGo)
    || {};

  const accessibilitySource = asObject(source.accessibility) || {};
  const meetingPointSource = asObject(source.meetingPoint) || {};
  const pickupSource = asObject(source.pickupInformation)
    || asObject(source.pickup)
    || {};

  const accessibilityDetails = asText(accessibilitySource.details)
    ?? asText(source.accessibilityDetails)
    ?? undefined;
  const accessibilityAvailable = typeof accessibilitySource.available === 'boolean'
    ? accessibilitySource.available
    : typeof source.accessible === 'boolean'
      ? source.accessible
      : undefined;

  const meetingPoint = compactObject({
    label: asText(meetingPointSource.label) ?? asText(source.meetingPointLabel) ?? undefined,
    address: asText(meetingPointSource.address) ?? asText(source.meetingPointAddress) ?? undefined,
    instructions: asText(meetingPointSource.instructions) ?? asText(source.meetingInstructions) ?? undefined,
    latitude: asFiniteNumber(meetingPointSource.latitude),
    longitude: asFiniteNumber(meetingPointSource.longitude),
  });

  const pickupInformation = compactObject({
    available: typeof pickupSource.available === 'boolean'
      ? pickupSource.available
      : typeof source.pickupAvailable === 'boolean'
        ? source.pickupAvailable
        : undefined,
    details: asText(pickupSource.details) ?? asText(source.pickupDetails) ?? undefined,
    zones: asTextList(pickupSource.zones ?? source.pickupZones),
  });

  const accessibility = compactObject({
    available: accessibilityAvailable,
    details: accessibilityDetails,
  });

  const practicalInfo = {
    whatToBring: asTextList(source.whatToBring ?? tour.whatToBring),
    restrictions: asTextList(source.restrictions ?? tour.restrictions),
    accessibility: Object.keys(accessibility).length ? accessibility : undefined,
    minimumAge: asInteger(source.minimumAge ?? tour.minimumAge) ?? undefined,
    physicalLevel: normalizePhysicalLevel(source.physicalLevel ?? tour.physicalLevel) || undefined,
    meetingPoint: Object.keys(meetingPoint).length ? meetingPoint : undefined,
    pickupInformation: pickupInformation.available !== undefined
      || pickupInformation.details
      || pickupInformation.zones?.length
      ? pickupInformation
      : undefined,
    cancellationPolicy: asText(source.cancellationPolicy ?? tour.cancellationPolicy) ?? undefined,
    bookingNotice: asText(source.bookingNotice ?? tour.bookingNotice) ?? undefined,
    requiredDocuments: asTextList(source.requiredDocuments ?? tour.requiredDocuments),
  };

  const hasContent = practicalInfo.whatToBring.length
    || practicalInfo.restrictions.length
    || practicalInfo.accessibility
    || practicalInfo.minimumAge !== undefined
    || practicalInfo.physicalLevel
    || practicalInfo.meetingPoint
    || practicalInfo.pickupInformation
    || practicalInfo.cancellationPolicy
    || practicalInfo.bookingNotice
    || practicalInfo.requiredDocuments.length;

  return hasContent ? practicalInfo : null;
}

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
  let practicalInfoImported = 0;
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
    const practicalInfo = normalizePracticalInfo(tour);

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
        practicalInfoJson: practicalInfo,
        displayJson: tour.display || null,
        editorialFlagsJson: flags,
      },
    });

    if (practicalInfo) practicalInfoImported += 1;
    updated += 1;
  }

  console.log(`Imported authenticated Tourfic metadata for ${updated}/${tours.length} experiences.`);
  console.log(`Imported explicit practical information for ${practicalInfoImported}/${tours.length} experiences.`);
  console.log('Editorial review flags were generated without modifying source copy.');

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