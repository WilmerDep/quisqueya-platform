import 'dotenv/config';
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

const APPROVED_BASELINE = new Map([
  ['729', { categoryLabel: 'excursion' }],
  ['726', { categoryLabel: 'excursion' }],
  ['724', { categoryLabel: 'excursion' }],
  ['720', { categoryLabel: 'excursion' }],
  ['716', { categoryLabel: 'excursion' }],
  ['536', { categoryLabel: 'excursion' }],
]);

const PRACTICAL_INFO_PENDING_FLAG = {
  code: 'PRACTICAL_INFO_PENDING_CLIENT_VALIDATION',
  severity: 'info',
  message: 'La fuente migrada y Tourfic no contienen información práctica explícita; requiere validación del cliente antes de publicarla.',
};

function asFlags(value) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item))
    : [];
}

async function main() {
  const rows = await prisma.experience.findMany({
    where: {
      sourceProvider: 'WORDPRESS',
      sourceId: { in: [...APPROVED_BASELINE.keys()] },
    },
    select: {
      id: true,
      sourceId: true,
      slug: true,
      practicalInfoJson: true,
      editorialFlagsJson: true,
    },
  });

  const found = new Set(rows.map(row => row.sourceId));
  const missing = [...APPROVED_BASELINE.keys()].filter(sourceId => !found.has(sourceId));
  if (missing.length) {
    throw new Error(`Missing experiences for source IDs: ${missing.join(', ')}`);
  }

  const results = [];

  for (const row of rows) {
    const baseline = APPROVED_BASELINE.get(row.sourceId);
    const existingFlags = asFlags(row.editorialFlagsJson)
      .filter(flag => flag.code !== PRACTICAL_INFO_PENDING_FLAG.code);
    const hasPracticalInfo = Boolean(
      row.practicalInfoJson
      && typeof row.practicalInfoJson === 'object'
      && !Array.isArray(row.practicalInfoJson)
      && Object.keys(row.practicalInfoJson).length,
    );
    const editorialFlagsJson = hasPracticalInfo
      ? existingFlags
      : [...existingFlags, PRACTICAL_INFO_PENDING_FLAG];

    await prisma.experience.update({
      where: { id: row.id },
      data: {
        categoryLabel: baseline.categoryLabel,
        editorialFlagsJson,
      },
    });

    results.push({
      sourceId: row.sourceId,
      slug: row.slug,
      categoryLabel: baseline.categoryLabel,
      practicalInfoStatus: hasPracticalInfo ? 'available' : 'pending_client_validation',
    });
  }

  results.sort((a, b) => Number(a.sourceId) - Number(b.sourceId));
  console.log(JSON.stringify({ updated: results.length, experiences: results }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
