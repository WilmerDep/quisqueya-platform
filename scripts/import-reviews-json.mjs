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

function parseDate(value) {
  if (!value) return null;
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
  const explicit = text(item.externalId || item.id || item.reviewId);
  if (explicit) return explicit;
  const fingerprint = [item.authorName || item.author, item.reviewedAt || item.date, item.reviewText || item.text].map(text).join('|');
  return `legacy-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`;
}

function normalize(item, index) {
  const authorName = text(item.authorName || item.author || item.name);
  const reviewText = text(item.reviewText || item.text || item.quote || item.review);
  if (!authorName || !reviewText) throw new Error(`Review ${index + 1} requires authorName and reviewText.`);

  const source = sourceValue(item.source);
  return {
    source,
    externalId: stableExternalId(item),
    authorName,
    authorAvatarUrl: nullableText(item.authorAvatarUrl || item.avatarUrl || item.avatar),
    rating: parseRating(item.rating || item.stars),
    reviewText,
    language: nullableText(item.language || item.locale),
    reviewUrl: nullableText(item.reviewUrl || item.url),
    reviewedAt: parseDate(item.reviewedAt || item.date || item.publishedAt),
    status: publish ? ReviewStatus.PUBLISHED : ReviewStatus.PENDING,
    featured: Boolean(item.featured),
    sortOrder: Number.isInteger(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    sourcePayload: item,
    syncedAt: new Date(),
  };
}

async function main() {
  const raw = await readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload) ? payload : payload?.reviews;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('The import file must be an array or an object with a non-empty reviews array.');
  }

  let created = 0;
  let updated = 0;
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
    existing ? updated++ : created++;
  }

  console.log(`Imported ${items.length} reviews from ${inputPath}.`);
  console.log(`Created: ${created}. Updated: ${updated}. Status: ${publish ? 'PUBLISHED' : 'PENDING'}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
