import React, { useEffect, useMemo, useState } from 'react';
import { Building2, RefreshCw, Search, Shield, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { emitPlatformToast, setPlatformLoading } from '../services/platformEvents';
import { teamService } from '../services/teamService';
import type { Branch, User } from '../types';

export const PlatformUsersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    setPlatformLoading({ active: true, label: 'Cargando equipo' });
    try {
      const snapshot = await teamService.list();
      setUsers(snapshot.users);
      setBranches(snapshot.branches);
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo cargar el equipo',
        message: error instanceof Error ? error.message : 'La API no respondio correctamente.',
        tone: 'error',
        durationMs: 5200,
      });
    } finally {
      setIsLoading(false);
      setPlatformLoading({ active: false });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const branchNames = useMemo(() => new Map(branches.map(branch => [branch.id, branch.name])), [branches]);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter(user => {
      if (currentUser.role !== 'Super Admin' && user.companyId !== currentUser.companyId) return false;
      if (!term) return true;
      return `${user.name} ${user.username} ${user.email || ''} ${user.role}`.toLowerCase().includes(term);
    });
  }, [currentUser.companyId, currentUser.role, query, users]);

  const activeUsers = visibleUsers.filter(user => user.isActive).length;
  const visibleBranches = new Set(visibleUsers.map(user => user.branchId).filter(Boolean)).size;

  const toggleStatus = async (user: User) => {
    if (user.id === currentUser.id) {
      emitPlatformToast({
        title: 'Accion no permitida',
        message: 'No puedes suspender tu propia sesion desde esta vista.',
        tone: 'warning',
      });
      return;
    }

    try {
      const updated = await teamService.updateStatus(user.id, !user.isActive);
      setUsers(current => current.map(item => (item.id === updated.id ? updated : item)));
      emitPlatformToast({
        title: updated.isActive ? 'Usuario activado' : 'Usuario suspendido',
        message: `${updated.name} fue actualizado en la API.`,
        tone: 'success',
      });
    } catch (error) {
      emitPlatformToast({
        title: 'No se pudo actualizar el usuario',
        message: error instanceof Error ? error.message : 'La API no respondio correctamente.',
        tone: 'error',
        durationMs: 5200,
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Identidad y acceso</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Usuarios</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Vista API del equipo de Quisqueya Platform. Los datos se cargan desde NestJS y ya no dependen del almacenamiento local heredado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Users size={20} /></div>
          <p className="mt-5 text-sm font-bold text-slate-500">Usuarios visibles</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{visibleUsers.length}</p>
        </article>
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><UserCheck size={20} /></div>
          <p className="mt-5 text-sm font-bold text-slate-500">Activos</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{activeUsers}</p>
        </article>
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Building2 size={20} /></div>
          <p className="mt-5 text-sm font-bold text-slate-500">Sucursales visibles</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{visibleBranches}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Equipo</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Lectura y estado operativo desde la API.</p>
          </div>
          <label className="flex h-11 min-w-[280px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-500">
            <Search size={17} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar usuario..."
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Usuario</th>
                <th className="px-5 py-4">Rol</th>
                <th className="px-5 py-4">Sucursal</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4 text-right">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleUsers.map(user => (
                <tr key={user.id} className="text-sm">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">{user.name}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{user.username}{user.email ? ` · ${user.email}` : ''}</p>
                  </td>
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"><Shield size={13} />{user.role}</span></td>
                  <td className="px-5 py-4 font-medium text-slate-600">{branchNames.get(user.branchId) || 'Sin sucursal'}</td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{user.isActive ? 'Activo' : 'Suspendido'}</span></td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      disabled={user.id === currentUser.id}
                      onClick={() => void toggleStatus(user)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {user.isActive ? 'Suspender' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && visibleUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-slate-500">No hay usuarios para mostrar.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
