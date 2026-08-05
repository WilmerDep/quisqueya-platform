import 'dotenv/config';

const errors = [];
const warnings = [];

const text = (name) => String(process.env[name] || '').trim();
const requireValue = (name) => {
  const value = text(name);
  if (!value) errors.push(`${name} is required.`);
  return value;
};

const nodeEnv = requireValue('NODE_ENV');
const port = requireValue('PORT');
const appUrl = requireValue('APP_URL');
const corsOrigins = requireValue('CORS_ORIGINS');
const mysqlHost = requireValue('MYSQL_HOST');
const mysqlPort = requireValue('MYSQL_PORT');
const mysqlUser = requireValue('MYSQL_USER');
const mysqlPassword = requireValue('MYSQL_PASSWORD');
const mysqlDatabase = requireValue('MYSQL_DATABASE');
const databaseUrl = requireValue('DATABASE_URL');
const accessSecret = requireValue('JWT_ACCESS_SECRET');
const refreshSecret = requireValue('JWT_REFRESH_SECRET');

if (nodeEnv && nodeEnv !== 'production') {
  errors.push('NODE_ENV must be production.');
}

if (port && (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
  errors.push('PORT must be a valid TCP port.');
}

for (const [name, value] of [['APP_URL', appUrl]]) {
  if (value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') errors.push(`${name} must use https in production.`);
    } catch {
      errors.push(`${name} must be a valid absolute URL.`);
    }
  }
}

const origins = corsOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!origins.length) errors.push('CORS_ORIGINS must contain at least one origin.');
for (const origin of origins) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') errors.push(`CORS origin must use https: ${origin}`);
    if (url.pathname !== '/' || url.search || url.hash) {
      errors.push(`CORS origin must not include a path, query, or hash: ${origin}`);
    }
  } catch {
    errors.push(`Invalid CORS origin: ${origin}`);
  }
}

if (mysqlPort && (!Number.isInteger(Number(mysqlPort)) || Number(mysqlPort) < 1 || Number(mysqlPort) > 65535)) {
  errors.push('MYSQL_PORT must be a valid TCP port.');
}

const placeholderPattern = /change[-_ ]?me|change[-_ ]?this|example|password|secret/i;
for (const [name, value] of [
  ['MYSQL_PASSWORD', mysqlPassword],
  ['JWT_ACCESS_SECRET', accessSecret],
  ['JWT_REFRESH_SECRET', refreshSecret],
]) {
  if (value && placeholderPattern.test(value)) {
    errors.push(`${name} still appears to contain a placeholder value.`);
  }
}

if (accessSecret && accessSecret.length < 32) errors.push('JWT_ACCESS_SECRET must be at least 32 characters.');
if (refreshSecret && refreshSecret.length < 32) errors.push('JWT_REFRESH_SECRET must be at least 32 characters.');
if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
  errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
}

if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
      errors.push('DATABASE_URL must use mysql:// or mariadb://.');
    }
    if (mysqlHost && url.hostname !== mysqlHost) warnings.push('DATABASE_URL host differs from MYSQL_HOST.');
    if (mysqlUser && decodeURIComponent(url.username) !== mysqlUser) warnings.push('DATABASE_URL user differs from MYSQL_USER.');
    if (mysqlDatabase && url.pathname.replace(/^\//, '') !== mysqlDatabase) warnings.push('DATABASE_URL database differs from MYSQL_DATABASE.');
  } catch {
    errors.push('DATABASE_URL must be a valid connection URL.');
  }
}

const report = {
  ready: errors.length === 0,
  environment: nodeEnv || null,
  port: port ? Number(port) : null,
  appUrl: appUrl || null,
  corsOrigins: origins,
  database: {
    host: mysqlHost || null,
    port: mysqlPort ? Number(mysqlPort) : null,
    user: mysqlUser || null,
    name: mysqlDatabase || null,
  },
  errors,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
