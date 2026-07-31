import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
const force = process.argv.includes('--force');
const contentDir = join(process.cwd(), 'data', 'content');
const seedPaths = [
  join(contentDir, 'dmc-services.seed.json'),
  join(contentDir, 'dmc-groups.seed.json'),
];

async function readSeed(path) {
  const raw = await readFile(path, 'utf8');
  const payload = JSON.parse(raw);

  if (!payload || !Array.isArray(payload.services)) {
    throw new Error(`The DMC seed at ${path} must contain a services array.`);
  }

  return payload.services;
}

async function main() {
  const serviceGroups = await Promise.all(seedPaths.map(readSeed));
  const servicesBySlug = new Map();

  for (const service of serviceGroups.flat()) {
    if (!service || typeof service.slug !== 'string' || service.slug.trim().length === 0) {
      throw new Error('Every DMC service must define a non-empty slug.');
    }
    servicesBySlug.set(service.slug, service);
  }

  const services = [...servicesBySlug.values()].sort(
    (a, b) => Number(a.order || 0) - Number(b.order || 0),
  );

  if (services.length === 0) {
    throw new Error('The merged DMC seed must contain at least one service.');
  }

  const payload = { services };
  const content = JSON.stringify(payload, null, 2);
  const existing = await prisma.contentPage.findUnique({
    where: { slug: 'dmc-services' },
    select: { id: true, status: true, updatedAt: true },
  });

  if (existing && !force) {
    console.log(
      `DMC services already exist (${existing.id}, ${existing.status}, updated ${existing.updatedAt.toISOString()}).`,
    );
    console.log('No changes were made. Run npm run seed:dmc-services -- --force to replace the current payload.');
    return;
  }

  const provenance = {
    sources: [
      'data/content/dmc-services.seed.json',
      'data/content/dmc-groups.seed.json',
    ],
    purpose: existing
      ? 'forced-public-dmc-contract-refresh'
      : 'initial-public-dmc-contract',
  };

  const page = await prisma.contentPage.upsert({
    where: { slug: 'dmc-services' },
    create: {
      id: 'content-dmc-services',
      slug: 'dmc-services',
      title: 'DMC Services',
      excerpt: 'Structured public content for Quisqueya Travels DMC services.',
      content,
      status: ContentRecordStatus.PUBLISHED,
      sourceProvider: ContentSourceProvider.SYSTEM,
      provenanceJson: provenance,
    },
    update: {
      title: 'DMC Services',
      excerpt: 'Structured public content for Quisqueya Travels DMC services.',
      content,
      status: ContentRecordStatus.PUBLISHED,
      sourceProvider: ContentSourceProvider.SYSTEM,
      provenanceJson: provenance,
    },
    select: { id: true, slug: true, status: true, updatedAt: true },
  });

  console.log(`Seeded ${page.slug} (${page.id}) with status ${page.status}.`);
  console.log(`Merged ${services.length} DMC services from ${seedPaths.length} editorial sources.`);
  console.log(`Updated at ${page.updatedAt.toISOString()}.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
