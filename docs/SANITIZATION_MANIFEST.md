# Quisqueya Platform — Sanitization Manifest

Status: **Phase 0.3 / active**

This manifest controls the removal/adaptation of inherited PrestaFacil domain code. It is intentionally conservative: infrastructure is preserved until dependency edges are verified.

## Protected baseline

- Archive branch: `archive/pre-quisqueya-sanitization`
- Baseline commit: `db373b62f93d685c4d2518bf63ac98005f2c0da4`
- First validated Quisqueya migration baseline: `ca2fd44`

## Repository-level identity

| Item | Action | Status |
|---|---|---|
| README | Replace PrestaFacil identity with Quisqueya Platform | DONE |
| package.json name | `prestafácil-rd` → `quisqueya-platform` | DONE |
| package-lock identity | Regenerate during first validated local install | DONE — refreshed and pushed in `ca2fd44` |
| demo credentials in README | Remove from primary documentation | DONE |
| inherited product strings in UI/code | Remove during domain cleanup | ACTIVE |

## Backend modules

Source: `server/src/app.module.ts` inherited module registration.

| Module | Decision | Status / Notes |
|---|---|---|
| HealthModule | KEEP | active platform infrastructure |
| PrismaModule | KEEP | active persistence infrastructure |
| AuthModule | KEEP + HARDEN | active; production secret checks and bcrypt-only login are now enforced |
| CompaniesModule | KEEP + ADAPT | active organization root |
| BranchesModule | KEEP + ADAPT | active office/location concept |
| UsersModule | KEEP + ADAPT | active; lending roles still need replacement |
| AuditModule | KEEP | active platform audit trail |
| ReportsModule | ADAPT | active temporarily; travel reports pending |
| SyncModule | RECONVERT | active temporarily; future imports/reconciliation/jobs |
| ClientsModule | RECONVERT | active temporarily; split into Contact/Customer/Traveler later |
| LoansModule | REMOVE | QUARANTINED from root runtime registration |
| PaymentsModule | REMOVE/REPLACE | QUARANTINED from root runtime registration |
| CashModule | ISOLATE | QUARANTINED from root runtime registration pending finance review |
| RoutesModule | REMOVE/REPLACE | QUARANTINED from root runtime registration |

Quarantined source is intentionally retained until Prisma, frontend, tests, fixtures and shared dependencies are removed. See `docs/LENDING_DEPENDENCY_INVENTORY.md`.

## Prisma domain

### Keep / adapt

- Plan: **ISOLATE/REVIEW** — inherited SaaS billing model is not Phase 1 Quisqueya scope.
- Company: **KEEP + ADAPT**
- Branch: **KEEP + ADAPT**
- User: **KEEP + ADAPT**
- AuditLog: **KEEP**
- report-related infrastructure: **ADAPT after dependency review**
- sync-related infrastructure: **RECONVERT**

### Remove from active travel domain

Known inherited lending concepts:

- `ClientCreditRating`
- `ClientStatus` where semantics are lending approval
- `LoanFrequency`
- `LoanStatus`
- `InstallmentStatus`
- `CollectionRoute`
- `RouteItem`
- `RouteItemVisitStatus`
- `Loan`
- `Installment`
- inherited `Payment` / `PaymentVoid` related to loan repayment
- `PaymentPromise`
- collection-oriented visit logs
- delinquency / mora fields and calculations
- collector role/workflow

Prisma dependency edges from Company / Branch / User have now been inventoried at a high level. Physical schema removal remains gated on frontend/test/seed inventory and replacement CRM identity modeling.

## Authentication/security cleanup

| Item | Current inherited behavior | Target | Status |
|---|---|---|---|
| Access JWT secret | inherited development fallback | mandatory in production; fail fast | DONE — production startup now rejects a missing `JWT_ACCESS_SECRET`; development fallback is explicitly Quisqueya-only |
| Refresh JWT secret | inherited development fallback | mandatory in production; fail fast | DONE — production refresh signing rejects a missing `JWT_REFRESH_SECRET`; development fallback is explicitly Quisqueya-only |
| Refresh sessions | signed refresh JWT | persistent revocable session model | PENDING — belongs to the later identity/session hardening pass, not the content-readiness gate |
| Password hashes | bcrypt + legacy PrestaFacil SHA-256 migration | bcrypt-only | DONE — legacy SHA-256 compatibility removed from active API login |
| CORS | formerly globally open | environment allowlist | DONE — bootstrap now defaults to Quisqueya production origins and local development origins |
| Frontend auth fallback | local demo users + local password verification | API-backed authentication only | DONE — local auth fallback removed from active AuthContext |
| Cross-user switching | local simulated profile switch | audited server-side impersonation only | QUARANTINED — frontend switch is intentionally disabled |
| Roles | SUPER_ADMIN / ADMINISTRADOR / SUPERVISOR / COBRADOR | travel/CRM permission matrix | PENDING |
| Demo seed safety | inherited demo seed remains in legacy data adapter | remove when dataService is split | ACTIVE |

## Frontend cleanup

Detailed inventory: `docs/FRONTEND_DEPENDENCY_INVENTORY.md`.

### Active route quarantine

The following lending-only routes have been removed from active `App.tsx` routing while their source files remain for dependency analysis:

- `/collect-today`
- `/loans`
- `/loans/new`
- `/routes`
- `/cash`

Retained routes currently form the temporary platform shell: dashboard, activity, clients, users, reports, settings and super-admin.

### Shared shell still pending adaptation

`components/Layout.tsx` remains a shared component and still contains:

- lending navigation labels/actions;
- `getLoans` search integration;
- `Role.COBRADOR` filters;
- lending notification event semantics;
- inherited storage and branding strings.

It must be adapted in place rather than deleted.

## Validated quality-gate baseline

The first clean local migration baseline has been completed on Windows after a fresh dependency install and Prisma client generation.

Validated commands:

- `npm run verify:sanitization` — PASS
- `npm run typecheck` — PASS
- `npm run test` — PASS (`29/29` tests)
- `npm run build` — PASS (Vite production build + NestJS TypeScript build)

The current Vite warnings are non-blocking and tracked as cleanup signals:

- `services/dataService.ts` is both statically and dynamically imported and should be split during Phase 0.3;
- the main frontend chunk is larger than 500 kB and should be reassessed after lending-domain removal and service separation.

See `docs/PHASE_0_BASELINE_VALIDATION.md`.

## New modules — creation order

Do not create all modules at once.

### Wave A — Content source for public web

1. Media
2. Destinations
3. Experiences
4. Pages/Home content
5. Services
6. Transport
7. Public read API

### Wave B — Import

1. ImportJob / SourceRecord
2. WordPress REST importer
3. media importer
4. relationship reconciliation
5. migration report

### Wave C — CRM

1. Contact
2. Lead
3. TravelRequest
4. Opportunity
5. Quote / QuoteItem
6. Task / Note / Interaction

### Wave D — Operations

1. Booking
2. Traveler
3. Supplier
4. Transfer
5. Operation
6. Document

## Destructive-change gate

A lending module may be deleted only when all are true:

- no retained NestJS module imports it;
- Prisma relations from retained models are understood and migrated/removed;
- frontend imports/routes are identified;
- tests/fixtures/seeds referencing it are identified;
- removal can be covered by `typecheck`, `test`, and `build` locally;
- rollback remains possible through the archive branch.

## Phase 0 completion definition

Phase 0 is complete when:

- repository identity is Quisqueya Platform;
- protected baseline exists;
- migration plan and this manifest exist;
- dependency inventory for lending modules is complete;
- lending modules and routes are removed from active runtime before physical deletion;
- API-backed authentication no longer depends on local demo fallback;
- production auth configuration no longer accepts inherited generic secrets;
- the first local quality-gate run establishes a clean migration baseline — **DONE**;
- shared shell no longer exposes lending-only navigation/search/role semantics;
- legacy `dataService.ts` is decomposed enough that retained platform code no longer depends on lending storage/seeds.