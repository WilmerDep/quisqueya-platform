import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient, ReviewSource, ReviewStatus } from '@prisma/client';
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
const inputPath = resolve(process.cwd(), process.argv[2] || 'data/import/reviews.json');
const publish = process.argv.includes('--publish');

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const nullableText = (value) => text(value) || null;

const firstValue = (item, keys) => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) return item[key];
  }
  return undefined;
};

function parseDate(value) {
  if (!value) return null;

  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
    const numeric = Number(value);
    const date = new Date(String(value).length === 10 ? numeric * 1000 : numeric);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid review date: ${value}`);
  return date;
}

function parseRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(`Invalid review rating: ${value}`);
  }
  return rating;
}

function sourceValue(value) {
  const normalized = text(value).toUpperCase() || 'GOOGLE';
  if (!Object.values(ReviewSource).includes(normalized)) {
    throw new Error(`Unsupported review source: ${value}`);
  }
  return normalized;
}

function stableExternalId(item) {
  const explicit = text(firstValue(item, ['externalId', 'id', 'reviewId', 'review_id']));
  if (explicit) return explicit;

  const fingerprint = [
    firstValue(item, ['authorName', 'author', 'name', 'user', 'user_name']),
    firstValue(item, ['reviewedAt', 'date', 'publishedAt', 'created_at']),
    firstValue(item, ['reviewText', 'text', 'quote', 'review', 'review_text']),
  ]
    .map(text)
    .join('|');

  return `legacy-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`;
}

function isHidden(value) {
  return value === true || value === 1 || value === '1' || text(value).toLowerCase() === 'true';
}

function looksLikeReview(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;

  const author = text(firstValue(item, ['authorName', 'author', 'name', 'user', 'user_name']));
  const reviewText = text(firstValue(item, ['reviewText', 'text', 'quote', 'review', 'review_text']));
  const rating = firstValue(item, ['rating', 'stars', 'star_rating']);

  return Boolean(author && reviewText && rating !== undefined && rating !== null && rating !== '');
}

function collectReviewRows(value, rows, seen) {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const entry of value) collectReviewRows(entry, rows, seen);
    return;
  }

  if (looksLikeReview(value)) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(value);
    }
    return;
  }

  for (const nested of Object.values(value)) {
    collectReviewRows(nested, rows, seen);
  }
}

function extractItems(payload) {
  const rows = [];
  collectReviewRows(payload, rows, new Set());
  return rows;
}

function normalize(item, index) {
  const authorName = text(firstValue(item, ['authorName', 'author', 'name', 'user', 'user_name']));
  const reviewText = text(firstValue(item, ['reviewText', 'text', 'quote', 'review', 'review_text']));

  if (!authorName || !reviewText) {
    throw new Error(`Review ${index + 1} requires authorName and reviewText.`);
  }

  const source = sourceValue(item.source);
  const hidden = isHidden(firstValue(item, ['hidden', 'is_hidden']));

  return {
    source,
    externalId: stableExternalId(item),
    authorName,
    authorAvatarUrl: nullableText(
      firstValue(item, ['authorAvatarUrl', 'avatarUrl', 'avatar', 'user_photo', 'profile_photo_url']),
    ),
    rating: parseRating(firstValue(item, ['rating', 'stars', 'star_rating'])),
    reviewText,
    language: nullableText(firstValue(item, ['language', 'locale', 'lang'])),
    reviewUrl: nullableText(firstValue(item, ['reviewUrl', 'url', 'review_url'])),
    reviewedAt: parseDate(firstValue(item, ['reviewedAt', 'date', 'publishedAt', 'created_at'])),
    status: hidden
      ? ReviewStatus.HIDDEN
      : publish
        ? ReviewStatus.PUBLISHED
        : ReviewStatus.PENDING,
    featured: Boolean(firstValue(item, ['featured', 'highlight', 'is_featured'])),
    sortOrder: Number.isInteger(Number(firstValue(item, ['sortOrder', 'sort_order'])))
      ? Number(firstValue(item, ['sortOrder', 'sort_order']))
      : index,
    sourcePayload: item,
    syncedAt: new Date(),
  };
}

async function main() {
  const raw = await readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw);
  const items = extractItems(payload);

  if (items.length === 0) {
    const rootKeys = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? Object.keys(payload).join(', ')
      : 'array export';
    throw new Error(
      `No Trustindex review rows were found in the JSON export. Root structure: ${rootKeys}.`,
    );
  }

  let created = 0;
  let updated = 0;
  let hidden = 0;

  for (const [index, item] of items.entries()) {
    const data = normalize(item, index);
    const existing = await prisma.review.findUnique({
      where: { source_externalId: { source: data.source, externalId: data.externalId } },
      select: { id: true },
    });

    await prisma.review.upsert({
      where: { source_externalId: { source: data.source, externalId: data.externalId } },
      create: { id: randomUUID(), ...data },
      update: data,
    });

    if (data.status === ReviewStatus.HIDDEN) hidden++;
    existing ? updated++ : created++;
  }

  console.log(`Imported ${items.length} reviews from ${inputPath}.`);
  console.log(`Created: ${created}. Updated: ${updated}. Hidden: ${hidden}.`);
  console.log(`Visible review status: ${publish ? 'PUBLISHED' : 'PENDING'}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
