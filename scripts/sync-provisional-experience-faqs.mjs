const apiBase = (process.env.QUISQUEYA_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const token = process.env.QUISQUEYA_ACCESS_TOKEN?.trim();
const apply = process.argv.includes('--apply');

const experienceFaqs = {
  'isla-catalina': [
    {
      title: '¿Qué incluye la excursión a Isla Catalina?',
      desc: 'La experiencia incluye transporte compartido de ida y vuelta, catamarán compartido, almuerzo buffet, bebidas nacionales, snorkeling en pared de coral, guía especializado y amenidades durante el traslado.',
    },
    {
      title: '¿La actividad incluye snorkeling?',
      desc: 'Sí. La excursión incluye snorkeling en pared de coral como parte de la experiencia en Isla Catalina.',
    },
    {
      title: '¿Es necesario reservar con anticipación?',
      desc: 'Sí. Actualmente se solicita reservar con al menos 15 días de anticipación. La disponibilidad definitiva debe confirmarse con un asesor.',
    },
  ],
  'haitises-isla-bacardi': [
    {
      title: '¿Qué lugares se visitan durante la excursión?',
      desc: 'La experiencia incluye el Parque Nacional Los Haitises, sus cuevas y manifestaciones de arte indígena y natural, además de una visita a Isla Bacardi con tiempo de ocio en la playa.',
    },
    {
      title: '¿Desde cuáles zonas está incluida la recogida?',
      desc: 'El transporte incluye recogida en hoteles del Distrito Nacional y Nueva Romana, según la información operativa disponible.',
    },
    {
      title: '¿Es necesario reservar con anticipación?',
      desc: 'Sí. Actualmente se solicita reservar con al menos 15 días de anticipación. La disponibilidad definitiva debe confirmarse con un asesor.',
    },
  ],
  'aventura-en-buggies-y-altos-de-chavon': [
    {
      title: '¿Cuánto dura la ruta de buggies?',
      desc: 'La ruta de buggies indicada tiene una duración aproximada de tres horas.',
    },
    {
      title: '¿Qué visitas están incluidas además de los buggies?',
      desc: 'La experiencia incluye visitas a un batey dominicano, una casa típica con degustación de productos locales, el río Chavón y Altos de Chavón, además de almuerzo en un restaurante típico de La Romana.',
    },
    {
      title: '¿Es necesario reservar con anticipación?',
      desc: 'Sí. Actualmente se solicita reservar con al menos 15 días de anticipación. La disponibilidad definitiva debe confirmarse con un asesor.',
    },
  ],
  'santo-domingo-city-tour': [
    {
      title: '¿Cuáles lugares forman parte del City Tour?',
      desc: 'El recorrido incluye, entre otros puntos, Los Tres Ojos, vistas panorámicas del Faro a Colón y el Palacio Nacional, la Fortaleza Ozama, la calle Las Damas, el Panteón Nacional, el Parque Colón y la Catedral Primada de América.',
    },
    {
      title: '¿El almuerzo está incluido?',
      desc: 'Sí. La información actual de la experiencia contempla almuerzo buffet dentro del recorrido.',
    },
    {
      title: '¿Es necesario reservar con anticipación?',
      desc: 'Sí. Actualmente se solicita reservar con al menos 15 días de anticipación. La disponibilidad definitiva debe confirmarse con un asesor.',
    },
  ],
  'isla-saona-en-semi-submarino': [
    {
      title: '¿Qué tipo de embarcación se utiliza?',
      desc: 'La excursión contempla una embarcación mixta que combina semi-submarino y lancha rápida.',
    },
    {
      title: '¿Qué actividades están incluidas?',
      desc: 'La experiencia incluye snorkeling desde el semi-submarino, visita a la piscina natural Palmilla, almuerzo buffet, bebidas nacionales, guía especializado, amenidades durante el traslado y dispensario médico.',
    },
    {
      title: '¿Es necesario reservar con anticipación?',
      desc: 'Sí. Actualmente se solicita reservar con al menos 15 días de anticipación. La disponibilidad definitiva debe confirmarse con un asesor.',
    },
  ],
  'isla-saona': [
    {
      title: '¿Qué tipo de embarcación incluye la excursión?',
      desc: 'La experiencia contempla una embarcación mixta que combina catamarán y lancha rápida.',
    },
    {
      title: '¿Qué incluye la visita a Isla Saona?',
      desc: 'La excursión incluye transporte compartido de ida y vuelta, almuerzo buffet, bebidas nacionales y visita a la piscina natural Palmilla.',
    },
    {
      title: '¿Es necesario reservar con anticipación?',
      desc: 'Sí. Actualmente se solicita reservar con al menos 15 días de anticipación. La disponibilidad definitiva debe confirmarse con un asesor.',
    },
  ],
};

if (!token && apply) {
  console.error('QUISQUEYA_ACCESS_TOKEN es obligatorio cuando se usa --apply.');
  process.exit(1);
}

const request = async (slug, faqs) => {
  const body = {
    faqs,
    assistedByAi: true,
    reviewStatus: 'provisional',
  };

  if (!apply) {
    return { slug, mode: 'dry-run', body };
  }

  const response = await fetch(`${apiBase}/experiences/${encodeURIComponent(slug)}/editorial`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${slug}: ${response.status} ${payload?.error?.message || response.statusText}`);
  }

  return {
    slug,
    mode: 'applied',
    faqCount: payload?.data?.faqs?.length ?? faqs.length,
    updatedAt: payload?.data?.updatedAt ?? null,
  };
};

const results = [];
for (const [slug, faqs] of Object.entries(experienceFaqs)) {
  results.push(await request(slug, faqs));
}

console.table(results.map(result => ({
  slug: result.slug,
  mode: result.mode,
  faqCount: result.faqCount ?? result.body.faqs.length,
  updatedAt: result.updatedAt ?? '-',
})));

if (!apply) {
  console.log('\nVista previa completada. Use --apply con QUISQUEYA_ACCESS_TOKEN para escribir en la API.');
}
