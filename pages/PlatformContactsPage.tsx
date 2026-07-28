import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Mail, Phone, Plus, Search, UserRound } from 'lucide-react';
import { ContactRecord, ContactStatus, contactsService } from '../services/contactsService';

const statusLabel: Record<ContactStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ARCHIVED: 'Archivado',
};

export const PlatformContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContactStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void contactsService
        .list({ search, status: status || undefined })
        .then(data => {
          if (!cancelled) setContacts(data);
        })
        .catch(err => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar los contactos.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, status]);

  const activeCount = useMemo(() => contacts.filter(contact => contact.status === 'ACTIVE').length, [contacts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">CRM</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Contactos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Personas registradas en el CRM. Un contacto no implica automáticamente que sea cliente o viajero.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="La creación guiada se habilitará en la siguiente iteración del CRM."
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white opacity-50"
        >
          <Plus size={17} /> Nuevo contacto
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Resultados</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{contacts.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Activos</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Fuente de verdad</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Nest API · Contact</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nombre, email, teléfono o WhatsApp"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-slate-400"
            />
          </label>
          <select
            value={status}
            onChange={event => setStatus(event.target.value as ContactStatus | '')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
            <option value="ARCHIVED">Archivados</option>
          </select>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Cargando contactos…</div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <UserRound size={34} className="text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900">No hay contactos para mostrar</p>
            <p className="mt-1 text-sm text-slate-500">Ajusta los filtros o crea el primer contacto cuando se habilite el formulario.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {contacts.map(contact => (
              <Link key={contact.id} to={`/clients/${contact.id}`} className="block px-5 py-4 transition hover:bg-slate-50">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-semibold text-slate-950">{contact.firstName} {contact.lastName}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{statusLabel[contact.status]}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      {contact.email ? <span className="inline-flex items-center gap-1.5"><Mail size={14} />{contact.email}</span> : null}
                      {contact.phone ? <span className="inline-flex items-center gap-1.5"><Phone size={14} />{contact.phone}</span> : null}
                      {contact.source ? <span>Origen: {contact.source}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {contact.status === 'ARCHIVED' ? <Archive size={14} /> : null}
                    Actualizado {new Date(contact.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
