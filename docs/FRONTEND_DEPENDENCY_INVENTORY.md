# Quisqueya Platform — Frontend Dependency Inventory

Status: Phase 0.2 / active

This inventory records inherited PrestaFacil frontend dependencies before destructive deletion.

## Route layer

`App.tsx` previously exposed active lending-only routes for:

- `/collect-today`
- `/loans`
- `/loans/new`
- `/routes`
- `/cash`

These routes are now quarantined from the active router. Their page files remain in the repository until shared dependencies are verified.

Retained active routes:

- dashboard
- activity
- clients / client profile (temporary CRM-adaptation surface)
- users
- reports
- settings
- super-admin
- authentication / landing

## Shell / Layout dependencies

`components/Layout.tsx` still contains lending-specific dependencies and must not be deleted blindly.

Known active inherited edges:

- imports `getLoans` from `services/dataService.ts`
- global search mixes client results with loan results
- navigation includes Cobrar Hoy, Prestamos, Rutas and Caja
- role filters include `Role.COBRADOR`
- notification tone logic recognizes `PAGO`, `PROMESA` and `ROUTE_CLOSE`
- local storage shell key remains `loanops_shell_scope`
- branding assets/alt text still reference ABUNDRA in the shell

Decision: Layout is a shared platform shell and will be adapted in place rather than removed.

## Type layer

`types.ts` currently mixes platform types with the lending domain.

### Keep/adapt

- Role
- Company
- GlobalConfig
- CompanyConfig
- Branch
- User
- Client (temporary; will split into Contact/Customer/Traveler)
- generic report infrastructure

### Lending-only / remove after references are cut

- Frequency
- LoanStatus
- FichaType where used as credit rating
- lending ClientStatus semantics
- RouteStatus
- Loan
- Installment
- PaymentReceipt
- CollectionRoute
- RouteItem
- PaymentPromise
- collection-oriented VisitLog
- CashMovement and CashClosure as currently modeled
- lender-specific ActivityType values
- lender-specific report collector fields

## Data adapter layer

`services/dataService.ts` is the largest inherited coupling point.

It currently contains:

- PrestaFacil-prefixed localStorage keys
- local demo data and credentials/hashes
- lending schedule/payment/cash helpers
- companies/users/branches infrastructure
- client/lending CRUD
- local activity/audit fallback
- SaaS plan fallback

This file must be split rather than bulk-edited. Target extraction order:

1. `platformStorage` / temporary migration utilities
2. organization data
3. user/admin data
4. CRM contact data
5. reporting foundation
6. remove lending-only exports after import graph is clean

## Authentication

`AuthContext.tsx` previously called `seedInitialData()` and fell back to local credential verification when the API was unavailable.

That fallback is now removed from the active authentication path. Authentication is API-backed only; local cross-user switching is disabled until an audited server-side impersonation endpoint exists.

The legacy demo seed remains physically inside `services/dataService.ts` for now, but is no longer invoked by the active auth provider. It will be removed when `dataService.ts` is split.

## Deletion gate

Do not physically delete lending page files or lending types until:

- Layout no longer imports lending data;
- retained pages no longer import lending types/helpers;
- `dataService.ts` has been split;
- API-only authentication remains functional;
- typecheck/build can be run locally after the change set.
