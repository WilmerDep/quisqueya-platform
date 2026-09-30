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

Google OAuth can remain in **Test** while the PholioDev staging host is used.

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

## Next implementation block

Do not treat Drive as integrated only because environment variables exist. The next code block is:

1. storage provider contract;
2. `GoogleDriveStorageProvider`;
3. `MediaService` / `MediaAsset` persistence;
4. `GET /api/v1/integrations/google-drive/connect`;
5. `GET /api/v1/integrations/google-drive/callback`;
6. OAuth authorization with `access_type=offline` and explicit consent;
7. obtain and store the refresh token securely in Hostinger;
8. validate read/write against `GOOGLE_DRIVE_ROOT_FOLDER_ID`;
9. first media mapping test with Altos de Chavon;
10. only after validation, expand ingestion to the rest of the library and later expose upload management in the custom CMS.

## Provider-agnostic rule

Domain records must reference `MediaAsset`, not raw Google Drive URLs as a permanent contract.

The storage layer should expose neutral operations such as:

- upload
- delete/archive
- metadata
- delivery URL
- provider key

When migrating to R2/S3 in the future, the CMS and content relationships should remain unchanged; only the storage provider and migrated asset metadata should change.
