import { apiClient, AuditLogItem } from './apiClient';

export type AuditFilters = {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  userId?: string;
  action?: string;
  search?: string;
  entityId?: string;
  entityType?: string;
};

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<AuditLogItem[]> {
    const response = await apiClient.listAuditLogs(filters);
    return response.data;
  },
};
