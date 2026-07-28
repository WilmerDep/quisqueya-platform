import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Globe2, Languages, Mail, MessageCircle, Phone, UserRound } from 'lucide-react';
import { ContactRecord, contactsService } from '../services/contactsService';

const statusLabel: Record<ContactRecord['status'], string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ARCHIVED: 'Archivado',
};

export const PlatformContactDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void contactsService
      .get(id)
      .then(data => {
        if (!cancelled) setContact(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el contacto.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Cargando contacto…</div>;
  if (error || !contact) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || 'Contacto no encontrado.'}</div>;

  return (
    <div className="space-y-6">
      <Link to="/clients" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950">
        <ArrowLeft size={17} /> Volver a contactos
      </Link>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <UserRound size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contacto CRM</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">{contact.firstName} {contact.lastName}</h1>
              <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{statusLabel[contact.status]}</span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Creado {new Date(contact.createdAt).toLocaleString()}</p>
            <p className="mt-1">Actualizado {new Date(contact.updatedAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Canales de contacto</h2>
          <div className="mt-5 space-y-4 text-sm">
            <DetailRow icon={Mail} label="Email" value={contact.email} />
            <DetailRow icon={Phone} label="Teléfono" value={contact.phone} />
            <DetailRow icon={MessageCircle} label="WhatsApp" value={contact.whatsapp} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Preferencias y origen</h2>
          <div className="mt-5 space-y-4 text-sm">
            <DetailRow icon={Globe2} label="País" value={contact.countryCode} />
            <DetailRow icon={Languages} label="Idioma preferido" value={contact.preferredLanguage} />
            <DetailRow icon={UserRound} label="Origen" value={contact.source} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-950">Notas</h2>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{contact.notes || 'Sin notas registradas.'}</p>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Relaciones futuras</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Customer, Travel Request, Opportunity, Quote, Booking y Traveler se conectarán aquí mediante entidades propias. No se reutilizan préstamos ni relaciones de cobranza heredadas.
        </p>
      </section>
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ComponentType<{ size?: number }>; label: string; value: string | null }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-slate-400"><Icon size={17} /></div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value || 'No registrado'}</p>
    </div>
  </div>
);
