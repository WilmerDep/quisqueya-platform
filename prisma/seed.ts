import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'prestafacil_rd',
});

const prisma = new PrismaClient({ adapter });

export async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Seeding omitido en entorno de producción (NODE_ENV=production).');
    return;
  }

  const masterHash = await bcrypt.hash('master123', 10);
  const adminHash = await bcrypt.hash('admin123', 10);

  // Asegurar Empresa Sistema (SaaS Master)
  await prisma.company.upsert({
    where: { id: 'SYSTEM' },
    update: {},
    create: { id: 'SYSTEM', name: 'Nexus Core Admin', status: 'ACTIVE', planId: 'p3', billingCycle: 'YEARLY' },
  });

  // Asegurar Sucursal Principal del Sistema SaaS
  await prisma.branch.upsert({
    where: { id: 'SYS_MAIN' },
    update: {},
    create: { id: 'SYS_MAIN', companyId: 'SYSTEM', name: 'Sede Central Nexus', address: 'Santo Domingo, RD' },
  });

  // Asegurar Empresa Demo / Cliente
  await prisma.company.upsert({
    where: { id: 'C1' },
    update: {},
    create: { id: 'C1', name: 'PrestaFácil RD', status: 'ACTIVE', planId: 'p2', billingCycle: 'MONTHLY' },
  });

  // Asegurar Sucursal Principal Cliente C1
  await prisma.branch.upsert({
    where: { id: 'MAIN' },
    update: {},
    create: { id: 'MAIN', companyId: 'C1', name: 'Sede Principal', address: 'Santo Domingo, RD' },
  });

  // Idempotent Seed: Super Admin / Master (pertenece a SYSTEM / SYS_MAIN)
  await prisma.user.upsert({
    where: { username: 'master' },
    update: {},
    create: {
      id: 'M1',
      companyId: 'SYSTEM',
      branchId: 'SYS_MAIN',
      username: 'master',
      name: 'Nexus Master',
      role: 'SUPER_ADMIN',
      passwordHash: masterHash,
      isActive: true,
      email: 'master@prestafacil.local',
    },
  });

  // Idempotent Seed: Admin Empresa (pertenece a C1 / MAIN)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: 'U1',
      companyId: 'C1',
      branchId: 'MAIN',
      username: 'admin',
      name: 'Admin PrestaFácil',
      role: 'ADMINISTRADOR',
      passwordHash: adminHash,
      isActive: true,
      email: 'admin@prestafacil.local',
    },
  });

  console.log('✅ Seeding completado exitosamente con Bcrypt.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main()
    .catch(e => {
      console.error('❌ Error durante seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
