import 'dotenv/config';
import { PrismaClient, ContentSourceProvider } from '@prisma/client';
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

const fleetMedia = {
  'Hyundai H1': ['https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Hyundai-H1-300x300.png', 'Hyundai H1 de la flota de Quisqueya Travel'],
  'Toyota Hiace': ['https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Toyota-Hiace-300x300.png', 'Toyota Hiace de la flota de Quisqueya Travel'],
  'Toyota Coaster': ['https://quisqueyatravel.com.do/wp-content/uploads/2025/06/toyota-coaster-300x300.png', 'Toyota Coaster de la flota de Quisqueya Travel'],
  'Hyundai Universe': ['https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Hyundai-Universe-300x300.png', 'Hyundai Universe de la flota de Quisqueya Travel'],
  'Chevrolet Suburban High Country': ['https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Chevrolet-suburban-high-country-300x300.png', 'Chevrolet Suburban High Country de la flota de Quisqueya Travel'],
  'Mercedes-Benz Sprinter': ['https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Mercedes-Benz-Sprinter-300x300.png', 'Mercedes-Benz Sprinter de la flota de Quisqueya Travel'],
  'Mercedes-Benz Marcopolo G8': ['https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Mercedes-Benz-Marcopolo-G8-300x300.png', 'Mercedes-Benz Marcopolo G8 de la flota de Quisqueya Travel'],
};

const hero = {
  backgroundImage: 'https://quisqueyatravel.com.do/wp-content/uploads/2025/06/banner-traslados.jpg',
  foregroundImage: 'https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Unidades-Transporte.png',
  foregroundAlt: 'Flota de unidades de transporte de Quisqueya Travel',
};

const mobilityGallery = [
  {
    id: 'mobility-adapted-unit',
    image: 'https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Unidad-para-personas-discapacitadas-1.png',
    imageAlt: 'Unidad adaptada para pasajeros con movilidad especial',
    title: 'Unidades adaptadas',
    description: 'Vehículos espaciosos y coordinados según las necesidades de movilidad de cada pasajero.',
    order: 10,
  },
  {
    id: 'mobility-safe-access',
    image: 'https://quisqueyatravel.com.do/wp-content/uploads/2025/06/Unidad-para-personas-discapacitadas-2.png',
    imageAlt: 'Acceso posterior adaptado para silla de ruedas',
    title: 'Acceso seguro y asistido',
    description: 'Sistemas de acceso y asistencia para facilitar el embarque y desembarque.',
    order: 20,
  },
];

async function main() {
  const page = await prisma.contentPage.findUnique({
    where: { slug: 'dmc-services' },
    select: { id: true, content: true },
  });

  if (!page?.content) {
    throw new Error('DMC services content does not exist. Run npm run seed:dmc-services first.');
  }

  const payload = JSON.parse(page.content);
  if (!payload || !Array.isArray(payload.services)) {
    throw new Error('The dmc-services content payload is invalid.');
  }

  const index = payload.services.findIndex(service => service?.slug === 'transporte');
  if (index < 0) throw new Error('Transport service was not found in dmc-services.');

  const current = payload.services[index];
  const fleet = Array.isArray(current.fleet)
    ? current.fleet.map(item => {
        const media = fleetMedia[item?.model];
        return media ? { ...item, image: media[0], imageAlt: media[1] } : item;
      })
    : [];

  payload.services[index] = {
    ...current,
    hero,
    fleet,
    mobilityGallery,
    sourceUrl: current.sourceUrl || 'https://quisqueyatravel.com.do/traslados/',
  };

  await prisma.contentPage.update({
    where: { id: page.id },
    data: {
      content: JSON.stringify(payload, null, 2),
      sourceProvider: ContentSourceProvider.WORDPRESS,
      provenanceJson: {
        source: 'wordpress-transport-media',
        sourceUrl: 'https://quisqueyatravel.com.do/traslados/',
        migratedBy: 'scripts/migrate-dmc-transport-media.mjs',
      },
    },
  });

  console.log(`DMC transport media migration completed: ${fleet.length} fleet items, ${mobilityGallery.length} mobility images.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
