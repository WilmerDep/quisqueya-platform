// C15.4 — Read-only, local-only regression probe for Prisma's MariaDB adapter.
// Run only inside an isolated QA worktree after npm has regenerated package-lock.json.
import 'dotenv/config';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const require = createRequire(import.meta.url);
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = Number(process.env.MYSQL_PORT || 3306);
const database = process.env.MYSQL_DATABASE || 'quisqueya_core';
const password = process.env.MYSQL_PASSWORD || '';

if (host !== '127.0.0.1' || port !== 3306 || database !== 'quisqueya_core') {
  throw new Error('C15.4_LOCAL_DATABASE_REQUIRED');
}

// Guard against reintroducing the older connector bundled by the Prisma
// adapter. The root and adapter-resolved MariaDB versions must be identical.
// MariaDB does not export the "./package.json" package subpath under Node 24.
// Resolve its real entry point and read the nearest owning manifest instead.
function installedMariaDbVersion(loader) {
  let directory = dirname(loader.resolve('mariadb'));
  for (let depth = 0; depth < 12; depth += 1) {
    const manifestPath = join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name === 'mariadb' && typeof manifest.version === 'string') {
        return manifest.version;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error('C15.4_MARIADB_MANIFEST_NOT_FOUND');
}

const adapterRequire = createRequire(require.resolve('@prisma/adapter-mariadb'));
const rootMariaVersion = installedMariaDbVersion(require);
const adapterMariaVersion = installedMariaDbVersion(adapterRequire);

console.log('=== C15.4 PRISMA MARIADB REGRESSION ===');
console.log('ROOT_DRIVER=' + rootMariaVersion);
console.log('ADAPTER_DRIVER=' + adapterMariaVersion);

if (rootMariaVersion !== '3.5.4' || adapterMariaVersion !== rootMariaVersion) {
  throw new Error('C15.4_UNPATCHED_OR_DUPLICATE_MARIADB_DRIVER');
}

const isLocalDevelopment =
  process.env.NODE_ENV === 'development' &&
  ['127.0.0.1', 'localhost', '::1'].includes(host);

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host,
    port,
    database,
    user: process.env.MYSQL_USER || 'root',
    ...(password ? { password } : {}),
    connectionLimit: 2,
    prepareCacheLength: 0,
    ...(isLocalDevelopment && !password ? { allowPublicKeyRetrieval: true } : {}),
  }),
});

let step = 'START';
const watchdog = setTimeout(() => {
  console.error('C15.4_TIMEOUT_AT=' + step);
  process.exit(2);
}, 15000);

try {
  step = 'SELECT_ONE';
  const result = await prisma.$queryRaw`SELECT 1 AS comprobacion`;
  if (Number(result[0]?.comprobacion) !== 1) throw new Error('C15.4_SELECT_MISMATCH');
  console.log('SELECT_ONE=OK');

  step = 'MISSING_SLUG';
  const missing = await prisma.experience.findUnique({
    where: { slug: 'c154-slug-inexistente-diagnostico-20261115' },
    select: { id: true },
  });
  if (missing !== null) throw new Error('C15.4_MISSING_SLUG_COLLISION');
  console.log('MISSING_SLUG=NULL_OK');

  step = 'SCAPE_PARK';
  const scape = await prisma.experience.findUnique({
    where: { slug: 'scape-park-full-admission-cap-cana' },
    select: { status: true, pricingJson: true },
  });
  const pricing = scape?.pricingJson;
  if (
    scape?.status !== 'DRAFT' ||
    !pricing || typeof pricing !== 'object' || Array.isArray(pricing) ||
    !Array.isArray(pricing.tiers) || pricing.tiers.length !== 3 ||
    !Array.isArray(pricing.addOns) || pricing.addOns.length !== 3
  ) {
    throw new Error('C15.4_SCAPE_PARK_CONTRACT_MISMATCH');
  }
  console.log('SCAPE_PARK=DRAFT_3_TIERS_3_ADDONS');
  console.log('C15.4_PRISMA_MARIADB_READ_ONLY_OK');
} catch (error) {
  console.error('C15.4_FAILURE_AT=' + step);
  console.error('C15.4_ERROR=' + (error.code || error.name));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect().catch(() => {});
  clearTimeout(watchdog);
}
