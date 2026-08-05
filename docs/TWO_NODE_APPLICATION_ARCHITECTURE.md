# Quisqueya Travels — Two Node Application Architecture

## Decision

Quisqueya Travels will use two Node.js applications in hosting:

1. `quisqueya-web`
   - Next.js commercial website.
   - Provisional domain: `https://quisqueya.pholiodev.com`.
   - Official domain: `https://quisqueyatravel.com.do`.

2. `quisqueya-platform`
   - NestJS public/private API.
   - Serves the compiled CRM as static files from the same Node process when the CRM is ready.
   - Provisional API domain: `https://apiquisqueya.pholiodev.com`.
   - Provisional CRM domain: `https://crmquisquya.pholiodev.com`.
   - Official API domain: `https://api.quisqueyatravel.com.do`.
   - Official CRM domain: `https://app.quisqueyatravel.com.do`.

## Hosting consumption

The provisional and official domains are aliases or reverse proxies to the same applications. They must not create additional Node.js applications.

Expected Node application consumption:

- Existing hosting applications: 3.
- Quisqueya web: 1.
- Quisqueya platform API + static CRM: 1.
- Total after deployment: 5 of 10.
- Remaining capacity: 5 applications.

## CRM delivery

The CRM frontend must be compiled as a static SPA using the existing Vite build. Its build output will be copied or deployed inside the platform static directory. NestJS or the hosting web server will serve that output for the CRM hostname.

The CRM must not start a separate Vite or Node development server in production.

## Routing

The reverse proxy or hosting panel should route:

- Web hostname(s) to the Next.js application.
- API hostname(s) to NestJS API routes.
- CRM hostname(s) to the static CRM build served by the platform application or directly by the web server.

API routes keep the `/api/v1` prefix. The CRM hostname must fall back to `index.html` for client-side routes.

## Production command policy

`npm run build:production` and `npm run deploy:prepare` are server commands. They intentionally fail in a development environment because they require:

- `NODE_ENV=production`.
- HTTPS production/staging URLs.
- Real CORS origins.
- A production database account and password.
- Strong JWT access and refresh secrets.

For local development use:

```bash
npm run build:server
npm run dev:server
```

Do not modify the local development `.env` merely to force the production preflight to pass.

## Domain transition

During cutover, provisional and official domains may coexist in CORS and proxy configuration. Both sets of domains must point to the same two applications. Once validation is complete, remove the provisional domains without rebuilding the data model or duplicating the applications.
