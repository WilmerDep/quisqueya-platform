import 'dotenv/config';
import { readFile } from 'node:fs/promises';
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

const TARGET = {
  sourceProvider: 'WORDPRESS',
  sourceId: '536',
  expectedSlug: 'isla-saona',
};

function assertSnapshot(snapshot) {
  const row = snapshot?.row;
  if (!row || typeof row !== 'object') {
    throw new Error('Invalid Saona rollback snapshot: missing row.');
  }
  if (row.sourceProvider !== TARGET.sourceProvider) {
    throw new Error(`Safety stop: expected provider ${TARGET.sourceProvider}, found ${row.sourceProvider}.`);
  }
  if (row.sourceId !== TARGET.sourceId) {
    throw new Error(`Safety stop: expected sourceId ${TARGET.sourceId}, found ${row.sourceId}.`);
  }
  if (row.slug !== TARGET.expectedSlug) {
    throw new Error(`Safety stop: expected slug ${TARGET.expectedSlug}, found ${row.slug}.`);
  }
  return row;
}

async function main() {
  const snapshotArgument = process.argv[2];
  if (!snapshotArgument) {
    throw new Error('Usage: npm run rollback:saona-regular -- data/backups/<snapshot>.json');
  }

  const snapshotPath = path.resolve(snapshotArgument);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const original = assertSnapshot(snapshot);

  const current = await prisma.experience.findUnique({
    where: { id: original.id },
    select: {
      id: true,
      sourceProvider: true,
      sourceId: true,
      slug: true,
    },
  });

  if (!current) throw new Error(`Saona Regular row ${original.id} no longer exists.`);
  if (
    current.sourceProvider !== TARGET.sourceProvider ||
    current.sourceId !== TARGET.sourceId ||
    current.slug !== TARGET.expectedSlug
  ) {
    throw new Error('Safety stop: current row identity no longer matches Saona Regular.');
  }

  const restored = await prisma.$transaction(async tx =>
    tx.experience.update({
      where: { id: original.id },
      data: {
        pricingMode: original.pricingMode,
        duration: original.duration,
        durationValue: original.durationValue,
        durationUnit: original.durationUnit,
        pricingJson: original.pricingJson,
        bookingJson: original.bookingJson,
        availabilityJson: original.availabilityJson,
        practicalInfoJson: original.practicalInfoJson,
        includedItemsJson: original.includedItemsJson,
        excludedItemsJson: original.excludedItemsJson,
        itineraryJson: original.itineraryJson,
        editorialFlagsJson: original.editorialFlagsJson,
        provenanceJson: original.provenanceJson,
      },
      select: {
        id: true,
        sourceId: true,
        slug: true,
        title: true,
        pricingMode: true,
        duration: true,
      },
    }),
  );

  console.log(JSON.stringify({
    rolledBack: true,
    snapshotPath,
    target: restored,
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
