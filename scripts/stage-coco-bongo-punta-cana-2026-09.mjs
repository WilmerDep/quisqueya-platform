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
const seedPath = path.join(process.cwd(), 'data', 'content', 'client-experiences-2026-09-coco-bongo-punta-cana.seed.json');

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Missing required text: ${label}`);
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
  if (!pricing || typeof pricing !== 'object') throw new Error(`Safety stop: ${slug} has no pricing object.`);
  if (pricing.basis !== 'person' || pricing.currency !== 'USD' || Number(pricing.from) !== 75) {
    throw new Error(`Safety stop: ${slug} base pricing does not match the approved Coco Bongo structure.`);
  }
  if (pricing.adult !== null || pricing.child !== null || pricing.infant !== null || asArray(pricing.tiers).length !== 0) {
    throw new Error(`Safety stop: ${slug} must not create passenger-age pricing tiers for this adult-only product.`);
  }
  if (pricing.pricingMode !== 'date_and_package_dependent') {
    throw new Error(`Safety stop: ${slug} must preserve date_and_package_dependent pricing.`);
  }

  const plans = asArray(pricing.ratePlans);
  if (plans.length !== 5) throw new Error(`Safety stop: ${slug} must define exactly 5 rate plans.`);

  const expected = new Map([
    ['drink-pack', 75],
    ['regular-open-bar', 90],
    ['premium', 125],
    ['gold-member-vip', 170],
    ['front-row-vip', 190],
  ]);
  for (const [key, price] of expected) {
    const plan = plans.find(item => item?.key === key);
    if (!plan || Number(plan.priceFrom) !== price || plan.basis !== 'person' || plan.currency !== 'USD') {
      throw new Error(`Safety stop: rate plan ${key} is missing or has unexpected base pricing.`);
    }
    if (plan?.eligibility?.type !== 'adult_only' || Number(plan?.eligibility?.minimumAge) !== 18) {
      throw new Error(`Safety stop: rate plan ${key} must remain adult-only 18+.`);
    }
    if (plan.transportIncluded !== true || plan.transportMode !== 'shared') {
      throw new Error(`Safety stop: rate plan ${key} must preserve shared transport as documented.`);
    }
  }

  const weekendExpected = new Map([
    ['regular-open-bar', 99],
    ['premium', 135],
    ['gold-member-vip', 189],
    ['front-row-vip', 199],
  ]);
  for (const [key, price] of weekendExpected) {
    const plan = plans.find(item => item.key === key);
    const rule = asArray(plan.dayPricing)[0];
    const days = asArray(rule?.days);
    if (!rule || Number(rule.price) !== price || days.join(',') !== 'friday,saturday,sunday') {
      throw new Error(`Safety stop: ${key} Friday/Saturday/Sunday pricing changed unexpectedly.`);
    }
  }

  const premium = plans.find(item => item.key === 'premium');
  const gold = plans.find(item => item.key === 'gold-member-vip');
  const front = plans.find(item => item.key === 'front-row-vip');
  if (premium.area !== 'general' || premium.reservedSeat !== false) {
    throw new Error('Safety stop: Premium must remain general-area without reserved seating.');
  }
  if (gold.area !== 'vip' || gold.reservedSeat !== true || gold.priorityAccess !== true) {
    throw new Error('Safety stop: Gold Member VIP structure changed unexpectedly.');
  }
  if (front.area !== 'vip_preferred_front_row' || front.reservedSeat !== true || front.priorityAccess !== true) {
    throw new Error('Safety stop: Front Row VIP structure changed unexpectedly.');
  }
}

function validateCancellation(policy, slug) {
  if (!policy || policy.refundable !== false) throw new Error(`Safety stop: ${slug} must remain non-refundable.`);
  const change = policy.dateChange || {};
  if (Number(change.minimumAdvanceHours) !== 48 || change.subjectToAvailability !== true || change.subjectToProviderApproval !== true) {
    throw new Error(`Safety stop: ${slug} date-change policy must remain 48h, subject to availability and provider approval.`);
  }
}

function validatePayload(payload) {
  const family = payload.family || {};
  const familyKey = requiredText(family.key, 'family.key');
  if (familyKey !== 'coco-bongo-punta-cana') throw new Error(`Safety stop: unexpected family key ${familyKey}.`);

  const experiences = asArray(payload.experiences);
  if (experiences.length !== 1) throw new Error(`Safety stop: expected exactly 1 Coco Bongo experience, found ${experiences.length}.`);

  const experience = experiences[0];
  const id = requiredText(experience.id, 'experience.id');
  const slug = requiredText(experience.slug, 'experience.slug');
  if (requiredText(experience.operation, `${slug}.operation`) !== 'create_draft') throw new Error(`Safety stop: ${slug} must use create_draft.`);
  if (requiredText(experience.familyKey, `${slug}.familyKey`) !== familyKey) throw new Error(`Safety stop: ${slug} family mismatch.`);
  if (id !== 'manual-exp-coco-bongo-punta-cana' || slug !== 'coco-bongo-punta-cana-show-disco') {
    throw new Error(`Safety stop: unexpected Coco Bongo identity ${id} / ${slug}.`);
  }

  validatePricing(experience.pricing, slug);
  validateCancellation(experience.cancellationPolicy, slug);

  if (Number(experience?.booking?.requirements?.minimumAge) !== 18 || experience?.booking?.requirements?.photoIdRequired !== true) {
    throw new Error(`Safety stop: ${slug} must preserve 18+ and photo-ID requirements.`);
  }
  return { family, familyKey, experience };
}

function practicalInfoWithPolicy(experience) {
  const policy = experience.cancellationPolicy || null;
  const cancellationPolicy = policy
    ? 'Esta experiencia es no reembolsable. Los cambios de fecha deben solicitarse con al menos 48 horas de anticipación y están sujetos a disponibilidad y aprobación del proveedor.'
    : null;

  return {
    ...(experience.practicalInfo || {}),
    cancellationPolicy,
    cancellationPolicyDetails: policy,
  };
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
    practicalInfoJson: practicalInfoWithPolicy(experience),
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
  const rows = await prisma.destination.findMany({ where: { slug: { in: unique } }, select: { id: true, slug: true, name: true, status: true } });
  const bySlug = new Map(rows.map(row => [row.slug, row]));
  return unique.map(slug => {
    const row = bySlug.get(slug);
    if (!row) throw new Error(`Safety stop: destination ${slug} was not found for ${label}.`);
    if (row.status !== ContentRecordStatus.PUBLISHED) throw new Error(`Safety stop: destination ${slug} is ${row.status}; expected PUBLISHED.`);
    return row;
  });
}

async function buildProposal(payload, family, experience) {
  const slug = requiredText(experience.slug, 'experience.slug');
  const id = requiredText(experience.id, `${slug}.id`);
  const destinations = await findDestinations(experience.destinationSlugs, slug);
  const existing = await prisma.experience.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, sourceProvider: true, status: true, provenanceJson: true, updatedAt: true },
  });
  if (existing && existing.sourceProvider !== ContentSourceProvider.MANUAL) throw new Error(`Safety stop: ${slug} already exists with sourceProvider ${existing.sourceProvider}.`);
  if (existing && existing.status === ContentRecordStatus.PUBLISHED) throw new Error(`Safety stop: ${slug} is already PUBLISHED. This workflow never modifies published experiences.`);

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
      dataset: 'client-experiences-2026-09-coco-bongo-punta-cana.seed.json',
      family: {
        key: family.key,
        label: family.label || null,
        destinationSlugs: asArray(family.destinationSlugs),
        locationReference: family.locationReference || null,
        operatingScheduleReference: family.operatingScheduleReference || null,
        mediaStatus: family.mediaStatus || null,
      },
      familyContextRef: experience.familyContextRef || experience.familyKey || family.key,
      note: 'Protected MANUAL draft for web preview. Five date/package-dependent rate plans, 18+ requirements and the non-refundable policy are preserved; Drink Pack availability, exact hotel coverage and final media remain pending.',
    },
  };
  return { operation: 'stage_new_draft', experience, existing, destinations, data, previewSlug: slug };
}

async function applyRelations(tx, experienceId, destinations) {
  await tx.experienceDestination.deleteMany({ where: { experienceId } });
  for (const [index, destination] of destinations.entries()) {
    await tx.experienceDestination.create({ data: { experienceId, destinationId: destination.id, isPrimary: index === 0 } });
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
        operatingScheduleReference: family.operatingScheduleReference || null,
        mediaStatus: family.mediaStatus || null,
      },
      experiences: [{
        operation: proposal.operation,
        slug: proposal.previewSlug,
        existingDraft: proposal.existing,
        statusAfterStage: 'DRAFT',
        destinations: proposal.destinations.map(destination => ({ slug: destination.slug, name: destination.name, status: destination.status })),
        pricing: proposal.data.pricingJson,
        booking: proposal.data.bookingJson,
        availability: proposal.data.availabilityJson,
        cancellationPolicy: proposal.data.practicalInfoJson?.cancellationPolicy || null,
        duration: proposal.data.duration,
        featuredMediaId: proposal.data.featuredMediaId,
        galleryMediaSourceIds: proposal.data.galleryMediaSourceIds,
        editorialFlags: proposal.data.editorialFlagsJson,
      }],
      safeguards: [
        'Exactly 1 Coco Bongo Punta Cana record is required by this dataset.',
        'The record must use familyKey coco-bongo-punta-cana and create_draft.',
        'Destination records must exist and be PUBLISHED.',
        'Exactly 5 adult-only rate plans are required.',
        'Regular, Premium, Gold Member VIP and Front Row VIP preserve Friday/Saturday/Sunday pricing from the source.',
        'Premium remains general-area; Gold Member and Front Row preserve their VIP seating/access differences.',
        'The experience remains 18+ with official photo identification required.',
        'The non-refundable policy is persisted as web-safe text while the structured 48-hour date-change rule is retained separately in practicalInfoJson.',
        'This workflow creates or refreshes MANUAL DRAFT records only.',
        'It refuses to overwrite inherited/non-MANUAL records or modify an already PUBLISHED record.',
        'No Drink Pack exact day schedule, exact hotel coverage, or final media is inferred.',
      ],
      nextCommand: 'npm run stage:coco-bongo-punta-cana',
    }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async tx => {
    if (proposal.existing) {
      const current = await tx.experience.findUnique({ where: { slug: proposal.previewSlug }, select: { id: true, sourceProvider: true, status: true, updatedAt: true } });
      if (!current || current.sourceProvider !== ContentSourceProvider.MANUAL || current.status === ContentRecordStatus.PUBLISHED) {
        throw new Error(`Safety stop: ${proposal.previewSlug} changed identity/status after preview.`);
      }
      if (current.updatedAt.getTime() !== proposal.existing.updatedAt.getTime()) throw new Error(`Safety stop: ${proposal.previewSlug} changed after preview. Re-run preview first.`);
    }

    const { id, ...mutable } = proposal.data;
    const row = await tx.experience.upsert({
      where: { slug: proposal.previewSlug },
      create: { id, ...mutable },
      update: mutable,
      select: {
        id: true, slug: true, title: true, status: true, sourceProvider: true, duration: true,
        pricingJson: true, bookingJson: true, availabilityJson: true, practicalInfoJson: true,
        featuredMediaId: true, galleryMediaSourceIds: true, editorialFlagsJson: true, provenanceJson: true, updatedAt: true,
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
      'Coco Bongo Punta Cana remains MANUAL DRAFT and is intended for protected web preview only.',
      'Drink Pack exact operating days, exact hotel/pickup coverage and final media remain unresolved where flagged.',
      'Pricing is date/package dependent; Friday/Saturday/Sunday overrides are preserved for four packages.',
      'The experience is 18+, photo ID is mandatory, and reservations are non-refundable.',
      'Do not publish Coco Bongo Punta Cana until factual gaps and media are reviewed.',
    ],
  }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });