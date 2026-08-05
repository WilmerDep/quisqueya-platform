import { access, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const indexPath = join(distDir, 'index.html');
const assetsDir = join(distDir, 'assets');

const errors = [];

try {
  await access(indexPath);
} catch {
  errors.push('dist/index.html is missing. Run npm run build:web first.');
}

try {
  const entries = await readdir(assetsDir);
  const files = [];

  for (const entry of entries) {
    const entryPath = join(assetsDir, entry);
    const metadata = await stat(entryPath);
    if (metadata.isFile()) files.push(entry);
  }

  if (!files.some((file) => /\.js$/i.test(file))) {
    errors.push('dist/assets does not contain a JavaScript bundle.');
  }

  if (!files.some((file) => /\.css$/i.test(file))) {
    errors.push('dist/assets does not contain a CSS bundle.');
  }
} catch {
  errors.push('dist/assets is missing or unreadable.');
}

const result = {
  ready: errors.length === 0,
  distDir,
  errors,
};

console.log(JSON.stringify(result, null, 2));

if (errors.length) process.exitCode = 1;
