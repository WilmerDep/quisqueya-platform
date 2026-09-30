# Media Storage — Google Drive (temporary provider)

## Decision

Quisqueya Platform must not persist public multimedia inside the application server or disposable build directories.

The CMS/API owns the media catalog and relationships; the physical file bytes live behind a storage provider abstraction.

Initial provider:

- `google-drive` for staging and the first production-compatible iteration.
- Future providers such as Cloudflare R2 or S3 must be swappable without changing CMS domain models or experience/destination relationships.

## Target flow

```text
CMS / Admin
  -> MediaService
  -> StorageProvider
  -> GoogleDriveStorageProvider
  -> Google Drive
  -> MediaAsset metadata in MySQL
  -> Experience / Destination / Circuit / DMC relations
  -> Commercial web consumes delivery URLs
```

Files may be received temporarily by the API during upload/processing, but they must not remain stored on Hostinger after the storage provider completes the upload.

## Current Drive structure

The Drive owned by Quisqueya Travel is being used as the temporary multimedia store. Current experience folders already include examples such as:

- Altos de Chavon
- Cayo Levantado

Images are expected to be optimized for web before or during ingestion. Original heavy files may remain in a separate master library, but the website should consume optimized versions.

## Google Cloud / OAuth

Google Drive API is enabled in the Quisqueya Google Cloud project.

OAuth client:

- type: Web application
- scope: `https://www.googleapis.com/auth/drive.file`
- app publishing state during integration: Test
- Quisqueya Travel account is configured as a test user

Registered callback targets:

- staging: `https://crmquisqueya.pholiodev.com/api/v1/integrations/google-drive/callback`
- production: `https://app.quisqueyatravel.com.do/api/v1/integrations/google-drive/callback`

Do not commit OAuth JSON downloads, client secrets, refresh tokens, or live folder IDs.

### `drive.file` access boundary

`drive.file` is intentionally retained as the least-privilege scope. It grants per-file access to files the application creates or files/folders explicitly opened or shared with the application flow; it is not equivalent to full Drive access.

Because the current Quisqueya folders predate this integration, a `404` or inaccessible root after OAuth does not automatically mean the folder ID is wrong. Validate the authorized account and per-file access before considering a broader Drive scope. If necessary, the next safe option is to select/grant the existing root through an app file-picker flow or create an app-owned media root and organize content beneath it.

### OAuth Test token lifetime

Google OAuth can remain in **Test** for the staging integration, but refresh tokens issued to an External app in Testing are time-limited and normally expire after 7 days. During staging, plan to re-authorize when needed. Before real production, the consent-screen publishing state and any applicable verification requirements must be resolved so production does not depend on a seven-day refresh-token cycle.

## Environment variables

```env
STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_DRIVE_REDIRECT_URI=
```

`GOOGLE_DRIVE_REFRESH_TOKEN` is not copied from Google Cloud Console. It is obtained after the backend OAuth authorization flow requests offline access and exchanges the authorization code.

## Staging vs production runtime

Hostinger staging runs an optimized Node/Vite/Nest build, therefore `NODE_ENV=production` is valid even though the application environment is not production.

Use the project-level environment marker instead:

```env
# staging
NODE_ENV=production
APP_ENV=staging

# production
NODE_ENV=production
APP_ENV=production
```

This avoids confusing framework runtime optimization with the actual deployment tier.

## Platform hosting decision

CRM/CMS and NestJS API share one Node application host to reduce Hostinger resource usage.

Staging:

```text
https://crmquisqueya.pholiodev.com
  /           -> CRM/CMS
  /api/v1/*   -> NestJS API
```

Production:

```text
https://app.quisqueyatravel.com.do
  /           -> CRM/CMS
  /api/v1/*   -> NestJS API
```

A separate `api.quisqueyatravel.com.do` deployment is not required for the current hosting strategy. Logical separation between frontend, API, modules, and integrations remains inside the repository.

## Implemented backend block

The backend storage layer is provider-agnostic:

```text
MediaService
  -> StorageProvider
       -> GoogleDriveStorageProvider
```

`MediaAsset` stores the active `storageProvider`, provider key, metadata and a delivery URL. Legacy WordPress media remains compatible. Experiences and destinations keep their existing `galleryMediaSourceIds` while provider-managed assets use `galleryMediaIds`; the public content API merges both into the existing `gallery[]` response.

Google Drive files are not automatically made public. For the initial Drive provider, `MediaAsset.publicUrl` points to the platform delivery endpoint, which streams the bytes from Drive without persisting them on Hostinger. A future R2/S3 provider can return a direct CDN URL without changing CMS relationships.

### OAuth / diagnostics

- `GET /api/v1/integrations/google-drive/status` — authenticated configuration status.
- `GET /api/v1/integrations/google-drive/connect` — authenticated authorization URL.
- `GET /api/v1/integrations/google-drive/callback` — signed-state OAuth callback; returns the refresh token only so it can be stored securely in Hostinger.
- `GET /api/v1/integrations/google-drive/root` — authenticated root-folder metadata check.

The authorization URL requests:

```text
scope=https://www.googleapis.com/auth/drive.file
access_type=offline
prompt=consent
```

### Media administration / delivery

- `GET /api/v1/media/storage/objects?parentKey=...` — list accessible objects from the configured provider.
- `POST /api/v1/media/storage/validate` — write/read/metadata/cleanup smoke test using a temporary text file.
- `POST /api/v1/media/register` — register an accessible provider object as `MediaAsset`.
- `PATCH /api/v1/media/experiences/:experienceId` — link registered assets as featured/gallery media without changing publication status.
- `GET /api/v1/media/:id/content` — public delivery proxy for provider-managed media.

The administrative media endpoints require an authenticated Super Admin, Administrador or Supervisor account. The delivery endpoint is public because the commercial website must be able to render registered public-facing media.

## Staging authorization sequence

1. Deploy this backend block to staging without a refresh token.
2. Sign in to the CRM with an authorized administrative account.
3. Call `GET /api/v1/integrations/google-drive/connect` and open the returned `authorizationUrl`.
4. Authorize with the Quisqueya Travel Google account.
5. The callback exchanges the code and returns `refreshToken` with `Cache-Control: no-store`.
6. Copy that token only into Hostinger as `GOOGLE_DRIVE_REFRESH_TOKEN` and restart the staging application.
7. Check `GET /api/v1/integrations/google-drive/root`.
8. Run `POST /api/v1/media/storage/validate` only after the root is readable.
9. List the Altos de Chavon folder or its accessible parent with `GET /api/v1/media/storage/objects`.
10. Register only the optimized files selected for the first test.
11. Link those `MediaAsset` IDs to the existing Altos de Chavon experience.
12. Verify the same experience from the public API and then from `quisqueya-web`.
13. Do not expand ingestion or CMS upload management until this first path is validated.

## Provider-agnostic rule

Domain records must reference `MediaAsset`, not raw Google Drive URLs as a permanent contract.

The storage layer exposes neutral operations such as:

- list;
- upload;
- delete/archive;
- metadata;
- read/delivery;
- provider key.

When migrating to R2/S3 in the future, the CMS and content relationships should remain unchanged; only the storage provider and migrated asset metadata should change.
