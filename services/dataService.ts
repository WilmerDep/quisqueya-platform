import { 
  Client, Loan, Installment, LoanStatus, PaymentReceipt, 
  Frequency, User, Role, Ficha, FichaType, ActivityEvent, 
  ClientStatus, Branch, Company, RouteStatus, CollectionRoute, RouteItem,
  VisitLog, PaymentPromise, CashMovement, CompanyConfig, SaaSPlan, GlobalConfig, PlanFeature,
  ReportTemplate
} from '../types';
import { generateSchedule } from '../utils';

const STORAGE_KEYS = {
  COMPANIES: 'prestard_companies',
  PLANS: 'prestard_saas_plans',
  BRANCHES: 'prestard_branches',
  CLIENTS: 'prestard_clients',
  LOANS: 'prestard_loans',
  PAYMENTS: 'prestard_payments',
  FICHAS: 'prestard_fichas',
  USERS: 'prestard_users',
  ACTIVITY: 'prestard_activity',
  ROUTES: 'prestard_routes',
  VISITS: 'prestard_visits',
  PROMISES: 'prestard_promises',
  CASH: 'prestard_cash',
  GLOBAL_CONFIG: 'prestard_global_config',
  MASTER_LOGS: 'prestard_master_logs',
  REPORT_TEMPLATES: 'prestard_report_templates'
};

export const getFromStorage = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  try {
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();

const getDefaultCompanyConfig = (): CompanyConfig => ({
  defaultMoraAmount: 100,
  moraType: 'FLAT',
  graceDays: 2,
  currency: 'DOP',
  receiptFooter: 'Gracias por su puntualidad.',
  scoringThresholdRegular: 5,
  scoringThresholdMala: 15,
  skipSundays: true,
  whatsappWelcomeTemplate: '',
  whatsappReceiptTemplate: ''
});

const createActivityEvent = (event: ActivityEvent): ActivityEvent => ({
  ...event,
  id: event.id || crypto.randomUUID(),
  timestamp: event.timestamp || nowIso()
});

const pushActivityEvent = (event: ActivityEvent) => {
  const activities = getFromStorage<ActivityEvent[]>(STORAGE_KEYS.ACTIVITY, []);
  saveToStorage(STORAGE_KEYS.ACTIVITY, [createActivityEvent(event), ...activities]);
};

const normalizeText = (value?: string) => (value || '').trim();

const normalizeUsernameBase = (companyName: string) => {
  const normalized = companyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12);

  return normalized || 'empresa';
};

const getNextCompanyAdminUsername = (companyName: string) => {
  const base = `${normalizeUsernameBase(companyName)}_admin`;
  const users = getAllUsers();

  if (!users.some(user => user.username.toLowerCase() === base.toLowerCase())) {
    return base;
  }

  let suffix = 2;
  while (users.some(user => user.username.toLowerCase() === `${base}${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${base}${suffix}`;
};

const getCompanyPlan = (companyId: string) => {
  const company = getCompanyById(companyId);
  if (!company) return null;
  return getSaaSPlans().find(plan => plan.id === company.planId) || null;
};

const getPrimaryBranchForCompany = (companyId: string) => {
  const branches = getBranches(companyId);
  return branches.find(branch => /principal|sede principal/i.test(branch.name)) || branches[0] || null;
};

const getPaymentStatus = (installment: Installment): Installment['status'] => {
  if (installment.paidAmount >= installment.expectedAmount) return 'PAGADO';
  if (installment.paidAmount > 0) return 'PARCIAL';
  return 'PENDIENTE';
};

const getClientFullName = (clientId: string) => {
  const client = getClientById(clientId);
  return client ? `${client.firstName} ${client.lastName}` : undefined;
};

const normalizeCashCategory = (category: string): CashMovement['category'] => {
  const normalized = normalizeText(category).toUpperCase();
  if (normalized === 'COMISIÓN') return 'COMISION';
  if (normalized === 'COMISION') return 'COMISION';
  if (normalized === 'DIETA') return 'DIETA';
  if (normalized === 'GASOLINA') return 'GASOLINA';
  if (normalized === 'RETIRO') return 'RETIRO';
  if (normalized === 'COBRO') return 'COBRO';
  if (normalized === 'PRESTAMO') return 'PRESTAMO';
  if (normalized === 'GASTO') return 'GASTO';
  if (normalized === 'APORTE') return 'APORTE';
  return 'OTRO';
};

// --- LOGS DE AUDITORÍA MASTER ---
export const addMasterLog = (action: string, detail: string) => {
    const logs = getFromStorage<any[]>(STORAGE_KEYS.MASTER_LOGS, []);
    logs.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), action, detail });
    saveToStorage(STORAGE_KEYS.MASTER_LOGS, logs.slice(0, 100));
};

export const getMasterLogs = () => getFromStorage<any[]>(STORAGE_KEYS.MASTER_LOGS, []);

export const addSecurityAuditLog = (action: string, detail: string, user?: Pick<User, 'id' | 'name' | 'companyId'>) => {
    addMasterLog(`Security: ${action}`, detail);
    if (!user?.companyId) return;

    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: user.companyId,
      type: 'SECURITY',
      timestamp: nowIso(),
      userId: user.id,
      userName: user.name,
      title: action,
      description: detail
    });
};

// --- MOTOR DE INICIALIZACIÓN ---
export const seedInitialData = () => {
    const existingUsers = getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
    if (existingUsers.length > 0) {
        // Auto-heal: always force-patch master and admin credentials on every boot
        // so localStorage corruption can never permanently lock out system users.
        const patchedUsers = existingUsers.map(user => {
            if (user.username === 'master') {
                return {
                    ...user,
                    id: user.id || 'M1',
                    companyId: 'SYSTEM',
                    linkedCompanyIds: user.linkedCompanyIds?.length ? user.linkedCompanyIds : ['SYSTEM'],
                    role: Role.SUPER_ADMIN,
                    isActive: true,
                    email: user.email || 'master@prestafacil.local',
                    passwordSalt: 'prestafacil-master',
                    passwordHash: '7e9945e954b75e8263fb473ef538584f7425c338542433556ef04cf9831cb0dd',
                };
            }
            if (user.username === 'admin' && !user.passwordHash) {
                return {
                    ...user,
                    email: user.email || 'admin@prestafacil.local',
                    passwordSalt: 'prestafacil-admin',
                    passwordHash: 'b5e2eb46bf1cf64c76d35b63f2513418f618181708451a80490054bf7b812c94',
                    passwordUpdatedAt: nowIso()
                };
            }
            return user;
        });
        saveToStorage(STORAGE_KEYS.USERS, patchedUsers);
        return;
    }

    const systemCompany: Company = {
        id: 'SYSTEM',
        name: 'Nexus Core Admin',
        status: 'ACTIVE',
        planId: 'p3',
        billingCycle: 'YEARLY',
        expiresAt: '2099-12-31',
        billingDay: 1,
        subscriptionPrice: 0,
        createdAt: new Date().toISOString(),
        config: {
            ...getDefaultCompanyConfig(),
            defaultMoraAmount: 0,
            graceDays: 0,
            receiptFooter: 'Nexus Core OS - Master Mode'
        }
    };

    const masterUser: User = {
        id: 'M1', companyId: 'SYSTEM', linkedCompanyIds: ['SYSTEM'], branchId: 'MAIN',
        name: 'Nexus Master', username: 'master', role: Role.SUPER_ADMIN, avatar: 'NM', isActive: true, createdAt: new Date().toISOString(),
        email: 'master@prestafacil.local',
        passwordSalt: 'prestafacil-master',
        passwordHash: '7e9945e954b75e8263fb473ef538584f7425c338542433556ef04cf9831cb0dd',
        passwordUpdatedAt: new Date().toISOString()
    };

    const demoCompany: Company = {
        id: 'C1', name: 'PrestaFácil RD', status: 'ACTIVE', planId: 'p2', billingCycle: 'MONTHLY',
        expiresAt: '2025-12-31', billingDay: 5, subscriptionPrice: 3500, createdAt: new Date().toISOString(),
        config: getDefaultCompanyConfig()
    };

    const demoAdmin: User = {
        id: 'U1', companyId: 'C1', linkedCompanyIds: ['C1'], branchId: 'MAIN',
        name: 'Admin PrestaFácil', username: 'admin', role: Role.ADMIN, avatar: 'AP', isActive: true, createdAt: new Date().toISOString(),
        email: 'admin@prestafacil.local',
        passwordSalt: 'prestafacil-admin',
        passwordHash: 'b5e2eb46bf1cf64c76d35b63f2513418f618181708451a80490054bf7b812c94',
        passwordUpdatedAt: new Date().toISOString()
    };

    saveToStorage(STORAGE_KEYS.COMPANIES, [systemCompany, demoCompany]);
    saveToStorage(STORAGE_KEYS.USERS, [masterUser, demoAdmin]);
    saveToStorage(STORAGE_KEYS.BRANCHES, [{ id: 'MAIN', companyId: 'C1', name: 'Sede Principal', address: 'Santo Domingo, RD', managerName: 'Admin Nexus', monthlyGoal: 500000 }]);
    
    addMasterLog('Kernel Boot', 'Sistema Nexus Core iniciado correctamente.');
};

// --- SERVICIOS GLOBALES ---
export const getCompanies = (): Company[] => getFromStorage<Company[]>(STORAGE_KEYS.COMPANIES, []);
export const getCompanyById = (id: string) => getCompanies().find(c => c.id === id);
export const upsertCompaniesInLocalStorage = (incomingCompanies: Company[]) => {
    const companies = getCompanies();
    const nextById = new Map(companies.map(company => [company.id, company]));
    incomingCompanies.forEach(company => nextById.set(company.id, company));
    saveToStorage(STORAGE_KEYS.COMPANIES, Array.from(nextById.values()));
};

export const getSaaSPlans = (): SaaSPlan[] => {
    const allFeatures: PlanFeature[] = ['MODULE_CASH', 'MODULE_REPORTS', 'MODULE_ROUTES', 'MODULE_WHATSAPP', 'MODULE_AUDIT'];
    return getFromStorage<SaaSPlan[]>(STORAGE_KEYS.PLANS, [
        { id: 'p1', name: 'Básico', monthlyPrice: 1500, yearlyPrice: 15000, maxUsers: 3, maxBranches: 1, maxClients: 50, features: allFeatures, isOffer: false },
        { id: 'p2', name: 'Profesional', monthlyPrice: 3500, yearlyPrice: 35000, maxUsers: 15, maxBranches: 3, maxClients: 500, features: allFeatures, isOffer: true, offerText: 'Popular' },
        { id: 'p3', name: 'Enterprise', monthlyPrice: 8000, yearlyPrice: 80000, maxUsers: 100, maxBranches: 20, maxClients: 5000, features: allFeatures, isOffer: false }
    ]);
};

export const saveSaaSPlan = (plan: SaaSPlan) => {
    const plans = getSaaSPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx !== -1) {
        plans[idx] = plan;
        saveToStorage(STORAGE_KEYS.PLANS, plans);
        addMasterLog('Tier Config Saved', `Ajuste manual de límites para tier: ${plan.name}`);
    }
};

export const getGlobalConfig = (): GlobalConfig => getFromStorage<GlobalConfig>(STORAGE_KEYS.GLOBAL_CONFIG, { 
    maintenanceMode: false, maintenanceDate: '', broadcastMessage: 'Sistema Nexus Operativo.', systemVersion: 'v6.5.1' 
});

export const updateGlobalConfig = (c: GlobalConfig) => {
    saveToStorage(STORAGE_KEYS.GLOBAL_CONFIG, c);
    addMasterLog('Kernel Parameters Sincronizados', `Versión: ${c.systemVersion}`);
};

// --- GESTIÓN DE NEGOCIO (PRÉSTAMOS, CLIENTES, PAGOS) ---
export const getLoans = (companyId: string): Loan[] => {
    const all = getFromStorage<Loan[]>(STORAGE_KEYS.LOANS, []);
    return companyId === 'ALL' || companyId === 'SYSTEM' ? all : all.filter(l => l.companyId === companyId);
};

export const upsertLoansInLocalStorage = (incomingLoans: Loan[]) => {
    const loans = getLoans('ALL');
    const nextById = new Map(loans.map(loan => [loan.id, loan]));
    incomingLoans.forEach(loan => nextById.set(loan.id, loan));
    saveToStorage(STORAGE_KEYS.LOANS, Array.from(nextById.values()));
};

export const getClients = (companyId: string): Client[] => {
    const all = getFromStorage<Client[]>(STORAGE_KEYS.CLIENTS, []);
    return companyId === 'ALL' || companyId === 'SYSTEM' ? all : all.filter(c => c.companyId === companyId);
};

export const upsertClientsInLocalStorage = (incomingClients: Client[]) => {
    const clients = getClients('ALL');
    const nextById = new Map(clients.map(client => [client.id, client]));
    incomingClients.forEach(client => nextById.set(client.id, client));
    saveToStorage(STORAGE_KEYS.CLIENTS, Array.from(nextById.values()));
};

export const getPayments = (companyId: string): PaymentReceipt[] => {
    const all = getFromStorage<PaymentReceipt[]>(STORAGE_KEYS.PAYMENTS, []);
    return companyId === 'ALL' || companyId === 'SYSTEM' ? all : all.filter(p => p.companyId === companyId);
};

export const upsertPaymentsInLocalStorage = (incomingPayments: PaymentReceipt[]) => {
    const payments = getPayments('ALL');
    const nextById = new Map(payments.map(payment => [payment.id, payment]));
    incomingPayments.forEach(payment => nextById.set(payment.id, payment));
    saveToStorage(STORAGE_KEYS.PAYMENTS, Array.from(nextById.values()));
};

export const removePaymentFromLocalStorage = (paymentId: string) => {
    saveToStorage(STORAGE_KEYS.PAYMENTS, getPayments('ALL').filter(payment => payment.id !== paymentId));
};

export const upsertCashMovementsInLocalStorage = (incomingMovements: CashMovement[]) => {
    const cash = getFromStorage<CashMovement[]>(STORAGE_KEYS.CASH, []);
    const nextById = new Map(cash.map(movement => [movement.id, movement]));
    incomingMovements.forEach(movement => nextById.set(movement.id, movement));
    saveToStorage(STORAGE_KEYS.CASH, Array.from(nextById.values()));
};

export const recordPayment = (d: any, u: User) => {
    const paymentAmount = Number(d.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error('El monto del pago debe ser mayor que cero.');
    }

    const payments = getPayments('ALL');
    const loans = getLoans('ALL');
    const loanIdx = loans.findIndex(l => l.id === d.loanId);
    
    if (loanIdx === -1) return null;
    if (loans[loanIdx].companyId !== u.companyId && u.role !== Role.SUPER_ADMIN) {
      throw new Error('No tiene permiso para cobrar este prestamo.');
    }
    if (paymentAmount > loans[loanIdx].balance) {
      throw new Error('El pago no puede exceder el balance pendiente.');
    }

    const receipt: PaymentReceipt = {
        id: 'REC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        companyId: u.companyId, branchId: u.branchId,
        loanId: d.loanId, installmentId: d.installmentId,
        amount: paymentAmount, date: new Date().toISOString(), moraPaid: d.moraPaid || 0
    };

    const installmentIdx = loans[loanIdx].installments.findIndex(inst => inst.id === d.installmentId);
    if (installmentIdx !== -1) {
        const currentInstallment = loans[loanIdx].installments[installmentIdx];
        const updatedInstallment = {
            ...currentInstallment,
            paidAmount: Number((currentInstallment.paidAmount + paymentAmount).toFixed(2)),
            paidAt: nowIso()
        };
        updatedInstallment.status = getPaymentStatus(updatedInstallment);
        loans[loanIdx].installments[installmentIdx] = updatedInstallment;
    }

    loans[loanIdx].balance = Number((loans[loanIdx].balance - paymentAmount).toFixed(2));
    if (loans[loanIdx].balance <= 0) {
        loans[loanIdx].balance = 0;
        loans[loanIdx].status = LoanStatus.COMPLETADO;
    }

    saveToStorage(STORAGE_KEYS.PAYMENTS, [...payments, receipt]);
    saveToStorage(STORAGE_KEYS.LOANS, loans);

    pushActivityEvent({
        id: crypto.randomUUID(), companyId: u.companyId, type: 'PAGO', timestamp: nowIso(),
        userId: u.id, userName: u.name, title: 'Cobro de Cuota', description: `Se recibio un pago de ${paymentAmount}`, amount: paymentAmount
    });

    return receipt;
};

// --- MÉTRICAS MASTER ---
export const getGlobalMetrics = () => {
    const companies = getCompanies().filter(c => c.id !== 'SYSTEM');
    const allLoans = getLoans('ALL');
    const allPayments = getPayments('ALL');
    
    const mrr = companies.reduce((acc, c) => acc + (c.billingCycle === 'MONTHLY' ? c.subscriptionPrice : c.subscriptionPrice / 12), 0);
    const totalCollected = allPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalPortfolio = allLoans.reduce((acc, l) => acc + l.balance, 0);

    return { totalRevenue: totalCollected, totalActiveLoans: allLoans.length, totalTenants: companies.length, totalPortfolio, mrr };
};

export const getNodesTelemetry = () => [
    { id: 'SDQ-NORTH-01', region: 'Santo Domingo', cpu: 12, ram: 45, db: 8, status: 'Stable' },
    { id: 'STI-WEST-04', region: 'Santiago', cpu: 34, ram: 72, db: 42, status: 'Traffic' }
];

// --- FUNCIONES DE CREACIÓN (MÍNIMAS PARA FUNCIONAR) ---
export const createCompany = (data: any, creator: User) => {
    const companies = getCompanies();
    const branches = getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []);
    const users = getAllUsers();
    const plans = getSaaSPlans();
    const selectedPlan = plans.find(plan => plan.id === data.planId) || plans[1] || plans[0];
    const companyId = createId('C');
    const branchId = createId('B');
    const adminUserId = createId('U');
    const username = getNextCompanyAdminUsername(data.name);
    const subscriptionPrice = Number(
      data.subscriptionPrice ?? (data.billingCycle === 'YEARLY' ? selectedPlan?.yearlyPrice : selectedPlan?.monthlyPrice) ?? 0
    );

    const newCompany: Company = {
        id: companyId,
        name: normalizeText(data.name),
        status: 'ACTIVE',
        planId: selectedPlan?.id || data.planId,
        billingCycle: data.billingCycle || 'MONTHLY',
        expiresAt: '2026-01-01',
        billingDay: 1,
        subscriptionPrice,
        createdAt: nowIso(),
        config: getDefaultCompanyConfig()
    };

    const mainBranch: Branch = {
        id: branchId,
        companyId,
        name: 'Sucursal Principal',
        address: 'Pendiente de configurar',
        managerName: normalizeText(data.name),
        monthlyGoal: 0
    };

    const adminUser: User = {
        id: adminUserId,
        companyId,
        linkedCompanyIds: [companyId],
        branchId,
        name: `Admin ${normalizeText(data.name)}`,
        username,
        email: normalizeText(data.email) || undefined,
        passwordSalt: data.passwordSalt,
        passwordHash: data.passwordHash,
        passwordUpdatedAt: data.passwordHash ? nowIso() : undefined,
        role: Role.ADMIN,
        avatar: normalizeText(data.name).slice(0, 2).toUpperCase() || 'AD',
        isActive: true,
        createdAt: nowIso()
    };

    saveToStorage(STORAGE_KEYS.COMPANIES, [...companies, newCompany]);
    saveToStorage(STORAGE_KEYS.BRANCHES, [...branches, mainBranch]);
    saveToStorage(STORAGE_KEYS.USERS, [...users, adminUser]);

    addMasterLog('Empresa Aprovisionada', `Nueva instancia: ${newCompany.name}`);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId,
      type: 'COMPANY_CREATE',
      timestamp: nowIso(),
      userId: creator.id,
      userName: creator.name || 'Sistema',
      title: 'Empresa creada',
      description: `Se aprovisionó ${newCompany.name}`
    });

    return { company: newCompany, branch: mainBranch, adminUser };
};

export const updateCompany = (id: string, data: Partial<Company>) => {
    const list = getCompanies();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...data };
        saveToStorage(STORAGE_KEYS.COMPANIES, list);
        addMasterLog('Nodo Actualizado', `ID: ${id}`);
        return list[idx];
    }
    return null;
};

export const getBranches = (companyId: string) => getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []).filter(b => b.companyId === companyId);
export const getBranchById = (id: string) => getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []).find(branch => branch.id === id);
export const getAllUsers = () => getFromStorage<User[]>(STORAGE_KEYS.USERS, []);
export const upsertBranchesInLocalStorage = (incomingBranches: Branch[]) => {
    const branches = getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []);
    const nextById = new Map(branches.map(branch => [branch.id, branch]));
    incomingBranches.forEach(branch => nextById.set(branch.id, branch));
    saveToStorage(STORAGE_KEYS.BRANCHES, Array.from(nextById.values()));
};
export const upsertUsersInLocalStorage = (incomingUsers: User[]) => {
    const users = getAllUsers();
    const nextById = new Map(users.map(user => [user.id, user]));
    incomingUsers.forEach(user => nextById.set(user.id, user));
    saveToStorage(STORAGE_KEYS.USERS, Array.from(nextById.values()));
};
export const removeBranchFromLocalStorage = (id: string) => {
    const branches = getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []);
    saveToStorage(STORAGE_KEYS.BRANCHES, branches.filter(branch => branch.id !== id));
};
export const canViewAllCompanyUsers = (user: User) => {
    if (user.role === Role.SUPER_ADMIN) return true;
    if (user.role !== Role.ADMIN) return false;

    const primaryBranch = getPrimaryBranchForCompany(user.companyId);
    return !!primaryBranch && primaryBranch.id === user.branchId;
};
export const canManageCompanySettings = (user: User) => canViewAllCompanyUsers(user);
export const getVisibleBranchIdsForUser = (user: User) => {
    if (canViewAllCompanyUsers(user)) {
      return getBranches(user.companyId).map(branch => branch.id);
    }

    return [user.branchId];
};
export const getGlobalActivity = (cid: string) => getFromStorage<ActivityEvent[]>(STORAGE_KEYS.ACTIVITY, []).filter(a => cid === 'ALL' || cid === 'SYSTEM' || a.companyId === cid);
export const getCashMovements = (cid: string, bid: string) => getFromStorage<CashMovement[]>(STORAGE_KEYS.CASH, []).filter(m => m.companyId === cid && (!bid || m.branchId === bid));
export const getRoutes = (cid: string, bid: string) => getFromStorage<CollectionRoute[]>(STORAGE_KEYS.ROUTES, []).filter(r => r.companyId === cid && (!bid || r.branchId === bid));
export const upsertRoutesInLocalStorage = (incomingRoutes: CollectionRoute[]) => {
    const routes = getFromStorage<CollectionRoute[]>(STORAGE_KEYS.ROUTES, []);
    const nextById = new Map(routes.map(route => [route.id, route]));
    incomingRoutes.forEach(route => nextById.set(route.id, route));
    saveToStorage(STORAGE_KEYS.ROUTES, Array.from(nextById.values()));
};
export const getPendingInstallmentsForRoute = (cid: string, bid: string) => {
    const loans = getLoans(cid).filter(loan => !bid || loan.branchId === bid);
    const clients = getClients(cid);
    const assignedInstallments = new Set(
      getRoutes(cid, bid)
        .filter(route => route.status !== RouteStatus.CLOSED)
        .flatMap(route => route.items.map(item => item.installmentId).filter(Boolean))
    );

    return loans
      .flatMap(loan =>
        loan.installments
          .filter(installment => installment.status !== 'PAGADO' && !assignedInstallments.has(installment.id))
          .map(installment => {
            const client = clients.find(item => item.id === loan.clientId);
            const isOverdue = new Date(installment.dueDate) < new Date();
            return {
              loanId: loan.id,
              installmentId: installment.id,
              clientId: loan.clientId,
              clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente',
              clientPhoto: client?.photo || '',
              address: client?.address || 'Sin direccion registrada',
              amountToCollect: Number((installment.expectedAmount - installment.paidAmount).toFixed(2)),
              dueDate: installment.dueDate,
              isMora: isOverdue,
              visitStatus: 'PENDING' as const
            };
          })
      )
      .filter(item => item.amountToCollect > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
};
export const updateClient = (id: string, d: Partial<Client>) => {
    const clients = getClients('ALL');
    const idx = clients.findIndex(client => client.id === id);
    if (idx === -1) return null;

    clients[idx] = {
        ...clients[idx],
        ...d,
        firstName: d.firstName !== undefined ? normalizeText(d.firstName) : clients[idx].firstName,
        lastName: d.lastName !== undefined ? normalizeText(d.lastName) : clients[idx].lastName,
        cedula: d.cedula !== undefined ? normalizeText(d.cedula) : clients[idx].cedula,
        phone: d.phone !== undefined ? normalizeText(d.phone) : clients[idx].phone,
        address: d.address !== undefined ? normalizeText(d.address) : clients[idx].address,
        nickname: d.nickname !== undefined ? normalizeText(d.nickname) : clients[idx].nickname
    };

    saveToStorage(STORAGE_KEYS.CLIENTS, clients);
    return clients[idx];
};
export const updateClientStatus = (id: string, s: ClientStatus, u: User) => {
    const updated = updateClient(id, { status: s });
    if (!updated) return null;

    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'APPROVAL',
      timestamp: nowIso(),
      clientId: updated.id,
      clientName: `${updated.firstName} ${updated.lastName}`,
      userId: u.id,
      userName: u.name,
      title: s === ClientStatus.APPROVED ? 'Expediente aprobado' : 'Expediente rechazado',
      description: `Cambio de estado a ${s}`
    });

    return updated;
};
export const addFicha = (d: any, u: User) => {
    const fichas = getFromStorage<Ficha[]>(STORAGE_KEYS.FICHAS, []);
    const ficha: Ficha = {
      id: createId('FIC'),
      clientId: d.clientId,
      type: d.type,
      reason: normalizeText(d.reason),
      note: normalizeText(d.note),
      createdAt: nowIso()
    };

    saveToStorage(STORAGE_KEYS.FICHAS, [ficha, ...fichas]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'CONDUCTA',
      timestamp: nowIso(),
      clientId: d.clientId,
      clientName: getClientById(d.clientId) ? `${getClientById(d.clientId)?.firstName} ${getClientById(d.clientId)?.lastName}` : undefined,
      userId: u.id,
      userName: u.name,
      title: 'Ficha de conducta registrada',
      description: normalizeText(d.reason)
    });
    return ficha;
};
export const createLoan = (d: any, u: User) => {
    const amount = Number(d.amount);
    const interestRate = Number(d.interestRate);
    const duration = Number(d.duration);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('El capital debe ser mayor que cero.');
    if (!Number.isFinite(interestRate) || interestRate < 0) throw new Error('El interes no puede ser negativo.');
    if (!Number.isInteger(duration) || duration <= 0) throw new Error('El numero de cuotas debe ser mayor que cero.');
    if (!d.clientId) throw new Error('Debe seleccionar un cliente.');

    const loans = getLoans('ALL');
    const installments = generateSchedule(amount, interestRate, duration, d.frequency, d.startDate);
      
    const loanId = createId('L');
    const normalizedInstallments = installments.map(installment => ({ ...installment, loanId }));
    const totalToPay = Number(normalizedInstallments.reduce((sum, installment) => sum + installment.expectedAmount, 0).toFixed(2));
    const newLoan: Loan = {
      id: loanId,
      companyId: u.companyId,
      branchId: d.branchId || u.branchId,
      clientId: d.clientId,
      amount,
      interestRate,
      frequency: d.frequency,
      duration,
      startDate: d.startDate,
      totalToPay,
      balance: totalToPay,
      status: LoanStatus.ACTIVO,
      createdAt: nowIso(),
      installments: normalizedInstallments
    };
    saveToStorage(STORAGE_KEYS.LOANS, [...loans, newLoan]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'PRESTAMO',
      timestamp: nowIso(),
      clientId: d.clientId,
      clientName: getClientById(d.clientId) ? `${getClientById(d.clientId)?.firstName} ${getClientById(d.clientId)?.lastName}` : undefined,
      userId: u.id,
      userName: u.name,
      title: 'Nuevo préstamo generado',
      description: `Desembolso por ${amount}`,
      amount
    });
    return newLoan;
};
export const getClientById = (id: string) => getClients('ALL').find(c => c.id === id);
export const getClientLoans = (id: string) => getLoans('ALL').filter(l => l.clientId === id);
export const getClientFichas = (id: string) => getFromStorage<Ficha[]>(STORAGE_KEYS.FICHAS, []).filter(f => f.clientId === id);
export const getClientPayments = (id: string) => {
    const loanIds = getClientLoans(id).map(loan => loan.id);
    return getPayments('ALL').filter(payment => loanIds.includes(payment.loanId));
};
export const getClientVisits = (id: string) => getFromStorage<VisitLog[]>(STORAGE_KEYS.VISITS, []).filter(visit => visit.clientId === id);
export const getClientPromises = (id: string) => getFromStorage<PaymentPromise[]>(STORAGE_KEYS.PROMISES, []).filter(promise => promise.clientId === id);
export const voidPayment = (id: string, r: string, u: User) => {
    const payments = getPayments('ALL');
    const paymentIdx = payments.findIndex(payment => payment.id === id);
    if (paymentIdx === -1) return false;

    const payment = payments[paymentIdx];
    const loans = getLoans('ALL');
    const loanIdx = loans.findIndex(loan => loan.id === payment.loanId);
    if (loanIdx === -1) return false;

    const installmentIdx = loans[loanIdx].installments.findIndex(installment => installment.id === payment.installmentId);
    if (installmentIdx !== -1) {
      const currentInstallment = loans[loanIdx].installments[installmentIdx];
      const paidAmount = Math.max(0, Number((currentInstallment.paidAmount - payment.amount).toFixed(2)));
      loans[loanIdx].installments[installmentIdx] = {
        ...currentInstallment,
        paidAmount,
        paidAt: paidAmount > 0 ? currentInstallment.paidAt : undefined,
        status: getPaymentStatus({ ...currentInstallment, paidAmount })
      };
    }

    loans[loanIdx].balance = Number((loans[loanIdx].balance + payment.amount).toFixed(2));
    if (loans[loanIdx].balance > 0) {
      loans[loanIdx].status = LoanStatus.ACTIVO;
    }

    payments.splice(paymentIdx, 1);
    saveToStorage(STORAGE_KEYS.PAYMENTS, payments);
    saveToStorage(STORAGE_KEYS.LOANS, loans);

    addCashMovement({
      companyId: payment.companyId,
      branchId: payment.branchId,
      userId: u.id,
      userName: u.name,
      type: 'OUT',
      category: 'COBRO',
      amount: payment.amount,
      note: `Anulacion de recibo ${payment.id}: ${normalizeText(r)}`
    }, u);

    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'NOTA',
      timestamp: nowIso(),
      clientId: loans[loanIdx].clientId,
      clientName: getClientFullName(loans[loanIdx].clientId),
      userId: u.id,
      userName: u.name,
      title: 'Pago anulado',
      description: normalizeText(r),
      amount: payment.amount
    });

    return true;
};
export const createBranch = (d: any) => {
    const companyId = d.companyId;
    if (!companyId) throw new Error('Empresa no valida para la sucursal.');
    if (!canCreateResource(companyId, 'BRANCH')) throw new Error('Tu plan ya alcanzo el limite de sucursales.');

    const branches = getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []);
    const branchName = normalizeText(d.name);
    if (!branchName) throw new Error('La sucursal necesita un nombre.');
    const exists = branches.find(branch => branch.companyId === companyId && branch.name.toLowerCase() === branchName.toLowerCase());
    if (exists) throw new Error('Ya existe una sucursal con ese nombre.');

    const branch: Branch = {
      id: createId('BRC'),
      companyId,
      name: branchName,
      address: normalizeText(d.address),
      phone: normalizeText(d.phone) || undefined,
      logo: d.logo || undefined,
      managerName: normalizeText(d.managerName) || undefined,
      monthlyGoal: Number(d.monthlyGoal) || 0
    };

    saveToStorage(STORAGE_KEYS.BRANCHES, [...branches, branch]);
    addMasterLog('Sucursal Registrada', `${branch.name} - ${companyId}`);
    return branch;
};
export const updateBranch = (id: string, d: Partial<Branch>) => {
    const branches = getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []);
    const idx = branches.findIndex(branch => branch.id === id);
    if (idx === -1) return null;

    const name = d.name !== undefined ? normalizeText(d.name) : branches[idx].name;
    const duplicated = branches.find(branch => branch.id !== id && branch.companyId === branches[idx].companyId && branch.name.toLowerCase() === name.toLowerCase());
    if (duplicated) throw new Error('Ya existe otra sucursal con ese nombre.');

    branches[idx] = {
      ...branches[idx],
      ...d,
      name,
      address: d.address !== undefined ? normalizeText(d.address) : branches[idx].address,
      phone: d.phone !== undefined ? normalizeText(d.phone) || undefined : branches[idx].phone,
      managerName: d.managerName !== undefined ? normalizeText(d.managerName) || undefined : branches[idx].managerName,
      logo: d.logo !== undefined ? d.logo || undefined : branches[idx].logo,
      monthlyGoal: d.monthlyGoal !== undefined ? Number(d.monthlyGoal) || 0 : branches[idx].monthlyGoal,
    };

    saveToStorage(STORAGE_KEYS.BRANCHES, branches);
    return branches[idx];
};
export const updateCompanyConfig = (id: string, c: Partial<CompanyConfig>) => {
    const companies = getCompanies();
    const idx = companies.findIndex(company => company.id === id);
    if (idx === -1) return null;

    companies[idx] = {
      ...companies[idx],
      config: {
        ...companies[idx].config,
        ...c
      }
    };

    saveToStorage(STORAGE_KEYS.COMPANIES, companies);
    return companies[idx];
};
export const deleteBranch = (id: string) => {
    const branches = getFromStorage<Branch[]>(STORAGE_KEYS.BRANCHES, []);
    const branch = branches.find(item => item.id === id);
    if (!branch) return false;

    const companyBranches = branches.filter(item => item.companyId === branch.companyId);
    if (companyBranches.length <= 1) throw new Error('No puede eliminar la unica sucursal de la empresa.');

    const users = getAllUsers();
    const clients = getClients('ALL');
    const hasUsers = users.some(user => user.branchId === id && user.companyId === branch.companyId);
    const hasClients = clients.some(client => client.branchId === id && client.companyId === branch.companyId);
    if (hasUsers || hasClients) throw new Error('No puede eliminar una sucursal con personal o clientes asignados.');

    saveToStorage(STORAGE_KEYS.BRANCHES, branches.filter(item => item.id !== id));
    return true;
};
export const addVisitLog = (d: any, u: User) => {
    const visits = getFromStorage<VisitLog[]>(STORAGE_KEYS.VISITS, []);
    const visit: VisitLog = {
      id: createId('VIS'),
      clientId: d.clientId,
      userId: d.userId || u.id,
      date: d.date || nowIso(),
      result: d.result,
      note: normalizeText(d.note)
    };
    saveToStorage(STORAGE_KEYS.VISITS, [visit, ...visits]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'NOTA',
      timestamp: nowIso(),
      clientId: d.clientId,
      clientName: getClientById(d.clientId) ? `${getClientById(d.clientId)?.firstName} ${getClientById(d.clientId)?.lastName}` : undefined,
      userId: u.id,
      userName: u.name,
      title: 'Visita registrada',
      description: normalizeText(d.note || d.result)
    });
    return visit;
};
export const addPromise = (d: any, u: User) => {
    const promises = getFromStorage<PaymentPromise[]>(STORAGE_KEYS.PROMISES, []);
    const promise: PaymentPromise = {
      id: createId('PRM'),
      clientId: d.clientId,
      loanId: d.loanId,
      date: d.date,
      amount: Number(d.amount),
      status: d.status || 'PENDIENTE',
      note: normalizeText(d.note)
    };
    saveToStorage(STORAGE_KEYS.PROMISES, [promise, ...promises]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'PROMESA',
      timestamp: nowIso(),
      clientId: d.clientId,
      clientName: getClientById(d.clientId) ? `${getClientById(d.clientId)?.firstName} ${getClientById(d.clientId)?.lastName}` : undefined,
      userId: u.id,
      userName: u.name,
      title: 'Promesa de pago registrada',
      description: `Compromiso por ${d.amount}`
    });
    return promise;
};
export const updateRouteStatus = (id: string, s: RouteStatus) => {
    const routes = getFromStorage<CollectionRoute[]>(STORAGE_KEYS.ROUTES, []);
    const routeIdx = routes.findIndex(route => route.id === id);
    if (routeIdx === -1) return null;

    routes[routeIdx] = { ...routes[routeIdx], status: s };
    saveToStorage(STORAGE_KEYS.ROUTES, routes);
    return routes[routeIdx];
};
export const updateRouteItem = (rid: string, iid: string, d: Partial<RouteItem>) => {
    const routes = getFromStorage<CollectionRoute[]>(STORAGE_KEYS.ROUTES, []);
    const routeIdx = routes.findIndex(route => route.id === rid);
    if (routeIdx === -1) return null;

    const itemIdx = routes[routeIdx].items.findIndex(item => item.id === iid);
    if (itemIdx === -1) return null;

    routes[routeIdx].items[itemIdx] = { ...routes[routeIdx].items[itemIdx], ...d };
    saveToStorage(STORAGE_KEYS.ROUTES, routes);
    return routes[routeIdx].items[itemIdx];
};
export const closeRoute = (rid: string, c: number, u: User) => {
    const collected = Number(c);
    if (!Number.isFinite(collected) || collected < 0) throw new Error('El monto de liquidacion no puede ser negativo.');
    const routes = getFromStorage<CollectionRoute[]>(STORAGE_KEYS.ROUTES, []);
    const routeIdx = routes.findIndex(route => route.id === rid);
    if (routeIdx === -1) return null;

    routes[routeIdx] = { ...routes[routeIdx], status: RouteStatus.CLOSED };
    saveToStorage(STORAGE_KEYS.ROUTES, routes);

    addCashMovement({
      companyId: routes[routeIdx].companyId,
      branchId: routes[routeIdx].branchId,
      userId: u.id,
      userName: u.name,
      type: 'IN',
      category: 'COBRO',
      amount: collected,
      note: `Liquidacion de ruta ${routes[routeIdx].id}`
    }, u);

    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'ROUTE_CLOSE',
      timestamp: nowIso(),
      userId: u.id,
      userName: u.name,
      title: 'Ruta liquidada',
      description: `Cierre de ruta ${routes[routeIdx].id}`,
      amount: collected
    });

    return routes[routeIdx];
};
export const createRoute = (d: any, u: User) => {
    const routes = getFromStorage<CollectionRoute[]>(STORAGE_KEYS.ROUTES, []);
    const route: CollectionRoute = {
      id: createId('RTE'),
      companyId: u.companyId,
      branchId: d.branchId || u.branchId,
      collectorId: d.collectorId,
      date: d.date,
      status: RouteStatus.OPEN,
      items: d.items || []
    };

    saveToStorage(STORAGE_KEYS.ROUTES, [route, ...routes]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'NOTA',
      timestamp: nowIso(),
      userId: u.id,
      userName: u.name,
      title: 'Ruta creada',
      description: `Se asignaron ${route.items.length} cuentas para el ${route.date}`
    });
    return route;
};
export const addCashMovement = (d: any, u: User) => {
    const amount = Number(d.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('El movimiento de caja debe ser mayor que cero.');
    const cash = getFromStorage<CashMovement[]>(STORAGE_KEYS.CASH, []);
    const movement: CashMovement = {
      id: createId('CASH'),
      companyId: d.companyId || u.companyId,
      branchId: d.branchId || u.branchId,
      userId: d.userId || u.id,
      userName: d.userName || u.name,
      type: d.type,
      category: normalizeCashCategory(d.category),
      amount,
      note: normalizeText(d.note) || 'Movimiento manual de caja',
      date: d.date || nowIso()
    };

    saveToStorage(STORAGE_KEYS.CASH, [movement, ...cash]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: movement.companyId,
      type: 'CASH_MOVE',
      timestamp: movement.date,
      userId: movement.userId,
      userName: movement.userName,
      title: movement.type === 'IN' ? 'Entrada de caja' : 'Salida de caja',
      description: `${movement.category} - ${movement.note}`,
      amount: movement.amount
    });
    return movement;
};
export const createUser = (d: any, creatorId: string) => {
    const creator = getAllUsers().find(user => user.id === creatorId);
    if (!creator) throw new Error('Usuario creador no valido.');
    if (!canCreateResource(creator.companyId, 'USER')) throw new Error('Tu plan ya alcanzo el limite de usuarios.');

    const users = getAllUsers();
    const name = normalizeText(d.name);
    const username = normalizeText(d.username).toLowerCase();
    if (!name || !username) throw new Error('Nombre y usuario son obligatorios.');
    const exists = users.find(user => user.username.toLowerCase() === username);
    if (exists) throw new Error('Ese nombre de usuario ya existe.');

    const isPendingInvitation = d.invitationStatus === 'PENDIENTE' || d.firstAccessRequired === true;
    const user: User = {
      id: createId('USR'),
      companyId: creator.companyId,
      linkedCompanyIds: [creator.companyId],
      branchId: d.branchId || creator.branchId,
      name,
      username,
      email: normalizeText(d.email) || undefined,
      passwordSalt: isPendingInvitation ? undefined : d.passwordSalt || 'prestafacil-temp',
      passwordHash: isPendingInvitation ? undefined : d.passwordHash || '91f9ffd3636adceeb8c1c2ceb93e37c58d693cb3bdf4da743ed6c3f29b0bd6cb',
      passwordUpdatedAt: isPendingInvitation ? undefined : nowIso(),
      role: d.role || Role.COBRADOR,
      avatar: normalizeText(d.avatar) || name.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
      photo: d.photo || undefined,
      isActive: d.isActive !== false,
      phone: normalizeText(d.phone) || undefined,
      createdAt: nowIso(),
      invitationStatus: isPendingInvitation ? 'PENDIENTE' : 'ACEPTADA',
      invitationEmail: normalizeText(d.invitationEmail || d.email) || undefined,
      invitedAt: isPendingInvitation ? nowIso() : undefined,
      invitedByUserId: isPendingInvitation ? creator.id : undefined,
      firstAccessRequired: isPendingInvitation ? true : false,
      permissions: d.permissions && typeof d.permissions === 'object' ? d.permissions : undefined,
    };

    saveToStorage(STORAGE_KEYS.USERS, [...users, user]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: creator.companyId,
      type: 'USER_MGMT',
      timestamp: nowIso(),
      userId: creator.id,
      userName: creator.name,
      title: isPendingInvitation ? 'Usuario invitado' : 'Usuario creado',
      description: isPendingInvitation
        ? `Se preparo el preregistro de ${user.name} como ${user.role}`
        : `Se registro ${user.name} como ${user.role}`
    });
    return user;
};
export const updateUser = (id: string, d: Partial<User>) => {
    const users = getAllUsers();
    const idx = users.findIndex(user => user.id === id);
    if (idx === -1) return null;

    const nextUsername = d.username !== undefined ? normalizeText(d.username).toLowerCase() : users[idx].username;
    const duplicated = users.find(user => user.id !== id && user.username.toLowerCase() === nextUsername);
    if (duplicated) throw new Error('Ese nombre de usuario ya existe.');

    users[idx] = {
      ...users[idx],
      ...d,
      name: d.name !== undefined ? normalizeText(d.name) : users[idx].name,
      username: nextUsername,
      phone: d.phone !== undefined ? normalizeText(d.phone) || undefined : users[idx].phone,
      avatar: d.avatar !== undefined ? normalizeText(d.avatar) : users[idx].avatar,
      permissions: d.permissions !== undefined ? d.permissions : users[idx].permissions,
    };

    saveToStorage(STORAGE_KEYS.USERS, users);
    return users[idx];
};
export const getUsers = (cid: string) => getAllUsers().filter(u => u.companyId === cid);
export const createClient = (d: any, u: User) => {
    const clients = getClients('ALL');
    const cedula = normalizeText(d.cedula);
    const phone = normalizeText(d.phone);
    const branchId = d.branchId || u.branchId;
    const assignedUserId = d.assignedUserId || u.id;

    if (!normalizeText(d.firstName) || !normalizeText(d.lastName) || !cedula || !phone || !normalizeText(d.address)) {
      throw new Error('Complete los datos requeridos del cliente.');
    }

    if (!branchId) {
      throw new Error('Debe asignar una sucursal al cliente.');
    }

    if (!assignedUserId) {
      throw new Error('Debe asignar un oficial responsable.');
    }

    const duplicatedCedula = clients.find(client => client.companyId === u.companyId && client.cedula === cedula);
    if (duplicatedCedula) {
      throw new Error('Ya existe un cliente con esa cédula en esta empresa.');
    }

    const newClient: Client = {
      id: createId('CLI'),
      companyId: u.companyId,
      branchId,
      firstName: normalizeText(d.firstName),
      lastName: normalizeText(d.lastName),
      nickname: normalizeText(d.nickname),
      cedula,
      phone,
      address: normalizeText(d.address),
      assignedUserId,
      creditRating: FichaType.BUENA,
      isBlocked: false,
      status: ClientStatus.PENDING,
      photo: d.photo || '',
      createdAt: nowIso()
    };

    saveToStorage(STORAGE_KEYS.CLIENTS, [...clients, newClient]);
    pushActivityEvent({
      id: crypto.randomUUID(),
      companyId: u.companyId,
      type: 'NOTA',
      timestamp: nowIso(),
      clientId: newClient.id,
      clientName: `${newClient.firstName} ${newClient.lastName}`,
      userId: u.id,
      userName: u.name,
      title: 'Cliente registrado',
      description: `Nuevo expediente para ${newClient.firstName} ${newClient.lastName}`
    });
    return newClient;
};
export const checkCompanyAccess = (cid: string) => {
    const company = getCompanyById(cid);
    return {
      restricted: company?.status === 'RESTRICTED',
      suspended: company?.status === 'SUSPENDED'
    };
};
export const canCreateResource = (cid: string, t: string) => {
    const plan = getCompanyPlan(cid);
    if (!plan) return true;
    if (t === 'CLIENT') return getClients(cid).length < plan.maxClients;
    if (t === 'USER') return getUsers(cid).length < plan.maxUsers;
    if (t === 'BRANCH') return getBranches(cid).length < plan.maxBranches;
    return true;
};
export const hasFeature = (cid: string, f: string) => {
    const plan = getCompanyPlan(cid);
    if (!plan) return true;
    return plan.features.includes(f as PlanFeature);
};

export const getReportTemplates = () => getFromStorage<ReportTemplate[]>(STORAGE_KEYS.REPORT_TEMPLATES, []);
export const upsertReportTemplatesInLocalStorage = (templates: ReportTemplate[]) => {
  const current = getReportTemplates();
  const next = [...current];
  templates.forEach(t => {
    const idx = next.findIndex(x => x.id === t.id);
    if (idx !== -1) {
      next[idx] = { ...next[idx], ...t };
    } else {
      next.push(t);
    }
  });
  saveToStorage(STORAGE_KEYS.REPORT_TEMPLATES, next);
};

export const deleteReportTemplateInLocalStorage = (templateId: string) => {
  const current = getReportTemplates();
  const next = current.filter(t => t.id !== templateId);
  saveToStorage(STORAGE_KEYS.REPORT_TEMPLATES, next);
};
