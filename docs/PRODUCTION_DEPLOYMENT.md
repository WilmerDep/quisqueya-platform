# Quisqueya Platform — Production Deployment

Updated: 2026-10-03

## Current target architecture

Quisqueya Platform is one Hostinger-managed Node application containing:

- NestJS API under `/api/v1`;
- compiled Vite/React CRM served from the same runtime artifact;
- Prisma + MySQL/MariaDB;
- Google Drive as the current temporary media storage provider behind `MediaAsset`.

Production host:

```text
https://app.quisqueyatravel.com.do
├── /              CRM
├── /api/v1        Nest API
└── /healthz       health check
```

The public Next.js site is the second Node application at `https://quisqueyatravel.com.do`.

A separate `api.quisqueyatravel.com.do` application is not part of the current deployment target.

## 1. Production environment

Real values belong only in Hostinger environment settings or another approved secrets store.

Required core values include:

```env
NODE_ENV=production
APP_ENV=production
PORT=3000
APP_URL=https://app.quisqueyatravel.com.do
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueyatravel.com.do,https://www.quisqueyatravel.com.do,https://app.quisqueyatravel.com.do
```

Database and JWT variables must use production credentials/secrets.

Google Drive media variables:

```env
STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_DRIVE_PICKER_API_KEY=
GOOGLE_DRIVE_APP_ID=
GOOGLE_DRIVE_REDIRECT_URI=https://app.quisqueyatravel.com.do/api/v1/integrations/google-drive/callback
```

Never commit the real values.

## 2. Google Cloud before cutover

Before production authorization:

1. Register the exact production OAuth callback shown above.
2. Allow the production CRM origin in the restricted Picker API key/browser configuration.
3. Keep the same approved **PAGINA WEB** root unless a deliberate storage migration is being performed.
4. Confirm the OAuth consent/publishing strategy so production does not rely on short-lived Testing refresh tokens.

## 3. Build and release

The approved release must come from the production branch after local and staging QA.

Hostinger build command:

```bash
npm run deploy:prepare
```

The build must remain self-contained and include the compiled CRM within the server artifact.

Do not bypass Prisma, production-readiness or CRM packaging checks to force a deployment green.

## 4. Content and media

WordPress remains a migration/fallback source, not the final authority.

For experience galleries:

- when `galleryMediaIds` contains managed MediaAsset IDs, the public API uses that managed gallery;
- when no managed gallery exists, legacy WordPress/Tourfic media may remain as fallback.

Provider-managed media is delivered through:

```text
https://app.quisqueyatravel.com.do/api/v1/media/{mediaAssetId}/content
```

If MediaAsset records were created under localhost or staging, reconcile any persisted `publicUrl` after changing `APP_URL`.

## 5. Commercial web production environment

After the platform is healthy:

```env
QUISQUEYA_API_URL=https://app.quisqueyatravel.com.do/api/v1
NEXT_PUBLIC_SITE_URL=https://quisqueyatravel.com.do
NEXT_PUBLIC_INDEXABLE=true
```

Redeploy the web after changing these values.

## 6. Production validation

Platform:

```bash
npm run verify:production
npm run prisma:migrate:deploy
npm run build:production
npm run verify:public-api
```

Runtime checks:

```text
GET https://app.quisqueyatravel.com.do/healthz
GET https://app.quisqueyatravel.com.do/api/v1/public/experiences
GET https://app.quisqueyatravel.com.do/api/v1/media/{knownMediaAssetId}/content
```

Also validate:

- CRM login and refresh;
- Google Drive integration status/root traversal;
- featured media and galleries on approved experience singles;
- commercial forms;
- canonical/SEO URLs;
- responsive desktop/mobile behavior.

## 7. Initial population vs routine deployment

Do not rerun destructive WordPress imports or forced seed operations during a routine release.

Initial population/intentional refresh operations must be treated separately, backed up and audited.

## 8. Rollback baseline

Before every release:

1. record the known-good Git commit;
2. back up the database;
3. keep the prior deployment/release available until health, API, CRM and media checks pass.

Database rollback must use the pre-release backup. Prisma rollback must not be improvised on production data.
