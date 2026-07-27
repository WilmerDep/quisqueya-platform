# Quisqueya Platform — Migration & Sanitization Plan

## Purpose

This repository is the Quisqueya Platform codebase, forked from the former PrestaFacil application. The goal is to preserve proven infrastructure (NestJS, Prisma, authentication, audit, testing, React/Vite administration foundation) while removing the lending-specific business domain and replacing it with travel content, CRM, commercial, and operations modules for Quisqueya Travels.

The public website remains in the independent repository `WilmerDep/quisqueya-web`.

## Baseline

The untouched inherited baseline is preserved on branch:

`archive/pre-quisqueya-sanitization`

Baseline commit:

`db373b62f93d685c4d2518bf63ac98005f2c0da4`

Do not rewrite or delete this archive branch. It is the rollback and provenance reference for all migration work.

## Target Architecture

```text
quisqueya-web                         quisqueya-platform
Public Next.js site                  API + CRM + operations platform
       |                                      |
       +--------------- HTTP API -------------+
                                              |
                                 NestJS / Prisma / MySQL
                                              |
                       +----------------------+----------------------+
                       |                      |                      |
                    Content                  CRM                Operations
                       |                      |                      |
                    Media                  Leads                  Suppliers
                    Pages                  Requests               Bookings
                    Experiences            Quotes                 Transfers
                    Destinations           Contacts               Documents
```

### Deployment intent

- `quisqueyatravel.com.do` → public Next.js website
- `app.quisqueyatravel.com.do` → CRM/admin application
- `api.quisqueyatravel.com.do` → NestJS API
- One primary MySQL database is sufficient for the initial platform.
- Uploaded media must live in persistent server storage outside application build output.

## Domain Classification

### KEEP

These inherited capabilities are platform infrastructure and should be preserved unless later audit finds a technical reason to replace them:

- NestJS application bootstrap
- Prisma infrastructure
- MySQL/MariaDB persistence
- JWT authentication foundation
- User model and user management foundation
- Company model
- Branch model
- Audit logging
- Validation pipeline
- API exception handling
- Unit tests / Vitest
- E2E tests / Playwright
- TypeScript strict build/typecheck workflow
- React/Vite administrative frontend foundation

### ADAPT

These concepts are useful but must be renamed or remodeled for the travel domain:

- `Client` → Contact / Customer / Traveler depending on responsibility
- `Reports` → commercial, operational and management reporting
- `Sync` → imports, background synchronization and reconciliation jobs
- `Company` → Quisqueya organization now; capable of supporting future B2B organizations without forcing SaaS complexity into Phase 1
- `Branch` → office/location/operating branch
- user permissions → travel/CRM roles
- admin frontend navigation, labels, dashboards and forms

### REMOVE FROM ACTIVE DOMAIN

The following lending-specific concepts must not remain in the final active Quisqueya domain:

- Loan
- Installment
- loan payment domain
- collection routes
- payment promises related to debt collection
- delinquency / mora logic
- credit rating for loan customers
- collector (`COBRADOR`) workflow
- lending dashboards and lending KPIs
- lender subscription/demo terminology

Removal must be dependency-aware: remove API endpoints, services, DTOs, frontend views, Prisma models, tests and navigation only after confirming no retained infrastructure depends on them.

## New Core Domains

### Identity & Organization

Initial models/modules:

- Company
- Branch
- User
- Role / Permission
- Session
- AuditLog
- Setting

Initial role direction (not yet frozen as final permission matrix):

- SUPER_ADMIN
- ADMIN
- SALES
- OPERATIONS
- CONTENT_EDITOR

### Content

Initial models/modules:

- Experience
- Destination
- Service
- Transport
- Page
- Media
- Taxonomy / Category where needed
- SourceRecord / WordPressSource for migration provenance

Public-read API candidates:

- `GET /api/v1/public/experiences`
- `GET /api/v1/public/experiences/:slug`
- `GET /api/v1/public/destinations`
- `GET /api/v1/public/destinations/:slug`
- `GET /api/v1/public/content/home`
- `GET /api/v1/public/transport`

### CRM

Initial domain direction:

```text
Contact
  -> Lead
  -> TravelRequest
  -> Opportunity
  -> Quote
  -> Booking / Operation
```

Initial models/modules:

- Contact
- Organization / Agency
- Lead
- TravelRequest
- Opportunity
- Quote
- QuoteItem
- Task
- Note
- Interaction

### Operations

Planned domain, introduced only when Content Core and CRM foundation are stable:

- Booking
- Traveler
- Supplier
- Transfer
- Vehicle assignment
- Operation
- Document

## WordPress Migration Strategy

WordPress is a temporary import source, not a permanent runtime dependency.

```text
Current WordPress
      |
      v
WordPress Importer
      |
      +--> validation / reconciliation
      |
      v
Prisma / MySQL
      |
      +--> Media persistent storage
      |
      v
NestJS public API
      |
      v
quisqueya-web
```

The existing Quisqueya migration v0.2 logic should be reused rather than rebuilt from scratch. Imported records must retain provenance fields such as source system, WordPress ID and original URL whenever available.

## Media Strategy

Initial server-hosted storage is acceptable and preferred over adding S3/R2 prematurely.

Recommended persistent layout:

```text
/storage/media/
  experiences/
  destinations/
  transport/
  pages/
  documents/
```

The database stores metadata and paths, not binary file data.

Example media fields:

- id
- filename
- path
- publicUrl
- mimeType
- width
- height
- alt
- sourceSystem
- sourceId
- sourceUrl
- createdAt
- updatedAt

Uploads/imported media must not be stored inside `dist`, `server-dist`, `.next`, or any other disposable build directory.

## Security Sanitization Requirements

Before the platform is considered production-ready:

1. JWT access and refresh secrets must be mandatory environment variables. The API must fail fast if production secrets are missing.
2. Remove PrestaFacil legacy password migration logic from the Quisqueya authentication path after required migration verification.
3. Replace open CORS with environment-configured allowed origins.
4. Add persistent sessions / refresh-token revocation before production CRM rollout.
5. Replace lending-specific roles and permissions.
6. Remove demo credentials from primary project documentation.
7. Confirm production seed behavior cannot create demo users accidentally.
8. Review Prisma `relationMode = "prisma"`; use native database foreign keys unless a concrete deployment constraint requires Prisma relation emulation.

## Execution Phases

### Phase 0 — Repository sanitization

Goal: establish Quisqueya identity, preserve provenance, create migration documentation and produce a dependency map before destructive deletion.

Exit criteria:

- baseline archive branch exists
- repository README identifies Quisqueya Platform
- package/project identity no longer identifies itself as PrestaFacil
- this migration plan is committed
- lending modules are classified before deletion

### Phase 1 — Identity Core

Goal: retain only platform-level organization/auth foundations and adapt them to Quisqueya terminology.

Work:

- roles and permissions
- auth hardening
- user/company/branch terminology
- sessions
- audit
- settings

Exit criteria: authenticated platform can operate without depending on lending domain entities.

### Phase 2 — Remove lending domain

Goal: remove active lending functionality without breaking retained infrastructure.

Work dependency-first across:

- Prisma
- NestJS modules
- frontend routes/pages/components
- services/contracts
- tests
- seed/demo data

Exit criteria: no active lending, collection, installment, mora or collector workflow remains.

### Phase 3 — Content Core & Media

Goal: provide the content source for `quisqueya-web`.

Work:

- Experience
- Destination
- Page
- Service
- Transport
- Media
- public API
- media storage service

Exit criteria: the public website can consume at least the featured experiences and their real media from Quisqueya Platform.

### Phase 4 — WordPress Import

Goal: migrate verified content and media from the legacy WordPress site into the new platform.

Work:

- reuse migration v0.2 extraction knowledge
- importer
- media download/copy
- source provenance
- relationship validation
- reconciliation reporting

Exit criteria: production content required by the commercial site is available independently of WordPress.

### Phase 5 — CRM foundation

Goal: convert the administrative product into a travel CRM.

Work:

- Contact
- Lead
- TravelRequest
- Opportunity
- Quote
- Task / Note / Interaction

Exit criteria: requests from the public site can enter the CRM and progress through a commercial pipeline.

### Phase 6 — Operations

Goal: support post-sale DMC operations.

Work:

- bookings
- travelers
- suppliers
- transfers
- operational documents
- assignments and status tracking

## Change Rules

- Do not modify `Presta-Facil`; all Quisqueya work happens in `quisqueya-platform`.
- Keep `archive/pre-quisqueya-sanitization` immutable.
- Prefer small, auditable commits grouped by domain responsibility.
- Do not delete an inherited module until its inbound/outbound dependencies are checked.
- Do not reintroduce hardcoded commercial content into the CRM/API when the data belongs in Content Core.
- Do not make WordPress a runtime requirement of the new public site.
- Keep `quisqueya-web` independently deployable.
- Preserve data provenance during imports; do not silently infer missing source data.

## Immediate Next Actions

1. Complete safe repository identity reset (README/package metadata).
2. Inventory lending references and dependency edges.
3. Harden/authenticate the retained Identity Core.
4. Create a removal manifest for lending modules.
5. Only then execute lending-domain deletion.
6. Build Content Core + Media before expanding CRM features.
