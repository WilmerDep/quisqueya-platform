import 'dotenv/config';
import { spawn } from 'node:child_process';

const enabled = String(process.env.STAGING_CONTENT_IMPORT_ENABLED || '').toLowerCase() === 'true';

if (!enabled) {
  console.log('Staging content bootstrap disabled; skipping.');
  process.exit(0);
}

const wpBaseUrl = String(process.env.WP_BASE_URL || '').trim().replace(/\/$/, '');
if (!wpBaseUrl) {
  throw new Error('WP_BASE_URL is required when STAGING_CONTENT_IMPORT_ENABLED=true.');
}

const steps = [
  ['scripts/import-wordpress-content.mjs'],
  ['scripts/link-wordpress-featured-media.mjs'],
  ['scripts/import-authenticated-wordpress-media.mjs'],
  ['scripts/canonicalize-wordpress-destination-slugs.mjs'],
  ['scripts/import-wordpress-destination-editorials.mjs'],
  ['scripts/repair-destination-editorial-preamble.mjs'],
  ['scripts/canonicalize-wordpress-experience-slugs.mjs'],
  ['scripts/import-tourfic-authenticated-metadata.mjs'],
  ['scripts/import-tourfic-gallery-media.mjs'],
  ['scripts/normalize-experience-editorial-baseline.mjs'],
  ['scripts/seed-dmc-services.mjs', '--force'],
];

function runStep(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        WP_BASE_URL: wpBaseUrl,
      },
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${args.join(' ')} exited with code ${code}`));
    });
  });
}

console.log(`Staging content bootstrap enabled. Import source: ${wpBaseUrl}`);

for (const args of steps) {
  console.log(`\n▶ ${process.execPath} ${args.join(' ')}`);
  await runStep(args);
}

console.log('\nStaging content bootstrap completed successfully.');
console.log('Set STAGING_CONTENT_IMPORT_ENABLED=false after validating the public content endpoints.');
