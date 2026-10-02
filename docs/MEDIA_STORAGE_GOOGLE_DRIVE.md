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

The long-term root is the dedicated **PAGINA WEB** folder inside the Quisqueya Travel Drive account. All website-managed media belongs below that boundary, for example:

```text
PAGINA WEB
  -> Experiencias
       -> Altos de Chavon
       -> Cayo Levantado
  -> Destinos
  -> Circuitos
  -> other website collections
```

Existing folders predate the integration, so OAuth alone is not enough to make them visible through `drive.file`. Quisqueya therefore uses the **Google Picker web API** as the explicit user-consent boundary. An administrator selects the configured root folder in the CRM; the backend then verifies that the selected folder ID exactly matches `GOOGLE_DRIVE_ROOT_FOLDER_ID` and confirms that Drive metadata is readable.

Do not broaden the scope to full Drive access just to bypass a missing per-file grant.

### OAuth Test token lifetime

Google OAuth can remain in **Test** for the staging integration, but refresh tokens issued to an External app in Testing are time-limited and normally expire after 7 days. During staging, plan to re-authorize when needed. Before real production, the consent-screen publishing state and any applicable verification requirements must be resolved so production does not depend on a seven-day refresh-token cycle.

## Environment variables

```env
STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
GOOGLE_DRIVE_PICKER_API_KEY=
GOOGLE_DRIVE_APP_ID=
GOOGLE_DRIVE_REDIRECT_URI=
```

`GOOGLE_DRIVE_REFRESH_TOKEN` is not copied from Google Cloud Console. It is obtained after the backend OAuth authorization flow requests offline access and exchanges the authorization code.

`GOOGLE_DRIVE_PICKER_API_KEY` is intentionally browser-facing because Google Picker requires a developer key. Restrict it in Google Cloud to the Quisqueya CRM website origins plus `https://docs.google.com/*`, and restrict API usage to Google Picker API (and Google Drive API when the browser needs it). Do not reuse an unrestricted general-purpose key.

`GOOGLE_DRIVE_APP_ID` is the Google Cloud **project number** required by `PickerBuilder.setAppId` when using `drive.file`; it is not the OAuth client ID.

Google Picker API and Google Drive API must both be enabled in the same Google Cloud project.

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

### OAuth / Picker / diagnostics

- `GET /api/v1/integrations/google-drive/status` — administrative configuration status.
- `GET /api/v1/integrations/google-drive/connect` — administrative one-time backend OAuth authorization URL.
- `GET /api/v1/integrations/google-drive/callback` — signed-state OAuth callback; returns the refresh token only so it can be stored securely in the runtime environment.
- `GET /api/v1/integrations/google-drive/picker-config` — administrative, `no-store` bootstrap for the web Picker; returns a short-lived Google access token plus the restricted browser key, App ID and configured root folder ID.
- `POST /api/v1/integrations/google-drive/picker-root` — validates that the folder selected by Google Picker is exactly the configured Quisqueya media root, then confirms metadata access.
- `GET /api/v1/integrations/google-drive/root` — administrative root-folder metadata check.

The Picker endpoints are restricted to Super Admin and Administrador roles. The refresh token never leaves the backend; only a short-lived access token required by Google Picker is sent to an authenticated administrative browser.

The backend OAuth authorization URL requests:

```text
scope=https://www.googleapis.com/auth/drive.file
access_type=offline
prompt=consent
```

The CRM does **not** construct ad-hoc `trigger_onepick` authorization URLs. Folder consent is handled by the Google Picker JavaScript API with `PickerBuilder`, a folder-only `DocsView`, the current short-lived access token, the restricted developer key, and the Google Cloud project number.

### Media administration / delivery

- `GET /api/v1/media/storage/objects?parentKey=...` — list accessible objects from the configured provider.
- `POST /api/v1/media/storage/validate` — write/read/metadata/cleanup smoke test using a temporary text file.
- `POST /api/v1/media/register` — register an accessible provider object as `MediaAsset`.
- `PATCH /api/v1/media/experiences/:experienceId` — link registered assets as featured/gallery media without changing publication status.
- `GET /api/v1/media/:id/content` — public delivery proxy for provider-managed media.

The administrative media endpoints require an authenticated Super Admin, Administrador or Supervisor account. The delivery endpoint is public because the commercial website must be able to render registered public-facing media.

## Staging authorization sequence

1. Enable Google Drive API and Google Picker API in the same Google Cloud project.
2. Configure the Web OAuth client and obtain the one-time `GOOGLE_DRIVE_REFRESH_TOKEN` for the Quisqueya Travel account.
3. Configure `GOOGLE_DRIVE_ROOT_FOLDER_ID` with the dedicated **PAGINA WEB** folder ID.
4. Create and restrict `GOOGLE_DRIVE_PICKER_API_KEY`; configure `GOOGLE_DRIVE_APP_ID` with the Cloud project number.
5. Sign in to the CRM as Super Admin or Administrador and open Configuracion.
6. Use the Google Drive authorization card to open the web Picker and explicitly select the configured **PAGINA WEB** folder.
7. The CRM posts the selected folder ID to `POST /api/v1/integrations/google-drive/picker-root`; the backend rejects any different folder and confirms metadata access.
8. Verify `GET /api/v1/integrations/google-drive/root`.
9. Run `POST /api/v1/media/storage/validate` only after the root is readable.
10. List `PAGINA WEB/Experiencias` and then the Altos de Chavon folder with `GET /api/v1/media/storage/objects`.
11. Register only the optimized files selected for the first vertical-slice test.
12. Link those `MediaAsset` IDs to the existing Altos de Chavon experience.
13. Verify the same experience from the public API and then from `quisqueya-web`.
14. Do not expand ingestion or CMS upload management until this first path is validated.

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
