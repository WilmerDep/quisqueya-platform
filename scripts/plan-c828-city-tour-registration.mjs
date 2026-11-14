/**
 * C8.28-G — preview-only plan for registering City Tour media.
 * Run: node scripts/plan-c828-city-tour-registration.mjs
 * No HTTP calls, database writes, media uploads, file output or state changes.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const manifest = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json", import.meta.url), "utf8"));
const city = manifest.cityTour;
const altos = manifest.altos;
if (city.length !== 15 || new Set(city.map(x => x.storageKey)).size !== 15 ||
    city.filter(x => x.inIndependentSnapshot).length !== 9 ||
    city.filter(x => x.inCombinedSnapshot).length !== 9 ||
    altos.length !== 4 || new Set(altos.map(x => x.storageKey)).size !== 4) {
  throw new Error("MANIFEST_INTEGRITY_MISMATCH");
}

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

const slugIndependent = "santo-domingo-city-tour";
const slugCombined = "santo-domingo-city-tour-altos-de-chavon";
const slugAltos = "altos-de-chavon";
const ids = value => Array.isArray(value) ? value.filter(x => typeof x === "string") : [];

try {
  const [media, experiences] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { storageKey: { in: [...city, ...altos].map(x => x.storageKey) } },
      select: { id: true, storageKey: true, fileName: true, storageProvider: true },
    }),
    prisma.experience.findMany({
      where: { slug: { in: [slugIndependent, slugCombined, slugAltos] } },
      select: { id: true, slug: true, status: true, featuredMediaId: true, galleryMediaIds: true, galleryMediaSourceIds: true },
    }),
  ]);
  const exp = new Map(experiences.map(x => [x.slug,x]));
  const byKey = new Map();
  for (const x of media) byKey.set(x.storageKey, [...(byKey.get(x.storageKey) || []), x]);

  const conditions = {
    allExperiencesPresent: [slugIndependent,slugCombined,slugAltos].every(s => exp.has(s)),
    combinedIsDraft: exp.get(slugCombined)?.status === "DRAFT",
    altosIsDraft: exp.get(slugAltos)?.status === "DRAFT",
    independentPublished: exp.get(slugIndependent)?.status === "PUBLISHED",
    combinedHasNoManagedGallery: ids(exp.get(slugCombined)?.galleryMediaIds).length === 0,
    independentHasNoManagedGallery: ids(exp.get(slugIndependent)?.galleryMediaIds).length === 0,
    altosManagedGalleryIsThree: ids(exp.get(slugAltos)?.galleryMediaIds).length === 3,
    noDuplicateStorageKeys: [...byKey.values()].every(rows => rows.length <= 1),
    altosAllRegistered: altos.every(x => (byKey.get(x.storageKey) || []).length === 1),
  };
  const ready = Object.values(conditions).every(Boolean);
  const cityMissing = city.filter(x => !(byKey.get(x.storageKey) || []).length);
  const usage = slug => city.filter(x => slug === slugIndependent ? x.inIndependentSnapshot : x.inCombinedSnapshot);
  const summarize = x => ({
    label: x.label,
    storageKey: x.storageKey,
    existingLocalMediaId: byKey.get(x.storageKey)?.[0]?.id || null,
    registrationAction: byKey.get(x.storageKey)?.length ? "REUSE" : "REGISTER_AFTER_PROVIDER_METADATA_VERIFICATION",
  });

  console.log("C8_28_G_MODE=PREVIEW_ONLY");
  console.log("SOURCE=" + manifest.source.exportedAt);
  console.log("GUARDS=" + JSON.stringify(conditions));
  console.log("READY_FOR_REVIEW=" + ready);
  console.log("REGISTRATION_CANDIDATES=" + JSON.stringify(cityMissing.map(summarize)));
  console.log("PROPOSED_INDEPENDENT_GALLERY=" + JSON.stringify(usage(slugIndependent).map(summarize)));
  console.log("PROPOSED_COMBINED_GALLERY=" + JSON.stringify([
    ...altos.filter(x => x.label !== "altos-iglesia-portada").map(summarize),
    ...usage(slugCombined).map(summarize),
  ]));
  console.log("EXISTING_INDEPENDENT_FEATURED_ID=" + (exp.get(slugIndependent)?.featuredMediaId || "NONE"));
  console.log("EXISTING_COMBINED_FEATURED_ID=" + (exp.get(slugCombined)?.featuredMediaId || "NONE"));
  console.log("NOTE=Feature image replacement requires separate content approval; current featured IDs are preserved");
  console.log("NOTE=No direct UUID transfers across environments; register through authenticated POST /api/v1/media/register after checking Drive metadata");
  console.log("NOTE=Gallery PATCH /api/v1/media/experiences/:experienceId requires explicit review of ordering and preservation of existing URLs");
  console.log("C8_28_G=PREVIEW_COMPLETE");
} catch (err) {
  console.error("C8_28_G=FAILED");
  console.error("ERROR_CODE=" + (err?.code || err?.name || "UNKNOWN"));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
