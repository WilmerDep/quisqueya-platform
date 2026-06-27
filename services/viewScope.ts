import { Branch, CashMovement, Client, Loan, User } from '../types';
import {
  getBranches,
  getCashMovements,
  getClients,
  getLoans,
  getUsers,
  canViewAllCompanyUsers,
  getVisibleBranchIdsForUser,
} from './dataService';

export interface BranchScope {
  canSeeAllCompanyUsers: boolean;
  visibleBranchIds: string[];
  branches: Branch[];
  defaultBranchId: string;
}

export const getBranchScope = (user: User): BranchScope => {
  const visibleBranchIds = getVisibleBranchIdsForUser(user);
  const branches = getBranches(user.companyId).filter(branch => visibleBranchIds.includes(branch.id));

  return {
    canSeeAllCompanyUsers: canViewAllCompanyUsers(user),
    visibleBranchIds,
    branches,
    defaultBranchId: user.branchId,
  };
};

export const getScopedUsers = (user: User, branchId?: string) => {
  const scope = getBranchScope(user);
  const effectiveBranchId = branchId || scope.defaultBranchId;
  return getUsers(user.companyId).filter(item => scope.canSeeAllCompanyUsers ? (!effectiveBranchId || item.branchId === effectiveBranchId) : item.branchId === user.branchId);
};

export const getScopedClients = (user: User, branchId?: string) => {
  const scope = getBranchScope(user);
  const effectiveBranchId = branchId || scope.defaultBranchId;
  return getClients(user.companyId).filter(item => scope.visibleBranchIds.includes(item.branchId) && (!effectiveBranchId || item.branchId === effectiveBranchId));
};

export const getScopedLoans = (user: User, branchId?: string) => {
  const scope = getBranchScope(user);
  const effectiveBranchId = branchId || scope.defaultBranchId;
  return getLoans(user.companyId).filter(item => scope.visibleBranchIds.includes(item.branchId) && (!effectiveBranchId || item.branchId === effectiveBranchId));
};

export const getScopedCashMovements = (user: User, branchId?: string): CashMovement[] => {
  const scope = getBranchScope(user);
  const effectiveBranchId = branchId || scope.defaultBranchId;
  return getCashMovements(user.companyId, effectiveBranchId).filter(item => scope.visibleBranchIds.includes(item.branchId));
};
