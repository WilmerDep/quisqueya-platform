import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quisqueya_core',
});

const prisma = new PrismaClient({ adapter });

export async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('Identity seed skipped in production.');
    return;
  }

  const username = process.env.LOCAL_ADMIN_USERNAME || 'master';
  const password = process.env.LOCAL_ADMIN_PASSWORD || 'master123';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.plan.upsert({
    where: { id: 'quisqueya-core' },
    update: {
      name: 'Quisqueya Core',
      maxUsers: 25,
      maxBranches: 10,
      maxClients: 10000,
      featuresJson: { content: true, crm: true, reviews: true, dmc: true },
    },
    create: {
      id: 'quisqueya-core',
      name: 'Quisqueya Core',
      maxUsers: 25,
      maxBranches: 10,
      maxClients: 10000,
      featuresJson: { content: true, crm: true, reviews: true, dmc: true },
    },
  });

  await prisma.company.upsert({
    where: { id: 'QUISQUEYA' },
    update: {
      name: 'Quisqueya Travel & DMC',
      planId: 'quisqueya-core',
      status: 'ACTIVE',
    },
    create: {
      id: 'QUISQUEYA',
      name: 'Quisqueya Travel & DMC',
      status: 'ACTIVE',
      planId: 'quisqueya-core',
      billingCycle: 'YEARLY',
    },
  });

  await prisma.branch.upsert({
    where: { id: 'QUISQUEYA_MAIN' },
    update: {
      companyId: 'QUISQUEYA',
      name: 'Operación principal',
      address: 'Santo Domingo, República Dominicana',
    },
    create: {
      id: 'QUISQUEYA_MAIN',
      companyId: 'QUISQUEYA',
      name: 'Operación principal',
      address: 'Santo Domingo, República Dominicana',
    },
  });

  await prisma.user.upsert({
    where: { username },
    update: {
      companyId: 'QUISQUEYA',
      branchId: 'QUISQUEYA_MAIN',
      name: 'Administrador Quisqueya',
      role: 'SUPER_ADMIN',
      passwordHash,
      isActive: true,
      email: 'admin@quisqueyatravel.local',
    },
    create: {
      id: 'QUISQUEYA_ADMIN',
      companyId: 'QUISQUEYA',
      branchId: 'QUISQUEYA_MAIN',
      username,
      name: 'Administrador Quisqueya',
      role: 'SUPER_ADMIN',
      passwordHash,
      isActive: true,
      email: 'admin@quisqueyatravel.local',
    },
  });

  console.log(`Quisqueya local identity ready for user: ${username}`);
}

main()
  .catch(error => {
    console.error('Identity seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
