import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoans } from '../services/dataService';
import { LoanStatus } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  Banknote, 
  BarChart3, 
  Menu, 
  X,
  LogOut,
  Wallet,
  Bell,
  ChevronDown,
  Shield,
  User
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
    { name: 'Cobrar Hoy', href: '/', icon: LayoutDashboard },
    { name: 'Clientes', href: '/clients', icon: Users },
    { name: 'Préstamos', href: '/loans', icon: Wallet },
    { name: 'Reportes', href: '/reports', icon: BarChart3 },
  ];

  // Calculate notifications
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
  }, [location.pathname]); // Recalculate on navigation

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-800 bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:inset-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-16 flex items-center px-6 bg-slate-950">
          <Banknote className="h-8 w-8 text-green-400 mr-2" />
          <span className="text-xl font-bold tracking-tight">PrestaFácil</span>
        </div>

        <nav className="mt-6 px-3 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3 mb-3">
             <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                    {currentUser.avatar}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{currentUser.name}</p>
                    <p className="text-xs text-slate-400 truncate uppercase">{currentUser.role}</p>
                </div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-30 h-16 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none lg:hidden"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <span className="ml-3 text-lg font-bold text-gray-900 lg:hidden">PrestaFácil</span>
            
            {/* Desktop Page Title could go here */}
          </div>

          <div className="flex items-center gap-4">
             {/* Notifications */}
             <div className="relative group">
                <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                    <Bell size={24} />
                    {notifications.length > 0 && (
                        <span className="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
                </button>
                {/* Dropdown */}
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-100 py-2 hidden group-hover:block animate-fadeIn z-50">
                    <div className="px-4 py-2 border-b border-gray-100 font-semibold text-sm text-gray-700">Notificaciones</div>
                    {notifications.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No hay alertas nuevas</div>
                    ) : (
                        notifications.map((note, idx) => (
                            <div key={idx} className="px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 border-b border-gray-50 last:border-0">
                                {note}
                            </div>
                        ))
                    )}
                </div>
             </div>

             {/* User Switcher (Demo Only) */}
             <div className="relative">
                <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg border border-gray-200"
                >
                    <Shield size={16} className="text-blue-600"/>
                    <span className="hidden md:inline">Cambiar Rol (Demo)</span>
                    <ChevronDown size={16} />
                </button>
                
                {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
                        {availableUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => {
                                    switchUser(user.id);
                                    setIsUserMenuOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm flex items-center hover:bg-gray-50 ${currentUser.id === user.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                            >
                                <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold mr-3 text-gray-600">
                                    {user.avatar}
                                </div>
                                <div>
                                    <p className="font-medium">{user.name}</p>
                                    <p className="text-xs text-gray-500 uppercase">{user.role}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
             </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};