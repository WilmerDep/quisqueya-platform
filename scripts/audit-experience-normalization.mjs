const apiBaseUrl = String(
  process.env.QUISQUEYA_API_URL ||
    process.env.NEXT_PUBLIC_QUISQUEYA_API_URL ||
    'http://localhost:3000/api/v1',
).replace(/\/$/, '');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function mediaUrl(value) {
  if (typeof value === 'string') return value;
  return isObject(value) && text(value.url) ? value.url : null;
}

function issue(code, severity, message) {
  return { code, severity, message };
}

async function get(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} while requesting ${path}`);
  }

  const payload = await response.json();
  if (!isObject(payload) || !('data' in payload)) {
    throw new Error(`Invalid API envelope for ${path}`);
  }

  return payload.data;
}

function auditExperience(experience) {
  const issues = [];
  const gallery = array(experience.gallery);
  const languages = array(experience.languages).filter(text);
  const included = array(experience.included).filter(text);
  const excluded = array(experience.excluded).filter(text);
  const itinerary = array(experience.itinerary);
  const faqs = array(experience.faqs);
  const editorialFlags = array(experience.editorialFlags);
  const practical = isObject(experience.practicalInfo) ? experience.practicalInfo : null;
  const location = isObject(experience.location) ? experience.location : null;

  if (!text(experience.slug)) issues.push(issue('missing_slug', 'error', 'No tiene slug canónico.'));
  if (!text(experience.title)) issues.push(issue('missing_title', 'error', 'No tiene título público.'));
  if (!text(experience.category)) issues.push(issue('missing_category', 'warning', 'No tiene categoría pública.'));
  if (!text(experience.duration)) issues.push(issue('missing_duration', 'warning', 'No tiene duración legible.'));
  if (!experience.featuredMedia || !mediaUrl(experience.featuredMedia)) {
    issues.push(issue('missing_featured_media', 'error', 'No tiene portada válida en la API.'));
  }
  if (gallery.length === 0) issues.push(issue('missing_gallery', 'error', 'No tiene galería pública.'));
  if (gallery.some(item => !mediaUrl(item))) {
    issues.push(issue('invalid_gallery_media', 'error', 'La galería contiene medios sin URL válida.'));
  }
  if (languages.length === 0) issues.push(issue('missing_languages', 'warning', 'No tiene idiomas definidos.'));
  if (!location || (!text(location.address) && !Number.isFinite(location.latitude) && !Number.isFinite(location.longitude))) {
    issues.push(issue('missing_location', 'warning', 'No tiene ubicación pública suficiente.'));
  }
  if (included.length === 0) issues.push(issue('missing_included', 'warning', 'No tiene elementos incluidos.'));
  if (excluded.length === 0) issues.push(issue('missing_excluded', 'info', 'No tiene elementos excluidos.'));
  if (itinerary.length === 0) issues.push(issue('missing_itinerary', 'warning', 'No tiene itinerario estructurado.'));
  if (faqs.length === 0) issues.push(issue('missing_faqs', 'info', 'No tiene preguntas frecuentes.'));
  if (!practical) issues.push(issue('missing_practical_info', 'warning', 'No tiene información práctica estructurada.'));
  if (!text(experience.excerpt) && !text(experience.description)) {
    issues.push(issue('missing_editorial_copy', 'error', 'No tiene descripción editorial pública.'));
  }
  if (experience.pricingMode !== 'fixed' && experience.pricingMode !== 'on_request') {
    issues.push(issue('invalid_pricing_mode', 'error', 'La modalidad de precio no es válida.'));
  }

  return {
    id: experience.id,
    sourceId: experience.sourceId ?? null,
    slug: experience.slug,
    title: experience.title,
    status: experience.status ?? null,
    category: experience.category ?? null,
    duration: experience.duration ?? null,
    pricingMode: experience.pricingMode ?? null,
    coverage: {
      featuredMedia: Boolean(experience.featuredMedia && mediaUrl(experience.featuredMedia)),
      galleryItems: gallery.length,
      languages: languages.length,
      location: Boolean(location),
      included: included.length,
      excluded: excluded.length,
      itinerary: itinerary.length,
      faqs: faqs.length,
      practicalInfo: Boolean(practical),
      editorialFlags: editorialFlags.length,
    },
    issues,
  };
}

console.log(`Auditing experience normalization at ${apiBaseUrl}`);

try {
  const experiences = await get('/public/experiences');
  if (!Array.isArray(experiences)) throw new Error('Experiences endpoint did not return an array.');

  const reports = experiences.map(auditExperience);
  const totals = reports.reduce(
    (summary, report) => {
      summary.errors += report.issues.filter(item => item.severity === 'error').length;
      summary.warnings += report.issues.filter(item => item.severity === 'warning').length;
      summary.info += report.issues.filter(item => item.severity === 'info').length;
      return summary;
    },
    { experiences: reports.length, errors: 0, warnings: 0, info: 0 },
  );

  console.log(JSON.stringify({ totals, experiences: reports }, null, 2));

  if (reports.length !== 6) {
    console.error(`Expected 6 public experiences, received ${reports.length}.`);
    process.exitCode = 1;
  }
  if (totals.errors > 0) {
    console.error('Experience normalization audit found blocking errors.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
