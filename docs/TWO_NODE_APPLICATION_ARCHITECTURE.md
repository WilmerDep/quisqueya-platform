# Quisqueya Travels — Two Node Application Architecture

Updated: 2026-10-03

## Decision

Quisqueya Travels uses two Node.js applications in hosting:

1. `quisqueya-web`
   - Next.js commercial website.
   - Staging: `https://quisqueya.pholiodev.com`.
   - Production: `https://quisqueyatravel.com.do`.

2. `quisqueya-platform`
   - NestJS public/private API.
   - Serves the compiled Vite/React CRM from the same Node application.
   - Staging: `https://crmquisqueya.pholiodev.com`.
   - Production: `https://app.quisqueyatravel.com.do`.
   - API remains under the stable `/api/v1` prefix on that same host.

A dedicated `api.quisqueyatravel.com.do` application is not required by the current Hostinger strategy. It remains a future option only if the API later needs independent scaling or infrastructure.

## Hosting consumption

The staging and official domains map to the same two application roles; domain aliases or cutover DNS must not create duplicate application stacks.

Expected Quisqueya consumption:

- commercial web: 1 Node application;
- platform CRM + API: 1 Node application.

## CRM delivery

The CRM frontend is compiled as a static SPA using the existing Vite build and packaged into the NestJS runtime artifact.

The CRM must not start a separate Vite or Node development server in staging/production.

## Routing

Staging:

```text
https://quisqueya.pholiodev.com                  -> Next.js commercial web
https://crmquisqueya.pholiodev.com/              -> CRM
https://crmquisqueya.pholiodev.com/api/v1/*      -> Nest API
```

Production:

```text
https://quisqueyatravel.com.do                    -> Next.js commercial web
https://app.quisqueyatravel.com.do/               -> CRM
https://app.quisqueyatravel.com.do/api/v1/*       -> Nest API
```

The CRM uses `VITE_API_URL=/api/v1`; the commercial web uses an absolute `QUISQUEYA_API_URL` because it is a separate application/origin.

## Media storage

Google Drive is the temporary storage provider behind the provider-agnostic MediaAsset layer. Public media is delivered through the platform API, so `APP_URL` must match the active platform hostname.

The full CRM media-management UI belongs to a later phase. The current phase only requires the functional storage/API path and correct visible consumption by the commercial web.

## Domain transition

The staging and production architectures are intentionally identical. Cutover changes DNS/TLS plus environment values such as:

- platform `APP_URL`, `APP_ENV`, `CORS_ORIGINS`, `GOOGLE_DRIVE_REDIRECT_URI`;
- web `QUISQUEYA_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_INDEXABLE`.

`VITE_API_URL=/api/v1`, database models, API routes and content relationships remain unchanged.

Before removing staging, validate public content, provider-managed media, CRM auth and the approved experience singles on the official domains.
