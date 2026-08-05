import 'dotenv/config';

const apiBaseUrl = String(
  process.env.QUISQUEYA_API_URL ||
    process.env.NEXT_PUBLIC_QUISQUEYA_API_URL ||
    'http://localhost:3000/api/v1',
).replace(/\/$/, '');

const requiredExperienceKeys = [
  'id',
  'slug',
  'title',
  'languages',
  'gallery',
  'galleryMediaSourceIds',
  'pricingMode',
  'included',
  'excluded',
  'itinerary',
  'faqs',
  'editorialFlags',
];

const requiredDestinationKeys = [
  'id',
  'slug',
  'name',
  'gallery',
  'galleryMediaSourceIds',
  'contentSections',
  'editorialFlags',
];

function fail(message) {
  throw new Error(message);
}

function assertObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(`${label} must be an object`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
}

function assertKeys(value, keys, label) {
  for (const key of keys) {
    if (!(key in value)) fail(`${label} is missing key: ${key}`);
  }
}

async function get(path) {
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) fail(`${response.status} ${response.statusText} for ${url}`);

  const payload = await response.json();
  assertObject(payload, `Envelope for ${path}`);
  if (!('data' in payload)) fail(`Envelope for ${path} is missing data`);
  return payload.data;
}

async function verifyCollection({ collectionPath, detailPath, requiredKeys, label }) {
  const rows = await get(collectionPath);
  assertArray(rows, `${label} collection`);

  for (const [index, row] of rows.entries()) {
    assertObject(row, `${label}[${index}]`);
    assertKeys(row, requiredKeys, `${label}[${index}]`);
    if (typeof row.slug !== 'string' || !row.slug.trim()) {
      fail(`${label}[${index}] has an invalid slug`);
    }
  }

  if (!rows.length) {
    console.warn(`Warning: ${label} collection is empty.`);
    return { count: 0, checkedDetail: false };
  }

  const sample = rows[0];
  const detail = await get(`${detailPath}/${encodeURIComponent(sample.slug)}`);
  assertObject(detail, `${label} detail`);
  assertKeys(detail, requiredKeys, `${label} detail`);

  if (detail.id !== sample.id) fail(`${label} list/detail id mismatch for ${sample.slug}`);
  if (detail.slug !== sample.slug) fail(`${label} list/detail slug mismatch for ${sample.slug}`);

  for (const key of requiredKeys) {
    const listType = Array.isArray(sample[key]) ? 'array' : typeof sample[key];
    const detailType = Array.isArray(detail[key]) ? 'array' : typeof detail[key];
    if (listType !== detailType) {
      fail(`${label} list/detail type mismatch for ${sample.slug}.${key}`);
    }
  }

  return { count: rows.length, checkedDetail: true };
}

console.log(`Verifying public content API at ${apiBaseUrl}`);

try {
  const [experiences, destinations, pages, media, services, snapshot] = await Promise.all([
    verifyCollection({
      collectionPath: '/public/experiences',
      detailPath: '/public/experiences',
      requiredKeys: requiredExperienceKeys,
      label: 'Experience',
    }),
    verifyCollection({
      collectionPath: '/public/destinations',
      detailPath: '/public/destinations',
      requiredKeys: requiredDestinationKeys,
      label: 'Destination',
    }),
    get('/public/pages'),
    get('/public/media'),
    get('/public/services'),
    get('/public/content'),
  ]);

  assertArray(pages, 'Pages collection');
  assertArray(media, 'Media collection');
  assertArray(services, 'Services collection');
  assertObject(snapshot, 'Content snapshot');
  assertArray(snapshot.experiences, 'Snapshot experiences');
  assertArray(snapshot.destinations, 'Snapshot destinations');
  assertArray(snapshot.pages, 'Snapshot pages');
  assertArray(snapshot.media, 'Snapshot media');

  if (snapshot.experiences.length !== experiences.count) {
    fail('Snapshot experiences count differs from /public/experiences');
  }
  if (snapshot.destinations.length !== destinations.count) {
    fail('Snapshot destinations count differs from /public/destinations');
  }

  console.log('Public content API contract verified successfully.');
  console.log(JSON.stringify({
    experiences: experiences.count,
    destinations: destinations.count,
    pages: pages.length,
    media: media.length,
    services: services.length,
    generatedAt: snapshot.generatedAt ?? null,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
