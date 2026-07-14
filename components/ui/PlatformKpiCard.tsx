import React from 'react';
import { ArrowDownRight, ArrowUpRight, AlertTriangle } from 'lucide-react';

type PlatformKpiTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

export type PlatformKpiItem = {
  label: string;
  value: string;
  helper: string;
  trend: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  tone?: PlatformKpiTone;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trendDirection?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
  error?: string;
};

const toneMap: Record<PlatformKpiTone, { iconWrap: string; trend: string; watermark: string }> = {
  blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', trend: 'text-[#2563EB]', watermark: 'text-[#2563EB]' },
  emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', trend: 'text-[#16A34A]', watermark: 'text-[#16A34A]' },
  amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', trend: 'text-[#D97706]', watermark: 'text-[#F59E0B]' },
  rose: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', trend: 'text-[#DC2626]', watermark: 'text-[#DC2626]' },
  violet: { iconWrap: 'bg-[#F3E8FF] text-[#7C3AED]', trend: 'text-[#7C3AED]', watermark: 'text-[#7C3AED]' },
  slate: { iconWrap: 'bg-[#F1F5F9] text-[#64748B]', trend: 'text-[#475569]', watermark: 'text-[#64748B]' },
};

export const PlatformKpiCard: React.FC<PlatformKpiItem> = ({
  label,
  value,
  helper,
  trend,
  secondaryLabel = 'Lectura',
  secondaryValue = 'Actual',
  tone = 'blue',
  icon: Icon,
  trendDirection = 'up',
  isLoading = false,
  error,
}) => {
  const toneStyle = toneMap[tone];
  const TrendIcon = trendDirection === 'down' ? ArrowDownRight : ArrowUpRight;

  if (isLoading) {
    return (
      <div className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="h-14 w-14 animate-pulse rounded-[18px] bg-[#E5E7EB]" />
          <div className="h-7 w-20 animate-pulse rounded-full bg-[#F1F5F9]" />
        </div>
        <div className="mt-8 space-y-4">
          <div className="h-5 w-32 animate-pulse rounded-full bg-[#E5E7EB]" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-[#E5E7EB]" />
          <div className="h-4 w-40 animate-pulse rounded-full bg-[#F1F5F9]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#FECACA] bg-white p-6 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#FEF2F2] text-[#DC2626]">
          <AlertTriangle size={24} />
        </div>
        <div className="mt-8 space-y-3">
          <p className="text-[17px] font-semibold text-[#111827]">{label}</p>
          <p className="text-[28px] font-semibold leading-none tracking-tight text-[#DC2626]">--</p>
          <p className="max-w-[220px] text-[15px] font-medium leading-6 text-[#6B7280]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${toneStyle.iconWrap}`}>
          <Icon size={24} />
        </div>
        <div className="text-right">
          <div className={`inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${toneStyle.trend}`}>
            {trendDirection === 'neutral' ? null : <TrendIcon size={14} />}
            {trend}
          </div>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">{secondaryLabel}</p>
          <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">{secondaryValue}</p>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <p className="text-[17px] font-semibold text-[#111827]">{label}</p>
        <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{value}</p>
        <p className="max-w-[190px] text-[15px] font-medium leading-6 text-[#6B7280]">{helper}</p>
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.08]">
        <Icon size={88} className={toneStyle.watermark} />
      </div>
    </div>
  );
};

export const PlatformKpiGrid: React.FC<{ items: PlatformKpiItem[]; isLoading?: boolean; error?: string; className?: string }> = ({
  items,
  isLoading = false,
  error,
  className,
}) => (
  <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-5 ${className ?? ''}`.trim()}>
    {items.map(item => (
      <PlatformKpiCard key={item.label} {...item} isLoading={isLoading || item.isLoading} error={error || item.error} />
    ))}
  </div>
);
