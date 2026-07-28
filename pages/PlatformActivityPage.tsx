import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Search, ShieldCheck, UserRound } from 'lucide-react';
import { auditService } from '../services/auditService';
import type { AuditLogItem } from '../services/apiClient';
import { emitPlatformToast } from '../services/platformEvents';

const PAGE_SIZE = 12;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export const PlatformActivityPage: React.FC = () => {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      setItems(await auditService.list());
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo cargar la actividad',
        message: error instanceof Error ? error.message : 'La API de auditoria no respondio correctamente.',
        tone: 'error',
        durationMs: 5200,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(item =>
      [item.title, item.description, item.actorName, item.actorUsername, item.action, item.entityType, item.branchName]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query)),
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const uniqueActors = useMemo(() => new Set(filtered.map(item => item.actorUserId).filter(Boolean)).size, [filtered]);
  const uniqueEntities = useMemo(() => new Set(filtered.map(item => `${item.entityType}:${item.entityId}`).filter(Boolean)).size, [filtered]);

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Auditoria</p>
        <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-[52px] font-black leading-none tracking-tight text-[#111827]">Actividad</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
              Registro de acciones y eventos devueltos por la API de Quisqueya Platform.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] transition-all hover:border-[#BFDBFE] hover:text-[#2563EB]"
          >
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <ShieldCheck size={22} className="text-[#2563EB]" />
          <p className="mt-5 text-[13px] font-semibold text-[#64748B]">Eventos visibles</p>
          <p className="mt-1 text-[30px] font-black text-[#111827]">{filtered.length}</p>
        </article>
        <article className="rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <UserRound size={22} className="text-[#2563EB]" />
          <p className="mt-5 text-[13px] font-semibold text-[#64748B]">Actores</p>
          <p className="mt-1 text-[30px] font-black text-[#111827]">{uniqueActors}</p>
        </article>
        <article className="rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <CalendarDays size={22} className="text-[#2563EB]" />
          <p className="mt-5 text-[13px] font-semibold text-[#64748B]">Entidades afectadas</p>
          <p className="mt-1 text-[30px] font-black text-[#111827]">{uniqueEntities}</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] px-4">
          <Search size={18} className="text-[#64748B]" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por accion, usuario, entidad o descripcion..."
            className="w-full bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8]"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-[15px] font-semibold text-[#64748B]">Cargando actividad...</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-[15px] font-semibold text-[#64748B]">No hay eventos para mostrar.</div>
        ) : (
          <div className="divide-y divide-[#EEF2F7]">
            {visible.map(item => (
              <article key={item.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_180px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2563EB]">
                      {item.action || item.activityType || 'EVENT'}
                    </span>
                    <span className="text-[12px] font-semibold text-[#94A3B8]">{item.entityType || 'platform'}</span>
                  </div>
                  <h2 className="mt-3 text-[17px] font-bold text-[#111827]">{item.title || item.action}</h2>
                  <p className="mt-1 text-[14px] font-medium leading-6 text-[#64748B]">{item.description}</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">{item.actorName || item.actorUsername || 'Sistema'}</p>
                  <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{item.branchName || 'Sin sucursal'}</p>
                </div>
                <p className="text-[13px] font-semibold text-[#64748B] lg:text-right">{formatDateTime(item.createdAt)}</p>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#EEF2F7] px-5 py-4">
          <p className="text-[13px] font-semibold text-[#64748B]">
            Pagina {safePage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
              className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-[13px] font-semibold text-[#111827] disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(value => Math.min(totalPages, value + 1))}
              className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-[13px] font-semibold text-[#111827] disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
