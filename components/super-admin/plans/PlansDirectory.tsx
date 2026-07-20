import React, { useState } from 'react';
import { Users, UserCog, Building2, Edit3, CheckCircle2, ShieldCheck, Zap, Package, Star, TrendingUp, Plus } from 'lucide-react';
import { SaaSPlan, Company } from '../../../types';
import { platformShellCardClass as shellCardClass, platformMotionButtonClass as motionButtonClass, platformPageTitleClass, platformPageDescriptionClass, platformHeaderPrimaryActionClass } from '../../../components/ui/platformStyles';
import { PlatformKpiCard } from '../../ui/PlatformKpiCard';
import { formatCurrency } from '../../../utils';

export const PlansDirectory = ({
  plans,
  tenantCompanies,
  setEditingPlan,
  setIsPlanModalOpen,
}: {
  plans: SaaSPlan[];
  tenantCompanies: Company[];
  setEditingPlan: (plan: SaaSPlan | null) => void;
  setIsPlanModalOpen: (isOpen: boolean) => void;
}) => {
  const [isYearly, setIsYearly] = useState(false);

  // Calcular el plan más elegido
  const planCounts = tenantCompanies.reduce((acc, company) => {
    acc[company.planId] = (acc[company.planId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  let topPlanId = plans[0]?.id;
  let maxCount = 0;
  Object.entries(planCounts).forEach(([id, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topPlanId = id;
    }
  });
  const topPlan = plans.find(p => p.id === topPlanId);

  return (
    <section className="space-y-6 animate-[platform-fade-in_200ms_ease-out]">
      <div data-super-hero className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className={platformPageTitleClass}>Planes y Suscripciones</h1>
          <p className={platformPageDescriptionClass}>Catálogo de planes, límites de recursos y precios de Abundra.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white p-1.5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`rounded-full px-5 py-2 text-[14px] font-semibold transition-all duration-300 ${!isYearly ? 'bg-[#2563EB] text-white shadow-md' : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'}`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`rounded-full px-5 py-2 text-[14px] font-semibold transition-all duration-300 flex items-center gap-2 ${isYearly ? 'bg-[#2563EB] text-white shadow-md' : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'}`}
            >
              Anual <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isYearly ? 'bg-white/20 text-white' : 'bg-[#DBEAFE] text-[#2563EB]'}`}>-17%</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingPlan(null);
              setIsPlanModalOpen(true);
            }}
            className={platformHeaderPrimaryActionClass}
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Nuevo plan</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <PlatformKpiCard
          label="Planes activos"
          value={plans.length.toString()}
          helper="Modelos de suscripción"
          trend="Total"
          trendDirection="neutral"
          icon={Package}
          tone="blue"
        />
        <PlatformKpiCard
          label="Empresas en Pro"
          value={tenantCompanies.filter(c => c.planId === 'p2').length.toString()}
          helper="Suscripciones premium"
          trend="+12%"
          trendDirection="up"
          icon={Star}
          tone="violet"
        />
        <PlatformKpiCard
          label="Plan más elegido"
          value={topPlan?.name || 'N/A'}
          helper={`${maxCount} empresas suscritas`}
          trend="Tendencia"
          trendDirection="neutral"
          icon={TrendingUp}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map(plan => {
          const price = isYearly ? (plan.yearlyPrice || plan.monthlyPrice * 10) : plan.monthlyPrice;
          const isEnterprise = plan.id === 'p3';
          const isPro = plan.id === 'p2';

          return (
            <div
              key={plan.id}
              data-super-row
              className={`${shellCardClass} flex flex-col p-6 rounded-[28px] transition-all duration-300 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)] hover:-translate-y-1 relative overflow-hidden border ${
                isEnterprise ?
                   'border-[#E9D5FF] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-50/40 via-white to-white' 
                  : isPro ?
                     'border-[#BFDBFE] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/40 via-white to-white ring-1 ring-[#3B82F6]/20 shadow-[0_8px_30px_rgba(59,130,246,0.08)]'
                    : 'border-[#E2E8F0] bg-white'
              }`}
            >
              {plan.isOffer && (
                <div className="absolute right-0 top-0 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-[16px] shadow-sm">
                  {plan.offerText || 'Recomendado'}
                </div>
              )}
              
              <div className="space-y-1.5 pb-5">
                <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isEnterprise ? 'bg-purple-100 text-purple-700' : isPro ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {isEnterprise ? <ShieldCheck size={13} /> : isPro ? <Zap size={13} /> : <CheckCircle2 size={13} />}
                  Modelo Abundra
                </div>
                <h3 className="text-[22px] font-semibold tracking-tight text-[#111827]">{plan.name}</h3>
              </div>

              <div className="py-3 space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-[32px] font-bold tracking-tight leading-none ${isPro ? 'text-[#2563EB]' : 'text-[#111827]'}`}>{formatCurrency(price)}</span>
                  <span className="text-[14px] font-semibold text-[#64748B]">/ ${isYearly ? 'año' : 'mes'}</span>
                </div>
                <p className="text-[12px] font-medium text-[#64748B] mt-1.5">
                  {isYearly ? 'Cobrado anualmente en una sola cuota' : 'Cobro recurrente mensual'}
                </p>
              </div>

              {/* Límites Cuantitativos del Plan */}
              <div className="flex-1 space-y-2.5 pt-5 border-t border-[#EEF2F7]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-3">Límites de recursos</p>
                
                <div className="flex items-center justify-between rounded-[16px] border border-[#EEF2F7] bg-[#FCFDFF] px-3.5 py-3 transition-all duration-200 hover:border-[#DBEAFE] hover:bg-white hover:shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB] transition-colors">
                      <Users size={14} />
                    </div>
                    <span className="text-[13px] font-semibold text-[#334155]">Clientes Máximos</span>
                  </div>
                  <span className="text-[14px] font-semibold text-[#111827]">{plan.maxClients === 999999 ? 'Ilimitados' : plan.maxClients}</span>
                </div>

                <div className="flex items-center justify-between rounded-[16px] border border-[#EEF2F7] bg-[#FCFDFF] px-3.5 py-3 transition-all duration-200 hover:border-[#DBEAFE] hover:bg-white hover:shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB] transition-colors">
                      <UserCog size={14} />
                    </div>
                    <span className="text-[13px] font-semibold text-[#334155]">Usuarios por Empresa</span>
                  </div>
                  <span className="text-[14px] font-semibold text-[#111827]">{plan.maxUsers === 999999 ? 'Ilimitados' : plan.maxUsers}</span>
                </div>

                <div className="flex items-center justify-between rounded-[16px] border border-[#EEF2F7] bg-[#FCFDFF] px-3.5 py-3 transition-all duration-200 hover:border-[#DBEAFE] hover:bg-white hover:shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB] transition-colors">
                      <Building2 size={14} />
                    </div>
                    <span className="text-[13px] font-semibold text-[#334155]">Sucursales Permitidas</span>
                  </div>
                  <span className="text-[14px] font-semibold text-[#111827]">{plan.maxBranches === 999999 ? 'Ilimitadas' : plan.maxBranches}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingPlan(plan);
                  setIsPlanModalOpen(true);
                }}
                className={`mt-6 flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#E2E8F0] bg-white text-[14px] font-semibold text-[#334155] transition-all hover:border-[#CBD5E1] hover:bg-[#F8FAFC] ${motionButtonClass}`}
              >
                <Edit3 size={15} />
                Editar parámetros
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
