import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from './current-user.js';

export const canAccessAllCompanyBranches = (user: AuthUser) =>
  user.role === 'Super Admin' || user.role === 'Administrador';

export const assertBranchScope = (user: AuthUser, branchId: string) => {
  if (canAccessAllCompanyBranches(user)) return;
  if (user.branchId === branchId) return;
  throw new ForbiddenException('Branch scope denied');
};

export const assertAssignedCollectorScope = (user: AuthUser, assignedUserId: string) => {
  if (user.role !== 'Cobrador') return;
  if (user.id === assignedUserId) return;
  throw new ForbiddenException('Collector scope denied');
};
