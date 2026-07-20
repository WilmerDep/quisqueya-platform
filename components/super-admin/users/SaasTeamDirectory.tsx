import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Users, Search, MoreHorizontal, UserCog, Edit3, Crown, ShieldCheck, RefreshCw, ShieldAlert, Activity, CheckCircle2, FileClock } from 'lucide-react';
import { SaasMember, SaasMemberActionKind } from '../types';
import { platformMotionButtonClass as motionButtonClass, platformShellCardClass as shellCardClass } from '../../../components/ui/platformStyles';
import { StatusBadge } from '../ui/Shared';
import { getVisibleInternalRoleLabel } from '../utils';
import { UserAvatar } from '../ui/Shared';
import { TenantUsersSkeleton, TenantUsersState, TenantUserActionButton } from './TenantUsersDirectory';

export const SaasMemberActionsCell = ({ member, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { member: SaasMember; onAction: (member: SaasMember, action: SaasMemberActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  const menuId = `saas-member-${member.id}`;
  return (
    <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones de ${member.name}`}>
        <MoreHorizontal size={16} />
      </button>
      {activeActionsDropdown === menuId && dropdownCoords && createPortal(
        <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[260px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
          <TenantUserActionButton icon={UserCog} label="Ver perfil" onClick={() => onAction(member, 'view-profile')} />
          <TenantUserActionButton icon={Edit3} label="Editar" onClick={() => onAction(member, 'edit')} />
          <TenantUserActionButton icon={Crown} label="Cambiar rol" onClick={() => onAction(member, 'change-role')} />
          <TenantUserActionButton icon={ShieldCheck} label="Configurar permisos" onClick={() => onAction(member, 'configure-permissions')} />
          <TenantUserActionButton icon={RefreshCw} label="Forzar cambio de contraseña" onClick={() => onAction(member, 'force-password')} />
          <TenantUserActionButton icon={ShieldAlert} label="Forzar 2FA" onClick={() => onAction(member, 'force-2fa')} />
          <TenantUserActionButton icon={Activity} label="Revocar sesiones" tone="danger" onClick={() => onAction(member, 'revoke-sessions')} />
          <TenantUserActionButton icon={member.status === 'Suspendido' ? CheckCircle2 : AlertTriangle} label={member.status === 'Suspendido' ? 'Reactivar' : 'Suspender'} tone={member.status === 'Suspendido' ? 'success' : 'danger'} onClick={() => onAction(member, member.status === 'Suspendido' ? 'reactivate' : 'suspend')} />
          <TenantUserActionButton icon={FileClock} label="Ver auditoría" onClick={() => onAction(member, 'audit')} />
        </div>,
        document.body,
      )}
    </div>
  );
};

export const SaasTeamMobileCard = ({ member, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { member: SaasMember; onAction: (member: SaasMember, action: SaasMemberActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="space-y-4 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar name={member.name} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#111827]">{member.name}</p>
          <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{member.email}</p>
        </div>
      </div>
      <SaasMemberActionsCell member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
    </div>
    <div className="flex flex-wrap gap-2">
      <StatusBadge label={getVisibleInternalRoleLabel(member.role)} tone={member.role === 'Owner SaaS' || member.role === 'Super Admin' ? 'blue' : 'neutral'} />
      <StatusBadge label={member.status} tone={member.status === 'Activo' ? 'success' : member.status === 'Suspendido' ? 'danger' : 'warning'} />
      <StatusBadge label={member.twoFactor ? '2FA activo' : '2FA pendiente'} tone={member.twoFactor ? 'success' : 'warning'} />
    </div>
  </div>
);

export const SaasTeamTableRow = ({ member, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { member: SaasMember; onAction: (member: SaasMember, action: SaasMemberActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div data-super-row className="group grid grid-cols-[minmax(0,1.45fr)_0.8fr_0.64fr_0.5fr_0.76fr_0.48fr_0.66fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#F8FAFC] hover:translate-x-1">
    <div className="flex min-w-0 items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
      <UserAvatar name={member.name} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{member.name}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{member.email}</p>
      </div>
    </div>
    <StatusBadge label={getVisibleInternalRoleLabel(member.role)} tone={member.role === 'Owner SaaS' || member.role === 'Super Admin' ? 'blue' : 'neutral'} />
    <StatusBadge label={member.status} tone={member.status === 'Activo' ? 'success' : member.status === 'Suspendido' ? 'danger' : 'warning'} />
    <StatusBadge label={member.twoFactor ? 'Activo' : 'Pendiente'} tone={member.twoFactor ? 'success' : 'warning'} />
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{member.lastAccess}</div>
    <div className="text-[14px] font-semibold text-[#111827]">{member.sessions}</div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{member.createdAt}</div>
    <SaasMemberActionsCell member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
  </div>
);

export const SaasTeamDirectory = ({
  rows,
  totalRows,
  isLoading,
  error,
  onAction,
  activeActionsDropdown,
  dropdownCoords,
  openContextMenu,
}: {
  rows: SaasMember[];
  totalRows: number;
  isLoading: boolean;
  error: string;
  onAction: (member: SaasMember, action: SaasMemberActionKind) => void;
  activeActionsDropdown: string | null;
  dropdownCoords: { top: number; left: number; openUpward: boolean } | null;
  openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void;
}) => {
  if (isLoading) return <TenantUsersSkeleton />;
  if (error) return <TenantUsersState icon={AlertTriangle} title="No se pudo cargar el equipo interno" detail={error} tone="danger" />;
  if (!totalRows) return <TenantUsersState icon={Users} title="Sin miembros internos" detail="Aún no hay operadores internos registrados." tone="neutral" />;
  if (!rows.length) return <TenantUsersState icon={Search} title="Sin resultados" detail="Ajusta la búsqueda para ver más miembros internos." tone="warning" />;

  return (
    <div data-super-panel className={`${shellCardClass} overflow-visible`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Directorio del equipo interno</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Solo miembros internos de ABUNDRA, sin empresa asignada.</p>
        </div>
        <StatusBadge label={`${rows.length} visibles`} tone="blue" />
      </div>
      <div className="hidden lg:block">
        <div className="grid grid-cols-[minmax(0,1.45fr)_0.8fr_0.64fr_0.5fr_0.76fr_0.48fr_0.66fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
          <div>Usuario</div>
          <div>Rol interno</div>
          <div>Estado</div>
          <div>2FA</div>
          <div>Último acceso</div>
          <div>Ses.</div>
          <div>Creado</div>
          <div className="text-center">Acc.</div>
        </div>
        <div className="divide-y divide-[#EEF2F7]">
          {rows.map(member => (
            <SaasTeamTableRow key={member.id} member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#EEF2F7] lg:hidden">
        {rows.map(member => (
          <SaasTeamMobileCard key={member.id} member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
        ))}
      </div>
    </div>
  );
};