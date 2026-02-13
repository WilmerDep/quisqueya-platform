
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoans } from '../services/dataService';
import { LoanStatus, Role } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  Banknote, 
  BarChart3, 
  Menu, 
  X,
  Wallet,
  Bell,
  ChevronDown,
  Shield,
  Activity,
  UserCog
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, switchUser, availableUsers } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const location = useLocation();

  const navigation = [
    { name: 'Cobrar Hoy', href: '/', icon: LayoutDashboard, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR] },
    { name: 'Actividad', href: '/activity', icon: Activity, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR] },
    { name: 'Clientes', href: '/clients', icon: Users, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR] },
    { name: 'Préstamos', href: '/loans', icon: Wallet, roles: [Role.ADMIN, Role.SUPERVISOR] },
    { name: 'Usuarios', href: '/users', icon: UserCog, roles: [Role.ADMIN] },
    { name: 'Reportes', href: '/reports', icon: BarChart3, roles: [Role.ADMIN, Role.SUPERVISOR] },
  ];

  const filteredNav = navigation.filter(item => item.roles.includes(currentUser.role));

  useEffect(() => {
    const loans = getLoans();
    const today = new Date();
    const alerts: string[] = [];
    let dueTodayCount = 0;
    let overdueCount = 0;
    loans.forEach(loan => {
      if (loan.status === LoanStatus.ACTIVO || loan.status === LoanStatus.MORA) {
        loan.installments.forEach(inst => {
          if (inst.status !== 'PAGADO') {
            const dueDate = new Date(inst.dueDate);
            if (dueDate.toDateString() === today.toDateString()) {
              dueTodayCount++;
            } else if (dueDate < today) {
              overdueCount++;
            }
          }
        });
      }
    });
    if (overdueCount > 0) alerts.push(`⚠️ Tienes ${overdueCount} cuotas atrasadas.`);
    if (dueTodayCount > 0) alerts.push(`📅 Hoy vencen ${dueTodayCount} cuotas.`);
    setNotifications(alerts);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center px-6 bg-gray-950">
          <Banknote className="h-8 w-8 text-blue-400 mr-3" />
          <span className="text-xl font-black tracking-tight">PRESTA<span className="text-blue-500">RD</span></span>
        </div>
        <nav className="mt-8 px-4 space-y-2">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.name} to={item.href} onClick={() => setIsSidebarOpen(false)} className={`flex items-center px-4 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full p-4">
          <div className="bg-gray-800/50 rounded-3xl p-4 border border-white/5">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-sm font-black text-white">{currentUser.avatar}</div>
                <div className="overflow-hidden">
                    <p className="text-sm font-black truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-gray-500 truncate font-black uppercase tracking-widest">{currentUser.role}</p>
                </div>
             </div>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm z-30 h-20 flex items-center justify-between px-6 lg:px-10 border-b border-gray-100">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 rounded-2xl text-gray-500 hover:bg-gray-100 lg:hidden transition-colors">
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <span className="ml-3 text-lg font-black text-gray-900 lg:hidden">PRESTARD</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative group">
                <button className="p-3 text-gray-400 hover:text-gray-600 relative bg-gray-50 rounded-2xl transition-colors">
                    <Bell size={22} />
                    {notifications.length > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                </button>
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-gray-100 py-4 hidden group-hover:block animate-fadeIn z-50">
                    <div className="px-6 py-2 border-b border-gray-50 font-black text-xs uppercase tracking-widest text-gray-400">Alertas</div>
                    {notifications.length === 0 ? (<div className="px-6 py-5 text-sm font-bold text-gray-400 text-center">Sin novedades</div>) : (
                        notifications.map((note, idx) => (<div key={idx} className="px-6 py-4 hover:bg-gray-50 text-xs font-bold text-gray-700 border-b border-gray-50 last:border-0">{note}</div>))
                    )}
                </div>
             </div>
             <div className="relative">
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-900 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-lg active:scale-95 transition-all">
                    <Shield size={16} className="text-blue-400"/>
                    <span className="hidden md:inline">SESIÓN DEMO</span>
                    <ChevronDown size={16} />
                </button>
                {isUserMenuOpen && (
                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-50 overflow-hidden py-2 animate-scaleIn">
                        {availableUsers.map(user => (
                            <button key={user.id} onClick={() => { switchUser(user.id); setIsUserMenuOpen(false); }} className={`w-full text-left px-6 py-4 flex items-center hover:bg-gray-50 transition-colors ${currentUser.id === user.id ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}>
                                <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black mr-3 text-gray-600">{user.avatar}</div>
                                <div><p className="font-black text-gray-900 text-sm">{user.name}</p><p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{user.role}</p></div>
                            </button>
                        ))}
                    </div>
                )}
             </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
};
