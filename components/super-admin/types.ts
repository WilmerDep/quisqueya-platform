import { Role } from '../../types';

export type SuperAdminTab =
  | 'DASHBOARD'
  | 'COMPANIES'
  | 'GLOBAL_USERS'
  | 'PLANS'
  | 'BILLING'
  | 'REPORTS'
  | 'AUDIT'
  | 'SYSTEM'
  | 'HELP';

export type UsersManagementTab = 'SAAS_TEAM' | 'TENANT_USERS' | 'INVITATIONS' | 'ROLES' | 'SESSIONS';

export type UsersFilterOption = {
  value: string;
  label: string;
};

export type UsersFilterConfig = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: UsersFilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string;
};

export type TenantUserSortKey = 'name' | 'companyName' | 'branchName' | 'role' | 'status' | 'lastAccess' | 'twoFactorStatus';

export type TenantUserRow = {
  id: string;
  code: string;
  companyId: string;
  branchId: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  branchName: string;
  role: Role;
  status: string;
  isActive: boolean;
  lastAccess: string;
  lastAccessBucket: string;
  twoFactorStatus: string;
  permissions: Record<string, boolean>;
  createdAt: string;
};

export type TenantUserActionKind =
  | 'view-profile'
  | 'open-company'
  | 'open-context'
  | 'sessions'
  | 'activity'
  | 'change-role'
  | 'change-branch'
  | 'reset-access'
  | 'revoke-sessions'
  | 'suspend'
  | 'reactivate'
  | 'audit'
  | 'support-access';

export type SaasRole = string;
export type SaasMemberStatus = 'Activo' | 'Pendiente' | 'Suspendido';

export type SaasMember = {
  id: string;
  userScope: 'SAAS';
  companyId: null;
  name: string;
  email: string;
  phone: string;
  role: SaasRole;
  area: string;
  status: SaasMemberStatus;
  lastAccess: string;
  twoFactor: boolean;
  criticalAccess: boolean;
  sessions: number;
  createdAt: string;
  permissions: string[];
  isOwner?: boolean;
};

export type SaasMemberActionKind =
  | 'view-profile'
  | 'edit'
  | 'change-role'
  | 'configure-permissions'
  | 'force-password'
  | 'force-2fa'
  | 'revoke-sessions'
  | 'suspend'
  | 'reactivate'
  | 'audit';

export type InvitationStatus = 'Pendiente' | 'Aceptada' | 'Expirada' | 'Revocada';
export type InvitationType = 'Equipo SaaS' | 'Usuario de empresa';

export type InvitationRow = {
  id: string;
  email: string;
  type: InvitationType;
  company: string;
  companyId: string | null;
  branch: string;
  branchId: string | null;
  role: SaasRole | Role;
  invitedBy: string;
  date: string;
  expiresAt: string;
  status: InvitationStatus;
  token: string;
  acceptedUserId?: string;
};

export type InvitationActionKind =
  | 'resend'
  | 'copy-link'
  | 'edit-role'
  | 'change-company'
  | 'change-branch'
  | 'extend-expiration'
  | 'revoke'
  | 'renew'
  | 'open-user';

export type RoleContext = 'SaaS' | 'Tenant';
export type RoleActionKind = 'create' | 'edit' | 'duplicate' | 'assign-users' | 'compare' | 'archive' | 'restore' | 'history';
export type PermissionModule = {
  module: string;
  permissions: string[];
  critical?: string[];
};

export type SuperAdminIcon = React.ComponentType<{ size: number; className?: string }>;
export type SessionStatus = 'Activa' | 'Inactiva' | 'Sospechosa' | 'Revocada' | 'Expirada';
export type SessionActionKind =
  | 'view-detail'
  | 'mark-suspicious'
  | 'revoke'
  | 'revoke-all'
  | 'revoke-all-except-current'
  | 'block-ip'
  | 'force-password'
  | 'suspend-user'
  | 'activity';
