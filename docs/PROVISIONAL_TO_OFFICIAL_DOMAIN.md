# Provisional-to-official domain transition

Updated: 2026-10-03

The staging deployment must use the same two-application architecture as the final deployment. The final migration should change environment/DNS/TLS values, not domain models or API routes.

## Current staging

Commercial web:

```text
https://quisqueya.pholiodev.com
```

Platform (CRM + Nest API in the same Node application):

```text
https://crmquisqueya.pholiodev.com
├── /
└── /api/v1
```

Platform environment:

```env
APP_ENV=staging
APP_URL=https://crmquisqueya.pholiodev.com
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueya.pholiodev.com,https://crmquisqueya.pholiodev.com
GOOGLE_DRIVE_REDIRECT_URI=https://crmquisqueya.pholiodev.com/api/v1/integrations/google-drive/callback
```

Web environment:

```env
QUISQUEYA_API_URL=https://crmquisqueya.pholiodev.com/api/v1
NEXT_PUBLIC_SITE_URL=https://quisqueya.pholiodev.com
NEXT_PUBLIC_INDEXABLE=false
```

Google Drive client secrets, refresh tokens, root IDs and API keys remain environment-only values and are never committed.

## Official production target

Commercial web:

```text
https://quisqueyatravel.com.do
https://www.quisqueyatravel.com.do
```

Platform:

```text
https://app.quisqueyatravel.com.do
├── /
└── /api/v1
```

Platform environment changes:

```env
APP_ENV=production
APP_URL=https://app.quisqueyatravel.com.do
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueyatravel.com.do,https://www.quisqueyatravel.com.do,https://app.quisqueyatravel.com.do
GOOGLE_DRIVE_REDIRECT_URI=https://app.quisqueyatravel.com.do/api/v1/integrations/google-drive/callback
```

Web environment changes:

```env
QUISQUEYA_API_URL=https://app.quisqueyatravel.com.do/api/v1
NEXT_PUBLIC_SITE_URL=https://quisqueyatravel.com.do
NEXT_PUBLIC_INDEXABLE=true
```

## Google Drive cutover requirements

The production OAuth callback must be registered in Google Cloud before cutover. Browser restrictions for the Picker API key must also include the production CRM origin.

The same Drive root and provider abstraction may remain in use. Do not replace MediaAsset relations or store direct Google Drive URLs merely because the public domain changes.

Because MediaAsset currently persists `publicUrl`, reconcile provider-managed assets after changing `APP_URL` if any stored delivery URL still points to localhost or the staging hostname.

## Recommended temporary overlap

During DNS migration, `CORS_ORIGINS` may temporarily contain both staging and official web origins. Remove staging origins only after the official web/API/media paths are verified.

## Verification before removing staging

Platform:

```bash
npm run verify:production
npm run prisma:migrate:deploy
npm run build:production
npm run verify:public-api
```

Web:

```bash
npm run lint
npm run build
npm run verify:content-integration
```

Also verify at least the approved experience singles, featured media, five-item managed galleries, public `/media/:id/content` responses, CRM login and Google Drive integration.
