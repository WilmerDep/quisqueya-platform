import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
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
const ROLLBACK_INDEX = process.argv.indexOf('--rollback');
const ROLLBACK_PATH = ROLLBACK_INDEX >= 0 ? process.argv[ROLLBACK_INDEX + 1] : undefined;

const TARGET = {
  sourceProvider: 'WORDPRESS',
  sourceId: '536',
  expectedSlug: 'isla-saona',
};

const FEATURED_MEDIA = {
  sourceProvider: 'WORDPRESS',
  sourceId: '181',
  expectedUrlToken: 'Isla-Saona-1.png',
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function assertTarget(row) {
  if (!row) throw new Error(`Saona Regular not found for sourceId ${TARGET.sourceId}.`);
  if (row.sourceProvider !== TARGET.sourceProvider) {
    throw new Error(`Safety stop: expected provider ${TARGET.sourceProvider}, found ${row.sourceProvider}.`);
  }
  if (row.sourceId !== TARGET.sourceId) {
    throw new Error(`Safety stop: expected sourceId ${TARGET.sourceId}, found ${row.sourceId}.`);
  }
  if (row.slug !== TARGET.expectedSlug) {
    throw new Error(`Safety stop: expected slug ${TARGET.expectedSlug}, found ${row.slug}.`);
  }
}

function repairFaqs(value) {
  const faqs = asArray(value);
  let replaced = false;
  const repaired = faqs.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const faq = { ...item };
    const title = String(faq.title || faq.question || '').toLowerCase();
    const answer = String(faq.desc || faq.answer || faq.description || '').toLowerCase();
    const matches = title.includes('anticip') || answer.includes('15 días') || answer.includes('15 dias');
    if (!matches) return faq;

    const newAnswer = 'La disponibilidad debe confirmarse al momento de reservar. Las reservas realizadas con 18 horas o menos de anticipación están sujetas a confirmación de disponibilidad.';
    if ('desc' in faq || !('answer' in faq)) faq.desc = newAnswer;
    if ('answer' in faq) faq.answer = newAnswer;
    if ('description' in faq) faq.description = newAnswer;
    replaced = true;
    return faq;
  });

  if (!replaced) {
    repaired.push({
      title: '¿Es necesario reservar con anticipación?',
      desc: 'La disponibilidad debe confirmarse al momento de reservar. Las reservas realizadas con 18 horas o menos de anticipación están sujetas a confirmación de disponibilidad.',
      order: repaired.length,
    });
  }

  return repaired;
}

async function getFeaturedMedia() {
  const media = await prisma.mediaAsset.findFirst({
    where: {
      sourceProvider: FEATURED_MEDIA.sourceProvider,
      sourceId: FEATURED_MEDIA.sourceId,
    },
    select: {
      id: true,
      sourceProvider: true,
      sourceId: true,
      publicUrl: true,
    },
  });

  if (!media) throw new Error(`Featured media sourceId ${FEATURED_MEDIA.sourceId} not found.`);
  if (!media.publicUrl.includes(FEATURED_MEDIA.expectedUrlToken)) {
    throw new Error(`Safety stop: sourceId ${FEATURED_MEDIA.sourceId} points to unexpected media ${media.publicUrl}.`);
  }
  return media;
}

function snapshotPayload(row) {
  return {
    createdAt: new Date().toISOString(),
    purpose: 'Rollback snapshot before Saona public consistency repair',
    target: TARGET,
    row: {
      id: row.id,
      sourceProvider: row.sourceProvider,
      sourceId: row.sourceId,
      slug: row.slug,
      featuredMediaId: row.featuredMediaId,
      faqsJson: row.faqsJson,
      provenanceJson: row.provenanceJson,
    },
  };
}

async function writeSnapshot(row) {
  const directory = path.resolve('data/backups');
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join(directory, `saona-public-consistency-before-${stamp}.json`);
  await writeFile(filepath, `${JSON.stringify(snapshotPayload(row), null, 2)}\n`, 'utf8');
  return filepath;
}

async function rollback(snapshotArgument) {
  if (!snapshotArgument) {
    throw new Error('Usage: node scripts/repair-saona-public-consistency.mjs --rollback data/backups/<snapshot>.json');
  }
  const snapshotPath = path.resolve(snapshotArgument);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const original = snapshot?.row;
  assertTarget(original);

  const restored = await prisma.$transaction(async tx => {
    const current = await tx.experience.findUnique({
      where: { id: original.id },
      select: { id: true, sourceProvider: true, sourceId: true, slug: true },
    });
    assertTarget(current);
    return tx.experience.update({
      where: { id: original.id },
      data: {
        featuredMediaId: original.featuredMediaId,
        faqsJson: original.faqsJson,
        provenanceJson: original.provenanceJson,
      },
      select: { id: true, sourceId: true, slug: true, featuredMediaId: true, faqsJson: true },
    });
  });

  console.log(JSON.stringify({ mode: 'rollback', rolledBack: true, snapshotPath, result: restored }, null, 2));
}

async function main() {
  if (ROLLBACK_INDEX >= 0) {
    await rollback(ROLLBACK_PATH);
    return;
  }

  const row = await prisma.experience.findFirst({
    where: {
      sourceProvider: TARGET.sourceProvider,
      sourceId: TARGET.sourceId,
    },
    select: {
      id: true,
      sourceProvider: true,
      sourceId: true,
      slug: true,
      title: true,
      featuredMediaId: true,
      faqsJson: true,
      provenanceJson: true,
      updatedAt: true,
    },
  });
  assertTarget(row);

  const media = await getFeaturedMedia();
  const provenanceLegacy = asObject(row.provenanceJson);
  const proposedFaqs = repairFaqs(row.faqsJson);
  const proposed = {
    featuredMediaId: media.id,
    faqsJson: proposedFaqs,
    provenanceJson: {
      ...provenanceLegacy,
      publicConsistencyRepair: {
        repairedAt: new Date().toISOString(),
        repair: 'saona-featured-media-and-booking-faq-v1',
        notes: 'Corrected inherited featured media mismatch and removed obsolete 15-day booking guidance.',
      },
    },
  };

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'preview',
      writePerformed: false,
      target: { id: row.id, sourceId: row.sourceId, slug: row.slug, title: row.title },
      current: { featuredMediaId: row.featuredMediaId, faqsJson: row.faqsJson },
      proposed: {
        featuredMedia: media,
        featuredMediaId: proposed.featuredMediaId,
        faqsJson: proposed.faqsJson,
      },
      nextCommand: 'npm run apply:saona-consistency',
    }, null, 2));
    return;
  }

  const snapshotPath = await writeSnapshot(row);
  const result = await prisma.$transaction(async tx => {
    const current = await tx.experience.findUnique({
      where: { id: row.id },
      select: { id: true, sourceProvider: true, sourceId: true, slug: true, updatedAt: true },
    });
    assertTarget(current);
    if (current.updatedAt.getTime() !== row.updatedAt.getTime()) {
      throw new Error('Safety stop: Saona Regular changed after preview read. Re-run preview before applying.');
    }

    const txMedia = await tx.mediaAsset.findFirst({
      where: { sourceProvider: FEATURED_MEDIA.sourceProvider, sourceId: FEATURED_MEDIA.sourceId },
      select: { id: true, publicUrl: true },
    });
    if (!txMedia || txMedia.id !== media.id || !txMedia.publicUrl.includes(FEATURED_MEDIA.expectedUrlToken)) {
      throw new Error('Safety stop: expected Saona featured media changed before apply.');
    }

    return tx.experience.update({
      where: { id: row.id },
      data: proposed,
      select: { id: true, sourceId: true, slug: true, featuredMediaId: true, faqsJson: true },
    });
  });

  console.log(JSON.stringify({ mode: 'apply', updated: true, snapshotPath, result }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
