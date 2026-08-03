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

const canonicalSlugs = [
  {
    aliases: ['santiago', 'santiago-de-los-caballeros'],
    slug: 'santiago-de-los-caballeros',
  },
];

async function main() {
  let updated = 0;

  for (const rule of canonicalSlugs) {
    const destination = await prisma.destination.findFirst({
      where: {
        sourceProvider: 'WORDPRESS',
        slug: { in: rule.aliases },
      },
      select: { id: true, slug: true, name: true },
    });

    if (!destination) {
      console.warn(`Destination alias not found: ${rule.aliases.join(', ')}`);
      continue;
    }

    if (destination.slug === rule.slug) {
      console.log(`Destination slug already canonical: ${rule.slug}`);
      continue;
    }

    const conflict = await prisma.destination.findFirst({
      where: {
        slug: rule.slug,
        id: { not: destination.id },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new Error(`Cannot canonicalize ${destination.slug}: slug ${rule.slug} is already used by another destination.`);
    }

    await prisma.destination.update({
      where: { id: destination.id },
      data: { slug: rule.slug },
    });

    updated += 1;
    console.log(`Canonicalized destination slug: ${destination.slug} -> ${rule.slug}`);
  }

  console.log(`Destination slug canonicalization completed: ${updated} updated.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
