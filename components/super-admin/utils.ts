import { InvitationType, RoleContext, SessionStatus, InvitationStatus } from './types';

export const getVisibleInternalRoleLabel = (role: string) => {
  if (role === 'Owner SaaS') return 'Propietario';
  return role
    .replace(/SaaS/g, 'plataforma')
    .replace(/Tenant/g, 'empresa');
};

export const getVisibleInvitationTypeLabel = (type: InvitationType) =>
  type === 'Equipo SaaS' ? 'Equipo interno' : 'Usuario de empresa';

export const getVisibleSessionTypeLabel = (type: string) =>
  type === 'SaaS' ? 'Interno' : 'Empresa';

export const getVisibleRoleContextLabel = (context: RoleContext) =>
  context === 'SaaS' ? 'interno' : 'empresa';

export const getVisiblePermissionLabel = (permission: string) => {
  const permissionMap: Record<string, string> = {
    'saas.companies.view': 'Ver empresas',
    'saas.billing.manage': 'Gestionar facturación',
    'saas.billing.view': 'Ver facturación',
    'saas.audit.view': 'Ver auditoría',
    'saas.reports.view': 'Ver reportes globales',
    'saas.users.manage': 'Gestionar usuarios internos',
    'saas.users.view': 'Ver usuarios internos',
    'saas.support.impersonate': 'Acceso de soporte',
    'saas.companies.update': 'Editar empresas',
    'saas.owner': 'Administración global',
    'saas.config.manage': 'Gestionar configuración global',
    'tenant.clients.view': 'Ver clientes',
    'tenant.loans.create': 'Crear préstamos',
    'tenant.users.manage': 'Gestionar usuarios',
    'tenant.payments.create': 'Registrar pagos',
    'tenant.routes.view': 'Ver rutas',
    'tenant.cash.close': 'Cerrar caja',
    'tenant.reports.view': 'Ver reportes',
  };

  return permissionMap[permission] || permission;
};

export const getSessionTone = (status: SessionStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'Activa') return 'success';
  if (status === 'Sospechosa') return 'warning';
  if (status === 'Revocada') return 'danger';
  return 'neutral';
};

export const getUserRoleTone = (role: string): 'success' | 'blue' | 'warning' => {
  if (role === 'Cobrador' || role === 'COBRADOR') return 'success';
  if (role === 'Supervisor' || role === 'SUPERVISOR') return 'warning';
  return 'blue';
};

export const getInvitationTone = (status: InvitationStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'Aceptada') return 'success';
  if (status === 'Pendiente') return 'warning';
  if (status === 'Revocada') return 'danger';
  return 'neutral';
};
