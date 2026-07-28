import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileOutput, FileText, Loader2, RefreshCw, Rows3 } from 'lucide-react';
import { reportingService, ReportingOverview } from '../services/reportingService';
import { emitPlatformToast } from '../services/platformEvents';

const emptyOverview: ReportingOverview = { exports: [], schedules: [], templates: [] };

export const PlatformReportsPage: React.FC = () => {
  const [overview, setOverview] = useState<ReportingOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setOverview(await reportingService.load());
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo cargar reportes',
        message: error instanceof Error ? error.message : 'La API no devolvio la informacion de reportes.',
        tone: 'error',
        durationMs: 5200,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredExports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return overview.exports;
    return overview.exports.filter(item =>
      [item.reportName, item.reportType, item.format, item.rangeLabel].some(value => String(value || '').toLowerCase().includes(q)),
    );
  }, [overview.exports, search]);

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Analitica y documentos</p>
          <h1 className="mt-2 text-[52px] font-black leading-none tracking-tight text-[#111827]">Reportes</h1>
          <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
            Centro neutral para consultar exportaciones, programaciones y plantillas disponibles en la plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] transition-all hover:border-[#DBEAFE] hover:text-[#2563EB] disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          Actualizar
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Exportaciones', value: overview.exports.length, icon: FileOutput },
          { label: 'Programaciones', value: overview.schedules.length, icon: CalendarClock },
          { label: 'Plantillas', value: overview.templates.length, icon: Rows3 },
        ].map(card => (
          <article key={card.label} className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
              <card.icon size={22} />
            </div>
            <p className="mt-6 text-[15px] font-semibold text-[#64748B]">{card.label}</p>
            <p className="mt-2 text-[34px] font-black tracking-tight text-[#111827]">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[24px] font-black tracking-tight text-[#111827]">Exportaciones recientes</h2>
            <p className="mt-1 text-[14px] font-medium text-[#64748B]">Documentos generados y registrados por la API.</p>
          </div>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por nombre, tipo o formato"
            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[14px] font-medium outline-none transition-colors focus:border-[#93C5FD] md:w-[320px]"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#E5E7EB]">
          <div className="grid grid-cols-[1.6fr_1fr_0.7fr_1fr] gap-4 bg-[#F8FAFC] px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
            <span>Reporte</span><span>Tipo</span><span>Formato</span><span>Periodo</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-10 text-[#64748B]"><Loader2 size={18} className="animate-spin" /> Cargando...</div>
          ) : filteredExports.length ? (
            filteredExports.slice(0, 12).map(item => (
              <div key={item.id} className="grid grid-cols-[1.6fr_1fr_0.7fr_1fr] gap-4 border-t border-[#EEF2F7] px-5 py-4 text-[14px] font-medium text-[#334155]">
                <span className="flex items-center gap-2 font-semibold text-[#111827]"><FileText size={16} className="text-[#2563EB]" />{item.reportName}</span>
                <span>{item.reportType}</span><span>{item.format}</span><span>{item.rangeLabel}</span>
              </div>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-[14px] font-medium text-[#64748B]">No hay exportaciones para mostrar.</div>
          )}
        </div>
      </section>
    </div>
  );
};
