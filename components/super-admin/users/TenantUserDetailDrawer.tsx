import React from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Terminal, FileText, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { TenantUserRow, TenantUserActionKind } from '../types';
import { formatDate } from '../../../utils';
import { platformMotionButtonClass as motionButtonClass } from '../../../components/ui/platformStyles';
import { MiniPanel, ActionListItem } from '../ui/Shared';
import { getVisibleRoleContextLabel, getVisibleInternalRoleLabel, getVisiblePermissionLabel } from '../utils';

export const TenantUserDetailDrawer = ({
  user,
  open,
  onClose,
  onAction,
  activityItems,
  sessionItems,
  auditItems,
}: {
  user: TenantUserRow | null;
  open: boolean;
  onClose: () => void;
  onAction: (user: TenantUserRow, action: TenantUserActionKind) => void;
  activityItems: Array<{ id: string; action?: string; detail?: string; timestamp?: string; type?: string; description?: string }>;
  sessionItems: Array<{ id: string; user?: string; company?: string; ip?: string; device?: string; activity?: string; status?: string }>;
  auditItems: Array<{ id: string; action: string; detail?: string; timestamp?: string }>;
}) => {
  if (!open || !user) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9997] bg-[#0F172A]/35 backdrop-blur-sm" role="dialog" aria-modal="true">
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-[#E5E7EB] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <div className="border-b border-[#E5E7EB] px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFF6FF] text-[15px] font-black uppercase text-[#2563EB]">{user.name.slice(0, 2)}</div>
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Detalle de usuario de empresa</p>
                <h3 className="mt-1 truncate text-[24px] font-semibold text-[#111827]">{user.name}</h3>
                <p className="mt-1 truncate text-[14px] font-medium text-[#6B7280]">{user.email}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-[#F9FAFB] p-5">
          <TenantDrawerSection title="1. Identidad">
            <MiniPanel label="Nombre" value={user.name} />
            <MiniPanel label="Correo" value={user.email} />
            <MiniPanel label="Teléfono" value={user.phone} />
            <MiniPanel label="Código interno" value={user.code} />
          </TenantDrawerSection>
          <TenantDrawerSection title="2. Empresa y sucursal">
            <MiniPanel label="Empresa" value={user.companyName} />
            <MiniPanel label="Empresa ID" value={user.companyId} />
            <MiniPanel label="Sucursal" value={user.branchName} />
            <MiniPanel label="Sucursal ID" value={user.branchId} />
          </TenantDrawerSection>
          <TenantDrawerSection title="3. Rol y permisos">
            <MiniPanel label="Rol" value={user.role} />
            <MiniPanel label="Permisos explícitos" value={`${Object.keys(user.permissions).length}`} />
          </TenantDrawerSection>
          <TenantDrawerSection title="4. Seguridad">
            <MiniPanel label="Estado" value={user.status} />
            <MiniPanel label="2FA" value={user.twoFactorStatus} />
            <MiniPanel label="Último acceso" value={user.lastAccess} />
            <MiniPanel label="Creado" value={formatDate(user.createdAt)} />
          </TenantDrawerSection>
          <TenantDrawerSection title="5. Actividad reciente">
            {activityItems.length ? activityItems.slice(0, 4).map(item => <ActionListItem key={item.id} icon={Activity} title={item.action || item.type || 'Actividad'} detail={item.detail || item.description || item.timestamp || 'Evento registrado'} />) : <p className="text-[14px] font-medium text-[#6B7280]">Sin actividad reciente disponible.</p>}
          </TenantDrawerSection>
          <TenantDrawerSection title="6. Sesiones">
            {sessionItems.length ? sessionItems.slice(0, 4).map(item => <ActionListItem key={item.id} icon={Terminal} title={`${item.device || 'Sin dispositivo'} · ${item.ip || 'Sin IP'}`} detail={`${item.status || 'Sin estado'} · ${item.activity || 'Sin actividad'}`} />) : <p className="text-[14px] font-medium text-[#6B7280]">Sin sesiones activas visibles.</p>}
          </TenantDrawerSection>
          <TenantDrawerSection title="7. Auditoría">
            {auditItems.length ? auditItems.slice(0, 4).map(item => <ActionListItem key={item.id} icon={FileText} title={item.action} detail={item.detail || item.timestamp || 'Evento auditado'} />) : <p className="text-[14px] font-medium text-[#6B7280]">Sin auditoría específica para este usuario.</p>}
          </TenantDrawerSection>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#E5E7EB] bg-white p-5">
          <button type="button" onClick={() => onAction(user, 'sessions')} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white text-[14px] font-semibold text-[#111827] ${motionButtonClass}`}><Activity size={16} />Sesiones</button>
          <button type="button" onClick={() => onAction(user, user.isActive ? 'suspend' : 'reactivate')} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-[14px] font-semibold ${user.isActive ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'}`}>
            {user.isActive ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
            {user.isActive ? 'Suspender' : 'Reactivar'}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
};

export const TenantDrawerSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
    <h4 className="text-[15px] font-semibold text-[#111827]">{title}</h4>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  </section>
);