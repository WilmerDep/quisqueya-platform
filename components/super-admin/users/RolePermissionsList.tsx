import React from 'react';
import { createPortal } from 'react-dom';
import { Crown, ShieldCheck, Building2, MoreHorizontal, Edit2, Copy, Users, Archive } from 'lucide-react';
import { RoleContext, PermissionModule, RoleActionKind } from '../types';
import { platformShellCardClass as shellCardClass, platformMotionButtonClass as motionButtonClass } from '../../../components/ui/platformStyles';
import { StatusBadge } from '../ui/Shared';
import { TenantUserActionButton } from './TenantUsersDirectory';
import { getVisiblePermissionLabel, getVisibleInternalRoleLabel, getVisibleRoleContextLabel } from '../utils';

export const RolePermissionsList = ({
  roleCards,
  onAction,
  activeActionsDropdown,
  dropdownCoords,
  openContextMenu
}: {
  roleCards: {
    saas: Array<{ role: string; users: number; permissions: string[] }>;
    tenant: Array<{ role: string; users: number; permissions: string[] }>;
  };
  onAction?: (roleName: string, context: RoleContext, action: RoleActionKind) => void;
  activeActionsDropdown?: string | null;
  dropdownCoords?: { top: number; left: number; openUpward: boolean } | null;
  openContextMenu?: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void;
}) => {
  const renderRows = (
    rows: Array<{ role: string; users: number; permissions: string[] }>,
    context: 'SaaS' | 'Tenant',
  ) => {
    const isSaaS = context === 'SaaS';
    const Icon = isSaaS ? Crown : Building2;

    return rows.map(card => {
      const menuId = `role-action-${context}-${card.role}`;
      return (
      <div
        data-super-row
        key={`${context}-${card.role}`}
        className="group grid grid-cols-[minmax(0,1.2fr)_0.58fr_minmax(0,1.65fr)_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#F8FAFC] hover:translate-x-1"
      >
        <div className="flex min-w-0 items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
              isSaaS ?
                 'bg-[#EFF6FF] text-[#2563EB] group-hover:bg-[#DBEAFE]'
                : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
            }`}
          >
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{isSaaS ? getVisibleInternalRoleLabel(card.role) : card.role}</p>
            <p className="mt-1 text-[12px] font-medium text-[#6B7280]">Contexto {getVisibleRoleContextLabel(context)}</p>
          </div>
        </div>
        <div className="text-[14px] font-semibold text-[#111827]">{card.users}</div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {card.permissions.slice(0, 2).map(permission => (
            <span
              key={permission}
              className="max-w-[220px] truncate rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#475569]"
            >
              {getVisiblePermissionLabel(permission)}
            </span>
          ))}
          {card.permissions.length > 2 ? (
            <span
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                isSaaS ?
                   'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'
              }`}
            >
              +{card.permissions.length - 2}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-end">
          <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
            <button 
              type="button" 
              onClick={event => openContextMenu ? openContextMenu(event, menuId) : undefined}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`}
              aria-label={`Acciones del rol ${card.role}`}
            >
              <MoreHorizontal size={16} />
            </button>
            {activeActionsDropdown === menuId && dropdownCoords && createPortal(
              <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[270px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
                <TenantUserActionButton icon={Edit2} label="Editar rol" onClick={() => onAction && onAction(card.role, context, 'edit')} />
                <TenantUserActionButton icon={Copy} label="Duplicar rol" onClick={() => onAction && onAction(card.role, context, 'duplicate')} />
                <TenantUserActionButton icon={Users} label="Asignar usuarios" onClick={() => onAction && onAction(card.role, context, 'assign-users')} />
                <TenantUserActionButton icon={Archive} label="Archivar rol" tone="danger" onClick={() => onAction && onAction(card.role, context, 'archive')} />
              </div>,
              document.body,
            )}
          </div>
        </div>
      </div>
      );
    });
  };

  return (
    <div data-super-panel className={`${shellCardClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Matriz de roles y permisos</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Vista por contexto, usuarios asignados y permisos principales.</p>
        </div>
        <button type="button" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
          <ShieldCheck size={15} />
          Nuevo rol
        </button>
      </div>

      <div className="border-b border-[#EEF2F7] bg-[#FCFDFF] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <Crown size={17} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">Roles internos</p>
            <p className="text-[12px] font-medium text-[#6B7280]">Accesos internos de ABUNDRA y soporte global.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.2fr)_0.58fr_minmax(0,1.65fr)_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
        <div>Rol</div>
        <div>Usuarios</div>
        <div>Permisos principales</div>
        <div className="text-center">Acc.</div>
      </div>
      <div className="divide-y divide-[#EEF2F7]">{renderRows(roleCards.saas, 'SaaS')}</div>

      <div className="border-y border-[#EEF2F7] bg-[#FCFDFF] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Building2 size={17} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">Roles de empresas</p>
            <p className="text-[12px] font-medium text-[#6B7280]">Accesos ligados a empresas y operación diaria.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.2fr)_0.58fr_minmax(0,1.65fr)_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
        <div>Rol</div>
        <div>Usuarios</div>
        <div>Permisos principales</div>
        <div className="text-center">Acc.</div>
      </div>
      <div className="divide-y divide-[#EEF2F7]">{renderRows(roleCards.tenant, 'Tenant')}</div>
    </div>
  );
};

export const RolePermissionMatrix = ({
  permissionMatrix,
  onAction,
}: {
  permissionMatrix: Record<RoleContext, PermissionModule[]>;
  onAction: (roleName: string, context: RoleContext, action: RoleActionKind) => void;
}) => {
  const renderMatrix = (context: RoleContext) => {
    const isSaaS = context === 'SaaS';
    return (
      <div data-super-panel className={`${shellCardClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#EEF2F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isSaaS ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-emerald-50 text-emerald-600'}`}>
              {isSaaS ? <Crown size={18} /> : <Building2 size={18} />}
            </div>
            <div>
              <h4 className="text-[18px] font-semibold text-[#111827]">Matriz {isSaaS ? 'interna' : 'de empresa'} por módulos</h4>
              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">
                {isSaaS ? 'Permisos globales de la plataforma separados de la operación de empresas.' : 'Permisos operativos de empresa sin alcance sobre la plataforma global.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onAction(isSaaS ? 'Roles internos' : 'Roles de empresas', context, 'compare')} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] transition-all duration-200 hover:translate-x-1 hover:text-[#2563EB]">Comparar</button>
            <button type="button" onClick={() => onAction(isSaaS ? 'Roles internos' : 'Roles de empresas', context, 'archive')} className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 text-[12px] font-semibold text-[#D97706] transition-all duration-200 hover:translate-x-1">Archivar</button>
            <button type="button" onClick={() => onAction(isSaaS ? 'Roles internos' : 'Roles de empresas', context, 'restore')} className="rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-[12px] font-semibold text-[#16A34A] transition-all duration-200 hover:translate-x-1">Restaurar</button>
            <button type="button" onClick={() => onAction(isSaaS ? 'Roles internos' : 'Roles de empresas', context, 'history')} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] transition-all duration-200 hover:translate-x-1 hover:text-[#2563EB]">Historial</button>
          </div>
        </div>
        <div className="grid gap-3 p-5 lg:grid-cols-2">
          {permissionMatrix[context].map(group => (
            <div data-super-row key={`${context}-${group.module}`} className="group rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4 transition-all duration-200 hover:translate-x-1 hover:border-[#BFDBFE] hover:bg-white hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{group.module}</p>
                  <p className="mt-1 text-[12px] font-medium text-[#6B7280]">{group.permissions.length} permisos configurados</p>
                </div>
                {group.critical?.length ? <StatusBadge label="Crítico" tone="danger" /> : <StatusBadge label={isSaaS ? 'Interno' : 'Empresa'} tone={isSaaS ? 'blue' : 'success'} />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.permissions.map(permission => {
                  const isCritical = group.critical?.includes(permission);
                  return (
                    <span key={permission} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${isCritical ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#E5E7EB] bg-white text-[#475569]'}`}>
                      {getVisiblePermissionLabel(permission)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {renderMatrix('SaaS')}
      {renderMatrix('Tenant')}
    </div>
  );
};
