import { Branch, CashClosure, CashMovement, Client, CollectionRoute, Company, Loan, PaymentReceipt, ReportExport, ReportSchedule, ReportTemplate, RouteItem, RouteStatus, User } from '../types';
import { ApiItemResponse, ApiListResponse, AuthLoginRequest, AuthLoginResponse } from './apiContract';
import { clearSession, createApiSession, persistSession, readSession } from './authService';
import { openPlatformBlockingState } from './platformEvents';

const API_BASE_URL =
  ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');

export class ApiUnavailableError extends Error {
  constructor(message = 'API unavailable') {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type ApiEnvelope<T> = { data: T };

export interface ReportSummary {
  loans: {
    total: number;
    active: number;
    completed: number;
    portfolio: number;
    lent: number;
    expectedInterest: number;
  };
  payments: {
    collected: number;
    receipts: number;
    moraCollected: number;
    voidedPayments: number;
  };
  cash: {
    balance: number;
    cashIn: number;
    cashOut: number;
  };
  overdue: {
    overdueLoans: number;
    overdueAmount: number;
  };
  routes: {
    totalRoutes: number;
    closedRoutes: number;
  };
  filters: {
    startDate: string | null;
    endDate: string | null;
    branchId: string | null;
    collectorId: string | null;
  };
}

export interface AuditLogItem {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  actorUserId: string;
  actorName: string;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  title: string;
  description: string;
  activityType: string;
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'La API no respondio correctamente';
    throw new ApiRequestError(message, response.status);
  }

  return payload as T;
};

let refreshPromise: Promise<string | null> | null = null;

const emitAuthExpired = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
};

const refreshAccessToken = async (): Promise<string | null> => {
  const session = readSession();
  if (!session?.refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });

        const payload = await parseResponse<ApiEnvelope<AuthLoginResponse>>(response);
        const refreshed = payload.data;
        persistSession(createApiSession(refreshed.user.id, refreshed.accessToken, refreshed.refreshToken));
        return refreshed.accessToken;
      } catch {
        clearSession();
        emitAuthExpired();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

const request = async <T>(path: string, options: RequestInit = {}, allowRetry = true) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    return parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401 && allowRetry) {
      const nextToken = await refreshAccessToken();
      if (nextToken) {
        const nextHeaders = new Headers(options.headers || {});
        nextHeaders.set('Authorization', `Bearer ${nextToken}`);
        return request<T>(
          path,
          {
            ...options,
            headers: nextHeaders,
          },
          false,
        );
      }
    }
    if (error instanceof ApiRequestError) {
      if (error.status === 403) {
        openPlatformBlockingState({
          id: 'permission-denied',
          kind: 'permission-denied',
          title: 'Sin permisos',
          message: 'No tienes permisos para acceder a esta seccion o ejecutar esta accion.',
          primaryLabel: 'Volver al inicio',
          primaryHref: '/',
          secondaryLabel: 'Seguir revisando',
          secondaryHref: window.location.hash?.replace(/^#/, '') || '/',
          dismissible: true,
        });
      }
      throw error;
    }
    throw new ApiUnavailableError(error instanceof Error ? error.message : 'API unavailable');
  }
};

const authHeaders = () => {
  const token = readSession()?.accessToken;
  if (!token) throw new ApiUnavailableError('Missing API session');
  return { Authorization: `Bearer ${token}` };
};

export const apiClient = {
  async login(payload: AuthLoginRequest): Promise<AuthLoginResponse> {
    const response = await request<ApiEnvelope<AuthLoginResponse>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.data;
  },

  async refresh(refreshToken: string): Promise<AuthLoginResponse> {
    const response = await request<ApiEnvelope<AuthLoginResponse>>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    return response.data;
  },

  async me(accessToken: string): Promise<ApiItemResponse<User>> {
    return request<ApiItemResponse<User>>('/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  },

  async getMyCompany(): Promise<ApiItemResponse<Company>> {
    return request<ApiItemResponse<Company>>('/companies/me', {
      headers: authHeaders(),
    });
  },

  async updateMyCompany(payload: Partial<Company>): Promise<ApiItemResponse<Company>> {
    return request<ApiItemResponse<Company>>('/companies/me', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listClients(): Promise<ApiListResponse<Client>> {
    return request<ApiListResponse<Client>>('/clients', {
      headers: authHeaders(),
    });
  },

  async listUsers(): Promise<ApiListResponse<User>> {
    return request<ApiListResponse<User>>('/users', {
      headers: authHeaders(),
    });
  },

  async createUser(payload: Partial<User> & { password?: string }): Promise<ApiItemResponse<User>> {
    return request<ApiItemResponse<User>>('/users', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async updateUser(userId: string, payload: Partial<User>): Promise<ApiItemResponse<User>> {
    return request<ApiItemResponse<User>>(`/users/${userId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listBranches(): Promise<ApiListResponse<Branch>> {
    return request<ApiListResponse<Branch>>('/branches', {
      headers: authHeaders(),
    });
  },

  async createBranch(payload: Partial<Branch>): Promise<ApiItemResponse<Branch>> {
    return request<ApiItemResponse<Branch>>('/branches', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async updateBranch(branchId: string, payload: Partial<Branch>): Promise<ApiItemResponse<Branch>> {
    return request<ApiItemResponse<Branch>>(`/branches/${branchId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async deleteBranch(branchId: string): Promise<ApiItemResponse<{ id: string }>> {
    return request<ApiItemResponse<{ id: string }>>(`/branches/${branchId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  async createClient(payload: Partial<Client>): Promise<ApiItemResponse<Client>> {
    return request<ApiItemResponse<Client>>('/clients', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async updateClient(clientId: string, payload: Partial<Client>): Promise<ApiItemResponse<Client>> {
    return request<ApiItemResponse<Client>>(`/clients/${clientId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listLoans(): Promise<ApiListResponse<Loan>> {
    return request<ApiListResponse<Loan>>('/loans', {
      headers: authHeaders(),
    });
  },

  async createLoan(payload: Partial<Loan>): Promise<ApiItemResponse<Loan>> {
    return request<ApiItemResponse<Loan>>('/loans', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listPayments(): Promise<ApiListResponse<PaymentReceipt>> {
    return request<ApiListResponse<PaymentReceipt>>('/payments', {
      headers: authHeaders(),
    });
  },

  async getReportSummary(params: { startDate?: string; endDate?: string; branchId?: string; collectorId?: string } = {}): Promise<ApiItemResponse<ReportSummary>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<ApiItemResponse<ReportSummary>>(`/reports/summary${suffix}`, {
      headers: authHeaders(),
    });
  },

  async listReportExports(params: { branchId?: string; format?: 'PDF' | 'CSV' } = {}): Promise<ApiListResponse<ReportExport>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<ApiListResponse<ReportExport>>(`/reports/exports${suffix}`, {
      headers: authHeaders(),
    });
  },

  async createReportExport(payload: {
    reportName: string;
    reportType: string;
    format: 'PDF' | 'CSV';
    rangeLabel: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
    branchName?: string;
    collectorId?: string;
    collectorName?: string;
    fileSizeLabel?: string;
    filters?: Record<string, unknown>;
  }): Promise<ApiItemResponse<ReportExport>> {
    return request<ApiItemResponse<ReportExport>>('/reports/exports', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listReportSchedules(params: { branchId?: string } = {}): Promise<ApiListResponse<ReportSchedule>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<ApiListResponse<ReportSchedule>>(`/reports/schedules${suffix}`, {
      headers: authHeaders(),
    });
  },

  async createReportSchedule(payload: {
    name: string;
    reportType: string;
    format: 'PDF' | 'CSV';
    frequency: string;
    deliveryHour: string;
    targetLabel: string;
    branchId?: string;
  }): Promise<ApiItemResponse<ReportSchedule>> {
    return request<ApiItemResponse<ReportSchedule>>('/reports/schedules', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listReportTemplates(): Promise<ApiListResponse<ReportTemplate>> {
    return request<ApiListResponse<ReportTemplate>>('/reports/templates', {
      headers: authHeaders(),
    });
  },

  async createReportTemplate(payload: {
    name: string;
    reportType: string;
    status: string;
    isDefault?: boolean;
    sections: string[];
    config?: ReportTemplate['config'];
  }): Promise<ApiItemResponse<ReportTemplate>> {
    return request<ApiItemResponse<ReportTemplate>>('/reports/templates', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async updateReportTemplate(templateId: string, payload: {
    name?: string;
    reportType?: string;
    status?: string;
    isDefault?: boolean;
    sections?: string[];
    config?: ReportTemplate['config'];
  }): Promise<ApiItemResponse<ReportTemplate>> {
    return request<ApiItemResponse<ReportTemplate>>(`/reports/templates/${templateId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listAuditLogs(params: { startDate?: string; endDate?: string; branchId?: string; userId?: string; action?: string; search?: string; entityId?: string; entityType?: string } = {}): Promise<ApiListResponse<AuditLogItem>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<ApiListResponse<AuditLogItem>>(`/audit-logs${suffix}`, {
      headers: authHeaders(),
    });
  },

  async createPayment(payload: Partial<PaymentReceipt>): Promise<ApiItemResponse<PaymentReceipt>> {
    return request<ApiItemResponse<PaymentReceipt>>('/payments', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async voidPayment(paymentId: string, reason: string): Promise<ApiItemResponse<{ id: string; paymentId: string }>> {
    return request<ApiItemResponse<{ id: string; paymentId: string }>>(`/payments/${paymentId}/void`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
  },

  async listCashMovements(): Promise<ApiListResponse<CashMovement>> {
    return request<ApiListResponse<CashMovement>>('/cash-movements', {
      headers: authHeaders(),
    });
  },

  async createCashMovement(payload: { branchId: string; type: 'IN' | 'OUT'; category: CashMovement['category']; amount: number; note?: string }): Promise<ApiItemResponse<CashMovement>> {
    return request<ApiItemResponse<CashMovement>>('/cash-movements', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listCashClosures(): Promise<ApiListResponse<CashClosure>> {
    return request<ApiListResponse<CashClosure>>('/cash-closures', {
      headers: authHeaders(),
    });
  },

  async closeCash(payload: { branchId: string; countedAmount: number; note?: string; businessDate?: string }): Promise<ApiItemResponse<CashClosure>> {
    return request<ApiItemResponse<CashClosure>>('/cash-closures', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async listRoutes(): Promise<ApiListResponse<CollectionRoute>> {
    return request<ApiListResponse<CollectionRoute>>('/routes', {
      headers: authHeaders(),
    });
  },

  async createRoute(payload: Partial<CollectionRoute>): Promise<ApiItemResponse<CollectionRoute>> {
    return request<ApiItemResponse<CollectionRoute>>('/routes', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async updateRouteStatus(routeId: string, status: RouteStatus): Promise<ApiItemResponse<CollectionRoute>> {
    return request<ApiItemResponse<CollectionRoute>>(`/routes/${routeId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
  },

  async updateRouteItem(routeId: string, itemId: string, payload: Partial<RouteItem>): Promise<ApiItemResponse<RouteItem>> {
    return request<ApiItemResponse<RouteItem>>(`/routes/${routeId}/items/${itemId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  async closeRoute(routeId: string, cashInHand: number): Promise<ApiItemResponse<CollectionRoute>> {
    return request<ApiItemResponse<CollectionRoute>>(`/routes/${routeId}/close`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ cashInHand }),
    });
  },
};
