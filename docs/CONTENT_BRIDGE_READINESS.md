# Quisqueya Platform — Content Bridge Readiness

## Objective

Prepare `quisqueya-platform` to ingest the current WordPress content and expose a stable public read API so `quisqueya-web` can stop depending on hardcoded placeholders and return quickly to commercial-site implementation.

## Current architecture

The temporary JSON bridge has now been superseded as the public runtime source of truth.

```text
Current WordPress
      |
      v
scripts/import-wordpress-content.mjs
      |
      +--> data/wordpress/raw/*.json      (traceability / source evidence)
      |
      v
Normalization / persistence pass
      |
      v
Prisma + MySQL (`quisqueya_core`)
      |
      +--> experiences
      +--> destinations
      +--> content_pages
      +--> media_assets
      +--> taxonomy_terms
      +--> relationship tables
      |
      v
NestJS ContentModule
      |
      v
/api/v1/public/*
      |
      v
quisqueya-web
```

`data/content/snapshot.json` may remain as migration evidence/compatibility material, but `ContentService` no longer reads it for public API responses.

## Persistent content core

The Prisma content domain contains:

- `Experience`
- `Destination`
- `ContentPage`
- `MediaAsset`
- `TaxonomyTerm`
- `ExperienceDestination`
- `ExperienceTaxonomyTerm`

Source traceability is preserved through fields such as:

- `sourceProvider`
- `sourceId`
- `sourceUrl`
- `sourceModifiedAt`
- `provenanceJson`

Media persistence additionally records:

- `storageKey`
- `publicUrl`
- `mimeType`
- `width`
- `height`
- `sizeBytes`
- `checksum`

Media files themselves must live in persistent storage outside the repository/build output. The database stores stable location and traceability metadata.

## Public endpoints

The public contract remains unchanged:

- `GET /api/v1/public/content`
- `GET /api/v1/public/experiences`
- `GET /api/v1/public/experiences/:slug`
- `GET /api/v1/public/destinations`
- `GET /api/v1/public/destinations/:slug`
- `GET /api/v1/public/pages`
- `GET /api/v1/public/pages/:slug`
- `GET /api/v1/public/media`

The endpoints now read from Prisma/MySQL and return published content only where a publish status applies.

## Migration status

Completed:

- active frontend routes isolated from the inherited lending data service;
- Contact persistence and API introduced;
- Content persistence schema introduced;
- content migration applied to local `quisqueya_core`;
- runtime Prisma default database renamed to `quisqueya_core`;
- public Content API switched from JSON snapshot reads to Prisma/MySQL reads;
- API response contracts preserved.

## Before the first real WordPress run

The remaining pre-import checks are now focused on the source, not on platform architecture:

1. confirm the live REST base for `tf_tours`;
2. confirm the destination taxonomy REST endpoint (`tour_destination` unless the live site differs);
3. inspect the tour meta/custom fields used for duration, itinerary, includes/excludes and individual detail content;
4. define the first media-copy pass so `MediaAsset.storageKey` and `publicUrl` point to platform-owned persistent storage;
5. persist normalized records into the new content tables while preserving the raw REST payloads;
6. validate counts, slugs, media and relationships against the existing migration evidence.

## WordPress import gate

The architectural gate is considered open once the Prisma-backed ContentService passes:

```bash
npm run verify:sanitization
npm run typecheck
npm run test
npm run build
```

After that validation, the next product step is the real WordPress extraction/persistence pass.

## Exit condition for returning to the commercial web

Return focus to `quisqueya-web` when:

- the first real WordPress import is persisted in MySQL;
- six featured experiences resolve with real titles, slugs and media;
- destinations required by Home resolve;
- public API responses are stable;
- media URLs are usable by Next.js;
- no commercial-web component reads WordPress directly.
