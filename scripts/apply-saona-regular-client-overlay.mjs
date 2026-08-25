import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
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
const APPLY = process.argv.includes('--apply');

const TARGET = {
  sourceProvider: 'WORDPRESS',
  sourceId: '536',
  expectedSlug: 'isla-saona',
};

const CONFIRMED_OPERATING_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const INCLUDED = [
  'Transporte ida y vuelta según la modalidad contratada.',
  'Embarcación mixta (Motomarán y Catamarán).',
  'Open bar de bebidas nacionales según el servicio contratado.',
  'Almuerzo buffet en Saona Regular.',
  'Visita a playa El Abanico en Isla Saona.',
  'Visita a piscina natural Palmilla.',
  'Asistencia de staff experto.',
  'Impuestos de parque.',
];

const EXCLUDED = [
  'Servicio fotográfico.',
  'Masajes.',
  'Piña colada y Coco Loco.',
  'Langosta cuando no haya sido contratada.',
  'Souvenirs.',
  'Servicios no descritos expresamente en el paquete.',
];

const ITINERARY = [
  {
    time: '6:45 a. m. - 7:40 a. m.',
    title: 'Recogida',
    desc: 'Horario aproximado según el punto de encuentro y la operación del día.',
  },
  {
    time: '9:30 a. m.',
    title: 'Llegada a Bayahíbe',
    desc: 'Llegada aproximada a Bayahíbe y traslado hacia el área de embarque.',
  },
  {
    time: 'A continuación',
    title: 'Salida en catamarán hacia Isla Saona',
    desc: 'Inicio del recorrido marítimo hacia Isla Saona. El tiempo aproximado informado de navegación es de 1 hora y 40 minutos.',
  },
  {
    time: 'Durante la estadía',
    title: 'Tiempo de playa en Isla Saona',
    desc: 'Tiempo libre de playa y servicios correspondientes a la modalidad contratada.',
  },
  {
    time: '1:00 p. m.',
    title: 'Almuerzo buffet',
    desc: 'Apertura aproximada del buffet de autoservicio en la modalidad Saona Regular.',
  },
  {
    time: '2:45 p. m.',
    title: 'Salida hacia Palmilla',
    desc: 'Embarque e inicio de la visita a la piscina natural Palmilla, con tiempo libre según la operación.',
  },
  {
    time: '5:00 p. m.',
    title: 'Inicio del regreso',
    desc: 'Inicio aproximado del camino de regreso.',
  },
];

const STALE_EDITORIAL_FLAGS = new Set([
  'PRACTICAL_INFO_PENDING_CLIENT_VALIDATION',
  'POSSIBLE_CLONED_ITINERARY',
  'TECHNICAL_PRICES_DISABLED',
  'EDITORIAL_REVIEW_REQUIRED',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asFlags(value) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function assertTarget(row) {
  if (!row) {
    throw new Error(`Saona Regular not found for sourceId ${TARGET.sourceId}.`);
  }
  if (row.sourceProvider !== TARGET.sourceProvider) {
    throw new Error(`Safety stop: expected sourceProvider ${TARGET.sourceProvider}, found ${row.sourceProvider}.`);
  }
  if (row.sourceId !== TARGET.sourceId) {
    throw new Error(`Safety stop: expected sourceId ${TARGET.sourceId}, found ${row.sourceId}.`);
  }
  if (row.slug !== TARGET.expectedSlug) {
    throw new Error(`Safety stop: expected slug ${TARGET.expectedSlug}, found ${row.slug}.`);
  }
}

function buildOverlay(row) {
  const pricingLegacy = asObject(row.pricingJson);
  const bookingLegacy = asObject(row.bookingJson);
  const availabilityLegacy = asObject(row.availabilityJson);
  const practicalLegacy = asObject(row.practicalInfoJson);
  const provenanceLegacy = asObject(row.provenanceJson);

  const {
    publicMode: _legacyPublicMode,
    adultDisabled: _legacyAdultDisabled,
    childDisabled: _legacyChildDisabled,
    infantDisabled: _legacyInfantDisabled,
    ...compatiblePricingLegacy
  } = pricingLegacy;

  return {
    pricingMode: 'FIXED',
    duration: '11 horas',
    durationValue: 11,
    durationUnit: 'hour',
    pricingJson: {
      ...compatiblePricingLegacy,
      version: 1,
      basis: 'person',
      currency: 'USD',
      taxIncluded: true,
      adult: '85',
      child: '50',
      infant: '0',
      tiers: [
        { key: 'adult', label: 'Adulto', minAge: 11, maxAge: null, price: 85 },
        { key: 'child', label: 'Niño', minAge: 3, maxAge: 10, price: 50 },
        { key: 'infant', label: 'Menor de 3 años', minAge: 0, maxAge: 2, price: 0 },
      ],
    },
    bookingJson: {
      ...bookingLegacy,
      version: 1,
      confirmation: {
        pickupDetailsConfirmedBeforeExperience: true,
        shortNoticeSubjectToAvailability: true,
      },
      pickup: {
        zones: [
          {
            key: 'santo-domingo',
            label: 'Santo Domingo',
            standardMeetingPoint: 'Parque Colón',
            hotelPickup: false,
            privatePickupAvailable: true,
            privatePickupSupplementApplies: true,
            requiresCoordinatorConfirmation: true,
          },
          {
            key: 'boca-chica',
            label: 'Boca Chica',
            hotelPickup: true,
            requiresCoordinatorConfirmation: false,
          },
          {
            key: 'juan-dolio',
            label: 'Juan Dolio',
            hotelPickup: true,
            requiresCoordinatorConfirmation: false,
          },
          {
            key: 'nueva-romana',
            label: 'Nueva Romana',
            requiresCoordinatorConfirmation: true,
          },
          {
            key: 'bavaro-punta-cana',
            label: 'Bávaro / Punta Cana',
            requiresCoordinatorConfirmation: true,
          },
        ],
      },
      policyKey: 'quisqueya-general-cancellation-v1',
    },
    availabilityJson: {
      ...availabilityLegacy,
      version: 1,
      type: availabilityLegacy.type || 'continuous',
      minimumPeople: '2',
      minimumParticipants: 2,
      singlePassengerRequiresConfirmation: true,
      operatingDays: CONFIRMED_OPERATING_DAYS,
      shortNoticeRequiresConfirmation: true,
      shortNoticeThresholdHours: 18,
    },
    practicalInfoJson: {
      ...practicalLegacy,
      whatToBring: [
        'Toalla',
        'Segundo cambio de ropa',
        'Calzado fácil de retirar',
        'Repelente de insectos',
        'Protector solar',
      ],
      restrictions: [
        'La modalidad regular no es recomendable para personas con movilidad reducida; cada caso puede evaluarse antes de confirmar.',
        'Durante el embarazo puede evaluarse una alternativa Catamarán - Catamarán, sujeta a confirmación operacional.',
      ],
      accessibility: {
        available: false,
        details: 'La modalidad regular presenta limitaciones de accesibilidad por las condiciones de embarque y traslado. Los casos de movilidad reducida pueden evaluarse individualmente. Para embarazo puede evaluarse la alternativa Catamarán - Catamarán, sujeta a confirmación operacional.',
      },
      pickupInformation: {
        available: true,
        details: 'La hora y el punto exactos de recogida se confirman según la zona y la operación. En Santo Domingo el punto estándar confirmado es Parque Colón; una recogida especial en el lugar de estadía puede generar suplemento. Boca Chica y Juan Dolio permiten confirmación de recogida en hotel. Nueva Romana y Bávaro / Punta Cana se confirman según la operación.',
        zones: ['Santo Domingo', 'Boca Chica', 'Juan Dolio', 'Nueva Romana', 'Bávaro / Punta Cana'],
      },
      cancellationPolicy: 'Aplican las políticas generales de cancelación y reembolso de Quisqueya Travel.',
      bookingNotice: 'Las reservas realizadas con 18 horas o menos de anticipación están sujetas a confirmación de disponibilidad.',
    },
    includedItemsJson: INCLUDED,
    excludedItemsJson: EXCLUDED,
    itineraryJson: ITINERARY,
    editorialFlagsJson: asFlags(row.editorialFlagsJson)
      .filter(flag => !STALE_EDITORIAL_FLAGS.has(flag.code)),
    provenanceJson: {
      ...provenanceLegacy,
      clientValidation: {
        source: 'Breidy Solano / Quisqueya Travel',
        validatedAt: '2026-08-21',
        overlay: 'saona-regular-v1',
        notes: 'Confirmed client data overrides conflicting inherited WordPress/Tourfic values. Unmentioned inherited content remains unchanged.',
      },
    },
  };
}

function snapshotPayload(row) {
  return {
    createdAt: new Date().toISOString(),
    purpose: 'Rollback snapshot before Saona Regular client overlay',
    target: TARGET,
    row: {
      id: row.id,
      sourceProvider: row.sourceProvider,
      sourceId: row.sourceId,
      slug: row.slug,
      title: row.title,
      pricingMode: row.pricingMode,
      duration: row.duration,
      durationValue: row.durationValue,
      durationUnit: row.durationUnit,
      pricingJson: row.pricingJson,
      bookingJson: row.bookingJson,
      availabilityJson: row.availabilityJson,
      practicalInfoJson: row.practicalInfoJson,
      includedItemsJson: row.includedItemsJson,
      excludedItemsJson: row.excludedItemsJson,
      itineraryJson: row.itineraryJson,
      editorialFlagsJson: row.editorialFlagsJson,
      provenanceJson: row.provenanceJson,
    },
  };
}

async function writeSnapshot(row) {
  const directory = path.resolve('data/backups');
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `saona-regular-before-overlay-${stamp}.json`;
  const filepath = path.join(directory, filename);
  await writeFile(filepath, `${JSON.stringify(snapshotPayload(row), null, 2)}\n`, 'utf8');
  return filepath;
}

const selectTouchedFields = {
  id: true,
  sourceProvider: true,
  sourceId: true,
  slug: true,
  title: true,
  pricingMode: true,
  duration: true,
  durationValue: true,
  durationUnit: true,
  pricingJson: true,
  bookingJson: true,
  availabilityJson: true,
  practicalInfoJson: true,
  includedItemsJson: true,
  excludedItemsJson: true,
  itineraryJson: true,
  editorialFlagsJson: true,
  provenanceJson: true,
  updatedAt: true,
};

async function main() {
  const row = await prisma.experience.findFirst({
    where: {
      sourceProvider: TARGET.sourceProvider,
      sourceId: TARGET.sourceId,
    },
    select: selectTouchedFields,
  });

  assertTarget(row);
  const overlay = buildOverlay(row);

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'preview',
      writePerformed: false,
      target: {
        id: row.id,
        sourceId: row.sourceId,
        slug: row.slug,
        title: row.title,
      },
      proposed: overlay,
      untouchedByDesign: [
        'title',
        'slug',
        'excerpt',
        'description',
        'featuredText',
        'media',
        'gallery',
        'location',
        'contact',
        'faqs',
        'display',
        'relations',
        'sourceUrl',
      ],
      nextCommand: 'npm run apply:saona-regular',
    }, null, 2));
    return;
  }

  const snapshotPath = await writeSnapshot(row);

  const updated = await prisma.$transaction(async tx => {
    const current = await tx.experience.findUnique({
      where: { id: row.id },
      select: selectTouchedFields,
    });
    assertTarget(current);

    if (current.updatedAt.getTime() !== row.updatedAt.getTime()) {
      throw new Error('Safety stop: Saona Regular changed after the initial read. Re-run preview before applying.');
    }

    return tx.experience.update({
      where: { id: row.id },
      data: overlay,
      select: {
        id: true,
        sourceId: true,
        slug: true,
        title: true,
        pricingMode: true,
        duration: true,
        durationValue: true,
        durationUnit: true,
        pricingJson: true,
        availabilityJson: true,
      },
    });
  });

  console.log(JSON.stringify({
    mode: 'apply',
    updated: true,
    snapshotPath,
    overlay: 'saona-regular-v1',
    result: updated,
    untouchedByDesign: [
      'title',
      'slug',
      'excerpt',
      'description',
      'featuredText',
      'media',
      'gallery',
      'location',
      'contact',
      'faqs',
      'display',
      'relations',
      'sourceUrl',
    ],
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
