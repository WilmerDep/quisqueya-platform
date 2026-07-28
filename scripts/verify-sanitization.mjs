import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const read = async path => readFile(resolve(root, path), 'utf8');

const checks = [
  {
    file: 'server/src/app.module.ts',
    forbidden: ['LoansModule', 'PaymentsModule', 'CashModule', 'RoutesModule'],
    reason: 'lending-only backend modules must remain quarantined from the root runtime',
  },
  {
    file: 'App.tsx',
    forbidden: [
      "./components/Layout",
      "./pages/LoanCreate",
      "./pages/LoansPage",
      "./pages/RoutesPage",
      "./pages/CollectTodayPage",
      "./pages/CashManagement",
      'path="/loans"',
      'path="/routes"',
      'path="/cash"',
      'path="/collect-today"',
    ],
    required: ['./components/PlatformShell'],
    reason: 'the active router must use the neutral Quisqueya shell and keep lending routes quarantined',
  },
  {
    file: 'components/PlatformShell.tsx',
    forbidden: ['Prestamo', 'Préstamo', 'Cobrar Hoy', 'Cobrador', 'loanops_shell_scope', 'ABUNDRA', 'getLoans'],
    reason: 'the active platform shell must stay domain-neutral until the travel/CRM contracts are finalized',
  },
  {
    file: 'server/src/modules/auth/auth.service.ts',
    forbidden: ['prestafacil-', 'createHash(\'sha256\')', 'isLegacySha256Format'],
    reason: 'active API authentication must not retain the PrestaFacil SHA-256 compatibility path',
  },
  {
    file: '.env.example',
    forbidden: ['prestafacil.example.com', 'prestafacil_user', 'MYSQL_DATABASE=prestafacil'],
    reason: 'environment examples must describe Quisqueya Platform only',
  },
];

let failed = false;

for (const check of checks) {
  const source = await read(check.file);
  const matches = check.forbidden.filter(value => source.includes(value));
  const missingRequired = (check.required || []).filter(value => !source.includes(value));

  if (matches.length || missingRequired.length) {
    failed = true;
    console.error(`FAIL ${check.file}: ${check.reason}`);
    for (const match of matches) console.error(`  forbidden: ${match}`);
    for (const value of missingRequired) console.error(`  required: ${value}`);
  } else {
    console.log(`PASS ${check.file}`);
  }
}

const requiredFiles = [
  'docs/QUISQUEYA_MIGRATION_PLAN.md',
  'docs/SANITIZATION_MANIFEST.md',
  'docs/LENDING_DEPENDENCY_INVENTORY.md',
  'docs/FRONTEND_DEPENDENCY_INVENTORY.md',
  'docs/CONTENT_BRIDGE_READINESS.md',
  'components/PlatformShell.tsx',
  'server/src/modules/content/content.module.ts',
  'scripts/import-wordpress-content.mjs',
];

for (const file of requiredFiles) {
  try {
    await read(file);
    console.log(`PASS ${file}`);
  } catch {
    failed = true;
    console.error(`FAIL missing required migration artifact: ${file}`);
  }
}

if (failed) {
  console.error('\nSanitization verification failed.');
  process.exit(1);
}

console.log('\nSanitization verification passed.');
