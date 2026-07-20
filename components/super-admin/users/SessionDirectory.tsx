import React from 'react';
import { createPortal } from 'react-dom';
import { Terminal, Smartphone, MoreHorizontal, AlertTriangle, CheckCircle2, Ban, LogOut, Globe, Wifi, ShieldCheck, Eye, EyeOff, Search, RefreshCw, ShieldAlert, UserCog, Activity } from 'lucide-react';
import { SessionStatus, SessionActionKind } from '../types';
import { formatDate } from '../../../utils';
import { platformMotionButtonClass as motionButtonClass, platformInputClass, platformShellCardClass as shellCardClass } from '../../../components/ui/platformStyles';
import { StatusBadge, ActionListItem } from '../ui/Shared';
import { getVisibleSessionTypeLabel, getSessionTone } from '../utils';
import { TenantUserActionButton, TenantUsersState, TenantUsersSkeleton } from './TenantUsersDirectory';

export const SessionDirectory = ({
  rows,
  totalRows,
  isLoading,
  error,
  onAction,
  onHardenPolicies,
  activeActionsDropdown,
  dropdownCoords,
  openContextMenu,
}: {
  rows: Array<{
    id: string;
    user: string;
    type: string;
    company: string;
    ip: string;
    device: string;
    location: string;
    activity: string;
    createdAt: string;
    status: SessionStatus;
    browser: string;
    deviceFamily: string;
  }>;
  totalRows: number;
  isLoading: boolean;
  error?: string;
  onAction: (session: any, action: SessionActionKind) => void;
  onHardenPolicies: () => void;
  activeActionsDropdown: string | null;
  dropdownCoords: { top: number; left: number; openUpward: boolean } | null;
  openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void;
}) => {
  if (isLoading) return <TenantUsersSkeleton />;
  if (error) return <TenantUsersState icon={AlertTriangle} title="No se pudieron cargar sesiones" detail={error} tone="danger" />;
  if (!totalRows) return <TenantUsersState icon={Activity} title="Sin sesiones" detail="No hay sesiones registradas para mostrar." tone="neutral" />;
  if (!rows.length) return <TenantUsersState icon={Search} title="Sin resultados" detail="Ajusta los filtros para ver más sesiones." tone="warning" />;

  return (
  <div data-super-panel className={`${shellCardClass} overflow-visible`}>
      <div className="flex flex-col gap-3 border-b border-[#EEF2F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Sesiones activas y trazabilidad</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">La tabla tiene prioridad; paneles laterales quedan como lectura secundaria.</p>
        </div>
        <button type="button" onClick={onHardenPolicies} className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
          <ShieldCheck size={15} />
          Endurecer políticas
        </button>
      </div>
      <div className="hidden xl:block">
        <div className="grid grid-cols-[minmax(0,1.04fr)_0.54fr_minmax(0,0.82fr)_minmax(0,1.04fr)_0.62fr_0.74fr_0.62fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
          <div>Usuario</div>
          <div>Tipo</div>
          <div>Empresa</div>
          <div>Dispositivo / IP</div>
          <div>Ubicación</div>
          <div>Actividad / creada</div>
          <div>Estado</div>
          <div className="text-center">Acc.</div>
        </div>
        <div className="divide-y divide-[#EEF2F7]">
          {rows.map(session => (
            <SessionTableRow key={session.id} session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#EEF2F7] xl:hidden">
        {rows.map(session => (
          <SessionMobileCard key={session.id} session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
        ))}
      </div>
    </div>
  );
};

export const SessionTableRow = ({ session, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { session: any; onAction: (session: any, action: SessionActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div data-super-row className="group grid grid-cols-[minmax(0,1.04fr)_0.54fr_minmax(0,0.82fr)_minmax(0,1.04fr)_0.62fr_0.74fr_0.62fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#F8FAFC] hover:translate-x-1">
    <div className="truncate text-[14px] font-semibold text-[#111827] transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-[#2563EB]">{session.user}</div>
    <StatusBadge label={getVisibleSessionTypeLabel(session.type)} tone={session.type === 'SaaS' ? 'blue' : 'neutral'} />
    <div className="truncate text-[14px] font-medium text-[#475569]">{session.company}</div>
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-[#475569]">{session.device}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{session.ip}</p>
    </div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{session.location}</div>
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-[#475569]">{session.activity}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{session.createdAt}</p>
    </div>
    <StatusBadge label={session.status} tone={getSessionTone(session.status)} />
    <SessionActionsCell session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
  </div>
);

export const SessionMobileCard = ({ session, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { session: any; onAction: (session: any, action: SessionActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="space-y-4 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-[#111827]">{session.user}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{session.company} · {session.device}</p>
      </div>
      <SessionActionsCell session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
    </div>
    <div className="flex flex-wrap gap-2">
      <StatusBadge label={getVisibleSessionTypeLabel(session.type)} tone={session.type === 'SaaS' ? 'blue' : 'neutral'} />
      <StatusBadge label={session.status} tone={getSessionTone(session.status)} />
      <StatusBadge label={session.ip} tone="neutral" />
    </div>
  </div>
);

export const SessionActionsCell = ({ session, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { session: any; onAction: (session: any, action: SessionActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  const menuId = `session-row-${session.id}`;
  return (
    <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones de sesión ${session.user}`}>
        <MoreHorizontal size={16} />
      </button>
      {activeActionsDropdown === menuId && dropdownCoords && createPortal(
        <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[270px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
          <TenantUserActionButton icon={Eye} label="Ver detalle" onClick={() => onAction(session, 'view-detail')} />
          <TenantUserActionButton icon={AlertTriangle} label="Marcar sospechosa" onClick={() => onAction(session, 'mark-suspicious')} />
          <TenantUserActionButton icon={RefreshCw} label="Revocar sesión" tone="danger" onClick={() => onAction(session, 'revoke')} />
          <TenantUserActionButton icon={ShieldAlert} label="Revocar todas" tone="danger" onClick={() => onAction(session, 'revoke-all')} />
          <TenantUserActionButton icon={ShieldCheck} label="Revocar excepto actual" tone="danger" onClick={() => onAction(session, 'revoke-all-except-current')} />
          <TenantUserActionButton icon={Globe} label="Bloquear IP" tone="danger" onClick={() => onAction(session, 'block-ip')} />
          <TenantUserActionButton icon={RefreshCw} label="Forzar contraseña" onClick={() => onAction(session, 'force-password')} />
          <TenantUserActionButton icon={UserCog} label="Suspender usuario" tone="danger" onClick={() => onAction(session, 'suspend-user')} />
          <TenantUserActionButton icon={Activity} label="Ver actividad" onClick={() => onAction(session, 'activity')} />
        </div>,
        document.body,
      )}
    </div>
  );
};