# Quisqueya Platform — Content Bridge Readiness

## Objective

Prepare `quisqueya-platform` to ingest the current WordPress content and expose a stable public read API so `quisqueya-web` can stop depending on hardcoded placeholders and return quickly to commercial-site implementation.

## Current bridge

The platform now contains a lightweight normalized content layer that is intentionally independent from the inherited lending schema while the Prisma sanitization continues.

Flow:

```text
Current WordPress
      |
      v
scripts/import-wordpress-content.mjs
      |
      +--> data/wordpress/raw/*.json      (traceability / source evidence)
      |
      +--> data/content/snapshot.json     (normalized bridge)
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

## Public endpoints available

- `GET /api/v1/public/content`
- `GET /api/v1/public/experiences`
- `GET /api/v1/public/experiences/:slug`
- `GET /api/v1/public/destinations`
- `GET /api/v1/public/destinations/:slug`
- `GET /api/v1/public/pages`
- `GET /api/v1/public/pages/:slug`
- `GET /api/v1/public/media`

The API returns empty arrays until a normalized snapshot is imported. This lets frontend integration be developed without coupling the web application to WordPress.

## Import command

```bash
WP_BASE_URL=https://quisqueyatravel.com.do npm run import:wordpress
```

The first pass intentionally extracts only confirmed public REST resources:

- pages
- media
- `tf_tours`

The importer preserves the full raw responses before normalization.

## Still required before the first real WordPress run

1. Confirm the live REST base for `tf_tours` on the current WordPress instance.
2. Confirm the destination taxonomy REST endpoint (`tour_destination` from the migration audit, unless the live site differs).
3. Confirm which tour meta/custom fields represent duration, itinerary, includes/excludes and other detail-page data.
4. Decide whether WordPress media is copied to platform storage during the first pass or initially referenced by source URL and copied during the media pass.
5. Run the importer and review counts/relationships against the existing migration v0.2 evidence.

## Why the bridge is file-backed first

This is a temporary migration boundary, not the final persistence model. It allows the commercial web to consume stable Quisqueya API contracts immediately while the inherited lending Prisma domain is still being removed safely.

After extraction is validated, the normalized models move into the cleaned Prisma content schema without changing the public API contract used by `quisqueya-web`.

## Exit condition

We return focus to `quisqueya-web` when:

- the first real WordPress snapshot is extracted;
- six featured experiences resolve with real titles/slugs/media;
- destinations required by Home resolve;
- public API responses are stable;
- media references are usable by Next.js;
- no commercial-web component needs to read WordPress directly.
