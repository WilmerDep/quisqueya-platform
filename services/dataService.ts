
import { Client, Loan, Installment, LoanStatus, PaymentReceipt, Frequency, User, Role, Ficha, FichaType, ActivityEvent, ActivityType, ClientStatus } from '../types';
import { generateSchedule } from '../utils';

const STORAGE_KEYS = {
  CLIENTS: 'prestard_clients',
  LOANS: 'prestard_loans',
  PAYMENTS: 'prestard_payments',
  FICHAS: 'prestard_fichas',
  USERS: 'prestard_users',
  ACTIVITY: 'prestard_activity'
};

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Juan Admin', username: 'admin', role: Role.ADMIN, avatar: 'JA', isActive: true, createdAt: new Date().toISOString() },
  { id: 'u2', name: 'Pedro Cobrador', username: 'pedro', role: Role.COBRADOR, avatar: 'PC', isActive: true, createdAt: new Date().toISOString() },
  { id: 'u3', name: 'Maria Supervisora', username: 'maria', role: Role.SUPERVISOR, avatar: 'MS', isActive: true, createdAt: new Date().toISOString() }
];

const initStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(MOCK_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LOANS)) {
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS)) {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.FICHAS)) {
    localStorage.setItem(STORAGE_KEYS.FICHAS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ACTIVITY)) {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify([]));
  }
};

// --- USER MANAGEMENT ---

export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  return data ? JSON.parse(data) : [];
};

export const createUser = (userData: Omit<User, 'id' | 'createdAt'>, adminId: string): User => {
  const users = getUsers();
  const newUser: User = {
    ...userData,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  
  logActivity({
    type: 'USER_MGMT',
    userId: adminId,
    userName: 'Admin',
    title: 'Nuevo Usuario Creado',
    description: `Se creó el usuario ${newUser.name} con rol ${newUser.role}`
  });

  return newUser;
};

export const updateUser = (id: string, updates: Partial<User>, adminId: string): User => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error("Usuario no encontrado");
  
  users[index] = { ...users[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

  logActivity({
    type: 'USER_MGMT',
    userId: adminId,
    userName: 'Admin',
    title: 'Usuario Actualizado',
    description: `Se actualizaron los datos del usuario ${users[index].name}`
  });

  return users[index];
};

// --- CLIENT MANAGEMENT ---

export const getClients = (): Client[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
  return data ? JSON.parse(data) : [];
};

export const getClientById = (id: string): Client | undefined => {
  return getClients().find(c => c.id === id);
};

export const createClient = (clientData: any, creator: User): Client => {
  const clients = getClients();
  const newClient: Client = {
    ...clientData,
    id: crypto.randomUUID(),
    creditRating: FichaType.BUENA,
    isBlocked: false,
    status: creator.role === Role.COBRADOR ? ClientStatus.PENDING : ClientStatus.APPROVED,
    createdAt: new Date().toISOString()
  };
  clients.push(newClient);
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));

  logActivity({
    type: 'APPROVAL',
    userId: creator.id,
    userName: creator.name,
    clientId: newClient.id,
    clientName: `${newClient.firstName} ${newClient.lastName}`,
    title: creator.role === Role.COBRADOR ? 'Solicitud de Aprobación' : 'Cliente Registrado',
    description: creator.role === Role.COBRADOR 
      ? `Cobrador ${creator.name} registró un prospecto para revisión.`
      : `Admin ${creator.name} registró un cliente aprobado directamente.`
  });

  return newClient;
};

export const updateClientStatus = (clientId: string, status: ClientStatus, approver: User): Client => {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === clientId);
  if (index === -1) throw new Error("Cliente no encontrado");
  
  // Actualizamos el objeto
  const updatedClient = { ...clients[index], status };
  clients[index] = updatedClient;
  
  // Guardamos
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));

  // Bitácora
  logActivity({
    type: 'APPROVAL',
    userId: approver.id,
    userName: approver.name,
    clientId: clientId,
    clientName: `${updatedClient.firstName} ${updatedClient.lastName}`,
    title: status === ClientStatus.APPROVED ? 'Cliente Aprobado' : 'Cliente Rechazado',
    description: `El ${approver.role} ${approver.name} cambió el estatus a ${status}.`
  });

  return updatedClient;
};

export const updateClient = (id: string, updates: Partial<Client>): Client => {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === id);
  if (index === -1) throw new Error("Cliente no encontrado");
  
  const updatedClient = { ...clients[index], ...updates };
  clients[index] = updatedClient;
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  return updatedClient;
};

// --- FICHA MANAGEMENT ---

export const getFichas = (): Ficha[] => {
  const data = localStorage.getItem(STORAGE_KEYS.FICHAS);
  return data ? JSON.parse(data) : [];
};

export const getClientFichas = (clientId: string): Ficha[] => {
  return getFichas()
    .filter(f => f.clientId === clientId && !f.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addFicha = (ficha: Omit<Ficha, 'id' | 'createdAt' | 'isArchived'>): Ficha => {
  const allFichas = getFichas();
  const newFicha: Ficha = {
    ...ficha,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isArchived: false
  };
  allFichas.push(newFicha);
  localStorage.setItem(STORAGE_KEYS.FICHAS, JSON.stringify(allFichas));
  
  if (ficha.impact !== 'NEUTRAL') {
    updateClient(ficha.clientId, { creditRating: ficha.type });
  }
  return newFicha;
};

// --- LOAN MANAGEMENT ---

export const getLoans = (): Loan[] => {
  const data = localStorage.getItem(STORAGE_KEYS.LOANS);
  return data ? JSON.parse(data) : [];
};

export const getClientLoans = (clientId: string): Loan[] => {
  return getLoans().filter(l => l.clientId === clientId);
};

export const createLoan = (loanData: any): Loan => {
  const loans = getLoans();
  const installments = generateSchedule(loanData.amount, loanData.interestRate, loanData.duration, loanData.frequency, loanData.startDate);
  const totalToPay = installments.reduce((sum, inst) => sum + inst.expectedAmount, 0);
  const newLoan: Loan = {
    ...loanData,
    id: crypto.randomUUID(),
    interestType: 'FLAT',
    totalToPay,
    balance: totalToPay,
    status: LoanStatus.ACTIVO,
    installments: installments.map(i => ({ ...i, loanId: '' })), 
    createdAt: new Date().toISOString()
  };
  newLoan.installments.forEach(i => i.loanId = newLoan.id);
  loans.push(newLoan);
  localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
  return newLoan;
};

// --- PAYMENT MANAGEMENT ---

export const getPayments = (): PaymentReceipt[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
  return data ? JSON.parse(data) : [];
};

export const getClientPayments = (clientId: string): PaymentReceipt[] => {
  const clientLoanIds = getLoans().filter(l => l.clientId === clientId).map(l => l.id);
  return getPayments().filter(p => clientLoanIds.includes(p.loanId));
};

export const processPayment = (loanId: string, installmentId: string, amount: number): PaymentReceipt => {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) throw new Error("Loan not found");
  const inst = loan.installments.find(i => i.id === installmentId);
  if (!inst) throw new Error("Inst not found");
  
  inst.paidAmount += amount;
  if (inst.paidAmount >= inst.expectedAmount) {
    inst.status = 'PAGADO';
    inst.paidAt = new Date().toISOString();
  } else {
    inst.status = 'PARCIAL';
  }
  
  loan.balance -= amount;
  if (loan.balance <= 0) {
    loan.status = LoanStatus.COMPLETADO;
    loan.balance = 0;
  }
  
  const receipt: PaymentReceipt = {
    id: crypto.randomUUID(),
    loanId,
    installmentId,
    amount,
    moraPaid: 0,
    date: new Date().toISOString()
  };
  
  const payments = getPayments();
  payments.push(receipt);
  
  localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  
  return receipt;
};

// --- ACTIVITY & AUDIT ---

const logActivity = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
  const activity: ActivityEvent[] = data ? JSON.parse(data) : [];
  
  const newEvent: ActivityEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
  
  activity.push(newEvent);
  localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activity.slice(-500))); // Keep last 500
};

export const getGlobalActivity = (): ActivityEvent[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
  return data ? JSON.parse(data) : [];
};

initStorage();
