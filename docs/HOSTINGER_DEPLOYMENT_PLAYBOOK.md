# Hostinger Deployment Playbook — Quisqueya Platform

## Purpose

This document captures the deployment lessons learned while publishing the Quisqueya Platform stack on Hostinger. It is intended to be reused as a deployment standard for future CRM, CMS, API and hybrid Node.js projects.

It deliberately excludes real passwords, JWT secrets and other credentials. Secrets must live only in environment variables or a secrets manager.

---

## 1. Target architecture

Current staging architecture:

- Commercial web: separate Next.js application.
- CRM + API: single hybrid Node.js application.
- CRM frontend: Vite + React.
- API/runtime: NestJS.
- Database: MariaDB/MySQL.
- ORM/migrations: Prisma.
- Hosting: Hostinger managed Node.js application.

Recommended staging pattern when CRM and API share one host:

```text
https://crm.example.com/           -> CRM frontend
https://crm.example.com/api/v1/... -> API
https://crm.example.com/healthz    -> health check
```

Recommended production pattern when the architecture is later separated:

```text
https://app.example.com/ -> CRM
https://api.example.com/ -> API
```

The frontend must use environment variables so that this migration requires URL changes instead of presentation rewrites.

---

## 2. Deployment configuration that worked

Hostinger build configuration for the hybrid CRM/API application:

```text
Framework preset: NestJS
Branch: main
Node: 22.x
Root directory: ./
Build command: npm run deploy:prepare
Package manager: npm
Output directory: server-dist
Entry file: main.js
```

The final runtime artifact must contain both NestJS and the packaged CRM:

```text
server-dist/
├── main.js
├── ...compiled Nest files
└── dist/
    ├── index.html
    └── assets/
```

Nest must serve the static CRM from the packaged directory inside the server artifact rather than assuming that `dist/` remains available as a sibling folder in Hostinger's runtime filesystem.

---

## 3. Build pipeline

The deployment pipeline should validate infrastructure in layers:

```text
production env verification
    ↓
Prisma migration deploy
    ↓
Prisma validate/generate
    ↓
staging admin bootstrap when explicitly enabled
    ↓
Vite CRM build
    ↓
CRM static build verification
    ↓
NestJS server build
    ↓
package CRM static assets into server artifact
```

Current command:

```bash
npm run deploy:prepare
```

Do not remove migration or verification steps merely to make a build turn green unless the migration is intentionally moved to a separate verified deployment stage.

---

## 4. MySQL/MariaDB: localhost vs 127.0.0.1

### Symptom

Prisma returned P1000 authentication failures even though the username, password, database and grants appeared correct.

Manual SSH test using:

```bash
mysql -h localhost -P 3306 -u USER -p DATABASE
```

failed with a message similar to:

```text
Access denied for user 'USER'@'::1'
```

This revealed that `localhost` resolved to IPv6 loopback `::1`.

### Working test

```bash
mysql -h 127.0.0.1 -P 3306 -u USER -p DATABASE
```

connected successfully.

### Rule

On Hostinger, verify the real database connection from SSH before blaming Prisma or application code.

For this environment use:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
```

and the equivalent Prisma connection string:

```env
DATABASE_URL=mysql://USER:PASSWORD@127.0.0.1:3306/DATABASE
```

Keep `DATABASE_URL` and the individual `MYSQL_*` variables synchronized.

Important: URL-encode reserved characters if they are ever used inside a connection URL.

---

## 5. Prisma and runtime database configuration

Two connection paths exist and both must be understood:

- Prisma CLI/migrations use `DATABASE_URL`.
- Nest runtime uses `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` through the MariaDB adapter.

A successful environment readiness script does not prove that the database credentials authenticate. It can validate presence and structure, while the real connection still fails.

Always validate in this order:

```text
SSH mysql connection
→ prisma migrate deploy
→ Nest runtime database access
```

---

## 6. DevDependencies during a production build

### Symptom

The deployment reached the Vite step and failed with:

```text
vite: command not found
```

### Cause

`NODE_ENV=production` may cause npm to omit development dependencies. Vite, TypeScript and build plugins are commonly stored in `devDependencies`.

### Staging/Hostinger solution

Keep:

```env
NODE_ENV=production
```

and make build dependencies available:

```env
NPM_CONFIG_INCLUDE=dev
```

Do not move every build tool into runtime `dependencies` solely to work around a hosting install mode unless there is a deliberate packaging reason.

---

## 7. Every build import must be declared

### Symptom

Vite existed but build failed with:

```text
Cannot find package '@vitejs/plugin-react'
```

### Cause

`vite.config.ts` imported the plugin but `package.json` did not declare it explicitly.

### Rule

Anything imported by build configuration must be listed in `package.json`, even if it happens to exist transitively or appears in a lockfile.

Before deployment verify at minimum:

```bash
npm ls vite
npm ls @vitejs/plugin-react
```

and equivalent checks for other build-time plugins.

---

## 8. Hybrid NestJS + Vite packaging

### Symptom

The API and `/healthz` worked but `/` returned an ENOENT for `dist/index.html`.

### Cause

Hostinger published only the configured output directory. Vite had generated `dist/` outside that output, so the runtime server could not see the CRM files.

### Rule

For managed Node hosting, never assume the complete repository layout survives into runtime.

Package the static frontend into the server artifact before deployment.

The application should be deployable from one self-contained output directory.

---

## 9. Same-origin CRM/API configuration

When CRM and API share the same domain, prefer a relative API base:

```env
VITE_API_URL=/api/v1
```

instead of:

```env
VITE_API_URL=https://crm.example.com/api/v1
```

Benefits:

- avoids unnecessary cross-origin handling;
- reduces preflight/CORS complexity;
- makes staging cleaner;
- keeps the frontend portable;
- the same build can later switch to a dedicated API origin through environment variables.

For production separation, change only the environment variable:

```env
VITE_API_URL=https://api.example.com/api/v1
```

---

## 10. CORS and OPTIONS: debug with Network, not guesses

### Symptom

The login UI reported invalid credentials even though the username and password were correct.

### Network evidence

DevTools showed:

```text
OPTIONS /api/v1/auth/login
404 Not Found
```

The browser therefore never completed the intended login POST.

### Lesson

A UI message saying "invalid credentials" does not prove a password problem.

Always inspect:

```text
Network
→ Request URL
→ Request Method
→ Status Code
→ Payload
→ Response
```

A failed preflight can prevent the actual request from reaching NestJS.

When same-origin deployment is available, prefer the relative API base described above.

Nest still maintains explicit CORS configuration for environments where web, app and API run on different origins.

---

## 11. GET vs POST endpoint testing

Typing this in a browser:

```text
/api/v1/auth/login
```

executes a GET request.

If the controller defines only POST, this response is normal:

```text
Cannot GET /api/v1/auth/login
```

Do not use browser address-bar navigation to determine whether a POST endpoint works.

Use DevTools Network, curl, PowerShell `Invoke-RestMethod`, Postman or another API client.

---

## 12. Public API returning `{ data: [] }`

A response such as:

```json
{
  "data": []
}
```

is not automatically an API failure.

It can mean:

- Nest is running;
- routing works;
- the controller exists;
- Prisma query succeeded;
- the staging tables simply contain zero matching records.

This happened with public content endpoints after migrations created the schema but before editorial/media data was imported.

Therefore separate these concepts:

```text
schema/migrations ready ≠ content database populated
```

After infrastructure deployment, run the appropriate controlled import/seed process and validate record counts.

---

## 13. Staging admin bootstrap

A bootstrap administrator is useful for initial staging access, but it must remain explicit and temporary.

Recommended variables:

```env
BOOTSTRAP_ADMIN_ENABLED=true|false
BOOTSTRAP_ADMIN_USERNAME=...
BOOTSTRAP_ADMIN_EMAIL=...
BOOTSTRAP_ADMIN_NAME=...
BOOTSTRAP_ADMIN_PASSWORD=...
```

Rules:

1. Never commit the password.
2. Use bootstrap only for controlled initialization/recovery.
3. If the script is intended to refresh credentials, make this behavior explicit and auditable.
4. After access is confirmed:

```env
BOOTSTRAP_ADMIN_ENABLED=false
```

5. Remove `BOOTSTRAP_ADMIN_PASSWORD` from the deployment environment when it is no longer needed.
6. Production authentication should evolve toward invitations, password reset flows, email verification and MFA/2FA rather than permanent bootstrap credentials.

---

## 14. Security rules

Never commit or document real values for:

- database passwords;
- `DATABASE_URL` with credentials;
- JWT access secrets;
- JWT refresh secrets;
- bootstrap passwords;
- API keys;
- SMTP credentials;
- payment credentials.

If a secret appears in screenshots, logs, tickets or chat during setup, rotate it before treating the environment as final.

Staging should remain non-indexable until explicitly approved.

---

## 15. Correct troubleshooting order

For future deployments, diagnose from the bottom layer upward:

```text
1. DNS / domain / SSL
2. Hostinger Node application starts
3. /healthz
4. Database authentication via SSH
5. Prisma migrations
6. Nest runtime database connection
7. Public API endpoints
8. Static CRM artifact
9. Frontend API base URL
10. OPTIONS/CORS if origins differ
11. Auth POST request
12. JWT/session refresh
13. Editorial data import
14. Media relations
15. Commercial web consumption
```

Do not simultaneously change database credentials, build output, CORS, API URLs and auth logic. Change one layer at a time and verify it before moving upward.

---

## 16. Fast diagnostic matrix

### `P1000 Authentication failed`

Check:

```text
MYSQL_HOST
MYSQL_USER
MYSQL_PASSWORD
MYSQL_DATABASE
DATABASE_URL
```

Then test with SSH and force `127.0.0.1` before modifying Prisma code.

### `vite: command not found`

Check whether production installation omitted devDependencies.

### `Cannot find package @vitejs/plugin-react`

Check `package.json`, not only `package-lock.json`.

### API health works but CRM `/` fails

Check whether Vite output is included inside the deployed server artifact.

### Public endpoint returns `data: []`

Check staging record counts/content import before changing API code.

### Login UI says credentials invalid

Check DevTools Network before changing the password.

### `OPTIONS ... 404`

The POST may never have reached the backend. Check same-origin API configuration, proxy behavior and CORS/preflight routing.

### `Cannot GET /auth/login`

Confirm whether the endpoint is POST-only before treating it as broken.

---

## 17. Pre-deployment checklist for future CRM/CMS/API projects

Before the first Hostinger deployment confirm:

- [ ] Node version supported by the project.
- [ ] Build command tested locally.
- [ ] Output directory is self-contained.
- [ ] Entry file exists inside the output directory.
- [ ] Every Vite/TypeScript/build plugin is declared in `package.json`.
- [ ] DevDependencies are available during production build when required.
- [ ] `DATABASE_URL` is production-safe and URL-encoded when needed.
- [ ] `MYSQL_HOST` has been tested from the hosting environment.
- [ ] Prisma migrations are committed.
- [ ] `prisma migrate deploy` is part of a controlled deployment stage.
- [ ] `/healthz` exists.
- [ ] API global prefix is documented.
- [ ] Same-origin versus cross-origin topology is decided before configuring CORS.
- [ ] CRM API URL comes from environment variables.
- [ ] Static frontend is packaged into the deploy artifact if sharing the Node application.
- [ ] Staging admin bootstrap is explicit and temporary.
- [ ] No secrets exist in the repository.
- [ ] Staging is noindex.
- [ ] Empty content database is distinguished from broken API.
- [ ] DevTools Network is part of auth QA.

---

## 18. Core principle

The main lesson from this deployment is:

> Verify infrastructure one layer at a time and make the deployment artifact self-contained.

A green build is not the same as a healthy runtime. A healthy runtime is not the same as a populated database. A responding API is not the same as a successful browser request. A login error message is not necessarily an authentication error.

Each layer must be proven independently.

This playbook should be updated whenever a new hosting-specific issue is discovered so future Quisqueya deployments — and future CRM/CMS/API projects — start from the accumulated operational knowledge rather than rediscovering the same problems.
