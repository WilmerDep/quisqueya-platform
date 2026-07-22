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
  const masterHash = await bcrypt.hash('master123', 10);
  const adminHash = await bcrypt.hash('admin123', 10);

  // Asegurar Empresas
  await prisma.company.upsert({
    where: { id: 'SYSTEM' },
    update: {},
    create: { id: 'SYSTEM', name: 'Nexus Core Admin', status: 'ACTIVE', planId: 'p3', billingCycle: 'YEARLY' },
  });

  await prisma.company.upsert({
    where: { id: 'C1' },
    update: {},
    create: { id: 'C1', name: 'PrestaFácil RD', status: 'ACTIVE', planId: 'p2', billingCycle: 'MONTHLY' },
  });

  // Asegurar Sucursal Principal
  await prisma.branch.upsert({
    where: { id: 'MAIN' },
    update: {},
    create: { id: 'MAIN', companyId: 'C1', name: 'Sede Principal', address: 'Santo Domingo, RD' },
  });

  // Idempotent Seed: Super Admin / Master
  await prisma.user.upsert({
    where: { username: 'master' },
    update: { passwordHash: masterHash, isActive: true, role: 'SUPER_ADMIN' },
    create: {
      id: 'M1',
      companyId: 'SYSTEM',
      branchId: 'MAIN',
      username: 'master',
      name: 'Nexus Master',
      role: 'SUPER_ADMIN',
      passwordHash: masterHash,
      isActive: true,
      email: 'master@prestafacil.local',
    },
  });

  // Idempotent Seed: Admin Empresa
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminHash, isActive: true, role: 'ADMINISTRADOR' },
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
