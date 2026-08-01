import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, Building2, LayoutDashboard, LogOut, MessageSquareQuote, Settings, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PlatformShellProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Escritorio', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Reseñas', href: '/reviews', icon: MessageSquareQuote },
  { name: 'Actividad', href: '/activity', icon: Activity },
  { name: 'Reportes', href: '/reports', icon: BarChart3 },
  { name: 'Usuarios', href: '/users', icon: Users },
  { name: 'Configuración', href: '/settings', icon: Settings },
];

export const PlatformShell: React.FC<PlatformShellProps> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => {
    if (currentUser?.role === 'Super Admin') {
      return [...navigation, { name: 'Administración', href: '/master', icon: Building2 }];
    }
    return navigation;
  }, [currentUser?.role]);

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-950">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">QT</div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em]">Quisqueya</p>
            <p className="text-xs font-medium text-slate-500">Platform Core</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 p-3">
          {items.map(item => {
            const active = item.href === '/' ? location.pathname === '/' : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
              >
                <item.icon size={19} strokeWidth={1.9} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div>
            <p className="text-sm font-bold">Quisqueya Platform</p>
            <p className="text-xs text-slate-500">{currentUser.name} · {currentUser.role}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">Core en saneamiento</span>
        </header>
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};
