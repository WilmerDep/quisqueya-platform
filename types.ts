
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
  SUPER_ADMIN = 'Super Admin',
  ADMIN = 'Administrador',
  SUPERVISOR = 'Supervisor',
  COBRADOR = 'Cobrador'
}

export enum FichaType {
  BUENA = 'BUENA',
  REGULAR = 'REGULAR',
  MALA = 'MALA'
}

export enum ClientStatus {
  PENDING = 'Pendiente',
  APPROVED = 'Aprobado',
  REJECTED = 'Rechazado'
}

export enum RouteStatus {
  OPEN = 'Abierta',
  IN_PROGRESS = 'En Curso',
  CLOSED = 'Cerrada'
}

export type PlanFeature = 'MODULE_CASH' | 'MODULE_REPORTS' | 'MODULE_ROUTES' | 'MODULE_WHATSAPP' | 'MODULE_AUDIT';

export interface SaaSPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number;
  maxBranches: number;
  maxClients: number;
  features: PlanFeature[];
  isOffer: boolean;
  offerText?: string;
}

export interface Company {
  id: string;
  name: string;
  rnc?: string;
  logo?: string;
  status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';
  isGhostMode?: boolean; // Nuevo: Modo Fantasma
  planId: string; 
  billingCycle: 'MONTHLY' | 'YEARLY';
  expiresAt: string;
  billingDay: number;
  subscriptionPrice: number;
  createdAt: string;
  config: CompanyConfig;
}

export interface GlobalConfig {
  maintenanceMode: boolean;
  maintenanceDate: string;
  broadcastMessage: string;
  systemVersion: string;
}

export interface CompanyConfig {
  defaultMoraAmount: number;
  moraType: 'FLAT' | 'PERCENT' | 'DAILY';
  graceDays: number;
  currency: 'DOP';
  receiptFooter: string;
  scoringThresholdRegular: number;
  scoringThresholdMala: number;
  skipSundays: boolean;
  whatsappWelcomeTemplate: string;
  whatsappReceiptTemplate: string;
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  address: string;
  phone?: string;
  logo?: string;
  managerName?: string;
  monthlyGoal?: number;
}

export interface User {
  id: string;
  companyId: string; 
  linkedCompanyIds: string[]; 
  branchId: string;
  name: string;
  username: string;
  email?: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordUpdatedAt?: string;
  lastLoginAt?: string;
  role: Role;
  avatar?: string;
  photo?: string;
  isActive: boolean;
  phone?: string;
  createdAt: string;
  invitationStatus?: 'PENDIENTE' | 'ACEPTADA';
  invitationEmail?: string;
  invitedAt?: string;
  invitedByUserId?: string;
  firstAccessRequired?: boolean;
  permissions?: Record<string, boolean>;
}

export interface Client {
  id: string;
  companyId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  cedula: string;
  phone: string;
  address: string;
  assignedUserId: string;
  creditRating?: FichaType;
  isBlocked?: boolean;
  status: ClientStatus;
  photo?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface Ficha {
  id: string;
  clientId: string;
  type: FichaType;
  reason: string;
  note: string;
  createdAt: string;
}

export interface VisitLog {
  id: string;
  clientId: string;
  userId: string;
  date: string;
  result: 'COBRÓ' | 'NO ESTABA' | 'NO PAGÓ' | 'PROMETIÓ';
  note: string;
}

export interface PaymentPromise {
  id: string;
  clientId: string;
  loanId: string;
  date: string;
  amount: number;
  status: 'PENDIENTE' | 'CUMPLIDA' | 'INCUMPLIDA';
  note: string;
}

export interface Loan {
  id: string;
  companyId: string;
  branchId: string;
  clientId: string;
  amount: number;
  interestRate: number;
  frequency: Frequency;
  duration: number;
  startDate: string;
  totalToPay: number;
  balance: number;
  status: LoanStatus;
  installments: Installment[];
  createdAt: string;
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

export interface PaymentReceipt {
  id: string;
  companyId: string;
  branchId: string;
  loanId: string;
  installmentId: string;
  amount: number;
  date: string;
  moraPaid: number;
}

export interface CollectionRoute {
  id: string;
  companyId: string;
  branchId: string;
  collectorId: string;
  date: string;
  status: RouteStatus;
  items: RouteItem[];
}

export interface RouteItem {
  id: string;
  loanId: string;
  installmentId?: string; 
  clientId: string;
  clientName: string;
  address: string;
  amountToCollect: number;
  order: number;
  visitStatus: 'PENDING' | 'VISITED' | 'PAID' | 'PROMISED' | 'FAILED';
  visitResult?: 'COBRÓ' | 'NO ESTABA' | 'NO PAGÓ' | 'PROMETIÓ';
  notes?: string;
}

export type ActivityType = 'PAGO' | 'NOTA' | 'PROMESA' | 'CONDUCTA' | 'BLOQUEO' | 'PRESTAMO' | 'USER_MGMT' | 'APPROVAL' | 'ROUTE_CLOSE' | 'COMPANY_CREATE' | 'CASH_MOVE' | 'SECURITY';

export interface ActivityEvent {
  id: string;
  companyId: string;
  type: ActivityType;
  timestamp: string;
  clientId?: string;
  clientName?: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  amount?: number;
}

export interface CashMovement {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  userName: string;
  type: 'IN' | 'OUT';
  category: 'COBRO' | 'PRESTAMO' | 'GASTO' | 'APORTE' | 'COMISION' | 'DIETA' | 'GASOLINA' | 'RETIRO' | 'OTRO';
  amount: number;
  note: string;
  date: string;
}

export interface CashClosure {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  userId: string;
  userName: string;
  businessDate: string;
  theoreticalAmount: number;
  countedAmount: number;
  differenceAmount: number;
  status: 'BALANCED' | 'WITH_DIFFERENCE';
  note: string;
  closedAt: string;
}

export interface ReportExport {
  id: string;
  companyId: string;
  branchId?: string | null;
  userId: string;
  reportName: string;
  reportType: string;
  format: 'PDF' | 'CSV';
  rangeLabel: string;
  startDate?: string | null;
  endDate?: string | null;
  branchName?: string | null;
  collectorId?: string | null;
  collectorName?: string | null;
  fileSizeLabel?: string | null;
  createdAt: string;
}

export interface ReportSchedule {
  id: string;
  companyId: string;
  branchId?: string | null;
  userId: string;
  name: string;
  reportType: string;
  format: 'PDF' | 'CSV';
  frequency: string;
  deliveryHour: string;
  targetLabel: string;
  isActive: boolean;
  createdAt: string;
}

export interface ReportTemplate {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  reportType: string;
  status: string;
  isDefault: boolean;
  sections: string[];
  config?: ReportTemplateConfig;
  createdAt: string;
}

export interface ReportTemplateConfig {
  visualPreset?: 'CORPORATIVA_CLASICA' | 'FISCAL_ELECTRONICA' | 'FACTURA_FINANCIERA';
  description?: string;
  paperSize?: 'A4' | 'Carta' | 'Oficio';
  orientation?: 'Vertical' | 'Horizontal';
  marginPreset?: 'Compacto' | 'Normal' | 'Amplio';
  documentStyle?: 'Reporte premium' | 'Recibo de pago';
  visibleFields?: string[];
  receiptOptions?: {
    showNextInstallment: boolean;
    showRemainingBalance: boolean;
    includeSignature: boolean;
  };
  layoutPositions?: Record<
    string,
    { x: number; y: number; visible: boolean; width?: number; height?: number }
  >;
}
