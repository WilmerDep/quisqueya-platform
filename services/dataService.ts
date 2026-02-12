
import { Client, Loan, Installment, LoanStatus, PaymentReceipt, Frequency, User, Role, Ficha, FichaType } from '../types';
import { generateSchedule } from '../utils';

// Constantes para LocalStorage
const STORAGE_KEYS = {
  CLIENTS: 'prestard_clients',
  LOANS: 'prestard_loans',
  PAYMENTS: 'prestard_payments',
  FICHAS: 'prestard_fichas'
};

// MOCK USERS
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Juan Admin', role: Role.ADMIN, avatar: 'JA' },
  { id: 'u2', name: 'Pedro Cobrador', role: Role.COBRADOR, avatar: 'PC' },
  { id: 'u3', name: 'Maria Supervisora', role: Role.SUPERVISOR, avatar: 'MS' }
];

// Datos iniciales para demostración
const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    firstName: 'Juan',
    lastName: 'Pérez',
    nickname: 'Juancito',
    cedula: '001-0000000-1',
    phone: '809-555-0101',
    address: 'Calle Principal #12, Los Alcarrizos',
    assignedUserId: 'u2',
    creditRating: FichaType.BUENA,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    firstName: 'Maria',
    lastName: 'Gonzalez',
    nickname: 'La Doña',
    cedula: '402-0000000-2',
    phone: '829-555-0202',
    address: 'Av. 27 de Febrero, Sto Dgo',
    assignedUserId: 'u1',
    creditRating: FichaType.REGULAR,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    firstName: 'Pedro',
    lastName: 'Martinez',
    nickname: 'El Becerro',
    cedula: '031-0000000-3',
    phone: '849-555-0303',
    address: 'Calle 8, Villa Mella',
    assignedUserId: 'u2',
    creditRating: FichaType.MALA,
    createdAt: new Date().toISOString()
  }
];

const initStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(MOCK_CLIENTS));
  }
  
  // Init Loans (existing code logic maintained)
  if (!localStorage.getItem(STORAGE_KEYS.LOANS) || JSON.parse(localStorage.getItem(STORAGE_KEYS.LOANS) || '[]').length === 0) {
    const today = new Date();
    const daysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString();
    };

    const loan1Start = daysAgo(7); 
    const schedule1 = generateSchedule(10000, 10, 13, Frequency.SEMANAL, loan1Start);
    const total1 = schedule1.reduce((sum, i) => sum + i.expectedAmount, 0);

    const loan1: Loan = {
      id: crypto.randomUUID(),
      clientId: '1',
      amount: 10000,
      interestRate: 10,
      interestType: 'FLAT',
      frequency: Frequency.SEMANAL,
      duration: 13,
      startDate: loan1Start,
      totalToPay: total1,
      balance: total1,
      status: LoanStatus.ACTIVO,
      installments: schedule1,
      createdAt: loan1Start
    };
    loan1.installments.forEach(i => i.loanId = loan1.id);

    const loan2Start = daysAgo(2);
    const schedule2 = generateSchedule(5000, 20, 20, Frequency.DIARIO, loan2Start);
    const total2 = schedule2.reduce((sum, i) => sum + i.expectedAmount, 0);
    
    const loan2: Loan = {
      id: crypto.randomUUID(),
      clientId: '2',
      amount: 5000,
      interestRate: 20,
      interestType: 'FLAT',
      frequency: Frequency.DIARIO,
      duration: 20,
      startDate: loan2Start,
      totalToPay: total2,
      balance: total2,
      status: LoanStatus.ACTIVO, 
      installments: schedule2,
      createdAt: loan2Start
    };
    loan2.installments.forEach(i => i.loanId = loan2.id);

    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const loan3Start = d.toISOString();

    const schedule3 = generateSchedule(20000, 15, 6, Frequency.MENSUAL, loan3Start);
    const total3 = schedule3.reduce((sum, i) => sum + i.expectedAmount, 0);

    const loan3: Loan = {
      id: crypto.randomUUID(),
      clientId: '3',
      amount: 20000,
      interestRate: 15,
      interestType: 'FLAT',
      frequency: Frequency.MENSUAL,
      duration: 6,
      startDate: loan3Start,
      totalToPay: total3,
      balance: total3,
      status: LoanStatus.ACTIVO,
      installments: schedule3,
      createdAt: loan3Start
    };
    loan3.installments.forEach(i => i.loanId = loan3.id);

    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify([loan1, loan2, loan3]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS)) {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.FICHAS)) {
    localStorage.setItem(STORAGE_KEYS.FICHAS, JSON.stringify([]));
  }
};

// Users
export const getUsers = (): User[] => MOCK_USERS;

// Clientes
export const getClients = (): Client[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
  return data ? JSON.parse(data) : [];
};

export const getClientById = (id: string): Client | undefined => {
  const clients = getClients();
  return clients.find(c => c.id === id);
};

export const createClient = (client: Omit<Client, 'id' | 'createdAt'>): Client => {
  const clients = getClients();
  const newClient: Client = {
    ...client,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    creditRating: FichaType.BUENA // Default
  };
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify([...clients, newClient]));
  return newClient;
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

// FICHAS
export const getClientFichas = (clientId: string): Ficha[] => {
  const data = localStorage.getItem(STORAGE_KEYS.FICHAS);
  const allFichas: Ficha[] = data ? JSON.parse(data) : [];
  return allFichas
    .filter(f => f.clientId === clientId && !f.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addFicha = (ficha: Omit<Ficha, 'id' | 'createdAt' | 'isArchived'>): Ficha => {
  const data = localStorage.getItem(STORAGE_KEYS.FICHAS);
  const allFichas: Ficha[] = data ? JSON.parse(data) : [];
  
  const newFicha: Ficha = {
    ...ficha,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isArchived: false
  };
  
  allFichas.push(newFicha);
  localStorage.setItem(STORAGE_KEYS.FICHAS, JSON.stringify(allFichas));

  // Actualizar Rating del cliente (Lógica simple: última ficha manda)
  // En backend real sería un cálculo ponderado
  updateClient(ficha.clientId, { creditRating: ficha.type });

  return newFicha;
};

// Préstamos
export const getLoans = (): Loan[] => {
  const data = localStorage.getItem(STORAGE_KEYS.LOANS);
  const loans: Loan[] = data ? JSON.parse(data) : [];
  return loans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getClientLoans = (clientId: string): Loan[] => {
  return getLoans().filter(l => l.clientId === clientId);
};

export const createLoan = (loanData: {
  clientId: string;
  amount: number;
  interestRate: number;
  frequency: Frequency;
  duration: number;
  startDate: string;
}): Loan => {
  const loans = getLoans();
  const installments = generateSchedule(
    loanData.amount, 
    loanData.interestRate, 
    loanData.duration, 
    loanData.frequency, 
    loanData.startDate
  );
  const totalToPay = installments.reduce((sum, inst) => sum + inst.expectedAmount, 0);

  const newLoan: Loan = {
    id: crypto.randomUUID(),
    clientId: loanData.clientId,
    amount: loanData.amount,
    interestRate: loanData.interestRate,
    interestType: 'FLAT',
    frequency: loanData.frequency,
    duration: loanData.duration,
    startDate: loanData.startDate,
    totalToPay,
    balance: totalToPay,
    status: LoanStatus.ACTIVO,
    installments: installments,
    createdAt: new Date().toISOString()
  };
  newLoan.installments.forEach(i => i.loanId = newLoan.id);

  localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify([...loans, newLoan]));
  return newLoan;
};

// Pagos
export const getPayments = (): PaymentReceipt[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
  return data ? JSON.parse(data) : [];
};

export const getClientPayments = (clientId: string): PaymentReceipt[] => {
    // Necesitamos filtrar pagos de préstamos que pertenecen al cliente
    const clientLoanIds = getClientLoans(clientId).map(l => l.id);
    const allPayments = getPayments();
    return allPayments
        .filter(p => clientLoanIds.includes(p.loanId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const processPayment = (loanId: string, installmentId: string, amount: number): PaymentReceipt => {
  const loans = getLoans();
  const loanIndex = loans.findIndex(l => l.id === loanId);
  if (loanIndex === -1) throw new Error("Préstamo no encontrado");

  const loan = loans[loanIndex];
  const instIndex = loan.installments.findIndex(i => i.id === installmentId);
  if (instIndex === -1) throw new Error("Cuota no encontrada");

  const installment = loan.installments[instIndex];
  
  const newPaidAmount = installment.paidAmount + amount;
  installment.paidAmount = newPaidAmount;
  
  if (newPaidAmount >= installment.expectedAmount) {
    installment.status = 'PAGADO';
    installment.paidAt = new Date().toISOString();
  } else {
    installment.status = 'PARCIAL';
  }

  const currentBalance = loan.balance - amount;
  if (currentBalance < 1) {
    loan.status = LoanStatus.COMPLETADO;
    loan.balance = 0;
  } else {
    loan.balance = parseFloat(currentBalance.toFixed(2));
  }

  const receipt: PaymentReceipt = {
    id: crypto.randomUUID(),
    loanId,
    installmentId,
    amount,
    date: new Date().toISOString()
  };
  
  const payments = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]');
  payments.push(receipt);
  
  loans[loanIndex] = loan;
  localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));

  return receipt;
};

initStorage();
