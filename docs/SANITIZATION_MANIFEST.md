# Quisqueya Platform — Sanitization Manifest

Status: **Phase 0 / active**

This manifest controls the removal/adaptation of inherited PrestaFacil domain code. It is intentionally conservative: infrastructure is preserved until dependency edges are verified.

## Protected baseline

- Archive branch: `archive/pre-quisqueya-sanitization`
- Baseline commit: `db373b62f93d685c4d2518bf63ac98005f2c0da4`

## Repository-level identity

| Item | Action | Status |
|---|---|---|
| README | Replace PrestaFacil identity with Quisqueya Platform | DONE |
| package.json name | `prestafácil-rd` → `quisqueya-platform` | DONE |
| package-lock identity | Regenerate during first validated local install | PENDING |
| demo credentials in README | Remove from primary documentation | DONE |
| inherited product strings in UI/code | Remove during domain cleanup | PENDING |

## Backend modules

Source: `server/src/app.module.ts` inherited module registration.

| Module | Decision | Notes |
|---|---|---|
| HealthModule | KEEP | platform infrastructure |
| PrismaModule | KEEP | persistence infrastructure |
| AuthModule | KEEP + HARDEN | remove legacy lending compatibility after verification; production secrets required |
| CompaniesModule | KEEP + ADAPT | organization root |
| BranchesModule | KEEP + ADAPT | office/location concept |
| UsersModule | KEEP + ADAPT | replace lending roles/labels |
| AuditModule | KEEP | platform audit trail |
| ReportsModule | ADAPT | replace lending reports with travel/commercial/operations reports |
| SyncModule | RECONVERT | imports/reconciliation/jobs; future WordPress importer |
| ClientsModule | RECONVERT | split responsibilities into Contact/Customer/Traveler as CRM model is introduced |
| LoansModule | REMOVE | lending-only domain |
| PaymentsModule | REMOVE/REPLACE | inherited loan-payment domain is not the future travel payment domain |
| CashModule | ISOLATE | do not delete until dependencies are verified; future finance requirements may be modeled separately |
| RoutesModule | REMOVE/REPLACE | collection routes are lending-specific; DMC transport/operation routes must be a new domain |

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

Deletion must wait until frontend/API/test references have been mapped.

## Authentication/security cleanup

| Item | Current inherited behavior | Target | Status |
|---|---|---|---|
| Access JWT secret | development fallback exists | mandatory in production; fail fast | PENDING |
| Refresh JWT secret | development fallback exists | mandatory in production; fail fast | PENDING |
| Refresh sessions | signed refresh JWT | persistent revocable session model | PENDING |
| Password hashes | bcrypt + legacy SHA-256 migration | bcrypt-only after migration verification | PENDING |
| CORS | globally open | environment allowlist | PENDING |
| Roles | SUPER_ADMIN / ADMINISTRADOR / SUPERVISOR / COBRADOR | travel/CRM permission matrix | PENDING |
| Demo seed safety | inherited production guard exists | revalidate after domain cleanup | PENDING |

## Frontend cleanup

Do not delete frontend pages in bulk. Execute in this order:

1. map route/navigation references;
2. identify shared components used by retained admin infrastructure;
3. remove lending-only pages;
4. replace dashboards/labels with neutral Quisqueya shell;
5. then introduce travel CRM/content screens.

Known concepts to remove from active UI:

- loans/préstamos
- installments/cuotas
- collections/cobros
- mora
- collection routes/rutas de cobro
- loan payment promises
- lender-specific KPIs
- collector/cobrador role UI

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
- no destructive domain deletion has happened before that inventory;
- the first local quality-gate run establishes a clean migration baseline.
