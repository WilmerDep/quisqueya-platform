import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCompany, getAllUsers, updateUser } from '../services/dataService';
import { createPasswordSalt, hashPassword } from '../services/authService';
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, CreditCard, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { ApiRequestError } from '../services/apiClient';
import { closePlatformBlockingState, readPlatformBlockingState } from '../services/platformEvents';
import { PlatformStateCard } from '../components/PlatformStateCard';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'INVITE_ACTIVATE'>(location.state?.mode || 'LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockingState, setBlockingState] = useState(readPlatformBlockingState());

  const [username, setUsername] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(location.state?.planId || 'p2');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingInviteUserId, setPendingInviteUserId] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username.trim(), password.trim());
      if (success) {
        closePlatformBlockingState();
        navigate('/');
      } else {
        const normalizedUsername = username.trim().toLowerCase();
        const invitedUser = getAllUsers().find(user => {
          const matchesUsername = user.username.toLowerCase() === normalizedUsername;
          const matchesEmail = (user.invitationEmail || user.email || '').toLowerCase() === normalizedUsername;
          return (matchesUsername || matchesEmail) && user.firstAccessRequired && user.invitationStatus === 'PENDIENTE';
        });

        if (invitedUser) {
          setPendingInviteUserId(invitedUser.id);
          setUsername(invitedUser.username);
          setEmail(invitedUser.invitationEmail || invitedUser.email || '');
          setPassword('');
          setConfirmPassword('');
          setMode('INVITE_ACTIVATE');
          setError('Tu acceso fue pre-registrado. Define tu clave para activar la cuenta.');
        } else {
          setError('Credenciales invalidas. Use admin/admin123 o master/master123 para la demo.');
        }
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo iniciar sesion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoUser: 'admin' | 'master') => {
    const demoPassword = demoUser === 'admin' ? 'admin123' : 'master123';
    setUsername(demoUser);
    setPassword(demoPassword);
    setError('');
    setIsLoading(true);

    try {
      const success = await login(demoUser, demoPassword);
      if (success) {
        closePlatformBlockingState();
        navigate('/');
      } else {
        setError('No se pudo iniciar la demo automaticamente.');
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se pudo iniciar la demo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (password.length < 8) {
        setError('La contrasena debe tener al menos 8 caracteres.');
        setIsLoading(false);
        return;
      }

      const passwordSalt = createPasswordSalt();
      const passwordHash = await hashPassword(password, passwordSalt);
      const dummyCreator: any = { id: 'SYSTEM', name: 'Sistema' };
      const result = createCompany(
        {
          name: companyName,
          planId: selectedPlanId,
          billingCycle: 'MONTHLY',
          email,
          passwordSalt,
          passwordHash,
        },
        dummyCreator,
      );

      if (result?.adminUser) {
        await login(result.adminUser.username, password);
        closePlatformBlockingState();
        navigate('/');
      } else {
        setError('No se pudo crear el usuario administrador inicial.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!pendingInviteUserId) {
        setError('No se encontro una invitacion pendiente para este acceso.');
        setIsLoading(false);
        return;
      }
      if (password.length < 8) {
        setError('La contrasena debe tener al menos 8 caracteres.');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contrasenas no coinciden.');
        setIsLoading(false);
        return;
      }

      const passwordSalt = createPasswordSalt();
      const passwordHash = await hashPassword(password, passwordSalt);
      updateUser(pendingInviteUserId, {
        passwordSalt,
        passwordHash,
        passwordUpdatedAt: new Date().toISOString(),
        invitationStatus: 'ACEPTADA',
        firstAccessRequired: false,
      });

      const success = await login(username.trim(), password.trim());
      if (success) {
        closePlatformBlockingState();
        navigate('/');
      } else {
        setError('La cuenta fue activada, pero no se pudo iniciar sesion automaticamente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f6f7fb]">
      <div className="hidden w-[44%] flex-col justify-between border-r border-slate-200 bg-white px-12 py-12 lg:flex">
        <div>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck size={18} />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">PrestaFacil RD</p>
              <p className="text-sm font-bold text-slate-500">Gestion de cartera y cobros</p>
            </div>
          </button>
        </div>

        <div className="max-w-md">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Acceso operativo</p>
          <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950">
            Control diario de clientes, prestamos, rutas y caja.
          </h1>
          <p className="mt-5 text-base font-semibold leading-7 text-slate-500">
            El panel web esta pensado para trabajo operativo: seguimiento de cartera, cobro del dia, arqueo y reportes.
          </p>
          <div className="mt-10 space-y-4">
            {[
              'Cobros con impacto en cuota, prestamo y caja.',
              'Rutas y gestion de cobradores por sucursal.',
              'Reportes financieros y operativos listos para exportar.',
            ].map(item => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Demo local</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">Backend local con Laragon/MySQL y respaldo local cuando la API no esta disponible.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate('/')}
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 lg:hidden"
          >
            <ArrowLeft size={16} />
            Volver
          </button>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
                  onSecondary={
                    blockingState.secondaryHref
                      ? () => {
                          closePlatformBlockingState();
                          setBlockingState(null);
                          navigate(blockingState.secondaryHref || '/');
                        }
                      : undefined
                  }
                />
              </div>
            ) : null}
            <div className="mb-8">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
                {mode === 'LOGIN' ? 'Iniciar sesion' : mode === 'INVITE_ACTIVATE' ? 'Activar acceso' : 'Crear empresa'}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {mode === 'LOGIN' ? 'Acceso al panel' : mode === 'INVITE_ACTIVATE' ? 'Activa tu usuario' : 'Alta inicial de la empresa'}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {mode === 'LOGIN'
                  ? 'Ingrese con su usuario operativo o cuenta de super admin.'
                  : mode === 'INVITE_ACTIVATE'
                    ? 'Completa tu primer acceso definiendo la contrasena del usuario invitado.'
                  : 'Se crea la empresa, el administrador principal y la configuracion inicial.'}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setMode('LOGIN')}
                className={`rounded-md px-4 py-3 text-sm font-black transition-colors ${mode === 'LOGIN' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
              >
                Iniciar sesion
              </button>
              <button
                onClick={() => setMode('REGISTER')}
                className={`rounded-md px-4 py-3 text-sm font-black transition-colors ${mode === 'REGISTER' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
              >
                Registro
              </button>
            </div>

            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
              Demo activa: `admin/admin123` o `master/master123`.
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleQuickDemo('admin')}
                  className="inline-flex h-9 items-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 transition-colors hover:bg-blue-100"
                >
                  Entrar como admin
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickDemo('master')}
                  className="inline-flex h-9 items-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 transition-colors hover:bg-blue-100"
                >
                  Entrar como master
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={mode === 'LOGIN' ? handleLogin : mode === 'INVITE_ACTIVATE' ? handleInviteActivation : handleRegister} className="space-y-5">
              {mode === 'LOGIN' ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Usuario</span>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="admin"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Contrasena</span>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="admin123"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>
                </>
              ) : mode === 'INVITE_ACTIVATE' ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Usuario</span>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Correo invitado</span>
                    <div className="relative">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Nueva contrasena</span>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Confirmar contrasena</span>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Nombre comercial</span>
                    <div className="relative">
                      <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="Inversiones Perez RD"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Correo</span>
                    <div className="relative">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="admin@empresa.com"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Contrasena</span>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        required
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Plan</span>
                    <div className="relative">
                      <CreditCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        value={selectedPlanId}
                        onChange={e => setSelectedPlanId(e.target.value)}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                      >
                        <option value="p1">Basico (RD$ 1,500)</option>
                        <option value="p2">Profesional (RD$ 3,500)</option>
                        <option value="p3">Enterprise (RD$ 8,000)</option>
                      </select>
                    </div>
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    {mode === 'LOGIN' ? 'Entrar al panel' : mode === 'INVITE_ACTIVATE' ? 'Activar usuario' : 'Crear empresa'}
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
