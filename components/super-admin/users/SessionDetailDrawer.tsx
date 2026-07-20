import React from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Terminal, ShieldAlert, Globe, Monitor, MapPin, Hash, Building2, UserCog, CheckCircle2 } from 'lucide-react';
import { SessionStatus, SessionActionKind } from '../types';
import { platformMotionButtonClass as motionButtonClass } from '../../../components/ui/platformStyles';
import { MiniPanel, ActionListItem, StatusBadge } from '../ui/Shared';
import { getVisibleSessionTypeLabel, getSessionTone } from '../utils';

export const SessionDetailDrawer = ({
  session,
  open,
  onClose,
  onAction,
}: {
  session: {
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
  } | null;
  open: boolean;
  onClose: () => void;
  onAction: (session: any, action: SessionActionKind) => void;
}) => {
  if (!open || !session) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9997] bg-[#0F172A]/35 backdrop-blur-sm" role="dialog" aria-modal="true">
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-[#E5E7EB] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <div className="border-b border-[#E5E7EB] px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFF6FF] text-[15px] font-black uppercase text-[#2563EB]">{session.user.slice(0, 2)}</div>
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Detalle de sesión</p>
                <h3 className="mt-1 truncate text-[24px] font-semibold text-[#111827]">{session.user}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge label={getVisibleSessionTypeLabel(session.type)} tone={session.type === 'SaaS' ? 'blue' : 'neutral'} />
                  <StatusBadge label={session.status} tone={getSessionTone(session.status)} />
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-[#F9FAFB] p-5">
          <section className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold text-[#111827]"><Monitor size={16} className="text-[#64748B]" /> Dispositivo y Conexión</h4>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MiniPanel label="Dirección IP" value={session.ip} />
              <MiniPanel label="Navegador" value={session.browser} />
              <MiniPanel label="Dispositivo" value={session.device} />
              <MiniPanel label="Familia" value={session.deviceFamily} />
            </div>
          </section>
          
          <section className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold text-[#111827]"><MapPin size={16} className="text-[#64748B]" /> Ubicación y Entorno</h4>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MiniPanel label="Ubicación" value={session.location} />
              <MiniPanel label="Empresa" value={session.company} />
              <MiniPanel label="ID de Sesión" value={session.id} />
              <MiniPanel label="Inicio" value={session.createdAt} />
            </div>
          </section>

          <section className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold text-[#111827]"><Activity size={16} className="text-[#64748B]" /> Actividad de Sesión</h4>
            <div className="mt-4">
              <ActionListItem icon={Activity} title="Última acción" detail={session.activity} />
              <ActionListItem icon={Terminal} title="Autenticación exitosa" detail={`Iniciada el ${session.createdAt}`} />
            </div>
          </section>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#E5E7EB] bg-white p-5">
          <button type="button" onClick={() => onAction(session, 'revoke')} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-[14px] font-semibold text-[#DC2626] ${motionButtonClass}`}>
             <ShieldAlert size={16} /> Revocar sesión
          </button>
          <button type="button" onClick={() => onAction(session, 'mark-suspicious')} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] text-[14px] font-semibold text-[#D97706] ${motionButtonClass}`}>
            <UserCog size={16} /> Marcar sospechosa
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
};
