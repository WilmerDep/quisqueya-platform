import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const read = async path => readFile(resolve(root, path), 'utf8');

const checks = [
  {
    file: 'server/src/app.module.ts',
    forbidden: ['LoansModule', 'PaymentsModule', 'CashModule', 'RoutesModule'],
    required: ['ContactsModule'],
    reason: 'lending-only backend modules must remain quarantined while the neutral contacts module stays active',
  },
  {
    file: 'App.tsx',
    forbidden: [
      "./components/Layout",
      "./pages/LandingPage",
      "./pages/AuthPage",
      "./pages/UsersManagement",
      "./pages/ConfigurationPage",
      "./pages/Activity",
      "./pages/Reports",
      "./pages/Dashboard",
      "./pages/Clients",
      "./pages/ClientProfile",
      "./pages/SuperAdminPage",
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
    required: [
      './components/PlatformShell',
      './pages/PlatformAccessPage',
      './pages/PlatformDashboardPage',
      './pages/PlatformUsersPage',
      './pages/PlatformSettingsPage',
      './pages/PlatformActivityPage',
      './pages/PlatformReportsPage',
      './pages/PlatformContactsPage',
      './pages/PlatformContactDetailPage',
      './pages/PlatformAdminPage',
    ],
    reason: 'the active router must use neutral Quisqueya surfaces and keep inherited lending/demo routes quarantined',
  },
  {
    file: 'components/PlatformShell.tsx',
    forbidden: ['services/dataService', 'Prestamo', 'Préstamo', 'Cobrar Hoy', 'Cobrador', 'loanops_shell_scope', 'ABUNDRA', 'getLoans'],
    reason: 'the active platform shell must stay domain-neutral and independent from the inherited lending adapter',
  },
  {
    file: 'pages/PlatformAccessPage.tsx',
    forbidden: ['services/dataService', 'admin123', 'master123', 'PrestaFacil', 'PrestaFácil', 'handleQuickDemo', 'createCompany(', 'getAllUsers(', 'updateUser('],
    required: ['useAuth', 'login(username.trim(), password)'],
    reason: 'active access must authenticate through the API only and must not retain local demo/bootstrap authority',
  },
  {
    file: 'pages/PlatformDashboardPage.tsx',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'LoanStatus', 'CashMovement', 'CollectionRoute', 'creditRating', 'isBlocked', 'mora', 'collectorId'],
    required: ['contactsService.list()', 'teamService.list()', 'auditService.list()'],
    reason: 'the active dashboard must use neutral API-backed CRM and organization boundaries only',
  },
  {
    file: 'pages/PlatformAdminPage.tsx',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'getGlobalConfig', 'getGlobalMetrics', 'getPayments', 'getSaaSPlans', 'saveSaaSPlan'],
    required: ['teamService.list()', 'organizationService.load()', 'auditService.list()'],
    reason: 'the active administration surface must use neutral API-backed organization, identity and audit boundaries',
  },
  {
    file: 'pages/PlatformUsersPage.tsx',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'PrestaFacil', 'PrestaFácil', 'admin123', 'master123', 'getScopedUsers', 'upsertUsersInLocalStorage', 'createUser('],
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
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'PrestaFacil', 'PrestaFácil', 'mora', 'prestamo', 'préstamo', 'WhatsApp'],
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
    file: 'pages/PlatformActivityPage.tsx',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'PrestaFacil', 'PrestaFácil', 'PAGO', 'PROMESA', 'PRESTAMO', 'ROUTE_CLOSE', 'CASH_MOVE', 'getGlobalActivity', 'getReportTemplates'],
    required: ['auditService.list()'],
    reason: 'the active activity surface must use the API audit boundary and must not expose inherited lending event semantics',
  },
  {
    file: 'services/auditService.ts',
    forbidden: ['services/dataService', 'localStorage', 'prestard_'],
    required: ['apiClient.listAuditLogs'],
    reason: 'the audit service must remain an API-only audit boundary',
  },
  {
    file: 'pages/PlatformReportsPage.tsx',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'PrestaFacil', 'PrestaFácil', 'Loan', 'LoanStatus', 'PaymentReceipt', 'PaymentPromise', 'mora', 'prestamo', 'préstamo'],
    required: ['reportingService.load()'],
    reason: 'the active reports surface must use the neutral API reporting boundary and exclude inherited lending analytics',
  },
  {
    file: 'services/reportingService.ts',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'listLoans', 'listPayments', 'getReportSummary'],
    required: ['apiClient.listReportExports()', 'apiClient.listReportSchedules()', 'apiClient.listReportTemplates()'],
    reason: 'the reporting service must remain an API-only neutral reporting boundary',
  },
  {
    file: 'pages/PlatformContactsPage.tsx',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'creditRating', 'isBlocked', 'loan balance', 'mora', 'collectorId', 'CollectionRoute', 'routeItems'],
    required: ['contactsService', '.list({', 'ContactRecord'],
    reason: 'the active contacts list must use the neutral Contact API and exclude inherited lending semantics',
  },
  {
    file: 'pages/PlatformContactDetailPage.tsx',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', 'creditRating', 'isBlocked', 'loan balance', 'collectorId', 'CollectionRoute', 'routeItems'],
    required: ['contactsService', '.get(id)', 'ContactRecord'],
    reason: 'the active contact detail must use the neutral Contact API rather than the inherited client profile',
  },
  {
    file: 'services/contactsService.ts',
    forbidden: ['services/dataService', 'localStorage', 'prestard_', '/clients', 'creditRating', 'isBlocked'],
    required: ["'/contacts'", '`/contacts/${contactId}`', 'readSession'],
    reason: 'the frontend contacts boundary must target the contacts API only and remain independent from legacy client storage',
  },
  {
    file: 'prisma/models/contact.prisma',
    forbidden: ['creditRating', 'isBlocked', 'Loan', 'loan', 'mora', 'collector', 'route'],
    required: ['model Contact', 'enum ContactStatus', 'companyId', 'ownerUserId', 'provenanceJson'],
    reason: 'the new CRM Contact model must remain neutral and separate from inherited lending semantics',
  },
  {
    file: 'server/src/modules/contacts/contacts.controller.ts',
    forbidden: ['ClientCreditRating', 'ClientStatus', 'Loan', 'mora', 'collector', 'route'],
    required: ["@Controller('contacts')", 'this.prisma.contact.findMany', 'tx.contact.create', 'tx.contact.update'],
    reason: 'the contacts API must use the new Contact aggregate rather than the inherited lending Client model',
  },
  {
    file: 'prisma.config.ts',
    forbidden: ['schema: "prisma/schema.prisma"'],
    required: ['schema: "prisma/"'],
    reason: 'Prisma must load the schema directory so CRM domain files remain isolated from the inherited monolithic schema',
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
  'docs/CRM_CORE_DOMAIN_CONTRACT.md',
  'docs/CONTENT_BRIDGE_READINESS.md',
  'components/PlatformShell.tsx',
  'pages/PlatformAccessPage.tsx',
  'pages/PlatformDashboardPage.tsx',
  'pages/PlatformAdminPage.tsx',
  'pages/PlatformUsersPage.tsx',
  'pages/PlatformSettingsPage.tsx',
  'pages/PlatformActivityPage.tsx',
  'pages/PlatformReportsPage.tsx',
  'pages/PlatformContactsPage.tsx',
  'pages/PlatformContactDetailPage.tsx',
  'services/teamService.ts',
  'services/organizationService.ts',
  'services/auditService.ts',
  'services/reportingService.ts',
  'services/contactsService.ts',
  'prisma/models/contact.prisma',
  'prisma/migrations/20260728013000_add_contact_core/migration.sql',
  'server/src/modules/contacts/contacts.module.ts',
  'server/src/modules/contacts/contacts.controller.ts',
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
