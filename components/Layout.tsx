import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  canManageCompanySettings,
  canViewAllCompanyUsers,
  getBranches,
  getClients,
  getCompanies,
  getGlobalActivity,
  getGlobalConfig,
  getLoans,
} from '../services/dataService';
import { getBranchScope } from '../services/viewScope';
import { Company, GlobalConfig, Role } from '../types';
import {
  Activity,
  BarChart3,
  BanknoteIcon,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Crown,
  Headphones,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Check,
  Search,
  Settings,
  CheckCircle2,
  X as XIcon,
  ShieldAlert,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
  X,
  Globe,
  UserRound,
  Package,
  CreditCard,
  FileText,
  History,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import {
  PLATFORM_BLOCK_STATE_EVENT,
  closePlatformCriticalModal,
  closePlatformBlockingState,
  PLATFORM_LOADING_EVENT,
  PLATFORM_MODAL_EVENT,
  PLATFORM_TOAST_EVENT,
  PlatformBlockingStateDetail,
  PlatformCriticalModalDetail,
  PlatformLoadingDetail,
  PlatformModalDetail,
  PlatformToastDetail,
  readPlatformBlockingState,
} from '../services/platformEvents';
import { PlatformStateCard } from './PlatformStateCard';

interface LayoutProps {
  children: React.ReactNode;
}

type SearchResult = {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone?: 'nav' | 'client' | 'loan';
};

const SHELL_SCOPE_KEY = 'loanops_shell_scope';

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, switchUser, logout, availableUsers, isLoading } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [platformLoading, setPlatformLoadingState] = useState<PlatformLoadingDetail>({ active: false });
  const [platformModal, setPlatformModal] = useState<PlatformModalDetail | null>(null);
  const [platformCriticalModal, setPlatformCriticalModal] = useState<PlatformCriticalModalDetail | null>(null);
  const [platformBlockingState, setPlatformBlockingState] = useState<PlatformBlockingStateDetail | null>(readPlatformBlockingState());
  const [isPlatformModalBusy, setIsPlatformModalBusy] = useState(false);
  const [platformToasts, setPlatformToasts] = useState<Array<Required<Pick<PlatformToastDetail, 'id' | 'title' | 'tone' | 'durationMs'>> & Pick<PlatformToastDetail, 'message'>>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(getGlobalConfig());
  const [shellCompanyId, setShellCompanyId] = useState('');
  const [shellBranchId, setShellBranchId] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const companyMenuRef = useRef<HTMLDivElement>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = currentUser?.role === Role.SUPER_ADMIN;
  const branchScope = useMemo(() => (currentUser ? getBranchScope(currentUser) : null), [currentUser]);

  const isMasterPath = location.pathname.startsWith('/master') || location.pathname.startsWith('/super-admin');

  const navigation = useMemo(() => {
    if (isMasterPath && isSuperAdmin) {
      return [
        { name: 'Dashboard', href: '/master?section=dashboard', icon: Globe, roles: [Role.SUPER_ADMIN], mobilePrimary: true },
        { name: 'Empresas', href: '/master?section=companies', icon: Building2, roles: [Role.SUPER_ADMIN], mobilePrimary: true },
        { name: 'Usuarios', href: '/super-admin/usuarios', icon: Users, roles: [Role.SUPER_ADMIN], mobilePrimary: true },
        { name: 'Planes y Suscripciones', href: '/master?section=plans', icon: Package, roles: [Role.SUPER_ADMIN] },
        { name: 'Facturacion', href: '/master?section=billing', icon: CreditCard, roles: [Role.SUPER_ADMIN] },
        { name: 'Reportes Globales', href: '/master?section=reports', icon: FileText, roles: [Role.SUPER_ADMIN] },
        { name: 'Auditoria', href: '/master?section=audit', icon: History, roles: [Role.SUPER_ADMIN] },
        { name: 'Configuracion', href: '/master?section=system', icon: Settings, roles: [Role.SUPER_ADMIN] },
        { name: 'Centro de Ayuda', href: '/master?section=help', icon: Headphones, roles: [Role.SUPER_ADMIN] },
      ];
    }
    return [
      { name: 'Escritorio', href: '/', icon: LayoutDashboard, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR], mobilePrimary: true },
      { name: 'Cobrar Hoy', href: '/collect-today', icon: CalendarDays, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR] },
      { name: 'Clientes', href: '/clients', icon: Users, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR], mobilePrimary: true },
      { name: 'Prestamos', href: '/loans', icon: Wallet, roles: [Role.ADMIN, Role.SUPERVISOR], mobilePrimary: true },
      { name: 'Rutas', href: '/routes', icon: MapPin, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR], mobilePrimary: true },
      { name: 'Caja', href: '/cash', icon: BanknoteIcon, roles: [Role.ADMIN, Role.SUPERVISOR] },
      { name: 'Reportes', href: '/reports', icon: BarChart3, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR] },
      { name: 'Actividad', href: '/activity', icon: Activity, roles: [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR] },
      { name: 'Usuarios', href: '/users', icon: UserCog, roles: [Role.ADMIN] },
      { name: 'Configuracion', href: '/settings', icon: Settings, roles: [Role.ADMIN] },
      { name: 'Super Admin', href: '/master', icon: Crown, roles: [Role.SUPER_ADMIN] },
    ];
  }, [isMasterPath, isSuperAdmin]);

  const filteredNav = currentUser
    ? navigation.filter(
        item =>
          item.roles.includes(currentUser.role) &&
          (item.href !== '/settings' || canManageCompanySettings(currentUser)),
      )
    : [];

  const mobilePrimaryNav = filteredNav.filter(item => item.mobilePrimary).slice(0, 4);
  const mobileSecondaryNav = filteredNav.filter(item => !item.mobilePrimary);

  const currentNavItem = useMemo(() => {
    return (
      filteredNav.find(item => {
        if (item.href === '/') return location.pathname === '/';
        return location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
      }) || filteredNav[0]
    );
  }, [filteredNav, location.pathname]);

  const availableCompanies = useMemo(() => {
    if (!currentUser) return [];
    return getCompanies().filter(entry => currentUser.linkedCompanyIds.includes(entry.id) || entry.id === currentUser.companyId);
  }, [currentUser]);

  const availableBranches = useMemo(() => {
    if (!currentUser) return [];
    const targetCompanyId = shellCompanyId || currentUser.companyId;
    const companyBranches = getBranches(targetCompanyId);
    if (targetCompanyId !== currentUser.companyId) return companyBranches;
    const visibleIds = new Set(branchScope?.visibleBranchIds || []);
    return companyBranches.filter(branch => visibleIds.size === 0 || visibleIds.has(branch.id));
  }, [branchScope?.visibleBranchIds, currentUser, shellCompanyId]);

  const activeCompany = useMemo(
    () => availableCompanies.find(entry => entry.id === shellCompanyId) || availableCompanies[0],
    [availableCompanies, shellCompanyId],
  );

  const activeBranch = useMemo(
    () => availableBranches.find(branch => branch.id === shellBranchId) || availableBranches[0],
    [availableBranches, shellBranchId],
  );

  useEffect(() => {
    if (!currentUser) return;
    const companies = getCompanies();
    setCompany(companies.find(entry => entry.id === currentUser.companyId));
    setGlobalConfig(getGlobalConfig());
    setIsUserMenuOpen(false);
    setIsMobileNavOpen(false);
    setIsCompanyMenuOpen(false);
    setIsBranchMenuOpen(false);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);

    const rawScope = window.localStorage.getItem(SHELL_SCOPE_KEY);
    const savedScope = rawScope ? JSON.parse(rawScope) as { companyId?: string; branchId?: string } : {};
    const nextCompanyId =
      savedScope.companyId && availableCompanies.some(entry => entry.id === savedScope.companyId)
        ? savedScope.companyId
        : currentUser.companyId;
    const nextBranchPool = nextCompanyId === currentUser.companyId ? getBranches(currentUser.companyId).filter(branch => branchScope?.visibleBranchIds.includes(branch.id)) : getBranches(nextCompanyId);
    const nextBranchId =
      savedScope.branchId && nextBranchPool.some(branch => branch.id === savedScope.branchId)
        ? savedScope.branchId
        : nextBranchPool[0]?.id || currentUser.branchId;

    setShellCompanyId(nextCompanyId);
    setShellBranchId(nextBranchId);
  }, [availableCompanies, branchScope?.visibleBranchIds, currentUser, location.pathname]);

  useEffect(() => {
    if (!shellCompanyId || !shellBranchId) return;
    window.localStorage.setItem(SHELL_SCOPE_KEY, JSON.stringify({ companyId: shellCompanyId, branchId: shellBranchId }));
  }, [shellBranchId, shellCompanyId]);

  const visibleUsersForSwitcher = useMemo(() => {
    if (!currentUser) return [];
    if (isSuperAdmin) return availableUsers;
    return availableUsers.filter(user => {
      const sameCompany = user.companyId === currentUser.companyId;
      if (!sameCompany) return false;
      if (canViewAllCompanyUsers(currentUser)) return true;
      return user.branchId === currentUser.branchId;
    });
  }, [availableUsers, currentUser, isSuperAdmin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserMenuOpen(false);
      if (companyMenuRef.current && !companyMenuRef.current.contains(target)) setIsCompanyMenuOpen(false);
      if (branchMenuRef.current && !branchMenuRef.current.contains(target)) setIsBranchMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(target)) setIsSearchOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(target)) setIsNotificationsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<PlatformToastDetail>).detail;
      const nextToast = {
        id: detail.id || `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        title: detail.title,
        message: detail.message,
        tone: detail.tone || 'info',
        durationMs: detail.durationMs || 2800,
      };

      setPlatformToasts(current => [...current, nextToast]);
      window.setTimeout(() => {
        setPlatformToasts(current => current.filter(item => item.id !== nextToast.id));
      }, nextToast.durationMs);
    };

    const handleLoading = (event: Event) => {
      setPlatformLoadingState((event as CustomEvent<PlatformLoadingDetail>).detail);
    };

    const handleModal = (event: Event) => {
      const detail = (event as CustomEvent<PlatformModalDetail | PlatformCriticalModalDetail>).detail;
      if (detail.state === 'open' && ('description' in detail || 'confirmLabel' in detail || 'onConfirm' in detail)) {
        setPlatformCriticalModal(detail as PlatformCriticalModalDetail);
        setPlatformModal(detail);
        return;
      }

      setPlatformCriticalModal(null);
      setIsPlatformModalBusy(false);
      setPlatformModal(detail.state === 'open' ? detail : null);
    };

    const handleBlockState = (event: Event) => {
      const detail = (event as CustomEvent<PlatformBlockingStateDetail>).detail;
      setPlatformBlockingState(detail.state === 'open' ? detail : null);
    };

    window.addEventListener(PLATFORM_TOAST_EVENT, handleToast as EventListener);
    window.addEventListener(PLATFORM_LOADING_EVENT, handleLoading as EventListener);
    window.addEventListener(PLATFORM_MODAL_EVENT, handleModal as EventListener);
    window.addEventListener(PLATFORM_BLOCK_STATE_EVENT, handleBlockState as EventListener);

    return () => {
      window.removeEventListener(PLATFORM_TOAST_EVENT, handleToast as EventListener);
      window.removeEventListener(PLATFORM_LOADING_EVENT, handleLoading as EventListener);
      window.removeEventListener(PLATFORM_MODAL_EVENT, handleModal as EventListener);
      window.removeEventListener(PLATFORM_BLOCK_STATE_EVENT, handleBlockState as EventListener);
    };
  }, []);

  const maintenanceMessage = useMemo(() => {
    if (isSuperAdmin && location.pathname === '/master') return null;
    const scheduled = globalConfig.maintenanceDate ? formatDate(globalConfig.maintenanceDate) : null;
    if (globalConfig.maintenanceMode) {
      return {
        title: 'Mantenimiento activo',
        detail: globalConfig.broadcastMessage || 'El sistema esta operando con restricciones temporales.',
      };
    }
    if (scheduled) {
      return {
        title: 'Mantenimiento programado',
        detail: `${scheduled}${globalConfig.broadcastMessage ? ` · ${globalConfig.broadcastMessage}` : ''}`,
      };
    }
    return null;
  }, [globalConfig, isSuperAdmin, location.pathname]);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!currentUser) return [];
    const query = searchQuery.trim().toLowerCase();
    const navResults = filteredNav.map(item => ({
      id: `nav-${item.href}`,
      label: item.name,
      detail: 'Navegacion',
      href: item.href,
      tone: 'nav' as const,
    }));
    const clientResults = getClients(activeCompany?.id || currentUser.companyId)
      .filter(client =>
        !query ||
        `${client.firstName} ${client.lastName}`.toLowerCase().includes(query) ||
        client.phone.toLowerCase().includes(query) ||
        client.cedula.toLowerCase().includes(query),
      )
      .slice(0, 4)
      .map(client => ({
        id: `client-${client.id}`,
        label: `${client.firstName} ${client.lastName}`,
        detail: `${client.phone} · Cliente`,
        href: `/clients/${client.id}`,
        tone: 'client' as const,
      }));
    const loanResults = getLoans(activeCompany?.id || currentUser.companyId)
      .filter(loan => !query || loan.id.toLowerCase().includes(query))
      .slice(0, 3)
      .map(loan => ({
        id: `loan-${loan.id}`,
        label: loan.id.slice(0, 8).toUpperCase(),
        detail: `${formatCurrency(loan.balance)} · Prestamo`,
        href: `/clients/${loan.clientId}`,
        tone: 'loan' as const,
      }));
    const merged = [...navResults, ...clientResults, ...loanResults];
    return query ? merged.filter(item => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 7) : merged.slice(0, 6);
  }, [activeCompany?.id, currentUser, filteredNav, searchQuery]);

  const notificationItems = useMemo(() => {
    if (!currentUser) return [];
    return getGlobalActivity(activeCompany?.id || currentUser.companyId)
      .slice(0, 6)
      .map(item => ({
        id: item.id,
        title: item.title,
        detail: item.description,
        time: new Date(item.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
        tone:
          item.type === 'PAGO'
            ? 'emerald'
            : item.type === 'PROMESA' || item.type === 'ROUTE_CLOSE'
              ? 'blue'
              : item.type === 'CONDUCTA' || item.type === 'APPROVAL'
                ? 'amber'
                : 'slate',
      }));
  }, [activeCompany?.id, currentUser]);

  const handleSelectCompany = (companyId: string) => {
    setShellCompanyId(companyId);
    const nextBranches = companyId === currentUser?.companyId && branchScope
      ? getBranches(companyId).filter(branch => branchScope.visibleBranchIds.includes(branch.id))
      : getBranches(companyId);
    setShellBranchId(nextBranches[0]?.id || '');
    setIsCompanyMenuOpen(false);
  };

  const handleSelectBranch = (branchId: string) => {
    setShellBranchId(branchId);
    setIsBranchMenuOpen(false);
  };

  const handleSearchSelect = (href: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(href);
  };

  const unreadNotifications = notificationItems.length;
  const platformModalToneConfig = useMemo(() => {
    const tone = platformCriticalModal?.tone || 'info';
    if (tone === 'danger') {
      return {
        icon: ShieldAlert,
        iconWrap: 'bg-[#FEF2F2] text-[#DC2626]',
        confirmClass: 'bg-[#DC2626] shadow-[0_18px_40px_rgba(220,38,38,0.24)]',
      };
    }
    if (tone === 'success') {
      return {
        icon: CheckCircle2,
        iconWrap: 'bg-[#ECFDF5] text-[#16A34A]',
        confirmClass: 'bg-[#16A34A] shadow-[0_18px_40px_rgba(22,163,74,0.24)]',
      };
    }
    if (tone === 'warning') {
      return {
        icon: TriangleAlert,
        iconWrap: 'bg-[#FFF7ED] text-[#D97706]',
        confirmClass: 'bg-[#F59E0B] shadow-[0_18px_40px_rgba(245,158,11,0.24)]',
      };
    }
    return {
      icon: Info,
      iconWrap: 'bg-[#EFF6FF] text-[#2563EB]',
      confirmClass: 'bg-[#2563EB] shadow-[0_18px_40px_rgba(37,99,235,0.24)]',
    };
  }, [platformCriticalModal?.tone]);

  const dismissPlatformModal = useCallback(() => {
    if (!platformCriticalModal) return;
    platformCriticalModal.onCancel?.();
    closePlatformCriticalModal(platformCriticalModal.id);
  }, [platformCriticalModal]);

  const handlePlatformModalConfirm = useCallback(async () => {
    if (!platformCriticalModal?.onConfirm) {
      if (platformCriticalModal) closePlatformCriticalModal(platformCriticalModal.id);
      return;
    }

    try {
      setIsPlatformModalBusy(true);
      await platformCriticalModal.onConfirm();
      closePlatformCriticalModal(platformCriticalModal.id);
    } finally {
      setIsPlatformModalBusy(false);
    }
  }, [platformCriticalModal]);

  const handlePlatformModalSecondary = useCallback(async () => {
    if (!platformCriticalModal?.onSecondary) return;
    try {
      setIsPlatformModalBusy(true);
      await platformCriticalModal.onSecondary();
    } finally {
      setIsPlatformModalBusy(false);
    }
  }, [platformCriticalModal]);

  const dismissToast = useCallback((toastId: string) => {
    setPlatformToasts(current => current.filter(item => item.id !== toastId));
  }, []);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    setIsMobileNavOpen(false);
    window.dispatchEvent(
      new CustomEvent(PLATFORM_MODAL_EVENT, {
        detail: {
          id: 'logout-confirmation',
          state: 'open',
          tone: 'warning',
          title: '¿Cerrar sesion ahora?',
          description: 'Se cerrara la sesion actual del operador y debera autenticarse nuevamente para volver al panel.',
          confirmLabel: 'Cerrar sesion',
          cancelLabel: 'Seguir en el panel',
          highlights: [
            { label: 'Usuario activo', value: currentUser.name },
            { label: 'Rol visible', value: currentUser.role },
          ],
          onConfirm: () => {
            logout();
            navigate('/');
          },
        } satisfies PlatformCriticalModalDetail,
      }),
    );
  };

  if (isLoading || !currentUser) return null;

  return (
    <div className="flex h-full overflow-hidden bg-[#f9fafb] text-slate-900">
      <aside
        className={`hidden shrink-0 flex-col border-r border-[#e5e7eb] bg-white transition-[width] duration-300 lg:flex ${
          isSidebarCollapsed ? 'w-[92px]' : 'w-[252px]'
        }`}
      >
          <div className={`${isSidebarCollapsed ? 'px-2 pb-5 pt-5' : 'px-6 pb-7 pt-8'}`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              {isSidebarCollapsed ? (
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[18px] bg-transparent">
                  <img src="/LOGO-AZUL.png" alt="ABUNDRA" className="h-20 w-20 object-contain" />
                </div>
              ) : (
                <img src="/LOGO-AZUL.png" alt="ABUNDRA" className="h-[4.5rem] w-auto object-contain" />
              )}
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[1.8rem] font-black leading-none text-[#0F172A]">ABUNDRA</p>
                  <p className="text-[0.95rem] font-medium leading-none text-[#6b7280]">Plataforma web</p>
                </div>
              )}
          </div>
        </div>

        <nav className={`space-y-1.5 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {filteredNav.map(item => {
            const isActive = (() => {
              if (!isMasterPath) {
                return item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              }

              if (location.pathname.startsWith('/super-admin')) {
                return location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              }

              const urlObj = new URL(item.href, 'http://localhost');
              const targetSection = urlObj.searchParams.get('section') || 'dashboard';
              const currentSection = new URLSearchParams(location.search).get('section') || 'dashboard';
              return targetSection === currentSection;
            })();

            return (
              <Link
                key={item.name}
                to={item.href}
                title={isSidebarCollapsed ? item.name : undefined}
                className={`group relative flex overflow-hidden rounded-2xl py-3 text-[15px] font-medium transition-all duration-200 ${
                  isSidebarCollapsed ? 'justify-center px-3' : 'items-center gap-3 px-4'
                } ${
                  isActive
                    ? 'translate-x-1 bg-[linear-gradient(90deg,#eff6ff_0%,#f8fbff_100%)] text-[#2563eb] shadow-[0_10px_24px_rgba(37,99,235,0.10)] ring-1 ring-[#DBEAFE]'
                    : 'text-[#111827] hover:translate-x-1 hover:bg-[#f8fafc] hover:text-[#2563eb] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]'
                }`}
              >
                <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#2563EB] transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
                <span className={`transition-transform duration-200 ${isActive ? 'scale-105' : 'group-hover:scale-105 group-hover:translate-x-[1px]'}`}>
                  <item.icon size={22} strokeWidth={1.9} />
                </span>
                {!isSidebarCollapsed && <span className="transition-transform duration-200 group-hover:translate-x-[1px]">{item.name}</span>}
                {!isSidebarCollapsed && isActive && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#2563EB]/80 shadow-[0_0_0_4px_rgba(37,99,235,0.10)]" />}
              </Link>
            );
          })}
        </nav>

        <div className={`mt-auto ${isSidebarCollapsed ? 'px-2 pb-4 pt-6' : 'px-3 pb-5 pt-8'}`}>
          <button
            onClick={() => setIsSidebarCollapsed(value => !value)}
            title={isSidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            className={`mb-3 flex w-full rounded-2xl py-3 text-[15px] font-medium text-[#6b7280] transition-all duration-200 hover:translate-x-1 hover:bg-[#f3f4f6] hover:text-[#2563eb] ${
              isSidebarCollapsed ? 'justify-center px-3' : 'items-center gap-3 px-4'
            }`}
          >
            <ChevronRight size={18} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
            {!isSidebarCollapsed && 'Colapsar'}
          </button>

          <div className={`rounded-3xl border border-[#e5e7eb] bg-[#f8fafc] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:shadow-sm ${isSidebarCollapsed ? 'p-3' : 'p-4'}`}>
            <div className={`flex ${isSidebarCollapsed ? 'justify-center' : 'items-center gap-3'}`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#2563eb] shadow-sm">
                <Headphones size={20} />
              </div>
              {!isSidebarCollapsed && (
                <div>
                  <p className="text-[15px] font-semibold text-[#2563eb]">Necesitas ayuda?</p>
                  <p className="text-sm text-[#6b7280]">Soporte 24/7</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {platformLoading.active ? (
          <div className="relative h-[3px] w-full overflow-hidden bg-[#DBEAFE]">
            <div className="absolute inset-y-0 left-0 w-[38%] animate-[platform-loading_1.2s_ease-in-out_infinite] rounded-full bg-[#2563EB]" />
          </div>
        ) : null}
        {maintenanceMessage && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 lg:px-8">
            <div className="flex items-start gap-3">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]">{maintenanceMessage.title}</p>
                <p className="mt-1 text-sm font-semibold">{maintenanceMessage.detail}</p>
              </div>
            </div>
          </div>
        )}

        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 lg:gap-4">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white text-slate-700 transition-colors hover:border-[#DBEAFE] hover:text-[#2563eb] lg:hidden"
              aria-label="Abrir navegacion"
            >
              <Menu size={18} />
            </button>
            {isMasterPath ? (
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-blue-600">
                  <Crown size={12} />
                  Super Admin SaaS
                </div>
              </div>
            ) : (
              <div className="hidden items-center gap-3 lg:flex">
                <div className="relative" ref={companyMenuRef}>
                  <button
                    onClick={() => {
                      setIsCompanyMenuOpen(value => !value);
                      setIsBranchMenuOpen(false);
                    }}
                    className={`flex h-11 items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 hover:border-[#DBEAFE] hover:text-[#2563EB] hover:shadow-sm ${
                      isCompanyMenuOpen ? 'border-[#93C5FD] text-[#2563EB] shadow-[0_10px_25px_rgba(37,99,235,0.12)]' : 'border-[#e5e7eb]'
                    }`}
                  >
                    <Building2 size={18} className="text-[#6b7280]" />
                    <span className="max-w-[240px] truncate text-[15px] font-medium text-[#111827]">{activeCompany?.name || company?.name || 'Empresa'}</span>
                    <ChevronDown size={16} className={`text-[#6b7280] transition-transform duration-200 ${isCompanyMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isCompanyMenuOpen && (
                    <div className="absolute left-0 top-[calc(100%+10px)] z-[110] w-[320px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                      {availableCompanies.map(entry => {
                        const isSelected = activeCompany?.id === entry.id;
                        return (
                          <button
                            key={entry.id}
                            onClick={() => handleSelectCompany(entry.id)}
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all duration-200 ${
                              isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:translate-x-1 hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <div>
                              <p className="text-[15px] font-semibold">{entry.name}</p>
                              <p className="mt-1 text-xs font-medium text-[#6B7280]">{entry.rnc || 'Empresa activa'}</p>
                            </div>
                            {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative" ref={branchMenuRef}>
                  <button
                    onClick={() => {
                      setIsBranchMenuOpen(value => !value);
                      setIsCompanyMenuOpen(false);
                    }}
                    className={`flex h-11 items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 hover:border-[#DBEAFE] hover:text-[#2563EB] hover:shadow-sm ${
                      isBranchMenuOpen ? 'border-[#93C5FD] text-[#2563EB] shadow-[0_10px_25px_rgba(37,99,235,0.12)]' : 'border-[#e5e7eb]'
                    }`}
                  >
                    <Building2 size={18} className="text-[#6b7280]" />
                    <span className="max-w-[180px] truncate text-[15px] font-medium text-[#111827]">{activeBranch?.name || 'Sucursal'}</span>
                    <ChevronDown size={16} className={`text-[#6b7280] transition-transform duration-200 ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isBranchMenuOpen && (
                    <div className="absolute left-0 top-[calc(100%+10px)] z-[110] w-[300px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                      {availableBranches.map(branch => {
                        const isSelected = activeBranch?.id === branch.id;
                        return (
                          <button
                            key={branch.id}
                            onClick={() => handleSelectBranch(branch.id)}
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all duration-200 ${
                              isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:translate-x-1 hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <span className="text-[15px] font-semibold">{branch.name}</span>
                            {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="min-w-0 lg:hidden">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563eb]">{company?.name || 'Abundra Cloud'}</p>
              <p className="truncate text-lg font-black text-[#0f172a]">{currentNavItem?.name || 'Escritorio'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden xl:block" ref={searchRef}>
              <div className={`flex h-11 w-[390px] items-center rounded-2xl border bg-white px-4 transition-all duration-200 ${isSearchOpen ? 'border-[#93C5FD] text-[#2563EB] shadow-[0_10px_25px_rgba(37,99,235,0.12)]' : 'border-[#e5e7eb] hover:border-[#DBEAFE]'}`}>
                <Search size={18} className={`${isSearchOpen ? 'text-[#2563eb]' : 'text-[#6b7280]'}`} />
                <input
                  value={searchQuery}
                  onChange={event => {
                    setSearchQuery(event.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Buscar clientes, prestamos, rutas..."
                  className="ml-3 flex-1 border-0 bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#9ca3af]"
                />
                <div className="flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-[#f3f4f6] px-2 text-xs font-semibold text-[#6b7280]">
                  K
                </div>
              </div>
              {isSearchOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] z-[110] w-[440px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                  <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Resultados</p>
                  <div className="space-y-1">
                    {searchResults.map(result => (
                      <button
                        key={result.id}
                        onClick={() => handleSearchSelect(result.href)}
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC]"
                      >
                        <div>
                          <p className="text-[15px] font-semibold text-[#111827]">{result.label}</p>
                          <p className="mt-1 text-xs font-medium text-[#6B7280]">{result.detail}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          result.tone === 'client'
                            ? 'bg-[#EFF6FF] text-[#2563EB]'
                            : result.tone === 'loan'
                              ? 'bg-[#F3E8FF] text-[#7C3AED]'
                              : 'bg-[#F8FAFC] text-[#64748B]'
                        }`}>
                          {result.tone === 'client' ? 'Cliente' : result.tone === 'loan' ? 'Prestamo' : 'Ir'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setIsNotificationsOpen(value => !value)}
                className={`relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#374151] transition-all duration-200 hover:bg-[#F8FAFC] hover:text-[#2563EB] ${isNotificationsOpen ? 'shadow-[0_10px_24px_rgba(37,99,235,0.12)] text-[#2563EB]' : ''}`}
              >
                <Bell size={22} />
                <span className="absolute right-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(239,68,68,0.25)]">
                  {unreadNotifications}
                </span>
              </button>
              {isNotificationsOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] z-[110] w-[360px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                  <div className="flex items-center justify-between px-3 pb-2 pt-1">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Notificaciones</p>
                      <p className="mt-1 text-sm font-medium text-[#6B7280]">{unreadNotifications} eventos recientes</p>
                    </div>
                    <button onClick={() => navigate('/activity')} className="text-sm font-semibold text-[#2563EB] transition-transform duration-200 hover:translate-x-1">
                      Ver todo
                    </button>
                  </div>
                  <div className="space-y-1">
                    {notificationItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          navigate('/activity');
                        }}
                        className="group flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                      >
                        <span
                          className={`mt-1 h-2.5 w-2.5 rounded-full ${
                            item.tone === 'emerald'
                              ? 'bg-[#16A34A]'
                              : item.tone === 'blue'
                                ? 'bg-[#2563EB]'
                                : item.tone === 'amber'
                                  ? 'bg-[#F59E0B]'
                                  : 'bg-[#94A3B8]'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-[15px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{item.title}</p>
                            <span className="shrink-0 text-xs font-medium text-[#94A3B8]">{item.time}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#6B7280] transition-colors duration-200 group-hover:text-[#2563EB]">{item.detail}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(value => !value)}
                className={`flex items-center gap-3 rounded-2xl bg-white px-1 py-1 transition-all duration-200 hover:bg-[#F8FAFC] hover:text-[#2563EB] ${
                  isUserMenuOpen ? 'text-[#2563EB]' : ''
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#2563eb] text-[12px] font-black uppercase text-white shadow-[0_10px_25px_rgba(37,99,235,0.18)]">
                  {currentUser.photo ? (
                    <img src={currentUser.photo} alt={currentUser.name} className="h-full w-full object-cover" />
                  ) : (
                    currentUser.avatar
                  )}
                </div>
                <div className="hidden text-left lg:block">
                  <p className="text-[15px] font-semibold text-[#111827]">{currentUser.name}</p>
                  <p className="text-sm text-[#6b7280]">{currentUser.role}</p>
                </div>
                <ChevronDown size={16} className={`hidden text-[#6b7280] transition-transform duration-200 lg:block ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 z-[110] mt-2 w-72 rounded-3xl border border-[#e5e7eb] bg-white py-2 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                  <div className="border-b border-[#f3f4f6] px-5 py-4">
                    <p className="text-base font-semibold text-[#111827]">{currentUser.name}</p>
                    <p className="mt-1 text-sm text-[#6b7280]">{currentUser.role}</p>
                  </div>
                  <div className="border-b border-[#f3f4f6] px-3 py-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/settings/profile');
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                    >
                      <UserRound size={16} />
                      Mi Perfil y Ajustes
                    </button>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6b7280]">Cambio rapido</p>
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {visibleUsersForSwitcher.slice(0, 10).map(user => (
                        <button
                          key={user.id}
                          onClick={() => switchUser(user.id)}
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl text-[10px] font-black uppercase transition-all duration-200 hover:translate-x-1 hover:scale-[1.03] ${
                            currentUser.id === user.id ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#4b5563]'
                          }`}
                        >
                          {user.avatar}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#f3f4f6] px-3 pt-2">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium text-[#DC2626] transition-all duration-200 hover:translate-x-1 hover:bg-[rgba(220,38,38,0.08)]"
                    >
                      <LogOut size={16} />
                      Cerrar sesion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto min-h-full w-full max-w-[1500px] px-5 py-7 lg:px-8">{children}</div>
        </div>

        {platformCriticalModal ? (
          <div className="fixed inset-0 z-[180] flex items-center justify-center px-4 py-6">
            <button
              type="button"
              aria-label="Cerrar modal"
              onClick={isPlatformModalBusy ? undefined : dismissPlatformModal}
              className="absolute inset-0 animate-[platform-fade-in_180ms_ease-out] bg-[#0F172A]/45 backdrop-blur-[2px]"
            />
            <div className="relative z-[181] flex w-full max-w-[640px] animate-[platform-modal-in_220ms_ease-out] flex-col overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.22)]">
              <div className="border-b border-[#EEF2F7] px-6 py-6 lg:px-7 lg:py-7">
                <div className="relative">
                  <button
                    type="button"
                    onClick={isPlatformModalBusy ? undefined : dismissPlatformModal}
                    className="absolute right-0 top-0 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                  >
                    <X size={18} />
                  </button>
                  <div className="flex justify-center">
                    <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[24px] ${platformModalToneConfig.iconWrap}`}>
                      <platformModalToneConfig.icon size={34} strokeWidth={2.2} />
                    </div>
                  </div>
                </div>
                <div className="mt-5 min-w-0 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Confirmacion critica</p>
                  <h3 className="mt-3 text-[20px] font-black leading-tight text-[#0F172A] sm:text-[22px]">{platformCriticalModal.title || platformCriticalModal.id}</h3>
                  {platformCriticalModal.description ? (
                    <p className="mx-auto mt-3 max-w-[54ch] text-[15px] font-medium leading-7 text-[#64748B]">{platformCriticalModal.description}</p>
                  ) : null}
                </div>
              </div>

              {platformCriticalModal.highlights?.length ? (
                <div className="border-b border-[#EEF2F7] px-6 py-5 lg:px-7">
                  <div className="mx-auto grid max-w-[560px] gap-3 lg:grid-cols-2">
                  {platformCriticalModal.highlights.map(item => (
                    <div key={`${item.label}-${item.value}`} className="rounded-[22px] border border-[#E5E7EB] bg-[#FBFCFE] px-4 py-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">{item.label}</p>
                      <p
                        className={`mt-3 text-[15px] font-bold leading-6 ${
                          item.tone === 'danger'
                            ? 'text-[#DC2626]'
                            : item.tone === 'warning'
                              ? 'text-[#D97706]'
                              : item.tone === 'success'
                                ? 'text-[#16A34A]'
                                : 'text-[#0F172A]'
                        }`}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 px-6 py-6 sm:flex-row sm:justify-center lg:px-7">
                <button
                  type="button"
                  disabled={isPlatformModalBusy}
                  onClick={dismissPlatformModal}
                  className="inline-flex h-14 min-w-[172px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[15px] font-semibold text-[#0F172A] transition-all duration-200 hover:translate-x-1 hover:border-[#CBD5E1] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XIcon size={16} />
                  {platformCriticalModal.cancelLabel || 'Cancelar'}
                </button>
                {platformCriticalModal.secondaryLabel ? (
                  <button
                    type="button"
                    disabled={isPlatformModalBusy}
                    onClick={() => void handlePlatformModalSecondary()}
                    className="inline-flex h-14 min-w-[172px] items-center justify-center gap-2 rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-6 text-[15px] font-semibold text-[#2563EB] transition-all duration-200 hover:translate-x-1 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check size={16} />
                    {platformCriticalModal.secondaryLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isPlatformModalBusy}
                  onClick={() => void handlePlatformModalConfirm()}
                  className={`inline-flex h-14 min-w-[172px] items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:translate-x-1 disabled:cursor-not-allowed disabled:opacity-60 ${platformModalToneConfig.confirmClass}`}
                >
                  <Check size={16} />
                  {isPlatformModalBusy ? 'Procesando...' : platformCriticalModal.confirmLabel || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {platformBlockingState ? (
          <div className="fixed inset-0 z-[175] flex items-center justify-center px-4 py-6">
            <button
              type="button"
              aria-label="Cerrar estado"
              onClick={platformBlockingState.dismissible ? () => closePlatformBlockingState() : undefined}
              className="absolute inset-0 animate-[platform-fade-in_180ms_ease-out] bg-[#0F172A]/45 backdrop-blur-[2px]"
            />
            <div className="relative z-[176] animate-[platform-modal-in_220ms_ease-out] w-full max-w-[560px]">
              <PlatformStateCard
                kind={platformBlockingState.kind}
                title={platformBlockingState.title}
                message={platformBlockingState.message}
                primaryLabel={platformBlockingState.primaryLabel}
                secondaryLabel={platformBlockingState.secondaryLabel}
                onClose={platformBlockingState.dismissible ? () => closePlatformBlockingState() : undefined}
                onPrimary={() => {
                  closePlatformBlockingState();
                  navigate(platformBlockingState.primaryHref || '/');
                }}
                onSecondary={
                  platformBlockingState.secondaryHref
                    ? () => {
                        closePlatformBlockingState();
                        navigate(platformBlockingState.secondaryHref);
                      }
                    : undefined
                }
              />
            </div>
          </div>
        ) : null}

        {platformModal ? (
          <div className="pointer-events-none fixed bottom-24 right-4 z-[160] hidden rounded-2xl border border-[#DBEAFE] bg-white/96 px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-sm lg:block">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Modal activo</p>
            <p className="mt-2 text-[14px] font-semibold text-[#111827]">{platformModal.title || platformModal.id}</p>
          </div>
        ) : null}

        {platformToasts.length ? (
          <div className="pointer-events-none fixed bottom-5 right-4 z-[170] flex w-full max-w-[380px] flex-col gap-3">
            {platformToasts.map(toast => (
              <div
                key={toast.id}
                className={`pointer-events-auto relative animate-[platform-toast-in_240ms_ease-out] rounded-[24px] border px-5 py-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-sm ${
                  toast.tone === 'success'
                    ? 'border-[#BBF7D0] bg-[#F0FDF4]/96'
                    : toast.tone === 'error'
                      ? 'border-[#FECACA] bg-[#FEF2F2]/96'
                      : toast.tone === 'warning'
                        ? 'border-[#FDE68A] bg-[#FFFBEB]/96'
                        : 'border-[#DBEAFE] bg-[#EFF6FF]/96'
                }`}
              >
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent bg-white/70 text-[#94A3B8] transition-all duration-200 hover:border-[#E5E7EB] hover:bg-white hover:text-[#DC2626]"
                >
                  <X size={15} />
                </button>
                <div className="flex items-start gap-3 pr-10">
                  <div
                    className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      toast.tone === 'success'
                        ? 'bg-[#DCFCE7] text-[#16A34A]'
                        : toast.tone === 'error'
                          ? 'bg-[#FEE2E2] text-[#DC2626]'
                          : toast.tone === 'warning'
                            ? 'bg-[#FEF3C7] text-[#D97706]'
                            : 'bg-[#DBEAFE] text-[#2563EB]'
                    }`}
                  >
                    {toast.tone === 'success' ? <CheckCircle2 size={18} /> : toast.tone === 'error' ? <ShieldAlert size={18} /> : toast.tone === 'warning' ? <TriangleAlert size={18} /> : <Info size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-black text-[#111827]">{toast.title}</p>
                    {toast.message ? <p className="mt-1 text-[13px] font-medium leading-6 text-[#64748B]">{toast.message}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {isMobileNavOpen && (
          <div className="absolute inset-0 z-[120] flex lg:hidden">
            <button className="flex-1 bg-slate-950/50 backdrop-blur-sm" onClick={() => setIsMobileNavOpen(false)} aria-label="Cerrar navegacion" />
            <div className="flex h-full w-[86vw] max-w-sm flex-col border-l border-[#e5e7eb] bg-white">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563eb]">Navegacion</p>
                  <p className="truncate text-lg font-black text-[#111827]">{company?.name || 'Abundra Cloud'}</p>
                </div>
                <button onClick={() => setIsMobileNavOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f3f4f6] text-[#374151]">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto px-5 py-5">
                <nav className="space-y-2">
                  {filteredNav.map(item => {
                    const isActive =
                      item.href === '/'
                        ? location.pathname === '/'
                        : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsMobileNavOpen(false)}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium ${
                          isActive ? 'bg-[#eff6ff] text-[#2563eb]' : 'bg-[#f9fafb] text-[#111827]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon size={18} />
                          {item.name}
                        </span>
                        <ChevronRight size={16} />
                      </Link>
                    );
                  })}
                </nav>

                <button onClick={handleLogout} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#111827] px-4 py-3 text-[15px] font-medium text-white">
                  <LogOut size={16} />
                  Cerrar sesion
                </button>
              </div>
            </div>
          </div>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-[90] border-t border-[#e5e7eb] bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {mobilePrimaryNav.map(item => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex min-h-[58px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-black ${
                    isActive ? 'bg-[#eff6ff] text-[#2563eb]' : 'text-[#6b7280]'
                  }`}
                >
                  <item.icon size={18} className="mb-1" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
          {mobileSecondaryNav.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {mobileSecondaryNav.map(item => {
                const isActive =
                  item.href === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`whitespace-nowrap rounded-2xl px-4 py-2 text-[10px] font-black ${
                      isActive ? 'bg-[#eff6ff] text-[#2563eb]' : 'bg-[#f3f4f6] text-[#6b7280]'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </main>
    </div>
  );
};
