import { Branch, CashMovement, Client, Loan, Role, User } from '../types';
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
  const isCollector = user.role === Role.COBRADOR;

  return getClients(user.companyId).filter(item => {
    const matchesBranch = scope.visibleBranchIds.includes(item.branchId) && (!effectiveBranchId || item.branchId === effectiveBranchId);
    if (!matchesBranch) return false;
    if (isCollector) {
      return item.assignedUserId === user.id;
    }
    return true;
  });
};

export const getScopedLoans = (user: User, branchId?: string) => {
  const scope = getBranchScope(user);
  const effectiveBranchId = branchId || scope.defaultBranchId;
  const isCollector = user.role === Role.COBRADOR;

  // Obtener primero los IDs de clientes permitidos
  const allowedClientIds = new Set(getScopedClients(user, effectiveBranchId).map(c => c.id));

  return getLoans(user.companyId).filter(item => {
    const matchesBranch = scope.visibleBranchIds.includes(item.branchId) && (!effectiveBranchId || item.branchId === effectiveBranchId);
    if (!matchesBranch) return false;
    return allowedClientIds.has(item.clientId);
  });
};

export const getScopedCashMovements = (user: User, branchId?: string): CashMovement[] => {
  const scope = getBranchScope(user);
  const effectiveBranchId = branchId || scope.defaultBranchId;
  const isCollector = user.role === Role.COBRADOR;

  return getCashMovements(user.companyId, effectiveBranchId).filter(item => {
    const matchesBranch = scope.visibleBranchIds.includes(item.branchId);
    if (!matchesBranch) return false;
    if (isCollector) {
      // Un cobrador solo ve sus propios movimientos de caja
      return item.userId === user.id;
    }
    return true;
  });
};
