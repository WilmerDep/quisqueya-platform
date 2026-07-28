import type { Branch, User } from '../types';
import { apiClient } from './apiClient';

export type TeamSnapshot = {
  users: User[];
  branches: Branch[];
};

export const teamService = {
  async list(): Promise<TeamSnapshot> {
    const [usersResponse, branchesResponse] = await Promise.all([
      apiClient.listUsers(),
      apiClient.listBranches(),
    ]);

    return {
      users: usersResponse.data,
      branches: branchesResponse.data,
    };
  },

  async updateStatus(userId: string, isActive: boolean): Promise<User> {
    const response = await apiClient.updateUser(userId, { isActive });
    return response.data;
  },
};
