import React from 'react';
import { createPortal } from 'react-dom';
import { Building2, MapPin, MoreHorizontal, ShieldCheck, ShieldAlert, CheckCircle2, Eye, Activity, History, RefreshCw, FileText, Headphones, ArrowUp, ArrowDown, DatabaseBackup, SearchX, UserCog, AlertTriangle, Users, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { TenantUserRow, TenantUserSortKey, TenantUserActionKind, SuperAdminIcon } from '../types';
import { formatDate } from '../../../utils';
import { platformMotionButtonClass as motionButtonClass, platformShellCardClass as shellCardClass } from '../../../components/ui/platformStyles';
import { StatusBadge, MiniPanel } from '../ui/Shared';
import { getUserRoleTone } from '../utils';

export const TENANT_USERS_PAGE_SIZE = 10;

export const TenantUsersDirectory = ({
  rows,
  totalRows,
  baseRows,
  isLoading,
  error,
  permissionError,
  sort,
  onSort,
  page,
  totalPages,
  visiblePages,
  onPageChange,
  onAction,
  activeActionsDropdown,
  dropdownCoords,
  openContextMenu,
  canUseSupportAccess,
}: {
  rows: TenantUserRow[];
  totalRows: number;
  baseRows: number;
  isLoading: boolean;
  error: string;
  permissionError: string;
  sort: { key: TenantUserSortKey; direction: 'asc' | 'desc' };
  onSort: (key: TenantUserSortKey) => void;
  page: number;
  totalPages: number;
  visiblePages: number[];
  onPageChange: (page: number) => void;
  onAction: (user: TenantUserRow, action: TenantUserActionKind) => void;
  activeActionsDropdown: string | null;
  dropdownCoords: { top: number; left: number; openUpward: boolean } | null;
  openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void;
  canUseSupportAccess: boolean;
}) => {
  const hasRows = rows.length > 0;
  const emptyTitle = baseRows === 0 ? 'No hay usuarios de empresas registrados' : 'No hay resultados con estos filtros';
  const emptyDetail =
    baseRows === 0 ?
       'Cuando las empresas tengan usuarios operativos, aparecerán aquí sin mezclarse con el equipo interno.'
      : 'Ajusta filtros o búsqueda para ampliar el directorio.';
  const start = totalRows ? (page - 1) * TENANT_USERS_PAGE_SIZE + 1 : 0;
  const end = Math.min(page * TENANT_USERS_PAGE_SIZE, totalRows);

  return (
    <div data-super-panel className={`${shellCardClass} relative z-0 overflow-hidden`} data-tenant-users-list>
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-[20px] font-semibold text-[#111827]">Directorio de usuarios</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Vista global de empresas con sucursal, rol, seguridad y trazabilidad.</p>
        </div>
        <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[13px] font-semibold text-[#475569]">{totalRows} visibles</span>
      </div>
      {permissionError ? (
        <TenantUsersState icon={ShieldAlert} title="Error de permisos" detail={permissionError} tone="danger" />
      ) : error ? (
        <TenantUsersState icon={AlertTriangle} title="No se pudo cargar el directorio" detail={error} tone="warning" />
      ) : isLoading ? (
        <TenantUsersSkeleton />
      ) : !hasRows ? (
        <TenantUsersState icon={Users} title={emptyTitle} detail={emptyDetail} tone="neutral" />
      ) : (
        <>
          <div className="hidden lg:block">
            <div className="min-w-0">
              <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_0.72fr_0.72fr_0.86fr_0.58fr_58px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                <TenantUsersSortButton label="Usuario" sortKey="name" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Empresa" sortKey="companyName" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Sucursal" sortKey="branchName" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Rol" sortKey="role" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Estado" sortKey="status" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Último acceso" sortKey="lastAccess" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="2FA" sortKey="twoFactorStatus" sort={sort} onSort={onSort} />
                <div className="text-center">Acc.</div>
              </div>
              <div className="divide-y divide-[#EEF2F7]">
                {rows.map(user => (
                  <TenantUserTableRow
                    key={user.id}
                    user={user}
                    activeActionsDropdown={activeActionsDropdown}
                    dropdownCoords={dropdownCoords}
                    openContextMenu={openContextMenu}
                    onAction={onAction}
                    canUseSupportAccess={canUseSupportAccess}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="divide-y divide-[#EEF2F7] lg:hidden">
            {rows.map(user => (
              <TenantUserMobileCard
                key={user.id}
                user={user}
                activeActionsDropdown={activeActionsDropdown}
                dropdownCoords={dropdownCoords}
                openContextMenu={openContextMenu}
                onAction={onAction}
                canUseSupportAccess={canUseSupportAccess}
              />
            ))}
          </div>
          <div className="flex flex-col gap-4 border-t border-[#E5E7EB] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] font-medium text-[#6B7280]">Mostrando {start} a {end} de {totalRows} usuarios</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              {visiblePages.map(item => (
                <button key={item} type="button" onClick={() => onPageChange(item)} className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-[15px] font-medium ${item === page ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]' : 'border border-transparent text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]'}`}>
                  {item}
                </button>
              ))}
              <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const TenantUsersSortButton = ({ label, sortKey, sort, onSort }: { label: string; sortKey: TenantUserSortKey; sort: { key: TenantUserSortKey; direction: 'asc' | 'desc' }; onSort: (key: TenantUserSortKey) => void }) => {
  const active = sort.key === sortKey;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className={`flex items-center gap-1 text-left transition-colors duration-200 hover:text-[#2563EB] ${active ? 'text-[#2563EB]' : ''}`}>
      <span>{label}</span>
      {active ? <ChevronDown size={13} className={`transition-transform duration-200 ${sort.direction === 'asc' ? 'rotate-180' : ''}`} /> : null}
    </button>
  );
};

export const TenantUserTableRow = ({ user, activeActionsDropdown, dropdownCoords, openContextMenu, onAction, canUseSupportAccess }: { user: TenantUserRow; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void; onAction: (user: TenantUserRow, action: TenantUserActionKind) => void; canUseSupportAccess: boolean }) => {
  const menuId = `tenant-user-${user.id}`;
  return (
    <div data-super-row className="group grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_0.72fr_0.72fr_0.86fr_0.58fr_58px] items-center px-5 py-4 text-[15px] transition-all duration-200 hover:bg-[#F8FAFC] hover:translate-x-1">
      <button type="button" onClick={() => onAction(user, 'view-profile')} className="group/user flex min-w-0 cursor-pointer items-center gap-4 text-left transition-all duration-200 hover:translate-x-1">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[13px] font-black uppercase text-[#2563EB] shadow-[0_10px_22px_rgba(37,99,235,0.14)]">{user.name.slice(0, 2)}</div>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-[#111827] transition-colors duration-200 group-hover/user:text-[#2563EB]">{user.name}</p>
          <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{user.email}</p>
        </div>
      </button>
      <div className="min-w-0"><p className="truncate font-semibold text-[#111827]">{user.companyName}</p><p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">ID: {user.companyId}</p></div>
      <div className="truncate font-medium text-[#374151]">{user.branchName}</div>
      <div><StatusBadge label={user.role} tone={getUserRoleTone(user.role)} /></div>
      <div><StatusBadge label={user.status} tone={user.status === 'Activo' ? 'success' : 'danger'} /></div>
      <div className="truncate text-[13px] font-medium text-[#6B7280]">{user.lastAccess}</div>
      <div><StatusBadge label={user.twoFactorStatus} tone={user.twoFactorStatus === 'Pendiente' ? 'warning' : 'neutral'} /></div>
      <TenantUserActionsCell user={user} menuId={menuId} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} onAction={onAction} canUseSupportAccess={canUseSupportAccess} />
    </div>
  );
};

export const TenantUserMobileCard = ({ user, activeActionsDropdown, dropdownCoords, openContextMenu, onAction, canUseSupportAccess }: { user: TenantUserRow; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void; onAction: (user: TenantUserRow, action: TenantUserActionKind) => void; canUseSupportAccess: boolean }) => {
  const menuId = `tenant-user-mobile-${user.id}`;
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onAction(user, 'view-profile')} className="flex min-w-0 items-center gap-3 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[13px] font-black uppercase text-[#2563EB]">{user.name.slice(0, 2)}</div>
          <div className="min-w-0"><p className="truncate text-[16px] font-semibold text-[#111827]">{user.name}</p><p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{user.email}</p></div>
        </button>
        <TenantUserActionsCell user={user} menuId={menuId} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} onAction={onAction} canUseSupportAccess={canUseSupportAccess} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniPanel label="Empresa" value={user.companyName} />
        <MiniPanel label="Sucursal" value={user.branchName} />
        <MiniPanel label="Rol" value={user.role} />
        <MiniPanel label="Último acceso" value={user.lastAccess} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge label={user.status} tone={user.status === 'Activo' ? 'success' : 'danger'} />
        <StatusBadge label={`2FA ${user.twoFactorStatus}`} tone={user.twoFactorStatus === 'Pendiente' ? 'warning' : 'neutral'} />
      </div>
    </div>
  );
};

export const TenantUserActionsCell = ({ user, menuId, activeActionsDropdown, dropdownCoords, openContextMenu, onAction, canUseSupportAccess }: { user: TenantUserRow; menuId: string; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void; onAction: (user: TenantUserRow, action: TenantUserActionKind) => void; canUseSupportAccess: boolean }) => (
  <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
    <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones para ${user.name}`}>
      <MoreHorizontal size={16} />
    </button>
    {activeActionsDropdown === menuId && dropdownCoords ?
       createPortal(
          <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[268px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
            <TenantUserActionButton icon={Eye} label="Ver perfil" onClick={() => onAction(user, 'view-profile')} />
            <TenantUserActionButton icon={Building2} label="Abrir empresa" onClick={() => onAction(user, 'open-company')} />
            <TenantUserActionButton icon={UserCog} label="Abrir usuario en contexto" onClick={() => onAction(user, 'open-context')} />
            <TenantUserActionButton icon={Activity} label="Ver sesiones" onClick={() => onAction(user, 'sessions')} />
            <TenantUserActionButton icon={History} label="Ver actividad" onClick={() => onAction(user, 'activity')} />
            <TenantUserActionButton icon={ShieldCheck} label="Cambiar rol" onClick={() => onAction(user, 'change-role')} />
            <TenantUserActionButton icon={MapPin} label="Cambiar sucursal" onClick={() => onAction(user, 'change-branch')} />
            <TenantUserActionButton icon={RefreshCw} label="Restablecer acceso" onClick={() => onAction(user, 'reset-access')} />
            <TenantUserActionButton icon={RefreshCw} label="Revocar sesiones" tone="danger" onClick={() => onAction(user, 'revoke-sessions')} />
            {user.isActive ? (
              <TenantUserActionButton icon={ShieldAlert} label="Suspender" tone="danger" onClick={() => onAction(user, 'suspend')} />
            ) : (
              <TenantUserActionButton icon={CheckCircle2} label="Reactivar" tone="success" onClick={() => onAction(user, 'reactivate')} />
            )}
          <TenantUserActionButton icon={FileText} label="Ver auditoría" onClick={() => onAction(user, 'audit')} />
            {canUseSupportAccess ? <TenantUserActionButton icon={Headphones} label="Acceder como soporte" tone="danger" onClick={() => onAction(user, 'support-access')} /> : null}
          </div>,
          document.body,
        )
      : null}
  </div>
);

export const TenantUserActionButton = ({ icon: Icon, label, tone = 'neutral', onClick }: { icon: SuperAdminIcon; label: string; tone?: 'neutral' | 'danger' | 'success'; onClick: () => void }) => {
  const toneClass = tone === 'danger' ? 'hover:bg-rose-50 hover:text-rose-700' : tone === 'success' ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'hover:bg-[#F8FAFC] hover:text-[#2563EB]';
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 ${toneClass}`}>
      <Icon size={16} className={tone === 'danger' ? 'text-rose-500' : tone === 'success' ? 'text-emerald-600' : 'text-[#2563EB]'} />
      {label}
    </button>
  );
};

export const TenantUsersSkeleton = () => (
  <div className="divide-y divide-[#EEF2F7]">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_0.72fr_0.72fr_0.86fr_0.58fr_58px] items-center px-5 py-4">
        {Array.from({ length: 8 }).map((__, itemIndex) => <div key={itemIndex} className="mr-4 h-5 animate-pulse rounded-full bg-[#EEF2F7]" />)}
      </div>
    ))}
  </div>
);

export const TenantUsersState = ({ icon: Icon, title, detail, tone }: { icon: SuperAdminIcon; title: string; detail: string; tone: 'neutral' | 'warning' | 'danger' }) => {
  const toneClass = tone === 'danger' ? 'bg-rose-50 text-rose-600' : tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-[#EFF6FF] text-[#2563EB]';
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClass}`}><Icon size={24} /></div>
      <h4 className="mt-5 text-[20px] font-semibold text-[#111827]">{title}</h4>
      <p className="mt-2 max-w-lg text-[14px] font-medium leading-6 text-[#6B7280]">{detail}</p>
    </div>
  );
};