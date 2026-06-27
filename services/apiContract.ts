import { Branch, CashClosure, CashMovement, Client, CollectionRoute, Company, Loan, PaymentReceipt, User } from '../types';

export interface ApiListResponse<T> {
  data: T[];
}

export interface ApiItemResponse<T> {
  data: T;
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface TenantScopedRequest {
  companyId: string;
  branchId?: string;
}

export interface PrestafacilApi {
  login(payload: AuthLoginRequest): Promise<AuthLoginResponse>;
  refresh(refreshToken: string): Promise<AuthLoginResponse>;
  me(): Promise<ApiItemResponse<User>>;
  listCompanies(): Promise<ApiListResponse<Company>>;
  listBranches(scope: TenantScopedRequest): Promise<ApiListResponse<Branch>>;
  listUsers(scope: TenantScopedRequest): Promise<ApiListResponse<User>>;
  listClients(scope: TenantScopedRequest): Promise<ApiListResponse<Client>>;
  listLoans(scope: TenantScopedRequest): Promise<ApiListResponse<Loan>>;
  listPayments(scope: TenantScopedRequest): Promise<ApiListResponse<PaymentReceipt>>;
  listRoutes(scope: TenantScopedRequest): Promise<ApiListResponse<CollectionRoute>>;
  listCashMovements(scope: TenantScopedRequest): Promise<ApiListResponse<CashMovement>>;
  createCashMovement(payload: { branchId: string; type: 'IN' | 'OUT'; category: CashMovement['category']; amount: number; note?: string }): Promise<ApiItemResponse<CashMovement>>;
  listCashClosures(scope: TenantScopedRequest): Promise<ApiListResponse<CashClosure>>;
  closeCash(payload: { branchId: string; countedAmount: number; note?: string; businessDate?: string }): Promise<ApiItemResponse<CashClosure>>;
  pullSync(): Promise<ApiItemResponse<{ routes: CollectionRoute[]; routeItems: unknown[]; serverTime: string }>>;
  pushSync(actions: Array<Record<string, unknown>>): Promise<ApiItemResponse<{ accepted: number }>>;
}

export const API_SECURITY_INVARIANTS = [
  'Every write request must validate the authenticated user, companyId, role, and branch scope on the server.',
  'Client identity documents, photos, loans, payments, and cash movements must not be stored as browser-only state.',
  'Audit records must be append-only and include actor id, company id, timestamp, action, and before/after context when available.',
] as const;
