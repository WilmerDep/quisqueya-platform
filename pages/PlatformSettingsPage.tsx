import React, { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, RefreshCw, Save } from 'lucide-react';
import { Company, Branch } from '../types';
import { organizationService } from '../services/organizationService';
import { emitPlatformToast } from '../services/platformEvents';

export const PlatformSettingsPage: React.FC = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [rnc, setRnc] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const snapshot = await organizationService.load();
      setCompany(snapshot.company);
      setBranches(snapshot.branches);
      setName(snapshot.company.name || '');
      setRnc(snapshot.company.rnc || '');
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo cargar la organización',
        message: error instanceof Error ? error.message : 'La API no respondió correctamente.',
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

  const activeBranches = useMemo(() => branches.length, [branches]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!company) return;
    setIsSaving(true);
    try {
      const updated = await organizationService.updateCompany({ name: name.trim(), rnc: rnc.trim() || undefined });
      setCompany(updated);
      setName(updated.name || '');
      setRnc(updated.rnc || '');
      emitPlatformToast({
        title: 'Organización actualizada',
        message: 'Los cambios fueron guardados en la API.',
        tone: 'success',
        durationMs: 3200,
      });
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo guardar',
        message: error instanceof Error ? error.message : 'No se pudo actualizar la organización.',
        tone: 'error',
        durationMs: 5200,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Organización</p>
          <h1 className="mt-2 text-[52px] font-black leading-none tracking-tight text-[#111827]">Configuración</h1>
          <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
            Administra la identidad operativa y consulta las sucursales registradas en Quisqueya Platform.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-sm font-semibold text-[#111827] transition hover:border-[#BFDBFE] hover:text-[#2563EB] disabled:opacity-60"
        >
          <RefreshCw size={17} className={isLoading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#64748B]">Organización activa</p>
              <p className="text-xl font-black text-[#111827]">{company?.name || '—'}</p>
            </div>
          </div>
        </article>
        <article className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0FDF4] text-[#16A34A]">
              <MapPin size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#64748B]">Sucursales registradas</p>
              <p className="text-xl font-black text-[#111827]">{activeBranches}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <form onSubmit={handleSave} className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-tight text-[#111827]">Datos generales</h2>
          <p className="mt-2 text-sm font-medium text-[#64748B]">Esta información se guarda directamente en la API.</p>
          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#334155]">Nombre</span>
              <input value={name} onChange={event => setName(event.target.value)} className="h-13 w-full rounded-2xl border border-[#E5E7EB] px-4 text-sm font-medium outline-none transition focus:border-[#93C5FD]" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#334155]">RNC</span>
              <input value={rnc} onChange={event => setRnc(event.target.value)} className="h-13 w-full rounded-2xl border border-[#E5E7EB] px-4 text-sm font-medium outline-none transition focus:border-[#93C5FD]" />
            </label>
            <button type="submit" disabled={isSaving || !company} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8] disabled:opacity-60">
              <Save size={17} />
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>

        <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black tracking-tight text-[#111827]">Sucursales</h2>
          <p className="mt-2 text-sm font-medium text-[#64748B]">Lectura directa del módulo de sucursales de la API.</p>
          <div className="mt-5 space-y-3">
            {branches.map(branch => (
              <div key={branch.id} className="rounded-2xl border border-[#E5E7EB] bg-[#FCFDFF] px-4 py-4">
                <p className="font-semibold text-[#111827]">{branch.name}</p>
                <p className="mt-1 text-sm text-[#64748B]">{branch.address || 'Sin dirección registrada'}</p>
              </div>
            ))}
            {!isLoading && branches.length === 0 ? <p className="text-sm font-medium text-[#64748B]">No hay sucursales registradas.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
};
