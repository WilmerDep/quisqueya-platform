# Quisqueya Platform — Legacy dataService decomposition plan

Status: **Phase 0.3 / active**

## Why this exists

`services/dataService.ts` is the largest remaining frontend coupling point inherited from the lending application. It currently mixes organization, users, local demo/bootstrap data, clients, loans, payments, routes, cash, reports, activity and SaaS-plan behavior behind one localStorage-backed module.

The file must not become the data foundation for Quisqueya. The target is an API-backed platform where the public web consumes stable content contracts and the CRM consumes domain-specific services.

## Non-negotiable boundary

New Quisqueya modules must **not** add imports from `services/dataService.ts`.

The legacy module remains temporary compatibility code only for inherited screens while they are progressively migrated or removed.

## Target service boundaries

### Identity / organization

- `services/authService.ts` — session/token lifecycle only.
- future organization client — company/office metadata from Nest API.
- future users client — users/roles/permissions from Nest API.

### CRM

- contacts/customer API client.
- leads/travel requests/opportunities API client.
- quotes/tasks/notes API clients as those modules are introduced.

### Content

Content does not depend on the legacy frontend data service.

Source of truth:

```text
Nest Content module
  -> Prisma/MySQL (target)
  -> Media storage
  -> stable /api/v1/public/* contracts
```

The current JSON snapshot is only a controlled bridge until persistence is introduced.

### Legacy lending compatibility

The following concepts stay isolated until their inherited screens/tests are removed:

- loans/installments;
- loan payments and payment voids;
- collections/routes/tracking;
- cash collection;
- mora/scoring;
- payment promises;
- lending-specific plans/features and demo seeds.

## Migration waves

### Wave 1 — active-shell isolation

Status: **DONE**

- active router uses `PlatformShell`;
- `PlatformShell` has no `dataService` dependency;
- lending navigation/search is absent from the active shell.

### Wave 2 — remove demo/bootstrap authority

- do not call `seedInitialData` from active startup/auth paths;
- remove inherited PrestaFacil credentials/hashes from any active execution path;
- keep legacy seed code quarantined until physical deletion is safe.

### Wave 3 — migrate retained platform screens

Move retained screens away from direct `dataService.ts` imports in this order:

1. Users / organization settings;
2. Activity / audit;
3. Reports shell;
4. Clients, once the Contact/Customer model is defined;
5. Super-admin surfaces if retained.

Each screen should consume an API-backed or domain-specific service rather than a generic global adapter.

### Wave 4 — delete lending compatibility

Only after the retained frontend has no lending storage dependency:

- delete lending-only pages/components;
- delete lending-only `dataService` functions and localStorage keys;
- remove lending tests/fixtures;
- remove lending Prisma models and relations;
- regenerate Prisma and rerun all quality gates.

## Content-readiness gate

WordPress extraction remains blocked until all of the following are true:

- Phase 0 baseline remains green;
- active shell is lending-neutral;
- Content API contracts are source-agnostic;
- Content/Media persistence model is defined before import;
- WordPress is treated strictly as an import source, not runtime dependency;
- no new Content code imports `services/dataService.ts`.

## Quality gates after each migration wave

```bash
npm run verify:sanitization
npm run typecheck
npm run test
npm run build
```
