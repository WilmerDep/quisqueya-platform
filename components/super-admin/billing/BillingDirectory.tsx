import React from 'react';
import { Search, TrendingUp, DollarSign, Building2, AlertTriangle, Download, Filter } from 'lucide-react';
import { PlatformPageHeader } from '../../../components/ui/PlatformPageHeader';
import { PlatformKpiCard } from '../../../components/ui/PlatformKpiCard';
import { FilterDropdown } from '../../../components/ui/FilterDropdown';
import { 
  platformShellCardClass, 
  platformFilterFieldClass,
  platformTableHeaderClass,
  platformTableRowClass,
  platformMotionButtonClass
} from '../../../components/ui/platformStyles';
import { formatCurrency, formatDate } from '../../../utils';
import { Company } from '../../../types';
import { 
  createPlatformPdfDoc, 
  getPlatformPdfVisualPreset, 
  drawPlatformPdfCard, 
  drawPlatformPdfFooter, 
  drawPlatformPdfDivider,
  platformPdfMarginByPreset
} from '../../../services/pdfBuilder';


export type BillingRow = {
  id: string;
  companyName: string;
  planName: string;
  cycle: string;
  amount: number;
  status: string;
  dueDate: string;
};

export const BillingDirectory = ({
  billingSearchTerm,
  setBillingSearchTerm,
  billingStatusFilter,
  setBillingStatusFilter,
  tenantCompanies,
  filteredBillingRows,
  billingRows,
  metrics,
  onCompanyClick
}: {
  billingSearchTerm: string;
  setBillingSearchTerm: (val: string) => void;
  billingStatusFilter: string;
  setBillingStatusFilter: (val: string) => void;
  tenantCompanies: Company[];
  filteredBillingRows: BillingRow[];
  billingRows: BillingRow[];
  metrics: { mrr: number; totalRevenue: number };
  onCompanyClick?: (companyId: string) => void;
}) => {
  const exportBillingSummaryPdf = () => {
    const doc = createPlatformPdfDoc({
      paperSize: 'Carta',
      orientation: 'Vertical',
    });
    const visualPreset = getPlatformPdfVisualPreset('FACTURA_FINANCIERA');
    const [accentR, accentG, accentB] = visualPreset.accent;
    const [neutralR, neutralG, neutralB] = visualPreset.neutral;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = platformPdfMarginByPreset['Normal'];
    const right = pageWidth - left;
    const contentWidth = right - left;
    let y = 48;

    const setText = (size, weight, color) => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
    };

    drawPlatformPdfCard({
      doc,
      x: left,
      y,
      width: contentWidth,
      height: 102,
      fill: [neutralR, neutralG, neutralB],
      border: [neutralR, neutralG, neutralB],
      radius: 20,
    });

    setText(28, 'bold', [255, 255, 255]);
    doc.text('Resumen de Facturacion', left + 24, y + 40);
    setText(12, 'normal', [148, 163, 184]);
    doc.text('Estado global de suscripciones y cobros', left + 24, y + 60);

    setText(10, 'normal', [148, 163, 184]);
    doc.text('FECHA DE REPORTE', right - 24, y + 36, { align: 'right' });
    setText(12, 'bold', [255, 255, 255]);
    doc.text(formatDate(new Date().toISOString()), right - 24, y + 52, { align: 'right' });

    y += 134;

    drawPlatformPdfCard({
      doc,
      x: left,
      y,
      width: contentWidth,
      height: 80,
      fill: [248, 250, 252],
      border: [226, 232, 240],
      radius: 16,
    });

    const kpiWidth = contentWidth / 4;
    
    setText(10, 'normal', [100, 116, 139]);
    doc.text('MRR TOTAL', left + 20, y + 30);
    setText(16, 'bold', [accentR, accentG, accentB]);
    doc.text(formatCurrency(metrics.mrr), left + 20, y + 54);

    setText(10, 'normal', [100, 116, 139]);
    doc.text('COBRADO', left + kpiWidth + 20, y + 30);
    setText(16, 'bold', [15, 23, 42]);
    doc.text(formatCurrency(metrics.totalRevenue), left + kpiWidth + 20, y + 54);

    setText(10, 'normal', [100, 116, 139]);
    doc.text('EMPRESAS ACTIVAS', left + (kpiWidth * 2) + 20, y + 30);
    setText(16, 'bold', [15, 23, 42]);
    doc.text(String(tenantCompanies.filter(c => c.status === 'ACTIVE').length), left + (kpiWidth * 2) + 20, y + 54);

    const morosidad = billingRows.filter(r => r.status === 'En mora').length;
    setText(10, 'normal', [100, 116, 139]);
    doc.text('EN MORA', left + (kpiWidth * 3) + 20, y + 30);
    setText(16, 'bold', [220, 38, 38]);
    doc.text(String(morosidad), left + (kpiWidth * 3) + 20, y + 54);

    y += 112;

    setText(14, 'bold', [15, 23, 42]);
    doc.text('Detalle de Suscripciones', left, y);
    
    y += 20;

    setText(9, 'bold', [100, 116, 139]);
    doc.text('EMPRESA', left + 10, y);
    doc.text('PLAN', left + 160, y);
    doc.text('CICLO', left + 250, y);
    doc.text('ESTADO', left + 320, y);
    doc.text('VENCIMIENTO', left + 400, y);
    doc.text('MONTO', right - 10, y, { align: 'right' });

    y += 12;
    drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [226, 232, 240] });
    y += 16;

    filteredBillingRows.forEach(row => {
      if (y > pageHeight - 100) {
        doc.addPage();
        y = 48;
      }
      setText(10, 'bold', [15, 23, 42]);
      const companyName = row.companyName.length > 20 ? row.companyName.substring(0, 20) + '...' : row.companyName;
      doc.text(companyName, left + 10, y);
      
      setText(10, 'normal', [71, 85, 105]);
      doc.text(row.planName, left + 160, y);
      doc.text(row.cycle, left + 250, y);
      
      if (row.status === 'Pagada') {
        setText(10, 'bold', [22, 163, 74]);
      } else if (row.status === 'En mora') {
        setText(10, 'bold', [220, 38, 38]);
      } else {
        setText(10, 'bold', [234, 179, 8]);
      }
      doc.text(row.status, left + 320, y);
      
      setText(10, 'normal', [71, 85, 105]);
      doc.text(row.dueDate, left + 400, y);
      
      setText(10, 'bold', [15, 23, 42]);
      doc.text(formatCurrency(row.amount), right - 10, y, { align: 'right' });

      y += 16;
      drawPlatformPdfDivider({ doc, x1: left, x2: right, y, color: [241, 245, 249] });
      y += 16;
    });

    drawPlatformPdfFooter({
      doc,
      left,
      right,
      y: pageHeight - 48,
      note: 'Generado por PrestaFácil RD (SuperAdmin)',
      presetLabel: visualPreset.label,
    });

    doc.save('Resumen_Facturacion.pdf');
  };

  return (
    <section className="space-y-6 animate-[platform-fade-in_180ms_ease-out]">
      <div data-super-hero>
        <PlatformPageHeader
          title="Facturación"
          description="Seguimiento de suscripciones, cobros globales y estado de renovacion por empresa."
          actions={[{
            label: "Exportar resumen",
            icon: Download,
            onClick: exportBillingSummaryPdf,
            variant: "secondary"
          }]}
        />
      </div>

      <div data-super-panel className="relative z-30 rounded-[26px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(320px,1fr)_auto]">
          <FilterDropdown
            value={billingStatusFilter === 'Todos' ? '' : billingStatusFilter}
            onChange={(val) => setBillingStatusFilter(val || 'Todos')}
            placeholder="Todos los estados"
            options={[
              { value: 'Pagada', label: 'Pagada' },
              { value: 'Pendiente', label: 'Pendiente' },
              { value: 'En mora', label: 'En mora' },
            ]}
          />
          <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD] focus-within:shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
            <Search size={18} className="text-[#6B7280]" />
            <input
              value={billingSearchTerm}
              onChange={event => setBillingSearchTerm(event.target.value)}
              placeholder="Buscar por empresa, plan, ciclo o estado..."
              className="w-full bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setBillingSearchTerm('');
              setBillingStatusFilter('Todos');
            }}
            className={`inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${platformMotionButtonClass}`}
          >
            <Filter size={18} />
            Limpiar filtros
          </button></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <PlatformKpiCard
          label="MRR Mensual Estimado"
          value={formatCurrency(metrics.mrr)}
          helper="Ingreso recurrente."
          trend="+5%"
          icon={TrendingUp}
          tone="blue"
        />
        <PlatformKpiCard
          label="Cobros Totales"
          value={formatCurrency(metrics.totalRevenue)}
          helper="Histórico acumulado."
          trend="+12%"
          icon={DollarSign}
          tone="emerald"
        />
        <PlatformKpiCard
          label="Empresas Activas"
          value={`${tenantCompanies.filter(c => c.status === 'ACTIVE').length}`}
          helper="Empresas en operación."
          trend="+2"
          icon={Building2}
          tone="violet"
        />
        <PlatformKpiCard
          label="Facturas Pendientes"
          value={`${billingRows.filter(item => item.status !== 'Pagada').length}`}
          helper="Requieren atención."
          trend="-1"
          icon={AlertTriangle}
          tone="amber"
        />
      </div>

      <div data-super-panel className={`${platformShellCardClass} overflow-hidden rounded-[32px]`}>
        <div className="overflow-x-auto">
          <div className="min-w-[940px]">
            {/* Header */}
            <div className={`grid grid-cols-[2fr_1.4fr_1.1fr_1.3fr_1.3fr_1.3fr] px-6 py-4.5 ${platformTableHeaderClass}`}>
              <div>Empresa</div>
              <div>Plan contratado</div>
              <div>Ciclo</div>
              <div>Monto</div>
              <div>Estado de pago</div>
              <div>Próx. Vencimiento</div>
            </div>
            {/* Body */}
            <div className="divide-y divide-slate-100 bg-white">
              {filteredBillingRows.map(row => (
                <div
                  key={row.id}
                  data-super-row
                  onClick={() => onCompanyClick?.(row.id)}
                  className={`group grid grid-cols-[2fr_1.4fr_1.1fr_1.3fr_1.3fr_1.3fr] items-center px-6 py-4.5 text-[14.5px] ${platformTableRowClass} cursor-pointer hover:bg-[#F8FAFC]`}
                >
                  <div className="flex cursor-pointer items-center gap-3 text-left transition-all duration-200 group-hover:translate-x-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[12px] font-black uppercase text-[#2563EB] transition-all duration-200 group-hover:bg-[#DBEAFE]">
                      {row.companyName.slice(0, 2)}
                    </div>
                    <span className="font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors">{row.companyName}</span>
                  </div>
                  <div className="font-medium text-slate-600">{row.planName}</div>
                  <div>
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${row.cycle === 'Anual' ? 'bg-[#F3E8FF] text-[#7C3AED]' : 'bg-[#DBEAFE] text-[#2563EB]'}`}>
                      {row.cycle}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900">{formatCurrency(row.amount)}</div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${
                      row.status === 'Pagada' ?
                          'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]' 
                        : row.status === 'Pendiente' ?
                            'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]' 
                          : 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        row.status === 'Pagada' ? 'bg-[#10B981] animate-pulse' : row.status === 'Pendiente' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                      }`} />
                      {row.status}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-500">{formatDate(row.dueDate)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
