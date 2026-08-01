import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, MessageSquareQuote, RefreshCw, Star } from 'lucide-react';
import { ReviewRecord, ReviewStatus, reviewsService } from '../services/reviewsService';

const statusLabel: Record<ReviewStatus, string> = {
  PENDING: 'Pendiente',
  PUBLISHED: 'Publicada',
  HIDDEN: 'Oculta',
  ARCHIVED: 'Archivada',
};

export const PlatformReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setReviews(await reviewsService.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reseñas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const published = useMemo(() => reviews.filter(review => review.status === 'PUBLISHED').length, [reviews]);
  const featured = useMemo(() => reviews.filter(review => review.featured).length, [reviews]);

  const patch = async (review: ReviewRecord, payload: Partial<Pick<ReviewRecord, 'status' | 'featured' | 'sortOrder'>>) => {
    setSavingId(review.id);
    setError('');
    try {
      const updated = await reviewsService.update(review.id, payload);
      setReviews(current => current.map(item => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la reseña.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6 p-5 md:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contenido</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Reseñas y testimonios</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Administra las reseñas persistidas en la plataforma y decide cuáles se publican en la web comercial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
        >
          <RefreshCw size={17} /> Actualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total importadas</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{reviews.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Publicadas</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{published}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Destacadas</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{featured}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
        La importación desde Trustindex/WordPress será puntual. Después de importadas, la base de datos, este panel y la API serán la fuente de verdad.
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Cargando reseñas…</div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <MessageSquareQuote size={38} className="text-slate-300" />
            <p className="mt-4 font-semibold text-slate-900">Todavía no hay reseñas persistidas</p>
            <p className="mt-1 max-w-lg text-sm leading-6 text-slate-500">
              El siguiente paso será ejecutar el importador inicial y luego moderar aquí cuáles se publican.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map(review => (
              <article key={review.id} className="p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-950">{review.authorName}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{statusLabel[review.status]}</span>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">{review.source === 'google' ? 'Google' : 'Manual'}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-amber-500" aria-label={`${review.rating} de 5 estrellas`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star key={index} size={16} fill={index < review.rating ? 'currentColor' : 'none'} className={index < review.rating ? '' : 'text-slate-300'} />
                      ))}
                    </div>
                    <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">{review.reviewText}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      {review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString() : 'Fecha no disponible'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingId === review.id}
                      onClick={() => void patch(review, { featured: !review.featured })}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${review.featured ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700'}`}
                    >
                      <Star size={15} fill={review.featured ? 'currentColor' : 'none'} />
                      {review.featured ? 'Destacada' : 'Destacar'}
                    </button>
                    <button
                      type="button"
                      disabled={savingId === review.id}
                      onClick={() => void patch(review, { status: review.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED' })}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white transition disabled:cursor-wait disabled:opacity-60 ${review.status === 'PUBLISHED' ? 'bg-slate-700 hover:bg-slate-900' : 'bg-teal-700 hover:bg-teal-800'}`}
                    >
                      {review.status === 'PUBLISHED' ? <EyeOff size={15} /> : <Eye size={15} />}
                      {review.status === 'PUBLISHED' ? 'Ocultar' : 'Publicar'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
