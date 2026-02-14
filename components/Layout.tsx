
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoans, getUsers } from '../services/dataService';
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
  const { currentUser, switchUser } = useAuth();
  const [availableUsers, setAvailableUsers] = useState(getUsers());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const location = useLocation();

  useEffect(() => {
    setAvailableUsers(getUsers());
  }, [isUserMenuOpen, location.pathname]);

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
      
      {/* SIDEBAR FIJO: Ancho w-72 para mayor estabilidad */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out flex flex-col lg:translate-x-0 lg:static lg:inset-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="h-24 shrink-0 flex items-center px-8 bg-gray-950 border-b border-gray-800">
          <Banknote className="h-9 w-9 text-blue-400 mr-3" />
          <span className="text-2xl font-black tracking-tighter">PRESTA<span className="text-blue-500">RD</span></span>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-2">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.name} to={item.href} onClick={() => setIsSidebarOpen(false)} className={`flex items-center px-5 py-4 text-[11px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}>
                <item.icon className={`mr-4 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* PERFIL DE EMPLEADO EN SIDEBAR */}
        <div className="shrink-0 p-6 bg-gray-950 border-t border-gray-800">
          <div className="bg-gray-900 rounded-3xl p-4 border border-white/5 flex items-center gap-4">
              <div className="relative shrink-0">
                  {currentUser.photo ? (
                      <img src={currentUser.photo} alt={currentUser.name} className="h-12 w-12 rounded-2xl object-cover border-2 border-blue-500/30" />
                  ) : (
                      <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-sm font-black text-white uppercase">{currentUser.avatar}</div>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-gray-900 rounded-full"></div>
              </div>
              <div className="overflow-hidden">
                  <p className="text-sm font-black text-white truncate leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5 truncate">{currentUser.role}</p>
              </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm z-30 h-20 shrink-0 flex items-center justify-between px-6 lg:px-10 border-b border-gray-100">
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
                    <div className="px-6 py-2 border-b border-gray-50 font-black text-xs uppercase tracking-widest text-gray-400">Notificaciones</div>
                    {notifications.length === 0 ? (<div className="px-6 py-5 text-sm font-bold text-gray-400 text-center">Sin novedades</div>) : (
                        notifications.map((note, idx) => (<div key={idx} className="px-6 py-4 hover:bg-gray-50 text-xs font-bold text-gray-700 border-b border-gray-50 last:border-0">{note}</div>))
                    )}
                </div>
             </div>

             <div className="relative">
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-white bg-gray-900 px-5 py-3 rounded-2xl shadow-lg active:scale-95 transition-all">
                    <Shield size={16} className="text-blue-400"/>
                    <span className="hidden md:inline">SESIÓN DEMO</span>
                    <ChevronDown size={16} />
                </button>
                {isUserMenuOpen && (
                    <div className="absolute right-0 mt-3 w-72 bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-50 overflow-hidden py-2 animate-scaleIn">
                        <div className="px-6 py-3 border-b border-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Cambiar de Perfil</div>
                        {availableUsers.map(user => (
                            <button key={user.id} onClick={() => { switchUser(user.id); setIsUserMenuOpen(false); }} className={`w-full text-left px-6 py-4 flex items-center hover:bg-gray-50 transition-colors ${currentUser.id === user.id ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}>
                                {user.photo ? (
                                    <img src={user.photo} alt="" className="h-9 w-9 rounded-xl object-cover mr-4 bg-gray-200 border border-gray-200 shadow-sm" />
                                ) : (
                                    <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black mr-4 text-gray-600 uppercase">{user.avatar}</div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-black text-gray-900 text-sm truncate leading-none mb-1">{user.name}</p>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{user.role}</p>
                                </div>
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
