# Quisqueya Platform — Sanitization Manifest

Status: **Phase 0.2 / active**

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
| inherited product strings in UI/code | Remove during domain cleanup | ACTIVE |

## Backend modules

Source: `server/src/app.module.ts` inherited module registration.

| Module | Decision | Status / Notes |
|---|---|---|
| HealthModule | KEEP | active platform infrastructure |
| PrismaModule | KEEP | active persistence infrastructure |
| AuthModule | KEEP + HARDEN | active; remaining auth hardening tracked below |
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
| Access JWT secret | development fallback exists | mandatory in production; fail fast | PENDING |
| Refresh JWT secret | development fallback exists | mandatory in production; fail fast | PENDING |
| Refresh sessions | signed refresh JWT | persistent revocable session model | PENDING |
| Password hashes | bcrypt + legacy SHA-256 migration | bcrypt-only after migration verification | PENDING |
| CORS | formerly globally open | environment allowlist | DONE — bootstrap now defaults to Quisqueya production origins and local development origins |
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
- lending modules are removed from active runtime before physical deletion;
- the first local quality-gate run establishes a clean migration baseline.
