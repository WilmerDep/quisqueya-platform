import React from 'react';
import { Filter, TrendingUp } from 'lucide-react';
import { SuperAdminIcon } from '../types';
import { platformShellCardClass as shellCardClass } from '../../../components/ui/platformStyles';

export const SummaryMetric = ({
  label,
  value,
  iconTone = 'blue',
}: {
  label: string;
  value: string;
  iconTone: 'blue' | 'violet' | 'green' | 'amber' | 'slate';
}) => {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.06)]',
    violet: 'bg-purple-50 text-purple-600 shadow-[0_8px_20px_rgba(147,51,234,0.06)]',
    green: 'bg-emerald-50 text-emerald-600 shadow-[0_8px_20px_rgba(16,185,129,0.06)]',
    amber: 'bg-amber-50 text-amber-600 shadow-[0_8px_20px_rgba(245,158,11,0.06)]',
    slate: 'bg-slate-50 text-slate-600 shadow-[0_8px_20px_rgba(71,85,105,0.06)]',
  };

  return (
    <div className="flex items-center gap-4 rounded-[22px] border border-[#F1F5F9] bg-[#FCFDFF] p-4.5 transition-all duration-250 hover:shadow-sm hover:bg-[#FCFDFF]/95">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClasses[iconTone]}`}>
        <TrendingUp size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-lg font-black text-slate-900 truncate leading-none">{value}</p>
      </div>
    </div>
  );
};

export const StatusBadge = ({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' | 'blue' | 'neutral' }) => {
  const toneMap = {
    success: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]',
    warning: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
    danger: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
    blue: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]',
    neutral: 'border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]',
  };

  return <span className={`inline-flex w-fit items-center justify-self-start whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-semibold leading-none ${toneMap[tone]}`}>{label}</span>;
};

export const MiniPanel = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-[#FCFDFF] px-4 py-3">
    <p className="text-[14px] font-medium text-[#6B7280]">{label}</p>
    <p className="text-[16px] font-semibold text-[#111827]">{value}</p>
  </div>
);

export const ClearFiltersButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="ml-auto inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[14px] font-semibold text-[#111827] shadow-sm transition-all duration-200 hover:translate-x-1 hover:border-[#BFDBFE] hover:bg-[#F8FBFF] hover:text-[#2563EB] hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
  >
    <Filter size={17} className="text-[#2563EB]" />
    <span>Limpiar filtros</span>
  </button>
);

export const SidebarInfoCard = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: SuperAdminIcon;
  children: React.ReactNode;
}) => (
  <div className={`${shellCardClass} p-6`}>
    <div className="flex items-center gap-3">
      <Icon size={20} className="text-[#2563EB]" />
      <h2 className="text-[20px] font-semibold text-[#111827]">{title}</h2>
    </div>
    <div className="mt-5 space-y-3">{children}</div>
  </div>
);

export const ActionListItem = ({
  icon: Icon,
  title,
  detail,
}: {
  icon: SuperAdminIcon;
  title: string;
  detail: string;
}) => (
  <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[#111827]">{title}</p>
        <p className="mt-2 text-[14px] font-medium leading-7 text-[#6B7280]">{detail}</p>
      </div>
    </div>
  </div>
);
export const UserAvatar = ({ name }: { name: string }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[12px] font-black uppercase text-[#2563EB] transition-all duration-200 group-hover:scale-[1.04] group-hover:bg-[#DBEAFE]">
    {name.slice(0, 2)}
  </div>
);
