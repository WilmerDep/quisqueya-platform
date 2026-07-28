import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { closePlatformBlockingState, readPlatformBlockingState } from '../services/platformEvents';
import { PlatformStateCard } from '../components/PlatformStateCard';

export const PlatformAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockingState, setBlockingState] = useState(readPlatformBlockingState());

  if (!isLoading && currentUser) return <Navigate to="/" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const success = await login(username.trim(), password);
      if (!success) {
        setError('No se pudo iniciar sesión con esas credenciales.');
        return;
      }

      closePlatformBlockingState();
      navigate('/', { replace: true, state: { from: location.pathname } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10 text-slate-950">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck size={22} />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em]">Quisqueya Platform</p>
              <p className="mt-1 text-sm text-slate-400">Administración, contenido y operaciones</p>
            </div>
          </div>

          <div className="max-w-md">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">Acceso interno</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight">Una base única para operar Quisqueya Travels.</h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Este acceso utiliza exclusivamente la API de Quisqueya Platform. Los flujos demo y la autenticación local heredada permanecen fuera del runtime activo.
            </p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Internal platform · API-backed access</p>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-md">
            {blockingState?.state === 'open' ? (
              <div className="mb-6">
                <PlatformStateCard
                  compact
                  kind={blockingState.kind}
                  title={blockingState.title}
                  message={blockingState.message}
                  primaryLabel={blockingState.primaryLabel}
                  secondaryLabel={blockingState.secondaryLabel}
                  onClose={() => {
                    closePlatformBlockingState();
                    setBlockingState(null);
                  }}
                  onPrimary={() => {
                    closePlatformBlockingState();
                    setBlockingState(null);
                  }}
                />
              </div>
            ) : null}

            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Quisqueya Platform</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Iniciar sesión</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                Usa una cuenta provisionada por la API. El registro público y las credenciales demo heredadas están deshabilitados.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Usuario</span>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                  <UserRound size={18} className="text-slate-400" />
                  <input
                    autoComplete="username"
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none"
                    placeholder="usuario"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Contraseña</span>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                  <LockKeyhole size={18} className="text-slate-400" />
                  <input
                    autoComplete="current-password"
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </label>

              {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Validando…' : 'Entrar al panel'}
                {!isSubmitting && <ArrowRight size={17} />}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};
