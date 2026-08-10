import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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

const tourficMetadataPath = process.env.TOURFIC_METADATA_PATH || 'data/content/wordpress-tourfic-authenticated-metadata.json';
const authenticatedFeaturedMediaPath = 'data/wordpress/authenticated/tour-featured-media.json';

const steps = [
  { args: ['scripts/import-wordpress-content.mjs'], required: true },
  { args: ['scripts/link-wordpress-featured-media.mjs'], required: true },
  {
    args: ['scripts/import-authenticated-wordpress-media.mjs'],
    required: false,
    sourceFiles: [authenticatedFeaturedMediaPath],
    label: 'authenticated WordPress featured-media evidence',
  },
  { args: ['scripts/canonicalize-wordpress-destination-slugs.mjs'], required: true },
  { args: ['scripts/import-wordpress-destination-editorials.mjs'], required: true },
  { args: ['scripts/repair-destination-editorial-preamble.mjs'], required: true },
  { args: ['scripts/canonicalize-wordpress-experience-slugs.mjs'], required: true },
  {
    args: ['scripts/import-tourfic-authenticated-metadata.mjs'],
    required: false,
    sourceFiles: [tourficMetadataPath],
    label: 'authenticated Tourfic metadata',
  },
  {
    args: ['scripts/import-tourfic-gallery-media.mjs'],
    required: false,
    sourceFiles: [tourficMetadataPath],
    label: 'Tourfic gallery metadata',
  },
  { args: ['scripts/normalize-experience-editorial-baseline.mjs'], required: true },
  { args: ['scripts/seed-dmc-services.mjs', '--force'], required: true },
];

function runStep(args) {
  return new Promise((resolveStep, rejectStep) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        WP_BASE_URL: wpBaseUrl,
      },
    });

    child.on('error', rejectStep);
    child.on('exit', code => {
      if (code === 0) {
        resolveStep();
        return;
      }
      rejectStep(new Error(`${args.join(' ')} exited with code ${code}`));
    });
  });
}

function missingSourceFiles(step) {
  return (step.sourceFiles || []).filter(file => !existsSync(resolve(process.cwd(), file)));
}

console.log(`Staging content bootstrap enabled. Import source: ${wpBaseUrl}`);

for (const step of steps) {
  const missing = missingSourceFiles(step);
  if (missing.length) {
    if (step.required) {
      throw new Error(`Required staging content source file(s) missing: ${missing.join(', ')}`);
    }

    console.warn(`Skipping optional ${step.label || step.args[0]} because source file(s) are not present: ${missing.join(', ')}`);
    continue;
  }

  console.log(`\n▶ ${process.execPath} ${step.args.join(' ')}`);
  await runStep(step.args);
}

console.log('\nStaging content bootstrap completed successfully.');
console.log('Set STAGING_CONTENT_IMPORT_ENABLED=false after validating the public content endpoints.');
