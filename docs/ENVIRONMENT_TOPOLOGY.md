# Environment topology — Quisqueya Travel Platform

This document fixes the platform deployment topology so staging and production keep the same CRM/API structure and the final domain migration only changes environment/DNS values.

## Rule

The CRM and Nest API share the same platform deployment. The CRM must always consume the API through the relative route:

```env
VITE_API_URL=/api/v1
```

Do not replace this with an absolute same-origin URL. Keeping the relative route avoids unnecessary CORS/preflight behavior and makes the CRM portable between staging and production without code changes.

## Staging

```env
APP_URL=https://crmquisquya.pholiodev.com
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueya.pholiodev.com,https://crmquisquya.pholiodev.com
STAGING_CONTENT_IMPORT_ENABLED=false
BOOTSTRAP_ADMIN_ENABLED=false
```

Topology:

```text
https://crmquisquya.pholiodev.com
├── /              CRM
└── /api/v1        Nest API
```

## Production target

When the client approves the final migration, use:

```env
APP_URL=https://app.quisqueyatravel.com.do
VITE_API_URL=/api/v1
CORS_ORIGINS=https://quisqueyatravel.com.do,https://app.quisqueyatravel.com.do
STAGING_CONTENT_IMPORT_ENABLED=false
BOOTSTRAP_ADMIN_ENABLED=false
```

Topology:

```text
https://app.quisqueyatravel.com.do
├── /              CRM
└── /api/v1        Nest API
```

The commercial web will consume:

```text
https://app.quisqueyatravel.com.do/api/v1
```

## Final migration checklist

No CRM or API route code should need to change for the domain migration.

1. Point `app.quisqueyatravel.com.do` to this platform deployment.
2. Replace `APP_URL` and `CORS_ORIGINS` with the production values above.
3. Keep `VITE_API_URL=/api/v1` unchanged.
4. Keep content/admin bootstrap switches disabled unless intentionally performing a one-time operation.
5. Redeploy the platform.
6. Validate `/healthz`, `/api/v1/public/*`, CRM login and authenticated API calls.
7. Then update the commercial web environment to `https://app.quisqueyatravel.com.do/api/v1` and redeploy it.

`api.quisqueyatravel.com.do` is reserved for a future independent API deployment if the architecture later requires separate scaling or infrastructure. It is not part of the current production target.
