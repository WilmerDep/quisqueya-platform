import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Bell, Search, MoreHorizontal, Eye, RefreshCw, CheckCircle2, Trash2, Globe, Crown, Building2, MapPin, CalendarCheck, ShieldAlert, Sparkles, UserCog } from 'lucide-react';
import { InvitationRow, InvitationActionKind } from '../types';
import { platformMotionButtonClass as motionButtonClass, platformShellCardClass as shellCardClass } from '../../../components/ui/platformStyles';
import { StatusBadge } from '../ui/Shared';
import { getInvitationTone, getVisibleRoleContextLabel, getVisibleInvitationTypeLabel, getVisibleInternalRoleLabel } from '../utils';
import { TenantUsersSkeleton, TenantUsersState, TenantUserActionButton } from './TenantUsersDirectory';

export const InvitationActionsCell = ({ invitation, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { invitation: InvitationRow; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  const menuId = `invitation-row-${invitation.id}`;
  return (
    <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones de invitación ${invitation.email}`}>
        <MoreHorizontal size={16} />
      </button>
      {activeActionsDropdown === menuId && dropdownCoords && createPortal(
        <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[250px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
          <TenantUserActionButton icon={RefreshCw} label="Reenviar" onClick={() => onAction(invitation, 'resend')} />
          <TenantUserActionButton icon={Globe} label="Copiar enlace" onClick={() => onAction(invitation, 'copy-link')} />
          <TenantUserActionButton icon={Crown} label="Editar rol" onClick={() => onAction(invitation, 'edit-role')} />
          <TenantUserActionButton icon={Building2} label="Cambiar empresa" onClick={() => onAction(invitation, 'change-company')} />
          <TenantUserActionButton icon={MapPin} label="Cambiar sucursal" onClick={() => onAction(invitation, 'change-branch')} />
          <TenantUserActionButton icon={CalendarCheck} label="Extender expiración" onClick={() => onAction(invitation, 'extend-expiration')} />
          <TenantUserActionButton icon={ShieldAlert} label="Revocar" tone="danger" onClick={() => onAction(invitation, 'revoke')} />
          <TenantUserActionButton icon={Sparkles} label="Renovar" onClick={() => onAction(invitation, 'renew')} />
          <TenantUserActionButton icon={UserCog} label="Abrir usuario" onClick={() => onAction(invitation, 'open-user')} />
        </div>,
        document.body,
      )}
    </div>
  );
};

export const InvitationMobileCard = ({ invitation, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { invitation: InvitationRow; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="space-y-4 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-[#111827]">{invitation.email}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{invitation.company} · {invitation.branch}</p>
      </div>
      <InvitationActionsCell invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
    </div>
    <div className="flex flex-wrap gap-2">
      <StatusBadge label={getVisibleInvitationTypeLabel(invitation.type)} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'neutral'} />
      <StatusBadge label={invitation.type === 'Equipo SaaS' ? getVisibleInternalRoleLabel(invitation.role) : `${invitation.role}`} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'success'} />
      <StatusBadge label={invitation.status} tone={getInvitationTone(invitation.status)} />
    </div>
  </div>
);

export const InvitationTableRow = ({ invitation, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { invitation: InvitationRow; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div data-super-row className="group grid grid-cols-[minmax(0,1.15fr)_0.68fr_minmax(0,0.9fr)_0.64fr_0.72fr_0.62fr_0.62fr_0.62fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#F8FAFC] hover:translate-x-1">
    <div className="truncate text-[14px] font-semibold text-[#111827] transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-[#2563EB]">{invitation.email}</div>
    <StatusBadge label={getVisibleInvitationTypeLabel(invitation.type)} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'neutral'} />
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-[#111827]">{invitation.company}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{invitation.branch}</p>
    </div>
    <StatusBadge label={invitation.type === 'Equipo SaaS' ? getVisibleInternalRoleLabel(invitation.role) : `${invitation.role}`} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'success'} />
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{invitation.invitedBy}</div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{invitation.date}</div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{invitation.expiresAt}</div>
    <StatusBadge label={invitation.status} tone={getInvitationTone(invitation.status)} />
    <InvitationActionsCell invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
  </div>
);

export const InvitationDirectory = ({ rows, totalRows, isLoading, error, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { rows: InvitationRow[]; totalRows: number; isLoading: boolean; error: string; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  if (isLoading) return <TenantUsersSkeleton />;
  if (error) return <TenantUsersState icon={AlertTriangle} title="No se pudieron cargar invitaciones" detail={error} tone="danger" />;
  if (!totalRows) return <TenantUsersState icon={Bell} title="Sin invitaciones" detail="Aún no hay invitaciones generadas." tone="neutral" />;
  if (!rows.length) return <TenantUsersState icon={Search} title="Sin resultados" detail="Ajusta los filtros para ver más invitaciones." tone="warning" />;

  return (
    <div data-super-panel className={`${shellCardClass} overflow-visible`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Bandeja de invitaciones</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Controla token, expiración, contexto y estado sin llenar artificialmente la pantalla.</p>
        </div>
        <StatusBadge label={`${rows.length} visibles`} tone="blue" />
      </div>
      <div className="hidden xl:block">
        <div className="grid grid-cols-[minmax(0,1.15fr)_0.68fr_minmax(0,0.9fr)_0.64fr_0.72fr_0.62fr_0.62fr_0.62fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
          <div>Correo</div>
          <div>Tipo</div>
          <div>Empresa</div>
          <div>Rol</div>
          <div>Invitado por</div>
          <div>Envío</div>
          <div>Expiración</div>
          <div>Estado</div>
          <div className="text-center">Acc.</div>
        </div>
        <div className="divide-y divide-[#EEF2F7]">
          {rows.map(invitation => (
            <InvitationTableRow key={invitation.id} invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#EEF2F7] xl:hidden">
        {rows.map(invitation => (
          <InvitationMobileCard key={invitation.id} invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
        ))}
      </div>
    </div>
  );
};