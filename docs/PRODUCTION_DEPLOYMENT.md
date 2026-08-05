# Quisqueya Platform — Production Deployment

## Target architecture

- API domain: `https://api.quisqueyatravel.com.do`
- Internal API listener: `127.0.0.1:3000`
- Public API prefix: `/api/v1`
- Health check: `/healthz`
- Process manager: PM2
- Reverse proxy and TLS termination: Nginx
- Database: MySQL/MariaDB

## 1. Server prerequisites

Install Node.js compatible with the project, npm, Git, MySQL or MariaDB, Nginx, Certbot and PM2.

```bash
npm install --global pm2
```

Create a dedicated deployment directory and clone the repository.

```bash
sudo mkdir -p /var/www/quisqueya-platform
sudo chown -R $USER:$USER /var/www/quisqueya-platform
git clone https://github.com/WilmerDep/quisqueya-platform.git /var/www/quisqueya-platform
cd /var/www/quisqueya-platform
```

## 2. Production environment

Copy the production template without committing the real file.

```bash
cp .env.production.example .env
```

Replace every placeholder with real values. Generate two different random JWT secrets with at least 32 characters each.

The production application URL must be:

```text
https://api.quisqueyatravel.com.do
```

The expected CORS origins are:

```text
https://quisqueyatravel.com.do
https://www.quisqueyatravel.com.do
https://app.quisqueyatravel.com.do
```

## 3. Database

Create the database and a restricted application user. Do not use the MySQL root account in production.

Example only:

```sql
CREATE DATABASE quisqueya_core CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'quisqueya_user'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON quisqueya_core.* TO 'quisqueya_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Ensure `DATABASE_URL` and the individual `MYSQL_*` variables describe the same connection.

## 4. Install and prepare the release

```bash
npm ci
npm run deploy:prepare
```

`deploy:prepare` performs, in order:

1. production environment validation;
2. Prisma migration deployment;
3. Prisma schema validation and client generation;
4. NestJS server build.

A failed step must stop the release.

## 5. Initial content population

Run imports only for the initial deployment or when intentionally refreshing migrated source data.

```bash
npm run import:wordpress
npm run seed:dmc-services -- --force
npm run migrate:dmc-transport-media
npm run import:reviews
```

Afterward, verify the stored content:

```bash
npm run audit:experiences
npm run audit:dmc-services
```

Do not rerun destructive or forced imports during a routine code deployment without first backing up the database.

## 6. Start with PM2

Create the log directory and start the process definition.

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`, then execute `pm2 save` again.

Useful checks:

```bash
pm2 status
pm2 logs quisqueya-platform-api
pm2 restart quisqueya-platform-api --update-env
```

## 7. Nginx and TLS

Copy the provided template:

```bash
sudo cp deploy/nginx/api.quisqueyatravel.com.do.conf /etc/nginx/sites-available/api.quisqueyatravel.com.do.conf
sudo ln -s /etc/nginx/sites-available/api.quisqueyatravel.com.do.conf /etc/nginx/sites-enabled/api.quisqueyatravel.com.do.conf
```

Before enabling the HTTPS server block, obtain the certificate with Certbot according to the server's current Nginx setup. Then validate and reload Nginx.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Post-deployment validation

Validate the API locally on the server:

```bash
curl --fail http://127.0.0.1:3000/healthz
```

Validate it through the public domain:

```bash
curl --fail https://api.quisqueyatravel.com.do/healthz
QUISQUEYA_API_URL=https://api.quisqueyatravel.com.do/api/v1 npm run verify:public-api
```

Then configure the public web with:

```text
QUISQUEYA_API_URL=https://api.quisqueyatravel.com.do/api/v1
NEXT_PUBLIC_QUISQUEYA_API_URL=https://api.quisqueyatravel.com.do/api/v1
```

Rebuild or redeploy `quisqueya-web`, then run its integration verifier against the production domains.

## 9. Routine release procedure

```bash
cd /var/www/quisqueya-platform
git pull origin main
npm ci
npm run deploy:prepare
pm2 restart quisqueya-platform-api --update-env
curl --fail https://api.quisqueyatravel.com.do/healthz
QUISQUEYA_API_URL=https://api.quisqueyatravel.com.do/api/v1 npm run verify:public-api
```

## 10. Rollback baseline

Before every release:

1. record the current Git commit;
2. create a database backup;
3. keep the previous `server-dist` until the health check passes.

Code rollback example:

```bash
git checkout <previous-known-good-commit>
npm ci
npm run build:production
pm2 restart quisqueya-platform-api --update-env
```

Database rollback must use the pre-release backup. Prisma migration rollback is not automatic and must not be improvised on production data.
