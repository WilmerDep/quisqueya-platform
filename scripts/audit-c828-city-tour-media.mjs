/**
 * C8.28-E — READ ONLY: reconcile storage keys from CRM snapshot with local Prisma MariaDB.
 * Run from repository root: node scripts/audit-c828-city-tour-media.mjs
 * Never writes to MySQL, Drive, or any file.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

dotenv.config({ path: ".env", quiet: true });

const manifest = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json", import.meta.url), "utf8"));
const keys = [...new Set([...manifest.cityTour, ...manifest.altos].map((item) => item.storageKey))];

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "quisqueya_core",
    connectionLimit: 2,
  }),
});

const slugs = [
  "altos-de-chavon",
  "altos-de-chavon-medio-dia",
  "altos-de-chavon-cueva-de-las-maravillas",
  "santo-domingo-city-tour-altos-de-chavon",
  "aventura-en-buggies-y-altos-de-chavon",
  "santo-domingo-city-tour",
];

function ids(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

try {
  const [media, experiences] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { storageKey: { in: keys } },
      select: { id: true, storageKey: true, storageProvider: true, fileName: true, publicUrl: true },
    }),
    prisma.experience.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, status: true, featuredMediaId: true, galleryMediaIds: true, galleryMediaSourceIds: true },
    }),
  ]);

  const byKey = new Map();
  for (const asset of media) {
    const items = byKey.get(asset.storageKey) || [];
    items.push(asset);
    byKey.set(asset.storageKey, items);
  }

  const experiencesBySlug = new Map(experiences.map((item) => [item.slug, item]));
  const independent = experiencesBySlug.get("santo-domingo-city-tour");
  const combined = experiencesBySlug.get("santo-domingo-city-tour-altos-de-chavon");

  console.log("C8_28_E_MANIFEST_SOURCE=" + manifest.source.exportedAt);
  console.log("LOCAL_EXPERIENCE_STATUS=" + JSON.stringify(slugs.map((slug) => ({
    slug,
    status: experiencesBySlug.get(slug)?.status ?? "NOT_FOUND",
    featuredMediaIdPresent: Boolean(experiencesBySlug.get(slug)?.featuredMediaId),
    galleryMediaIdsCount: ids(experiencesBySlug.get(slug)?.galleryMediaIds).length,
    wordpressGalleryCount: Array.isArray(experiencesBySlug.get(slug)?.galleryMediaSourceIds)
      ? experiencesBySlug.get(slug).galleryMediaSourceIds.length : 0,
  }))));

  const rows = manifest.cityTour.map((candidate) => {
    const found = byKey.get(candidate.storageKey) || [];
    const record = found[0];
    const mediaId = record?.id;
    const publicHost = (() => {
      try { return record?.publicUrl ? new URL(record.publicUrl).host : null; }
      catch { return null; }
    })();
    return {
      label: candidate.label,
      storageKey: candidate.storageKey,
      inIndependentSnapshot: candidate.inIndependentSnapshot,
      inCombinedSnapshot: candidate.inCombinedSnapshot,
      localMatches: found.length,
      localMediaId: mediaId ?? null,
      localStorageProvider: record?.storageProvider ?? null,
      publicHost,
      independentlyLinked: Boolean(mediaId && (
        independent?.featuredMediaId === mediaId || ids(independent?.galleryMediaIds).includes(mediaId)
      )),
      combinedLinked: Boolean(mediaId && (
        combined?.featuredMediaId === mediaId || ids(combined?.galleryMediaIds).includes(mediaId)
      )),
    };
  });
  console.log("CITY_TOUR_CANDIDATES=" + JSON.stringify(rows));
  console.log("CITY_TOUR_REGISTERED_LOCAL=" + rows.filter((row) => row.localMatches > 0).length + "/" + rows.length);
  console.log("CITY_TOUR_MISSING_LOCAL=" + rows.filter((row) => row.localMatches === 0).length);
  console.log("DUPLICATE_STORAGE_KEYS=" + rows.filter((row) => row.localMatches > 1).length);

  const altos = manifest.altos.map((candidate) => ({
    label: candidate.label,
    storageKey: candidate.storageKey,
    localMatches: (byKey.get(candidate.storageKey) || []).length,
  }));
  console.log("ALTOS_KEYS=" + JSON.stringify(altos));
  console.log("C8_28_E=READ_ONLY_COMPLETED");
} catch (error) {
  console.error("C8_28_E=FAILED");
  console.error("ERROR_CODE=" + (error?.code || error?.name || "UNKNOWN"));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
