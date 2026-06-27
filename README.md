# PrestaFacil RD

React/Vite app for loan management, collections routes, cash control, reports, and SaaS administration for Dominican lenders.

## Local Development

```bash
npm install
npm run dev
```

Demo credentials:

- Admin: `admin` / `admin123`
- Master: `master` / `master123`
- Users created from Equipo receive temporary password `Temp12345` until password reset is connected to the backend.

## Quality Gates

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Production Notes

This repository now has local Tailwind/Vite integration, Vitest unit tests, Playwright smoke tests, a NestJS API, MySQL persistence, expiring sessions, password hash verification, and security audit logging. The web app uses the API for the main operating flows and keeps `services/dataService.ts` as a local demo/fallback adapter. The backend contract and production checklist are documented in `services/apiContract.ts`, `docs/system-architecture.md`, and `docs/production-readiness.md`.
