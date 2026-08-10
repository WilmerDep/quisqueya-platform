import { access, cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const sourceDir = join(process.cwd(), 'dist');
const targetDir = join(process.cwd(), 'server-dist', 'dist');

await access(join(sourceDir, 'index.html'));
await mkdir(join(process.cwd(), 'server-dist'), { recursive: true });
await rm(targetDir, { recursive: true, force: true });
await cp(sourceDir, targetDir, { recursive: true });

console.log(`CRM static build packaged at ${targetDir}`);
