
export enum Frequency {
  DIARIO = 'Diario',
  SEMANAL = 'Semanal',
  QUINCENAL = 'Quincenal',
  MENSUAL = 'Mensual'
}

export enum LoanStatus {
  ACTIVO = 'Activo',
  COMPLETADO = 'Saldado',
  MORA = 'En Mora',
  CANCELADO = 'Cancelado'
}

export enum Role {
  ADMIN = 'Administrador',
  SUPERVISOR = 'Supervisor',
  COBRADOR = 'Cobrador'
}

export enum FichaType {
  BUENA = 'BUENA',     // Verde
  REGULAR = 'REGULAR', // Amarillo
  MALA = 'MALA'        // Rojo
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar?: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  cedula: string;
  phone: string;
  address: string;
  assignedUserId?: string;
  creditRating?: FichaType; // Nuevo campo
  createdAt: string;
}

export interface Ficha {
  id: string;
  clientId: string;
  type: FichaType;
  reason: string;
  note?: string;
  createdBy: string; // User ID
  createdAt: string;
  isArchived: boolean;
}

export interface Installment {
  id: string;
  loanId: string;
  number: number;
  dueDate: string;
  expectedAmount: number;
  paidAmount: number;
  status: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
  paidAt?: string;
}

export interface Loan {
  id: string;
  clientId: string;
  amount: number;
  interestRate: number;
  interestType: 'FLAT' | 'AMORTIZADO';
  frequency: Frequency;
  duration: number;
  startDate: string;
  totalToPay: number;
  balance: number;
  status: LoanStatus;
  installments: Installment[];
  createdAt: string;
}

export interface PaymentReceipt {
  id: string;
  loanId: string;
  installmentId: string;
  amount: number;
  date: string;
  note?: string;
}

export interface DashboardStats {
  totalLent: number;
  totalCollectedToday: number;
  pendingToday: number;
  activeLoansCount: number;
}
