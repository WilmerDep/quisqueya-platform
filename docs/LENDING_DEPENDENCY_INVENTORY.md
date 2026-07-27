# Lending Dependency Inventory

Status: **Phase 0.2 / active**

This inventory records the inherited PrestaFacil domain edges that must be removed or adapted before Quisqueya Platform can be considered domain-clean.

## Runtime module registration

The original NestJS root module registered these lending-specific modules directly:

- `LoansModule`
- `PaymentsModule`
- `CashModule`
- `RoutesModule`

As of Phase 0.2 they are **quarantined from `AppModule` runtime registration**. Their source files are intentionally retained until Prisma, frontend, test, fixture and shared-service dependencies are removed safely.

The following modules remain active because they are infrastructure or adaptation candidates:

- `AuthModule`
- `CompaniesModule`
- `BranchesModule`
- `UsersModule`
- `ClientsModule` — temporary inherited model; will be replaced/split by CRM contacts/travelers
- `ReportsModule` — adaptation candidate
- `AuditModule`
- `SyncModule` — future imports/reconciliation layer

## Prisma dependency surface

The inherited schema contains strong lending-domain relations hanging from retained identity models.

### Company currently relates to

- clients
- loans
- payments
- collection routes
- cash movements / closures
- reports
- audit
- sync queue

### Branch currently relates to

- clients
- loans
- payments
- collection routes
- cash movements / closures
- reports

### User currently relates to

- assigned clients
- payments
- collection routes
- visit logs
- cash movements / closures
- reports
- audit
- sync queue

These relations mean Prisma cleanup must be performed as a coordinated schema migration rather than deleting lending models independently.

## Lending-only Prisma concepts confirmed

- `ClientCreditRating`
- lending `ClientStatus`
- `LoanFrequency`
- `LoanStatus`
- `InstallmentStatus`
- `RouteStatus`
- `RouteItemVisitStatus`
- `CashMovementType`
- `Loan`
- `Installment`
- loan repayment `Payment`
- `PaymentVoid`
- `CollectionRoute`
- `RouteItem`
- `PaymentPromise`
- collection-oriented visit/cash models

## Removal sequence

1. Quarantine lending NestJS modules from runtime. **DONE**
2. Inventory frontend routes/navigation and API adapters. **NEXT**
3. Inventory tests, seeds and fixtures for lending references.
4. Define replacement CRM identity: Contact / Traveler / Customer.
5. Rewrite retained Prisma identity relations so Company / Branch / User no longer require lending models.
6. Remove lending Prisma enums/models in a single validated migration pass.
7. Delete quarantined backend module source after typecheck confirms no retained dependency.
8. Remove lending-only frontend screens/components.
9. Re-run typecheck, unit tests, E2E smoke tests and build.

## Current safety position

No lending source module has been physically deleted yet. The protected archive branch remains the provenance/rollback source. Quarantining runtime registration is the first executable separation step while keeping the codebase recoverable during dependency cleanup.
