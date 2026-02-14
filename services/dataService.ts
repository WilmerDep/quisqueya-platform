
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

const SAMPLE_ADMIN_PHOTO = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80";

const initialUsers: User[] = [
  {
    id: 'admin-1',
    name: 'Juan Pérez (Admin)',
    username: 'admin',
    role: Role.ADMIN,
    avatar: 'JP',
    photo: SAMPLE_ADMIN_PHOTO,
    isActive: true,
    phone: '809-555-0101',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cobrador-1',
    name: 'Pedro Cobro',
    username: 'pedro',
    role: Role.COBRADOR,
    avatar: 'PC',
    isActive: true,
    phone: '809-555-0102',
    createdAt: new Date().toISOString()
  }
];

const getFromStorage = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getUsers = (): User[] => getFromStorage(STORAGE_KEYS.USERS, initialUsers);

export const createUser = (userData: Partial<User>, currentUserId: string) => {
  const users = getUsers();
  const newUser: User = {
    id: crypto.randomUUID(),
    name: userData.name || '',
    username: userData.username || '',
    role: userData.role || Role.COBRADOR,
    avatar: userData.avatar || '??',
    photo: userData.photo,
    isActive: true,
    phone: userData.phone,
    createdAt: new Date().toISOString(),
  };
  saveToStorage(STORAGE_KEYS.USERS, [...users, newUser]);
  addActivity({
    type: 'USER_MGMT',
    userId: currentUserId,
    userName: 'Administrador',
    title: 'Usuario Creado',
    description: `Se creó el usuario ${newUser.name}`
  });
  return newUser;
};

export const updateUser = (userId: string, updates: Partial<User>, currentUserId: string) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return;
  users[index] = { ...users[index], ...updates };
  saveToStorage(STORAGE_KEYS.USERS, users);
};

export const getClients = (): Client[] => getFromStorage(STORAGE_KEYS.CLIENTS, []);

export const getClientById = (id: string) => getClients().find(c => c.id === id);

export const createClient = (clientData: any, currentUser: User) => {
  const clients = getClients();
  const newClient: Client = {
    id: crypto.randomUUID(),
    firstName: clientData.firstName,
    lastName: clientData.lastName,
    nickname: clientData.nickname,
    cedula: clientData.cedula,
    phone: clientData.phone,
    address: clientData.address,
    assignedUserId: clientData.assignedUserId,
    creditRating: FichaType.BUENA,
    status: ClientStatus.PENDING,
    photo: clientData.photo,
    createdAt: new Date().toISOString()
  };
  saveToStorage(STORAGE_KEYS.CLIENTS, [...clients, newClient]);
  addActivity({
    type: 'APPROVAL',
    userId: currentUser.id,
    userName: currentUser.name,
    title: 'Nuevo Prospecto',
    description: `Expediente creado para ${newClient.firstName} ${newClient.lastName}`,
    clientId: newClient.id,
    clientName: `${newClient.firstName} ${newClient.lastName}`
  });
  return newClient;
};

export const updateClient = (clientId: string, updates: Partial<Client>) => {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === clientId);
  if (index === -1) return;
  clients[index] = { ...clients[index], ...updates };
  saveToStorage(STORAGE_KEYS.CLIENTS, clients);
  return clients[index];
};

export const updateClientStatus = (clientId: string, status: ClientStatus, currentUser: User) => {
  const updated = updateClient(clientId, { status });
  if (updated) {
    addActivity({
      type: 'APPROVAL',
      userId: currentUser.id,
      userName: currentUser.name,
      title: status === ClientStatus.APPROVED ? 'Expediente Aprobado' : 'Expediente Rechazado',
      description: `El administrador ha ${status === ClientStatus.APPROVED ? 'aprobado' : 'rechazado'} formalmente a este cliente.`,
      clientId: clientId,
      clientName: `${updated.firstName} ${updated.lastName}`
    });
  }
  return updated;
};

export const getLoans = (): Loan[] => getFromStorage(STORAGE_KEYS.LOANS, []);

export const getClientLoans = (clientId: string) => getLoans().filter(l => l.clientId === clientId);

export const createLoan = (loanData: any) => {
  const loans = getLoans();
  const schedule = generateSchedule(
    loanData.amount,
    loanData.interestRate,
    loanData.duration,
    loanData.frequency,
    loanData.startDate
  );

  const totalToPay = schedule.reduce((sum, i) => sum + i.expectedAmount, 0);
  
  const newLoan: Loan = {
    id: crypto.randomUUID(),
    clientId: loanData.clientId,
    amount: loanData.amount,
    interestRate: loanData.interestRate,
    interestType: 'FLAT',
    frequency: loanData.frequency,
    duration: loanData.duration,
    startDate: loanData.startDate,
    totalToPay: totalToPay,
    balance: totalToPay,
    status: LoanStatus.ACTIVO,
    installments: schedule,
    createdAt: new Date().toISOString()
  };

  newLoan.installments.forEach(i => i.loanId = newLoan.id);
  const updatedLoans = [...loans, newLoan];
  saveToStorage(STORAGE_KEYS.LOANS, updatedLoans);
  
  const client = getClientById(loanData.clientId);
  addActivity({
    type: 'PRESTAMO',
    userId: 'system',
    userName: 'Sistema',
    title: 'Desembolso Realizado',
    description: `Préstamo de ${loanData.amount} creado`,
    amount: loanData.amount,
    clientId: loanData.clientId,
    clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente'
  });
  
  return newLoan;
};

export const getPayments = (): PaymentReceipt[] => getFromStorage(STORAGE_KEYS.PAYMENTS, []);

export const getClientPayments = (clientId: string) => {
  const clientLoans = getClientLoans(clientId).map(l => l.id);
  return getPayments().filter(p => clientLoans.includes(p.loanId));
};

export const processPayment = (loanId: string, installmentId: string, amount: number): PaymentReceipt => {
  const loans = getLoans();
  const loanIndex = loans.findIndex(l => l.id === loanId);
  if (loanIndex === -1) throw new Error("Loan not found");
  
  const loan = loans[loanIndex];
  const instIndex = loan.installments.findIndex(i => i.id === installmentId);
  if (instIndex === -1) throw new Error("Installment not found");
  
  const inst = loan.installments[instIndex];
  inst.paidAmount += amount;
  inst.paidAt = new Date().toISOString();
  
  if (inst.paidAmount >= inst.expectedAmount) {
    inst.status = 'PAGADO';
  } else {
    inst.status = 'PARCIAL';
  }
  
  loan.balance -= amount;
  if (loan.balance <= 0) {
    loan.status = LoanStatus.COMPLETADO;
    loan.balance = 0;
  }
  
  const payments = getPayments();
  const receipt: PaymentReceipt = {
    id: crypto.randomUUID(),
    loanId,
    installmentId,
    amount,
    moraPaid: 0,
    date: new Date().toISOString()
  };
  
  saveToStorage(STORAGE_KEYS.LOANS, loans);
  saveToStorage(STORAGE_KEYS.PAYMENTS, [receipt, ...payments]);
  
  const client = getClientById(loan.clientId);
  addActivity({
    type: 'PAGO',
    userId: 'system',
    userName: 'Sistema',
    title: 'Cobro Registrado',
    description: `Recibido pago de ${amount}`,
    amount: amount,
    clientId: loan.clientId,
    clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente'
  });
  
  return receipt;
};

export const getFichas = (): Ficha[] => getFromStorage(STORAGE_KEYS.FICHAS, []);

export const getClientFichas = (clientId: string) => getFichas().filter(f => f.clientId === clientId);

export const addFicha = (fichaData: any) => {
  const fichas = getFichas();
  const newFicha: Ficha = {
    id: crypto.randomUUID(),
    clientId: fichaData.clientId,
    type: fichaData.type,
    reason: fichaData.reason,
    note: fichaData.note,
    impact: fichaData.impact || 'NEUTRAL',
    createdBy: fichaData.createdBy,
    createdAt: new Date().toISOString(),
    isArchived: false
  };
  saveToStorage(STORAGE_KEYS.FICHAS, [...fichas, newFicha]);

  if (fichaData.type === FichaType.MALA) {
    updateClient(fichaData.clientId, { creditRating: FichaType.MALA });
  }

  const client = getClientById(fichaData.clientId);
  addActivity({
    type: 'CONDUCTA',
    userId: fichaData.createdBy,
    userName: 'Sistema',
    title: 'Nota de Conducta',
    description: fichaData.reason,
    clientId: fichaData.clientId,
    clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente'
  });

  return newFicha;
};

export const getGlobalActivity = (): ActivityEvent[] => getFromStorage(STORAGE_KEYS.ACTIVITY, []);

export const addActivity = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
  const events = getGlobalActivity();
  const newEvent: ActivityEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
  saveToStorage(STORAGE_KEYS.ACTIVITY, [newEvent, ...events]);
  return newEvent;
};

// --- SEED DATA LOGIC ---
const seedData = () => {
  const existingClients = getFromStorage(STORAGE_KEYS.CLIENTS, []);
  if (existingClients.length > 0) return;

  const demoClients: Client[] = [
    {
      id: 'client-pending',
      firstName: 'Ramón',
      lastName: 'Valdez',
      nickname: 'Don Moncho',
      cedula: '001-0000000-1',
      phone: '809-111-2222',
      address: 'Calle Las Damas #12, Zona Colonial',
      assignedUserId: 'cobrador-1',
      creditRating: FichaType.BUENA,
      status: ClientStatus.PENDING,
      createdAt: new Date().toISOString()
    },
    {
      id: 'client-approved',
      firstName: 'Ana',
      lastName: 'Martínez',
      cedula: '001-1111111-2',
      phone: '829-333-4444',
      address: 'Av. Winston Churchill, Plaza Central',
      assignedUserId: 'cobrador-1',
      creditRating: FichaType.BUENA,
      status: ClientStatus.APPROVED,
      createdAt: new Date().toISOString()
    },
    {
      id: 'client-overdue',
      firstName: 'José',
      lastName: 'Rodríguez',
      nickname: 'Chelo',
      cedula: '001-2222222-3',
      phone: '849-555-6666',
      address: 'C/ El Sol, Edif. 4, Santiago',
      assignedUserId: 'cobrador-1',
      creditRating: FichaType.MALA,
      status: ClientStatus.APPROVED,
      createdAt: new Date().toISOString()
    },
    {
      id: 'client-blocked',
      firstName: 'Lucía',
      lastName: 'Peralta',
      cedula: '001-3333333-4',
      phone: '809-777-8888',
      address: 'Barrio Lindo, San Pedro',
      assignedUserId: 'cobrador-1',
      creditRating: FichaType.MALA,
      isBlocked: true,
      blockReason: 'Múltiples promesas incumplidas y reporte en CICLA',
      status: ClientStatus.APPROVED,
      createdAt: new Date().toISOString()
    }
  ];

  saveToStorage(STORAGE_KEYS.CLIENTS, demoClients);

  // Crear préstamos de prueba para Ana (Al día) y José (En mora)
  const anaLoan = createLoan({
    clientId: 'client-approved',
    amount: 10000,
    interestRate: 20,
    frequency: Frequency.SEMANAL,
    duration: 13,
    startDate: new Date().toISOString()
  });

  const joseLoan = createLoan({
    clientId: 'client-overdue',
    amount: 5000,
    interestRate: 20,
    frequency: Frequency.DIARIO,
    duration: 30,
    startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() // Hace 15 días
  });

  // Marcar algunas cuotas de José como vencidas
  const loans = getLoans();
  const joseIdx = loans.findIndex(l => l.id === joseLoan.id);
  if (joseIdx !== -1) {
    loans[joseIdx].status = LoanStatus.MORA;
    loans[joseIdx].installments.forEach((inst, idx) => {
      if (idx < 5) inst.status = 'VENCIDO';
    });
    saveToStorage(STORAGE_KEYS.LOANS, loans);
  }
};

// EJECUCIÓN DE SEMILLAS AL FINAL PARA EVITAR ERRORES DE INICIALIZACIÓN
seedData();
