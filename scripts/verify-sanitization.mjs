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
      "./pages/LandingPage",
      "./pages/AuthPage",
      "./pages/UsersManagement",
      "./pages/ConfigurationPage",
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
    required: ['./components/PlatformShell', './pages/PlatformAccessPage', './pages/PlatformUsersPage', './pages/PlatformSettingsPage'],
    reason: 'the active router must use neutral Quisqueya shell/access/users/settings surfaces and keep inherited lending/demo routes quarantined',
  },
  {
    file: 'components/PlatformShell.tsx',
    forbidden: [
      'services/dataService',
      'Prestamo',
      'Préstamo',
      'Cobrar Hoy',
      'Cobrador',
      'loanops_shell_scope',
      'ABUNDRA',
      'getLoans',
    ],
    reason: 'the active platform shell must stay domain-neutral and independent from the inherited lending adapter',
  },
  {
    file: 'pages/PlatformAccessPage.tsx',
    forbidden: [
      'services/dataService',
      'admin123',
      'master123',
      'PrestaFacil',
      'PrestaFácil',
      'handleQuickDemo',
      'createCompany(',
      'getAllUsers(',
      'updateUser(',
    ],
    required: ['useAuth', 'login(username.trim(), password)'],
    reason: 'active access must authenticate through the API only and must not retain local demo/bootstrap authority',
  },
  {
    file: 'pages/PlatformUsersPage.tsx',
    forbidden: [
      'services/dataService',
      'localStorage',
      'prestard_',
      'PrestaFacil',
      'PrestaFácil',
      'admin123',
      'master123',
      'getScopedUsers',
      'upsertUsersInLocalStorage',
      'createUser(',
    ],
    required: ['teamService.list()', 'teamService.updateStatus'],
    reason: 'the active users surface must use the API-only team boundary and must not fall back to inherited local storage',
  },
  {
    file: 'services/teamService.ts',
    forbidden: ['services/dataService', 'localStorage', 'prestard_'],
    required: ['apiClient.listUsers()', 'apiClient.listBranches()', 'apiClient.updateUser'],
    reason: 'the team service must remain an API-only identity/organization boundary',
  },
  {
    file: 'pages/PlatformSettingsPage.tsx',
    forbidden: [
      'services/dataService',
      'localStorage',
      'prestard_',
      'PrestaFacil',
      'PrestaFácil',
      'mora',
      'prestamo',
      'préstamo',
      'WhatsApp',
    ],
    required: ['organizationService.load()', 'organizationService.updateCompany'],
    reason: 'the active settings surface must be organization-focused, API-only and independent from inherited lending configuration',
  },
  {
    file: 'services/organizationService.ts',
    forbidden: ['services/dataService', 'localStorage', 'prestard_'],
    required: ['apiClient.getMyCompany()', 'apiClient.listBranches()', 'apiClient.updateMyCompany'],
    reason: 'the organization service must remain an API-only company/branch boundary',
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
  'docs/DATA_SERVICE_DECOMPOSITION_PLAN.md',
  'docs/CONTENT_BRIDGE_READINESS.md',
  'components/PlatformShell.tsx',
  'pages/PlatformAccessPage.tsx',
  'pages/PlatformUsersPage.tsx',
  'pages/PlatformSettingsPage.tsx',
  'services/teamService.ts',
  'services/organizationService.ts',
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
