import React, { useEffect, useState } from 'react';
import { Activity, Building2, ShieldCheck, Users } from 'lucide-react';
import { teamService, TeamSnapshot } from '../services/teamService';
import { organizationService, OrganizationSnapshot } from '../services/organizationService';
import { auditService } from '../services/auditService';
import type { AuditLogItem } from '../services/apiClient';

export const PlatformAdminPage: React.FC = () => {
  const [team, setTeam] = useState<TeamSnapshot>({ users: [], branches: [] });
  const [organization, setOrganization] = useState<OrganizationSnapshot | null>(null);
  const [activity, setActivity] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    void Promise.all([teamService.list(), organizationService.load(), auditService.list()])
      .then(([nextTeam, nextOrganization, nextActivity]) => {
        if (cancelled) return;
        setTeam(nextTeam);
        setOrganization(nextOrganization);
        setActivity(nextActivity.slice(0, 8));
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la administración de plataforma.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = [
    { label: 'Usuarios', value: team.users.length, helper: `${team.users.filter(user => user.isActive).length} activos`, icon: Users },
    { label: 'Sucursales', value: team.branches.length, helper: 'Estructura organizacional', icon: Building2 },
    { label: 'Eventos recientes', value: activity.length, helper: 'Auditoría disponible', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Administración</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Control de plataforma</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Vista administrativa neutral para identidad, organización y auditoría. Las funciones heredadas que no pertenecen al dominio de viajes permanecen fuera del runtime activo.
        </p>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{loading ? '—' : metric.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{metric.helper}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><Icon size={20} /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><ShieldCheck size={20} /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Organización</h2>
              <p className="text-sm text-slate-500">Fuente de verdad en API.</p>
            </div>
          </div>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-slate-400">Empresa</dt><dd className="mt-1 font-semibold text-slate-900">{organization?.company?.name || 'No disponible'}</dd></div>
            <div><dt className="text-slate-400">Sucursales</dt><dd className="mt-1 font-semibold text-slate-900">{team.branches.length}</dd></div>
            <div><dt className="text-slate-400">Usuarios</dt><dd className="mt-1 font-semibold text-slate-900">{team.users.length}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Auditoría reciente</h2>
            <p className="mt-1 text-sm text-slate-500">Últimos eventos accesibles desde el API.</p>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {loading ? (
              <div className="py-6 text-sm text-slate-500">Cargando actividad…</div>
            ) : activity.length === 0 ? (
              <div className="py-6 text-sm text-slate-500">Todavía no hay actividad para mostrar.</div>
            ) : (
              activity.map(item => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title || item.action}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.description || item.entityType}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
