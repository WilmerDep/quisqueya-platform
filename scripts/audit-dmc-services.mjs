const apiBaseUrl = String(
  process.env.QUISQUEYA_API_URL || 'http://localhost:3000/api/v1',
).replace(/\/$/, '');

const EXPECTED_SLUGS = ['transporte', 'incentivos', 'eventos', 'grupos'];
const EXPECTED_SHOWCASE_MINIMUMS = {
  incentivos: 4,
  eventos: 4,
  grupos: 3,
};

function issue(code, severity, message) {
  return { code, severity, message };
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function getJson(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function main() {
  console.log(`Auditing DMC services at ${apiBaseUrl}`);
  const payload = await getJson('/public/services');
  const services = Array.isArray(payload?.data) ? payload.data : [];
  const rows = [];
  let errors = 0;
  let warnings = 0;

  for (const slug of EXPECTED_SLUGS) {
    const service = services.find(item => item?.slug === slug);
    const issues = [];

    if (!service) {
      issues.push(issue('missing_service', 'error', `No existe el servicio público ${slug}.`));
      errors += 1;
      rows.push({ slug, found: false, issues });
      continue;
    }

    if (!text(service.title)) {
      issues.push(issue('missing_title', 'error', 'No tiene título público.'));
      errors += 1;
    }
    if (!text(service.shortDescription)) {
      issues.push(issue('missing_short_description', 'error', 'No tiene descripción corta.'));
      errors += 1;
    }

    const fleet = Array.isArray(service.fleet) ? service.fleet : [];
    const mobilityGallery = Array.isArray(service.mobilityGallery) ? service.mobilityGallery : [];
    const showcaseItems = Array.isArray(service.showcase?.items) ? service.showcase.items : [];

    if (slug === 'transporte') {
      if (fleet.length !== 7) {
        issues.push(issue('unexpected_fleet_count', 'warning', `La flota pública tiene ${fleet.length} unidades; se esperan 7.`));
        warnings += 1;
      }
      const fleetWithoutImage = fleet.filter(item => !text(item?.image));
      if (fleetWithoutImage.length) {
        issues.push(issue('fleet_media_missing', 'warning', `${fleetWithoutImage.length} unidades no tienen imagen.`));
        warnings += 1;
      }
      if (!text(service.hero?.backgroundImage) || !text(service.hero?.foregroundImage)) {
        issues.push(issue('transport_hero_incomplete', 'warning', 'El hero de transporte no tiene sus dos imágenes.'));
        warnings += 1;
      }
      if (mobilityGallery.length < 2) {
        issues.push(issue('mobility_gallery_incomplete', 'warning', 'La galería de movilidad accesible tiene menos de 2 elementos.'));
        warnings += 1;
      }
    } else {
      const expectedMinimum = EXPECTED_SHOWCASE_MINIMUMS[slug] || 1;
      if (showcaseItems.length < expectedMinimum) {
        issues.push(issue('showcase_incomplete', 'warning', `El servicio tiene ${showcaseItems.length} elementos de showcase; se esperan al menos ${expectedMinimum}.`));
        warnings += 1;
      }
    }

    rows.push({
      slug,
      found: true,
      id: service.id,
      title: service.title,
      order: service.order,
      sourceUrl: service.sourceUrl || null,
      coverage: {
        hero: Boolean(service.hero),
        fleetItems: fleet.length,
        fleetItemsWithImage: fleet.filter(item => text(item?.image)).length,
        mobilityGalleryItems: mobilityGallery.length,
        showcaseItems: showcaseItems.length,
        showcaseItemsWithFallbackImage: showcaseItems.filter(item => text(item?.fallbackImage)).length,
        accessibility: text(service.accessibility),
      },
      issues,
    });
  }

  const unexpected = services
    .map(item => item?.slug)
    .filter(slug => text(slug) && !EXPECTED_SLUGS.includes(slug));

  const result = {
    totals: {
      services: services.length,
      expected: EXPECTED_SLUGS.length,
      errors,
      warnings,
      unexpectedServices: unexpected,
    },
    services: rows,
  };

  console.log(JSON.stringify(result, null, 2));
  if (errors > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
