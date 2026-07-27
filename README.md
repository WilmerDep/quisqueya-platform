# Quisqueya Platform

Core platform for Quisqueya Travels: CRM, NestJS API, Prisma/MySQL persistence, commercial content, media, WordPress migration tooling, and future DMC operations.

This repository was forked from the former PrestaFacil codebase to reuse proven infrastructure. The original inherited baseline is preserved on `archive/pre-quisqueya-sanitization`; lending-specific functionality is being removed in controlled migration phases.

The public commercial website remains independent in `WilmerDep/quisqueya-web`.

## Current architecture

- React/Vite administrative frontend foundation
- NestJS API
- Prisma 7
- MySQL/MariaDB
- JWT authentication foundation
- audit logging
- Vitest
- Playwright

## Local Development

```bash
npm install
npm run dev
```

Backend development:

```bash
npm run dev:server
```

## Quality Gates

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Migration status

The repository is currently in the Quisqueya sanitization/migration process. Do not treat inherited lending modules as part of the final product architecture.

Authoritative migration plan:

`docs/QUISQUEYA_MIGRATION_PLAN.md`

High-level order:

1. repository and identity sanitization
2. Identity Core / auth hardening
3. remove lending domain
4. Content Core + Media
5. WordPress import
6. CRM foundation
7. DMC operations

## Deployment direction

- `quisqueyatravel.com.do` → public Next.js website (`quisqueya-web`)
- `app.quisqueyatravel.com.do` → CRM/admin application
- `api.quisqueyatravel.com.do` → NestJS API

Persistent media must live outside disposable application build directories.

## Important

Do not add production credentials, JWT secrets, database passwords, or legacy WordPress credentials to this repository.
