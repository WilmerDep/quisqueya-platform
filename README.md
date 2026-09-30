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

CRM/CMS and API are logically separated but deployed together under one Node application host. NestJS serves the API under `/api/v1` while the administrative frontend is served from the same host. This reduces Hostinger resource usage without coupling domain responsibilities.

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

### Staging

- `https://quisqueya.pholiodev.com` → public commercial website (`quisqueya-web`)
- `https://crmquisqueya.pholiodev.com` → CRM/CMS + NestJS API
- API base → `https://crmquisqueya.pholiodev.com/api/v1`

### Production

- `https://quisqueyatravel.com.do` / `https://www.quisqueyatravel.com.do` → public commercial website
- `https://app.quisqueyatravel.com.do` → CRM/CMS + NestJS API
- API base → `https://app.quisqueyatravel.com.do/api/v1`

A separate `api.quisqueyatravel.com.do` deployment is not required under the current Hostinger resource strategy.

Hostinger staging may run with `NODE_ENV=production` because the application is built and executed using optimized Node/Vite/Nest settings. This does **not** mean the deployment tier is production. `APP_ENV=staging` is the explicit project-level environment marker; real production uses `APP_ENV=production`.

## Media storage

Persistent multimedia must live outside disposable application build directories and must not accumulate on the Hostinger application server.

Current temporary provider: Google Drive owned by Quisqueya Travel. The API/CMS will manage a provider-agnostic `MediaAsset` catalog so Google Drive can later be replaced by Cloudflare R2, S3, or another object storage provider without rebuilding content relationships.

See:

`docs/MEDIA_STORAGE_GOOGLE_DRIVE.md`

## Important

Do not add production credentials, OAuth client secrets, Google refresh tokens, JWT secrets, database passwords, or legacy WordPress credentials to this repository.
