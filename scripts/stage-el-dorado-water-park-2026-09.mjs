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
  'client-experiences-2026-09-el-dorado-water-park.seed.json',
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

  if (pricing.basis !== 'person' || pricing.currency !== 'USD' || Number(pricing.from) !== 129) {
    throw new Error(`Safety stop: ${slug} visitor base pricing does not match the approved El Dorado structure.`);
  }

  const tiers = asArray(pricing.tiers);
  if (tiers.length !== 3) {
    throw new Error(`Safety stop: ${slug} must define exactly 3 visitor tiers.`);
  }

  const visitor = asArray(pricing.ratePlans).find(plan => plan?.key === 'visitor-regular');
  const resident = asArray(pricing.ratePlans).find(plan => plan?.key === 'dominican-resident');
  if (!visitor || !resident) {
    throw new Error(`Safety stop: ${slug} must include visitor-regular and dominican-resident rate plans.`);
  }
  if (visitor.transportIncluded !== true) {
    throw new Error(`Safety stop: ${slug} visitor rate plan must keep transportIncluded=true.`);
  }
  if (resident.transportIncluded !== false || resident?.eligibility?.type !== 'document_required') {
    throw new Error(`Safety stop: ${slug} resident rate plan must require documentation and exclude transport.`);
  }

  const addOns = asArray(pricing.addOns);
  if (addOns.length !== 6) {
    throw new Error(`Safety stop: ${slug} must define exactly 6 VIP add-ons.`);
  }
  for (const addOn of addOns) {
    if (addOn.basis !== 'unit' || addOn.admissionIncluded !== false) {
      throw new Error(`Safety stop: VIP add-on ${addOn.key || '<unknown>'} must be unit-based and exclude park admission.`);
    }
  }
}

function validatePayload(payload) {
  const family = payload.family || {};
  const familyKey = requiredText(family.key, 'family.key');
  if (familyKey !== 'el-dorado-water-park') {
    throw new Error(`Safety stop: unexpected family key ${familyKey}.`);
  }

  const experiences = asArray(payload.experiences);
  if (experiences.length !== 1) {
    throw new Error(`Safety stop: expected exactly 1 El Dorado Water Park experience, found ${experiences.length}.`);
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
  if (id !== 'manual-exp-el-dorado-water-park-cap-cana' || slug !== 'el-dorado-water-park-cap-cana') {
    throw new Error(`Safety stop: unexpected El Dorado identity ${id} / ${slug}.`);
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
      dataset: 'client-experiences-2026-09-el-dorado-water-park.seed.json',
      family: {
        key: family.key,
        label: family.label || null,
        destinationSlugs: asArray(family.destinationSlugs),
        locationReference: family.locationReference || null,
        operatingScheduleReference: family.operatingScheduleReference || null,
        mediaStatus: family.mediaStatus || null,
      },
      familyContextRef: experience.familyContextRef || experience.familyKey || family.key,
      note: 'Protected MANUAL draft for web preview. Resident eligibility, VIP admission separation, unresolved policy gaps, and pending media are preserved without inference.',
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
        operatingScheduleReference: family.operatingScheduleReference || null,
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
        availability: proposal.data.availabilityJson,
        duration: proposal.data.duration,
        featuredMediaId: proposal.data.featuredMediaId,
        galleryMediaSourceIds: proposal.data.galleryMediaSourceIds,
        editorialFlags: proposal.data.editorialFlagsJson,
      }],
      safeguards: [
        'Exactly 1 El Dorado Water Park record is required by this dataset.',
        'The record must use familyKey el-dorado-water-park and create_draft.',
        'Destination records must exist and be PUBLISHED.',
        'Visitor and Dominican-resident rate plans are preserved as separate commercial contexts.',
        'The resident rate plan must require documentation and must not include transport.',
        'Exactly 6 VIP add-ons are required; each is unit-based and explicitly excludes park admission.',
        'This workflow creates or refreshes MANUAL DRAFT records only.',
        'It refuses to overwrite inherited/non-MANUAL records.',
        'It refuses to modify an already PUBLISHED record.',
        'No cancellation policy, minimum-passenger rule, resident age bands, or final media are inferred by this workflow.',
      ],
      nextCommand: 'npm run stage:el-dorado-water-park',
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
        availabilityJson: true,
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
      'El Dorado Water Park remains MANUAL DRAFT and is intended for protected web preview only.',
      'Cancellation policy, minimum-passenger/solo-booking rule, resident age-band confirmation, and final media remain unresolved where flagged.',
      'VIP services are add-ons and do not include park admission.',
      'Do not publish El Dorado Water Park until factual gaps and media are reviewed.',
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
