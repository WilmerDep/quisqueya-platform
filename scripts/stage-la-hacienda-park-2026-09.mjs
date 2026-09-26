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
const seedPath = path.join(
  process.cwd(),
  'data',
  'content',
  'client-experiences-2026-09-la-hacienda-park.seed.json',
);

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

function validatePricing(pricing, slug) {
  if (!pricing || typeof pricing !== 'object') {
    throw new Error(`Safety stop: ${slug} has no pricing object.`);
  }
  if (pricing.basis !== 'person' || pricing.currency !== 'USD' || Number(pricing.from) !== 99) {
    throw new Error(`Safety stop: ${slug} base pricing does not match the approved La Hacienda structure.`);
  }
  if (pricing.adult !== null || pricing.child !== null || pricing.infant !== null || asArray(pricing.tiers).length !== 0) {
    throw new Error(`Safety stop: ${slug} must not infer automatic passenger prices while child/infant pricing remains pending.`);
  }

  const plans = asArray(pricing.ratePlans);
  if (plans.length !== 5) {
    throw new Error(`Safety stop: ${slug} must define exactly 5 rate plans.`);
  }

  const expected = new Map([
    ['general-admission-only', 85],
    ['standard', 99],
    ['standard-with-lunch', 109],
    ['vip', 250],
    ['dominican-resident', 75],
  ]);
  for (const [key, price] of expected) {
    const plan = plans.find(item => item?.key === key);
    if (!plan || Number(plan.price) !== price || plan.basis !== 'person' || plan.currency !== 'USD') {
      throw new Error(`Safety stop: rate plan ${key} is missing or has unexpected pricing.`);
    }
  }

  const standard = plans.find(item => item.key === 'standard');
  const standardLunch = plans.find(item => item.key === 'standard-with-lunch');
  const vip = plans.find(item => item.key === 'vip');
  const resident = plans.find(item => item.key === 'dominican-resident');

  if (standard.transportIncluded !== true || standard.transportMode !== 'shared' || standard.mealIncluded !== false || standard.lockerIncluded !== true) {
    throw new Error(`Safety stop: standard plan structure changed unexpectedly.`);
  }
  if (standardLunch.transportIncluded !== true || standardLunch.mealIncluded !== true) {
    throw new Error(`Safety stop: standard-with-lunch plan structure changed unexpectedly.`);
  }
  if (vip.transportIncluded !== true || vip.transportMode !== 'private' || vip.mealIncluded !== true || vip.drinksIncluded !== true) {
    throw new Error(`Safety stop: VIP plan structure changed unexpectedly.`);
  }
  if (resident.transportIncluded !== false || resident?.eligibility?.type !== 'document_required') {
    throw new Error(`Safety stop: resident plan must require documentation and exclude transport.`);
  }

  const ageReference = pricing.ageReference || {};
  if (ageReference.status !== 'provisional_normalization') {
    throw new Error(`Safety stop: provisional age normalization is missing.`);
  }
  const bands = asArray(ageReference.normalizedAgeBands);
  const adult = bands.find(item => item?.key === 'adult');
  const child = bands.find(item => item?.key === 'child');
  const infant = bands.find(item => item?.key === 'infant');
  if (!adult || adult.minAge !== 12 || adult.maxAge !== null || !child || child.minAge !== 5 || child.maxAge !== 11 || !infant || infant.minAge !== 0 || infant.maxAge !== 4) {
    throw new Error(`Safety stop: provisional age bands must remain adult 12+, child 5–11, infant 0–4.`);
  }
}

function validatePayload(payload) {
  const family = payload.family || {};
  const familyKey = requiredText(family.key, 'family.key');
  if (familyKey !== 'la-hacienda-park') {
    throw new Error(`Safety stop: unexpected family key ${familyKey}.`);
  }

  const experiences = asArray(payload.experiences);
  if (experiences.length !== 1) {
    throw new Error(`Safety stop: expected exactly 1 La Hacienda Park experience, found ${experiences.length}.`);
  }

  const experience = experiences[0];
  const id = requiredText(experience.id, 'experience.id');
  const slug = requiredText(experience.slug, 'experience.slug');
  const operation = requiredText(experience.operation, `${slug}.operation`);
  const experienceFamilyKey = requiredText(experience.familyKey, `${slug}.familyKey`);

  if (operation !== 'create_draft') {
    throw new Error(`Safety stop: ${slug} uses unsupported operation ${operation}.`);
  }
  if (experienceFamilyKey !== familyKey) {
    throw new Error(`Safety stop: ${slug} belongs to ${experienceFamilyKey}, expected ${familyKey}.`);
  }
  if (id !== 'manual-exp-la-hacienda-park-7-aventuras' || slug !== 'la-hacienda-park-7-aventuras') {
    throw new Error(`Safety stop: unexpected La Hacienda identity ${id} / ${slug}.`);
  }

  validatePricing(experience.pricing, slug);
  return { family, familyKey, experience };
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
    select: { id: true, slug: true, name: true, status: true },
  });
  const bySlug = new Map(rows.map(row => [row.slug, row]));

  return unique.map(slug => {
    const row = bySlug.get(slug);
    if (!row) throw new Error(`Safety stop: destination ${slug} was not found for ${label}.`);
    if (row.status !== ContentRecordStatus.PUBLISHED) {
      throw new Error(`Safety stop: destination ${slug} is ${row.status}; expected PUBLISHED.`);
    }
    return row;
  });
}

async function buildProposal(payload, family, experience) {
  const slug = requiredText(experience.slug, 'experience.slug');
  const id = requiredText(experience.id, `${slug}.id`);
  const destinations = await findDestinations(experience.destinationSlugs, slug);

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
    throw new Error(`Safety stop: ${slug} is already PUBLISHED. This workflow never modifies published experiences.`);
  }

  const data = {
    id,
    slug,
    ...mutableClientContent(experience),
    featuredMediaId: experience.featuredMediaId || null,
    galleryMediaSourceIds: asArray(experience.galleryMediaSourceIds),
    sortOrder: nullableNumber(experience.sortOrder) ?? 999,
    status: ContentRecordStatus.DRAFT,
    sourceProvider: ContentSourceProvider.MANUAL,
    provenanceJson: {
      source: payload.source,
      receivedAt: payload.receivedAt,
      dataset: 'client-experiences-2026-09-la-hacienda-park.seed.json',
      family: {
        key: family.key,
        label: family.label || null,
        destinationSlugs: asArray(family.destinationSlugs),
        locationReference: family.locationReference || null,
        operatingHoursReference: family.operatingHoursReference || null,
        mediaStatus: family.mediaStatus || null,
      },
      familyContextRef: experience.familyContextRef || experience.familyKey || family.key,
      note: 'Protected MANUAL draft for web preview. Five commercial rate plans are preserved; passenger age bands are provisional while child/infant prices, transport supplements, policies, and media remain pending.',
    },
  };

  return {
    operation: 'stage_new_draft',
    experience,
    existing,
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
  const { family, familyKey, experience } = validatePayload(payload);
  const proposal = await buildProposal(payload, family, experience);

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'preview-staging',
      writePerformed: false,
      seedPath,
      family: {
        key: familyKey,
        label: family.label || null,
        experienceCount: 1,
        locationReference: family.locationReference || null,
        operatingHoursReference: family.operatingHoursReference || null,
        mediaStatus: family.mediaStatus || null,
      },
      experiences: [{
        operation: proposal.operation,
        slug: proposal.previewSlug,
        existingDraft: proposal.existing,
        statusAfterStage: 'DRAFT',
        destinations: proposal.destinations.map(destination => ({
          slug: destination.slug,
          name: destination.name,
          status: destination.status,
        })),
        pricing: proposal.data.pricingJson,
        booking: proposal.data.bookingJson,
        duration: proposal.data.duration,
        featuredMediaId: proposal.data.featuredMediaId,
        galleryMediaSourceIds: proposal.data.galleryMediaSourceIds,
        editorialFlags: proposal.data.editorialFlagsJson,
      }],
      safeguards: [
        'Exactly 1 La Hacienda Park record is required by this dataset.',
        'The record must use familyKey la-hacienda-park and create_draft.',
        'Destination records must exist and be PUBLISHED.',
        'Exactly 5 rate plans are required: admission-only, Standard, Standard + lunch, VIP, and resident.',
        'US$99 remains the Standard plan price, not an inferred adult-only fare.',
        'Provisional age bands are adult 12+, child 5–11, infant 0–4; child and infant prices remain unresolved.',
        'The resident plan requires documentation and excludes transport.',
        'This workflow creates or refreshes MANUAL DRAFT records only.',
        'It refuses to overwrite inherited/non-MANUAL records.',
        'It refuses to modify an already PUBLISHED record.',
        'No child/infant price, complete transport supplement table, cancellation policy, minimum-passenger rule, or final media is inferred.',
      ],
      nextCommand: 'npm run stage:la-hacienda-park',
    }, null, 2));
    return;
  }

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
        bookingJson: true,
        featuredMediaId: true,
        galleryMediaSourceIds: true,
        editorialFlagsJson: true,
        provenanceJson: true,
        updatedAt: true,
      },
    });

    await applyRelations(tx, row.id, proposal.destinations);
    return row;
  });

  console.log(JSON.stringify({
    mode: 'stage',
    updated: true,
    family: familyKey,
    publishedExperienceModified: false,
    results: [{ operation: proposal.operation, previewSlug: proposal.previewSlug, result }],
    previewRoutes: [`/preview/experiencias/${proposal.previewSlug}?token=<PREVIEW_TOKEN>`],
    reminders: [
      'La Hacienda Park remains MANUAL DRAFT and is intended for protected web preview only.',
      'Child/infant pricing, complete transport supplements, cancellation policy, minimum-passenger/solo rule, and final media remain unresolved where flagged.',
      'Passenger age bands are provisional: adult 12+, child 5–11, infant 0–4.',
      'Do not publish La Hacienda Park until factual gaps and media are reviewed.',
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
