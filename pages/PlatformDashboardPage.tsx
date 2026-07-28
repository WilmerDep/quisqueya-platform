import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Building2, FileText, Settings, UserRound, Users } from 'lucide-react';
import { contactsService, ContactRecord } from '../services/contactsService';
import { teamService, TeamSnapshot } from '../services/teamService';
import { auditService } from '../services/auditService';
import type { AuditLogItem } from '../services/apiClient';

export const PlatformDashboardPage: React.FC = () => {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [team, setTeam] = useState<TeamSnapshot>({ users: [], branches: [] });
  const [activity, setActivity] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    void Promise.all([contactsService.list(), teamService.list(), auditService.list()])
      .then(([nextContacts, nextTeam, nextActivity]) => {
        if (cancelled) return;
        setContacts(nextContacts);
        setTeam(nextTeam);
        setActivity(nextActivity.slice(0, 6));
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen de la plataforma.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeContacts = useMemo(() => contacts.filter(contact => contact.status === 'ACTIVE').length, [contacts]);
  const activeUsers = useMemo(() => team.users.filter(user => user.isActive).length, [team.users]);

  const cards = [
    { label: 'Contactos', value: contacts.length, helper: `${activeContacts} activos`, icon: UserRound, href: '/clients' },
    { label: 'Equipo', value: team.users.length, helper: `${activeUsers} usuarios activos`, icon: Users, href: '/users' },
    { label: 'Sucursales', value: team.branches.length, helper: 'Estructura organizacional', icon: Building2, href: '/settings' },
    { label: 'Actividad reciente', value: activity.length, helper: 'Eventos visibles en auditoría', icon: Activity, href: '/activity' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quisqueya Platform</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Escritorio</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Resumen operativo neutral del CRM y la organización. No se calculan préstamos, mora, caja ni rutas de cobranza heredadas.
        </p>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.href} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{loading ? '—' : card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><Icon size={20} /></div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Actividad reciente</h2>
              <p className="mt-1 text-sm text-slate-500">Últimos eventos disponibles en auditoría.</p>
            </div>
            <Link to="/activity" className="text-sm font-semibold text-slate-700 hover:text-slate-950">Ver todo</Link>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Accesos rápidos</h2>
          <div className="mt-5 space-y-3">
            <QuickLink href="/clients" icon={UserRound} label="Contactos" />
            <QuickLink href="/reports" icon={FileText} label="Reportes" />
            <QuickLink href="/settings" icon={Settings} label="Configuración" />
          </div>
        </section>
      </div>
    </div>
  );
};

const QuickLink: React.FC<{ href: string; icon: React.ComponentType<{ size?: number }>; label: string }> = ({ href, icon: Icon, label }) => (
  <Link to={href} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
    <Icon size={17} />
    {label}
  </Link>
);
