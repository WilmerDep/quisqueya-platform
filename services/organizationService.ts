import { Company, Branch } from '../types';
import { apiClient } from './apiClient';

export type OrganizationSnapshot = {
  company: Company;
  branches: Branch[];
};

export const organizationService = {
  async load(): Promise<OrganizationSnapshot> {
    const [company, branches] = await Promise.all([
      apiClient.getMyCompany(),
      apiClient.listBranches(),
    ]);

    return {
      company: company.data,
      branches: branches.data,
    };
  },

  async updateCompany(payload: Partial<Company>): Promise<Company> {
    const response = await apiClient.updateMyCompany(payload);
    return response.data;
  },

  async createBranch(payload: Partial<Branch>): Promise<Branch> {
    const response = await apiClient.createBranch(payload);
    return response.data;
  },

  async updateBranch(branchId: string, payload: Partial<Branch>): Promise<Branch> {
    const response = await apiClient.updateBranch(branchId, payload);
    return response.data;
  },

  async deleteBranch(branchId: string): Promise<void> {
    await apiClient.deleteBranch(branchId);
  },
};
