# Environment topology — Quisqueya Travel Platform

Updated: 2026-10-03

This document fixes the platform deployment topology so staging and production keep the same CRM/API structure and the final domain migration is primarily an environment/DNS change.

## Rule

The CRM and Nest API share the same platform deployment. The CRM must consume the API through the relative route:

```env
VITE_API_URL=/api/v1
```

Do not replace this with an absolute same-origin URL. Keeping the relative route avoids unnecessary CORS/preflight behavior and keeps the CRM portable between staging and production.

The commercial Next.js application remains a separate Node application and consumes the platform API through its own `QUISQUEYA_API_URL`.

## Staging

Platform:

```env
NODE_ENV=production
APP_ENV=staging
APP_URL=https://crmquisqueya.pholiodev.com
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueya.pholiodev.com,https://crmquisqueya.pholiodev.com
STAGING_CONTENT_IMPORT_ENABLED=false
BOOTSTRAP_ADMIN_ENABLED=false

STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_REDIRECT_URI=https://crmquisqueya.pholiodev.com/api/v1/integrations/google-drive/callback
```

The following Google Drive values are also required in the staging environment, but their real values must never be committed:

```text
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_DRIVE_REFRESH_TOKEN
GOOGLE_DRIVE_ROOT_FOLDER_ID
GOOGLE_DRIVE_PICKER_API_KEY
GOOGLE_DRIVE_APP_ID
```

Topology:

```text
https://quisqueya.pholiodev.com
        |
        | QUISQUEYA_API_URL
        v
https://crmquisqueya.pholiodev.com
├── /              CRM
└── /api/v1        Nest API
```

### Media delivery in staging

Provider-managed media is delivered through:

```text
https://crmquisqueya.pholiodev.com/api/v1/media/{mediaAssetId}/content
```

`APP_URL` is therefore part of the media contract. It must already contain the correct staging hostname before registering or reconciling provider-managed MediaAsset records.

The Google OAuth client must include the exact staging callback URI above, and the Picker API key/browser restrictions must allow the staging CRM origin.

## Production target

When the client approves the final migration:

```env
NODE_ENV=production
APP_ENV=production
APP_URL=https://app.quisqueyatravel.com.do
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueyatravel.com.do,https://www.quisqueyatravel.com.do,https://app.quisqueyatravel.com.do
STAGING_CONTENT_IMPORT_ENABLED=false
BOOTSTRAP_ADMIN_ENABLED=false

STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_REDIRECT_URI=https://app.quisqueyatravel.com.do/api/v1/integrations/google-drive/callback
```

Topology:

```text
https://quisqueyatravel.com.do
        |
        | QUISQUEYA_API_URL
        v
https://app.quisqueyatravel.com.do
├── /              CRM
└── /api/v1        Nest API
```

The commercial web will consume:

```text
https://app.quisqueyatravel.com.do/api/v1
```

A separate `api.quisqueyatravel.com.do` deployment is reserved only as a future architectural option. It is not part of the current hosting target.

## Final domain migration checklist

No CRM or API route code should need to change for the domain migration.

1. Complete local and staging QA of the approved experience singles and public media delivery.
2. Point `app.quisqueyatravel.com.do` to the existing platform application.
3. Replace platform `APP_URL`, `APP_ENV`, `CORS_ORIGINS` and `GOOGLE_DRIVE_REDIRECT_URI` with the production values.
4. Keep `VITE_API_URL=/api/v1` unchanged.
5. Keep the same provider/root configuration unless the storage provider itself is intentionally migrated.
6. Ensure the production OAuth callback is registered in Google Cloud and the Picker key restrictions include the production CRM origin.
7. Redeploy/restart the platform and validate `/healthz`, CRM login, authenticated media endpoints, `/api/v1/public/*`, and public media streaming.
8. Update the commercial web environment to `https://app.quisqueyatravel.com.do/api/v1`, then redeploy it.
9. Validate canonical/SEO URLs, experience singles, featured media, galleries and forms on the official domain.
10. Remove provisional origins only after DNS propagation and final validation are complete.

### Persisted MediaAsset URLs

The current MediaAsset model stores `publicUrl`. If existing records were created under a local or staging `APP_URL`, they must be reconciled after a hostname change so no persisted delivery URL points to the previous environment. This is a cutover concern to resolve before production approval; application components must not hardcode environment hostnames.
