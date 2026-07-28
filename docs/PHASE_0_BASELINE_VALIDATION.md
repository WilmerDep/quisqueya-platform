# Phase 0 Baseline Validation

Date: 2026-07-27

Repository: `WilmerDep/quisqueya-platform`

Validated checkpoint commit before this document: `ca2fd44`

## Purpose

This checkpoint records the first locally validated Quisqueya Platform baseline after repository identity reset, lending runtime quarantine, authentication hardening, Prisma generation tooling, and test-environment cleanup.

The intent is to establish a trustworthy rollback/comparison point before Phase 0.3 changes the shared frontend shell, role semantics, legacy data adapter and Prisma lending relationships.

## Validation results

The following commands were run locally from a fresh dependency installation:

```bash
npm run verify:sanitization
npm run typecheck
npm run test
npm run build
```

Results:

- Sanitization verification: PASS
- Prisma client generation: PASS (`@prisma/client` v7.8.0)
- TypeScript frontend typecheck: PASS
- TypeScript NestJS typecheck: PASS
- Vitest: PASS — 5 files, 29 tests
- Vite production build: PASS
- NestJS server build: PASS

## Test cleanup completed before baseline

The inherited authentication suite was aligned with the new bcrypt-only policy. Legacy SHA-256 login migration is no longer considered valid behavior.

Vitest now:

- excludes compiled `server-dist/**` tests;
- runs browser-dependent tests in jsdom;
- uses deterministic in-memory browser storage during test execution.

## Non-blocking build warnings

### Legacy data service coupling

Vite reports `services/dataService.ts` as both statically and dynamically imported. This is expected at this checkpoint and is a Phase 0.3 refactor target.

The file currently mixes:

- organization/company state;
- user management;
- demo/local persistence;
- lending data;
- reports;
- activity;
- legacy plan limits;
- seed/bootstrap data.

It must be decomposed before physical deletion of the lending domain.

### Frontend bundle size

The primary frontend bundle is currently larger than 500 kB after minification. This is not treated as a blocker during sanitization because large inherited pages and lending functionality are still present in source.

Bundle optimization should be reassessed after:

1. lending-only pages are physically removed;
2. the legacy data adapter is split;
3. super-admin/CRM screens are code-split where appropriate.

## Phase 0.3 entry criteria

Phase 0.3 can proceed because:

- the inherited baseline remains preserved on `archive/pre-quisqueya-sanitization`;
- active lending NestJS modules are quarantined;
- active lending frontend routes are quarantined;
- production auth secrets fail safely when missing;
- login is bcrypt-only;
- the repository passes typecheck, tests and production build.

## Phase 0.3 targets

The next controlled refactor is:

```text
Shared shell
  → remove lending navigation and search semantics
  → remove inherited branding/storage names
  → replace lending roles with neutral/travel-ready role policy

Legacy data adapter
  → separate organization/user/platform state
  → isolate lending/demo storage
  → remove inherited bootstrap credentials and lender configuration

Prisma
  → prepare retained identity models for removal of lending relations
  → keep Content Core contract stable
```

WordPress extraction is intentionally not started at this checkpoint. It begins only after the Content/Media persistence boundary is stable enough that imported data will not need to be remapped because of unfinished platform sanitation.
