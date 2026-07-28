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
- `services/teamService.ts` — API-only users/branch read boundary for the active users surface.
- `services/organizationService.ts` — API-only company/branch boundary for the active settings surface.
- future role/permission service — explicit Quisqueya role matrix once the replacement model is finalized.

### Audit

- `services/auditService.ts` — API-only read boundary for platform audit history.

### Reporting

- `services/reportingService.ts` — API-only neutral boundary for report exports, schedules and templates.

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

Status: **DONE FOR ACTIVE RUNTIME**

- `App.tsx` no longer mounts the inherited `LandingPage` or `AuthPage`;
- active unauthenticated access uses `PlatformAccessPage`;
- `PlatformAccessPage` authenticates exclusively through `useAuth` → API;
- active access has no demo credentials, quick-login buttons, local company registration or invite activation backed by `dataService.ts`;
- `seedInitialData` and inherited PrestaFacil hashes may still exist inside legacy compatibility code, but they have no authority in the active startup/auth path;
- physical deletion of the legacy seed code remains gated on retained-screen migration.

### Wave 3 — migrate retained platform screens

Status: **ACTIVE**

1. Users — **ACTIVE SURFACE MIGRATED**
   - `App.tsx` no longer mounts the inherited `UsersManagement` routes;
   - `/users` now renders `PlatformUsersPage`;
   - `PlatformUsersPage` loads users/branches through `services/teamService.ts`;
   - no localStorage or `dataService.ts` fallback is allowed on the active users route;
   - inherited create/invite/roles subroutes redirect to `/users` until the Quisqueya permission model is defined.
2. Organization settings — **ACTIVE SURFACE MIGRATED**
   - `App.tsx` no longer mounts `ConfigurationPage`;
   - `/settings` now renders `PlatformSettingsPage`;
   - company and branch reads/writes go through `services/organizationService.ts` → Nest API;
   - the active settings route has no localStorage or lending-specific configuration fallback;
   - inherited settings subroutes redirect to `/settings` until their Quisqueya replacements are explicitly designed.
3. Activity / audit — **ACTIVE SURFACE MIGRATED**
   - `App.tsx` no longer mounts the inherited `ActivityPage`;
   - `/activity` now renders `PlatformActivityPage`;
   - audit reads go through `services/auditService.ts` → Nest `/audit-logs`;
   - the active activity route has no localStorage, report-template fallback or lending-specific event taxonomy;
   - inherited PDF/report behavior remains quarantined with the old screen.
4. Reports shell — **ACTIVE SURFACE MIGRATED**
   - `App.tsx` no longer mounts the inherited `Reports` screen;
   - `/reports` now renders `PlatformReportsPage`;
   - report exports, schedules and templates are read through `services/reportingService.ts` → Nest API;
   - the active reports route no longer computes loan/payment/mora analytics or relies on localStorage;
   - inherited PDF builders, financial drill-downs and report workspaces remain quarantined with the old screen.
5. Clients — **NEXT, AFTER CONTACT/CUSTOMER MODEL DEFINITION**
6. Super-admin surfaces if retained

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
- active unauthenticated/auth flows are API-only and demo-neutral;
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
