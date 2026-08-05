# Quisqueya Platform — Prisma & Data Model Audit

Reference date: 2026-08-05

## Purpose

This document records the authoritative Prisma structure and the order for consolidating the Quisqueya Platform data model before expanding the public API, normalizing experiences, completing DMC content, or preparing deployment.

## 1. Prisma architecture

The repository uses Prisma's multi-file schema support.

Authoritative configuration:

```text
prisma.config.ts
  schema: prisma/
  migrations: prisma/migrations/
```

Therefore, `prisma/schema.prisma` is only the inherited core schema and must not be reviewed in isolation.

The effective schema is composed from:

```text
prisma/schema.prisma
prisma/models/*.prisma
```

Any audit, validation, generation, migration, or deployment process must use the complete `prisma/` directory through `prisma.config.ts`.

## 2. Content Core confirmed

The current `prisma/models/content.prisma` defines:

- `MediaAsset`
- `Destination`
- `Experience`
- `ExperienceDestination`
- `TaxonomyTerm`
- `ExperienceTaxonomyTerm`
- `ContentPage`

It also defines the content enums:

- `ContentRecordStatus`
- `ContentSourceProvider`
- `ExperiencePricingMode`

The `Experience` model already contains the fields required by the current public single and catalog implementation:

- slug and title;
- excerpt and description;
- featured text and video;
- duration value and unit;
- languages;
- address and map coordinates;
- category label;
- featured media and gallery references;
- pricing, booking, availability and contact JSON;
- included and excluded items;
- itinerary and FAQs;
- practical information;
- display metadata and editorial flags;
- publication status and sort order;
- WordPress/manual/system provenance.

## 3. Migration history confirmed

The base Content Core migration exists at:

```text
prisma/migrations/20260728023000_add_content_core/migration.sql
```

Subsequent migrations extend the content model for:

- Tourfic experience metadata;
- structured practical information;
- persistent reviews;
- destination editorial content;
- DMC transport media.

The migration chain, not only the latest model file, must be verified before deployment.

## 4. Corrected audit conclusion

The earlier concern that `Experience`, `Destination`, and `MediaAsset` were absent from Prisma was caused by reviewing only `prisma/schema.prisma`.

They are present in the multi-file schema and are consumed consistently by:

- WordPress/Tourfic import scripts;
- NestJS `ContentService`;
- public content endpoints;
- the commercial Next.js application.

The actual remaining task is not to recreate Content Core. It is to verify that:

1. the multi-file schema validates;
2. Prisma Client regenerates from a clean checkout;
3. every content model field has a matching migration;
4. the database migration chain reaches the current schema;
5. importers and services do not depend on undeclared or obsolete fields;
6. inherited lending models remain isolated until their scheduled removal phase.

## 5. Quality gate

The repository now exposes:

```bash
npm run prisma:validate
npm run prisma:generate
npm run verify:prisma
```

`verify:prisma` is the mandatory first gate before changing Content Core, DMC persistence, or API contracts.

## 6. Step 1 execution order

### 1A — Schema integrity

- validate the complete multi-file schema;
- regenerate Prisma Client;
- confirm all imported Prisma enums and models compile.

### 1B — Migration parity

- compare `prisma/models/content.prisma` against the migration chain;
- identify fields present in the model but absent from migrations;
- identify obsolete columns or indexes left in migrations;
- confirm migration ordering and deploy reproducibility.

### 1C — Domain boundaries

Keep separate:

- inherited lending/collection models;
- identity and organization infrastructure;
- CRM contacts;
- Content Core;
- reviews;
- future DMC/operations models.

DMC must not be forced into lending models, and lending terminology must not leak into new content or CRM contracts.

### 1D — Data ownership

For every field, record whether its source of truth is:

- WordPress/Tourfic import;
- manual CRM administration;
- system-generated data;
- temporary fallback.

## 7. Exit criteria for Step 1

Step 1 is complete only when:

- `npm run verify:prisma` passes from a clean checkout;
- the migration chain is documented and matches the current schema;
- Content Core models are canonical;
- no public API service references an undeclared Prisma field;
- DMC persistence boundaries are decided;
- deployment can regenerate Prisma Client without relying on stale generated artifacts.

## 8. Next phase

After Step 1 closes:

```text
Public API audit
→ experience normalization
→ DMC and transport content
→ web/API verification
→ provisional deployment
```
