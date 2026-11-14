# Release gates — security PR #5 and media inventory PR #2

Status: **pre-release review, not deployed**. Last reviewed: 2026-10-14.

## Architecture and deployment constraints

This repository is the **existing** combined NestJS API + React/Vite CRM Node application on Hostinger. The separate `quisqueya-web` repository provides the public Next.js site. There are **two application roles**, not four standalone installations:

| Role | Provisional host | Official domain target |
| --- | --- | --- |
| Web (Next.js) | `quisqueya.pholiodev.com` | `quisqueyatravel.com.do` |
| CRM + API | `crmquisqueya.pholiodev.com` | `app.quisqueyatravel.com.do` |

The eventual domain cutover reuses application roles and changes environment/DNS/TLS; it is **not** part of the current PR rollout. No separate `api.quisqueyatravel.com.do` deployment is required. References: `docs/TWO_NODE_APPLICATION_ARCHITECTURE.md`, `docs/ENVIRONMENT_TOPOLOGY.md`, `docs/HOSTINGER_DEPLOYMENT_PLAYBOOK.md`, and the matching `quisqueya-web/docs/ENVIRONMENT_TOPOLOGY.md`.

**Hostinger platform deployment on `main` is automatic.** Documented configuration: Node 22.x, framework NestJS, build `npm run deploy:prepare`, output `server-dist`, entry `main.js`. The build command **runs `prisma migrate deploy` and invokes bootstrap scripts**. Hence merging is a deployment authorization, not just a source-control action.

## PR #5 — security: local QA evidence

Branch `chore/security-dependencies-20261014`, commits `be81440`, `32d16e6`, `9f76b12`:

- Prisma CLI, client and MariaDB adapter aligned on 7.10.0.
- Runtime `PrismaService` creates an **external pool from direct `mariadb@3.5.4`**, passes it to `PrismaMariaDb(pool)`, sets `prepareCacheLength: 0`, disconnects Prisma and closes the pool on Nest shutdown.
- A narrow type assertion handles incompatibility with adapter-bundled `mariadb@3.4.5` types. No npm overrides.
- Owner's local `npm ci`, `npm run typecheck`, `npm test` (36/36), `npm run build`: PASS. The compiled Nest output includes the new pool and close logic; owner ran the compiled `PrismaService` with a local `SELECT 1 AS ok` and confirmed `PRISMA SERVICE: CORRECTO`, `POOL: CERRADO`. No schema/content mutations during QA.
- Initial npm audit: 31 issues (2 low, 9 moderate, 19 high, 1 critical). After dependency updates: **6 issues (1 moderate, 5 high)**. This is **not a clean security audit**.

### Remaining risk inventory (do not dismiss)

- `@prisma/adapter-mariadb@7.10.0` still **installs** `mariadb@3.4.5` vulnerable to several advisories. The API's normal `PrismaService` pool instead uses patched direct `mariadb@3.5.4`, mitigating that runtime path; it does not remove the nested package. Other scripts may still instantiate the adapter directly (e.g. `scripts/bootstrap-staging-admin.mjs` **when its flag is enabled**). Re-evaluate any other uses before accepting the residual risk.
- `prisma@7.10.0` depends on vulnerable `mysql2@3.15.3` and `@prisma/config` depends on `deepmerge-ts@7.1.5`. This is mainly a tooling/dependency-tree risk in the inspected paths, not proof of zero exposure.
- `npm audit fix --force` offers an incompatible Prisma downgrade to 6.19.3; **do not run it**. Attempted MariaDB override produced `ELSPROBLEMS`; it was reverted.
- No assertion that six alerts are fully addressed; document any time-limited acceptance with owner approval.

## Gate A — before any merge to main (blocking)

- [ ] Owner explicitly approves deployment of the specific PR into Hostinger; both PRs remain Draft until then.
- [ ] Capture the currently deployed, known-good **main commit SHA** and rollback/redeploy method.
- [ ] Create and verify a restore-capable backup **of the actual current MySQL database**. Save access/backup details privately in Hostinger, never in Git or chat.
- [ ] Ensure planned migration set contains **no unexpected migration**. `prisma migrate deploy` is part of Hostinger's build, even if these PRs introduce none.
- [ ] Verify deployment environment controls in Hostinger without sharing secrets:
  - `STAGING_CONTENT_IMPORT_ENABLED=false` to avoid rewriting imported content and galleries;
  - `BOOTSTRAP_ADMIN_ENABLED=false` to avoid resetting an admin account;
  - correct `MYSQL_*` and `DATABASE_URL` pointing to the intended **existing** database;
  - `APP_URL`, Drive OAuth redirect, and `VITE_API_URL=/api/v1` remain unchanged for provisional staging.
- [ ] Capture a read-only baseline: `/healthz`, public experiences/destinations, CRM login, Google Drive connected/root status, and **current** featured/gallery links for already working Altos de Chavón and Haitises + Isla Bacardi.
- [ ] Review and explicitly accept, mitigate or defer the six remaining npm audit alerts.

**Do not:** create duplicate Node apps or databases, run `stage:...`, import WordPress/Tourfic again, rotate OAuth without cause, edit `APP_URL`/DNS, or deploy with `npm audit fix --force`.

## Gate B — PR #5 rollout (only after Gate A)

- [ ] Merge **only** PR #5 into `main` after explicit authorization.
- [ ] Observe automatic Hostinger build, Prisma migration output, and application startup. Stop if bootstrap/import becomes enabled or migration is unexpected.
- [ ] Smoke test on the **provisional CRM/API** host:

  ```powershell
  $api = "https://crmquisqueya.pholiodev.com"
  (Invoke-RestMethod "$api/healthz").data
  $experiences = (Invoke-RestMethod "$api/api/v1/public/experiences").data
  "Public experiences: $($experiences.Count)"
  ```

- [ ] Manually verify CRM login/session, Google Drive integration status and authorized root, existing gallery images streaming through `/api/v1/media/{knownMediaAssetId}/content`, and existing web experience singles.
- [ ] If smoke tests fail, halt PR #2 and restore the known-good release using the **pre-release backup/rollback procedure**. Do not improvise destructive schema rollback.

## Gate C — PR #2 rollout and read-only media export

PR #2 (`feat/media-inventory-reconciliation-20261013`) adds the JWT+roles protected `GET /api/v1/media/inventory` and a CRM **Exportar auditoría** action to traverse `PAGINA WEB/Experiencias`, plus an offline review script. It does not register images or update experience status/relations.

- [ ] Once PR #5 has passed deployment smoke tests, update PR #2 from the latest `main`, check merge diff, then rerun:
  ```bash
  npm ci
  npm run typecheck
  npm test -- server/src/modules/media/media.service.test.ts
  node --test scripts/review-experience-media-audit.test.mjs
  npm run build
  ```
- [ ] With a second explicit release approval and Gate A's backup protections current, merge PR #2 into `main`.
- [ ] Log in to the **existing** CRM as an authorized admin → Configuración → Google Drive → **Exportar auditoría**. Download `quisqueya-media-inventory-YYYY-MM-DD.json`. Keep JSON private: experience editorial data, media identifiers and Drive keys are not for public commit.
- [ ] Confirm `mode=read-only` and `driveAudit.complete=true`; otherwise inspect `driveAudit.issues` and treat the export as incomplete.
- [ ] Run the offline script with the exported JSON:
  ```bash
  node scripts/review-experience-media-audit.mjs ./quisqueya-media-inventory-YYYY-MM-DD.json ./reporte-revision-multimedia.json
  ```
- [ ] Obtain human editorial/visual approval for any `REGISTER_ONLY_IF_APPROVED`, `ADD` or `REPLACE_AFTER_REVIEW`. Preserve valid `PUBLISHED` galleries; leave `DRAFT` drafts.
- [ ] Any later media `PATCH` requires a separate explicit change plan with **old + full new** `galleryMediaIds` snapshots, image evidence, public/preview smoke checks, and rollback.

## Decision log

- Both PRs are **Draft, not merged** at writing.
- No new infrastructure, migrations, DB writes, OAuth reset, published experience change, or official-domain cutover is authorized by this document.
- Local build success does not substitute for Hostinger runtime checks.
