# Provisional-to-official domain transition

The provisional deployment must use the same production architecture as the final deployment. Only environment-specific hostnames change.

## Provisional stage

Configure the API environment with:

- `APP_URL=https://<provisional-api-domain>`
- `CORS_ORIGINS=https://<provisional-web-domain>`
- production MySQL credentials
- unique production-grade JWT secrets

Configure `quisqueya-web` with:

- `QUISQUEYA_API_URL=https://<provisional-api-domain>/api/v1`
- `NEXT_PUBLIC_QUISQUEYA_API_URL=https://<provisional-api-domain>/api/v1` only when browser-side access is required

Configure the reverse proxy and TLS certificate for the provisional API hostname. Do not hardcode the provisional hostname in application source files.

## Cutover to official domains

When the official domains are ready, change only:

1. API DNS and TLS certificate.
2. Nginx `server_name`.
3. Platform `APP_URL`.
4. Platform `CORS_ORIGINS`.
5. Web `QUISQUEYA_API_URL` and, when used, `NEXT_PUBLIC_QUISQUEYA_API_URL`.
6. Restart PM2 and rebuild/restart the Next.js web process.
7. Run the public API and web integration verification commands.

The database schema, Prisma migrations, API routes, PM2 process definition, and application code remain unchanged.

## Recommended temporary overlap

During cutover, `CORS_ORIGINS` may temporarily include both provisional and official web origins, separated by commas. Remove the provisional origin after validation and DNS propagation are complete.

Example:

```env
CORS_ORIGINS=https://provisional.example.com,https://quisqueyatravel.com.do,https://www.quisqueyatravel.com.do
```

Do not keep provisional origins indefinitely.

## Verification after each stage

Platform:

```bash
npm run verify:production
npm run prisma:migrate:deploy
npm run build:production
npm run verify:public-api
```

Web:

```bash
npm run build
npm run verify:content-integration
```

Use the real deployed base URLs through the corresponding environment variables before running the verification commands.
