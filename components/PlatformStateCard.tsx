import React from 'react';
import { ArrowRight, LogIn, ShieldAlert, ShieldX, X } from 'lucide-react';

export type PlatformStateKind = 'session-expired' | 'permission-denied';

export interface PlatformStateCardProps {
  kind: PlatformStateKind;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose?: () => void;
  compact?: boolean;
}

const stateToneMap: Record<PlatformStateKind, { icon: React.ComponentType<{ size?: number; className?: string }>; iconWrap: string; primary: string }> = {
  'session-expired': {
    icon: ShieldX,
    iconWrap: 'bg-[#F1F5F9] text-[#64748B]',
    primary: 'bg-[#2563EB] shadow-[0_18px_40px_rgba(37,99,235,0.24)]',
  },
  'permission-denied': {
    icon: ShieldAlert,
    iconWrap: 'bg-[#FEF2F2] text-[#DC2626]',
    primary: 'bg-[#2563EB] shadow-[0_18px_40px_rgba(37,99,235,0.24)]',
  },
};

export const PlatformStateCard: React.FC<PlatformStateCardProps> = ({
  kind,
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
  compact = false,
}) => {
  const tone = stateToneMap[kind];
  const Icon = tone.icon;

  return (
    <div className={`relative overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.12)] ${compact ? 'p-8' : 'p-10'}`}>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#94A3B8] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >
          <X size={18} />
        </button>
      ) : null}

      <div className="flex flex-col items-center text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-[28px] ${tone.iconWrap}`}>
          <Icon size={38} />
        </div>
        <h3 className="mt-6 text-[30px] font-black tracking-tight text-[#111827]">{title}</h3>
        <p className="mt-4 max-w-[36ch] text-[16px] font-medium leading-7 text-[#64748B]">{message}</p>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            className="inline-flex h-14 min-w-[172px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[15px] font-semibold text-[#0F172A] transition-all duration-200 hover:translate-x-1 hover:border-[#CBD5E1]"
          >
            <ArrowRight size={16} className="rotate-180" />
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrimary}
          className={`inline-flex h-14 min-w-[172px] items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:translate-x-1 ${tone.primary}`}
        >
          <LogIn size={16} />
          {primaryLabel}
        </button>
      </div>
    </div>
  );
};
