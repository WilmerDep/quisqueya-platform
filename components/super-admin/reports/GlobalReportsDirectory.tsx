import React, { useState, useMemo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { jsPDF } from 'jspdf';
import { 
  TrendingUp, WalletCards, FileSpreadsheet, FileText, 
  ArrowLeft, Download, Building2, Users, Activity, Search, Filter
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { PdfTemplateBuilder } from '../../PdfTemplateBuilder';
import { PlatformPageHeader } from '../../../components/ui/PlatformPageHeader';
import { FilterDropdown } from '../../../components/ui/FilterDropdown';
import { PlatformKpiCard } from '../../../components/ui/PlatformKpiCard';
import { platformShellCardClass, platformMotionButtonClass } from '../../../components/ui/platformStyles';
import { Company } from '../../../types';
import { formatCurrency } from '../../../utils';

type ReportTab = 'SUMMARY' | 'FINANCIAL' | 'OPERATIONAL' | 'EXPORTS';
type ReportsSubview = 'MAIN' | 'TEMPLATE';

interface GlobalReportsDirectoryProps {
  tenantCompanies: Company[];
  metrics: {
    mrr: number;
    totalRevenue: number;
    activeTenants?: number;
    totalTenants: number;
  };
  tenantUsersRows: any[];
  masterLogs: any[]; // Assuming masterLogs type is not strictly needed for this mockup
}

const reportTabs: Array<{ key: ReportTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { key: 'SUMMARY', label: 'Resumen', icon: TrendingUp },
  { key: 'FINANCIAL', label: 'Financieros', icon: WalletCards },
  { key: 'OPERATIONAL', label: 'Operativos', icon: FileSpreadsheet },
  { key: 'EXPORTS', label: 'Exportaciones', icon: FileText },
];

const horizontalMotionClass = 'cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

export const GlobalReportsDirectory: React.FC<GlobalReportsDirectoryProps> = ({
  tenantCompanies,
  metrics,
  tenantUsersRows,
  masterLogs
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('SUMMARY');
  const reportsRef = useRef<HTMLDivElement>(null);

  const [reportsSubview, setReportsSubview] = useState<ReportsSubview>('MAIN');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!reportsRef.current) return;
    const ctx = gsap.context(() => {
      const animateIfPresent = (
        selector: string,
        fromVars: gsap.TweenVars,
        toVars: gsap.TweenVars,
      ) => {
        if (!reportsRef.current?.querySelector(selector)) return;
        gsap.fromTo(selector, fromVars, toVars);
      };

      animateIfPresent('[data-super-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      animateIfPresent('[data-super-kpi]', { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.08 });
      animateIfPresent('[data-super-filters]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.16 });
      animateIfPresent('[data-super-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
      animateIfPresent('[data-super-row]', { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.36, ease: 'power2.out', stagger: 0.035, delay: 0.28 });
    }, reportsRef);
    return () => ctx.revert();
  }, [activeTab, reportsSubview]);

  

  
  const dateMultiplier = useMemo(() => {
    switch(statusFilter) {
      case 'TODAY': return 0.05;
      case 'THIS_MONTH': return 0.85;
      case 'LAST_MONTH': return 0.65;
      case 'TOTAL':
      default: return 1;
    }
  }, [statusFilter]);

  const mrrData = useMemo(() => {
    // Generate some mockup historical MRR data based on the current metrics
    return [
      { name: 'Ene', mrr: metrics.mrr * 0.7 * dateMultiplier },
      { name: 'Feb', mrr: metrics.mrr * 0.75 * dateMultiplier },
      { name: 'Mar', mrr: metrics.mrr * 0.8 * dateMultiplier },
      { name: 'Abr', mrr: metrics.mrr * 0.85 * dateMultiplier },
      { name: 'May', mrr: metrics.mrr * 0.95 * dateMultiplier },
      { name: 'Jun', mrr: metrics.mrr * dateMultiplier },
    ];
  }, [metrics.mrr, dateMultiplier]);

  const activeUsersCount = Math.floor(tenantUsersRows.filter(u => u.status === 'Activo').length * dateMultiplier);

  const handleExportMRR = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(37, 99, 235); // Blue
      doc.text('Abundra - Reporte MRR Global', 20, 30);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // Slate
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-DO')}`, 20, 40);

      doc.setFontSize(16);
      doc.setTextColor(17, 24, 39); // Dark
      doc.text('Resumen Financiero', 20, 60);
      
      doc.setFontSize(14);
      doc.text(`MRR Actual: ${formatCurrency(metrics.mrr * dateMultiplier)}`, 20, 75);
      doc.text(`Ingreso Total Histórico: ${formatCurrency(metrics.totalRevenue * dateMultiplier)}`, 20, 85);
      doc.text(`Empresas Activas: ${Math.floor(tenantCompanies.filter(c => c.status === 'ACTIVE').length * dateMultiplier)} / ${Math.floor(metrics.totalTenants * dateMultiplier)}`, 20, 95);
      doc.text(`Usuarios Globales: ${activeUsersCount}`, 20, 105);

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text('Documento generado automáticamente por el sistema.', 20, 280);

      doc.save('Abundra_Reporte_MRR.pdf');
    } catch (error) {
      console.error("Error al exportar:", error);
      alert("Hubo un error al generar el reporte.");
    }
  };

  
  if (reportsSubview === 'TEMPLATE') {
    return (
      <div className="space-y-6 pb-24 lg:pb-0 animate-[platform-fade-in_180ms_ease-out]">
        <div data-super-hero>
          <PlatformPageHeader
            title="Editor de plantilla (Global)"
            description="Configura una plantilla financiera en ancho completo para los reportes administrativos de Abundra."
            actions={[{
              label: "Volver a reportes",
              icon: ArrowLeft,
              onClick: () => setReportsSubview('MAIN'),
              variant: "secondary"
            }]}
          />
        </div>
        
        {/* Pass SUPERADMIN as companyId to use global/SaaS level templates */}
        <PdfTemplateBuilder companyId="SUPERADMIN" onBack={() => setReportsSubview('MAIN')} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-[platform-fade-in_180ms_ease-out]">
      <div data-super-hero>
        <PlatformPageHeader
          title="Reportes"
          description="Lectura ejecutiva de Abundra con resumen financiero, operativo y de riesgo global."
        />
      </div>

      <div data-super-panel className="relative z-40 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm mb-2">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(320px,1fr)_auto]">
          <FilterDropdown
            value={statusFilter === 'Todos' ? '' : statusFilter}
            onChange={(val) => setStatusFilter(val || 'Todos')}
            placeholder="Filtrar por fecha"
            options={[
              { value: 'TODAY', label: 'Hoy' },
              { value: 'THIS_MONTH', label: 'Este mes' },
              { value: 'LAST_MONTH', label: 'Mes pasado' },
              { value: 'TOTAL', label: 'Histórico completo' },
            ]}
          />
          <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD] focus-within:shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
            <Search size={18} className="text-[#6B7280]" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre de empresa o referencia..."
              className="w-full bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('Todos');
            }}
            className={`inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${platformMotionButtonClass}`}
          >
            <Filter size={18} />
            Limpiar filtros
          </button>
        </div>
      </div>

      <div data-super-panel className="relative z-30 rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm mb-6 flex flex-wrap gap-3">
        {reportTabs.map(tab => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                active ?
                   'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
              }`}
            >
              <Icon size={15} className={active ? 'text-[#2563EB]' : 'text-[#64748B]'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'SUMMARY' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div data-super-kpi>
              <PlatformKpiCard
                label="MRR Actual"
                value={formatCurrency(metrics.mrr * dateMultiplier)}
                helper="Ingreso recurrente global"
                icon={TrendingUp}
                trend="+15%"
                tone="blue"
              />
            </div>
            <div data-super-kpi>
              <PlatformKpiCard
                label="Ingreso Total Histórico"
                value={formatCurrency(metrics.totalRevenue * dateMultiplier)}
                helper="Acumulado histórico"
                icon={WalletCards}
                trend="+20%"
                tone="emerald"
              />
            </div>
            <div data-super-kpi>
              <PlatformKpiCard
                label="Empresas Activas"
                value={`${Math.floor(tenantCompanies.filter(c => c.status === 'ACTIVE').length * dateMultiplier)} / ${Math.floor(metrics.totalTenants * dateMultiplier)}`}
                helper="Empresas en operación"
                icon={Building2}
                trend="+5%"
                tone="violet"
              />
            </div>
            <div data-super-kpi>
              <PlatformKpiCard
                label="Usuarios Globales"
                value={`${activeUsersCount} activos`}
                helper="Usuarios activos"
                icon={Users}
                trend="+10%"
                tone="amber"
              />
            </div>
          </div>
          
          <div data-super-panel className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-[#2563EB]" />
                <h2 className="text-[19px] font-semibold text-[#111827]">Crecimiento MRR</h2>
              </div>
              <span className="inline-flex rounded-full bg-slate-50 border border-slate-200 px-3.5 py-1 text-xs font-semibold text-slate-600">
                Últimos 6 meses
              </span>
            </div>
            <div className="h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mrrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748B', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748B', fontWeight: 500 }} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', padding: '12px 20px', fontWeight: 'bold' }}
                    formatter={(value: number) => [formatCurrency(value), 'MRR']}
                  />
                  <Bar dataKey="mrr" radius={[6, 6, 0, 0]}>
                    {mrrData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === mrrData.length - 1 ? '#2563EB' : '#93C5FD'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'FINANCIAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <WalletCards size={20} className="text-[#2563EB]" />
              <h2 className="text-[19px] font-semibold text-[#111827]">Distribución por Planes</h2>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-[250px] bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
               <p className="text-slate-400 font-medium">Gráfico de distribución en construcción</p>
            </div>
          </div>
          <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <Activity size={20} className="text-[#2563EB]" />
              <h2 className="text-[19px] font-semibold text-[#111827]">Proyección de Renovaciones</h2>
            </div>
             <div className="flex-1 flex items-center justify-center min-h-[250px] bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
               <p className="text-slate-400 font-medium">Gráfico de renovaciones en construcción</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'OPERATIONAL' && (
        <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
            <Activity size={20} className="text-[#2563EB]" />
            <h2 className="text-[19px] font-semibold text-[#111827]">Actividad General del Sistema</h2>
          </div>
          <div className="space-y-3">
             <div className="p-4 bg-slate-50/50 rounded-[20px] border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-2">
                <span className="font-semibold text-[#64748B]">Total Eventos Registrados</span>
                <span className="text-[20px] font-black text-[#111827]">{Math.floor(masterLogs.length * dateMultiplier)}</span>
             </div>
             <div className="p-4 bg-slate-50/50 rounded-[20px] border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-2">
                <span className="font-semibold text-[#64748B]">Empresas Activas en plataforma</span>
                <span className="text-[20px] font-black text-[#16A34A]">${Math.floor(tenantCompanies.filter(c => c.status === 'ACTIVE').length * dateMultiplier)}</span>
             </div>
             <div className="p-4 bg-slate-50/50 rounded-[20px] border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-2">
                <span className="font-semibold text-[#64748B]">Empresas en periodo de prueba (TRIAL)</span>
                <span className="text-[20px] font-black text-[#F59E0B]">${Math.floor(tenantCompanies.filter(c => c.status === 'TRIAL').length * dateMultiplier)}</span>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'EXPORTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button type="button" className="text-left rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm hover:border-[#BFDBFE] hover:shadow-[0_12px_28px_rgba(37,99,235,0.08)] transition-all group" onClick={() => setReportsSubview('TEMPLATE')}>
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-[#EFF6FF] text-[#2563EB] rounded-[20px] group-hover:scale-105 transition-transform">
                 <FileText size={24} />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#111827] mb-1">Constructor de Plantillas PDF</h3>
                <p className="text-[14px] text-[#64748B] font-medium leading-relaxed">Configura y edita las plantillas globales para reportes personalizados.</p>
              </div>
            </div>
          </button>
          
          <button type="button" onClick={handleExportMRR} className="text-left rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm hover:border-[#DCFCE7] hover:shadow-[0_12px_28px_rgba(22,163,74,0.08)] transition-all group">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-[#DCFCE7] text-[#16A34A] rounded-[20px] group-hover:scale-105 transition-transform">
                 <Download size={24} />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#111827] mb-1">Exportar MRR Actual</h3>
                <p className="text-[14px] text-[#64748B] font-medium leading-relaxed">Descarga un documento Excel o PDF con el resumen financiero de hoy.</p>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
