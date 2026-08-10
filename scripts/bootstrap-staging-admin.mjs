import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const enabled = String(process.env.BOOTSTRAP_ADMIN_ENABLED || '').toLowerCase() === 'true';
if (!enabled) {
  console.log('Staging admin bootstrap disabled; skipping.');
  process.exit(0);
}

const username = String(process.env.BOOTSTRAP_ADMIN_USERNAME || '').trim();
const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
const name = String(process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador Quisqueya').trim();

if (!username || !email || !password) {
  throw new Error('BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required when bootstrap is enabled.');
}
if (password.length < 12) {
  throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');
}

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || '',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || '',
});
const prisma = new PrismaClient({ adapter });

try {
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.plan.upsert({
    where: { id: 'quisqueya-core' },
    update: { name: 'Quisqueya Core', maxUsers: 25, maxBranches: 10, maxClients: 10000, featuresJson: { content: true, crm: true, reviews: true, dmc: true } },
    create: { id: 'quisqueya-core', name: 'Quisqueya Core', maxUsers: 25, maxBranches: 10, maxClients: 10000, featuresJson: { content: true, crm: true, reviews: true, dmc: true } },
  });

  await prisma.company.upsert({
    where: { id: 'QUISQUEYA' },
    update: { name: 'Quisqueya Travel & DMC', planId: 'quisqueya-core', status: 'ACTIVE' },
    create: { id: 'QUISQUEYA', name: 'Quisqueya Travel & DMC', status: 'ACTIVE', planId: 'quisqueya-core', billingCycle: 'YEARLY' },
  });

  await prisma.branch.upsert({
    where: { id: 'QUISQUEYA_MAIN' },
    update: { companyId: 'QUISQUEYA', name: 'Operación principal', address: 'Santo Domingo, República Dominicana' },
    create: { id: 'QUISQUEYA_MAIN', companyId: 'QUISQUEYA', name: 'Operación principal', address: 'Santo Domingo, República Dominicana' },
  });

  await prisma.user.upsert({
    where: { username },
    update: { companyId: 'QUISQUEYA', branchId: 'QUISQUEYA_MAIN', name, role: 'SUPER_ADMIN', passwordHash, isActive: true, email },
    create: { id: 'QUISQUEYA_ADMIN', companyId: 'QUISQUEYA', branchId: 'QUISQUEYA_MAIN', username, name, role: 'SUPER_ADMIN', passwordHash, isActive: true, email },
  });

  console.log(`Staging admin bootstrap complete for username: ${username}`);
} finally {
  await prisma.$disconnect();
}
