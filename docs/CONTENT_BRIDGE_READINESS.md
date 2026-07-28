# Quisqueya Platform — Content Bridge Readiness

## Objective

Prepare `quisqueya-platform` to ingest the current WordPress content and expose a stable public read API so `quisqueya-web` can stop depending on hardcoded placeholders and return quickly to commercial-site implementation.

## Current state

The active application shell is now isolated from the inherited lending runtime. Content persistence can therefore move into its own Prisma domain without depending on legacy `Client`, `Loan`, collections, cash or localStorage behavior.

The persistent Content Core is defined in:

- `prisma/models/content.prisma`
- `prisma/migrations/20260728023000_add_content_core/migration.sql`

Core persistence includes:

- `MediaAsset`
- `Destination`
- `Experience`
- `ExperienceDestination`
- `TaxonomyTerm`
- `ExperienceTaxonomyTerm`
- `ContentPage`

Every imported record can retain source provider, source id/url and `provenanceJson` so WordPress remains traceable without becoming a runtime dependency.

## Target flow

```text
Current WordPress
      |
      v
scripts/import-wordpress-content.mjs
      |
      +--> data/wordpress/raw/*.json      (source evidence / replay)
      |
      v
Normalizer + validation
      |
      v
Prisma / MySQL Content Core
      |
      +--> persistent media storage
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

The existing `data/content/snapshot.json` remains only as a temporary compatibility bridge until the Content service is switched to Prisma-backed reads.

## Public endpoints already reserved

- `GET /api/v1/public/content`
- `GET /api/v1/public/experiences`
- `GET /api/v1/public/experiences/:slug`
- `GET /api/v1/public/destinations`
- `GET /api/v1/public/destinations/:slug`
- `GET /api/v1/public/pages`
- `GET /api/v1/public/pages/:slug`
- `GET /api/v1/public/media`

These contracts should remain stable while their backing store changes from snapshot to Prisma.

## Media storage policy

Media bytes must not live inside the Git repository or build output.

Logical storage keys use stable prefixes such as:

```text
media/experiences/<id-or-slug>/<filename>
media/destinations/<id-or-slug>/<filename>
media/pages/<id-or-slug>/<filename>
media/shared/<filename>
```

`MediaAsset.storageKey` stores the persistent object/file key. `MediaAsset.publicUrl` stores the URL exposed to consumers. The same model can support local VPS volume storage first and object storage later without changing public content contracts.

For WordPress imports, source URLs are evidence only. Imported media must preserve `sourceProvider=WORDPRESS`, `sourceId`, `sourceUrl`, checksum/metadata when available, and provenance details.

## First real WordPress run prerequisites

1. Apply the Content Core migration to `quisqueya_core` and confirm Prisma generation/typecheck.
2. Switch the Content service to Prisma reads while retaining a controlled empty/fallback state.
3. Confirm the live REST base for `tf_tours`.
4. Confirm the destination taxonomy REST endpoint (`tour_destination` from the migration audit, unless the live site differs).
5. Confirm tour meta/custom fields for duration, itinerary, includes/excludes and detail-page data.
6. Execute extraction preserving RAW before normalization.
7. Validate six featured experiences, their destinations, taxonomies, slugs and media relationships before connecting the commercial web.

## Import command

When the persistence/read path above is validated, the controlled extraction command remains:

```bash
WP_BASE_URL=https://quisqueyatravel.com.do npm run import:wordpress
```

WordPress is an import source only. `quisqueya-web` must never read WordPress directly.

## Exit condition

We return focus to `quisqueya-web` when:

- the Content Core migration is applied and stable;
- the first real WordPress extraction/import is validated;
- six featured experiences resolve with real titles/slugs/media;
- destinations required by Home resolve;
- public API responses are Prisma-backed and stable;
- media references are usable by Next.js;
- no commercial-web component needs to read WordPress directly.
