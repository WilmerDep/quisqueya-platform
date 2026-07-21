import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Crown,
  DollarSign,
  Download,
  Edit3,
  Eye,
  FileClock,
  FileText,
  Filter,
  Ghost,
  Globe,
  Headphones,
  History,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search, Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  TrendingUp,
  User as UserIcon,
  Users,
  UserCog,
  WalletCards,
  Phone,
  X,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  createCompany,
  getAllUsers,
  getBranches,
  getCompanies,
  getGlobalConfig,
  getGlobalActivity,
  getGlobalMetrics,
  getMasterLogs,
  getNodesTelemetry,
  getPayments,
  getSaaSPlans,
  getUsers,
  saveSaaSPlan,
  updateUser as updateUserInLocalStorage,
  upsertUsersInLocalStorage,
  updateCompany,
  updateGlobalConfig,
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiUnavailableError } from '../services/apiClient';
import { PlatformKpiGrid, PlatformKpiItem } from '../components/ui/PlatformKpiCard';
import { PlatformDateField } from '../components/ui/PlatformDateField';
import { PlatformHeaderAction, PlatformPageHeader } from '../components/ui/PlatformPageHeader';
import { HelpCenterTab } from '../components/HelpCenterTab';
import { PlatformKpiCard } from '../components/ui/PlatformKpiCard';
import { emitPlatformToast, openPlatformCriticalModal, setPlatformLoading } from '../services/platformEvents';
import {
  platformFilterFieldClass as filterFieldClass,
  platformInputClass as premiumInputClass,
  platformMotionButtonClass as motionButtonClass,
  platformHeaderPrimaryActionClass,
  platformHeaderSecondaryActionClass,
  platformShellCardClass as shellCardClass,
  platformSoftCardClass,
} from '../components/ui/platformStyles';
import { Company, GlobalConfig, Role, SaaSPlan, User } from '../types';
import { formatCurrency, formatDate } from '../utils';

import {
  SuperAdminTab, UsersManagementTab, UsersFilterOption, UsersFilterConfig, TenantUserSortKey, TenantUserRow, TenantUserActionKind, SaasRole, SaasMemberStatus, SaasMember, SaasMemberActionKind, InvitationStatus, InvitationType, InvitationRow, InvitationActionKind, RoleContext, RoleActionKind, PermissionModule, SuperAdminIcon, SessionStatus, SessionActionKind
} from '../components/super-admin/types';

const ALL_COMPANIES = 'Todas las empresas';
const ALL_BRANCHES = 'Todas las sucursales';
const ALL_ROLES = 'Todos los roles';
const ALL_STATUSES = 'Todos los estados';
import { getVisibleInternalRoleLabel, getVisibleInvitationTypeLabel, getVisibleSessionTypeLabel, getVisibleRoleContextLabel, getVisiblePermissionLabel, getSessionTone } from '../components/super-admin/utils';
import { StatusBadge, MiniPanel, ActionListItem, ClearFiltersButton, SummaryMetric, SidebarInfoCard } from '../components/super-admin/ui/Shared';
import { PlansDirectory } from '../components/super-admin/plans/PlansDirectory';
import { BillingDirectory } from '../components/super-admin/billing/BillingDirectory';
import { GlobalReportsDirectory } from '../components/super-admin/reports/GlobalReportsDirectory';

import { FilterDropdown } from '../components/ui/FilterDropdown';
import { TenantUserDetailDrawer } from '../components/super-admin/users/TenantUserDetailDrawer';
import { SessionDetailDrawer } from '../components/super-admin/users/SessionDetailDrawer';
import { RolePermissionsList, RolePermissionMatrix } from '../components/super-admin/users/RolePermissionsList';
import { TenantUsersDirectory, TenantUsersSkeleton, TenantUsersState, TenantUserActionButton, TenantUserActionsCell, TenantUserMobileCard, TenantUserTableRow } from '../components/super-admin/users/TenantUsersDirectory';
import { SessionDirectory, SessionTableRow, SessionMobileCard, SessionActionsCell } from '../components/super-admin/users/SessionDirectory';
import { SaasTeamDirectory, SaasTeamTableRow, SaasTeamMobileCard, SaasMemberActionsCell } from '../components/super-admin/users/SaasTeamDirectory';
import { InvitationDirectory, InvitationTableRow, InvitationMobileCard, InvitationActionsCell } from '../components/super-admin/users/InvitationDirectory';

const ALL_ACCESS = 'Todos los accesos';
const ALL_TWO_FACTOR = 'Todos los estados 2FA';
const ALL_TYPES = 'Todos los tipos';
const ALL_INVITERS = 'Todos los invitadores';
const ALL_DATES = 'Todas las fechas';
const ALL_DEVICES = 'Todos los dispositivos';
const ALL_BROWSERS = 'Todos los navegadores';
const ALL_IPS = 'Todas las IPs';
const ALL_USERS = 'Todos los usuarios';
const TENANT_USERS_PAGE_SIZE = 10;
const SAAS_ROLES: SaasRole[] = ['Owner SaaS', 'Super Admin', 'Soporte', 'Facturación', 'Auditor'];
const TENANT_INVITATION_ROLES: Role[] = [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR];

const useDebouncedValue = <T,>(value: T, delayMs = 380) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
};

const getLastAccessBucket = (lastAccess: string) => {
  const value = lastAccess.toLowerCase();
  if (value.includes('sin acceso')) return 'Sin acceso reciente';
  if (value.includes('hoy')) return 'Hoy';
  if (value.includes('ayer')) return 'Ayer';
  return 'Con acceso registrado';
};

const getSessionDeviceParts = (device: string) => {
  const [browser, deviceFamily] = device.split('/').map(part => part.trim());
  if (!deviceFamily) {
    return { browser: device, deviceFamily: device };
  }
  return { browser, deviceFamily };
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toSelectOptions = (values: string[]) =>
  values
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .map(value => ({ value, label: value }));

const usersTabPathMap: Record<UsersManagementTab, string> = {
  SAAS_TEAM: '/super-admin/usuarios/equipo-saas',
  TENANT_USERS: '/super-admin/usuarios/empresas',
  INVITATIONS: '/super-admin/usuarios/invitaciones',
  ROLES: '/super-admin/usuarios/roles-permisos',
  SESSIONS: '/super-admin/usuarios/sesiones',
};

const usersPathTabMap: Record<string, UsersManagementTab> = {
  '/super-admin/usuarios': 'SAAS_TEAM',
  '/super-admin/usuarios/equipo-saas': 'SAAS_TEAM',
  '/super-admin/usuarios/empresas': 'TENANT_USERS',
  '/super-admin/usuarios/invitaciones': 'INVITATIONS',
  '/super-admin/usuarios/roles-permisos': 'ROLES',
  '/super-admin/usuarios/sesiones': 'SESSIONS',
};

const usersManagementTabs: Array<{ id: UsersManagementTab; label: string; icon: SuperAdminIcon }> = [
  { id: 'SAAS_TEAM', label: 'Equipo interno', icon: Crown },
  { id: 'TENANT_USERS', label: 'Usuarios de Empresas', icon: Building2 },
  { id: 'INVITATIONS', label: 'Invitaciones', icon: Bell },
  { id: 'ROLES', label: 'Roles y Permisos', icon: ShieldCheck },
  { id: 'SESSIONS', label: 'Sesiones', icon: Activity },
];

const performanceData = [
  { name: 'Lun', value: 120 },
  { name: 'Mar', value: 230 },
  { name: 'Mie', value: 190 },
  { name: 'Jue', value: 450 },
  { name: 'Vie', value: 380 },
  { name: 'Sab', value: 620 },
  { name: 'Dom', value: 540 },
];

const tabItems: Array<{ id: SuperAdminTab; label: string; icon: SuperAdminIcon }> = [
  { id: 'DASHBOARD', label: 'Escritorio', icon: LayoutDashboard },
  { id: 'COMPANIES', label: 'Empresas', icon: Building2 },
  { id: 'GLOBAL_USERS', label: 'Usuarios', icon: Users },
  { id: 'PLANS', label: 'Planes', icon: Package },
  { id: 'BILLING', label: 'Facturación', icon: CreditCard },
  { id: 'REPORTS', label: 'Reportes', icon: FileText },
  { id: 'AUDIT', label: 'Auditoría', icon: History },
  { id: 'SYSTEM', label: 'Configuración del Sistema', icon: Settings },
  { id: 'HELP', label: 'Centro de Ayuda', icon: Headphones },
];

const tabToSectionMap: Record<SuperAdminTab, string> = {
  DASHBOARD: 'dashboard',
  COMPANIES: 'companies',
  GLOBAL_USERS: 'users',
  PLANS: 'plans',
  BILLING: 'billing',
  REPORTS: 'reports',
  AUDIT: 'audit',
  SYSTEM: 'system',
  HELP: 'help',
};

const sectionToTabMap: Record<string, SuperAdminTab> = {
  dashboard: 'DASHBOARD',
  companies: 'COMPANIES',
  users: 'GLOBAL_USERS',
  plans: 'PLANS',
  billing: 'BILLING',
  reports: 'REPORTS',
  audit: 'AUDIT',
  system: 'SYSTEM',
  help: 'HELP',
};

export const SuperAdminPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [platformConfig, setPlatformConfig] = useState<GlobalConfig>(getGlobalConfig());
  const [activeTab, setActiveTab] = useState<SuperAdminTab>(() => {
    if (location.pathname.startsWith('/super-admin/usuarios')) return 'GLOBAL_USERS';
    const section = new URLSearchParams(location.search).get('section') || 'dashboard';
    return sectionToTabMap[section] || 'DASHBOARD';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos los estados');
  const [planFilter, setPlanFilter] = useState('Todos los planes');
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<'STATUS' | 'PLAN' | null>(null);
  const [activeActionsDropdown, setActiveActionsDropdown] = useState<string | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [provisionName, setProvisionName] = useState('');
  const [provisionPlanId, setProvisionPlanId] = useState('p2');
  const [provisionCycle, setProvisionCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [provisionPrice, setProvisionPrice] = useState(3500);
  
  // Detalle de la empresa seleccionada para soporte y analisis en vivo
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<Company | null>(null);
  const [detailTab, setDetailTab] = useState<'RESUMEN' | 'USUARIOS' | 'SUCURSALES' | 'SUSCRIPCION' | 'FACTURACION' | 'ACTIVIDAD'>('RESUMEN');
  const [usersManagementTab, setUsersManagementTab] = useState<UsersManagementTab>(() => {
    if (!location.pathname.startsWith('/super-admin/usuarios')) return 'SAAS_TEAM';
    return usersPathTabMap[location.pathname] || 'SAAS_TEAM';
  });
  const [usersSearchTerm, setUsersSearchTerm] = useState('');
  const [activeUsersFilterDropdown, setActiveUsersFilterDropdown] = useState<string | null>(null);
  const [tenantCompanyFilter, setTenantCompanyFilter] = useState(ALL_COMPANIES);
  const [tenantBranchFilter, setTenantBranchFilter] = useState(ALL_BRANCHES);
  const [tenantRoleFilter, setTenantRoleFilter] = useState(ALL_ROLES);
  const [tenantStatusFilter, setTenantStatusFilter] = useState(ALL_STATUSES);
  const [tenantLastAccessFilter, setTenantLastAccessFilter] = useState(ALL_ACCESS);
  const [tenantTwoFactorFilter, setTenantTwoFactorFilter] = useState(ALL_TWO_FACTOR);
  const [invitationTypeFilter, setInvitationTypeFilter] = useState(ALL_TYPES);
  const [invitationStatusFilter, setInvitationStatusFilter] = useState(ALL_STATUSES);
  const [invitationCompanyFilter, setInvitationCompanyFilter] = useState(ALL_COMPANIES);
  const [invitationRoleFilter, setInvitationRoleFilter] = useState(ALL_ROLES);
  const [invitationInvitedByFilter, setInvitationInvitedByFilter] = useState(ALL_INVITERS);
  const [invitationDateFilter, setInvitationDateFilter] = useState(ALL_DATES);
  const [invitationSearchTerm, setInvitationSearchTerm] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState(ALL_TYPES);
  const [sessionCompanyFilter, setSessionCompanyFilter] = useState(ALL_COMPANIES);
  const [sessionStatusFilter, setSessionStatusFilter] = useState(ALL_STATUSES);
  const [sessionDeviceFilter, setSessionDeviceFilter] = useState(ALL_DEVICES);
  const [sessionBrowserFilter, setSessionBrowserFilter] = useState(ALL_BROWSERS);
  const [sessionIpFilter, setSessionIpFilter] = useState(ALL_IPS);
  const [sessionUserFilter, setSessionUserFilter] = useState(ALL_USERS);
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');
  const [sessionOverrides, setSessionOverrides] = useState<Record<string, Partial<{ status: SessionStatus; activity: string; blockedIp: boolean }>>>({});
  const [isSessionPolicyModalOpen, setIsSessionPolicyModalOpen] = useState(false);
  const [sessionPolicy, setSessionPolicy] = useState({
    maxDurationHours: 12,
    inactivityMinutes: 30,
    requireSaas2fa: true,
    requireTenantAdmin2fa: true,
    maxConcurrentSessions: 3,
    revokeOnPasswordChange: true,
    revokeOnSuspend: true,
    blockedIps: '45.71.11.104',
    newDeviceAlerts: true,
  });
  const [tenantUsersLoading, setTenantUsersLoading] = useState(true);
  const [tenantUsersError, setTenantUsersError] = useState('');
  const [tenantUsersPermissionError, setTenantUsersPermissionError] = useState('');
  const [tenantUsersPage, setTenantUsersPage] = useState(1);
  const [tenantUsersSort, setTenantUsersSort] = useState<{ key: TenantUserSortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [selectedTenantUserId, setSelectedTenantUserId] = useState<string | null>(null);
  const [tenantUserDrawerOpen, setTenantUserDrawerOpen] = useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [saasMemberOverrides, setSaasMemberOverrides] = useState<Record<string, Partial<SaasMember>>>({});
  const [createdSaasMembers, setCreatedSaasMembers] = useState<SaasMember[]>([]);
  const [isSaasMemberModalOpen, setIsSaasMemberModalOpen] = useState(false);
  const [saasMemberForm, setSaasMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Soporte' as SaasRole,
    requireTwoFactor: true,
    expiresAt: '',
    message: '',
  });
  const [isTenantInvitationModalOpen, setIsTenantInvitationModalOpen] = useState(false);
  const [tenantInvitationForm, setTenantInvitationForm] = useState({
    email: '',
    companyId: '',
    branchId: '',
    role: Role.COBRADOR,
    expiresAt: '',
  });
  const [invitationOverrides, setInvitationOverrides] = useState<Record<string, Partial<InvitationRow>>>({});
  const [createdInvitations, setCreatedInvitations] = useState<InvitationRow[]>([]);
  const [billingSearchTerm, setBillingSearchTerm] = useState('');
  const [billingStatusFilter, setBillingStatusFilter] = useState('Todos');
  
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState('Todos');
  const [auditPage, setAuditPage] = useState(1);


  const refreshData = useCallback(() => {
    setCompanies(getCompanies());
    setPlans(getSaaSPlans());
    setGlobalUsers(getAllUsers());
    setPlatformConfig(getGlobalConfig());
  }, []);

  const refreshTenantUsersFromApi = useCallback(async () => {
    setTenantUsersLoading(true);
    setTenantUsersError('');
    setTenantUsersPermissionError('');

    try {
      const response = await apiClient.listUsers();
      const tenantOnlyUsers = response.data.filter(user => user.companyId && user.companyId !== 'SYSTEM' && user.role !== Role.SUPER_ADMIN);
      upsertUsersInLocalStorage(tenantOnlyUsers);
      setGlobalUsers(getAllUsers());
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setGlobalUsers(getAllUsers());
        return;
      }
      const message = error instanceof Error ? error.message : 'No se pudo cargar usuarios desde la API.';
      if (/permiso|permission|forbidden|401|403/i.test(message)) {
        setTenantUsersPermissionError(message);
      } else {
        setTenantUsersError(message);
      }
    } finally {
      setTenantUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== Role.SUPER_ADMIN) {
      navigate('/');
      return;
    }
    refreshData();
    const interval = setInterval(() => {
      if (activeTab === 'DASHBOARD') refreshData();
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab, currentUser?.id, currentUser?.role, navigate, refreshData]);

  useEffect(() => {
    if (activeTab === 'GLOBAL_USERS' && usersManagementTab === 'TENANT_USERS') {
      void refreshTenantUsersFromApi();
    }
  }, [activeTab, refreshTenantUsersFromApi, usersManagementTab]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveActionsDropdown(null);
      setActiveUsersFilterDropdown(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const debouncedUsersSearchTerm = useDebouncedValue(usersSearchTerm);
  const debouncedInvitationSearchTerm = useDebouncedValue(invitationSearchTerm);
  const debouncedSessionSearchTerm = useDebouncedValue(sessionSearchTerm);
  const selectedProvisionPlan = useMemo(() => plans.find(plan => plan.id === provisionPlanId) || null, [plans, provisionPlanId]);
  const yearlyDiscountPercent = useMemo(() => {
    if (!selectedProvisionPlan) return 0;
    const monthlyAnnualized = selectedProvisionPlan.monthlyPrice * 12;
    const yearlyPrice = selectedProvisionPlan.yearlyPrice || selectedProvisionPlan.monthlyPrice * 10;
    if (!monthlyAnnualized || yearlyPrice >= monthlyAnnualized) return 0;
    return Math.round(((monthlyAnnualized - yearlyPrice) / monthlyAnnualized) * 100);
  }, [selectedProvisionPlan]);

  useEffect(() => {
    if (!pageRef.current) return;

    const ctx = gsap.context(() => {
      const animateIfPresent = (
        selector: string,
        fromVars: gsap.TweenVars,
        toVars: gsap.TweenVars,
      ) => {
        if (!pageRef.current?.querySelector(selector)) return;
        gsap.fromTo(selector, fromVars, toVars);
      };

      if (activeTab === 'GLOBAL_USERS') {
        animateIfPresent('[data-super-users-tabs]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out', delay: 0.12 });
        animateIfPresent('[data-super-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
        animateIfPresent('[data-super-users-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
        animateIfPresent('[data-super-kpi]', { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.08 });
        animateIfPresent('[data-super-filters]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.16 });
        animateIfPresent('[data-super-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
        animateIfPresent('[data-super-row]', { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.36, ease: 'power2.out', stagger: 0.035, delay: 0.28 });
        return;
      }

      if (activeTab === 'COMPANIES') {
        animateIfPresent('[data-super-companies-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
        animateIfPresent('[data-super-companies-kpi]', { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.08 });
        animateIfPresent('[data-super-companies-filters]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.16 });
        animateIfPresent('[data-super-companies-list], [data-super-companies-side-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
        animateIfPresent('[data-super-company-row]', { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.36, ease: 'power2.out', stagger: 0.035, delay: 0.28 });
        return;
      }

      animateIfPresent('[data-super-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      animateIfPresent('[data-super-kpi]', { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.08 });
      animateIfPresent('[data-super-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
      animateIfPresent('[data-super-row]', { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.36, ease: 'power2.out', stagger: 0.035, delay: 0.28 });
    }, pageRef);

    return () => ctx.revert();
  }, [activeTab]);

  useEffect(() => {
    if (!pageRef.current || !selectedCompanyDetail?.id) return;

    const ctx = gsap.context(() => {
      gsap.fromTo('[data-super-company-profile-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(
        '[data-super-company-profile-kpi]',
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.08 },
      );
      gsap.fromTo('[data-super-company-profile-tabs]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out', delay: 0.12 });
      gsap.fromTo('[data-super-company-profile-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
      gsap.fromTo(
        '[data-super-company-profile-row]',
        { opacity: 0, x: -16 },
        { opacity: 1, x: 0, duration: 0.36, ease: 'power2.out', stagger: 0.035, delay: 0.28 },
      );
    }, pageRef);

    return () => ctx.revert();
  }, [selectedCompanyDetail?.id]);

  useEffect(() => {
    const modalOpen =
      isCompanyModalOpen ||
      isPlanModalOpen ||
      isSaasMemberModalOpen ||
      isTenantInvitationModalOpen ||
      isSessionPolicyModalOpen;

    if (!modalOpen) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-super-modal-overlay]',
        { opacity: 0 },
        { opacity: 1, duration: 0.22, ease: 'power2.out' },
      );
      gsap.fromTo(
        '[data-super-modal-card]',
        { opacity: 0, y: 24, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
      );
    }, document.body);

    return () => ctx.revert();
  }, [isCompanyModalOpen, isPlanModalOpen, isSaasMemberModalOpen, isTenantInvitationModalOpen, isSessionPolicyModalOpen]);

  const syncUsersQueryParams = useCallback(
    (updates: Record<string, string>, defaults: Record<string, string>) => {
      if (!location.pathname.startsWith('/super-admin/usuarios')) return;

      const params = new URLSearchParams(location.search);
      Object.entries(updates).forEach(([key, value]) => {
        const trimmedValue = value.trim();
        if (!trimmedValue || trimmedValue === defaults[key]) {
          params.delete(key);
        } else {
          params.set(key, trimmedValue);
        }
      });

      const nextSearch = params.toString();
      const currentSearch = location.search.replace(/^\?/, '');
      if (nextSearch !== currentSearch) {
        navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
      }
    },
    [location.pathname, location.search, navigate],
  );

  useEffect(() => {
    if (!location.pathname.startsWith('/super-admin/usuarios')) return;

    const params = new URLSearchParams(location.search);
    const read = (key: string, fallback: string) => params.get(key) || fallback;

    setUsersSearchTerm(read('q', ''));
    setTenantCompanyFilter(read('empresa', ALL_COMPANIES));
    setTenantBranchFilter(read('sucursal', ALL_BRANCHES));
    setTenantRoleFilter(read('rol', ALL_ROLES));
    setTenantStatusFilter(read('estado', ALL_STATUSES));
    setTenantLastAccessFilter(read('ultimoAcceso', ALL_ACCESS));
    setTenantTwoFactorFilter(read('twofa', ALL_TWO_FACTOR));

    setInvitationSearchTerm(read('correo', ''));
    setInvitationTypeFilter(read('tipo', ALL_TYPES));
    setInvitationStatusFilter(read('estadoInvitacion', ALL_STATUSES));
    setInvitationCompanyFilter(read('empresaInvitacion', ALL_COMPANIES));
    setInvitationRoleFilter(read('rolInvitacion', ALL_ROLES));
    setInvitationInvitedByFilter(read('invitadoPor', ALL_INVITERS));
    setInvitationDateFilter(read('fechaInvitacion', ALL_DATES));

    setSessionSearchTerm(read('sesion', ''));
    setSessionTypeFilter(read('tipoSesion', ALL_TYPES));
    setSessionCompanyFilter(read('empresaSesion', ALL_COMPANIES));
    setSessionStatusFilter(read('estadoSesion', ALL_STATUSES));
    setSessionDeviceFilter(read('dispositivo', ALL_DEVICES));
    setSessionBrowserFilter(read('navegador', ALL_BROWSERS));
    setSessionIpFilter(read('ip', ALL_IPS));
    setSessionUserFilter(read('usuario', ALL_USERS));
  }, [location.pathname, location.search]);

  const metrics = useMemo(() => getGlobalMetrics(), [companies]);
  const masterLogs = useMemo(() => getMasterLogs(), [companies, platformConfig]);
  const telemetry = useMemo(() => getNodesTelemetry(), [activeTab]);
  const tenantCompanies = useMemo(() => companies.filter(company => company.id !== 'SYSTEM'), [companies]);
  const tenantUsers = useMemo(() => globalUsers.filter(user => user.companyId !== 'SYSTEM'), [globalUsers]);
  const companyUsers = useMemo(() => tenantUsers.filter(user => user.role !== Role.SUPER_ADMIN), [tenantUsers]);
  const tenantCompanyOptions = useMemo(
    () => [ALL_COMPANIES, ...tenantCompanies.map(company => company.name)],
    [tenantCompanies],
  );
  const selectedTenantCompany = useMemo(
    () => tenantCompanies.find(company => company.name === tenantCompanyFilter),
    [tenantCompanies, tenantCompanyFilter],
  );
  const tenantBranchesByCompany = useMemo(() => {
    const branchesMap = new Map<string, ReturnType<typeof getBranches>>();
    tenantCompanies.forEach(company => {
      branchesMap.set(company.id, getBranches(company.id));
    });
    return branchesMap;
  }, [tenantCompanies]);
  const tenantBranchOptions = useMemo(() => {
    if (!selectedTenantCompany) return [ALL_BRANCHES];
    return [ALL_BRANCHES, ...toSelectOptions((tenantBranchesByCompany.get(selectedTenantCompany.id) || []).map(branch => branch.name)).map(option => option.label)];
  }, [selectedTenantCompany, tenantBranchesByCompany]);
  const handleTenantCompanyFilterChange = useCallback((value: string) => {
    setTenantCompanyFilter(value);
    setTenantBranchFilter(ALL_BRANCHES);
    setActiveUsersFilterDropdown(null);
  }, []);

  const filteredCompanies = useMemo(() => {
    let result = tenantCompanies;
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter(company => company.name.toLowerCase().includes(query) || company.id.toLowerCase().includes(query));
    }
    if (statusFilter !== 'Todos los estados') {
      const matchStatus = statusFilter === 'Activas' ? 'ACTIVE' : statusFilter === 'Pruebas' ? 'TRIAL' : 'SUSPENDED';
      result = result.filter(company => company.status === matchStatus);
    }
    if (planFilter !== 'Todos los planes') {
      const selectedPlan = plans.find(p => p.name === planFilter);
      if (selectedPlan) {
        result = result.filter(company => company.planId === selectedPlan.id);
      }
    }
    return result;
  }, [searchTerm, statusFilter, planFilter, tenantCompanies, plans]);

  const companyListKpis = useMemo<PlatformKpiItem[]>(() => {
    const activeCompanies = tenantCompanies.filter(company => company.status === 'ACTIVE').length;
    const trialCompanies = tenantCompanies.filter(company => company.status === 'TRIAL').length;
    const suspendedCompanies = tenantCompanies.filter(company => company.status === 'SUSPENDED').length;
    const totalMrr = tenantCompanies.reduce((sum, company) => sum + (company.subscriptionPrice || 0), 0);
    const upcomingRenewals = tenantCompanies.filter(company => {
      const expirationTime = new Date(company.expiresAt).getTime();
      const daysUntilExpiration = Math.ceil((expirationTime - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiration >= 0 && daysUntilExpiration <= 10;
    }).length;

    return [
      {
        label: 'Empresas activas',
        value: `${activeCompanies}`,
        helper: 'Tenants con operación estable y acceso habilitado.',
        trend: `+${Math.max(activeCompanies, 1)} activas`,
        secondaryLabel: 'Estado',
        secondaryValue: 'Operativas',
        tone: 'blue',
        icon: Building2,
      },
      {
        label: 'En prueba',
        value: `${trialCompanies}`,
        helper: 'Empresas evaluando el SaaS antes del ciclo formal.',
        trend: `+${Math.max(trialCompanies, 1)} trial`,
        secondaryLabel: 'Conversión',
        secondaryValue: 'Pipeline',
        tone: 'emerald',
        icon: Crown,
      },
      {
        label: 'Suspendidas',
        value: `${suspendedCompanies}`,
        helper: 'Tenants pausados que requieren seguimiento comercial o de soporte.',
        trend: `${Math.max(suspendedCompanies, 0)} en riesgo`,
        secondaryLabel: 'Atención',
        secondaryValue: 'Escalada',
        tone: 'rose',
        icon: AlertCircle,
        trendDirection: suspendedCompanies > 0 ? 'up' : 'neutral',
      },
      {
        label: 'MRR Total',
        value: formatCurrency(totalMrr),
        helper: 'Ingreso recurrente mensual consolidado de toda la cartera.',
        trend: '+8.5%',
        secondaryLabel: 'Cobro',
        secondaryValue: 'Mensual',
        tone: 'violet',
        icon: DollarSign,
      },
      {
        label: 'Vencimientos',
        value: `${upcomingRenewals}`,
        helper: 'Renovaciones que conviene revisar en la próxima ventana operativa.',
        trend: upcomingRenewals > 0 ? 'Urgente' : 'Estable',
        secondaryLabel: 'Ventana',
        secondaryValue: '10 días',
        tone: 'amber',
        icon: Calendar,
        trendDirection: upcomingRenewals > 0 ? 'up' : 'neutral',
      },
    ];
  }, [tenantCompanies]);

  const selectedCompanyUsers = useMemo(
    () => (selectedCompanyDetail ? companyUsers.filter(user => user.companyId === selectedCompanyDetail.id) : []),
    [companyUsers, selectedCompanyDetail],
  );

  const selectedCompanyBranches = useMemo(
    () => (selectedCompanyDetail ? tenantBranchesByCompany.get(selectedCompanyDetail.id) || [] : []),
    [selectedCompanyDetail, tenantBranchesByCompany],
  );

  const selectedCompanyLogs = useMemo(
    () =>
      selectedCompanyDetail ?
        masterLogs.filter(log => log.detail.toLowerCase().includes(selectedCompanyDetail.name.toLowerCase()) || log.action.toLowerCase().includes('company'))
      : [],
    [masterLogs, selectedCompanyDetail],
  );

  const selectedCompanyPlan = useMemo(
    () => (selectedCompanyDetail ? plans.find(plan => plan.id === selectedCompanyDetail.planId) || null : null),
    [plans, selectedCompanyDetail],
  );

  const selectedCompanyAdmins = useMemo(
    () => selectedCompanyUsers.filter(user => [Role.ADMIN, Role.SUPERVISOR].includes(user.role)).slice(0, 4),
    [selectedCompanyUsers],
  );

  const selectedCompanyProfile = useMemo(() => {
    if (!selectedCompanyDetail) return null;

    const adminUser =
      selectedCompanyUsers.find(user => user.role === Role.ADMIN) ||
      selectedCompanyUsers.find(user => user.role === Role.SUPERVISOR) ||
      selectedCompanyUsers[0] ||
      null;

    const totalUsers = selectedCompanyUsers.length;
    const activeUsers = selectedCompanyUsers.filter(user => user.isActive).length;
    const totalBranches = selectedCompanyBranches.length;
    const lastAccessValue = selectedCompanyUsers
      .map(user => user.lastLoginAt)
      .filter(Boolean)
      .sort()
      .reverse()[0];
    const invoices = [
      {
        id: `FAC-${selectedCompanyDetail.id.toUpperCase()}-001`,
        cycle: selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual',
        amount: selectedCompanyDetail.subscriptionPrice,
        dueDate: selectedCompanyDetail.expiresAt,
        status: selectedCompanyDetail.status === 'ACTIVE' ? 'Pagada' : 'Pendiente',
      },
      {
        id: `FAC-${selectedCompanyDetail.id.toUpperCase()}-002`,
        cycle: selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual',
        amount: selectedCompanyDetail.subscriptionPrice,
        dueDate: selectedCompanyDetail.expiresAt,
        status: selectedCompanyDetail.status === 'SUSPENDED' ? 'Pendiente' : 'Programada',
      },
    ];
    const usageUsersLimit = selectedCompanyPlan?.maxUsers && selectedCompanyPlan.maxUsers !== 999999 ? selectedCompanyPlan.maxUsers : Math.max(totalUsers, 15);
    const usageBranchesLimit = selectedCompanyPlan?.maxBranches && selectedCompanyPlan.maxBranches !== 999999 ? selectedCompanyPlan.maxBranches : Math.max(totalBranches, 5);
    const storageUsed = totalUsers * 1.4;
    const storageLimit = selectedCompanyDetail.billingCycle === 'YEARLY' ? 80 : 50;
    const reportsUsed = Math.min(8, Math.max(1, totalBranches + 1));
    const reportsLimit = selectedCompanyPlan?.maxBranches && selectedCompanyPlan.maxBranches !== 999999 ? Math.max(6, Math.min(12, selectedCompanyPlan.maxBranches * 2)) : 10;
    const healthScore = selectedCompanyDetail.status === 'ACTIVE' ? 92 : selectedCompanyDetail.status === 'TRIAL' ? 84 : 61;
    const statusLabel =
      selectedCompanyDetail.status === 'ACTIVE' ? 'Activa'
      : selectedCompanyDetail.status === 'TRIAL' ? 'En prueba'
      : selectedCompanyDetail.status === 'SUSPENDED' ? 'Suspendida'
      : 'Restringida';
    const healthLabel = healthScore >= 88 ? 'Buena' : healthScore >= 74 ? 'En seguimiento' : 'Crítica';
    const cityLabel = selectedCompanyDetail.id === 'c1' ? 'Santo Domingo, R.D.' : selectedCompanyDetail.id === 'c2' ? 'Santiago, R.D.' : 'República Dominicana';

    return {
      adminUser,
      totalUsers,
      activeUsers,
      totalBranches,
      lastAccessLabel: lastAccessValue ? formatDate(lastAccessValue) : 'Sin accesos recientes',
      invoices,
      usageUsersLimit,
      usageBranchesLimit,
      storageUsed,
      storageLimit,
      reportsUsed,
      reportsLimit,
      healthScore,
      statusLabel,
      healthLabel,
      cityLabel,
      domain: `${normalizeText(selectedCompanyDetail.name).replace(/\s+/g, '')}.app`,
      mrrLabel: formatCurrency(selectedCompanyDetail.subscriptionPrice),
      delinquencyLabel: formatCurrency(selectedCompanyDetail.id === 'c1' ? 45000 : selectedCompanyDetail.id === 'c2' ? 15000 : 0),
      totalCollectionsLabel: formatCurrency(selectedCompanyDetail.id === 'c1' ? 845200 : selectedCompanyDetail.id === 'c2' ? 312000 : 92000),
      capitalPlacedLabel: formatCurrency(selectedCompanyDetail.id === 'c1' ? 1250000 : selectedCompanyDetail.id === 'c2' ? 680000 : 210000),
      activePortfolioLabel: formatCurrency(selectedCompanyDetail.id === 'c1' ? 689000 : selectedCompanyDetail.id === 'c2' ? 420000 : 130000),
      loanArrearsCount: selectedCompanyDetail.id === 'c1' ? 8 : selectedCompanyDetail.id === 'c2' ? 3 : 0,
      activityItems: selectedCompanyLogs.slice(0, 4),
    };
  }, [selectedCompanyAdmins, selectedCompanyBranches, selectedCompanyDetail, selectedCompanyLogs, selectedCompanyPlan, selectedCompanyUsers]);

  const companyDetailTabs = useMemo<Array<{ id: 'RESUMEN' | 'USUARIOS' | 'SUCURSALES' | 'SUSCRIPCION' | 'FACTURACION' | 'ACTIVIDAD'; label: string; icon: SuperAdminIcon }>>(
    () => [
      { id: 'RESUMEN', label: 'Resumen', icon: Globe },
      { id: 'USUARIOS', label: 'Usuarios', icon: Users },
      { id: 'SUCURSALES', label: 'Sucursales', icon: Building2 },
      { id: 'SUSCRIPCION', label: 'Suscripción', icon: Package },
      { id: 'FACTURACION', label: 'Facturación', icon: CreditCard },
      { id: 'ACTIVIDAD', label: 'Actividad', icon: History },
    ],
    [],
  );

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return companyUsers;
    return companyUsers.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query),
    );
  }, [companyUsers, searchTerm]);

  const saasTeamMembers = useMemo<SaasMember[]>(() => {
    const baseMembers: SaasMember[] = [
      {
        id: 'saas-1',
        userScope: 'SAAS',
        companyId: null,
        name: currentUser?.name || 'Nexus Master',
        email: currentUser?.email || 'master@abundra.com',
        phone: currentUser?.phone || '809-555-0101',
        role: 'Owner SaaS',
        area: 'Operación de plataforma',
        status: 'Activo',
        lastAccess: currentUser?.lastLoginAt ? formatDate(currentUser.lastLoginAt) : 'Hoy, 09:15',
        twoFactor: true,
        criticalAccess: true,
        sessions: 1,
        createdAt: currentUser?.createdAt ? formatDate(currentUser.createdAt) : '01/01/2026',
        permissions: ['saas.owner', 'saas.users.manage', 'saas.audit.view'],
        isOwner: true,
      },
      {
        id: 'saas-2',
        userScope: 'SAAS',
        companyId: null,
        name: 'Laura Mejia',
        email: 'soporte@abundra.com',
        phone: '809-555-0102',
        role: 'Soporte',
        area: 'Customer Success',
        status: 'Activo',
        lastAccess: 'Hoy, 08:41',
        twoFactor: true,
        criticalAccess: false,
        sessions: 1,
        createdAt: '15/02/2026',
        permissions: ['saas.companies.view', 'saas.support.impersonate'],
      },
      {
        id: 'saas-3',
        userScope: 'SAAS',
        companyId: null,
        name: 'Daniel Rosario',
        email: 'billing@abundra.com',
        phone: '809-555-0103',
        role: 'Facturación',
        area: 'Finanzas de plataforma',
        status: 'Activo',
        lastAccess: 'Ayer, 18:22',
        twoFactor: true,
        criticalAccess: true,
        sessions: 0,
        createdAt: '03/03/2026',
        permissions: ['saas.billing.view', 'saas.billing.manage'],
      },
      {
        id: 'saas-4',
        userScope: 'SAAS',
        companyId: null,
        name: 'Ingrid Paredes',
        email: 'auditoria@abundra.com',
        phone: '809-555-0104',
        role: 'Auditor',
        area: 'Compliance',
        status: 'Pendiente',
        lastAccess: 'Invitación pendiente',
        twoFactor: false,
        criticalAccess: false,
        sessions: 0,
        createdAt: '22/05/2026',
        permissions: ['saas.audit.view', 'saas.reports.view'],
      },
      {
        id: 'saas-5',
        userScope: 'SAAS',
        companyId: null,
        name: 'Victor Nunez',
        email: 'tech@abundra.com',
        phone: '809-555-0105',
        role: 'Super Admin',
        area: 'Infraestructura',
        status: 'Activo',
        lastAccess: 'Hoy, 07:54',
        twoFactor: false,
        criticalAccess: true,
        sessions: 0,
        createdAt: '12/04/2026',
        permissions: ['saas.users.manage', 'saas.config.manage'],
      },
    ];

    return [...baseMembers, ...createdSaasMembers].map(member => ({
      ...member,
      ...saasMemberOverrides[member.id],
      userScope: 'SAAS',
      companyId: null,
    }));
  }, [createdSaasMembers, currentUser?.createdAt, currentUser?.email, currentUser?.lastLoginAt, currentUser?.name, currentUser?.phone, saasMemberOverrides]);

  const filteredSaasMembers = useMemo(() => {
    const query = usersSearchTerm.trim().toLowerCase();
    if (!query) return saasTeamMembers;
    return saasTeamMembers.filter(member =>
      [member.name, member.email, member.phone, member.role, member.area].some(value => value.toLowerCase().includes(query)),
    );
  }, [saasTeamMembers, usersSearchTerm]);

  const tenantUsersRows = useMemo<TenantUserRow[]>(
    () =>
      companyUsers.map(user => {
        const companyName = tenantCompanies.find(company => company.id === user.companyId)?.name || 'Sin empresa';
        const branchName = tenantBranchesByCompany.get(user.companyId)?.find(branch => branch.id === user.branchId)?.name || 'Sin sucursal';
        const lastAccess = user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Sin acceso reciente';
        const twoFactorStatus = user.firstAccessRequired ? 'Pendiente' : 'Sin registrar';

        return {
          id: user.id,
          code: user.username,
          companyId: user.companyId,
          branchId: user.branchId,
          name: user.name,
          email: user.email || `${user.username}@abundra.app`,
          phone: user.phone || '809-000-0000',
          companyName,
          branchName,
          role: user.role,
          status: user.isActive ? 'Activo' : 'Suspendido',
          isActive: user.isActive,
          lastAccess,
          lastAccessBucket: getLastAccessBucket(lastAccess),
          twoFactorStatus,
          permissions: user.permissions || {},
          createdAt: user.createdAt,
        };
      }),
    [companyUsers, tenantBranchesByCompany, tenantCompanies],
  );

  const filteredTenantUsers = useMemo(() => {
    const query = debouncedUsersSearchTerm.trim().toLowerCase();
    return tenantUsersRows.filter(user => {
      const matchesQuery =
        !query ||
        [user.name, user.email, user.phone, user.companyName, user.code].some(value => value.toLowerCase().includes(query));
      const matchesCompany = tenantCompanyFilter === ALL_COMPANIES || user.companyName === tenantCompanyFilter;
      const matchesBranch = tenantBranchFilter === ALL_BRANCHES || user.branchName === tenantBranchFilter;
      const matchesRole = tenantRoleFilter === ALL_ROLES || user.role === tenantRoleFilter;
      const matchesStatus = tenantStatusFilter === ALL_STATUSES || user.status === tenantStatusFilter;
      const matchesLastAccess = tenantLastAccessFilter === ALL_ACCESS || user.lastAccessBucket === tenantLastAccessFilter;
      const matchesTwoFactor = tenantTwoFactorFilter === ALL_TWO_FACTOR || user.twoFactorStatus === tenantTwoFactorFilter;
      return matchesQuery && matchesCompany && matchesBranch && matchesRole && matchesStatus && matchesLastAccess && matchesTwoFactor;
    });
  }, [
    debouncedUsersSearchTerm,
    tenantBranchFilter,
    tenantCompanyFilter,
    tenantLastAccessFilter,
    tenantRoleFilter,
    tenantStatusFilter,
    tenantTwoFactorFilter,
    tenantUsersRows,
  ]);

  const sortedTenantUsers = useMemo(() => {
    const direction = tenantUsersSort.direction === 'asc' ? 1 : -1;
    return [...filteredTenantUsers].sort((a, b) => {
      const left = `${a[tenantUsersSort.key] || ''}`.toLowerCase();
      const right = `${b[tenantUsersSort.key] || ''}`.toLowerCase();
      return left.localeCompare(right) * direction;
    });
  }, [filteredTenantUsers, tenantUsersSort]);

  const tenantUsersTotalPages = Math.max(1, Math.ceil(sortedTenantUsers.length / TENANT_USERS_PAGE_SIZE));
  const safeTenantUsersPage = Math.min(tenantUsersPage, tenantUsersTotalPages);
  const paginatedTenantUsers = useMemo(() => {
    const start = (safeTenantUsersPage - 1) * TENANT_USERS_PAGE_SIZE;
    return sortedTenantUsers.slice(start, start + TENANT_USERS_PAGE_SIZE);
  }, [safeTenantUsersPage, sortedTenantUsers]);
  const visibleTenantUserPages = useMemo(() => {
    const pages = new Set<number>([1, tenantUsersTotalPages, safeTenantUsersPage - 1, safeTenantUsersPage, safeTenantUsersPage + 1]);
    return Array.from(pages)
      .filter(page => page >= 1 && page <= tenantUsersTotalPages)
      .sort((a, b) => a - b);
  }, [safeTenantUsersPage, tenantUsersTotalPages]);
  const selectedTenantUser = useMemo(
    () => tenantUsersRows.find(user => user.id === selectedTenantUserId) || null,
    [selectedTenantUserId, tenantUsersRows],
  );
  const selectedTenantUserActivity = useMemo(() => {
    if (!selectedTenantUser) return [];
    return getGlobalActivity(selectedTenantUser.companyId)
      .filter(item => item.userId === selectedTenantUser.id || `${item.title} ${item.description} ${item.userName}`.toLowerCase().includes(selectedTenantUser.name.toLowerCase()))
      .slice(0, 8);
  }, [selectedTenantUser]);
  const selectedTenantUserAudit = useMemo(() => {
    if (!selectedTenantUser) return [];
    return masterLogs
      .filter(log => `${log.action} ${log.detail} ${log.id}`.toLowerCase().includes(selectedTenantUser.name.toLowerCase()) || `${log.detail}`.toLowerCase().includes(selectedTenantUser.companyName.toLowerCase()))
      .slice(0, 8);
  }, [masterLogs, selectedTenantUser]);

  const invitationRows = useMemo<InvitationRow[]>(() => {
    const prestaFacil = tenantCompanies.find(company => company.name === 'PrestaFacil RD') || tenantCompanies[0];
    const creditoGo = tenantCompanies.find(company => company.name === 'Credito Go') || tenantCompanies[1] || tenantCompanies[0];
    const prestaBranch = prestaFacil ? tenantBranchesByCompany.get(prestaFacil.id)?.[0] : null;
    const creditoBranch = creditoGo ? tenantBranchesByCompany.get(creditoGo.id)?.[0] : null;
    const baseRows: InvitationRow[] = [
      { id: 'invite-1', email: 'owner@creditogo.do', type: 'Usuario de empresa', company: creditoGo?.name || 'Credito Go', companyId: creditoGo?.id || 'c2', branch: creditoBranch?.name || 'Sucursal principal', branchId: creditoBranch?.id || null, role: Role.ADMIN, invitedBy: 'Nexus Master', date: '10/07/2026', expiresAt: '17/07/2026', status: 'Pendiente', token: 'inv-creditogo-owner-01' },
      { id: 'invite-2', email: 'soporte2@abundra.com', type: 'Equipo SaaS', company: 'ABUNDRA', companyId: null, branch: 'Sin sucursal', branchId: null, role: 'Soporte', invitedBy: 'Nexus Master', date: '09/07/2026', expiresAt: '16/07/2026', status: 'Aceptada', token: 'inv-saas-soporte2-01', acceptedUserId: 'saas-2' },
      { id: 'invite-3', email: 'supervisor@prestafacilrd.com', type: 'Usuario de empresa', company: prestaFacil?.name || 'PrestaFacil RD', companyId: prestaFacil?.id || 'c1', branch: prestaBranch?.name || 'Sucursal MAIN', branchId: prestaBranch?.id || null, role: Role.SUPERVISOR, invitedBy: 'Laura Mejia', date: '08/07/2026', expiresAt: '12/07/2026', status: 'Expirada', token: 'inv-prestafacil-supervisor-01' },
      { id: 'invite-4', email: 'auditoria@abundra.com', type: 'Equipo SaaS', company: 'ABUNDRA', companyId: null, branch: 'Sin sucursal', branchId: null, role: 'Auditor', invitedBy: 'Nexus Master', date: '07/07/2026', expiresAt: '14/07/2026', status: 'Revocada', token: 'inv-saas-auditoria-01' },
    ];

    return [...baseRows, ...createdInvitations].map(invitation => ({
      ...invitation,
      ...invitationOverrides[invitation.id],
    }));
  }, [createdInvitations, invitationOverrides, tenantBranchesByCompany, tenantCompanies]);

  const filteredInvitationRows = useMemo(() => {
    const query = debouncedInvitationSearchTerm.trim().toLowerCase();
    return invitationRows.filter(invitation => {
      const matchesQuery =
        !query || [invitation.email, invitation.company, invitation.role, invitation.invitedBy].some(value => value.toLowerCase().includes(query));
      const matchesType = invitationTypeFilter === ALL_TYPES || invitation.type === invitationTypeFilter;
      const matchesStatus = invitationStatusFilter === ALL_STATUSES || invitation.status === invitationStatusFilter;
      const matchesCompany = invitationCompanyFilter === ALL_COMPANIES || invitation.company === invitationCompanyFilter;
      const matchesRole = invitationRoleFilter === ALL_ROLES || invitation.role === invitationRoleFilter;
      const matchesInvitedBy = invitationInvitedByFilter === ALL_INVITERS || invitation.invitedBy === invitationInvitedByFilter;
      const matchesDate = invitationDateFilter === ALL_DATES || invitation.date === invitationDateFilter;
      return matchesQuery && matchesType && matchesStatus && matchesCompany && matchesRole && matchesInvitedBy && matchesDate;
    });
  }, [
    debouncedInvitationSearchTerm,
    invitationCompanyFilter,
    invitationDateFilter,
    invitationInvitedByFilter,
    invitationRoleFilter,
    invitationRows,
    invitationStatusFilter,
    invitationTypeFilter,
  ]);

  const roleCards = useMemo(
    () => ({
      saas: [
        { role: 'Owner SaaS', users: 1, permissions: ['saas.companies.view', 'saas.billing.manage', 'saas.audit.view'] },
        { role: 'Super Admin', users: 2, permissions: ['saas.users.manage', 'saas.support.impersonate', 'saas.companies.update'] },
        { role: 'Soporte', users: 3, permissions: ['saas.companies.view', 'saas.users.view', 'saas.support.impersonate'] },
        { role: 'Facturación', users: 2, permissions: ['saas.billing.view', 'saas.billing.manage', 'saas.reports.view'] },
      ],
      tenant: [
        { role: 'Admin Empresa', users: companyUsers.filter(user => user.role === Role.ADMIN).length, permissions: ['tenant.clients.view', 'tenant.loans.create', 'tenant.users.manage'] },
        { role: 'Supervisor', users: companyUsers.filter(user => user.role === Role.SUPERVISOR).length, permissions: ['tenant.clients.view', 'tenant.reports.view', 'tenant.payments.create'] },
        { role: 'Cobrador', users: companyUsers.filter(user => user.role === Role.COBRADOR).length, permissions: ['tenant.clients.view', 'tenant.payments.create', 'tenant.routes.view'] },
        { role: 'Cajero', users: 4, permissions: ['tenant.cash.close', 'tenant.payments.create', 'tenant.reports.view'] },
        { role: 'Asistente', users: 2, permissions: ['tenant.clients.view', 'tenant.reports.view', 'tenant.payments.create'] },
      ],
    }),
    [companyUsers],
  );

  const permissionMatrix = useMemo<Record<RoleContext, PermissionModule[]>>(
    () => ({
      SaaS: [
        { module: 'Empresas', permissions: ['Ver empresas', 'Editar empresas', 'Suspender empresa'], critical: ['Suspender empresa'] },
        { module: 'Usuarios', permissions: ['Ver usuarios internos', 'Crear miembros internos', 'Administrar permisos'], critical: ['Administrar permisos'] },
        { module: 'Planes', permissions: ['Ver planes', 'Editar límites', 'Publicar plan'] },
        { module: 'Suscripciones', permissions: ['Ver suscripciones', 'Pausar suscripción', 'Cambiar ciclo'] },
        { module: 'Facturación', permissions: ['Ver facturación', 'Gestionar facturación', 'Reintentar cobro'], critical: ['Gestionar facturación'] },
        { module: 'Reportes globales', permissions: ['Ver reportes', 'Exportar global', 'Programar envío'] },
        { module: 'Auditoría', permissions: ['Ver auditoría', 'Exportar logs', 'Retener evidencia'] },
        { module: 'Soporte', permissions: ['Ver contexto', 'Acceder como soporte', 'Registrar intervención'], critical: ['Acceder como soporte'] },
        { module: 'Configuración', permissions: ['Ver configuración', 'Modificar configuración global'], critical: ['Modificar configuración global'] },
        { module: 'Seguridad', permissions: ['Ver sesiones', 'Revocar sesiones', 'Bloquear IP'] },
      ],
      Tenant: [
        { module: 'Escritorio', permissions: ['Ver indicadores', 'Filtrar sucursal', 'Exportar resumen'] },
        { module: 'Clientes', permissions: ['Ver clientes', 'Crear cliente', 'Editar cliente'] },
        { module: 'Préstamos', permissions: ['Ver préstamos', 'Crear préstamo', 'Reestructurar'] },
        { module: 'Cuotas', permissions: ['Ver cuotas', 'Reprogramar cuota', 'Aplicar mora'] },
        { module: 'Pagos', permissions: ['Ver pagos', 'Registrar pago', 'Revertir pagos'], critical: ['Revertir pagos'] },
        { module: 'Cobrar Hoy', permissions: ['Ver agenda', 'Registrar visita', 'Promesa de pago'] },
        { module: 'Rutas', permissions: ['Ver rutas', 'Asignar ruta', 'Optimizar ruta'] },
        { module: 'Caja', permissions: ['Ver caja', 'Abrir caja', 'Cerrar caja'], critical: ['Cerrar caja'] },
        { module: 'Reportes', permissions: ['Ver reportes', 'Exportar PDF', 'Exportar Excel'] },
        { module: 'Usuarios', permissions: ['Ver usuarios', 'Crear usuario', 'Cambiar rol'] },
        { module: 'Configuración', permissions: ['Ver configuración', 'Editar empresa', 'Cambiar límites'] },
        { module: 'Auditoría', permissions: ['Ver auditoría', 'Filtrar eventos', 'Exportar evidencia'] },
      ],
    }),
    [],
  );

  const sessionRows = useMemo(
    () =>
      [
        { id: 'session-1', user: 'Nexus Master', type: 'SaaS', company: 'ABUNDRA', ip: '186.150.12.10', device: 'Chrome / Windows', location: 'Santo Domingo', activity: 'Hace 2 min', createdAt: '13/07/2026 08:11', status: 'Activa' as SessionStatus },
        { id: 'session-2', user: 'Laura Mejia', type: 'SaaS', company: 'ABUNDRA', ip: '190.80.44.22', device: 'Safari / macOS', location: 'Santiago', activity: 'Hace 12 min', createdAt: '13/07/2026 07:48', status: 'Activa' as SessionStatus },
        { id: 'session-3', user: 'Admin PrestaFacil', type: 'Tenant', company: 'PrestaFacil RD', ip: '201.33.17.90', device: 'Edge / Windows', location: 'Santo Domingo', activity: 'Hace 4 min', createdAt: '13/07/2026 08:03', status: 'Activa' as SessionStatus },
        { id: 'session-4', user: 'Supervisor Herrera', type: 'Tenant', company: 'PrestaFacil RD', ip: '45.71.11.104', device: 'Android App', location: 'Herrera', activity: 'Hace 1 h', createdAt: '13/07/2026 06:54', status: 'Sospechosa' as SessionStatus },
        { id: 'session-5', user: 'Daniel Rosario', type: 'SaaS', company: 'ABUNDRA', ip: '186.6.10.44', device: 'Firefox / Windows', location: 'Santo Domingo', activity: 'Hace 4 h', createdAt: '13/07/2026 05:21', status: 'Inactiva' as SessionStatus },
        { id: 'session-6', user: 'Cobrador Demo', type: 'Tenant', company: 'PrestaFacil RD', ip: '190.124.5.2', device: 'Chrome / Android', location: 'Santiago', activity: 'Ayer, 18:20', createdAt: '12/07/2026 15:02', status: 'Expirada' as SessionStatus },
      ].map(session => ({
        ...session,
        ...sessionOverrides[session.id],
        ...getSessionDeviceParts(session.device),
      })),
    [sessionOverrides],
  );

  const filteredSessionRows = useMemo(() => {
    const query = debouncedSessionSearchTerm.trim().toLowerCase();
    return sessionRows.filter(session => {
      const matchesQuery =
        !query || [session.user, session.ip, session.device, session.browser, session.deviceFamily, session.company, session.location].some(value => value.toLowerCase().includes(query));
      const matchesType = sessionTypeFilter === ALL_TYPES || session.type === sessionTypeFilter;
      const matchesCompany = sessionCompanyFilter === ALL_COMPANIES || session.company === sessionCompanyFilter;
      const matchesStatus = sessionStatusFilter === ALL_STATUSES || session.status === sessionStatusFilter;
      const matchesDevice = sessionDeviceFilter === ALL_DEVICES || session.deviceFamily === sessionDeviceFilter;
      const matchesBrowser = sessionBrowserFilter === ALL_BROWSERS || session.browser === sessionBrowserFilter;
      const matchesIp = sessionIpFilter === ALL_IPS || session.ip === sessionIpFilter;
      const matchesUser = sessionUserFilter === ALL_USERS || session.user === sessionUserFilter;
      return matchesQuery && matchesType && matchesCompany && matchesStatus && matchesDevice && matchesBrowser && matchesIp && matchesUser;
    });
  }, [
    debouncedSessionSearchTerm,
    sessionBrowserFilter,
    sessionCompanyFilter,
    sessionDeviceFilter,
    sessionIpFilter,
    sessionRows,
    sessionStatusFilter,
    sessionTypeFilter,
    sessionUserFilter,
  ]);
  const selectedTenantUserSessions = useMemo(() => {
    if (!selectedTenantUser) return [];
    return sessionRows.filter(session => session.user === selectedTenantUser.name || session.company === selectedTenantUser.companyName);
  }, [selectedTenantUser, sessionRows]);

  const tenantFilterConfigs = useMemo<UsersFilterConfig[]>(
    () => [
      {
        id: 'TENANT_COMPANY',
        label: 'Empresa',
        value: tenantCompanyFilter,
        placeholder: ALL_COMPANIES,
        options: tenantCompanyOptions.map(value => ({ value, label: value })),
        onChange: handleTenantCompanyFilterChange,
      },
      {
        id: 'TENANT_BRANCH',
        label: 'Sucursal',
        value: tenantBranchFilter,
        placeholder: selectedTenantCompany ? ALL_BRANCHES : 'Elige empresa primero',
        options: tenantBranchOptions.map(value => ({ value, label: value })),
        onChange: value => {
          setTenantBranchFilter(value);
          setActiveUsersFilterDropdown(null);
        },
        disabled: !selectedTenantCompany,
      },
      {
        id: 'TENANT_ROLE',
        label: 'Rol',
        value: tenantRoleFilter,
        placeholder: ALL_ROLES,
        options: [ALL_ROLES, Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR, 'Cajero', 'Asistente'].map(value => ({ value, label: value })),
        onChange: value => {
          setTenantRoleFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'TENANT_STATUS',
        label: 'Estado',
        value: tenantStatusFilter,
        placeholder: ALL_STATUSES,
        options: [ALL_STATUSES, 'Activo', 'Suspendido'].map(value => ({ value, label: value })),
        onChange: value => {
          setTenantStatusFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'TENANT_ACCESS',
        label: 'Último acceso',
        value: tenantLastAccessFilter,
        placeholder: ALL_ACCESS,
        options: [ALL_ACCESS, 'Hoy', 'Ayer', 'Con acceso registrado', 'Sin acceso reciente'].map(value => ({ value, label: value })),
        onChange: value => {
          setTenantLastAccessFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'TENANT_2FA',
        label: '2FA',
        value: tenantTwoFactorFilter,
        placeholder: ALL_TWO_FACTOR,
        options: [ALL_TWO_FACTOR, ...Array.from(new Set(tenantUsersRows.map(user => user.twoFactorStatus)))].map(value => ({ value, label: value })),
        onChange: value => {
          setTenantTwoFactorFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
    ],
    [
      handleTenantCompanyFilterChange,
      selectedTenantCompany,
      tenantBranchFilter,
      tenantBranchOptions,
      tenantCompanyFilter,
      tenantCompanyOptions,
      tenantLastAccessFilter,
      tenantRoleFilter,
      tenantStatusFilter,
      tenantTwoFactorFilter,
      tenantUsersRows,
    ],
  );

  const invitationFilterConfigs = useMemo<UsersFilterConfig[]>(
    () => [
      {
        id: 'INVITE_TYPE',
        label: 'Tipo',
        value: invitationTypeFilter,
        placeholder: ALL_TYPES,
        options: [ALL_TYPES, 'Equipo SaaS', 'Usuario de empresa'].map(value => ({ value, label: value === 'Equipo SaaS' ? 'Equipo interno' : value })),
        onChange: value => {
          setInvitationTypeFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'INVITE_STATUS',
        label: 'Estado',
        value: invitationStatusFilter,
        placeholder: ALL_STATUSES,
        options: [ALL_STATUSES, 'Pendiente', 'Aceptada', 'Expirada', 'Revocada'].map(value => ({ value, label: value })),
        onChange: value => {
          setInvitationStatusFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'INVITE_COMPANY',
        label: 'Empresa',
        value: invitationCompanyFilter,
        placeholder: ALL_COMPANIES,
        options: [ALL_COMPANIES, ...toSelectOptions(invitationRows.map(item => item.company)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setInvitationCompanyFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'INVITE_ROLE',
        label: 'Rol',
        value: invitationRoleFilter,
        placeholder: ALL_ROLES,
        options: [ALL_ROLES, ...toSelectOptions(invitationRows.map(item => item.role)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setInvitationRoleFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'INVITE_BY',
        label: 'Invitado por',
        value: invitationInvitedByFilter,
        placeholder: ALL_INVITERS,
        options: [ALL_INVITERS, ...toSelectOptions(invitationRows.map(item => item.invitedBy)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setInvitationInvitedByFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'INVITE_DATE',
        label: 'Fecha',
        value: invitationDateFilter,
        placeholder: ALL_DATES,
        options: [ALL_DATES, ...toSelectOptions(invitationRows.map(item => item.date)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setInvitationDateFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
    ],
    [
      invitationCompanyFilter,
      invitationDateFilter,
      invitationInvitedByFilter,
      invitationRoleFilter,
      invitationRows,
      invitationStatusFilter,
      invitationTypeFilter,
    ],
  );

  const sessionFilterConfigs = useMemo<UsersFilterConfig[]>(
    () => [
      {
        id: 'SESSION_TYPE',
        label: 'Tipo',
        value: sessionTypeFilter,
        placeholder: ALL_TYPES,
        options: [ALL_TYPES, ...toSelectOptions(sessionRows.map(item => item.type)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setSessionTypeFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'SESSION_COMPANY',
        label: 'Empresa',
        value: sessionCompanyFilter,
        placeholder: ALL_COMPANIES,
        options: [ALL_COMPANIES, ...toSelectOptions(sessionRows.map(item => item.company)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setSessionCompanyFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'SESSION_STATUS',
        label: 'Estado',
        value: sessionStatusFilter,
        placeholder: ALL_STATUSES,
        options: [ALL_STATUSES, ...toSelectOptions(sessionRows.map(item => item.status)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setSessionStatusFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'SESSION_DEVICE',
        label: 'Dispositivo',
        value: sessionDeviceFilter,
        placeholder: ALL_DEVICES,
        options: [ALL_DEVICES, ...toSelectOptions(sessionRows.map(item => item.deviceFamily)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setSessionDeviceFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'SESSION_BROWSER',
        label: 'Navegador',
        value: sessionBrowserFilter,
        placeholder: ALL_BROWSERS,
        options: [ALL_BROWSERS, ...toSelectOptions(sessionRows.map(item => item.browser)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setSessionBrowserFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'SESSION_IP',
        label: 'IP',
        value: sessionIpFilter,
        placeholder: ALL_IPS,
        options: [ALL_IPS, ...toSelectOptions(sessionRows.map(item => item.ip)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setSessionIpFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
      {
        id: 'SESSION_USER',
        label: 'Usuario',
        value: sessionUserFilter,
        placeholder: ALL_USERS,
        options: [ALL_USERS, ...toSelectOptions(sessionRows.map(item => item.user)).map(option => option.label)].map(value => ({ value, label: value })),
        onChange: value => {
          setSessionUserFilter(value);
          setActiveUsersFilterDropdown(null);
        },
      },
    ],
    [
      sessionBrowserFilter,
      sessionCompanyFilter,
      sessionDeviceFilter,
      sessionIpFilter,
      sessionRows,
      sessionStatusFilter,
      sessionTypeFilter,
      sessionUserFilter,
    ],
  );

  const tenantActiveFiltersCount = useMemo(
    () =>
      [
        usersSearchTerm,
        tenantCompanyFilter !== ALL_COMPANIES ? tenantCompanyFilter : '',
        tenantBranchFilter !== ALL_BRANCHES ? tenantBranchFilter : '',
        tenantRoleFilter !== ALL_ROLES ? tenantRoleFilter : '',
        tenantStatusFilter !== ALL_STATUSES ? tenantStatusFilter : '',
        tenantLastAccessFilter !== ALL_ACCESS ? tenantLastAccessFilter : '',
        tenantTwoFactorFilter !== ALL_TWO_FACTOR ? tenantTwoFactorFilter : '',
      ].filter(Boolean).length,
    [tenantBranchFilter, tenantCompanyFilter, tenantLastAccessFilter, tenantRoleFilter, tenantStatusFilter, tenantTwoFactorFilter, usersSearchTerm],
  );

  const invitationActiveFiltersCount = useMemo(
    () =>
      [
        invitationSearchTerm,
        invitationTypeFilter !== ALL_TYPES ? invitationTypeFilter : '',
        invitationStatusFilter !== ALL_STATUSES ? invitationStatusFilter : '',
        invitationCompanyFilter !== ALL_COMPANIES ? invitationCompanyFilter : '',
        invitationRoleFilter !== ALL_ROLES ? invitationRoleFilter : '',
        invitationInvitedByFilter !== ALL_INVITERS ? invitationInvitedByFilter : '',
        invitationDateFilter !== ALL_DATES ? invitationDateFilter : '',
      ].filter(Boolean).length,
    [invitationCompanyFilter, invitationDateFilter, invitationInvitedByFilter, invitationRoleFilter, invitationSearchTerm, invitationStatusFilter, invitationTypeFilter],
  );

  const sessionActiveFiltersCount = useMemo(
    () =>
      [
        sessionSearchTerm,
        sessionTypeFilter !== ALL_TYPES ? sessionTypeFilter : '',
        sessionCompanyFilter !== ALL_COMPANIES ? sessionCompanyFilter : '',
        sessionStatusFilter !== ALL_STATUSES ? sessionStatusFilter : '',
        sessionDeviceFilter !== ALL_DEVICES ? sessionDeviceFilter : '',
        sessionBrowserFilter !== ALL_BROWSERS ? sessionBrowserFilter : '',
        sessionIpFilter !== ALL_IPS ? sessionIpFilter : '',
        sessionUserFilter !== ALL_USERS ? sessionUserFilter : '',
      ].filter(Boolean).length,
    [sessionBrowserFilter, sessionCompanyFilter, sessionDeviceFilter, sessionIpFilter, sessionSearchTerm, sessionStatusFilter, sessionTypeFilter, sessionUserFilter],
  );

  const resetTenantUserFilters = useCallback(() => {
    setUsersSearchTerm('');
    setTenantCompanyFilter(ALL_COMPANIES);
    setTenantBranchFilter(ALL_BRANCHES);
    setTenantRoleFilter(ALL_ROLES);
    setTenantStatusFilter(ALL_STATUSES);
    setTenantLastAccessFilter(ALL_ACCESS);
    setTenantTwoFactorFilter(ALL_TWO_FACTOR);
    setActiveUsersFilterDropdown(null);
  }, []);

  const resetInvitationFilters = useCallback(() => {
    setInvitationSearchTerm('');
    setInvitationTypeFilter(ALL_TYPES);
    setInvitationStatusFilter(ALL_STATUSES);
    setInvitationCompanyFilter(ALL_COMPANIES);
    setInvitationRoleFilter(ALL_ROLES);
    setInvitationInvitedByFilter(ALL_INVITERS);
    setInvitationDateFilter(ALL_DATES);
    setActiveUsersFilterDropdown(null);
  }, []);

  const resetSessionFilters = useCallback(() => {
    setSessionSearchTerm('');
    setSessionTypeFilter(ALL_TYPES);
    setSessionCompanyFilter(ALL_COMPANIES);
    setSessionStatusFilter(ALL_STATUSES);
    setSessionDeviceFilter(ALL_DEVICES);
    setSessionBrowserFilter(ALL_BROWSERS);
    setSessionIpFilter(ALL_IPS);
    setSessionUserFilter(ALL_USERS);
    setActiveUsersFilterDropdown(null);
  }, []);

  useEffect(() => {
    setTenantUsersPage(1);
  }, [
    debouncedUsersSearchTerm,
    tenantBranchFilter,
    tenantCompanyFilter,
    tenantLastAccessFilter,
    tenantRoleFilter,
    tenantStatusFilter,
    tenantTwoFactorFilter,
    tenantUsersSort,
  ]);

  const handleTenantUsersSort = useCallback((key: TenantUserSortKey) => {
    setTenantUsersSort(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const canUseSupportAccess = currentUser?.permissions?.['saas.support.impersonate'] === true;

  const updateTenantUserRecord = useCallback(
    async (user: TenantUserRow, payload: Partial<User>, successMessage: string) => {
      setPlatformLoading({ active: true, label: 'Actualizando usuario' });
      try {
        try {
          const response = await apiClient.updateUser(user.id, payload);
          upsertUsersInLocalStorage([response.data]);
        } catch (error) {
          if (!(error instanceof ApiUnavailableError)) throw error;
          updateUserInLocalStorage(user.id, payload);
        }
        setGlobalUsers(getAllUsers());
        emitPlatformToast({
          title: 'Usuario actualizado',
          message: successMessage,
          tone: 'success',
          durationMs: 3600,
        });
      } catch (error) {
        emitPlatformToast({
          title: 'No se pudo actualizar el usuario',
          message: error instanceof Error ? error.message : 'La acción no pudo completarse.',
          tone: 'error',
          durationMs: 5200,
        });
      } finally {
        setPlatformLoading({ active: false });
      }
    },
    [],
  );

  const requestTenantUserCriticalAction = useCallback(
    (user: TenantUserRow, action: TenantUserActionKind) => {
      const companyBranches = tenantBranchesByCompany.get(user.companyId) || [];
      const roleFlow = [Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR];
      const nextRole = roleFlow[(roleFlow.indexOf(user.role) + 1) % roleFlow.length] || Role.COBRADOR;
      const nextBranch = companyBranches.length ?
         companyBranches[(Math.max(0, companyBranches.findIndex(branch => branch.id === user.branchId)) + 1) % companyBranches.length]
        : null;

      const actionConfig: Record<string, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void | Promise<void> }> = {
        'change-role': {
          title: 'Cambiar rol del usuario',
          description: `Se cambiará el rol de ${user.name} de ${user.role} a ${nextRole}. Esta acción queda trazable en auditoría del backend cuando la API está disponible.`,
          confirmLabel: `Cambiar a ${nextRole}`,
          tone: 'warning',
          onConfirm: () => updateTenantUserRecord(user, { role: nextRole }, `${user.name} ahora tiene rol ${nextRole}.`),
        },
        'change-branch': {
          title: 'Cambiar sucursal del usuario',
          description: nextBranch ?
             `Se moverá ${user.name} hacia ${nextBranch.name}. Valida que la sucursal pertenezca a ${user.companyName}.`
            : 'Esta empresa no tiene otra sucursal disponible para mover el usuario.',
          confirmLabel: nextBranch ? `Mover a ${nextBranch.name}` : 'Sin sucursal disponible',
          tone: 'warning',
          onConfirm: () => {
            if (!nextBranch) return;
            return updateTenantUserRecord(user, { branchId: nextBranch.id }, `${user.name} fue movido a ${nextBranch.name}.`);
          },
        },
        'reset-access': {
          title: 'Restablecer acceso',
          description: `Se marcará a ${user.name} para revalidar acceso en el próximo inicio. No se cambiará la clave de forma silenciosa.`,
          confirmLabel: 'Restablecer acceso',
          tone: 'warning',
          onConfirm: () => updateTenantUserRecord(user, { firstAccessRequired: true }, `${user.name} deberá completar validación de acceso.`),
        },
        'revoke-sessions': {
          title: 'Revocar sesiones',
          description: 'Aún no existe endpoint específico de revocación de sesiones. Se registrará la intención operativa y no se cerrará ninguna sesión de forma silenciosa.',
          confirmLabel: 'Registrar revisión',
          tone: 'danger',
          onConfirm: () => emitPlatformToast({ title: 'Revisión registrada', message: `Revocación de sesiones solicitada para ${user.name}.`, tone: 'warning', durationMs: 4200 }),
        },
        suspend: {
          title: 'Suspender usuario',
          description: `Suspender ${user.name} bloqueará su acceso a la empresa ${user.companyName}. Esta acción requiere confirmación explícita.`,
          confirmLabel: 'Suspender usuario',
          tone: 'danger',
          onConfirm: () => updateTenantUserRecord(user, { isActive: false }, `${user.name} fue suspendido.`),
        },
        reactivate: {
          title: 'Reactivar usuario',
          description: `Reactivar ${user.name} permitirá nuevamente su acceso a la empresa ${user.companyName}.`,
          confirmLabel: 'Reactivar usuario',
          tone: 'warning',
          onConfirm: () => updateTenantUserRecord(user, { isActive: true }, `${user.name} fue reactivado.`),
        },
        'support-access': {
          title: 'Acceder como soporte',
          description: 'Esta acción solo está disponible para usuarios con acceso de soporte y debe generar auditoría dedicada. No se ejecutará si el permiso no está presente.',
          confirmLabel: 'Validar permiso',
          tone: 'danger',
          onConfirm: () => emitPlatformToast({ title: 'Permiso requerido', message: 'El acceso como soporte requiere flujo backend dedicado de impersonacion auditada.', tone: 'warning', durationMs: 5200 }),
        },
      };

      const config = actionConfig[action];
      if (!config) return;

      openPlatformCriticalModal({
        id: `tenant-user-${action}`,
        title: config.title,
        description: config.description,
        tone: config.tone,
        confirmLabel: config.confirmLabel,
        cancelLabel: 'Cancelar',
        highlights: [
          { label: 'Usuario', value: user.name },
          { label: 'Empresa', value: user.companyName },
          { label: 'Rol actual', value: user.role },
        ],
        onConfirm: config.onConfirm,
      });
    },
    [tenantBranchesByCompany, updateTenantUserRecord],
  );

  const handleTenantUserAction = useCallback(
    (user: TenantUserRow, action: TenantUserActionKind) => {
      setActiveActionsDropdown(null);
      if (user.role === Role.SUPER_ADMIN || user.companyId === 'SYSTEM') {
        setTenantUsersPermissionError('La vista de usuarios de empresas no permite operar usuarios internos.');
        return;
      }
      if (action === 'view-profile' || action === 'activity' || action === 'audit') {
        setSelectedTenantUserId(user.id);
        setTenantUserDrawerOpen(true);
        return;
      }
      if (action === 'open-company') {
        const company = tenantCompanies.find(item => item.id === user.companyId);
        if (company) {
          setSelectedCompanyDetail(company);
          setDetailTab('RESUMEN');
          navigate('/master?section=companies');
        }
        return;
      }
      if (action === 'open-context') {
        emitPlatformToast({
          title: 'Contexto de empresa',
          message: `${user.name} pertenece a ${user.companyName}. El acceso contextual requiere flujo auditado dedicado.`,
          tone: 'info',
          durationMs: 4200,
        });
        return;
      }
      if (action === 'sessions') {
        setSessionUserFilter(user.name);
        navigate(usersTabPathMap.SESSIONS);
        return;
      }
      if (action === 'support-access' && !canUseSupportAccess) {
        emitPlatformToast({
          title: 'Acción no autorizada',
          message: 'Tu usuario no tiene permiso para acceso de soporte.',
          tone: 'warning',
          durationMs: 4200,
        });
        return;
      }
      requestTenantUserCriticalAction(user, action);
    },
    [canUseSupportAccess, navigate, requestTenantUserCriticalAction, tenantCompanies],
  );

  const updateSaasMember = useCallback((memberId: string, payload: Partial<SaasMember>) => {
    setSaasMemberOverrides(current => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        ...payload,
      },
    }));
  }, []);

  const handleSaasMemberAction = useCallback(
    (member: SaasMember, action: SaasMemberActionKind) => {
      setActiveActionsDropdown(null);
      const activeAdmins = saasTeamMembers.filter(item => item.status === 'Activo' && ['Owner SaaS', 'Super Admin'].includes(item.role));
      const isCurrentUser = member.email === currentUser?.email || member.id === 'saas-1';

      if (member.userScope !== 'SAAS' || member.companyId !== null) {
        emitPlatformToast({ title: 'Contexto bloqueado', message: 'Esta vista solo permite operar usuarios internos sin empresa asignada.', tone: 'error', durationMs: 4200 });
        return;
      }
      if (action === 'view-profile' || action === 'edit' || action === 'audit') {
        emitPlatformToast({
          title: action === 'audit' ? 'Auditoría localizada' : 'Perfil interno',
          message: `${member.name} pertenece al equipo interno y no tiene empresa asociada.`,
          tone: 'info',
          durationMs: 3800,
        });
        return;
      }
      if (action === 'configure-permissions') {
        if (isCurrentUser && member.criticalAccess) {
          emitPlatformToast({
            title: 'Permiso crítico protegido',
            message: 'No puedes eliminar tu propio permiso crítico desde esta vista.',
            tone: 'warning',
            durationMs: 4600,
          });
          return;
        }
        navigate(usersTabPathMap.ROLES);
        return;
      }
      if (action === 'change-role') {
        if (member.isOwner) {
          emitPlatformToast({ title: 'Propietario protegido', message: 'El propietario de plataforma no puede cambiarse de rol desde acciones rápidas.', tone: 'warning', durationMs: 4200 });
          return;
        }
        const currentIndex = Math.max(1, SAAS_ROLES.indexOf(member.role));
        const nextRole = SAAS_ROLES[(currentIndex + 1) % SAAS_ROLES.length] || 'Soporte';
        openPlatformCriticalModal({
          id: `saas-role-${member.id}`,
          title: 'Cambiar rol interno',
          description: `Se cambiará el rol de ${member.name} a ${getVisibleInternalRoleLabel(nextRole)}. No se mezclará con roles de empresa.`,
          tone: 'warning',
          confirmLabel: `Cambiar a ${getVisibleInternalRoleLabel(nextRole)}`,
          cancelLabel: 'Cancelar',
          highlights: [
            { label: 'Usuario', value: member.name },
            { label: 'Rol actual', value: getVisibleInternalRoleLabel(member.role) },
            { label: 'Contexto', value: 'Interno / sin empresa asignada' },
          ],
          onConfirm: () => {
            updateSaasMember(member.id, { role: nextRole });
            emitPlatformToast({ title: 'Rol actualizado', message: `${member.name} ahora tiene rol ${getVisibleInternalRoleLabel(nextRole)}.`, tone: 'success', durationMs: 3600 });
          },
        });
        return;
      }
      if (action === 'suspend') {
        if (member.isOwner) {
          emitPlatformToast({ title: 'Propietario protegido', message: 'Un Super Admin no puede suspender al propietario de plataforma.', tone: 'warning', durationMs: 4200 });
          return;
        }
        if (isCurrentUser) {
          emitPlatformToast({ title: 'Acción bloqueada', message: 'No puedes suspender tu propio usuario.', tone: 'warning', durationMs: 4200 });
          return;
        }
        if (activeAdmins.length <= 1 && ['Owner SaaS', 'Super Admin'].includes(member.role)) {
          emitPlatformToast({ title: 'Última cuenta administrativa', message: 'No se permite suspender la última cuenta administrativa válida.', tone: 'error', durationMs: 5200 });
          return;
        }
      }
      const actionConfig: Partial<Record<SaasMemberActionKind, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void }>> = {
        'force-password': {
          title: 'Forzar cambio de contraseña',
          description: `Se marcará a ${member.name} para rotar contraseña en el próximo acceso. No se cambiará de forma silenciosa.`,
          confirmLabel: 'Forzar cambio',
          tone: 'warning',
          onConfirm: () => emitPlatformToast({ title: 'Cambio requerido', message: `${member.name} deberá cambiar contraseña.`, tone: 'success', durationMs: 3600 }),
        },
        'force-2fa': {
          title: 'Forzar 2FA',
          description: `Se exigirá segundo factor a ${member.name} antes de continuar operando.`,
          confirmLabel: 'Forzar 2FA',
          tone: 'warning',
          onConfirm: () => {
            updateSaasMember(member.id, { twoFactor: true });
            emitPlatformToast({ title: '2FA requerido', message: `${member.name} tiene 2FA marcado como obligatorio.`, tone: 'success', durationMs: 3600 });
          },
        },
        'revoke-sessions': {
          title: 'Revocar sesiones',
          description: `Se registrará revocación de sesiones para ${member.name}. En backend real debe cerrarse por endpoint dedicado.`,
          confirmLabel: 'Revocar sesiones',
          tone: 'danger',
          onConfirm: () => {
            updateSaasMember(member.id, { sessions: 0, lastAccess: 'Sesiones revocadas' });
            emitPlatformToast({ title: 'Sesiones revocadas', message: `${member.name} quedó sin sesiones activas.`, tone: 'warning', durationMs: 4200 });
          },
        },
        suspend: {
          title: 'Suspender miembro interno',
          description: `Suspender ${member.name} bloqueará su acceso interno a ABUNDRA. Requiere confirmación explícita.`,
          confirmLabel: 'Suspender',
          tone: 'danger',
          onConfirm: () => {
            updateSaasMember(member.id, { status: 'Suspendido', sessions: 0 });
            emitPlatformToast({ title: 'Miembro suspendido', message: `${member.name} fue suspendido.`, tone: 'warning', durationMs: 4200 });
          },
        },
        reactivate: {
          title: 'Reactivar miembro interno',
          description: `Reactivar ${member.name} permitirá nuevamente su acceso interno.`,
          confirmLabel: 'Reactivar',
          tone: 'warning',
          onConfirm: () => {
            updateSaasMember(member.id, { status: 'Activo' });
            emitPlatformToast({ title: 'Miembro reactivado', message: `${member.name} vuelve a estar activo.`, tone: 'success', durationMs: 3600 });
          },
        },
      };

      const config = actionConfig[action];
      if (!config) return;
      openPlatformCriticalModal({
        id: `saas-${action}-${member.id}`,
        title: config.title,
        description: config.description,
        tone: config.tone,
        confirmLabel: config.confirmLabel,
        cancelLabel: 'Cancelar',
        highlights: [
          { label: 'Usuario', value: member.name },
          { label: 'Rol', value: member.role },
          { label: 'Scope', value: 'SAAS' },
        ],
        onConfirm: config.onConfirm,
      });
    },
    [currentUser?.email, navigate, saasTeamMembers, updateSaasMember],
  );

  const updateInvitation = useCallback((invitationId: string, payload: Partial<InvitationRow>) => {
    setInvitationOverrides(current => ({
      ...current,
      [invitationId]: {
        ...current[invitationId],
        ...payload,
      },
    }));
  }, []);

  const handleInvitationAction = useCallback(
    (invitation: InvitationRow, action: InvitationActionKind) => {
      setActiveActionsDropdown(null);
      const isSaasInvite = invitation.type === 'Equipo SaaS';
      const tenantCompany = invitation.companyId ? tenantCompanies.find(company => company.id === invitation.companyId) : null;
      const tenantBranches = invitation.companyId ? tenantBranchesByCompany.get(invitation.companyId) || [] : [];

      if (isSaasInvite && invitation.companyId !== null) {
        emitPlatformToast({ title: 'Contexto inválido', message: 'Una invitación interna no puede tener empresa asignada.', tone: 'error', durationMs: 4400 });
        return;
      }
      if (!isSaasInvite && !invitation.companyId) {
        emitPlatformToast({ title: 'Empresa requerida', message: 'Una invitación de empresa requiere una empresa obligatoria.', tone: 'error', durationMs: 4400 });
        return;
      }
      if (!isSaasInvite && invitation.branchId && !tenantBranches.some(branch => branch.id === invitation.branchId)) {
        emitPlatformToast({ title: 'Sucursal inválida', message: 'La sucursal debe pertenecer a la empresa seleccionada.', tone: 'error', durationMs: 4400 });
        return;
      }
      if (action === 'copy-link') {
        const link = `${window.location.origin}/#/invitacion/${invitation.token}`;
        navigator.clipboard.writeText(link).catch(() => undefined);
        emitPlatformToast({ title: 'Enlace copiado', message: `Token de un solo uso preparado para ${invitation.email}.`, tone: 'success', durationMs: 3600 });
        return;
      }
      if (action === 'open-user') {
        const tenantUser = tenantUsersRows.find(user => user.email === invitation.email || user.id === invitation.acceptedUserId);
        if (tenantUser) {
          setSelectedTenantUserId(tenantUser.id);
          setTenantUserDrawerOpen(true);
        } else {
          emitPlatformToast({ title: 'Usuario no creado', message: 'Esta invitación aún no tiene una cuenta activa asociada.', tone: 'info', durationMs: 3800 });
        }
        return;
      }
      if (action === 'change-company') {
        if (isSaasInvite) {
          emitPlatformToast({ title: 'No aplica', message: 'El equipo interno no puede moverse a empresa.', tone: 'warning', durationMs: 3600 });
          return;
        }
        const currentIndex = Math.max(0, tenantCompanies.findIndex(company => company.id === invitation.companyId));
        const nextCompany = tenantCompanies[(currentIndex + 1) % Math.max(tenantCompanies.length, 1)];
        const nextBranch = nextCompany ? tenantBranchesByCompany.get(nextCompany.id)?.[0] : null;
        if (!nextCompany) return;
        updateInvitation(invitation.id, {
          company: nextCompany.name,
          companyId: nextCompany.id,
          branch: nextBranch.name || 'Sin sucursal',
          branchId: nextBranch.id || null,
        });
        emitPlatformToast({ title: 'Empresa actualizada', message: `${invitation.email} fue movido a ${nextCompany.name}.`, tone: 'success', durationMs: 3600 });
        return;
      }
      if (action === 'change-branch') {
        if (isSaasInvite) {
          emitPlatformToast({ title: 'No aplica', message: 'Una invitación interna no usa sucursal.', tone: 'warning', durationMs: 3600 });
          return;
        }
        const currentIndex = Math.max(0, tenantBranches.findIndex(branch => branch.id === invitation.branchId));
        const nextBranch = tenantBranches[(currentIndex + 1) % Math.max(tenantBranches.length, 1)];
        if (!nextBranch) {
          emitPlatformToast({ title: 'Sin sucursales', message: `${tenantCompany.name || invitation.company} no tiene sucursales disponibles.`, tone: 'warning', durationMs: 3600 });
          return;
        }
        updateInvitation(invitation.id, { branch: nextBranch.name, branchId: nextBranch.id });
        emitPlatformToast({ title: 'Sucursal actualizada', message: `${invitation.email} fue movido a ${nextBranch.name}.`, tone: 'success', durationMs: 3600 });
        return;
      }
      if (action === 'edit-role') {
        const roleList = isSaasInvite ? SAAS_ROLES : TENANT_INVITATION_ROLES;
        const currentIndex = Math.max(0, roleList.indexOf(invitation.role as never));
        const nextRole = roleList[(currentIndex + 1) % roleList.length];
        updateInvitation(invitation.id, { role: nextRole });
        emitPlatformToast({ title: 'Rol actualizado', message: `${invitation.email} ahora ser invitado como ${nextRole}.`, tone: 'success', durationMs: 3600 });
        return;
      }
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextDate = nextWeek.toLocaleDateString('es-DO');
      const token = `inv-${invitation.id}-${Date.now()}`;
      const actionConfig: Partial<Record<InvitationActionKind, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void }>> = {
        resend: {
          title: 'Reenviar invitación',
          description: invitation.status === 'Revocada' ? 'Una invitación revocada no puede aceptarse. Renueva primero el token.' : `Se reenviará el token de un solo uso a ${invitation.email}.`,
          confirmLabel: invitation.status === 'Revocada' ? 'No reenviar' : 'Reenviar',
          tone: 'warning',
          onConfirm: () => {
            if (invitation.status === 'Revocada') return;
            updateInvitation(invitation.id, { date: new Date().toLocaleDateString('es-DO'), status: 'Pendiente' });
            emitPlatformToast({ title: 'Invitación reenviada', message: `${invitation.email} recibió un nuevo aviso.`, tone: 'success', durationMs: 3600 });
          },
        },
        'extend-expiration': {
          title: 'Extender expiración',
          description: 'La expiración es obligatoria. Se ampliará 7 días y se mantendrá el mismo contexto.',
          confirmLabel: 'Extender 7 días',
          tone: 'warning',
          onConfirm: () => {
            updateInvitation(invitation.id, { expiresAt: nextDate, status: invitation.status === 'Expirada' ? 'Pendiente' : invitation.status });
            emitPlatformToast({ title: 'Expiración extendida', message: `${invitation.email} vence ahora el ${nextDate}.`, tone: 'success', durationMs: 3600 });
          },
        },
        revoke: {
          title: 'Revocar invitación',
          description: 'Una invitación revocada no podrá aceptarse. Esta acción debe quedar registrada en auditoría.',
          confirmLabel: 'Revocar',
          tone: 'danger',
          onConfirm: () => {
            updateInvitation(invitation.id, { status: 'Revocada' });
            emitPlatformToast({ title: 'Invitación revocada', message: `${invitation.email} ya no puede aceptar este acceso.`, tone: 'warning', durationMs: 4200 });
          },
        },
        renew: {
          title: 'Renovar invitación',
          description: 'Se generará un nuevo token de un solo uso y una expiración obligatoria.',
          confirmLabel: 'Renovar',
          tone: 'warning',
          onConfirm: () => {
            updateInvitation(invitation.id, { token, expiresAt: nextDate, status: 'Pendiente', date: new Date().toLocaleDateString('es-DO') });
            emitPlatformToast({ title: 'Invitación renovada', message: `${invitation.email} tiene token nuevo de un solo uso.`, tone: 'success', durationMs: 3600 });
          },
        },
      };

      const config = actionConfig[action];
      if (!config) return;
      openPlatformCriticalModal({
        id: `invite-${action}-${invitation.id}`,
        title: config.title,
        description: config.description,
        tone: config.tone,
        confirmLabel: config.confirmLabel,
        cancelLabel: 'Cancelar',
        highlights: [
          { label: 'Correo', value: invitation.email },
          { label: 'Tipo', value: getVisibleInvitationTypeLabel(invitation.type) },
          { label: 'Expira', value: invitation.expiresAt },
        ],
        onConfirm: config.onConfirm,
      });
    },
    [tenantBranchesByCompany, tenantCompanies, tenantUsersRows, updateInvitation],
  );

  const handleCreateSaasMemberInvitation = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = saasMemberForm.name.trim();
      const email = saasMemberForm.email.trim().toLowerCase();
      const phone = saasMemberForm.phone.trim();
      const expiresAt = saasMemberForm.expiresAt;

      if (!name || !email || !expiresAt) {
        emitPlatformToast({ title: 'Campos requeridos', message: 'Nombre, correo y expiración son obligatorios.', tone: 'warning', durationMs: 4200 });
        return;
      }
      if (!SAAS_ROLES.includes(saasMemberForm.role)) {
        emitPlatformToast({ title: 'Rol inválido', message: 'No se puede mezclar un rol interno con un rol de empresa.', tone: 'error', durationMs: 4200 });
        return;
      }
      const duplicate = saasTeamMembers.some(member => member.email.toLowerCase() === email && member.status !== 'Suspendido');
      if (duplicate) {
        emitPlatformToast({ title: 'Cuenta duplicada', message: 'Ya existe una cuenta activa o pendiente con ese correo en el equipo interno.', tone: 'error', durationMs: 4600 });
        return;
      }
      const id = `saas-created-${Date.now()}`;
      const token = `inv-saas-${Date.now()}`;
      const createdAt = new Date().toLocaleDateString('es-DO');
      setCreatedSaasMembers(current => [
        ...current,
        {
          id,
          userScope: 'SAAS',
          companyId: null,
          name,
          email,
          phone: phone || 'Sin teléfono',
          role: saasMemberForm.role,
          area: 'Pendiente de asignación',
          status: 'Pendiente',
          lastAccess: 'Invitación pendiente',
          twoFactor: saasMemberForm.requireTwoFactor,
          criticalAccess: ['Owner SaaS', 'Super Admin'].includes(saasMemberForm.role),
          sessions: 0,
          createdAt,
          permissions: [],
        },
      ]);
      setCreatedInvitations(current => [
        ...current,
        {
          id: `invite-${id}`,
          email,
          type: 'Equipo SaaS',
          company: 'ABUNDRA',
          companyId: null,
          branch: 'Sin sucursal',
          branchId: null,
          role: saasMemberForm.role,
          invitedBy: currentUser?.name || 'Nexus Master',
          date: createdAt,
          expiresAt: new Date(expiresAt).toLocaleDateString('es-DO'),
          status: 'Pendiente',
          token,
        },
      ]);
      setIsSaasMemberModalOpen(false);
      setSaasMemberForm({ name: '', email: '', phone: '', role: 'Soporte', requireTwoFactor: true, expiresAt: '', message: '' });
      emitPlatformToast({ title: 'Invitación creada', message: `${name} fue agregado como miembro interno pendiente. Token de un solo uso generado.`, tone: 'success', durationMs: 4600 });
    },
    [currentUser?.name, saasMemberForm, saasTeamMembers],
  );

  const handleCreateTenantInvitation = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const email = tenantInvitationForm.email.trim().toLowerCase();
      const company = tenantCompanies.find(item => item.id === tenantInvitationForm.companyId);
      const branch = company ? (tenantBranchesByCompany.get(company.id) || []).find(item => item.id === tenantInvitationForm.branchId) : null;

      if (!email || !company || !tenantInvitationForm.expiresAt) {
        emitPlatformToast({
          title: 'Campos requeridos',
          message: 'Correo, empresa y expiración son obligatorios para invitar un usuario de empresa.',
          tone: 'warning',
          durationMs: 4200,
        });
        return;
      }
      const duplicatedUser = tenantUsersRows.some(user => user.email.toLowerCase() === email && user.companyId === company.id && user.isActive);
      const duplicatedInvitation = invitationRows.some(invitation =>
        invitation.email.toLowerCase() === email &&
        invitation.companyId === company.id &&
        invitation.status === 'Pendiente'
      );

      if (duplicatedUser || duplicatedInvitation) {
        emitPlatformToast({
          title: 'Acceso duplicado',
          message: 'Ya existe un usuario activo o una invitación pendiente para ese correo en la empresa seleccionada.',
          tone: 'error',
          durationMs: 4600,
        });
        return;
      }
      const createdAt = new Date().toLocaleDateString('es-DO');
      const id = `tenant-invite-${Date.now()}`;
      setCreatedInvitations(current => [
        ...current,
        {
          id,
          email,
          type: 'Usuario de empresa',
          company: company.name,
          companyId: company.id,
          branch: branch.name || 'Sin sucursal',
          branchId: branch.id || null,
          role: tenantInvitationForm.role,
          invitedBy: currentUser?.name || 'Nexus Master',
          date: createdAt,
          expiresAt: new Date(tenantInvitationForm.expiresAt).toLocaleDateString('es-DO'),
          status: 'Pendiente',
          token: `inv-tenant-${Date.now()}`,
        },
      ]);
      setIsTenantInvitationModalOpen(false);
      setTenantInvitationForm({ email: '', companyId: '', branchId: '', role: Role.COBRADOR, expiresAt: '' });
      emitPlatformToast({
        title: 'Invitación de empresa creada',
        message: `${email} quedó invitado a ${company.name}.`,
        tone: 'success',
        durationMs: 4200,
      });
      navigate(usersTabPathMap.INVITATIONS);
    },
    [currentUser?.name, invitationRows, navigate, tenantBranchesByCompany, tenantCompanies, tenantInvitationForm, tenantUsersRows],
  );

  const handleRoleAction = useCallback((roleName: string, context: RoleContext, action: RoleActionKind) => {
    setActiveActionsDropdown(null);
    const criticalCopy = 'Toda modificación crítica requiere advertencia, confirmación, auditoría, validación backend y 2FA cuando corresponda.';

    if (action === 'history' || action === 'compare') {
      emitPlatformToast({
        title: action === 'history' ? 'Historial de rol' : 'Comparación de rol',
        message: `${roleName} (contexto ${getVisibleRoleContextLabel(context)}) listo para revisión. ${criticalCopy}`,
        tone: 'info',
        durationMs: 4600,
      });
      return;
    }
    const labels: Record<RoleActionKind, string> = {
      create: 'Crear rol',
      edit: 'Editar rol',
      duplicate: 'Duplicar rol',
      'assign-users': 'Asignar usuarios',
      compare: 'Comparar',
      archive: 'Archivar rol',
      restore: 'Restaurar rol',
      history: 'Ver historial',
    };
    const isCritical = ['edit', 'archive', 'restore', 'assign-users'].includes(action);

    openPlatformCriticalModal({
      id: `role-${context}-${action}-${roleName}`,
      title: labels[action],
      description: `${labels[action]} sobre ${roleName} (contexto ${getVisibleRoleContextLabel(context)}). ${criticalCopy} Esta UI no inventa endpoint: deja la intención lista para conectarse al backend de permisos.`,
      tone: isCritical ? 'danger' : 'warning',
      confirmLabel: labels[action],
      cancelLabel: 'Cancelar',
      highlights: [
        { label: 'Rol', value: roleName },
        { label: 'Contexto', value: getVisibleRoleContextLabel(context) },
        { label: '2FA', value: isCritical ? 'Requerido si backend lo exige' : 'No requerido' },
      ],
      onConfirm: () => emitPlatformToast({
        title: 'Acción registrada',
        message: `${labels[action]} solicitado para ${roleName}. Pendiente validación backend y auditoría real.`,
        tone: 'success',
        durationMs: 4200,
      }),
    });
  }, []);

  const updateSession = useCallback((sessionId: string, payload: Partial<{ status: SessionStatus; activity: string; blockedIp: boolean }>) => {
    setSessionOverrides(current => ({
      ...current,
      [sessionId]: {
        ...current[sessionId],
        ...payload,
      },
    }));
  }, []);

  const handleSessionAction = useCallback(
    (session: (typeof sessionRows)[number], action: SessionActionKind) => {
      setActiveActionsDropdown(null);

      if (action === 'view-detail' || action === 'activity') {
        setSelectedSession(session);
        setSessionDrawerOpen(true);
        return;
      }
      const actionConfig: Record<Exclude<SessionActionKind, 'view-detail' | 'activity'>, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void }> = {
        'mark-suspicious': {
          title: 'Marcar sesión como sospechosa',
          description: `Se marcará la sesión de ${session.user} para revisión de seguridad.`,
          confirmLabel: 'Marcar sospechosa',
          tone: 'warning',
          onConfirm: () => updateSession(session.id, { status: 'Sospechosa', activity: 'Marcada para revisión' }),
        },
        revoke: {
          title: 'Revocar sesión',
          description: `Se revocará únicamente esta sesión de ${session.user}. Debe registrarse auditoría backend.`,
          confirmLabel: 'Revocar sesión',
          tone: 'danger',
          onConfirm: () => updateSession(session.id, { status: 'Revocada', activity: 'Revocada ahora' }),
        },
        'revoke-all': {
          title: 'Revocar todas las sesiones',
          description: `Se revocarán todas las sesiones visibles de ${session.user}.`,
          confirmLabel: 'Revocar todas',
          tone: 'danger',
          onConfirm: () => {
            sessionRows.filter(item => item.user === session.user).forEach(item => updateSession(item.id, { status: 'Revocada', activity: 'Revocada por lote' }));
          },
        },
        'revoke-all-except-current': {
          title: 'Revocar todas excepto actual',
          description: `Se conservará la sesión actual y se revocarán las demás sesiones de ${session.user}.`,
          confirmLabel: 'Revocar excepto actual',
          tone: 'danger',
          onConfirm: () => {
            sessionRows.filter(item => item.user === session.user && item.id !== 'session-1').forEach(item => updateSession(item.id, { status: 'Revocada', activity: 'Revocada por política' }));
          },
        },
        'block-ip': {
          title: 'Bloquear IP',
          description: `Se marcará ${session.ip} como IP bloqueada en la política local de seguridad.`,
          confirmLabel: 'Bloquear IP',
          tone: 'danger',
          onConfirm: () => {
            updateSession(session.id, { status: 'Sospechosa', blockedIp: true });
            setSessionPolicy(current => ({ ...current, blockedIps: [current.blockedIps, session.ip].filter(Boolean).join(', ') }));
          },
        },
        'force-password': {
          title: 'Forzar contraseña',
          description: `Se solicitará rotación de contraseña para ${session.user}.`,
          confirmLabel: 'Forzar contraseña',
          tone: 'warning',
          onConfirm: () => emitPlatformToast({ title: 'Rotación solicitada', message: `${session.user} deberá cambiar contraseña.`, tone: 'success', durationMs: 3600 }),
        },
        'suspend-user': {
          title: 'Suspender usuario',
          description: `Suspender ${session.user} requiere validación backend y no se hará de forma silenciosa.`,
          confirmLabel: 'Solicitar suspensión',
          tone: 'danger',
          onConfirm: () => emitPlatformToast({ title: 'Suspensión solicitada', message: `${session.user} quedó pendiente de validación backend.`, tone: 'warning', durationMs: 4200 }),
        },
      };

      const config = actionConfig[action];
      openPlatformCriticalModal({
        id: `session-${action}-${session.id}`,
        title: config.title,
        description: config.description,
        tone: config.tone,
        confirmLabel: config.confirmLabel,
        cancelLabel: 'Cancelar',
        highlights: [
          { label: 'Usuario', value: session.user },
          { label: 'IP', value: session.ip },
          { label: 'Estado', value: session.status },
        ],
        onConfirm: () => {
          config.onConfirm();
          emitPlatformToast({ title: 'Acción de sesión registrada', message: `${config.confirmLabel} aplicado a ${session.user}.`, tone: 'success', durationMs: 3600 });
        },
      });
    },
    [sessionRows, updateSession],
  );

  const handleSaveSessionPolicy = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSessionPolicyModalOpen(false);
    emitPlatformToast({
      title: 'Políticas endurecidas',
      message: 'La configuración de sesiones quedó preparada para validación backend y auditoría.',
      tone: 'success',
      durationMs: 4200,
    });
  }, []);

  const tenantInvitationCompany = useMemo(
    () => tenantCompanies.find(company => company.id === tenantInvitationForm.companyId) || null,
    [tenantCompanies, tenantInvitationForm.companyId],
  );

  const tenantInvitationBranches = useMemo(
    () => tenantInvitationCompany ? tenantBranchesByCompany.get(tenantInvitationCompany.id) || [] : [],
    [tenantBranchesByCompany, tenantInvitationCompany],
  );

  const billingRows = useMemo(() => {
    return tenantCompanies.map(company => {
      const plan = plans.find(item => item.id === company.planId);
      const paid = company.status === 'ACTIVE';
      return {
        id: company.id,
        companyName: company.name,
        planName: plan.name || 'Sin plan',
        cycle: company.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual',
        amount: company.subscriptionPrice,
        status: paid ? 'Pagada' : company.status === 'TRIAL' ? 'Pendiente' : 'En mora',
        dueDate: company.expiresAt,
      };
    });
  }, [plans, tenantCompanies]);

  const filteredBillingRows = useMemo(() => {
    const query = billingSearchTerm.trim().toLowerCase();
    return billingRows.filter(row => {
      const matchesQuery =
        !query || [row.companyName, row.planName, row.cycle, row.status].some(value => value.toLowerCase().includes(query));
      const matchesStatus = billingStatusFilter === 'Todos' || row.status === billingStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [billingRows, billingSearchTerm, billingStatusFilter]);

  const reportRows = useMemo(() => {
    const activeCompanies = tenantCompanies.filter(company => company.status === 'ACTIVE').length;
    const trialCompanies = tenantCompanies.filter(company => company.status === 'TRIAL').length;
    const suspendedCompanies = tenantCompanies.filter(company => company.status === 'SUSPENDED').length;

    return [
      {
        title: 'Reporte de ingresos globales',
        detail: `MRR estimado ${formatCurrency(metrics.mrr)} con ${activeCompanies} empresas activas.`,
        badge: 'Financiero',
      },
      {
        title: 'Reporte de adopción de la plataforma',
        detail: `${companyUsers.length} usuarios globales operando en ${tenantCompanies.length} empresas.`,
        badge: 'Operativo',
      },
      {
        title: 'Reporte de riesgo de cartera global',
        detail: `${trialCompanies} empresas en prueba y ${suspendedCompanies} suspendidas para seguimiento comercial.`,
        badge: 'Riesgo',
      },
    ];
  }, [companyUsers.length, metrics.mrr, tenantCompanies, tenantCompanies.length]);

  const helpRows = useMemo(
    () => [
      { title: 'Guías de onboarding', detail: 'Documentación para alta de empresas, usuarios globales y activación inicial.', tag: 'Base de conocimiento' },
      { title: 'Tickets prioritarios', detail: `${Math.max(1, tenantCompanies.length)} conversaciones listas para seguimiento de soporte de plataforma.`, tag: 'Soporte' },
      { title: 'Tutoriales del panel', detail: 'Recorridos para facturación, auditoría, planes y configuración global.', tag: 'Tutoriales' },
    ],
    [tenantCompanies.length],
  );

  const roleCounts = useMemo(() => {
    const admins = companyUsers.filter(user => user.role === Role.ADMIN).length;
    const supervisors = companyUsers.filter(user => user.role === Role.SUPERVISOR).length;
    const collectors = companyUsers.filter(user => user.role === Role.COBRADOR).length;
    return { admins, supervisors, collectors };
  }, [companyUsers]);

  const tenantUsersInFocus = useMemo(
    () => [
      { label: 'Suspendidos', detail: `${tenantUsersRows.filter(user => user.status === 'Suspendido').length} usuarios requieren revisión`, tone: 'danger' as const },
      { label: 'Sin acceso reciente', detail: `${tenantUsersRows.filter(user => user.lastAccess === 'Sin acceso reciente').length} usuarios sin actividad`, tone: 'warning' as const },
      { label: 'Sin sucursal asignada', detail: `${tenantUsersRows.filter(user => user.branchName === 'Sin sucursal').length} usuarios por ubicar`, tone: 'neutral' as const },
      { label: 'Admins sin 2FA', detail: '2 administradores críticos por endurecer', tone: 'danger' as const },
      { label: 'Invitaciones pendientes', detail: `${invitationRows.filter(item => item.status === 'Pendiente').length} accesos por completar`, tone: 'blue' as const },
    ],
    [invitationRows, tenantUsersRows],
  );

  const tenantRecentAccesses = useMemo(
    () => filteredTenantUsers.slice(0, 4).map((user, index) => ({
      id: `${user.id}-${index}`,
      user: user.name,
      company: user.companyName,
      time: user.lastAccess,
      channel: index % 2 === 0 ? 'Web / Chrome' : 'Android App',
    })),
    [filteredTenantUsers],
  );

  const usersSecuritySummary = useMemo(
    () => [
      { label: 'Admins sin 2FA', value: '2', tone: 'danger' as const },
      { label: 'Sesiones sospechosas', value: `${sessionRows.filter(session => session.status === 'Sospechosa').length}`, tone: 'warning' as const },
      { label: 'Usuarios suspendidos', value: `${tenantUsersRows.filter(user => user.status === 'Suspendido').length}`, tone: 'danger' as const },
      { label: 'Accesos críticos', value: `${saasTeamMembers.filter(member => member.criticalAccess).length}`, tone: 'blue' as const },
    ],
    [saasTeamMembers, sessionRows, tenantUsersRows],
  );

  const invitationSideCards = useMemo(
    () => ({
      expiring: invitationRows.filter(item => item.status === 'Pendiente').slice(0, 3),
      accepted: invitationRows.filter(item => item.status === 'Aceptada').slice(0, 3),
    }),
    [invitationRows],
  );

  const rolesSummary = useMemo(
    () => ({
      saasRoles: roleCards.saas.length,
      tenantRoles: roleCards.tenant.length,
      criticalPermissions: roleCards.saas.reduce((acc, role) => acc + role.permissions.length, 0),
      lastUpdate: 'Hoy, 09:40',
    }),
    [roleCards.saas, roleCards.tenant],
  );

  const sessionSideSummary = useMemo(
    () => ({
      suspicious: filteredSessionRows.filter(session => session.status === 'Sospechosa').slice(0, 3),
      revocations: [
        { user: 'Mario Acosta', detail: 'Sesión revocada hace 18 min' },
        { user: 'Admin PrestaFácil', detail: 'Cambio de contraseña forzado hace 45 min' },
      ],
    }),
    [filteredSessionRows],
  );

  const usersKpiState = useMemo(
    () => ({
      isLoading: !currentUser,
      error: !Array.isArray(globalUsers) || !Array.isArray(companies) ? 'No se pudo leer la fuente de usuarios.' : undefined,
    }),
    [companies, currentUser, globalUsers],
  );

  const saasTeamKpis = useMemo<PlatformKpiItem[]>(() => {
    const activeMembers = saasTeamMembers.filter(member => member.status === 'Activo').length;
    const pendingInvitations = invitationRows.filter(item => item.type === 'Equipo SaaS' && item.status === 'Pendiente').length;
    const twoFactorMembers = saasTeamMembers.filter(member => member.twoFactor).length;
    const suspendedMembers = saasTeamMembers.filter(member => member.status === 'Suspendido').length;

    return [
      {
        label: 'Miembros internos',
        value: `${saasTeamMembers.length}`,
        helper: 'Equipo con acceso administrativo.',
        trend: '+1 mes',
        secondaryLabel: 'Alcance',
        secondaryValue: 'Interno',
        tone: 'blue',
        icon: Users,
      },
      {
        label: 'Activos',
        value: `${activeMembers}`,
        helper: 'Miembros operando sin bloqueo.',
        trend: `${Math.round((activeMembers / Math.max(saasTeamMembers.length, 1)) * 100)}%`,
        secondaryLabel: 'Disponibilidad',
        secondaryValue: 'Actual',
        tone: 'emerald',
        icon: CheckCircle2,
      },
      {
        label: 'Invitaciones pendientes',
        value: `${pendingInvitations}`,
        helper: 'Accesos internos por completar.',
        trend: pendingInvitations > 0 ? 'Pendiente' : 'Al día',
        trendDirection: pendingInvitations > 0 ? 'down' : 'neutral',
        secondaryLabel: 'Flujo',
        secondaryValue: 'Onboarding',
        tone: 'amber',
        icon: Bell,
      },
      {
        label: 'Con 2FA',
        value: `${twoFactorMembers}`,
        helper: 'Cuentas protegidas con segundo factor.',
        trend: `${Math.round((twoFactorMembers / Math.max(saasTeamMembers.length, 1)) * 100)}%`,
        secondaryLabel: 'Seguridad',
        secondaryValue: '2FA',
        tone: 'violet',
        icon: ShieldCheck,
      },
      {
        label: 'Suspendidos',
        value: `${suspendedMembers}`,
        helper: 'Miembros internos sin acceso activo.',
        trend: suspendedMembers > 0 ? 'Revisar' : '0 riesgo',
        trendDirection: suspendedMembers > 0 ? 'down' : 'neutral',
        secondaryLabel: 'Riesgo',
        secondaryValue: 'Control',
        tone: suspendedMembers > 0 ? 'rose' : 'slate',
        icon: ShieldAlert,
      },
    ];
  }, [invitationRows, saasTeamMembers]);

  const tenantUserKpis = useMemo<PlatformKpiItem[]>(() => {
    const activeUsers = tenantUsersRows.filter(user => user.status === 'Activo').length;
    const suspendedUsers = tenantUsersRows.filter(user => user.status === 'Suspendido').length;

    return [
      {
        label: 'Usuarios registrados',
        value: `${tenantUsersRows.length}`,
        helper: 'Usuarios creados dentro de empresas.',
        trend: '+12 mes',
        secondaryLabel: 'Directorio',
        secondaryValue: 'Global',
        tone: 'blue',
        icon: Users,
      },
      {
        label: 'Usuarios activos',
        value: `${activeUsers}`,
        helper: 'Usuarios con acceso operativo.',
        trend: `${Math.round((activeUsers / Math.max(tenantUsersRows.length, 1)) * 100)}%`,
        secondaryLabel: 'Actividad',
        secondaryValue: 'Actual',
        tone: 'emerald',
        icon: CheckCircle2,
      },
      {
        label: 'Admins Empresa',
        value: `${tenantUsersRows.filter(user => user.role === Role.ADMIN).length}`,
        helper: 'Responsables principales por empresa.',
        trend: 'Crítico',
        secondaryLabel: 'Rol',
        secondaryValue: 'Empresa',
        tone: 'violet',
        icon: UserCog,
      },
      {
        label: 'Supervisores',
        value: `${tenantUsersRows.filter(user => user.role === Role.SUPERVISOR).length}`,
        helper: 'Supervisión de equipos y sucursales.',
        trend: 'Operativo',
        trendDirection: 'neutral',
        secondaryLabel: 'Rol',
        secondaryValue: 'Control',
        tone: 'slate',
        icon: ShieldCheck,
      },
      {
        label: 'Cobradores',
        value: `${tenantUsersRows.filter(user => user.role === Role.COBRADOR).length}`,
        helper: 'Usuarios ligados a operación de cobro.',
        trend: '+8',
        secondaryLabel: 'Rol',
        secondaryValue: 'Campo',
        tone: 'amber',
        icon: UserIcon,
      },
      {
        label: 'Suspendidos',
        value: `${suspendedUsers}`,
        helper: 'Accesos de empresas detenidos o en revisión.',
        trend: suspendedUsers > 0 ? 'Revisar' : '0 riesgo',
        trendDirection: suspendedUsers > 0 ? 'down' : 'neutral',
        secondaryLabel: 'Riesgo',
        secondaryValue: 'Acceso',
        tone: suspendedUsers > 0 ? 'rose' : 'slate',
        icon: ShieldAlert,
      },
    ];
  }, [tenantUsersRows]);

  const invitationKpis = useMemo<PlatformKpiItem[]>(
    () => [
      {
        label: 'Pendientes',
        value: `${invitationRows.filter(item => item.status === 'Pendiente').length}`,
        helper: 'Invitaciones esperando aceptación.',
        trend: 'Seguimiento',
        trendDirection: 'down',
        secondaryLabel: 'Estado',
        secondaryValue: 'Abiertas',
        tone: 'amber',
        icon: Bell,
      },
      {
        label: 'Aceptadas',
        value: `${invitationRows.filter(item => item.status === 'Aceptada').length}`,
        helper: 'Accesos completados correctamente.',
        trend: 'OK',
        trendDirection: 'neutral',
        secondaryLabel: 'Conversión',
        secondaryValue: 'Activa',
        tone: 'emerald',
        icon: CheckCircle2,
      },
      {
        label: 'Expiradas',
        value: `${invitationRows.filter(item => item.status === 'Expirada').length}`,
        helper: 'Invitaciones fuera de ventana.',
        trend: 'Reenviar',
        trendDirection: 'down',
        secondaryLabel: 'Atención',
        secondaryValue: 'Soporte',
        tone: 'slate',
        icon: Clock3,
      },
      {
        label: 'Revocadas',
        value: `${invitationRows.filter(item => item.status === 'Revocada').length}`,
        helper: 'Accesos cancelados por seguridad.',
        trend: 'Auditable',
        trendDirection: 'neutral',
        secondaryLabel: 'Control',
        secondaryValue: 'Seguro',
        tone: 'violet',
        icon: ShieldAlert,
      },
    ],
    [invitationRows],
  );

  const rolePermissionKpis = useMemo<PlatformKpiItem[]>(
    () => [
      {
        label: 'Roles internos',
        value: `${rolesSummary.saasRoles}`,
        helper: 'Roles internos para ABUNDRA.',
        trend: 'Global',
        trendDirection: 'neutral',
        secondaryLabel: 'Contexto',
        secondaryValue: 'Interno',
        tone: 'blue',
        icon: Crown,
      },
      {
        label: 'Roles de empresas',
        value: `${rolesSummary.tenantRoles}`,
        helper: 'Roles asignables dentro de empresas.',
        trend: 'Operación',
        trendDirection: 'neutral',
        secondaryLabel: 'Contexto',
        secondaryValue: 'Empresa',
        tone: 'emerald',
        icon: Building2,
      },
      {
        label: 'Permisos críticos',
        value: `${rolesSummary.criticalPermissions}`,
        helper: 'Permisos sensibles bajo control.',
        trend: 'Auditar',
        trendDirection: 'down',
        secondaryLabel: 'Riesgo',
        secondaryValue: 'Alto',
        tone: 'amber',
        icon: ShieldAlert,
      },
      {
        label: 'Última actualización',
        value: rolesSummary.lastUpdate,
        helper: 'Registro más reciente de matriz.',
        trend: 'Hoy',
        trendDirection: 'neutral',
        secondaryLabel: 'Matriz',
        secondaryValue: 'Vigente',
        tone: 'violet',
        icon: RefreshCw,
      },
    ],
    [rolesSummary],
  );

  const sessionKpis = useMemo<PlatformKpiItem[]>(
    () => [
      {
        label: 'Sesiones activas',
        value: `${sessionRows.filter(session => session.status === 'Activa').length}`,
        helper: 'Sesiones abiertas en la plataforma.',
        trend: 'En vivo',
        secondaryLabel: 'Estado',
        secondaryValue: 'Online',
        tone: 'blue',
        icon: Activity,
      },
      {
        label: 'Sesiones internas',
        value: `${sessionRows.filter(session => session.type === 'SaaS').length}`,
        helper: 'Accesos internos de ABUNDRA.',
        trend: 'Interno',
        trendDirection: 'neutral',
        secondaryLabel: 'Alcance',
        secondaryValue: 'Interno',
        tone: 'violet',
        icon: Crown,
      },
      {
        label: 'Sesiones de empresas',
        value: `${sessionRows.filter(session => session.type === 'Tenant').length}`,
        helper: 'Accesos operativos de empresas.',
        trend: 'Empresa',
        trendDirection: 'neutral',
        secondaryLabel: 'Alcance',
        secondaryValue: 'Empresas',
        tone: 'emerald',
        icon: Building2,
      },
      {
        label: 'Accesos sospechosos',
        value: `${sessionRows.filter(session => session.status === 'Sospechosa').length}`,
        helper: 'Sesiones que requieren revisión.',
        trend: 'Revisar',
        trendDirection: 'down',
        secondaryLabel: 'Riesgo',
        secondaryValue: 'Seguridad',
        tone: 'amber',
        icon: AlertTriangle,
      },
      {
        label: 'Revocaciones recientes',
        value: `${sessionSideSummary.revocations.length}`,
        helper: 'Sesiones cerradas por control.',
        trend: 'Auditado',
        trendDirection: 'neutral',
        secondaryLabel: 'Control',
        secondaryValue: 'Activo',
        tone: 'slate',
        icon: RefreshCw,
      },
    ],
    [sessionRows, sessionSideSummary.revocations.length],
  );

  const paymentsCount = useMemo(() => getPayments('ALL').length, [companies]);
  const filteredMasterLogs = useMemo(() => {
    const query = auditSearchTerm.trim().toLowerCase();
    let result = masterLogs;
    if (query) {
      result = result.filter(log =>
        [log.action, log.detail, log.id].some(value => value.toLowerCase().includes(query))
      );
    }
    if (auditFilter !== 'Todos') {
      result = result.filter(log => {
        if (auditFilter === 'SYSTEM') return log.action.toUpperCase().includes('SYSTEM');
        if (auditFilter === 'SECURITY') return log.action.toUpperCase().includes('SECURITY') || log.action.toUpperCase().includes('ACCESS');
        if (auditFilter === 'DATA') return log.action.toUpperCase().includes('UPDATE') || log.action.toUpperCase().includes('CREATE') || log.action.toUpperCase().includes('DELETE');
        return true;
      });
    }
    return result;
  }, [auditSearchTerm, auditFilter, masterLogs]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * 10;
    return filteredMasterLogs.slice(start, start + 10);
  }, [filteredMasterLogs, auditPage]);

  const totalAuditPages = Math.ceil(filteredMasterLogs.length / 10) || 1;
  const visibleAuditPages = useMemo(() => {
    const pages = new Set<number>([1, totalAuditPages, auditPage - 1, auditPage, auditPage + 1]);
    return Array.from(pages)
      .filter(p => p >= 1 && p <= totalAuditPages)
      .sort((a, b) => a - b);
  }, [auditPage, totalAuditPages]);

  const navigateToSection = useCallback(
    (tab: SuperAdminTab) => {
      if (tab === 'GLOBAL_USERS') {
        navigate('/super-admin/usuarios', { replace: false });
        return;
      }
      const params = new URLSearchParams(location.search);
      params.set('section', tabToSectionMap[tab]);
      const basePath = location.pathname.startsWith('/super-admin') ? '/super-admin' : '/master';
      navigate(`${basePath}?${params.toString()}`, { replace: false });
    },
    [location.search, navigate],
  );

  const navigateToUsersTab = useCallback(
    (tab: UsersManagementTab) => {
      setUsersManagementTab(tab);
      navigate(usersTabPathMap[tab], { replace: false });
    },
    [navigate],
  );

  useEffect(() => {
    if (location.pathname.startsWith('/super-admin/usuarios')) {
      const nextUsersTab = usersPathTabMap[location.pathname] || 'SAAS_TEAM';
      if (activeTab !== 'GLOBAL_USERS') {
        setActiveTab('GLOBAL_USERS');
      }
      if (usersManagementTab !== nextUsersTab) {
        setUsersManagementTab(nextUsersTab);
      }
      return;
    }
    const section = new URLSearchParams(location.search).get('section') || 'dashboard';
    const nextTab = sectionToTabMap[section] || 'DASHBOARD';
    if (activeTab !== nextTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, location.pathname, location.search, usersManagementTab]);

  useEffect(() => {
    if (usersManagementTab !== 'TENANT_USERS') return;
    syncUsersQueryParams(
      {
        q: debouncedUsersSearchTerm,
        empresa: tenantCompanyFilter,
        sucursal: tenantBranchFilter,
        rol: tenantRoleFilter,
        estado: tenantStatusFilter,
        ultimoAcceso: tenantLastAccessFilter,
        twofa: tenantTwoFactorFilter,
      },
      {
        q: '',
        empresa: ALL_COMPANIES,
        sucursal: ALL_BRANCHES,
        rol: ALL_ROLES,
        estado: ALL_STATUSES,
        ultimoAcceso: ALL_ACCESS,
        twofa: ALL_TWO_FACTOR,
      },
    );
  }, [
    debouncedUsersSearchTerm,
    syncUsersQueryParams,
    tenantBranchFilter,
    tenantCompanyFilter,
    tenantLastAccessFilter,
    tenantRoleFilter,
    tenantStatusFilter,
    tenantTwoFactorFilter,
    usersManagementTab,
  ]);

  useEffect(() => {
    if (usersManagementTab !== 'INVITATIONS') return;
    syncUsersQueryParams(
      {
        correo: debouncedInvitationSearchTerm,
        tipo: invitationTypeFilter,
        estadoInvitacion: invitationStatusFilter,
        empresaInvitacion: invitationCompanyFilter,
        rolInvitacion: invitationRoleFilter,
        invitadoPor: invitationInvitedByFilter,
        fechaInvitacion: invitationDateFilter,
      },
      {
        correo: '',
        tipo: ALL_TYPES,
        estadoInvitacion: ALL_STATUSES,
        empresaInvitacion: ALL_COMPANIES,
        rolInvitacion: ALL_ROLES,
        invitadoPor: ALL_INVITERS,
        fechaInvitacion: ALL_DATES,
      },
    );
  }, [
    debouncedInvitationSearchTerm,
    invitationCompanyFilter,
    invitationDateFilter,
    invitationInvitedByFilter,
    invitationRoleFilter,
    invitationStatusFilter,
    invitationTypeFilter,
    syncUsersQueryParams,
    usersManagementTab,
  ]);

  useEffect(() => {
    if (usersManagementTab !== 'SESSIONS') return;
    syncUsersQueryParams(
      {
        sesion: debouncedSessionSearchTerm,
        tipoSesion: sessionTypeFilter,
        empresaSesion: sessionCompanyFilter,
        estadoSesion: sessionStatusFilter,
        dispositivo: sessionDeviceFilter,
        navegador: sessionBrowserFilter,
        ip: sessionIpFilter,
        usuario: sessionUserFilter,
      },
      {
        sesion: '',
        tipoSesion: ALL_TYPES,
        empresaSesion: ALL_COMPANIES,
        estadoSesion: ALL_STATUSES,
        dispositivo: ALL_DEVICES,
        navegador: ALL_BROWSERS,
        ip: ALL_IPS,
        usuario: ALL_USERS,
      },
    );
  }, [
    debouncedSessionSearchTerm,
    sessionBrowserFilter,
    sessionCompanyFilter,
    sessionDeviceFilter,
    sessionIpFilter,
    sessionStatusFilter,
    sessionTypeFilter,
    sessionUserFilter,
    syncUsersQueryParams,
    usersManagementTab,
  ]);

  const handleExportTenantUsers = useCallback(() => {
    const headers = ['Usuario', 'Correo', 'Empresa', 'Sucursal', 'Rol', 'Estado', 'Último acceso'];
    const rows = filteredTenantUsers.map(user => [
      user.name,
      user.email,
      user.companyName,
      user.branchName,
      user.role,
      user.status,
      user.lastAccess,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${`${value}`.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'usuarios-empresas-abundra.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredTenantUsers]);

  const usersHeaderActions = useMemo<PlatformHeaderAction[]>(
    () => [
      { label: 'Nuevo Miembro', icon: Plus, onClick: () => { navigateToUsersTab('SAAS_TEAM'); setIsSaasMemberModalOpen(true); }, variant: 'primary' },
      { label: 'Invitar usuario', icon: Bell, onClick: () => { navigateToUsersTab('INVITATIONS'); setIsTenantInvitationModalOpen(true); }, variant: 'secondary' },
      { label: 'Configurar permisos', icon: ShieldCheck, onClick: () => navigateToUsersTab('ROLES'), variant: 'secondary' },
    ],
    [navigateToUsersTab],
  );

  const usersSubviewActions = useMemo<PlatformHeaderAction[]>(() => {
    if (usersManagementTab === 'TENANT_USERS') {
      return [
        { label: 'Registrar Usuario', icon: UserIcon, onClick: () => setIsTenantInvitationModalOpen(true), variant: 'secondary' },
        { label: 'Exportar', icon: Download, onClick: handleExportTenantUsers, variant: 'secondary' },
      ];
    }
    if (usersManagementTab === 'SAAS_TEAM' || usersManagementTab === 'INVITATIONS') {
      return [];
    }

    const actionMap: Record<Exclude<UsersManagementTab, 'TENANT_USERS'>, PlatformHeaderAction> = {
      SAAS_TEAM: { label: 'Nuevo miembro interno', icon: Plus, onClick: () => setIsSaasMemberModalOpen(true), variant: 'primary' },
      INVITATIONS: { label: 'Nueva invitación', icon: Bell, onClick: () => setIsTenantInvitationModalOpen(true), variant: 'primary' },
      ROLES: { label: 'Nuevo rol', icon: ShieldCheck, onClick: () => handleRoleAction('Nuevo rol', 'SaaS', 'create'), variant: 'secondary' },
      SESSIONS: { label: 'Endurecer políticas', icon: ShieldAlert, onClick: () => setIsSessionPolicyModalOpen(true), variant: 'secondary' },
    };

    return [actionMap[usersManagementTab]];
  }, [handleExportTenantUsers, navigateToUsersTab, usersManagementTab]);

  const handleUpdateConfig = () => {
    updateGlobalConfig(platformConfig);
    refreshData();
    emitPlatformToast({
      title: 'Configuración de plataforma guardada',
      message: 'Los parámetros globales han sido actualizados y persistidos con éxito.',
      tone: 'success'
    });
  };

  const handleToggleCompany = (id: string, status: Company['status']) => {
    const nextStatus = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    updateCompany(id, { status: nextStatus });
    refreshData();
  };

  const handleToggleGhost = (id: string, current: boolean) => {
    updateCompany(id, { isGhostMode: !current });
    refreshData();
  };

  const openContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>, menuId: string) => {
    if (activeActionsDropdown === menuId) {
      setActiveActionsDropdown(null);
      setDropdownCoords(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 250;
    const top = openUpward ? rect.top + window.scrollY - 205 : rect.bottom + window.scrollY + 8;
    const left = rect.right + window.scrollX - 220;

    setActiveActionsDropdown(menuId);
    setDropdownCoords({ top, left, openUpward });
  }, [activeActionsDropdown]);

  const handleProvision = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: provisionName,
      planId: provisionPlanId,
      billingCycle: provisionCycle,
      subscriptionPrice: provisionPrice,
    };

    if (editingCompany) updateCompany(editingCompany.id, payload as Partial<Company>);
    else if (currentUser) createCompany(payload, currentUser);

    refreshData();
    setIsCompanyModalOpen(false);
    setEditingCompany(null);
  };

  const handleUpdatePlan = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPlan) return;

    const formData = new FormData(event.currentTarget);
    saveSaaSPlan({
      ...editingPlan,
      name: (formData.get('name') as string) || editingPlan.name,
      maxClients: Number(formData.get('maxClients')),
      maxUsers: Number(formData.get('maxUsers')),
      maxBranches: Number(formData.get('maxBranches')),
      monthlyPrice: Number(formData.get('monthlyPrice')),
      yearlyPrice: Number(formData.get('yearlyPrice')) || Number(formData.get('monthlyPrice')) * 10,
    });
    refreshData();
    setIsPlanModalOpen(false);
    setEditingPlan(null);
  };

  const kpis: PlatformKpiItem[] = [
    {
      label: 'Empresas activas',
      value: '128',
      helper: 'Actividad de tenants',
      trend: '+12 este mes',
      secondaryLabel: 'Estado',
      secondaryValue: 'Operando',
      tone: 'blue',
      icon: Building2,
      trendDirection: 'up',
    },
    {
      label: 'Usuarios activos',
      value: '1,248',
      helper: 'Sesiones operativas',
      trend: '+18 este mes',
      secondaryLabel: 'Seguridad',
      secondaryValue: 'Estable',
      tone: 'emerald',
      icon: Users,
      trendDirection: 'up',
    },
    {
      label: 'Ingresos mensuales (MRR)',
      value: 'RD$ 532,800.00',
      helper: 'Facturación de la plataforma',
      trend: '+8.5% vs anterior',
      secondaryLabel: 'Cobro',
      secondaryValue: 'Recurrente',
      tone: 'amber',
      icon: DollarSign,
      trendDirection: 'up',
    },
    {
      label: 'Suscripciones activas',
      value: '136',
      helper: 'Planes activos',
      trend: '+9 este mes',
      secondaryLabel: 'Renovación',
      secondaryValue: 'Al día',
      tone: 'violet',
      icon: CreditCard,
      trendDirection: 'up',
    },
    {
      label: 'Empresas en mora',
      value: '5',
      helper: 'Suscripciones vencidas',
      trend: '-2 este mes',
      secondaryLabel: 'Seguimiento',
      secondaryValue: 'Crítico',
      tone: 'rose',
      icon: AlertCircle,
      trendDirection: 'down',
    },
  ];

  const dashboardRecentActivity = [
    {
      id: 'login',
      title: 'Inicio de sesión exitoso',
      detail: 'Sesión iniciada para master.',
      time: '09:12',
      icon: ShieldCheck,
      toneClass: 'bg-[#EFF6FF] text-[#2563EB]',
    },
    {
      id: 'company-created',
      title: 'Nueva empresa aprovisionada',
      detail: 'Tenant PrestaFacil RD creado.',
      time: '08:46',
      icon: Building2,
      toneClass: 'bg-[#ECFDF5] text-[#16A34A]',
    },
    {
      id: 'payment-received',
      title: 'Pago recibido',
      detail: 'Factura INV-2025-001 marcada como pagada.',
      time: '08:10',
      icon: CreditCard,
      toneClass: 'bg-[#FFF7ED] text-[#F59E0B]',
    },
    {
      id: 'plan-updated',
      title: 'Plan actualizado',
      detail: 'PrestaFacil RD cambió a Profesional.',
      time: 'Ayer',
      icon: Package,
      toneClass: 'bg-[#F3E8FF] text-[#7C3AED]',
    },
    {
      id: 'saas-user-updated',
      title: 'Usuario SaaS actualizado',
      detail: 'Permisos modificados para Soporte.',
      time: 'Ayer',
      icon: UserCog,
      toneClass: 'bg-[#F8FAFC] text-[#475569]',
    },
  ];

  if (currentUser?.role === Role.SUPER_ADMIN) {
    return (
      <div ref={pageRef} className="space-y-6 pb-24 lg:pb-0">
        {activeTab === 'DASHBOARD' && (
          <section data-super-hero className="w-full">
            <div className="flex w-full flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3.5 py-1.5 text-[11.5px] font-black uppercase tracking-wider text-[#2563EB]">
                  <Crown size={12} />
                  Super Admin
                </div>
                <h1 className="mt-3.5 text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Control global de ABUNDRA</h1>
                <p className="mt-2.5 text-[16px] font-medium text-[#6B7280]">
                  Monitorea empresas, usuarios, suscripciones, facturación y actividad general del SaaS.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(true)}
                  className="flex h-[54px] items-center justify-center gap-3 rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)] cursor-pointer active:scale-[0.98]"
                >
                  <Plus size={18} />
                  Nueva empresa
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('SYSTEM')}
                  className="flex h-[54px] items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] cursor-pointer active:scale-[0.98]"
                >
                  <Settings size={18} className="text-[#2563EB]" />
                  Configuración
                </button>
              </div>
            </div>
          </section>
        )}
        {activeTab === 'DASHBOARD' && (
          <section data-super-panel>
            <PlatformKpiGrid items={kpis} className="sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5" />
          </section>
        )}
        {activeTab === 'DASHBOARD' ? (
          <div className="space-y-5">
            {/* Fila superior de gráficos y distribución */}
            <section data-super-panel className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_0.95fr]">
              <div data-super-panel className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={20} className="text-[#2563EB]" />
                    <h2 className="text-[19px] font-semibold text-[#111827]">Crecimiento de empresas</h2>
                  </div>
                  <span className="inline-flex rounded-full bg-slate-50 border border-slate-200 px-3.5 py-1 text-xs font-semibold text-slate-600">
                    Últimos 6 meses
                  </span>
                </div>
                <div className="h-[270px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="super-admin-performance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.16} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#94A3B8" axisLine={false} tickLine={false} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '20px',
                          border: '1px solid #E5E7EB',
                          boxShadow: '0 16px 36px rgba(15,23,42,0.08)',
                        }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3.5} fill="url(#super-admin-performance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div data-super-panel className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 space-y-5 shadow-sm">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-[19px] font-semibold text-[#111827]">Ingresos por plan (MRR)</h3>
                </div>
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px] font-bold text-slate-500">
                      <span>Básico (35.2%)</span>
                      <span className="text-slate-800">RD$ 129,600.00</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '35.2%' }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px] font-bold text-slate-500">
                      <span>Profesional (41.4%)</span>
                      <span className="text-slate-800">RD$ 233,200.00</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-[#16A34A] rounded-full" style={{ width: '41.4%' }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px] font-bold text-slate-500">
                      <span>Empresarial (26.3%)</span>
                      <span className="text-slate-800">RD$ 140,000.00</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '26.3%' }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px] font-bold text-slate-500">
                      <span>Personalizado (5.6%)</span>
                      <span className="text-slate-800">RD$ 30,000.00</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: '5.6%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section data-super-panel className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-[#2563EB]" />
                <h2 className="text-[19px] font-semibold text-[#111827]">Acciones rápidas</h2>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(true)}
                  className="group flex min-h-[148px] flex-col items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white px-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:shadow-sm cursor-pointer"
                >
                  <Building2 size={30} className="text-[#2563EB]" />
                  <p className="mt-4 text-[17px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">Nueva empresa</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6B7280]">Aprovisionar tenant</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('BILLING')}
                  className="group flex min-h-[148px] flex-col items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white px-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:shadow-sm cursor-pointer"
                >
                  <CreditCard size={30} className="text-[#2563EB]" />
                  <p className="mt-4 text-[17px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">Revisar facturación</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6B7280]">Suscripciones y cobros</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('AUDIT')}
                  className="group flex min-h-[148px] flex-col items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white px-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:shadow-sm cursor-pointer"
                >
                  <History size={30} className="text-[#2563EB]" />
                  <p className="mt-4 text-[17px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">Ver auditoría</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6B7280]">Logs de seguridad globales</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('PLANS')}
                  className="group flex min-h-[148px] flex-col items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white px-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:shadow-sm cursor-pointer"
                >
                  <Package size={30} className="text-[#2563EB]" />
                  <p className="mt-4 text-[17px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">Gestionar planes</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6B7280]">Límites y precios del SaaS</p>
                </button>
              </div>
            </section>

            {/* Fila inferior: alertas operativas y actividad reciente */}
            <section data-super-panel className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">
              <div data-super-panel className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={20} className="text-[#DC2626]" />
                    <h3 className="text-[19px] font-semibold text-slate-900">Alertas operativas</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToSection('SYSTEM')}
                    className="text-[13.5px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-200 cursor-pointer"
                  >
                    Ver todas
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4 rounded-[22px] border border-red-100 bg-red-50/50 p-4 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-sm">
                    <div className="space-y-1.5">
                      <p className="text-[14.5px] font-bold text-[#DC2626] leading-tight">Empresas en mora crítica</p>
                      <p className="text-[13px] font-medium text-slate-600">Hay 5 tenants con pagos de suscripción pendientes por más de 15 días.</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase text-red-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      Crítico
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-[22px] border border-amber-100 bg-amber-50/50 p-4 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-sm">
                    <div className="space-y-1.5">
                      <p className="text-[14.5px] font-bold text-[#D97706] leading-tight">Límites de plan excedidos</p>
                      <p className="text-[13px] font-medium text-slate-600">2 empresas están al 95% de su capacidad máxima de usuarios.</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Advertencia
                    </span>
                  </div>
                </div>
              </div>

              <div data-super-panel className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Activity size={20} className="text-[#2563EB]" />
                    <h3 className="text-[19px] font-semibold text-slate-900">Actividad reciente</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToSection('AUDIT')}
                    className="text-[13.5px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-200 cursor-pointer"
                  >
                    Ver todo
                  </button>
                </div>
                <div className="space-y-4">
                  {dashboardRecentActivity.map(item => (
                    <div key={item.id} className="flex items-start gap-3 rounded-[20px] px-1 py-1 transition-all duration-200 hover:-translate-y-[2px] hover:bg-[#FCFDFE]">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.toneClass}`}>
                        <item.icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold leading-tight text-slate-950">{item.title}</p>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500">{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}
        {activeTab === 'COMPANIES' ? (
          selectedCompanyDetail ? (
            // ==================== DETALLE DE EMPRESA (SOPORTE Y TENANT) ====================
            <section className="space-y-6 animate-[platform-fade-in_180ms_ease-out]">
              <div data-super-company-profile-hero>
                <PlatformPageHeader
                  title="Perfil de Empresa"
                  description="Consulta el estado operativo, suscripción, facturación y actividad del tenant."
                  actions={[
                    {
                      label: 'Volver a empresas',
                      icon: ArrowLeft,
                      onClick: () => setSelectedCompanyDetail(null),
                    },
                    {
                      label: selectedCompanyDetail.isGhostMode ? 'Emulando...' : 'Emular',
                      icon: Ghost,
                      onClick: () => handleToggleGhost(selectedCompanyDetail.id, !!selectedCompanyDetail.isGhostMode),
                    },
                    {
                      label: 'Editar empresa',
                      icon: Edit3,
                      onClick: () => {
                        setEditingCompany(selectedCompanyDetail);
                        setProvisionName(selectedCompanyDetail.name);
                        setProvisionPlanId(selectedCompanyDetail.planId);
                        setProvisionCycle(selectedCompanyDetail.billingCycle);
                        setProvisionPrice(selectedCompanyDetail.subscriptionPrice || 0);
                        setIsCompanyModalOpen(true);
                      },
                    },
                    {
                      label: 'Ver facturación',
                      icon: CreditCard,
                      variant: 'primary',
                      onClick: () => setDetailTab('FACTURACION'),
                    },
                  ]}
                />
              </div>

              {/* Sección Hero/KPI de la Empresa (Estilo ClientProfile) */}
              <section data-super-company-profile-hero className="rounded-[30px] border border-[#E5E7EB] bg-white p-8 shadow-sm animate-[platform-fade-in_180ms_ease-out]">
                <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
                  <div className="flex items-start gap-5">
                    <div className="h-28 w-28 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-[0_10px_25px_rgba(37,99,235,0.08)]">
                      <Building2 size={48} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[36px] font-black tracking-tight text-[#111827]">
                        {selectedCompanyDetail.name}
                      </p>
                      <p className="text-md font-bold text-[#2563EB] mt-0.5">ID: {selectedCompanyDetail.id}</p>
                      <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium text-[#374151]">
                        <span className="inline-flex items-center gap-2">
                          <Phone size={16} className="text-[#2563EB]" />
                          809-555-0199
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <MapPin size={16} className="text-[#2563EB]" />
                          Santo Domingo, República Dominicana
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-[#F1F5F9] bg-[#FCFDFF] p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Estado del Tenant</span>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[14px] font-black uppercase ${
                          selectedCompanyDetail.status === 'ACTIVE' ?
                             'bg-[#DCFCE7] text-[#16A34A]' 
                            : 'bg-[#FEE2E2] text-[#DC2626]'
                        }`}>
                          {selectedCompanyDetail.status === 'ACTIVE' ? 'Activo' : 'Suspendido'}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#F1F5F9] bg-[#FCFDFF] p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Plan Contratado</span>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[20px] font-black text-[#111827]">
                          {plans.find(p => p.id === selectedCompanyDetail.planId).name || 'Estándar'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 border-t border-[#E5E7EB] pt-6 sm:grid-cols-2 xl:grid-cols-5">
                  <SummaryMetric label="Cobros totales" value={formatCurrency(selectedCompanyDetail.id === 'c1' ? 845200 : 0)} iconTone="blue" />
                  <SummaryMetric label="Capital prestado" value={formatCurrency(selectedCompanyDetail.id === 'c1' ? 1250000 : 0)} iconTone="violet" />
                  <SummaryMetric label="Cartera activa" value={formatCurrency(selectedCompanyDetail.id === 'c1' ? 689000 : 0)} iconTone="green" />
                  <SummaryMetric label="Mora acumulada" value={formatCurrency(selectedCompanyDetail.id === 'c1' ? 45000 : 0)} iconTone="amber" />
                  <SummaryMetric label="Usuarios activos" value="13" iconTone="slate" />
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.75fr)]">
                {/* Columna Izquierda (75%): Pestañas y contenido central */}
                <div data-client-main className="space-y-6">
                  <div data-super-company-profile-panel className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm flex flex-col">
                    {/* Cabecera del Card: Pestañas horizontales estilo ClientProfile */}
                    <div data-super-company-profile-tabs className="border-b border-[#E5E7EB] px-5 py-5">
                      <div className="hidden xl:flex xl:flex-wrap xl:gap-3">
                        {[
                          { id: 'RESUMEN', label: 'Resumen', icon: Globe },
                          { id: 'USUARIOS', label: 'Usuarios', icon: Users },
                          { id: 'SUCURSALES', label: 'Sucursales', icon: Building2 },
                          { id: 'SUSCRIPCION', label: 'Suscripción', icon: CreditCard },
                          { id: 'ACTIVIDAD', label: 'Actividad', icon: History }
                        ].map(tab => {
                          const active = detailTab === tab.id;
                          const Icon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setDetailTab(tab.id as any)}
                              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                                active ?
                                   'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                              }`}
                            >
                              <Icon size={15} className={active ? 'text-[#2563EB]' : 'text-[#64748B]'} />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="overflow-x-auto xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex min-w-max items-center gap-2 whitespace-nowrap pb-1">
                          {[
                            { id: 'RESUMEN', label: 'Resumen', icon: Globe },
                            { id: 'USUARIOS', label: 'Usuarios', icon: Users },
                            { id: 'SUCURSALES', label: 'Sucursales', icon: Building2 },
                            { id: 'SUSCRIPCION', label: 'Suscripción', icon: CreditCard },
                            { id: 'ACTIVIDAD', label: 'Actividad', icon: History }
                          ].map(tab => {
                            const active = detailTab === tab.id;
                            const Icon = tab.icon;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setDetailTab(tab.id as any)}
                                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                                  active ?
                                     'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                                }`}
                              >
                                <Icon size={15} className={active ? 'text-[#2563EB]' : 'text-[#64748B]'} />
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Cuerpo del Card Izquierdo */}
                    <div className="p-6">
                      {detailTab === 'RESUMEN' && (
                        <div className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
                          {/* Salud Financiera */}
                          <div className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm">
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                              <div>
                                <h4 className="text-[17px] font-black text-slate-900">Salud Financiera de la Empresa</h4>
                                <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Indicadores económicos clave del tenant activo.</p>
                              </div>
                            </div>
                            <table className="min-w-full divide-y divide-slate-100">
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {[
                                  { label: 'Cobros Totales', value: formatCurrency(selectedCompanyDetail.id === 'c1' ? 845200 : 0), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', shadow: 'rgba(5,150,105,0.06)', desc: 'Total recaudado en el período activo' },
                                  { label: 'Capital Prestado', value: formatCurrency(selectedCompanyDetail.id === 'c1' ? 1250000 : 0), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', shadow: 'rgba(37,99,235,0.06)', desc: 'Total desembolsado a clientes' },
                                  { label: 'Cartera Activa', value: formatCurrency(selectedCompanyDetail.id === 'c1' ? 689000 : 0), icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50', shadow: 'rgba(79,70,229,0.06)', desc: 'Saldo vigente en el sistema' },
                                  { label: 'Mora Acumulada', value: formatCurrency(selectedCompanyDetail.id === 'c1' ? 45000 : 0), icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', shadow: 'rgba(239,68,68,0.06)', desc: 'Capital en estado de morosidad' },
                                ].map(item => {
                                  const Icon = item.icon;
                                  return (
                                    <tr key={item.label} className="group text-[15px] font-medium text-slate-700 transition-colors duration-200 hover:bg-[#FCFDFE]">
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.bg} ${item.color} shadow-[0_4px_10px_${item.shadow}]`}>
                                            <Icon size={20} />
                                          </div>
                                          <div>
                                            <p className={`text-[15px] font-bold text-slate-900 leading-snug transition-colors duration-200 group-hover:${item.color}`}>{item.label}</p>
                                            <p className="text-[12px] font-medium text-slate-400 mt-0.5">{item.desc}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <span className={`text-[17px] font-black ${item.color}`}>{item.value}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Operación General */}
                          <div className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm">
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                              <h4 className="text-[17px] font-black text-slate-900">Operación General</h4>
                              <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Contadores operativos del sistema.</p>
                            </div>
                            <div className="grid grid-cols-3 divide-x divide-slate-100">
                              {[
                                { count: globalUsers.filter(u => u.companyId === selectedCompanyDetail.id).length, label: 'Usuarios Activos', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { count: selectedCompanyDetail.id === 'c1' ? 3 : 1, label: 'Sucursales', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                { count: 97, label: 'Clientes Registrados', icon: UserIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                              ].map(item => {
                                const Icon = item.icon;
                                return (
                                  <div key={item.label} className="group flex flex-col items-center justify-center py-7 px-4 gap-3 transition-colors duration-200 hover:bg-[#FCFDFE] cursor-default">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.bg} ${item.color} shadow-sm`}>
                                      <Icon size={22} />
                                    </div>
                                    <div className="text-center">
                                      <p className={`text-[28px] font-black ${item.color} leading-none`}>{item.count}</p>
                                      <p className="text-[12px] font-semibold text-slate-500 mt-1">{item.label}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                      {detailTab === 'USUARIOS' && (
                        <div className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm animate-[platform-fade-in_180ms_ease-out]">
                          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-5 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h3 className="text-[24px] font-black tracking-tight text-slate-900">Usuarios registrados</h3>
                              <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Listado operativo de cuentas activas en este tenant.</p>
                            </div>
                            <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-[13px] font-bold text-slate-600">
                              {globalUsers.filter(u => u.companyId === selectedCompanyDetail.id).length} miembros
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <div className="min-w-[760px]">
                              <div className="grid grid-cols-[minmax(0,1.5fr)_0.85fr_0.75fr] bg-[#F8FAFC] px-6 py-4 text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                                <div>Usuario</div>
                                <div>Rol en el sistema</div>
                                <div>Estado</div>
                              </div>
                              <div className="divide-y divide-[#EEF2F7] bg-white">
                                {globalUsers.filter(u => u.companyId === selectedCompanyDetail.id).map(user => (
                                  <div
                                    key={user.id}
                                    className="group grid grid-cols-[minmax(0,1.5fr)_0.85fr_0.75fr] items-center px-6 py-4 transition-all duration-200 hover:bg-[#FCFDFF]"
                                  >
                                    <div className="flex min-w-0 items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                                      {user.photo ? (
                                        <img src={user.photo} alt={user.name} className="h-11 w-11 shrink-0 rounded-full border border-[#E5E7EB] object-cover shadow-[0_4px_10px_rgba(0,0,0,0.04)]" />
                                      ) : (
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[14px] font-black text-[#2563EB] shadow-[0_4px_10px_rgba(37,99,235,0.06)] transition-transform duration-200 group-hover:scale-[1.04]">
                                          {user.avatar || user.name.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="truncate text-[15px] font-bold leading-snug text-slate-900 transition-colors duration-200 group-hover:text-[#2563EB]">{user.name}</p>
                                        <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">@{user.username}</p>
                                      </div>
                                    </div>

                                    <div>
                                      <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider border ${
                                        user.role === Role.ADMIN ?
                                           'bg-blue-50 text-blue-600 border-blue-100'
                                          : user.role === Role.SUPERVISOR ?
                                             'bg-amber-50 text-amber-600 border-amber-100'
                                            : user.role === Role.COBRADOR ?
                                               'bg-emerald-50 text-emerald-600 border-emerald-100'
                                              : 'bg-purple-50 text-purple-600 border-purple-100'
                                      }`}>
                                        {user.role}
                                      </span>
                                    </div>

                                    <div>
                                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider border ${
                                        user.isActive ?
                                           'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]'
                                          : 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]'
                                      }`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-[#16A34A] animate-pulse' : 'bg-[#DC2626]'}`} />
                                        {user.isActive ? 'Activo' : 'Suspendido'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {globalUsers.filter(u => u.companyId === selectedCompanyDetail.id).length === 0 ? (
                              <div className="px-6 py-10 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8FAFC] text-[#2563EB] shadow-sm">
                                  <Users size={20} />
                                </div>
                                <p className="mt-4 text-[15px] font-black text-slate-900">Sin usuarios registrados</p>
                                <p className="mt-1 text-[13px] font-medium text-slate-500">Este tenant todavía no tiene cuentas asociadas en la semilla actual.</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                      {detailTab === 'SUCURSALES' && (
                        <div className="space-y-8 animate-[platform-fade-in_180ms_ease-out]">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Cobertura</p>
                            <h3 className="mt-2 text-[28px] font-black tracking-tight text-slate-900">Sucursales y capacidad operativa</h3>
                            <p className="mt-2 max-w-3xl text-[14px] font-medium leading-7 text-slate-500">
                              Organiza la red de sedes del tenant con una lectura mas clara de cobertura, meta comercial y estado de cada punto.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryMetric label="Sucursales activas" value={`${selectedCompanyDetail.id === 'c1' ? 3 : 1}`} iconTone="blue" />
                            <SummaryMetric label="Meta consolidada" value={formatCurrency(selectedCompanyDetail.id === 'c1' ? 580000 : 100000)} iconTone="green" />
                            <SummaryMetric label="Meta promedio" value={formatCurrency(selectedCompanyDetail.id === 'c1' ? 193333 : 100000)} iconTone="violet" />
                            <SummaryMetric label="Equipo desplegado" value={selectedCompanyDetail.id === 'c1' ? '30 usuarios' : '5 usuarios'} iconTone="amber" />
                          </div>

                          <div className="space-y-6">
                            <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm">
                              <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-6 py-5 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Sucursales habilitadas</h3>
                                  <p className="mt-1 text-[13px] font-medium text-slate-500">Puntos de operación, responsables y metas comerciales registradas.</p>
                                </div>
                                <span className="inline-flex h-10 items-center rounded-2xl bg-[#F8FAFC] px-4 text-[13px] font-bold text-slate-600">
                                  {selectedCompanyDetail.id === 'c1' ? 3 : 1} activas
                                </span>
                              </div>

                              <div className="space-y-3 p-5">
                                {(selectedCompanyDetail.id === 'c1' ?
                                   [
                                      { id: 'b1', name: 'Sucursal Central Santo Domingo', address: 'Av. Winston Churchill', monthlyGoal: 250000, staff: 14, health: 'Alta demanda', status: 'Operativa' },
                                      { id: 'b2', name: 'Sucursal Santiago', address: 'Av. Estrella Sadhala', monthlyGoal: 180000, staff: 9, health: 'Balanceada', status: 'Operativa' },
                                      { id: 'b3', name: 'Sucursal Herrera', address: 'Av. Isabel Aguiar', monthlyGoal: 150000, staff: 7, health: 'Seguimiento', status: 'Operativa' }
                                    ]
                                  : [
                                      { id: 'b4', name: 'Sucursal Central', address: 'Oficinas Administrativas', monthlyGoal: 100000, staff: 5, health: 'Cobertura base', status: 'Operativa' }
                                    ]).map(branch => (
                                  <div
                                    key={branch.id}
                                    className="group grid grid-cols-1 gap-4 rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:bg-white hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)] md:grid-cols-[minmax(0,1.45fr)_0.72fr_0.72fr_0.82fr]"
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.06)] transition-transform duration-200 group-hover:scale-[1.04]">
                                        <Building2 size={20} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-[16px] font-black leading-snug text-slate-900 transition-colors duration-200 group-hover:text-[#2563EB]">{branch.name}</p>
                                        <p className="mt-1 truncate text-[12.5px] font-semibold text-slate-500">{branch.address}</p>
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Cobertura</p>
                                      <p className="mt-1 text-[14px] font-bold text-[#2563EB]">{branch.health}</p>
                                    </div>

                                    <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Equipo</p>
                                      <p className="mt-1 text-[14px] font-bold text-slate-900">{branch.staff} usuarios</p>
                                      <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">{branch.status}</p>
                                    </div>

                                    <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 md:text-right">
                                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Meta mensual</p>
                                      <p className="mt-1 text-[16px] font-black text-slate-900">{formatCurrency(branch.monthlyGoal)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm">
                              <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-6 py-5 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                                    <ShieldCheck size={18} />
                                  </div>
                                  <div>
                                    <h4 className="text-[20px] font-black tracking-tight text-slate-900">Lectura ejecutiva</h4>
                                    <p className="mt-1 text-[13px] font-medium text-slate-500">Resumen rápido del despliegue territorial.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="divide-y divide-[#EEF2F7]">
                                {[
                                  { label: 'Sucursal principal', value: selectedCompanyDetail.id === 'c1' ? 'Sucursal Central Santo Domingo' : 'Sucursal Central', icon: Building2 },
                                  { label: 'Mayor meta', value: formatCurrency(selectedCompanyDetail.id === 'c1' ? 250000 : 100000), icon: TrendingUp },
                                  { label: 'Cobertura actual', value: selectedCompanyDetail.id === 'c1' ? 'Red distribuida' : 'Operación centralizada', icon: MapPin },
                                ].map(item => {
                                  const Icon = item.icon;
                                  return (
                                    <div key={item.label} className="flex flex-col gap-3 px-6 py-4 transition-colors duration-200 hover:bg-[#FCFDFF] sm:flex-row sm:items-center sm:justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F8FAFC] text-[#2563EB]">
                                          <Icon size={17} />
                                        </div>
                                        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">{item.label}</p>
                                      </div>
                                      <p className="text-[15px] font-black text-slate-900 sm:text-right">{item.value}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm">
                              <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-6 py-5 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F0FDF4] text-[#16A34A]">
                                    <Users size={18} />
                                  </div>
                                  <div>
                                    <h4 className="text-[20px] font-black tracking-tight text-slate-900">Acciones recomendadas</h4>
                                    <p className="mt-1 text-[13px] font-medium text-slate-500">Movimientos sugeridos para soporte y expansión.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="divide-y divide-[#EEF2F7]">
                                {[
                                  {
                                    icon: Building2,
                                    title: 'Revisar cobertura por zona',
                                    detail: 'Confirma si la red actual cubre la demanda del tenant y si existen sedes con baja capacidad.',
                                  },
                                  {
                                    icon: ArrowUpRight,
                                    title: 'Validar metas comerciales',
                                    detail: 'Compara la meta promedio contra la operación real antes de ampliar límites del plan.',
                                  },
                                ].map(action => {
                                  const Icon = action.icon;
                                  return (
                                    <div key={action.title} className="group flex items-start gap-4 px-6 py-5 transition-colors duration-200 hover:bg-[#FCFDFF]">
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB] transition-transform duration-200 group-hover:scale-[1.04]">
                                        <Icon size={18} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[15px] font-black text-slate-900 transition-colors duration-200 group-hover:text-[#2563EB]">{action.title}</p>
                                        <p className="mt-1 text-[13px] font-medium leading-6 text-slate-500">{action.detail}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {detailTab === 'FACTURACION' && (
                        <div data-super-company-profile-panel className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm animate-[platform-fade-in_180ms_ease-out]">
                          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                              <h3 className="text-[17px] font-black text-slate-900">Facturación del tenant</h3>
                              <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Cobros, vigencia del servicio y trazabilidad de la suscripción SaaS.</p>
                            </div>
                            <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-[13px] font-bold text-slate-600">
                              1 factura
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                              <thead>
                                <tr className="bg-[#F8FAFC] text-left text-[12px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                  <th className="px-6 py-4">Factura</th>
                                  <th className="px-6 py-4">Ciclo</th>
                                  <th className="px-6 py-4">Monto</th>
                                  <th className="px-6 py-4">Vencimiento</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                <tr data-super-company-profile-row className="group text-[15px] font-medium text-slate-700 transition-colors duration-200 hover:bg-[#FCFDFE]">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.06)]">
                                        <CreditCard size={20} />
                                      </div>
                                      <div>
                                        <p className="text-[15px] font-bold text-slate-900 leading-snug transition-colors duration-200 group-hover:text-[#2563EB]">FAC-2026-001</p>
                                        <p className="text-[12px] font-medium text-slate-500 mt-0.5">Pago de suscripción del sistema</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider border ${
                                      selectedCompanyDetail.billingCycle === 'YEARLY' ?
                                         'bg-purple-50 text-purple-600 border-purple-100'
                                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    }`}>
                                      {selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-[15px] font-black text-slate-900">{formatCurrency(selectedCompanyDetail.subscriptionPrice)}</span>
                                  </td>
                                  <td className="px-6 py-4 text-slate-500">
                                    {formatDate(selectedCompanyDetail.expiresAt)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {detailTab === 'SUSCRIPCION' && (
                        <div className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm animate-[platform-fade-in_180ms_ease-out]">
                          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                              <h3 className="text-[17px] font-black text-slate-900">Historial de Cobros al Tenant</h3>
                              <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Control de facturación y vigencia del servicio SaaS.</p>
                            </div>
                            <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-[13px] font-bold text-slate-600">
                              1 factura
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                              <thead>
                                <tr className="bg-[#F8FAFC] text-left text-[12px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                  <th className="px-6 py-4">Factura</th>
                                  <th className="px-6 py-4">Ciclo</th>
                                  <th className="px-6 py-4">Monto</th>
                                  <th className="px-6 py-4">Vencimiento</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                <tr className="group text-[15px] font-medium text-slate-700 transition-colors duration-200 hover:bg-[#FCFDFE]">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.06)]">
                                        <CreditCard size={20} />
                                      </div>
                                      <div>
                                        <p className="text-[15px] font-bold text-slate-900 leading-snug transition-colors duration-200 group-hover:text-[#2563EB]">FAC-2026-001</p>
                                        <p className="text-[12px] font-medium text-slate-500 mt-0.5">Pago de suscripción del sistema</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider border ${
                                      selectedCompanyDetail.billingCycle === 'YEARLY' ?
                                         'bg-purple-50 text-purple-600 border-purple-100'
                                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    }`}>
                                      {selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-[15px] font-black text-slate-900">{formatCurrency(selectedCompanyDetail.subscriptionPrice)}</span>
                                  </td>
                                  <td className="px-6 py-4 text-slate-500">
                                    {formatDate(selectedCompanyDetail.expiresAt)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {detailTab === 'ACTIVIDAD' && (
                        <div className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm animate-[platform-fade-in_180ms_ease-out]">
                          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                              <h3 className="text-[17px] font-black text-slate-900">Historial de Actividad</h3>
                              <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Auditoría del sistema y telemetría de eventos del tenant.</p>
                            </div>
                            <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-[13px] font-bold text-slate-600">
                              {masterLogs.filter(l => l.detail.toLowerCase().includes(selectedCompanyDetail.name.toLowerCase()) || l.action.toLowerCase().includes('company')).length} registros
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                              <thead>
                                <tr className="bg-[#F8FAFC] text-left text-[12px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                  <th className="px-6 py-4">Evento</th>
                                  <th className="px-6 py-4">Detalle de Actividad</th>
                                  <th className="px-6 py-4 text-right">Fecha y Hora</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {masterLogs.filter(l => l.detail.toLowerCase().includes(selectedCompanyDetail.name.toLowerCase()) || l.action.toLowerCase().includes('company')).map(log => (
                                  <tr key={log.id} className="group text-[15px] font-medium text-slate-700 transition-colors duration-200 hover:bg-[#FCFDFE]">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.06)]">
                                          <Terminal size={20} />
                                        </div>
                                        <div>
                                          <p className="text-[15px] font-bold text-slate-900 leading-snug transition-colors duration-200 group-hover:text-[#2563EB]">{log.action}</p>
                                          <p className="text-[12px] font-medium text-slate-400 mt-0.5">tenant_logs_{selectedCompanyDetail.id}.log</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 max-w-xs md:max-w-md truncate" title={log.detail}>
                                      {log.detail}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-500 font-mono text-[13px]">
                                      {formatDate(log.timestamp)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna Derecha (25%): Sidebar Contextual Global */}
                <div data-client-side className="space-y-6">
                  {/* Configuración General */}
                  <div data-super-company-profile-panel className="group rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm overflow-hidden transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE]">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-[17px] font-black text-slate-900">Configuración General</h3>
                      <p className="text-[12px] font-semibold text-slate-400 mt-0.5">Parámetros del plan y facturación.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        { label: 'Plan Contratado', value: plans.find(p => p.id === selectedCompanyDetail.planId).name || 'Estándar', icon: Package, color: 'text-purple-500', bg: 'bg-purple-50' },
                        { label: 'Ciclo de Facturación', value: selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual', icon: CalendarCheck, color: 'text-blue-500', bg: 'bg-blue-50' },
                        { label: 'Precio Mensual', value: formatCurrency(selectedCompanyDetail.subscriptionPrice), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      ].map(row => {
                        const Icon = row.icon;
                        return (
                          <div key={row.label} className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-[#FCFDFE]">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${row.bg} ${row.color}`}>
                                <Icon size={15} />
                              </div>
                              <span className="text-[13px] font-semibold text-slate-500">{row.label}</span>
                            </div>
                            <span className="text-[13px] font-bold text-slate-800">{row.value}</span>
                          </div>
                        );
                      })}
                      <div className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-[#FCFDFE]">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${selectedCompanyDetail.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            <CheckCircle2 size={15} />
                          </div>
                          <span className="text-[13px] font-semibold text-slate-500">Estado</span>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase border ${
                          selectedCompanyDetail.status === 'ACTIVE' ?
                             'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${selectedCompanyDetail.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          {selectedCompanyDetail.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Control */}
                  <div data-super-company-profile-panel className="group rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-3 transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE]">
                    <div className="border-b border-slate-100 pb-3 mb-2">
                      <h3 className="text-[17px] font-black text-slate-900 transition-colors duration-200 group-hover:text-[#2563EB]">Acciones de Control</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleGhost(selectedCompanyDetail.id, !!selectedCompanyDetail.isGhostMode)}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-purple-50 border border-purple-200 text-[13.5px] font-bold text-purple-650 hover:bg-purple-100 transition-all cursor-pointer animate-pulse"
                    >
                      <Ghost size={16} />
                      {selectedCompanyDetail.isGhostMode ? 'Detener Emulación' : 'Emular Sesión (Soporte)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCompany(selectedCompanyDetail);
                        setProvisionName(selectedCompanyDetail.name);
                        setProvisionPlanId(selectedCompanyDetail.planId);
                        setProvisionCycle(selectedCompanyDetail.billingCycle);
                        setProvisionPrice(selectedCompanyDetail.subscriptionPrice || 0);
                        setIsCompanyModalOpen(true);
                      }}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 text-[13.5px] font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <Edit3 size={16} />
                      Editar Configuración
                    </button>
                  </div>

                  {/* Salud del Entorno */}
                  <div data-super-company-profile-panel className="group rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm overflow-hidden transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE]">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-[17px] font-black text-slate-900 transition-colors duration-200 group-hover:text-[#2563EB]">Salud del Entorno</h3>
                      <p className="text-[12px] font-semibold text-slate-400 mt-0.5">Estado operativo en tiempo real.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        { label: 'Conexión BD', value: 'Online', valueClass: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-500', dot: true },
                        { label: 'Latencia de API', value: '45ms', valueClass: 'text-emerald-600 font-mono', icon: Activity, bg: 'bg-blue-50', color: 'text-blue-500', dot: false },
                        { label: 'Uso de Disco', value: '12.4 GB / 100 GB', valueClass: 'text-slate-700 font-mono', icon: SlidersHorizontal, bg: 'bg-slate-100', color: 'text-slate-500', dot: false },
                        { label: 'Último backup', value: 'Hoy 04:00 AM', valueClass: 'text-slate-700', icon: Clock3, bg: 'bg-slate-100', color: 'text-slate-500', dot: false },
                      ].map(row => {
                        const Icon = row.icon;
                        return (
                          <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-[#FCFDFE]">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${row.bg} ${row.color}`}>
                                <Icon size={15} />
                              </div>
                              <span className="text-[13px] font-semibold text-slate-500">{row.label}</span>
                            </div>
                            <span className={`flex items-center gap-1.5 text-[13px] font-bold ${row.valueClass}`}>
                              {row.dot && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                              {row.value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            // ==================== LISTADO GENERAL DE EMPRESAS ====================
            <>
            <section className="space-y-6">
              <div data-super-companies-hero>
                <PlatformPageHeader
                  title="Empresas"
                  description="Vista operativa de tenants, planes, facturación, estado y seguimiento del SaaS."
                  actions={[
                    {
                      label: 'Aprovisionar empresa',
                      icon: Building2,
                      variant: 'primary',
                      onClick: () => {
                        setEditingCompany(null);
                        setProvisionName('');
                        setProvisionPlanId('p2');
                        setProvisionCycle('MONTHLY');
                        setProvisionPrice(3500);
                        setIsCompanyModalOpen(true);
                      },
                    },
                  ]}
                />
              </div>

              <div data-super-companies-kpi>
                <PlatformKpiGrid items={companyListKpis} className="sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-5" />
              </div>

              <div data-super-companies-filters className="relative z-30 rounded-[26px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_220px_minmax(320px,1fr)_auto]">
                  <FilterDropdown
                    value={statusFilter === 'Todos los estados' ? '' : statusFilter}
                    onChange={(val) => setStatusFilter(val || 'Todos los estados')}
                    placeholder="Todos los estados"
                    options={[
                      { value: 'Activas', label: 'Activas' },
                      { value: 'Pruebas', label: 'Pruebas' },
                      { value: 'Suspendidas', label: 'Suspendidas' },
                    ]}
                  />
                  <FilterDropdown
                    value={planFilter === 'Todos los planes' ? '' : planFilter}
                    onChange={(val) => setPlanFilter(val || 'Todos los planes')}
                    placeholder="Todos los planes"
                    options={[
                      { value: 'Básico', label: 'Básico' },
                      { value: 'Profesional', label: 'Profesional' },
                      { value: 'Empresarial', label: 'Empresarial' },
                    ]}
                  />
                  <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD] focus-within:shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
                    <Search size={18} className="text-[#6B7280]" />
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder="Buscar por empresa, ID o dominio..."
                      className="w-full bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('Todos los estados');
                      setPlanFilter('Todos los planes');
                      setActiveFilterDropdown(null);
                    }}
                    className={`inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${motionButtonClass}`}
                  >
                    <Filter size={18} />
                    Limpiar filtros
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(310px,0.72fr)]">
                <div data-super-companies-list className={`${shellCardClass} p-6 transition-all duration-200 hover:border-[#DBEAFE]`}>
                  <div className="flex flex-col gap-4 border-b border-[#EEF2F7] pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-[24px] font-semibold text-[#111827]">Cartera de empresas</h2>
                      <p className="mt-1 text-[14px] font-medium text-[#6B7280]">Seguimiento centralizado de tenants y facturación operativa.</p>
                    </div>
                    <StatusBadge label={`${filteredCompanies.length} registradas`} tone="neutral" />
                  </div>

                  {filteredCompanies.length === 1 ? (
                    <div className="mt-5 rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] px-5 py-4">
                      <p className="text-[15px] font-semibold text-[#111827]">Solo hay 1 empresa registrada</p>
                      <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Aprovisiona nuevos tenants para ver más actividad en esta cartera.</p>
                    </div>
                  ) : null}

                  <div className="mt-6 overflow-hidden">
                    <div className="w-full">
                      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(96px,0.9fr)_minmax(96px,0.9fr)_minmax(130px,1fr)_minmax(120px,0.95fr)_minmax(92px,0.8fr)_56px] gap-x-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                        <span>Empresa</span>
                        <span>Plan</span>
                        <span>Usuarios</span>
                        <span>MRR / Cobro</span>
                        <span>Próximo pago</span>
                        <span>Estado</span>
                        <span className="text-center">Acc.</span>
                      </div>
                      <div className="divide-y divide-[#EEF2F7]">
                        {filteredCompanies.map(company => {
                          const plan = plans.find(item => item.id === company.planId);
                          const companyUsersCount = companyUsers.filter(user => user.companyId === company.id).length;

                          return (
                            <div
                              key={company.id}
                              data-super-company-row
                              data-super-row
                              className="group grid cursor-pointer grid-cols-[minmax(0,2.1fr)_minmax(96px,0.9fr)_minmax(96px,0.9fr)_minmax(130px,1fr)_minmax(120px,0.95fr)_minmax(92px,0.8fr)_56px] gap-x-3 items-center px-4 py-4 text-[14px] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC]"
                              onClick={() => {
                                setSelectedCompanyDetail(company);
                                setDetailTab('RESUMEN');
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[14px] font-black text-[#2563EB]">
                                  {company.name.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{company.name}</p>
                                  <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">ID: {company.id}</p>
                                </div>
                              </div>
                              <span className="text-[14px] font-semibold text-[#475569]">{plan?.name || 'Básico'}</span>
                              <span className="text-[14px] font-semibold text-[#475569]">{companyUsersCount} usuarios</span>
                              <div>
                                <p className="text-[15px] font-semibold text-[#111827]">{formatCurrency(company.subscriptionPrice)}</p>
                                <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{company.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}</p>
                              </div>
                              <span className="text-[14px] font-medium text-[#6B7280]">{formatDate(company.expiresAt)}</span>
                              <div>
                                <StatusBadge
                                  label={company.status === 'ACTIVE' ? 'Activa' : company.status === 'TRIAL' ? 'Prueba' : 'Suspendida'}
                                  tone={company.status === 'ACTIVE' ? 'success' : company.status === 'TRIAL' ? 'warning' : 'danger'}
                                />
                              </div>
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedCompanyDetail(company);
                                    setDetailTab('RESUMEN');
                                  }}
                                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#94A3B8] ${motionButtonClass}`}
                                  aria-label={`Abrir ${company.name}`}
                                >
                                  <Eye size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div data-super-companies-side-panel data-super-panel className={`${shellCardClass} p-6 transition-all duration-200 hover:border-[#DBEAFE]`}>
                    <div className="flex items-center gap-3 border-b border-[#EEF2F7] pb-4">
                      <AlertTriangle size={18} className="text-[#F59E0B]" />
                      <h3 className="text-[20px] font-semibold text-[#111827]">Empresas en seguimiento</h3>
                    </div>
                    <div className="mt-5 space-y-3">
                      {tenantCompanies.filter(company => company.status !== 'ACTIVE').slice(0, 3).map(company => (
                        <div key={company.id} className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4 transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE]">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[15px] font-semibold text-[#111827]">{company.name}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">
                                {company.status === 'TRIAL' ? 'Prueba por expirar pronto' : 'Requiere validación operativa'}
                              </p>
                            </div>
                            <StatusBadge label={company.status === 'TRIAL' ? 'Trial' : 'Riesgo'} tone={company.status === 'TRIAL' ? 'warning' : 'danger'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div data-super-companies-side-panel data-super-panel className={`${shellCardClass} p-6 transition-all duration-200 hover:border-[#DBEAFE]`}>
                    <div className="flex items-center gap-3 border-b border-[#EEF2F7] pb-4">
                      <CalendarCheck size={18} className="text-[#2563EB]" />
                      <h3 className="text-[20px] font-semibold text-[#111827]">Renovaciones próximas</h3>
                    </div>
                    <div className="mt-5 space-y-3">
                      {tenantCompanies.slice(0, 3).map(company => (
                        <div key={company.id} className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4 transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE]">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[15px] font-semibold text-[#111827]">{company.name}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">{formatDate(company.expiresAt)}</p>
                            </div>
                            <span className="text-[14px] font-semibold text-[#111827]">{formatCurrency(company.subscriptionPrice)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div data-super-companies-side-panel data-super-panel className={`${shellCardClass} p-6 transition-all duration-200 hover:border-[#DBEAFE]`}>
                    <div className="flex items-center gap-3 border-b border-[#EEF2F7] pb-4">
                      <Activity size={18} className="text-[#7C3AED]" />
                      <h3 className="text-[20px] font-semibold text-[#111827]">Actividad del tenant</h3>
                    </div>
                    <div className="mt-5 space-y-4">
                      {masterLogs.slice(0, 3).map(log => (
                        <div key={log.id} className="flex items-start gap-3 transition-all duration-200 hover:translate-x-1">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                            <Activity size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold leading-tight text-[#111827]">{log.action}</p>
                            <p className="mt-1 text-[13px] font-medium leading-6 text-[#6B7280]">{log.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
            </>
          )
        ) : null}
        {activeTab === 'GLOBAL_USERS' ? (
          <section className="space-y-5">
            <div data-super-hero>
              <PlatformPageHeader
                title="Usuarios"
                description="Gestiona el equipo interno, usuarios de empresas, invitaciones, roles, permisos y sesiones activas."
                actions={usersHeaderActions}
              />
            </div>
            <div data-super-panel className={`${shellCardClass} overflow-visible`}>
              <div data-super-tabs data-super-users-tabs className="flex flex-col gap-4 border-b border-[#E5E7EB] px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="hidden xl:flex xl:flex-wrap xl:gap-3" role="tablist" aria-label="Subvistas de Usuarios">
                  {usersManagementTabs.map(tab => {
                    const active = usersManagementTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-controls={`super-admin-users-${tab.id.toLowerCase()}`}
                        onClick={() => navigateToUsersTab(tab.id)}
                        className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                          active ?
                             'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                            : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                        }`}
                      >
                        <Icon size={15} className={active ? 'text-[#2563EB]' : 'text-[#64748B]'} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="overflow-x-auto xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Subvistas de Usuarios">
                  <div className="flex min-w-max items-center gap-2 whitespace-nowrap pb-1">
                    {usersManagementTabs.map(tab => {
                      const active = usersManagementTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          aria-controls={`super-admin-users-${tab.id.toLowerCase()}`}
                          onClick={() => navigateToUsersTab(tab.id)}
                          className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                            active ?
                               'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                              : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                          }`}
                        >
                          <Icon size={15} className={active ? 'text-[#2563EB]' : 'text-[#64748B]'} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                    <div className="flex flex-wrap gap-3">
                  {usersSubviewActions.map(action => {
                    const Icon = action.icon;
                    const actionClass = action.variant === 'primary' ? platformHeaderPrimaryActionClass : `${platformHeaderSecondaryActionClass} ${motionButtonClass}`;
                    return (
                      <button key={action.label} type="button" onClick={action.onClick} className={`${actionClass} h-11 px-4 text-[13px]`}>
                        {Icon ? <Icon size={15} /> : null}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div id={`super-admin-users-${usersManagementTab.toLowerCase()}`} role="tabpanel" className="p-6 transition-all duration-200">
                {usersManagementTab === 'SAAS_TEAM' ? (
                  <div className="space-y-6">
                    <div data-super-hero>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Equipo interno</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Operadores internos de ABUNDRA</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Miembros internos con acceso administrativo, soporte, facturación, auditoría y operación global de la plataforma.
                      </p>
                    </div>
                    <div data-super-panel data-super-users-panel>
                      <PlatformKpiGrid items={saasTeamKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    </div>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
                      <div className="space-y-6">
                      <div data-super-filters className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-end">
                        <div className="relative w-full max-w-[380px]">
                          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                          <input
                            value={usersSearchTerm}
                            onChange={event => setUsersSearchTerm(event.target.value)}
                            placeholder="Buscar por nombre, correo, rol o área..."
                            className={`${filterFieldClass} w-full pl-11 pr-4 text-[#111827] placeholder:text-[#9CA3AF]`}
                          />
                        </div>
                      </div>
                      <SaasTeamDirectory
                        rows={filteredSaasMembers}
                        totalRows={saasTeamMembers.length}
                        isLoading={usersKpiState.isLoading}
                        error={usersKpiState.error}
                        onAction={handleSaasMemberAction}
                        activeActionsDropdown={activeActionsDropdown}
                        dropdownCoords={dropdownCoords}
                        openContextMenu={openContextMenu}
                      />
                    </div>
                    <div className="space-y-5">
                      <SidebarInfoCard title="Control y seguridad" icon={ShieldCheck}>
                        <SummaryRow label="Alcance esperado" value="Interno / sin empresa asignada" tone="blue" />
                        <SummaryRow label="Acciones auditables" value="100% registradas" tone="success" />
                        <SummaryRow label="Revocación rápida" value="Disponible" tone="neutral" />
                      </SidebarInfoCard>
                      <SidebarInfoCard title="Acciones sensibles" icon={ShieldAlert}>
                        <ActionListItem icon={UserCog} title="Editar permisos" detail="Ajusta alcance operativo, soporte e impersonación por contexto." />
                        <ActionListItem icon={Activity} title="Revocar sesiones" detail="Corta accesos activos en incidentes o cambios de seguridad." />
                        <ActionListItem icon={RefreshCw} title="Forzar cambio de contraseña" detail="Aplica rotación inmediata a miembros con acceso crítico." />
                      </SidebarInfoCard>
                    </div>
                    </div>
                  </div>
                ) : null}
                {usersManagementTab === 'TENANT_USERS' ? (
                  <div className="space-y-6">
                    <div data-super-hero>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Usuarios de Empresas</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Usuarios registrados dentro de empresas</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Consulta usuarios registrados en empresas, sus roles, sucursales, estado y actividad dentro de la plataforma.
                      </p>
                    </div>
                    <div data-super-panel>
                      <PlatformKpiGrid items={tenantUserKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    </div>
                    <div className="space-y-6">
                      <div data-super-filters>
                          <UsersFilterBar
                            searchValue={usersSearchTerm}
                            onSearchChange={setUsersSearchTerm}
                            searchPlaceholder="Buscar por nombre, correo, teléfono, empresa o código interno..."
                            filters={tenantFilterConfigs}
                            activeDropdown={activeUsersFilterDropdown}
                            onToggleDropdown={setActiveUsersFilterDropdown}
                            onClear={resetTenantUserFilters}
                            activeCount={tenantActiveFiltersCount}
                            resultLabel={`${filteredTenantUsers.length} usuarios visibles`}
                          />
                      </div>
                      <TenantUsersDirectory
                        rows={paginatedTenantUsers}
                        totalRows={sortedTenantUsers.length}
                        baseRows={tenantUsersRows.length}
                        isLoading={tenantUsersLoading}
                        error={tenantUsersError}
                        permissionError={tenantUsersPermissionError}
                        sort={tenantUsersSort}
                        onSort={handleTenantUsersSort}
                        page={safeTenantUsersPage}
                        totalPages={tenantUsersTotalPages}
                        visiblePages={visibleTenantUserPages}
                        onPageChange={setTenantUsersPage}
                        onAction={handleTenantUserAction}
                        activeActionsDropdown={activeActionsDropdown}
                        dropdownCoords={dropdownCoords}
                        openContextMenu={openContextMenu}
                        canUseSupportAccess={canUseSupportAccess}
                      />
                      </div>
                      <div className="grid grid-cols-1 gap-5">
                        <SidebarInfoCard title="Usuarios en foco" icon={ShieldAlert}>
                          {tenantUsersInFocus.map(item => (
                            <SummaryRow
                              key={item.label}
                              label={item.label}
                              value={item.detail}
                              tone={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'neutral' : item.tone === 'blue' ? 'blue' : 'neutral'}
                            />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Lectura operativa" icon={Activity}>
                          {tenantRecentAccesses.map(access => (
                            <ActionListItem
                              key={access.id}
                              icon={UserIcon}
                              title={access.user}
                              detail={`${access.company}  ${access.time}  ${access.channel}`}
                            />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Seguridad y cumplimiento" icon={ShieldCheck}>
                          {usersSecuritySummary.map(item => (
                            <SummaryRow
                              key={item.label}
                              label={item.label}
                              value={item.value}
                              tone={item.tone === 'danger' ? 'danger' : item.tone === 'blue' ? 'blue' : 'neutral'}
                            />
                          ))}
                        </SidebarInfoCard>
                      </div>
                      <TenantUserDetailDrawer
                        user={selectedTenantUser}
                        open={tenantUserDrawerOpen}
                        onClose={() => setTenantUserDrawerOpen(false)}
                        onAction={handleTenantUserAction}
                        activityItems={selectedTenantUserActivity}
                        sessionItems={selectedTenantUserSessions}
                        auditItems={selectedTenantUserAudit}
                      />
                      <SessionDetailDrawer
                        session={selectedSession}
                        open={sessionDrawerOpen}
                        onClose={() => setSessionDrawerOpen(false)}
                        onAction={handleSessionAction}
                      />
                  </div>
                ) : null}
                {usersManagementTab === 'INVITATIONS' ? (
                  <div className="space-y-6">
                    <div data-super-hero>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Invitaciones</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Accesos pendientes y gestionados</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Centraliza invitaciones del equipo interno y de usuarios de empresas con estado, rol y trazabilidad.
                      </p>
                    </div>
                    <div data-super-panel>
                      <PlatformKpiGrid items={invitationKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    </div>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1.7fr)_360px]">
                      <div className="contents">
                        <div data-super-filters className="xl:col-span-2">
                          <UsersFilterBar
                            searchValue={invitationSearchTerm}
                            onSearchChange={setInvitationSearchTerm}
                            searchPlaceholder="Buscar por correo..."
                            filters={invitationFilterConfigs}
                            activeDropdown={activeUsersFilterDropdown}
                            onToggleDropdown={setActiveUsersFilterDropdown}
                            onClear={resetInvitationFilters}
                            activeCount={invitationActiveFiltersCount}
                            resultLabel={`${filteredInvitationRows.length} invitaciones visibles`}
                          />
                        </div>
                        <InvitationDirectory
                          rows={filteredInvitationRows}
                          totalRows={invitationRows.length}
                          isLoading={usersKpiState.isLoading}
                          error={usersKpiState.error}
                          onAction={handleInvitationAction}
                          activeActionsDropdown={activeActionsDropdown}
                          dropdownCoords={dropdownCoords}
                          openContextMenu={openContextMenu}
                        />
                        <div className="hidden">
                          <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
                            <div>
                              <h4 className="text-[18px] font-semibold text-[#111827]">Bandeja de invitaciones</h4>
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Controla aceptación, expiración y revocación desde un mismo flujo.</p>
                            </div>
                            <button type="button" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
                              <Plus size={15} />
                              Nueva invitación
                            </button>
                          </div>
                          <div>
                            <div>
                              <div className="grid grid-cols-[minmax(0,1.45fr)_0.74fr_minmax(0,0.96fr)_0.86fr_0.68fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                                <div>Correo</div>
                                <div>Tipo</div>
                                <div>Invitado por</div>
                                <div>Empresa / rol</div>
                                <div>Estado</div>
                                <div className="text-center">Acc.</div>
                              </div>
                              <div className="divide-y divide-[#EEF2F7]">
                                {filteredInvitationRows.map(item => {
                                  const menuId = `invite-${item.id}`;
                                  return (
                                    <div key={item.id} className="group grid grid-cols-[minmax(0,1.45fr)_0.74fr_minmax(0,0.96fr)_0.86fr_0.68fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]">
                                      <div className="truncate text-[14px] font-semibold text-[#111827] transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-[#2563EB]">{item.email}</div>
                                      <div>
                                        <StatusBadge label={item.type} tone={item.type === 'Equipo SaaS' ? 'blue' : 'neutral'} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-[14px] font-semibold text-[#475569]">{item.invitedBy}</p>
                                        <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{item.date}</p>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-[14px] font-semibold text-[#111827]">{item.company}</p>
                                        <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{item.role}</p>
                                      </div>
                                      <div>
                                        <StatusBadge label={item.status} tone={item.status === 'Aceptada' ? 'success' : item.status === 'Pendiente' ? 'warning' : item.status === 'Revocada' ? 'danger' : 'neutral'} />
                                      </div>
                                      <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={event => openContextMenu(event, menuId)}
                                          className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${
                                            activeActionsDropdown === menuId ?
                                               'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]'
                                              : 'border-[#E5E7EB] bg-white text-[#64748B] group-hover:border-[#DBEAFE] group-hover:bg-[#F8FBFF]'
                                          } ${motionButtonClass}`}
                                        >
                                          <MoreHorizontal size={16} />
                                        </button>
                                        {activeActionsDropdown === menuId && dropdownCoords && createPortal(
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: `${dropdownCoords.top}px`,
                                              left: `${dropdownCoords.left}px`,
                                            }}
                                            className="z-[9999] w-[220px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]"
                                            onClick={event => event.stopPropagation()}
                                          >
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                                              <RefreshCw size={16} className="text-[#2563EB]" />
                                              Reenviar
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                                              <Globe size={16} className="text-indigo-600" />
                                              Copiar enlace
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                                              <FileText size={16} className="text-slate-500" />
                                              Ver detalle
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-rose-50 hover:text-rose-700">
                                              <ShieldAlert size={16} className="text-rose-500" />
                                              Revocar
                                            </button>
                                          </div>,
                                          document.body,
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-5">
                        <SidebarInfoCard title="Atención inmediata" icon={Bell}>
                          {invitationSideCards.expiring.map(item => (
                            <ActionListItem key={item.id} icon={AlertTriangle} title={item.email} detail={`${item.company}  ${item.role}  ${item.status}`} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Conversión reciente" icon={CheckCircle2}>
                          {invitationSideCards.accepted.map(item => (
                            <ActionListItem key={item.id} icon={Users} title={item.email} detail={`${item.company} · ${item.role} · aceptada el ${item.date}`} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Atajos del flujo" icon={Sparkles}>
                          <ActionListItem icon={RefreshCw} title="Reenviar lote" detail="Reintenta invitaciones pendientes sin salir del módulo." />
                          <ActionListItem icon={ShieldCheck} title="Validar roles" detail="Comprueba que el acceso enviado coincide con el contexto del usuario." />
                          <ActionListItem icon={FileText} title="Auditar invitaciones" detail="Revisa trazabilidad completa para cumplimiento y soporte." />
                        </SidebarInfoCard>
                      </div>
                    </div>
                  </div>
                ) : null}
                {usersManagementTab === 'ROLES' ? (
                  <div className="space-y-6">
                    <div data-super-hero>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Roles y Permisos</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Permisos separados por contexto</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Define claramente permisos internos y permisos por empresa sin mezclar responsabilidades entre ABUNDRA y las empresas cliente.
                      </p>
                    </div>
                    <div data-super-panel>
                      <PlatformKpiGrid items={rolePermissionKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    </div>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
                      <div className="space-y-5">
                        <RolePermissionsList 
                          roleCards={roleCards}
                          onAction={handleRoleAction}
                          activeActionsDropdown={activeActionsDropdown}
                          dropdownCoords={dropdownCoords}
                          openContextMenu={openContextMenu}
                        />
                        <RolePermissionMatrix permissionMatrix={permissionMatrix} onAction={handleRoleAction} />
                      </div>
                      <div className="hidden">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                              <Crown size={20} />
                          </div>
                          <div>
                              <h4 className="text-[20px] font-semibold text-[#111827]">Roles internos</h4>
                            <p className="text-[14px] font-medium text-[#6B7280]">Usuarios internos que operan y soportan la plataforma.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {roleCards.saas.map(card => (
                            <div key={card.role} className={`${shellCardClass} p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h5 className="text-[18px] font-semibold text-[#111827]">{card.role}</h5>
                                  <p className="mt-1 text-[14px] font-medium text-[#6B7280]">{card.users} usuarios asignados</p>
                                </div>
                                <StatusBadge label="Interno" tone="blue" />
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {card.permissions.map(permission => (
                                  <span key={permission} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#475569]">
                                    {permission}
                                  </span>
                                ))}
                              </div>
                              <button type="button" className={`mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827]  ${motionButtonClass}`}>
                                <ShieldCheck size={16} />
                                Editar permisos
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <h4 className="text-[20px] font-semibold text-[#111827]">Roles de empresas</h4>
                              <p className="text-[14px] font-medium text-[#6B7280]">Usuarios ligados a empresa y operación diaria de cada cliente.</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            {roleCards.tenant.map(card => (
                              <div key={card.role} className={`${shellCardClass} p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <h5 className="text-[18px] font-semibold text-[#111827]">{card.role}</h5>
                                    <p className="mt-1 text-[14px] font-medium text-[#6B7280]">{card.users} usuarios asignados</p>
                                  </div>
                                  <StatusBadge label="Empresa" tone="success" />
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {card.permissions.map(permission => (
                                    <span key={permission} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#475569]">
                                      {permission}
                                    </span>
                                  ))}
                                </div>
                                <button type="button" className={`mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${motionButtonClass}`}>
                                  <ShieldCheck size={16} />
                                  Editar permisos
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-5">
                        <SidebarInfoCard title="Resumen visual" icon={ShieldCheck}>
                          <SummaryRow label="Admins empresa" value={`${roleCounts.admins}`} tone="blue" />
                          <SummaryRow label="Supervisores" value={`${roleCounts.supervisors}`} tone="neutral" />
                          <SummaryRow label="Cobradores" value={`${roleCounts.collectors}`} tone="neutral" />
                          <SummaryRow label="Separación interno/empresa" value="Correcta" tone="success" />
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Arquitectura de permisos" icon={Sparkles}>
                          <ActionListItem icon={Crown} title="Permisos internos" detail="Asegura alcance sobre empresas, auditoría, soporte e ingresos globales." />
                          <ActionListItem icon={Building2} title="Permisos por empresa" detail="Evita mezclar operación de clientes con control de la plataforma." />
                          <ActionListItem icon={ShieldAlert} title="Revisión de riesgos" detail="Prioriza permisos sensibles antes de delegar acceso administrativo." />
                        </SidebarInfoCard>
                      </div>
                    </div>
                  </div>
                ) : null}
                {usersManagementTab === 'SESSIONS' ? (
                  <div className="space-y-6">
                    <div data-super-hero>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Sesiones</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Control de accesos activos</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Visualiza sesiones internas y de empresas, identifica actividad sospechosa y revoca accesos en tiempo real.
                      </p>
                    </div>
                    <div data-super-panel>
                      <PlatformKpiGrid items={sessionKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    </div>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1.7fr)_360px]">
                      <div className="contents">
                        <div data-super-filters className="xl:col-span-2">
                          <UsersFilterBar
                            searchValue={sessionSearchTerm}
                            onSearchChange={setSessionSearchTerm}
                            searchPlaceholder="Buscar por usuario, IP, dispositivo, empresa o ubicación..."
                            filters={sessionFilterConfigs}
                            activeDropdown={activeUsersFilterDropdown}
                            onToggleDropdown={setActiveUsersFilterDropdown}
                            onClear={resetSessionFilters}
                            activeCount={sessionActiveFiltersCount}
                            resultLabel={`${filteredSessionRows.length} sesiones visibles`}
                          />
                        </div>
                        <SessionDirectory
                          rows={filteredSessionRows}
                          totalRows={sessionRows.length}
                          isLoading={usersKpiState.isLoading}
                          error={usersKpiState.error}
                          onAction={handleSessionAction}
                          onHardenPolicies={() => setIsSessionPolicyModalOpen(true)}
                          activeActionsDropdown={activeActionsDropdown}
                          dropdownCoords={dropdownCoords}
                          openContextMenu={openContextMenu}
                        />
                        <div className="hidden">
                          <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
                            <div>
                              <h4 className="text-[18px] font-semibold text-[#111827]">Sesiones activas y trazabilidad</h4>
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Detecta accesos anómalos y responde sin salir del centro operativo.</p>
                            </div>
                            <button type="button" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
                              <ShieldCheck size={15} />
                              Endurecer políticas
                            </button>
                          </div>
                          <div>
                            <div>
                              <div className="grid grid-cols-[minmax(0,1.2fr)_0.56fr_minmax(0,0.82fr)_minmax(0,1fr)_0.72fr_0.66fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                                <div>Usuario</div>
                                <div>Tipo</div>
                                <div>Empresa</div>
                                <div>Dispositivo / IP</div>
                                <div>Última actividad</div>
                                <div>Estado</div>
                                <div className="text-center">Acc.</div>
                              </div>
                              <div className="divide-y divide-[#EEF2F7]">
                                {filteredSessionRows.map(session => {
                                  const menuId = `session-${session.id}`;
                                  return (
                                    <div key={session.id} className="group grid grid-cols-[minmax(0,1.2fr)_0.56fr_minmax(0,0.82fr)_minmax(0,1fr)_0.72fr_0.66fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]">
                                      <div className="truncate text-[14px] font-semibold text-[#111827] transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-[#2563EB]">{session.user}</div>
                                      <div>
                                        <StatusBadge label={session.type} tone={session.type === 'SaaS' ? 'blue' : 'neutral'} />
                                      </div>
                                      <div className="truncate text-[14px] font-medium text-[#475569]">{session.company}</div>
                                      <div className="min-w-0">
                                        <p className="truncate text-[14px] font-semibold text-[#475569]">{session.device}</p>
                                        <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{session.ip} ? {session.location}</p>
                                      </div>
                                      <div className="truncate text-[13px] font-medium text-[#6B7280]">{session.activity}</div>
                                      <div>
                                        <StatusBadge label={session.status} tone={session.status === 'Activa' ? 'success' : 'warning'} />
                                      </div>
                                      <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={event => openContextMenu(event, menuId)}
                                          className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${
                                            activeActionsDropdown === menuId ?
                                               'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]'
                                              : 'border-[#E5E7EB] bg-white text-[#64748B] group-hover:border-[#DBEAFE] group-hover:bg-[#F8FBFF]'
                                          } ${motionButtonClass}`}
                                        >
                                          <MoreHorizontal size={16} />
                                        </button>
                                        {activeActionsDropdown === menuId && dropdownCoords && createPortal(
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: `${dropdownCoords.top}px`,
                                              left: `${dropdownCoords.left}px`,
                                            }}
                                            className="z-[9999] w-[220px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]"
                                            onClick={event => event.stopPropagation()}
                                          >
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-purple-50 hover:text-purple-700">
                                              <RefreshCw size={16} className="text-purple-600" />
                                              Revocar sesión
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                                              <Activity size={16} className="text-slate-500" />
                                              Ver actividad
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-amber-50 hover:text-amber-700">
                                              <AlertTriangle size={16} className="text-amber-500" />
                                              Marcar sospechosa
                                            </button>
                                          </div>,
                                          document.body,
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-5">
                        <SidebarInfoCard title="Sesiones en observación" icon={ShieldAlert}>
                          {sessionSideSummary.suspicious.map(session => (
                            <ActionListItem key={session.id} icon={AlertTriangle} title={session.user} detail={`${session.company}  ${session.location}  ${session.activity}`} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Revocaciones recientes" icon={RefreshCw}>
                          {sessionSideSummary.revocations.map(item => (
                            <ActionListItem key={item.user} icon={RefreshCw} title={item.user} detail={item.detail} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Postura de seguridad" icon={ShieldCheck}>
                          <SummaryRow label="2FA forzado" value="Equipo interno" tone="success" />
                          <SummaryRow label="IPs sospechosas" value={`${filteredSessionRows.filter(session => session.status === 'Sospechosa').length}`} tone="danger" />
                          <SummaryRow label="Revocación inmediata" value="Disponible" tone="blue" />
                        </SidebarInfoCard>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
        {activeTab === 'PLANS' ? (
          <PlansDirectory
            plans={plans}
            tenantCompanies={tenantCompanies}
            setEditingPlan={setEditingPlan}
            setIsPlanModalOpen={setIsPlanModalOpen}
          />
        ) : null}
        {activeTab === 'BILLING' ? (
          <BillingDirectory
            billingSearchTerm={billingSearchTerm}
            setBillingSearchTerm={setBillingSearchTerm}
            billingStatusFilter={billingStatusFilter}
            setBillingStatusFilter={setBillingStatusFilter}
            tenantCompanies={tenantCompanies}
            filteredBillingRows={filteredBillingRows}
            billingRows={billingRows}
            metrics={metrics}
            onCompanyClick={(companyId) => {
              const company = tenantCompanies.find(c => c.id === companyId);
              if (company) {
                setSelectedCompanyDetail(company);
                setDetailTab('RESUMEN');
                navigateToSection('COMPANIES');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          />
        ) : null}
        {activeTab === 'REPORTS' ? (
          <GlobalReportsDirectory 
             tenantCompanies={tenantCompanies} 
             metrics={metrics} 
             tenantUsersRows={tenantUsersRows} 
             masterLogs={masterLogs} 
          />
        ) : null}
        {activeTab === 'AUDIT' ? (
          <section className="space-y-8 animate-[platform-fade-in_180ms_ease-out]">
            <div data-super-hero>
              <PlatformPageHeader
                title="Auditoría"
                description="Bitácora global de acciones críticas, cambios administrativos y eventos de seguridad."
                actions={[{
                  label: "Exportar log",
                  icon: Download,
                  onClick: () => {},
                  variant: "secondary"
                }]}
              />
            </div>
            
            <div data-super-panel className="relative z-40 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm mb-6">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(320px,1fr)_auto]">
                <FilterDropdown
                  value={auditFilter === 'Todos' ? '' : auditFilter}
                  onChange={(val) => { setAuditFilter(val || 'Todos'); setAuditPage(1); }}
                  placeholder="Tipo de evento"
                  options={[
                    { value: 'SYSTEM', label: 'Sistema' },
                    { value: 'SECURITY', label: 'Seguridad' },
                    { value: 'DATA', label: 'Datos' },
                  ]}
                />
                <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD] focus-within:shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
                  <Search size={18} className="text-[#6B7280]" />
                  <input
                    value={auditSearchTerm}
                    onChange={event => { setAuditSearchTerm(event.target.value); setAuditPage(1); }}
                    placeholder="Buscar por acción, detalle o trace id..."
                    className="w-full bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuditSearchTerm('');
                    setAuditFilter('Todos');
                    setAuditPage(1);
                  }}
                  className={`inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${motionButtonClass}`}
                >
                  <Filter size={18} />
                  Limpiar filtro
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <PlatformKpiCard
                label="Eventos Registrados"
                value={filteredMasterLogs.length.toString()}
                helper="Eventos totales de sistema"
                icon={Activity}
                trend="Estable"
                tone="blue"
              />
              <PlatformKpiCard
                label="Alertas Críticas"
                value={masterLogs.filter(log => /suspend|error|riesgo|crit/i.test(`${log.action} ${log.detail}`)).length.toString()}
                helper="Eventos de riesgo alto"
                icon={History}
                trend="Requiere atención"
                tone="rose"
              />
              <PlatformKpiCard
                label="Estado de Conexión"
                value="Streaming"
                helper="Canal de auditoría en vivo"
                icon={Activity}
                trend="Activa"
                tone="emerald"
              />
            </div>

            {/* Consola Terminal Premium - White Version */}
            <div className={`${shellCardClass} p-0 overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-6 py-4">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#64748B]" />
                  <span className="text-[13px] font-bold text-[#64748B] font-mono ml-2">master_audit_stream.log</span>
                </div>
                <div className="inline-flex rounded-lg bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#10B981] font-mono">
                  LIVE CONNECTION
                </div>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto p-6 text-[14px] leading-relaxed custom-scrollbar bg-[#F8FAFC]">
                {paginatedAuditLogs.map(log => {
                  let badgeColor = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'; // Default Gray
                  const action = log.action.toUpperCase();
                  if (action.includes('ERROR') || action.includes('SECURITY') || action.includes('DELETE') || action.includes('FAIL')) {
                    badgeColor = 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'; // Red
                  } else if (action.includes('CREATE') || action.includes('SUCCESS') || action.includes('ADD') || action.includes('NEW')) {
                    badgeColor = 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]'; // Green
                  } else if (action.includes('UPDATE') || action.includes('EDIT') || action.includes('MODIFY')) {
                    badgeColor = 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'; // Blue
                  } else if (action.includes('WARN') || action.includes('ALERT')) {
                    badgeColor = 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'; // Yellow
                  }
                  return (
                    <div key={log.id} data-super-row className="group p-5 rounded-2xl bg-white border border-[#E5E7EB] transition-all duration-200 hover:translate-x-1 hover:border-[#BFDBFE] hover:shadow-[0_8px_24px_rgba(37,99,235,0.06)]">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-bold border ${badgeColor}`}>
                              {log.action}
                            </span>
                            <span className="text-[#64748B] font-medium text-[13px] flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-[#CBD5E1]"></span>
                              {formatDate(log.timestamp)} a las {new Date(log.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[#334155] font-medium leading-relaxed pl-4 border-l-2 border-[#E2E8F0] text-[14.5px]">
                            {log.detail}
                          </p>
                        </div>
                        <div className="shrink-0 text-[#94A3B8] text-[12px] font-bold text-right pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          trace: <span className="font-mono text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded">{log.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Paginación */}
              <div className="flex flex-col gap-4 border-t border-[#E5E7EB] bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between rounded-b-3xl">
                <p className="text-[14px] font-medium text-[#6B7280]">Mostrando {(auditPage - 1) * 10 + 1} a {Math.min(auditPage * 10, filteredMasterLogs.length)} de {filteredMasterLogs.length} eventos</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAuditPage(prev => Math.max(1, prev - 1))} disabled={auditPage === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                    <ChevronLeft size={16} />
                  </button>
                  {visibleAuditPages.map(item => (
                    <button key={item} type="button" onClick={() => setAuditPage(item)} className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-[15px] font-medium ${item === auditPage ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]' : 'border border-transparent text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]'}`}>
                      {item}
                    </button>
                  ))}
                  <button type="button" onClick={() => setAuditPage(prev => Math.min(totalAuditPages, prev + 1))} disabled={auditPage === totalAuditPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
        {activeTab === 'SYSTEM' ? (
          <section className="space-y-6">
            <div data-super-hero>
              <PlatformPageHeader
                title="Configuración del Sistema"
                description="Mantenimiento global, versión del sistema y mensajes de difusión."
                actions={[
                  {
                    label: "Guardar configuración",
                    icon: Save,
                    onClick: handleUpdateConfig,
                    variant: "primary"
                  }
                ]}
              />
            </div>
            
            <div className="space-y-6">
              {/* Row 1: Full width Maintenance Mode */}
              <div data-super-panel className={`relative overflow-hidden ${shellCardClass} p-8`}>
                <div className="relative flex flex-wrap items-center gap-3 border-b border-[#E5E7EB] pb-5">
                  <span className="inline-flex rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">
                    Flow Designer
                  </span>
                  <span className="inline-flex rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold text-[#64748B]">
                    Kernel operativo
                  </span>
                </div>
                <div className="relative mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-all duration-200 ${
                      platformConfig.maintenanceMode ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'
                    }`}>
                      {platformConfig.maintenanceMode ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                    </div>
                    <div>
                      <p className="text-[19px] font-black tracking-tight text-[#111827] leading-tight">Modo Mantenimiento Global</p>
                      <p className="text-[14px] font-medium text-[#64748B] mt-1">Control global para restringir acceso temporalmente a todos los tenants.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlatformConfig(current => ({ ...current, maintenanceMode: !current.maintenanceMode }))}
                    className={`inline-flex h-12 shrink-0 items-center justify-center rounded-2xl px-8 text-[14px] font-bold transition-all cursor-pointer ${
                      platformConfig.maintenanceMode ?
                         'border border-red-200 bg-red-50 text-red-600 hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-[0_12px_28px_rgba(220,38,38,0.12)]'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-600 hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-[0_12px_28px_rgba(22,163,74,0.12)]'
                    }`}
                  >
                    {platformConfig.maintenanceMode ? 'Activo' : 'Desactivado'}
                  </button>
                </div>
                <div className="relative mt-6 grid gap-4 sm:grid-cols-3">
                  <div data-super-kpi className="rounded-[22px] border border-[#E5E7EB] bg-[#F8FAFC] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Flow activo</p>
                    <p className="mt-2 text-[17px] font-black tracking-tight text-[#111827]">Publicacion estable</p>
                    <p className="mt-1 text-[13px] font-medium text-[#64748B]">Reglas globales sincronizadas</p>
                  </div>
                  <div data-super-kpi className="rounded-[22px] border border-[#E5E7EB] bg-[#F8FAFC] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Ultimo push</p>
                    <p className="mt-2 text-[17px] font-black tracking-tight text-[#111827]">{platformConfig.maintenanceDate || 'Sin fecha'}</p>
                    <p className="mt-1 text-[13px] font-medium text-[#64748B]">Ventana programada del kernel</p>
                  </div>
                  <div data-super-kpi className="rounded-[22px] border border-[#E5E7EB] bg-[#F8FAFC] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Version core</p>
                    <p className="mt-2 text-[17px] font-black tracking-tight text-[#111827]">{platformConfig.systemVersion}</p>
                    <p className="mt-1 text-[13px] font-medium text-[#64748B]">Branch operativo del sistema</p>
                  </div>
                </div>
              </div>

              {/* Row 2: 3-column grid for remaining cards */}
              <div className="grid gap-6 xl:grid-cols-3 items-start">
                
                {/* Variables del Entorno */}
                <div data-super-panel className={`${shellCardClass} p-8`}>
                  <div className="flex items-center gap-3 border-b border-[#E5E7EB] pb-5 mb-6">
                    <Settings size={22} className="text-[#2563EB]" />
                    <h2 className="text-[18px] font-black tracking-tight text-[#111827]">Entorno</h2>
                  </div>
                  <div className="space-y-6">
                    <FieldBlock label="Difusión (Broadcast)">
                      <input
                        value={platformConfig.broadcastMessage}
                        onChange={event => setPlatformConfig(current => ({ ...current, broadcastMessage: event.target.value }))}
                        className={premiumInputClass}
                        placeholder="Mensaje global..."
                      />
                    </FieldBlock>
                    <FieldBlock label="Mantenimiento">
                      <PlatformDateField
                        value={platformConfig.maintenanceDate}
                        onChange={value => setPlatformConfig(current => ({ ...current, maintenanceDate: value }))}
                        placeholder="Fecha"
                      />
                    </FieldBlock>
                    <FieldBlock label="Versión">
                      <input
                        value={platformConfig.systemVersion}
                        onChange={event => setPlatformConfig(current => ({ ...current, systemVersion: event.target.value }))}
                        className={premiumInputClass}
                      />
                    </FieldBlock>
                  </div>
                </div>

                {/* Estado del Kernel */}
                <div data-super-panel>
                  <SidebarInfoCard title="Estado" icon={Activity}>
                    <SummaryRow label="Core" value={platformConfig.systemVersion} tone="blue" />
                    <SummaryRow label="Mantenimiento" value={platformConfig.maintenanceMode ? 'Activo' : 'Desactivado'} tone={platformConfig.maintenanceMode ? 'danger' : 'success'} />
                    <SummaryRow label="Broadcast" value={platformConfig.broadcastMessage || 'Sin mensaje activo'} tone="neutral" />
                  </SidebarInfoCard>
                </div>

                {/* Acciones del Diseñador */}
                <div data-super-panel className={`${shellCardClass} p-8`}>
                  <div className="flex items-center gap-3 border-b border-[#E5E7EB] pb-5 mb-6">
                    <Terminal size={22} className="text-[#2563EB]" />
                    <h3 className="text-[18px] font-black tracking-tight text-[#111827]">Acciones</h3>
                  </div>
                  <div className="space-y-3">
                    <button type="button" onClick={() => navigateToSection('AUDIT')} className={`flex h-[52px] w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-5 text-left text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
                      <span>Revisar auditoría</span>
                      <ArrowUpRight size={16} className="text-[#64748B]" />
                    </button>
                    <button type="button" className={`flex h-[52px] w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-5 text-left text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
                      <span>Validar publicacion</span>
                      <CheckCircle2 size={16} className="text-[#64748B]" />
                    </button>
                    <button type="button" className={`flex h-[52px] w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-5 text-left text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
                      <span>Preparar ventana</span>
                      <Calendar size={16} className="text-[#64748B]" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </section>
        ) : null}
        {activeTab === 'HELP' ? (
          <section className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
            <PlatformPageHeader
              title="Centro de Ayuda"
              description="Soporte para empresas, material de onboarding y atencion operativa del SaaS."
            />
            <HelpCenterTab />
          </section>
        ) : null}
        {isSessionPolicyModalOpen ? (
          <ModalFrame title="Endurecer políticas de sesión" onClose={() => setIsSessionPolicyModalOpen(false)}>
            <form onSubmit={handleSaveSessionPolicy} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <FieldBlock label="Duración máxima (horas)">
                  <input type="number" min={1} value={sessionPolicy.maxDurationHours} onChange={event => setSessionPolicy(current => ({ ...current, maxDurationHours: Number(event.target.value) }))} className={premiumInputClass} />
                </FieldBlock>
                <FieldBlock label="Inactividad (min)">
                  <input type="number" min={5} value={sessionPolicy.inactivityMinutes} onChange={event => setSessionPolicy(current => ({ ...current, inactivityMinutes: Number(event.target.value) }))} className={premiumInputClass} />
                </FieldBlock>
                <FieldBlock label="Sesiones simultáneas">
                  <input type="number" min={1} value={sessionPolicy.maxConcurrentSessions} onChange={event => setSessionPolicy(current => ({ ...current, maxConcurrentSessions: Number(event.target.value) }))} className={premiumInputClass} />
                </FieldBlock>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <PolicyToggle label="Exigir 2FA interno" checked={sessionPolicy.requireSaas2fa} onChange={value => setSessionPolicy(current => ({ ...current, requireSaas2fa: value }))} />
                <PolicyToggle label="Exigir 2FA a Admin Empresa" checked={sessionPolicy.requireTenantAdmin2fa} onChange={value => setSessionPolicy(current => ({ ...current, requireTenantAdmin2fa: value }))} />
                <PolicyToggle label="Revocar al cambiar contraseña" checked={sessionPolicy.revokeOnPasswordChange} onChange={value => setSessionPolicy(current => ({ ...current, revokeOnPasswordChange: value }))} />
                <PolicyToggle label="Revocar al suspender" checked={sessionPolicy.revokeOnSuspend} onChange={value => setSessionPolicy(current => ({ ...current, revokeOnSuspend: value }))} />
                <PolicyToggle label="Alertas de dispositivo nuevo" checked={sessionPolicy.newDeviceAlerts} onChange={value => setSessionPolicy(current => ({ ...current, newDeviceAlerts: value }))} />
              </div>
              <FieldBlock label="IP bloqueadas">
                <textarea value={sessionPolicy.blockedIps} onChange={event => setSessionPolicy(current => ({ ...current, blockedIps: event.target.value }))} className={`${premiumInputClass} min-h-[98px] py-4`} placeholder="Separar IPs por coma..." />
              </FieldBlock>
              <div className="rounded-[22px] border border-[#FDE68A] bg-[#FFFBEB] p-4 text-[13px] font-semibold leading-6 text-[#B45309]">
                Estas políticas quedan listas para validación backend, auditoría y enforcement real. No se revocan sesiones de forma silenciosa.
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsSessionPolicyModalOpen(false)} className={`${platformHeaderSecondaryActionClass} h-12 px-5`}>
                  Cancelar
                </button>
                <button type="submit" className={`${platformHeaderPrimaryActionClass} h-12 px-5`}>
                  <ShieldCheck size={16} />
                  Guardar políticas
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}
        {isSaasMemberModalOpen ? (
          <ModalFrame title="Nuevo miembro interno" onClose={() => setIsSaasMemberModalOpen(false)}>
            <form onSubmit={handleCreateSaasMemberInvitation} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Nombre">
                  <input value={saasMemberForm.name} onChange={event => setSaasMemberForm(current => ({ ...current, name: event.target.value }))} className={premiumInputClass} placeholder="Nombre completo" />
                </FieldBlock>
                <FieldBlock label="Correo">
                  <input type="email" value={saasMemberForm.email} onChange={event => setSaasMemberForm(current => ({ ...current, email: event.target.value }))} className={premiumInputClass} placeholder="usuario@abundra.com" />
                </FieldBlock>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Teléfono">
                  <input value={saasMemberForm.phone} onChange={event => setSaasMemberForm(current => ({ ...current, phone: event.target.value }))} className={premiumInputClass} placeholder="809-000-0000" />
                </FieldBlock>
                <FieldBlock label="Rol">
                  <FilterDropdown
                    value={saasMemberForm.role}
                    onChange={value => setSaasMemberForm(current => ({ ...current, role: (value || 'Soporte') as SaasRole }))}
                    placeholder="Seleccionar rol"
                    options={SAAS_ROLES.filter(role => role !== 'Owner SaaS').map(role => ({ value: role, label: getVisibleInternalRoleLabel(role) }))}
                  />
                </FieldBlock>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Expiración de invitación">
                  <PlatformDateField
                    value={saasMemberForm.expiresAt}
                    onChange={value => setSaasMemberForm(current => ({ ...current, expiresAt: value }))}
                    placeholder="dd/mm/aaaa"
                    required
                  />
                </FieldBlock>
                <FieldBlock label="Seguridad">
                  <label className="flex h-[56px] cursor-pointer items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[15px] font-semibold text-[#111827] transition-all duration-200 hover:border-[#BFDBFE] hover:bg-[#F8FBFF]">
                    <span>Requerir 2FA</span>
                    <input type="checkbox" checked={saasMemberForm.requireTwoFactor} onChange={event => setSaasMemberForm(current => ({ ...current, requireTwoFactor: event.target.checked }))} className="h-4 w-4 accent-[#2563EB]" />
                  </label>
                </FieldBlock>
              </div>
              <FieldBlock label="Mensaje opcional">
                <textarea value={saasMemberForm.message} onChange={event => setSaasMemberForm(current => ({ ...current, message: event.target.value }))} className={`${premiumInputClass} min-h-[110px] py-4`} placeholder="Mensaje para acompañar la invitación..." />
              </FieldBlock>
              <div className="rounded-[22px] border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-[13px] font-semibold leading-6 text-[#1D4ED8]">
                Esta acción crea una invitación interna con token de un solo uso, expiración obligatoria y usuario pendiente hasta aceptación.
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsSaasMemberModalOpen(false)} className={`${platformHeaderSecondaryActionClass} h-12 px-5`}>
                  Cancelar
                </button>
                <button type="submit" className={`${platformHeaderPrimaryActionClass} h-12 px-5`}>
                  <Plus size={16} />
                  Crear invitación
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}
        {isTenantInvitationModalOpen ? (
          <ModalFrame title="Nueva invitación de empresa" onClose={() => setIsTenantInvitationModalOpen(false)}>
            <form onSubmit={handleCreateTenantInvitation} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Correo">
                  <input
                    type="email"
                    value={tenantInvitationForm.email}
                    onChange={event => setTenantInvitationForm(current => ({ ...current, email: event.target.value }))}
                    className={premiumInputClass}
                    placeholder="usuario@empresa.com"
                  />
                </FieldBlock>
                <FieldBlock label="Empresa">
                  <FilterDropdown
                    value={tenantInvitationForm.companyId}
                    onChange={companyId => {
                      const firstBranch = companyId ? tenantBranchesByCompany.get(companyId)?.[0] : null;
                      setTenantInvitationForm(current => ({ ...current, companyId, branchId: firstBranch.id || '' }));
                    }}
                    placeholder="Seleccionar empresa"
                    options={tenantCompanies.map(company => ({ value: company.id, label: company.name }))}
                  />
                </FieldBlock>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <FieldBlock label="Sucursal">
                  <FilterDropdown
                    value={tenantInvitationForm.branchId}
                    onChange={branchId => setTenantInvitationForm(current => ({ ...current, branchId }))}
                    disabled={!tenantInvitationCompany}
                    placeholder={tenantInvitationCompany ? 'Sin sucursal' : 'Selecciona empresa'}
                    options={tenantInvitationBranches.map(branch => ({ value: branch.id, label: branch.name }))}
                  />
                </FieldBlock>
                <FieldBlock label="Rol de empresa">
                  <FilterDropdown
                    value={tenantInvitationForm.role}
                    onChange={role => setTenantInvitationForm(current => ({ ...current, role: (role || Role.COBRADOR) as Role }))}
                    placeholder="Seleccionar rol"
                    options={TENANT_INVITATION_ROLES.map(role => ({ value: role, label: role }))}
                  />
                </FieldBlock>
                <FieldBlock label="Expiración">
                  <PlatformDateField
                    value={tenantInvitationForm.expiresAt}
                    onChange={value => setTenantInvitationForm(current => ({ ...current, expiresAt: value }))}
                    placeholder="dd/mm/aaaa"
                    required
                  />
                </FieldBlock>
              </div>
              <div className="rounded-[22px] border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-[13px] font-semibold leading-6 text-[#1D4ED8]">
                Esta invitación crea un acceso de empresa pendiente, con sucursal dependiente y rol de empresa, sin mezclarse con el equipo interno.
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsTenantInvitationModalOpen(false)} className={`${platformHeaderSecondaryActionClass} h-12 px-5`}>
                  Cancelar
                </button>
                <button type="submit" className={`${platformHeaderPrimaryActionClass} h-12 px-5`}>
                  <Bell size={16} />
                  Crear invitación
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}
        {isPlanModalOpen ? (
          <ModalFrame title={editingPlan ? `Editar plan: ${editingPlan.name}` : 'Crear nuevo plan'} onClose={() => { setIsPlanModalOpen(false); setEditingPlan(null); }}>
            <form onSubmit={handleUpdatePlan} className="space-y-5">
              <FieldBlock label="Nombre">
                <input name="name" defaultValue={editingPlan?.name || ''} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
              </FieldBlock>
              <div className="grid gap-4 md:grid-cols-3">
                <FieldBlock label="Max clientes">
                  <input name="maxClients" type="number" defaultValue={editingPlan?.maxClients || ''} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
                <FieldBlock label="Max usuarios">
                  <input name="maxUsers" type="number" defaultValue={editingPlan?.maxUsers || ''} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
                <FieldBlock label="Max sucursales">
                  <input name="maxBranches" type="number" defaultValue={editingPlan?.maxBranches || ''} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Precio mensual">
                  <input name="monthlyPrice" type="number" defaultValue={editingPlan?.monthlyPrice || ''} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
                <FieldBlock label="Precio anual">
                  <input name="yearlyPrice" type="number" defaultValue={editingPlan?.yearlyPrice || (editingPlan?.monthlyPrice ? editingPlan.monthlyPrice * 10 : '')} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="inline-flex h-[52px] items-center justify-center rounded-2xl bg-[#2563EB] px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]">
                  Guardar cambios
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}
        {isCompanyModalOpen ? (
          <ModalFrame title={editingCompany ? 'Editar empresa' : 'Aprovisionar empresa'} onClose={() => { setIsCompanyModalOpen(false); setEditingCompany(null); }}>
            <form onSubmit={handleProvision} className="space-y-5">
              <FieldBlock label="Nombre comercial">
                <input
                  required
                  value={provisionName}
                  onChange={event => setProvisionName(event.target.value)}
                  placeholder="Ej: ABUNDRA Capital"
                  className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                />
              </FieldBlock>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Plan">
                  <FilterDropdown
                    value={provisionPlanId}
                    onChange={(value) => {
                      setProvisionPlanId(value);
                      const selectedPlan = plans.find(plan => plan.id === value);
                      if (selectedPlan) {
                        setProvisionPrice(provisionCycle === 'YEARLY' ? (selectedPlan.yearlyPrice || selectedPlan.monthlyPrice * 10) : selectedPlan.monthlyPrice);
                      }
                    }}
                    options={plans.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Seleccionar plan"
                  />
                </FieldBlock>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Ciclo</label>
                    {provisionCycle === 'YEARLY' && yearlyDiscountPercent > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#16A34A]">
                        {yearlyDiscountPercent}% descuento
                      </span>
                    ) : null}
                  </div>
                  <FilterDropdown
                    value={provisionCycle}
                    onChange={(value) => {
                      const cycle = value as 'MONTHLY' | 'YEARLY';
                      setProvisionCycle(cycle);
                      const selectedPlan = plans.find(plan => plan.id === provisionPlanId);
                      if (selectedPlan) {
                        setProvisionPrice(cycle === 'YEARLY' ? (selectedPlan.yearlyPrice || selectedPlan.monthlyPrice * 10) : selectedPlan.monthlyPrice);
                      }
                    }}
                    options={[
                      { value: 'MONTHLY', label: 'Mensual' },
                      { value: 'YEARLY',  label: 'Anual' },
                    ]}
                    placeholder="Seleccionar ciclo"
                  />
                </div>
              </div>
              <FieldBlock label="Precio pactado">
                <input
                  type="number"
                  value={provisionPrice}
                  onChange={event => setProvisionPrice(Number(event.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                />
              </FieldBlock>
              <div className="rounded-[22px] border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[13px] font-medium leading-6 text-[#2563EB]">
                Crea o actualiza el tenant con plan, ciclo y precio pactado desde el panel Super Admin sin alterar contratos existentes.
              </div>
              <div className="flex justify-end">
                <button type="submit" className="inline-flex h-[52px] items-center justify-center rounded-2xl bg-[#2563EB] px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]">
                  {editingCompany ? 'Actualizar empresa' : 'Crear empresa'}
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}
      </div>
    );
  }
  return null;
};

const MetricCard = ({
  label,
  value,
  helper,
  trend,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  trend: string;
  tone: 'blue' | 'emerald' | 'amber' | 'danger';
  icon: SuperAdminIcon;
}) => {
  const toneMap = {
    blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]' },
    emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]' },
    amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]' },
    danger: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', note: 'text-[#DC2626]' },
  };
  const style = toneMap[tone];

  return (
    <div className={`${shellCardClass} relative overflow-hidden p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${style.iconWrap}`}>
          <Icon size={24} />
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${style.note}`}>
          <ArrowUpRight size={13} />
          {trend}
        </div>
      </div>
      <div className="mt-8">
        <p className="text-[15px] font-semibold text-[#111827]">{label}</p>
        <p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-[#111827]">{value}</p>
        <p className="mt-3 max-w-[220px] text-[14px] font-medium leading-6 text-[#6B7280]">{helper}</p>
      </div>
    </div>
  );
};

const SectionHeader = ({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h2 className="text-[28px] font-semibold tracking-tight text-[#111827]">{title}</h2>
      <p className="mt-2 text-[15px] font-medium leading-7 text-[#6B7280]">{description}</p>
    </div>
    {actionLabel ? (
      <button
        type="button"
        onClick={onAction}
        className={`inline-flex h-[50px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[14px] font-semibold text-[#111827] ${motionButtonClass}`}
      >
        <Download size={16} />
        {actionLabel}
      </button>
    ) : null}
  </div>
);

const SummaryRow = ({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'success' | 'danger' | 'neutral' }) => {
  const toneClass =
    tone === 'blue' ?
       'text-[#2563EB]'
      : tone === 'success' ?
         'text-[#16A34A]'
        : tone === 'danger' ?
           'text-[#DC2626]'
          : 'text-[#111827]';

  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E5E7EB] px-4 py-3">
      <p className="text-[14px] font-medium text-[#6B7280]">{label}</p>
      <span className={`text-[14px] font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
};

const ProgressRow = ({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-[#6B7280]">{label}</span>
      <span className="text-[13px] font-semibold text-[#111827]">{value}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
      <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
    </div>
  </div>
);

const InfoChip = ({
  icon: Icon,
  label,
}: {
  icon: SuperAdminIcon;
  label: string;
}) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#FCFDFF] px-3 py-1.5">
    <Icon size={14} className="text-[#2563EB]" />
    {label}
  </span>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[#E5E7EB] bg-[#FCFDFF] px-4 py-3 text-center">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{label}</p>
    <p className="mt-2 text-[22px] font-semibold text-[#111827]">{value}</p>
  </div>
);

const ExportRow = ({ title, detail }: { title: string; detail: string }) => (
  <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[15px] font-semibold text-[#111827]">{title}</p>
        <p className="mt-2 text-[14px] font-medium leading-7 text-[#6B7280]">{detail}</p>
      </div>
      <button type="button" className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#6B7280] ${motionButtonClass}`}>
        <Download size={16} />
      </button>
    </div>
  </div>
);

const UsersFilterDropdown = ({
  dropdownId,
  value,
  options,
  placeholder,
  disabled,
  isLoading,
  error,
  activeDropdown,
  onToggle,
  onSelect,
}: {
  dropdownId: string;
  value: string;
  placeholder: string;
  options: UsersFilterOption[];
  disabled?: boolean;
  isLoading?: boolean;
  error?: string;
  activeDropdown: string | null;
  onToggle: (dropdownId: string) => void;
  onSelect: (value: string) => void;
}) => {
  const isOpen = activeDropdown === dropdownId;
  const selected = options.find(option => option.value === value);
  const displayValue = selected?.label ?? placeholder;

  return (
    <div className={`relative ${isOpen ? 'z-[90]' : 'z-10'}`} onClick={event => event.stopPropagation()}>
      <button
        type="button"
        disabled={disabled || isLoading}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => onToggle(isOpen ? '' : dropdownId)}
        className={`flex h-[54px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left outline-none transition-all duration-200 ${
          disabled || isLoading ?
             'cursor-not-allowed border-[#E5E7EB] opacity-60'
            : isOpen ?
               'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
              : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-[#111827]">
          {isLoading ? 'Cargando opciones...' : displayValue}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#DC2626]">{error}</p> : null}
      {isOpen && !disabled && !isLoading ? (
        <div role="listbox" className="absolute left-0 top-[calc(100%+10px)] z-[100] w-max min-w-[260px] max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          {options.map(option => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSelect(option.value);
                  onToggle('');
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 ${
                  selected ?
                     'bg-[#EFF6FF] text-[#2563EB]'
                    : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {selected ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2563EB] shadow-[0_0_0_4px_rgba(37,99,235,0.08)]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const UsersFilterBar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeDropdown,
  onToggleDropdown,
  onClear,
  activeCount,
  resultLabel,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters: UsersFilterConfig[];
  activeDropdown: string | null;
  onToggleDropdown: (dropdownId: string) => void;
  onClear: () => void;
  activeCount: number;
  resultLabel: string;
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const searchControl = (
    <div className="relative min-w-0">
      <label className="sr-only">Buscar</label>
      <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
      <input
        type="text"
        value={searchValue}
        onChange={event => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-[54px] w-full rounded-2xl border border-[#E5E7EB] bg-white pl-12 pr-4 text-[16px] font-medium text-[#111827] outline-none placeholder:text-[#9CA3AF] transition-all duration-200 focus:border-[#93C5FD] focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
      />
    </div>
  );

  const renderFilter = (filter: UsersFilterConfig) => (
    <div key={filter.id} className="min-w-0">
      <label className="sr-only">{filter.label}</label>
      <UsersFilterDropdown
        dropdownId={filter.id}
        value={filter.value}
        placeholder={filter.placeholder}
        options={filter.options}
        disabled={filter.disabled}
        isLoading={filter.isLoading}
        error={filter.error}
        activeDropdown={activeDropdown}
        onToggle={onToggleDropdown}
        onSelect={filter.onChange}
      />
    </div>
  );

  return (
    <section className="relative z-40 rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="hidden gap-4 xl:grid xl:grid-cols-[minmax(280px,1.35fr)_repeat(3,minmax(170px,0.78fr))] 2xl:grid-cols-[minmax(320px,1.5fr)_repeat(4,minmax(170px,0.82fr))_auto]">
        {searchControl}
        {filters.slice(0, 4).map(renderFilter)}
        <ClearFiltersButton onClick={onClear} />
      </div>

      {filters.length > 4 ? (
        <div className="mt-4 hidden gap-4 xl:grid xl:grid-cols-3 2xl:grid-cols-[repeat(3,minmax(170px,0.82fr))_1fr]">
          {filters.slice(4).map(renderFilter)}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 xl:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex h-[54px] w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[16px] font-medium text-[#111827] shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:text-[#2563EB]"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-[#2563EB]" />
            Filtros
          </span>
          <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[12px] font-black text-[#2563EB]">{activeCount}</span>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#EEF2F7] pt-4">
        <div className="flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#64748B]">
          <Filter size={14} className="text-[#2563EB]" />
          {resultLabel}
        </div>
        {activeCount > 0 ? (
          <div className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-[12px] font-semibold text-[#2563EB]">
            {activeCount} filtros activos
          </div>
        ) : null}
        <div className="hidden sm:ml-auto sm:block xl:hidden">
          <ClearFiltersButton onClick={onClear} />
        </div>
      </div>

      {isMobileOpen ?
         createPortal(
            <div className="fixed inset-0 z-[9998] bg-[#0F172A]/35 p-4 backdrop-blur-sm xl:hidden" role="dialog" aria-modal="true">
              <div className="absolute inset-x-4 bottom-4 max-h-[82vh] overflow-y-auto rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Filtros</p>
                    <h4 className="mt-1 text-[22px] font-semibold text-[#111827]">Refinar listado</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileOpen(false);
                      onToggleDropdown('');
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B]"
                    aria-label="Cerrar filtros"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {searchControl}
                  {filters.map(renderFilter)}
                  <ClearFiltersButton onClick={onClear} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
};

const FieldBlock = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{label}</label>
    {children}
  </div>
);

const PolicyToggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#BFDBFE] hover:bg-[#F8FBFF]">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-[#2563EB]" />
  </label>
);

const ModalFrame = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div data-super-modal-overlay className="fixed inset-0 z-[500] flex items-center justify-center bg-[#0F172A]/45 px-4 py-6 backdrop-blur-[2px]">
    <div data-super-modal-card className="w-full max-w-2xl overflow-visible rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-6 py-5">
        <h3 className="text-[22px] font-semibold tracking-tight text-[#111827]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#6B7280] transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  </div>
);

const getCompanyTone = (status: Company['status']): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'TRIAL') return 'warning';
  if (status === 'SUSPENDED' || status === 'CANCELLED') return 'danger';
  return 'neutral';
};

const getUserRoleTone = (role: User['role']): 'success' | 'blue' | 'warning' => {
  if (role === Role.COBRADOR) return 'success';
  if (role === Role.SUPERVISOR) return 'warning';
  return 'blue';
};


    
