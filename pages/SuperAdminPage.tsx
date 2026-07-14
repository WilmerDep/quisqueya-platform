import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
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
  LifeBuoy,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
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
import { emitPlatformToast, openPlatformCriticalModal, setPlatformLoading } from '../services/platformEvents';
import {
  platformFilterFieldClass as filterFieldClass,
  platformInputClass as premiumInputClass,
  platformMotionButtonClass as motionButtonClass,
  platformHeaderPrimaryActionClass,
  platformHeaderSecondaryActionClass,
  platformShellCardClass as shellCardClass,
} from '../components/ui/platformStyles';
import { Company, GlobalConfig, Role, SaaSPlan, User } from '../types';
import { formatCurrency, formatDate } from '../utils';

type SuperAdminTab =
  | 'DASHBOARD'
  | 'COMPANIES'
  | 'GLOBAL_USERS'
  | 'PLANS'
  | 'BILLING'
  | 'REPORTS'
  | 'AUDIT'
  | 'SYSTEM'
  | 'HELP';

type UsersManagementTab = 'SAAS_TEAM' | 'TENANT_USERS' | 'INVITATIONS' | 'ROLES' | 'SESSIONS';

type UsersFilterOption = {
  value: string;
  label: string;
};

type UsersFilterConfig = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: UsersFilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string;
};

type TenantUserSortKey = 'name' | 'companyName' | 'branchName' | 'role' | 'status' | 'lastAccess' | 'twoFactorStatus';

type TenantUserRow = {
  id: string;
  code: string;
  companyId: string;
  branchId: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  branchName: string;
  role: Role;
  status: string;
  isActive: boolean;
  lastAccess: string;
  lastAccessBucket: string;
  twoFactorStatus: string;
  permissions: Record<string, boolean>;
  createdAt: string;
};

type TenantUserActionKind =
  | 'view-profile'
  | 'open-company'
  | 'open-context'
  | 'sessions'
  | 'activity'
  | 'change-role'
  | 'change-branch'
  | 'reset-access'
  | 'revoke-sessions'
  | 'suspend'
  | 'reactivate'
  | 'audit'
  | 'support-access';

type SaasRole = string;
type SaasMemberStatus = 'Activo' | 'Pendiente' | 'Suspendido';

type SaasMember = {
  id: string;
  userScope: 'SAAS';
  companyId: null;
  name: string;
  email: string;
  phone: string;
  role: SaasRole;
  area: string;
  status: SaasMemberStatus;
  lastAccess: string;
  twoFactor: boolean;
  criticalAccess: boolean;
  sessions: number;
  createdAt: string;
  permissions: string[];
  isOwner?: boolean;
};

type SaasMemberActionKind =
  | 'view-profile'
  | 'edit'
  | 'change-role'
  | 'configure-permissions'
  | 'force-password'
  | 'force-2fa'
  | 'revoke-sessions'
  | 'suspend'
  | 'reactivate'
  | 'audit';

type InvitationStatus = 'Pendiente' | 'Aceptada' | 'Expirada' | 'Revocada';
type InvitationType = 'Equipo SaaS' | 'Usuario de empresa';

type InvitationRow = {
  id: string;
  email: string;
  type: InvitationType;
  company: string;
  companyId: string | null;
  branch: string;
  branchId: string | null;
  role: SaasRole | Role;
  invitedBy: string;
  date: string;
  expiresAt: string;
  status: InvitationStatus;
  token: string;
  acceptedUserId?: string;
};

type InvitationActionKind =
  | 'resend'
  | 'copy-link'
  | 'edit-role'
  | 'change-company'
  | 'change-branch'
  | 'extend-expiration'
  | 'revoke'
  | 'renew'
  | 'open-user';

type RoleContext = 'SaaS' | 'Tenant';
type RoleActionKind = 'create' | 'edit' | 'duplicate' | 'assign-users' | 'compare' | 'archive' | 'restore' | 'history';
type PermissionModule = {
  module: string;
  permissions: string[];
  critical?: string[];
};
type SessionStatus = 'Activa' | 'Inactiva' | 'Sospechosa' | 'Revocada' | 'Expirada';
type SessionActionKind =
  | 'view-detail'
  | 'mark-suspicious'
  | 'revoke'
  | 'revoke-all'
  | 'revoke-all-except-current'
  | 'block-ip'
  | 'force-password'
  | 'suspend-user'
  | 'activity';

const ALL_COMPANIES = 'Todas las empresas';
const ALL_BRANCHES = 'Todas las sucursales';
const ALL_ROLES = 'Todos los roles';
const ALL_STATUSES = 'Todos los estados';
const ALL_ACCESS = 'Todos los accesos';
const ALL_TWO_FACTOR = 'Todos los estados 2FA';
const ALL_TYPES = 'Todos los tipos';
const ALL_INVITERS = 'Todos los invitadores';
const ALL_DATES = 'Todas las fechas';
const ALL_DEVICES = 'Todos los dispositivos';
const ALL_BROWSERS = 'Todos los navegadores';
const ALL_IPS = 'Todas las IPs';
const ALL_USERS = 'Todos los usuarios';
const TENANT_USERS_PAGE_SIZE = 8;
const SAAS_ROLES: SaasRole[] = ['Owner SaaS', 'Super Admin', 'Soporte', 'FacturaciÃ³n', 'Auditor'];
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

const usersManagementTabs: Array<{ id: UsersManagementTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'SAAS_TEAM', label: 'Equipo SaaS', icon: Crown },
  { id: 'TENANT_USERS', label: 'Usuarios de Empresas', icon: Building2 },
  { id: 'INVITATIONS', label: 'Invitaciones', icon: Bell },
  { id: 'ROLES', label: 'Roles y Permisos', icon: ShieldCheck },
  { id: 'SESSIONS', label: 'Sesiones', icon: Activity },
];

const SummaryMetric = ({
  label,
  value,
  iconTone = 'blue',
}: {
  label: string;
  value: string;
  iconTone?: 'blue' | 'violet' | 'green' | 'amber' | 'slate';
}) => {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.06)]',
    violet: 'bg-purple-50 text-purple-600 shadow-[0_8px_20px_rgba(147,51,234,0.06)]',
    green: 'bg-emerald-50 text-emerald-600 shadow-[0_8px_20px_rgba(16,185,129,0.06)]',
    amber: 'bg-amber-50 text-amber-600 shadow-[0_8px_20px_rgba(245,158,11,0.06)]',
    slate: 'bg-slate-50 text-slate-600 shadow-[0_8px_20px_rgba(71,85,105,0.06)]',
  };

  return (
    <div className="flex items-center gap-4 rounded-[22px] border border-[#F1F5F9] bg-[#FCFDFF] p-4.5 transition-all duration-250 hover:shadow-sm hover:bg-[#FCFDFF]/95">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClasses[iconTone]}`}>
        <TrendingUp size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-lg font-black text-slate-900 truncate leading-none">{value}</p>
      </div>
    </div>
  );
};
const performanceData = [
  { name: 'Lun', value: 120 },
  { name: 'Mar', value: 230 },
  { name: 'Mie', value: 190 },
  { name: 'Jue', value: 450 },
  { name: 'Vie', value: 380 },
  { name: 'Sab', value: 620 },
  { name: 'Dom', value: 540 },
];

const tabItems: Array<{ id: SuperAdminTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: Globe },
  { id: 'COMPANIES', label: 'Empresas', icon: Building2 },
  { id: 'GLOBAL_USERS', label: 'Usuarios', icon: Users },
  { id: 'PLANS', label: 'Planes y Suscripciones', icon: Package },
  { id: 'BILLING', label: 'FacturaciÃ³n', icon: CreditCard },
  { id: 'REPORTS', label: 'Reportes Globales', icon: FileText },
  { id: 'AUDIT', label: 'Auditoria', icon: History },
  { id: 'SYSTEM', label: 'ConfiguraciÃ³n del Sistema', icon: Settings },
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [platformConfig, setPlatformConfig] = useState<GlobalConfig>(getGlobalConfig());
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('DASHBOARD');
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
  const [detailTab, setDetailTab] = useState<'RESUMEN' | 'USUARIOS' | 'SUCURSALES' | 'SUSCRIPCION' | 'ACTIVIDAD'>('RESUMEN');
  const [usersManagementTab, setUsersManagementTab] = useState<UsersManagementTab>('SAAS_TEAM');
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
        area: 'OperaciÃ³n SaaS',
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
        role: 'FacturaciÃ³n',
        area: 'Finanzas SaaS',
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
        lastAccess: 'Invitacion pendiente',
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
        { role: 'FacturaciÃ³n', users: 2, permissions: ['saas.billing.view', 'saas.billing.manage', 'saas.reports.view'] },
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
        { module: 'Usuarios', permissions: ['Ver usuarios', 'Crear usuarios SaaS', 'Administrar permisos'], critical: ['Administrar permisos'] },
        { module: 'Planes', permissions: ['Ver planes', 'Editar lÃ­mites', 'Publicar plan'] },
        { module: 'Suscripciones', permissions: ['Ver suscripciones', 'Pausar suscripciÃ³n', 'Cambiar ciclo'] },
        { module: 'FacturaciÃ³n', permissions: ['Ver facturaciÃ³n', 'Gestionar facturaciÃ³n', 'Reintentar cobro'], critical: ['Gestionar facturaciÃ³n'] },
        { module: 'Reportes globales', permissions: ['Ver reportes', 'Exportar global', 'Programar envÃ­o'] },
        { module: 'AuditorÃ­a', permissions: ['Ver auditorÃ­a', 'Exportar logs', 'Retener evidencia'] },
        { module: 'Soporte', permissions: ['Ver contexto', 'Acceder como soporte', 'Registrar intervenciÃ³n'], critical: ['Acceder como soporte'] },
        { module: 'ConfiguraciÃ³n', permissions: ['Ver configuraciÃ³n', 'Modificar configuraciÃ³n global'], critical: ['Modificar configuraciÃ³n global'] },
        { module: 'Seguridad', permissions: ['Ver sesiones', 'Revocar sesiones', 'Bloquear IP'] },
      ],
      Tenant: [
        { module: 'Dashboard', permissions: ['Ver indicadores', 'Filtrar sucursal', 'Exportar resumen'] },
        { module: 'Clientes', permissions: ['Ver clientes', 'Crear cliente', 'Editar cliente'] },
        { module: 'PrÃ©stamos', permissions: ['Ver prÃ©stamos', 'Crear prÃ©stamo', 'Reestructurar'] },
        { module: 'Cuotas', permissions: ['Ver cuotas', 'Reprogramar cuota', 'Aplicar mora'] },
        { module: 'Pagos', permissions: ['Ver pagos', 'Registrar pago', 'Revertir pagos'], critical: ['Revertir pagos'] },
        { module: 'Cobrar Hoy', permissions: ['Ver agenda', 'Registrar visita', 'Promesa de pago'] },
        { module: 'Rutas', permissions: ['Ver rutas', 'Asignar ruta', 'Optimizar ruta'] },
        { module: 'Caja', permissions: ['Ver caja', 'Abrir caja', 'Cerrar caja'], critical: ['Cerrar caja'] },
        { module: 'Reportes', permissions: ['Ver reportes', 'Exportar PDF', 'Exportar Excel'] },
        { module: 'Usuarios', permissions: ['Ver usuarios', 'Crear usuario', 'Cambiar rol'] },
        { module: 'ConfiguraciÃ³n', permissions: ['Ver configuraciÃ³n', 'Editar empresa', 'Cambiar lÃ­mites'] },
        { module: 'AuditorÃ­a', permissions: ['Ver auditorÃ­a', 'Filtrar eventos', 'Exportar evidencia'] },
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
        label: 'Ãšltimo acceso',
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
        options: [ALL_TYPES, 'Equipo SaaS', 'Usuario de empresa'].map(value => ({ value, label: value })),
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
          message: error instanceof Error ? error.message : 'La accion no pudo completarse.',
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
      const nextBranch = companyBranches.length
        ? companyBranches[(Math.max(0, companyBranches.findIndex(branch => branch.id === user.branchId)) + 1) % companyBranches.length]
        : null;

      const actionConfig: Record<string, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void | Promise<void> }> = {
        'change-role': {
          title: 'Cambiar rol del usuario',
          description: `Se cambiara el rol de ${user.name} de ${user.role} a ${nextRole}. Esta accion queda trazable en auditoria del backend cuando API esta disponible.`,
          confirmLabel: `Cambiar a ${nextRole}`,
          tone: 'warning',
          onConfirm: () => updateTenantUserRecord(user, { role: nextRole }, `${user.name} ahora tiene rol ${nextRole}.`),
        },
        'change-branch': {
          title: 'Cambiar sucursal del usuario',
          description: nextBranch
            ? `Se movera ${user.name} hacia ${nextBranch.name}. Valida que la sucursal pertenezca a ${user.companyName}.`
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
          description: `Se marcara a ${user.name} para revalidar acceso en el proximo inicio. No se cambiara la clave de forma silenciosa.`,
          confirmLabel: 'Restablecer acceso',
          tone: 'warning',
          onConfirm: () => updateTenantUserRecord(user, { firstAccessRequired: true }, `${user.name} debera completar validacion de acceso.`),
        },
        'revoke-sessions': {
          title: 'Revocar sesiones',
          description: 'Aun no existe endpoint especifico de revocacion de sesiones. Se registrara la intencion operativa y no se cerrara ninguna sesion de forma silenciosa.',
          confirmLabel: 'Registrar revision',
          tone: 'danger',
          onConfirm: () => emitPlatformToast({ title: 'Revision registrada', message: `Revocacion de sesiones solicitada para ${user.name}.`, tone: 'warning', durationMs: 4200 }),
        },
        suspend: {
          title: 'Suspender usuario',
          description: `Suspender ${user.name} bloqueara su acceso al tenant ${user.companyName}. Esta accion requiere confirmacion explicita.`,
          confirmLabel: 'Suspender usuario',
          tone: 'danger',
          onConfirm: () => updateTenantUserRecord(user, { isActive: false }, `${user.name} fue suspendido.`),
        },
        reactivate: {
          title: 'Reactivar usuario',
          description: `Reactivar ${user.name} permitira nuevamente su acceso al tenant ${user.companyName}.`,
          confirmLabel: 'Reactivar usuario',
          tone: 'warning',
          onConfirm: () => updateTenantUserRecord(user, { isActive: true }, `${user.name} fue reactivado.`),
        },
        'support-access': {
          title: 'Acceder como soporte',
          description: 'Esta accion solo esta disponible con permiso saas.support.impersonate y debe generar auditoria dedicada. No se ejecutara si el permiso no esta presente.',
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
        setTenantUsersPermissionError('La vista de usuarios de empresas no permite operar usuarios SaaS.');
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
          title: 'Accion no autorizada',
          message: 'Tu usuario no tiene permiso saas.support.impersonate.',
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
        emitPlatformToast({ title: 'Contexto bloqueado', message: 'Esta vista solo permite operar usuarios SaaS sin empresa_id.', tone: 'error', durationMs: 4200 });
        return;
      }

      if (action === 'view-profile' || action === 'edit' || action === 'audit') {
        emitPlatformToast({
          title: action === 'audit' ? 'AuditorÃ­a localizada' : 'Perfil SaaS',
          message: `${member.name} pertenece al scope SAAS y no tiene empresa asociada.`,
          tone: 'info',
          durationMs: 3800,
        });
        return;
      }

      if (action === 'configure-permissions') {
        if (isCurrentUser && member.criticalAccess) {
          emitPlatformToast({
            title: 'Permiso crÃ­tico protegido',
            message: 'No puedes eliminar tu propio permiso crÃ­tico desde esta vista.',
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
          emitPlatformToast({ title: 'Owner SaaS protegido', message: 'El Owner SaaS no puede cambiarse de rol desde acciones rÃ¡pidas.', tone: 'warning', durationMs: 4200 });
          return;
        }
        const currentIndex = Math.max(1, SAAS_ROLES.indexOf(member.role));
        const nextRole = SAAS_ROLES[(currentIndex + 1) % SAAS_ROLES.length] || 'Soporte';
        openPlatformCriticalModal({
          id: `saas-role-${member.id}`,
          title: 'Cambiar rol SaaS',
          description: `Se cambiarÃ¡ el rol de ${member.name} a ${nextRole}. No se mezclarÃ¡ con roles Tenant.`,
          tone: 'warning',
          confirmLabel: `Cambiar a ${nextRole}`,
          cancelLabel: 'Cancelar',
          highlights: [
            { label: 'Usuario', value: member.name },
            { label: 'Rol actual', value: member.role },
            { label: 'Scope', value: 'SAAS / empresa_id null' },
          ],
          onConfirm: () => {
            updateSaasMember(member.id, { role: nextRole });
            emitPlatformToast({ title: 'Rol actualizado', message: `${member.name} ahora tiene rol ${nextRole}.`, tone: 'success', durationMs: 3600 });
          },
        });
        return;
      }

      if (action === 'suspend') {
        if (member.isOwner) {
          emitPlatformToast({ title: 'Owner SaaS protegido', message: 'Un Super Admin no puede suspender al Owner SaaS.', tone: 'warning', durationMs: 4200 });
          return;
        }
        if (isCurrentUser) {
          emitPlatformToast({ title: 'AcciÃ³n bloqueada', message: 'No puedes suspender tu propio usuario.', tone: 'warning', durationMs: 4200 });
          return;
        }
        if (activeAdmins.length <= 1 && ['Owner SaaS', 'Super Admin'].includes(member.role)) {
          emitPlatformToast({ title: 'Ãšltima cuenta administrativa', message: 'No se permite suspender la Ãºltima cuenta administrativa vÃ¡lida.', tone: 'error', durationMs: 5200 });
          return;
        }
      }

      const actionConfig: Partial<Record<SaasMemberActionKind, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void }>> = {
        'force-password': {
          title: 'Forzar cambio de contraseÃ±a',
          description: `Se marcarÃ¡ a ${member.name} para rotar contraseÃ±a en el prÃ³ximo acceso. No se cambiarÃ¡ de forma silenciosa.`,
          confirmLabel: 'Forzar cambio',
          tone: 'warning',
          onConfirm: () => emitPlatformToast({ title: 'Cambio requerido', message: `${member.name} deberÃ¡ cambiar contraseÃ±a.`, tone: 'success', durationMs: 3600 }),
        },
        'force-2fa': {
          title: 'Forzar 2FA',
          description: `Se exigirÃ¡ segundo factor a ${member.name} antes de continuar operando.`,
          confirmLabel: 'Forzar 2FA',
          tone: 'warning',
          onConfirm: () => {
            updateSaasMember(member.id, { twoFactor: true });
            emitPlatformToast({ title: '2FA requerido', message: `${member.name} tiene 2FA marcado como obligatorio.`, tone: 'success', durationMs: 3600 });
          },
        },
        'revoke-sessions': {
          title: 'Revocar sesiones',
          description: `Se registrarÃ¡ revocaciÃ³n de sesiones para ${member.name}. En backend real debe cerrarse por endpoint dedicado.`,
          confirmLabel: 'Revocar sesiones',
          tone: 'danger',
          onConfirm: () => {
            updateSaasMember(member.id, { sessions: 0, lastAccess: 'Sesiones revocadas' });
            emitPlatformToast({ title: 'Sesiones revocadas', message: `${member.name} quedÃ³ sin sesiones activas.`, tone: 'warning', durationMs: 4200 });
          },
        },
        suspend: {
          title: 'Suspender miembro SaaS',
          description: `Suspender ${member.name} bloquearÃ¡ su acceso interno a ABUNDRA. Requiere confirmaciÃ³n explÃ­cita.`,
          confirmLabel: 'Suspender',
          tone: 'danger',
          onConfirm: () => {
            updateSaasMember(member.id, { status: 'Suspendido', sessions: 0 });
            emitPlatformToast({ title: 'Miembro suspendido', message: `${member.name} fue suspendido.`, tone: 'warning', durationMs: 4200 });
          },
        },
        reactivate: {
          title: 'Reactivar miembro SaaS',
          description: `Reactivar ${member.name} permitirÃ¡ nuevamente su acceso interno.`,
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
        emitPlatformToast({ title: 'Contexto invÃ¡lido', message: 'Una invitaciÃ³n SaaS no puede tener empresa_id.', tone: 'error', durationMs: 4400 });
        return;
      }
      if (!isSaasInvite && !invitation.companyId) {
        emitPlatformToast({ title: 'Empresa requerida', message: 'Una invitaciÃ³n Tenant requiere empresa_id obligatorio.', tone: 'error', durationMs: 4400 });
        return;
      }
      if (!isSaasInvite && invitation.branchId && !tenantBranches.some(branch => branch.id === invitation.branchId)) {
        emitPlatformToast({ title: 'Sucursal invÃ¡lida', message: 'La sucursal debe pertenecer a la empresa seleccionada.', tone: 'error', durationMs: 4400 });
        return;
      }

      if (action === 'copy-link') {
        const link = `${window.location.origin}/#/invitacion/${invitation.token}`;
        navigator.clipboard?.writeText(link).catch(() => undefined);
        emitPlatformToast({ title: 'Enlace copiado', message: `Token de un solo uso preparado para ${invitation.email}.`, tone: 'success', durationMs: 3600 });
        return;
      }

      if (action === 'open-user') {
        const tenantUser = tenantUsersRows.find(user => user.email === invitation.email || user.id === invitation.acceptedUserId);
        if (tenantUser) {
          setSelectedTenantUserId(tenantUser.id);
          setTenantUserDrawerOpen(true);
        } else {
          emitPlatformToast({ title: 'Usuario no creado', message: 'Esta invitaciÃ³n aÃºn no tiene una cuenta activa asociada.', tone: 'info', durationMs: 3800 });
        }
        return;
      }

      if (action === 'change-company') {
        if (isSaasInvite) {
          emitPlatformToast({ title: 'No aplica', message: 'El equipo SaaS no puede moverse a empresa.', tone: 'warning', durationMs: 3600 });
          return;
        }
        const currentIndex = Math.max(0, tenantCompanies.findIndex(company => company.id === invitation.companyId));
        const nextCompany = tenantCompanies[(currentIndex + 1) % Math.max(tenantCompanies.length, 1)];
        const nextBranch = nextCompany ? tenantBranchesByCompany.get(nextCompany.id)?.[0] : null;
        if (!nextCompany) return;
        updateInvitation(invitation.id, {
          company: nextCompany.name,
          companyId: nextCompany.id,
          branch: nextBranch?.name || 'Sin sucursal',
          branchId: nextBranch?.id || null,
        });
        emitPlatformToast({ title: 'Empresa actualizada', message: `${invitation.email} fue movido a ${nextCompany.name}.`, tone: 'success', durationMs: 3600 });
        return;
      }

      if (action === 'change-branch') {
        if (isSaasInvite) {
          emitPlatformToast({ title: 'No aplica', message: 'Una invitaciÃ³n SaaS no usa sucursal.', tone: 'warning', durationMs: 3600 });
          return;
        }
        const currentIndex = Math.max(0, tenantBranches.findIndex(branch => branch.id === invitation.branchId));
        const nextBranch = tenantBranches[(currentIndex + 1) % Math.max(tenantBranches.length, 1)];
        if (!nextBranch) {
          emitPlatformToast({ title: 'Sin sucursales', message: `${tenantCompany?.name || invitation.company} no tiene sucursales disponibles.`, tone: 'warning', durationMs: 3600 });
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
        emitPlatformToast({ title: 'Rol actualizado', message: `${invitation.email} ahora serÃ¡ invitado como ${nextRole}.`, tone: 'success', durationMs: 3600 });
        return;
      }

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextDate = nextWeek.toLocaleDateString('es-DO');
      const token = `inv-${invitation.id}-${Date.now()}`;
      const actionConfig: Partial<Record<InvitationActionKind, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void }>> = {
        resend: {
          title: 'Reenviar invitaciÃ³n',
          description: invitation.status === 'Revocada' ? 'Una invitaciÃ³n revocada no puede aceptarse. Renueva primero el token.' : `Se reenviarÃ¡ el token de un solo uso a ${invitation.email}.`,
          confirmLabel: invitation.status === 'Revocada' ? 'No reenviar' : 'Reenviar',
          tone: 'warning',
          onConfirm: () => {
            if (invitation.status === 'Revocada') return;
            updateInvitation(invitation.id, { date: new Date().toLocaleDateString('es-DO'), status: 'Pendiente' });
            emitPlatformToast({ title: 'InvitaciÃ³n reenviada', message: `${invitation.email} recibiÃ³ un nuevo aviso.`, tone: 'success', durationMs: 3600 });
          },
        },
        'extend-expiration': {
          title: 'Extender expiraciÃ³n',
          description: 'La expiraciÃ³n es obligatoria. Se ampliarÃ¡ 7 dÃ­as y se mantendrÃ¡ el mismo contexto.',
          confirmLabel: 'Extender 7 dÃ­as',
          tone: 'warning',
          onConfirm: () => {
            updateInvitation(invitation.id, { expiresAt: nextDate, status: invitation.status === 'Expirada' ? 'Pendiente' : invitation.status });
            emitPlatformToast({ title: 'ExpiraciÃ³n extendida', message: `${invitation.email} vence ahora el ${nextDate}.`, tone: 'success', durationMs: 3600 });
          },
        },
        revoke: {
          title: 'Revocar invitaciÃ³n',
          description: 'Una invitaciÃ³n revocada no podrÃ¡ aceptarse. Esta acciÃ³n debe quedar registrada en auditorÃ­a.',
          confirmLabel: 'Revocar',
          tone: 'danger',
          onConfirm: () => {
            updateInvitation(invitation.id, { status: 'Revocada' });
            emitPlatformToast({ title: 'InvitaciÃ³n revocada', message: `${invitation.email} ya no puede aceptar este acceso.`, tone: 'warning', durationMs: 4200 });
          },
        },
        renew: {
          title: 'Renovar invitaciÃ³n',
          description: 'Se generarÃ¡ un nuevo token de un solo uso y una expiraciÃ³n obligatoria.',
          confirmLabel: 'Renovar',
          tone: 'warning',
          onConfirm: () => {
            updateInvitation(invitation.id, { token, expiresAt: nextDate, status: 'Pendiente', date: new Date().toLocaleDateString('es-DO') });
            emitPlatformToast({ title: 'InvitaciÃ³n renovada', message: `${invitation.email} tiene token nuevo de un solo uso.`, tone: 'success', durationMs: 3600 });
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
          { label: 'Tipo', value: invitation.type },
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
        emitPlatformToast({ title: 'Campos requeridos', message: 'Nombre, correo y expiraciÃ³n son obligatorios.', tone: 'warning', durationMs: 4200 });
        return;
      }
      if (!SAAS_ROLES.includes(saasMemberForm.role)) {
        emitPlatformToast({ title: 'Rol invÃ¡lido', message: 'No se puede mezclar rol SaaS con rol Tenant.', tone: 'error', durationMs: 4200 });
        return;
      }
      const duplicate = saasTeamMembers.some(member => member.email.toLowerCase() === email && member.status !== 'Suspendido');
      if (duplicate) {
        emitPlatformToast({ title: 'Cuenta duplicada', message: 'Ya existe una cuenta activa o pendiente con ese correo en el scope SaaS.', tone: 'error', durationMs: 4600 });
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
          phone: phone || 'Sin telÃ©fono',
          role: saasMemberForm.role,
          area: 'Pendiente de asignaciÃ³n',
          status: 'Pendiente',
          lastAccess: 'InvitaciÃ³n pendiente',
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
      emitPlatformToast({ title: 'InvitaciÃ³n creada', message: `${name} fue agregado como miembro SaaS pendiente. Token de un solo uso generado.`, tone: 'success', durationMs: 4600 });
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
          message: 'Correo, empresa y expiracion son obligatorios para invitar un usuario de empresa.',
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
          message: 'Ya existe un usuario activo o una invitacion pendiente para ese correo en la empresa seleccionada.',
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
          branch: branch?.name || 'Sin sucursal',
          branchId: branch?.id || null,
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
        title: 'Invitacion tenant creada',
        message: `${email} quedo invitado a ${company.name}.`,
        tone: 'success',
        durationMs: 4200,
      });
      navigate(usersTabPathMap.INVITATIONS);
    },
    [currentUser?.name, invitationRows, navigate, tenantBranchesByCompany, tenantCompanies, tenantInvitationForm, tenantUsersRows],
  );

  const handleRoleAction = useCallback((roleName: string, context: RoleContext, action: RoleActionKind) => {
    setActiveActionsDropdown(null);
    const criticalCopy = 'Toda modificaciÃ³n crÃ­tica requiere advertencia, confirmaciÃ³n, auditorÃ­a, validaciÃ³n backend y 2FA cuando corresponda.';

    if (action === 'history' || action === 'compare') {
      emitPlatformToast({
        title: action === 'history' ? 'Historial de rol' : 'ComparaciÃ³n de rol',
        message: `${roleName} (${context}) listo para revisiÃ³n. ${criticalCopy}`,
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
      description: `${labels[action]} sobre ${roleName} (${context}). ${criticalCopy} Esta UI no inventa endpoint: deja la intenciÃ³n lista para conectarse al backend de permisos.`,
      tone: isCritical ? 'danger' : 'warning',
      confirmLabel: labels[action],
      cancelLabel: 'Cancelar',
      highlights: [
        { label: 'Rol', value: roleName },
        { label: 'Contexto', value: context },
        { label: '2FA', value: isCritical ? 'Requerido si backend lo exige' : 'No requerido' },
      ],
      onConfirm: () => emitPlatformToast({
        title: 'AcciÃ³n registrada',
        message: `${labels[action]} solicitado para ${roleName}. Pendiente validaciÃ³n backend/auditorÃ­a real.`,
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
        emitPlatformToast({
          title: action === 'view-detail' ? 'Detalle de sesiÃ³n' : 'Actividad de sesiÃ³n',
          message: `${session.user} Â· ${session.device} Â· ${session.ip} Â· ${session.location}.`,
          tone: 'info',
          durationMs: 4200,
        });
        return;
      }

      const actionConfig: Record<Exclude<SessionActionKind, 'view-detail' | 'activity'>, { title: string; description: string; confirmLabel: string; tone: 'warning' | 'danger' | 'info'; onConfirm: () => void }> = {
        'mark-suspicious': {
          title: 'Marcar sesiÃ³n como sospechosa',
          description: `Se marcarÃ¡ la sesiÃ³n de ${session.user} para revisiÃ³n de seguridad.`,
          confirmLabel: 'Marcar sospechosa',
          tone: 'warning',
          onConfirm: () => updateSession(session.id, { status: 'Sospechosa', activity: 'Marcada para revisiÃ³n' }),
        },
        revoke: {
          title: 'Revocar sesiÃ³n',
          description: `Se revocarÃ¡ Ãºnicamente esta sesiÃ³n de ${session.user}. Debe registrarse auditorÃ­a backend.`,
          confirmLabel: 'Revocar sesiÃ³n',
          tone: 'danger',
          onConfirm: () => updateSession(session.id, { status: 'Revocada', activity: 'Revocada ahora' }),
        },
        'revoke-all': {
          title: 'Revocar todas las sesiones',
          description: `Se revocarÃ¡n todas las sesiones visibles de ${session.user}.`,
          confirmLabel: 'Revocar todas',
          tone: 'danger',
          onConfirm: () => {
            sessionRows.filter(item => item.user === session.user).forEach(item => updateSession(item.id, { status: 'Revocada', activity: 'Revocada por lote' }));
          },
        },
        'revoke-all-except-current': {
          title: 'Revocar todas excepto actual',
          description: `Se conservarÃ¡ la sesiÃ³n actual y se revocarÃ¡n las demÃ¡s sesiones de ${session.user}.`,
          confirmLabel: 'Revocar excepto actual',
          tone: 'danger',
          onConfirm: () => {
            sessionRows.filter(item => item.user === session.user && item.id !== 'session-1').forEach(item => updateSession(item.id, { status: 'Revocada', activity: 'Revocada por polÃ­tica' }));
          },
        },
        'block-ip': {
          title: 'Bloquear IP',
          description: `Se marcarÃ¡ ${session.ip} como IP bloqueada en la polÃ­tica local de seguridad.`,
          confirmLabel: 'Bloquear IP',
          tone: 'danger',
          onConfirm: () => {
            updateSession(session.id, { status: 'Sospechosa', blockedIp: true });
            setSessionPolicy(current => ({ ...current, blockedIps: [current.blockedIps, session.ip].filter(Boolean).join(', ') }));
          },
        },
        'force-password': {
          title: 'Forzar contraseÃ±a',
          description: `Se solicitarÃ¡ rotaciÃ³n de contraseÃ±a para ${session.user}.`,
          confirmLabel: 'Forzar contraseÃ±a',
          tone: 'warning',
          onConfirm: () => emitPlatformToast({ title: 'RotaciÃ³n solicitada', message: `${session.user} deberÃ¡ cambiar contraseÃ±a.`, tone: 'success', durationMs: 3600 }),
        },
        'suspend-user': {
          title: 'Suspender usuario',
          description: `Suspender ${session.user} requiere validaciÃ³n backend y no se harÃ¡ de forma silenciosa.`,
          confirmLabel: 'Solicitar suspensiÃ³n',
          tone: 'danger',
          onConfirm: () => emitPlatformToast({ title: 'SuspensiÃ³n solicitada', message: `${session.user} quedÃ³ pendiente de validaciÃ³n backend.`, tone: 'warning', durationMs: 4200 }),
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
          emitPlatformToast({ title: 'AcciÃ³n de sesiÃ³n registrada', message: `${config.confirmLabel} aplicado a ${session.user}.`, tone: 'success', durationMs: 3600 });
        },
      });
    },
    [sessionRows, updateSession],
  );

  const handleSaveSessionPolicy = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSessionPolicyModalOpen(false);
    emitPlatformToast({
      title: 'PolÃ­ticas endurecidas',
      message: 'La configuraciÃ³n de sesiones quedÃ³ preparada para validaciÃ³n backend y auditorÃ­a.',
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
        planName: plan?.name || 'Sin plan',
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
        title: 'Reporte de adopcion del SaaS',
        detail: `${companyUsers.length} usuarios globales operando en ${tenantCompanies.length} tenants.`,
        badge: 'Operativo',
      },
      {
        title: 'Reporte de riesgo de cartera SaaS',
        detail: `${trialCompanies} empresas en prueba y ${suspendedCompanies} suspendidas para seguimiento comercial.`,
        badge: 'Riesgo',
      },
    ];
  }, [companyUsers.length, metrics.mrr, tenantCompanies, tenantCompanies.length]);

  const helpRows = useMemo(
    () => [
      { title: 'Guias de onboarding', detail: 'Documentacion para alta de empresas, usuarios globales y activacion inicial.', tag: 'Base de conocimiento' },
      { title: 'Tickets prioritarios', detail: `${Math.max(1, tenantCompanies.length)} conversaciones listas para seguimiento de soporte SaaS.`, tag: 'Soporte' },
      { title: 'Tutoriales del panel', detail: 'Recorridos para facturaciÃ³n, auditorÃ­a, planes y configuraciÃ³n global.', tag: 'Tutoriales' },
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
      { label: 'Suspendidos', detail: `${tenantUsersRows.filter(user => user.status === 'Suspendido').length} usuarios requieren revisiÃ³n`, tone: 'danger' as const },
      { label: 'Sin acceso reciente', detail: `${tenantUsersRows.filter(user => user.lastAccess === 'Sin acceso reciente').length} usuarios sin actividad`, tone: 'warning' as const },
      { label: 'Sin sucursal asignada', detail: `${tenantUsersRows.filter(user => user.branchName === 'Sin sucursal').length} usuarios por ubicar`, tone: 'neutral' as const },
      { label: 'Admins sin 2FA', detail: '2 administradores crÃ­ticos por endurecer', tone: 'danger' as const },
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
      { label: 'Accesos crÃ­ticos', value: `${saasTeamMembers.filter(member => member.criticalAccess).length}`, tone: 'blue' as const },
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
        { user: 'Mario Acosta', detail: 'SesiÃ³n revocada hace 18 min' },
        { user: 'Admin PrestaFÃ¡cil', detail: 'Cambio de contraseÃ±a forzado hace 45 min' },
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
        label: 'Miembros SaaS',
        value: `${saasTeamMembers.length}`,
        helper: 'Equipo interno con acceso administrativo.',
        trend: '+1 mes',
        secondaryLabel: 'Alcance',
        secondaryValue: 'SaaS',
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
        trend: pendingInvitations > 0 ? 'Pendiente' : 'Al dÃ­a',
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
        helper: 'Miembros SaaS sin acceso activo.',
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
        helper: 'Usuarios creados dentro de tenants.',
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
        helper: 'Responsables principales por tenant.',
        trend: 'CrÃ­tico',
        secondaryLabel: 'Rol',
        secondaryValue: 'Tenant',
        tone: 'violet',
        icon: UserCog,
      },
      {
        label: 'Supervisores',
        value: `${tenantUsersRows.filter(user => user.role === Role.SUPERVISOR).length}`,
        helper: 'SupervisiÃ³n de equipos y sucursales.',
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
        helper: 'Usuarios ligados a operaciÃ³n de cobro.',
        trend: '+8',
        secondaryLabel: 'Rol',
        secondaryValue: 'Campo',
        tone: 'amber',
        icon: UserIcon,
      },
      {
        label: 'Suspendidos',
        value: `${suspendedUsers}`,
        helper: 'Accesos tenant detenidos o en revisiÃ³n.',
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
        helper: 'Invitaciones esperando aceptaciÃ³n.',
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
        secondaryLabel: 'ConversiÃ³n',
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
        secondaryLabel: 'AtenciÃ³n',
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
        label: 'Roles SaaS',
        value: `${rolesSummary.saasRoles}`,
        helper: 'Roles internos para ABUNDRA.',
        trend: 'Global',
        trendDirection: 'neutral',
        secondaryLabel: 'Contexto',
        secondaryValue: 'SaaS',
        tone: 'blue',
        icon: Crown,
      },
      {
        label: 'Roles Tenant',
        value: `${rolesSummary.tenantRoles}`,
        helper: 'Roles asignables dentro de empresas.',
        trend: 'OperaciÃ³n',
        trendDirection: 'neutral',
        secondaryLabel: 'Contexto',
        secondaryValue: 'Tenant',
        tone: 'emerald',
        icon: Building2,
      },
      {
        label: 'Permisos crÃ­ticos',
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
        label: 'Ãšltima actualizaciÃ³n',
        value: rolesSummary.lastUpdate,
        helper: 'Registro mÃ¡s reciente de matriz.',
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
        label: 'Sesiones SaaS',
        value: `${sessionRows.filter(session => session.type === 'SaaS').length}`,
        helper: 'Accesos internos de ABUNDRA.',
        trend: 'Interno',
        trendDirection: 'neutral',
        secondaryLabel: 'Alcance',
        secondaryValue: 'SaaS',
        tone: 'violet',
        icon: Crown,
      },
      {
        label: 'Sesiones Tenant',
        value: `${sessionRows.filter(session => session.type === 'Tenant').length}`,
        helper: 'Accesos operativos de empresas.',
        trend: 'Tenant',
        trendDirection: 'neutral',
        secondaryLabel: 'Alcance',
        secondaryValue: 'Empresas',
        tone: 'emerald',
        icon: Building2,
      },
      {
        label: 'Accesos sospechosos',
        value: `${sessionRows.filter(session => session.status === 'Sospechosa').length}`,
        helper: 'Sesiones que requieren revisiÃ³n.',
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
    if (!query) return masterLogs;
    return masterLogs.filter(log =>
      [log.action, log.detail, log.id].some(value => value.toLowerCase().includes(query)),
    );
  }, [auditSearchTerm, masterLogs]);

  const navigateToSection = useCallback(
    (tab: SuperAdminTab) => {
      if (tab === 'GLOBAL_USERS') {
        navigate('/super-admin/usuarios', { replace: false });
        return;
      }
      const params = new URLSearchParams(location.search);
      params.set('section', tabToSectionMap[tab]);
      navigate(`/master?${params.toString()}`, { replace: false });
    },
    [location.search, navigate],
  );

  const navigateToUsersTab = useCallback(
    (tab: UsersManagementTab) => {
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
    const headers = ['Usuario', 'Correo', 'Empresa', 'Sucursal', 'Rol', 'Estado', 'Ultimo acceso'];
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
      { label: 'Nuevo miembro SaaS', icon: Plus, onClick: () => { navigateToUsersTab('SAAS_TEAM'); setIsSaasMemberModalOpen(true); }, variant: 'primary' },
      { label: 'Invitar usuario', icon: Bell, onClick: () => { navigateToUsersTab('INVITATIONS'); setIsTenantInvitationModalOpen(true); }, variant: 'secondary' },
      { label: 'Configurar permisos', icon: ShieldCheck, onClick: () => navigateToUsersTab('ROLES'), variant: 'secondary' },
    ],
    [navigateToUsersTab],
  );

  const usersSubviewActions = useMemo<PlatformHeaderAction[]>(() => {
    if (usersManagementTab === 'TENANT_USERS') {
      return [
        { label: 'Registrar usuario de empresa', icon: UserIcon, onClick: () => setIsTenantInvitationModalOpen(true), variant: 'primary' },
        { label: 'Exportar', icon: Download, onClick: handleExportTenantUsers, variant: 'secondary' },
      ];
    }

    const actionMap: Record<Exclude<UsersManagementTab, 'TENANT_USERS'>, PlatformHeaderAction> = {
      SAAS_TEAM: { label: 'Nuevo miembro SaaS', icon: Plus, onClick: () => setIsSaasMemberModalOpen(true), variant: 'primary' },
      INVITATIONS: { label: 'Nueva invitaciÃ³n', icon: Bell, onClick: () => setIsTenantInvitationModalOpen(true), variant: 'primary' },
      ROLES: { label: 'Nuevo rol', icon: ShieldCheck, onClick: () => handleRoleAction('Nuevo rol', 'SaaS', 'create'), variant: 'primary' },
      SESSIONS: { label: 'Endurecer polÃ­ticas', icon: ShieldAlert, onClick: () => setIsSessionPolicyModalOpen(true), variant: 'primary' },
    };

    return [actionMap[usersManagementTab]];
  }, [handleExportTenantUsers, navigateToUsersTab, usersManagementTab]);


  const handleUpdateConfig = () => {
    updateGlobalConfig(platformConfig);
    refreshData();
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

  const kpis = [
    {
      label: 'Empresas activas',
      value: '128',
      helper: 'Actividad de tenants',
      trend: 'Ã¢â€ â€˜ 12 este mes',
      tone: 'blue' as const,
      icon: Building2,
    },
    {
      label: 'Usuarios activos',
      value: '1,248',
      helper: 'Sesiones operativas',
      trend: 'Ã¢â€ â€˜ 18 este mes',
      tone: 'emerald' as const,
      icon: Users,
    },
    {
      label: 'Ingresos mensuales (MRR)',
      value: 'RD$ 532,800.00',
      helper: 'FacturaciÃ³n del SaaS',
      trend: 'Ã¢â€ â€˜ 8.5% vs anterior',
      tone: 'amber' as const,
      icon: DollarSign,
    },
    {
      label: 'Suscripciones activas',
      value: '136',
      helper: 'Planes activos',
      trend: 'Ã¢â€ â€˜ 9 este mes',
      tone: 'blue' as const,
      icon: CreditCard,
    },
    {
      label: 'Empresas en mora',
      value: '5',
      helper: 'Suscripciones vencidas',
      trend: 'Ã¢â€ â€œ 2 este mes',
      tone: 'danger' as const,
      icon: AlertCircle,
    },
  ];

  if (currentUser?.role === Role.SUPER_ADMIN) {
    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        {activeTab === 'DASHBOARD' && (
          <section className="animate-[platform-fade-in_180ms_ease-out]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3.5 py-1.5 text-[11.5px] font-black uppercase tracking-wider text-[#2563EB]">
                  <Crown size={12} />
                  Super Admin SaaS
                </div>
                <h1 className="mt-3.5 text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Control global de ABUNDRA</h1>
                <p className="mt-2.5 text-[16px] font-medium text-[#6B7280]">
                  Monitorea empresas, usuarios, suscripciones, facturaciÃ³n y actividad general del SaaS.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(true)}
                  className="flex h-[54px] items-center justify-center gap-3 rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)] cursor-pointer active:scale-98"
                >
                  <Plus size={18} />
                  Nueva empresa
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('SYSTEM')}
                  className={`flex h-[54px] items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm ${motionButtonClass} cursor-pointer active:scale-98`}
                >
                  <Settings size={18} className="text-[#2563EB]" />
                  ConfiguraciÃ³n
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'DASHBOARD' && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 animate-[platform-fade-in_180ms_ease-out]">
            {kpis.map(item => {
              const toneClassMap = {
                blue: { text: 'text-[#2563EB]', bg: 'bg-[#DBEAFE] text-[#2563EB]' },
                emerald: { text: 'text-[#16A34A]', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
                amber: { text: 'text-[#F59E0B]', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
                danger: { text: 'text-[#DC2626]', bg: 'bg-[#FEE2E2] text-[#DC2626]' },
              };
              const style = toneClassMap[item.tone];

              return (
                <div
                  key={item.label}
                  className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${style.bg}`}>
                      <item.icon size={24} />
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${style.text}`}>
                        <TrendingUp size={13} />
                        {item.trend}
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 space-y-3">
                    <p className="text-[15px] font-semibold text-[#111827]">{item.label}</p>
                    <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{item.value}</p>
                    <p className="text-[14px] font-medium text-[#6B7280]">{item.helper}</p>
                  </div>
                  <div className={`pointer-events-none absolute bottom-4 right-4 opacity-[0.08] ${style.text}`}>
                    <item.icon size={88} />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {activeTab === 'DASHBOARD' ? (
          <div className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
            {/* Fila superior de GrÃ¡ficos y DistribuciÃ³n */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_0.95fr]">
              {/* Monitor Global */}
              <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={20} className="text-[#2563EB]" />
                    <h2 className="text-[19px] font-semibold text-[#111827]">Crecimiento de empresas</h2>
                  </div>
                  <span className="inline-flex rounded-full bg-slate-50 border border-slate-200 px-3.5 py-1 text-xs font-semibold text-slate-600">
                    Ãšltimos 6 meses
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

              {/* DistribuciÃ³n por Plan e Ingresos */}
              <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 space-y-5 shadow-sm">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-[19px] font-semibold text-[#111827]">Ingresos por plan (MRR)</h3>
                </div>
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px] font-bold text-slate-500">
                      <span>BÃ¡sico (35.2%)</span>
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

            {/* Acciones RÃ¡pidas Super Admin */}
            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-[#2563EB]" />
                <h2 className="text-[19px] font-semibold text-[#111827]">Acciones rÃ¡pidas</h2>
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
                  <p className="mt-4 text-[17px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">Revisar facturaciÃ³n</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6B7280]">Suscripciones y cobros</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('AUDIT')}
                  className="group flex min-h-[148px] flex-col items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white px-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:shadow-sm cursor-pointer"
                >
                  <History size={30} className="text-[#2563EB]" />
                  <p className="mt-4 text-[17px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">Ver auditorÃ­a</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6B7280]">Logs de seguridad globales</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('PLANS')}
                  className="group flex min-h-[148px] flex-col items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white px-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:shadow-sm cursor-pointer"
                >
                  <Package size={30} className="text-[#2563EB]" />
                  <p className="mt-4 text-[17px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">Gestionar planes</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#6B7280]">LÃ­mites y precios del SaaS</p>
                </button>
              </div>
            </section>

            {/* Fila Inferior: Alertas Operativas y Actividad Reciente */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">
              {/* Alertas Operativas */}
              <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
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
                  <div className="flex items-start justify-between gap-4 p-4 rounded-[22px] bg-red-50/50 border border-red-100 transition-all duration-200 hover:translate-x-1 hover:shadow-sm">
                    <div className="space-y-1.5">
                      <p className="text-[14.5px] font-bold text-[#DC2626] leading-tight">Empresas en mora crÃ­tica</p>
                      <p className="text-[13px] font-medium text-slate-600">Hay 5 tenants con pagos de suscripciÃ³n pendientes por mÃ¡s de 15 dÃ­as.</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase text-red-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      CrÃ­tico
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 p-4 rounded-[22px] bg-amber-50/50 border border-amber-100 transition-all duration-200 hover:translate-x-1 hover:shadow-sm">
                    <div className="space-y-1.5">
                      <p className="text-[14.5px] font-bold text-[#D97706] leading-tight">LÃ­mites de plan excedidos</p>
                      <p className="text-[13px] font-medium text-slate-600">2 empresas estÃ¡n al 95% de su capacidad mÃ¡xima de usuarios.</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Advertencia
                    </span>
                  </div>
                </div>
              </div>

              {/* Actividad Reciente */}
              <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
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
                  {masterLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="flex items-start gap-3 transition-all duration-200 hover:translate-x-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Terminal size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-slate-950 leading-tight">{log.action}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1 truncate">{log.detail}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-[36px] md:text-[52px] font-black leading-none tracking-tight text-[#111827]">
                      {selectedCompanyDetail.name}
                    </h1>
                    <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-600">
                      ID: {selectedCompanyDetail.id}
                    </span>
                  </div>
                  <p className="mt-3 text-[16px] md:text-xl font-medium text-[#6B7280]">
                    Ficha de soporte global y estado de suscripciÃ³n del tenant.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCompanyDetail(null)}
                    className={`flex h-[54px] min-w-[200px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass} cursor-pointer`}
                  >
                    <ArrowLeft size={18} />
                    Volver al listado
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleGhost(selectedCompanyDetail.id, !!selectedCompanyDetail.isGhostMode)}
                    className={`flex h-[54px] min-w-[180px] items-center justify-center gap-2 rounded-2xl border px-6 text-[17px] font-medium transition-all ${
                      selectedCompanyDetail.isGhostMode 
                        ? 'border-purple-300 bg-purple-50 text-purple-600 shadow-sm animate-pulse' 
                        : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-purple-200 hover:bg-purple-50/50 hover:text-purple-600'
                    } ${motionButtonClass} cursor-pointer`}
                  >
                    <Ghost size={18} />
                    {selectedCompanyDetail.isGhostMode ? 'Emulando...' : 'Emular'}
                  </button>
                </div>
              </div>

              {/* SecciÃ³n Hero/KPI de la Empresa (Estilo ClientProfile) */}
              <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-8 shadow-sm animate-[platform-fade-in_180ms_ease-out]">
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
                          Santo Domingo, RepÃºblica Dominicana
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-[#F1F5F9] bg-[#FCFDFF] p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Estado del Tenant</span>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[14px] font-black uppercase ${
                          selectedCompanyDetail.status === 'ACTIVE' 
                            ? 'bg-[#DCFCE7] text-[#16A34A]' 
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
                          {plans.find(p => p.id === selectedCompanyDetail.planId)?.name || 'EstÃ¡ndar'}
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
                {/* Columna Izquierda (75%): PestaÃ±as y contenido central */}
                <div data-client-main className="space-y-6">
                  <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm flex flex-col">
                    {/* Cabecera del Card: PestaÃ±as horizontales estilo ClientProfile */}
                    <div className="border-b border-[#E5E7EB] px-5 py-5">
                      <div className="hidden xl:flex xl:flex-wrap xl:gap-3">
                        {[
                          { id: 'RESUMEN', label: 'Resumen', icon: Globe },
                          { id: 'USUARIOS', label: 'Usuarios', icon: Users },
                          { id: 'SUCURSALES', label: 'Sucursales', icon: Building2 },
                          { id: 'SUSCRIPCION', label: 'SuscripciÃ³n', icon: CreditCard },
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
                                active
                                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
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
                            { id: 'SUSCRIPCION', label: 'SuscripciÃ³n', icon: CreditCard },
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
                                  active
                                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
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
                                <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Indicadores econÃ³micos clave del tenant activo.</p>
                              </div>
                            </div>
                            <table className="min-w-full divide-y divide-slate-100">
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {[
                                  { label: 'Cobros Totales', value: formatCurrency(selectedCompanyDetail.id === 'c1' ? 845200 : 0), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', shadow: 'rgba(5,150,105,0.06)', desc: 'Total recaudado en el perÃ­odo activo' },
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

                          {/* OperaciÃ³n General */}
                          <div className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm">
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                              <h4 className="text-[17px] font-black text-slate-900">OperaciÃ³n General</h4>
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
                                        user.role === Role.ADMIN
                                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                                          : user.role === Role.SUPERVISOR
                                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                                            : user.role === Role.COBRADOR
                                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                              : 'bg-purple-50 text-purple-600 border-purple-100'
                                      }`}>
                                        {user.role}
                                      </span>
                                    </div>

                                    <div>
                                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider border ${
                                        user.isActive
                                          ? 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]'
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
                                <p className="mt-1 text-[13px] font-medium text-slate-500">Este tenant todavÃ­a no tiene cuentas asociadas en la semilla actual.</p>
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
                                  <p className="mt-1 text-[13px] font-medium text-slate-500">Puntos de operaciÃ³n, responsables y metas comerciales registradas.</p>
                                </div>
                                <span className="inline-flex h-10 items-center rounded-2xl bg-[#F8FAFC] px-4 text-[13px] font-bold text-slate-600">
                                  {selectedCompanyDetail.id === 'c1' ? 3 : 1} activas
                                </span>
                              </div>

                              <div className="space-y-3 p-5">
                                {(selectedCompanyDetail.id === 'c1'
                                  ? [
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
                                    <p className="mt-1 text-[13px] font-medium text-slate-500">Resumen rÃ¡pido del despliegue territorial.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="divide-y divide-[#EEF2F7]">
                                {[
                                  { label: 'Sucursal principal', value: selectedCompanyDetail.id === 'c1' ? 'Sucursal Central Santo Domingo' : 'Sucursal Central', icon: Building2 },
                                  { label: 'Mayor meta', value: formatCurrency(selectedCompanyDetail.id === 'c1' ? 250000 : 100000), icon: TrendingUp },
                                  { label: 'Cobertura actual', value: selectedCompanyDetail.id === 'c1' ? 'Red distribuida' : 'OperaciÃ³n centralizada', icon: MapPin },
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
                                    <p className="mt-1 text-[13px] font-medium text-slate-500">Movimientos sugeridos para soporte y expansiÃ³n.</p>
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
                                    detail: 'Compara la meta promedio contra la operaciÃ³n real antes de ampliar lÃ­mites del plan.',
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

                      {detailTab === 'SUSCRIPCION' && (
                        <div className="rounded-[26px] border border-[#E5E7EB] overflow-hidden bg-white shadow-sm animate-[platform-fade-in_180ms_ease-out]">
                          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                              <h3 className="text-[17px] font-black text-slate-900">Historial de Cobros al Tenant</h3>
                              <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">Control de facturaciÃ³n y vigencia del servicio SaaS.</p>
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
                                        <p className="text-[12px] font-medium text-slate-500 mt-0.5">Pago de suscripciÃ³n del sistema</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider border ${
                                      selectedCompanyDetail.billingCycle === 'YEARLY'
                                        ? 'bg-purple-50 text-purple-600 border-purple-100'
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
                              <p className="text-[12.5px] font-semibold text-slate-400 mt-0.5">AuditorÃ­a del sistema y telemetrÃ­a de eventos del tenant.</p>
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
                  {/* ConfiguraciÃ³n General */}
                  <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-[17px] font-black text-slate-900">ConfiguraciÃ³n General</h3>
                      <p className="text-[12px] font-semibold text-slate-400 mt-0.5">ParÃ¡metros del plan y facturaciÃ³n.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        { label: 'Plan Contratado', value: plans.find(p => p.id === selectedCompanyDetail.planId)?.name || 'EstÃ¡ndar', icon: Package, color: 'text-purple-500', bg: 'bg-purple-50' },
                        { label: 'Ciclo de FacturaciÃ³n', value: selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual', icon: CalendarCheck, color: 'text-blue-500', bg: 'bg-blue-50' },
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
                          selectedCompanyDetail.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${selectedCompanyDetail.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          {selectedCompanyDetail.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Control */}
                  <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-3">
                    <div className="border-b border-slate-100 pb-3 mb-2">
                      <h3 className="text-[17px] font-black text-slate-900">Acciones de Control</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleGhost(selectedCompanyDetail.id, !!selectedCompanyDetail.isGhostMode)}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-purple-50 border border-purple-200 text-[13.5px] font-bold text-purple-650 hover:bg-purple-100 transition-all cursor-pointer animate-pulse"
                    >
                      <Ghost size={16} />
                      {selectedCompanyDetail.isGhostMode ? 'Detener EmulaciÃ³n' : 'Emular SesiÃ³n (Soporte)'}
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
                      Editar ConfiguraciÃ³n
                    </button>
                  </div>

                  {/* Salud del Entorno */}
                  <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-[17px] font-black text-slate-900">Salud del Entorno</h3>
                      <p className="text-[12px] font-semibold text-slate-400 mt-0.5">Estado operativo en tiempo real.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        { label: 'ConexiÃ³n BD', value: 'Online', valueClass: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-500', dot: true },
                        { label: 'Latencia de API', value: '45ms', valueClass: 'text-emerald-600 font-mono', icon: Activity, bg: 'bg-blue-50', color: 'text-blue-500', dot: false },
                        { label: 'Uso de Disco', value: '12.4 GB / 100 GB', valueClass: 'text-slate-700 font-mono', icon: SlidersHorizontal, bg: 'bg-slate-100', color: 'text-slate-500', dot: false },
                        { label: 'Ãšltimo backup', value: 'Hoy 04:00 AM', valueClass: 'text-slate-700', icon: Clock3, bg: 'bg-slate-100', color: 'text-slate-500', dot: false },
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
            <section className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Empresas</h1>
                  <p className="mt-2 text-[15px] font-medium text-[#6B7280]">
                    Vista operativa de tenants, planes, facturaciÃ³n, estado y seguimiento del SaaS.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCompany(null);
                      setProvisionName('');
                      setProvisionPlanId('p2');
                      setProvisionCycle('MONTHLY');
                      setProvisionPrice(3500);
                      setIsCompanyModalOpen(true);
                    }}
                    className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[14.5px] font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1D4ED8] hover:shadow-md cursor-pointer"
                  >
                    <Building2 size={18} />
                    Aprovisionar empresa
                  </button>
                </div>
              </div>

              {/* Fila de KPIs Superiores de la Vista Empresas (Estilo Cobrar Hoy - EstÃ¡ticos) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 animate-[platform-fade-in_180ms_ease-out]">
                {/* Empresas Activas */}
                <div className="relative min-h-[160px] overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#DBEAFE] text-[#2563EB]">
                      <Building2 size={20} />
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-bold text-[#2563EB]">+12 mes</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-[13px] font-semibold text-slate-500">Empresas activas</p>
                    <p className="mt-0.5 text-2xl font-black text-slate-900">128</p>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 right-3 opacity-[0.06] text-[#2563EB]">
                    <Building2 size={64} />
                  </div>
                </div>

                {/* En Prueba */}
                <div className="relative min-h-[160px] overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#DCFCE7] text-[#16A34A]">
                      <Crown size={20} />
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-bold text-[#16A34A]">+3 mes</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-[13px] font-semibold text-slate-500">En prueba</p>
                    <p className="mt-0.5 text-2xl font-black text-slate-900">18</p>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 right-3 opacity-[0.06] text-[#16A34A]">
                    <Crown size={64} />
                  </div>
                </div>

                {/* Suspendidas */}
                <div className="relative min-h-[160px] overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#FEE2E2] text-[#DC2626]">
                      <AlertCircle size={20} />
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-bold text-[#DC2626]">+1 mes</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-[13px] font-semibold text-slate-500">Suspendidas</p>
                    <p className="mt-0.5 text-2xl font-black text-slate-900">7</p>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 right-3 opacity-[0.06] text-[#DC2626]">
                    <AlertCircle size={64} />
                  </div>
                </div>

                {/* MRR Total */}
                <div className="relative min-h-[160px] overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#DBEAFE] text-[#2563EB]">
                      <DollarSign size={20} />
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-bold text-[#2563EB]">+8.5%</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-[13px] font-semibold text-slate-500">MRR Total</p>
                    <p className="mt-0.5 text-2xl font-black text-slate-900">RD$ 532.8K</p>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 right-3 opacity-[0.06] text-[#2563EB]">
                    <DollarSign size={64} />
                  </div>
                </div>

                {/* PrÃ³ximos Vencimientos */}
                <div className="relative min-h-[160px] overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#FEF3C7] text-[#D97706]">
                      <Calendar size={20} />
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-black text-red-650">Urgente</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-[13px] font-semibold text-slate-500">Vencimientos</p>
                    <p className="mt-0.5 text-2xl font-black text-slate-900">14</p>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 right-3 opacity-[0.06] text-[#D97706]">
                    <Calendar size={64} />
                  </div>
                </div>
              </div>

              {/* Barra de Filtros (Custom Dropdown Flow de Cobrar Hoy) */}
              <div className="rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm z-30 relative animate-[platform-fade-in_180ms_ease-out]">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_220px_minmax(280px,1fr)_auto]">
                  <FilterDropdown
                    value={statusFilter === 'Todos los estados' ? '' : statusFilter}
                    onChange={(val) => setStatusFilter(val || 'Todos los estados')}
                    placeholder="Todos los estados"
                    options={[
                      { value: 'Activas', label: 'Activas' },
                      { value: 'Pruebas', label: 'Pruebas' },
                      { value: 'Suspendidas', label: 'Suspendidas' }
                    ]}
                  />

                  <FilterDropdown
                    value={planFilter === 'Todos los planes' ? '' : planFilter}
                    onChange={(val) => setPlanFilter(val || 'Todos los planes')}
                    placeholder="Todos los planes"
                    options={[
                      { value: 'BÃ¡sico', label: 'BÃ¡sico' },
                      { value: 'Profesional', label: 'Profesional' },
                      { value: 'Empresarial', label: 'Empresarial' }
                    ]}
                  />

                  <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD]">
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
                    className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] cursor-pointer"
                  >
                    <Filter size={18} className="text-[#111827]" />
                    Limpiar filtros
                  </button>
                </div>
              </div>

              {/* Layout Operativo de dos columnas (DistribuciÃ³n 75% / 25% - Estilo Cobrar Hoy) */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_1fr] z-10 relative">
                {/* Columna Izquierda: Cartera de Empresas */}
                <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-[20px] font-bold text-[#111827]">Cartera de empresas</h2>
                      <p className="text-[13px] font-medium text-slate-400 mt-1">Seguimiento centralizado de tenants y facturaciÃ³n operativa.</p>
                    </div>
                    <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-[13px] font-bold text-[#475569]">
                      {filteredCompanies.length} registradas
                    </span>
                  </div>

                  <div className="overflow-x-auto overflow-y-visible">
                    <div className="min-w-[920px] pb-32">
                      <div className="grid grid-cols-[2.2fr_1.1fr_1.1fr_1.4fr_1.2fr_1fr_0.7fr] px-4 py-3 text-[12.5px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Empresa</span>
                        <span className="text-center">Plan</span>
                        <span className="text-center">Usuarios</span>
                        <span className="text-center">MRR / Cobro</span>
                        <span className="text-center">PrÃ³ximo Pago</span>
                        <span className="text-center">Estado</span>
                        <span className="text-right pr-2">Acciones</span>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white">
                        {filteredCompanies.map(company => {
                          const plan = plans.find(item => item.id === company.planId);
                          const isGhost = !!company.isGhostMode;
                          const companyUsersCount = globalUsers.filter(u => u.companyId === company.id).length;

                          return (
                            <div
                              key={company.id}
                              className="grid grid-cols-[2.2fr_1.1fr_1.1fr_1.4fr_1.2fr_1fr_0.7fr] items-center border-t border-[#F3F4F6] px-4 py-4 text-[14.5px] hover:bg-slate-50/65 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedCompanyDetail(company);
                                setDetailTab('RESUMEN');
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold text-white shadow-sm ${
                                  company.status === 'SUSPENDED' 
                                    ? 'bg-slate-400' 
                                    : isGhost 
                                      ? 'bg-purple-600 shadow-purple-200' 
                                      : 'bg-blue-600 shadow-blue-200'
                                }`}>
                                  {company.name[0].toUpperCase()}
                                  {isGhost && (
                                    <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-purple-600 text-white animate-pulse">
                                      <Ghost size={8} />
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="group flex min-w-0 flex-col text-left transition-all duration-200 hover:translate-x-1 cursor-pointer"
                                >
                                  <span className="font-bold text-[#111827] group-hover:text-[#2563EB] transition-colors">
                                    {company.name}
                                  </span>
                                  <span className="text-[11.5px] font-semibold text-slate-400 mt-0.5">ID: {company.id}</span>
                                </button>
                              </div>

                              <span className="text-center font-bold text-slate-700">{plan?.name || 'BÃ¡sico'}</span>
                              <span className="text-center font-semibold text-[#475569]">{companyUsersCount} usuarios</span>
                              <div className="text-center">
                                <p className="font-bold text-slate-900">{formatCurrency(company.subscriptionPrice)}</p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{company.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}</p>
                              </div>
                              <span className="text-center font-semibold text-slate-600">{formatDate(company.expiresAt)}</span>
                              <div className="text-center">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border ${
                                  company.status === 'ACTIVE' 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                    : company.status === 'TRIAL' 
                                      ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                      : 'bg-rose-50 text-rose-600 border-rose-200'
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    company.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : company.status === 'TRIAL' ? 'bg-amber-500' : 'bg-rose-500'
                                  }`} />
                                  {company.status === 'ACTIVE' ? 'Activo' : company.status === 'TRIAL' ? 'Prueba' : 'Suspendido'}
                                </span>
                              </div>

                              <div className="text-right pr-2 relative" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      if (activeActionsDropdown === company.id) {
                                        setActiveActionsDropdown(null);
                                        setDropdownCoords(null);
                                      } else {
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        const spaceBelow = window.innerHeight - rect.bottom;
                                        const openUpward = spaceBelow < 220; // Si hay menos de 220px abajo, abrir hacia arriba
                                        const top = openUpward 
                                          ? rect.top + window.scrollY - 205
                                          : rect.bottom + window.scrollY + 8;
                                        const left = rect.right + window.scrollX - 200;

                                        setActiveActionsDropdown(company.id);
                                        setDropdownCoords({ top, left, openUpward });
                                      }
                                    }}
                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                                      activeActionsDropdown === company.id
                                        ? 'border-[#2563EB] bg-[#EFF6FF]/40 text-[#2563EB]'
                                        : 'border-slate-200 bg-white text-[#94A3B8] hover:border-slate-350 hover:bg-slate-50'
                                    }`}
                                  >
                                    <MoreHorizontal size={16} />
                                  </button>

                                  {activeActionsDropdown === company.id && dropdownCoords && createPortal(
                                    <div 
                                      style={{ 
                                        position: 'absolute',
                                        top: `${dropdownCoords.top}px`,
                                        left: `${dropdownCoords.left}px`,
                                      }}
                                      className="z-[9999] w-[200px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)] animate-[platform-fade-in_120ms_ease-out]"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedCompanyDetail(company);
                                          setDetailTab('RESUMEN');
                                          setActiveActionsDropdown(null);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[15px] font-semibold text-slate-700 hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-all hover:translate-x-1"
                                      >
                                        <Building2 size={16} className="text-[#2563EB]" />
                                        Ver perfil
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleToggleGhost(company.id, isGhost);
                                          setActiveActionsDropdown(null);
                                        }}
                                        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[15px] font-semibold transition-all hover:translate-x-1 ${
                                          isGhost
                                            ? 'text-purple-650 hover:bg-purple-50/50'
                                            : 'text-slate-700 hover:bg-[#F8FAFC] hover:text-purple-650'
                                        }`}
                                      >
                                        <Ghost size={16} className={isGhost ? 'text-purple-500' : 'text-slate-400'} />
                                        {isGhost ? 'Desactivar emulaciÃ³n' : 'Emular sesiÃ³n'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCompany(company);
                                          setProvisionName(company.name);
                                          setProvisionPlanId(company.planId);
                                          setProvisionCycle(company.billingCycle);
                                          setProvisionPrice(company.subscriptionPrice || 0);
                                          setIsCompanyModalOpen(true);
                                          setActiveActionsDropdown(null);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[15px] font-semibold text-slate-700 hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-all hover:translate-x-1"
                                      >
                                        <Edit3 size={16} className="text-[#2563EB]" />
                                        Editar empresa
                                      </button>

                                      <div className="my-1 border-t border-slate-100" />

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveActionsDropdown(null);
                                          if (company.status === 'ACTIVE') {
                                            window.dispatchEvent(new CustomEvent('PLATFORM_MODAL_EVENT', {
                                              detail: {
                                                id: `suspend-${company.id}`,
                                                state: 'open',
                                                tone: 'danger',
                                                title: `Â¿Suspender acceso de ${company.name}?`,
                                                description: `Esta acciÃ³n denegarÃ¡ de inmediato el acceso a todos los administradores y usuarios de esta empresa.`,
                                                confirmLabel: 'Confirmar SuspensiÃ³n',
                                                cancelLabel: 'Cancelar',
                                                onConfirm: () => handleToggleCompany(company.id, company.status)
                                              }
                                            }));
                                          } else {
                                            handleToggleCompany(company.id, company.status);
                                          }
                                        }}
                                        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold transition-all hover:translate-x-1 ${
                                          company.status === 'ACTIVE'
                                            ? 'text-red-600 hover:bg-red-50/50'
                                            : 'text-emerald-650 hover:bg-emerald-50/50'
                                        }`}
                                      >
                                        <AlertTriangle size={14} className={company.status === 'ACTIVE' ? 'text-red-400' : 'text-emerald-400'} />
                                        {company.status === 'ACTIVE' ? 'Suspender' : 'Activar'}
                                      </button>
                                    </div>,
                                    document.body
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Panel Lateral Operativo Estilo Cobrar Hoy */}
                <div className="space-y-5">
                  {/* Bloque A: Empresas en seguimiento */}
                  <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
                      <AlertTriangle size={18} className="text-amber-500" />
                      <h3 className="text-[17px] font-semibold text-slate-900">Empresas en seguimiento</h3>
                    </div>
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-4 p-3 rounded-[18px] bg-red-50/40 border border-red-100/50 transition-all duration-200 hover:translate-x-1">
                        <div>
                          <p className="text-[13.5px] font-bold text-slate-900">Inversiones Almonte</p>
                          <p className="text-[11px] font-semibold text-red-600 mt-0.5">SuscripciÃ³n vencida hace 4 dÃ­as</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-700">Mora</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 p-3 rounded-[18px] bg-amber-50/40 border border-amber-100/50 transition-all duration-200 hover:translate-x-1">
                        <div>
                          <p className="text-[13.5px] font-bold text-slate-900">PrestaFacil RD</p>
                          <p className="text-[11px] font-semibold text-amber-600 mt-0.5">Prueba por expirar en 3 dÃ­as</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">Trial</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloque B: Renovaciones PrÃ³ximas */}
                  <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
                      <CalendarCheck size={18} className="text-blue-500" />
                      <h3 className="text-[17px] font-semibold text-slate-900">Renovaciones prÃ³ximas</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-[18px] bg-[#FCFDFF] border border-slate-100 transition-all duration-200 hover:translate-x-1">
                        <div>
                          <p className="text-[13.5px] font-bold text-slate-900">CrediGarantÃ­as</p>
                          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Expira: 12/07/2026</p>
                        </div>
                        <span className="font-bold text-slate-900 text-[13.5px]">{formatCurrency(3500)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-[18px] bg-[#FCFDFF] border border-slate-100 transition-all duration-200 hover:translate-x-1">
                        <div>
                          <p className="text-[13.5px] font-bold text-slate-900">Capital Express</p>
                          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Expira: 18/07/2026</p>
                        </div>
                        <span className="font-bold text-slate-900 text-[13.5px]">{formatCurrency(8000)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloque C: Actividad Reciente del Tenant */}
                  <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
                      <Clock3 size={18} className="text-purple-500" />
                      <h3 className="text-[17px] font-semibold text-slate-900">Actividad del tenant</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 transition-all duration-200 hover:translate-x-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                          <Activity size={14} />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-950 leading-tight">Acceso Emulado</p>
                          <p className="text-[11.5px] font-medium text-slate-500 mt-0.5">Super Admin iniciÃ³ sesiÃ³n en PrestaFacil RD</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 transition-all duration-200 hover:translate-x-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                          <CheckCircle2 size={14} />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-950 leading-tight">Pago Recibido</p>
                          <p className="text-[11.5px] font-medium text-slate-500 mt-0.5">RD$ 3,500.00 recibidos de CrediGarantÃ­as</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )
        ) : null}
        {activeTab === 'GLOBAL_USERS' ? (
          <section className="space-y-5">
            <PlatformPageHeader
              title="Usuarios"
              description="Gestiona el equipo interno del SaaS, usuarios de empresas, roles, permisos, invitaciones y sesiones activas."
              actions={usersHeaderActions}
            />
            <div className={`${shellCardClass} overflow-visible`}>
              <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
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
                          active
                            ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
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
                            active
                              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
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
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Equipo SaaS</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Operadores internos de ABUNDRA</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Miembros internos con acceso administrativo, soporte, facturación, auditoría y operación global de la plataforma.
                      </p>
                    </div>
                    <PlatformKpiGrid items={saasTeamKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
                      <div className="space-y-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-end">
                        <div className="relative w-full max-w-[380px]">
                          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                          <input
                            value={usersSearchTerm}
                            onChange={event => setUsersSearchTerm(event.target.value)}
                            placeholder="Buscar por nombre, correo, rol o area..."
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
                      <div className="hidden">
                        <div className="grid grid-cols-[minmax(0,1.4fr)_0.86fr_0.82fr_0.68fr_0.78fr_0.58fr_56px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                          <div>Usuario</div>
                          <div>Rol SaaS</div>
                          <div>Area</div>
                          <div>Estado</div>
                          <div>Ãšltimo acceso</div>
                          <div>2FA</div>
                          <div className="text-center">Acc.</div>
                        </div>
                        <div className="divide-y divide-[#EEF2F7]">
                            {filteredSaasMembers.map(member => {
                              const menuId = `saas-user-${member.id}`;
                              return (
                              <div key={member.id} className="group grid grid-cols-[minmax(0,1.4fr)_0.86fr_0.82fr_0.68fr_0.78fr_0.58fr_56px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]">
                                <div className="flex min-w-0 items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-[12px] font-black uppercase text-white shadow-[0_14px_28px_rgba(37,99,235,0.18)] transition-all duration-200 group-hover:scale-[1.04] group-hover:shadow-[0_18px_36px_rgba(37,99,235,0.24)]">
                                    {member.name.slice(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{member.name}</p>
                                    <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{member.email}</p>
                                  </div>
                                </div>
                                <div>
                                  <StatusBadge label={member.role} tone={member.role === 'Super Admin' || member.role === 'Owner SaaS' ? 'blue' : 'neutral'} />
                                </div>
                                <div className="truncate text-[14px] font-medium text-[#475569]">{member.area}</div>
                                <div>
                                  <StatusBadge label={member.status} tone={member.status === 'Activo' ? 'success' : 'warning'} />
                                </div>
                                <div className="truncate text-[13px] font-medium text-[#6B7280]">{member.lastAccess}</div>
                                <div>
                                  <StatusBadge label={member.twoFactor ? 'Activo' : 'Pendiente'} tone={member.twoFactor ? 'success' : 'warning'} />
                                </div>
                                <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={event => openContextMenu(event, menuId)}
                                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${
                                      activeActionsDropdown === menuId
                                        ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]'
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
                                        <UserCog size={16} className="text-[#2563EB]" />
                                        Ver perfil
                                      </button>
                                      <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                                        <ShieldCheck size={16} className="text-emerald-600" />
                                        Editar permisos
                                      </button>
                                      <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-purple-700">
                                        <RefreshCw size={16} className="text-purple-600" />
                                        Revocar sesiones
                                      </button>
                                      <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-amber-50 hover:text-amber-700">
                                        <AlertTriangle size={16} className="text-amber-500" />
                                        Forzar cambio de contraseÃ±a
                                      </button>
                                      <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-rose-50 hover:text-rose-700">
                                        <ShieldAlert size={16} className="text-rose-500" />
                                        Desactivar
                                      </button>
                                      <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                                        <Activity size={16} className="text-slate-500" />
                                        Ver actividad
                                      </button>
                                    </div>,
                                    document.body,
                                  )}
                                </div>
                              </div>
                            )})}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <SidebarInfoCard title="Control y seguridad" icon={ShieldCheck}>
                        <SummaryRow label="Scope esperado" value="SAAS / sin empresa_id" tone="blue" />
                        <SummaryRow label="Acciones auditables" value="100% registradas" tone="success" />
                        <SummaryRow label="Revocacion rapida" value="Disponible" tone="neutral" />
                      </SidebarInfoCard>
                      <SidebarInfoCard title="Acciones sensibles" icon={ShieldAlert}>
                        <ActionListItem icon={UserCog} title="Editar permisos" detail="Ajusta alcance operativo, soporte e impersonacion por contexto." />
                        <ActionListItem icon={Activity} title="Revocar sesiones" detail="Corta accesos activos en incidentes o cambios de seguridad." />
                        <ActionListItem icon={RefreshCw} title="Forzar cambio de contraseÃ±a" detail="Aplica rotaciÃ³n inmediata a miembros con acceso crÃ­tico." />
                      </SidebarInfoCard>
                    </div>
                    </div>
                  </div>
                ) : null}
                {usersManagementTab === 'TENANT_USERS' ? (
                  <div className="space-y-6">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Usuarios de Empresas</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Usuarios registrados dentro de tenants</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Consulta usuarios registrados en empresas, sus roles, sucursales, estado y actividad dentro del SaaS.
                      </p>
                    </div>
                    <PlatformKpiGrid items={tenantUserKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1.7fr)_360px]">
                      <div className="contents">
                        <div className="xl:col-span-2">
                          <UsersFilterBar
                            searchValue={usersSearchTerm}
                            onSearchChange={setUsersSearchTerm}
                            searchPlaceholder="Buscar por nombre, correo, telÃ©fono, empresa o cÃ³digo interno..."
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
                        <div className="hidden">
                          <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
                            <div>
                              <h4 className="text-[18px] font-semibold text-[#111827]">Directorio de usuarios</h4>
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Vista operativa por tenant, sucursal, rol y estado de acceso.</p>
                            </div>
                            <button
                              type="button"
                              onClick={handleExportTenantUsers}
                              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}
                            >
                              <Download size={15} />
                              Exportar
                            </button>
                          </div>
                          <div>
                            <div>
                              <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_0.72fr_0.68fr_0.78fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                                <div>Usuario</div>
                                <div>Empresa</div>
                                <div>Rol</div>
                                <div>Estado</div>
                                <div>Ãšltimo acceso</div>
                                <div className="text-center">Acc.</div>
                              </div>
                              <div className="divide-y divide-[#EEF2F7]">
                                {filteredTenantUsers.map(user => {
                                  const menuId = `tenant-user-${user.id}`;
                                  return (
                                    <div key={user.id} className="group grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_0.72fr_0.68fr_0.78fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]">
                                      <div className="flex min-w-0 items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[12px] font-black uppercase text-[#2563EB] transition-all duration-200 group-hover:scale-[1.04] group-hover:bg-[#DBEAFE]">
                                          {user.name.slice(0, 2)}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{user.name}</p>
                                          <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{user.email}</p>
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-[14px] font-semibold text-[#111827]">{user.companyName}</p>
                                        <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{user.branchName}</p>
                                      </div>
                                      <div>
                                        <StatusBadge label={user.role} tone={getUserRoleTone(user.role as Role)} />
                                      </div>
                                      <div>
                                        <StatusBadge label={user.status} tone={user.status === 'Activo' ? 'success' : 'danger'} />
                                      </div>
                                      <div className="truncate text-[13px] font-medium text-[#6B7280]">{user.lastAccess}</div>
                                      <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={event => openContextMenu(event, menuId)}
                                          className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${
                                            activeActionsDropdown === menuId
                                              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]'
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
                                              <UserCog size={16} className="text-[#2563EB]" />
                                              Ver usuario
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const company = tenantCompanies.find(item => item.name === user.companyName);
                                                if (company) {
                                                  setSelectedCompanyDetail(company);
                                                  setDetailTab('RESUMEN');
                                                }
                                                setActiveActionsDropdown(null);
                                              }}
                                              className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                                            >
                                              <Building2 size={16} className="text-indigo-600" />
                                              Ver empresa
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-rose-50 hover:text-rose-700">
                                              <ShieldAlert size={16} className="text-rose-500" />
                                              Suspender acceso
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-amber-50 hover:text-amber-700">
                                              <RefreshCw size={16} className="text-amber-600" />
                                              Resetear contraseÃ±a
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]">
                                              <Activity size={16} className="text-slate-500" />
                                              Ver actividad
                                            </button>
                                            <button type="button" onClick={() => setActiveActionsDropdown(null)} className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 hover:bg-purple-50 hover:text-purple-700">
                                              <RefreshCw size={16} className="text-purple-600" />
                                              Revocar sesiones
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
                              detail={`${access.company} Â· ${access.time} Â· ${access.channel}`}
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
                  </div>
                ) : null}
                {usersManagementTab === 'INVITATIONS' ? (
                  <div className="space-y-6">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Invitaciones</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Accesos pendientes y gestionados</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Centraliza invitaciones del equipo SaaS y de usuarios de empresas con estado, rol y trazabilidad.
                      </p>
                    </div>
                    <PlatformKpiGrid items={invitationKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1.7fr)_360px]">
                      <div className="contents">
                        <div className="xl:col-span-2">
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
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Controla aceptaciÃ³n, expiraciÃ³n y revocaciÃ³n desde un mismo flujo.</p>
                            </div>
                            <button type="button" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
                              <Plus size={15} />
                              Nueva invitaciÃ³n
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
                                            activeActionsDropdown === menuId
                                              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]'
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
                        <SidebarInfoCard title="AtenciÃ³n inmediata" icon={Bell}>
                          {invitationSideCards.expiring.map(item => (
                            <ActionListItem key={item.id} icon={AlertTriangle} title={item.email} detail={`${item.company} Â· ${item.role} Â· ${item.status}`} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="ConversiÃ³n reciente" icon={CheckCircle2}>
                          {invitationSideCards.accepted.map(item => (
                            <ActionListItem key={item.id} icon={Users} title={item.email} detail={`${item.company} Â· ${item.role} Â· aceptada el ${item.date}`} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Atajos del flujo" icon={Sparkles}>
                          <ActionListItem icon={RefreshCw} title="Reenviar lote" detail="Reintenta invitaciones pendientes sin salir del mÃ³dulo." />
                          <ActionListItem icon={ShieldCheck} title="Validar roles" detail="Comprueba que el acceso enviado coincide con el contexto del usuario." />
                          <ActionListItem icon={FileText} title="Auditar invitaciones" detail="Revisa trazabilidad completa para cumplimiento y soporte." />
                        </SidebarInfoCard>
                      </div>
                    </div>
                  </div>
                ) : null}
                {usersManagementTab === 'ROLES' ? (
                  <div className="space-y-6">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Roles y Permisos</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Permisos separados por contexto</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Define claramente permisos SaaS y permisos Tenant sin mezclar responsabilidades entre ABUNDRA y las empresas cliente.
                      </p>
                    </div>
                    <PlatformKpiGrid items={rolePermissionKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
                      <div className="space-y-5">
                        <RolePermissionsList roleCards={roleCards} />
                        <RolePermissionMatrix permissionMatrix={permissionMatrix} onAction={handleRoleAction} />
                      </div>
                      <div className="hidden">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                              <Crown size={20} />
                          </div>
                          <div>
                            <h4 className="text-[20px] font-semibold text-[#111827]">Roles SaaS</h4>
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
                                <StatusBadge label="SaaS" tone="blue" />
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
                              <h4 className="text-[20px] font-semibold text-[#111827]">Roles Tenant</h4>
                              <p className="text-[14px] font-medium text-[#6B7280]">Usuarios ligados a empresa y operaciÃ³n diaria de cada cliente.</p>
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
                                  <StatusBadge label="Tenant" tone="success" />
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
                          <SummaryRow label="SeparaciÃ³n SaaS/Tenant" value="Correcta" tone="success" />
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Flow designer" icon={Sparkles}>
                          <ActionListItem icon={Crown} title="Permisos SaaS" detail="Asegura alcance sobre empresas, auditorÃ­a, soporte e ingresos globales." />
                          <ActionListItem icon={Building2} title="Permisos tenant" detail="Evita mezclar operaciÃ³n de clientes con control del SaaS." />
                          <ActionListItem icon={ShieldAlert} title="RevisiÃ³n de riesgos" detail="Prioriza permisos sensibles antes de delegar acceso administrativo." />
                        </SidebarInfoCard>
                      </div>
                    </div>
                  </div>
                ) : null}
                {usersManagementTab === 'SESSIONS' ? (
                  <div className="space-y-6">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Sesiones</p>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Control de accesos activos</h3>
                      <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-[#6B7280]">
                        Visualiza sesiones SaaS y tenant, identifica actividad sospechosa y revoca accesos en tiempo real.
                      </p>
                    </div>
                    <PlatformKpiGrid items={sessionKpis} isLoading={usersKpiState.isLoading} error={usersKpiState.error} />
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1.7fr)_360px]">
                      <div className="contents">
                        <div className="xl:col-span-2">
                          <UsersFilterBar
                            searchValue={sessionSearchTerm}
                            onSearchChange={setSessionSearchTerm}
                            searchPlaceholder="Buscar por usuario, IP, dispositivo, empresa o ubicaciÃ³n..."
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
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Detecta accesos anÃ³malos y responde sin salir del centro operativo.</p>
                            </div>
                            <button type="button" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
                              <ShieldCheck size={15} />
                              Endurecer polÃ­ticas
                            </button>
                          </div>
                          <div>
                            <div>
                              <div className="grid grid-cols-[minmax(0,1.2fr)_0.56fr_minmax(0,0.82fr)_minmax(0,1fr)_0.72fr_0.66fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                                <div>Usuario</div>
                                <div>Tipo</div>
                                <div>Empresa</div>
                                <div>Dispositivo / IP</div>
                                <div>Ãšltima actividad</div>
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
                                        <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{session.ip} Â· {session.location}</p>
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
                                            activeActionsDropdown === menuId
                                              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]'
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
                                              Revocar sesiÃ³n
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
                        <SidebarInfoCard title="Sesiones en observaciÃ³n" icon={ShieldAlert}>
                          {sessionSideSummary.suspicious.map(session => (
                            <ActionListItem key={session.id} icon={AlertTriangle} title={session.user} detail={`${session.company} Â· ${session.location} Â· ${session.activity}`} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Revocaciones recientes" icon={RefreshCw}>
                          {sessionSideSummary.revocations.map(item => (
                            <ActionListItem key={item.user} icon={RefreshCw} title={item.user} detail={item.detail} />
                          ))}
                        </SidebarInfoCard>
                        <SidebarInfoCard title="Postura de seguridad" icon={ShieldCheck}>
                          <SummaryRow label="2FA forzado" value="Equipo SaaS" tone="success" />
                          <SummaryRow label="IPs sospechosas" value={`${filteredSessionRows.filter(session => session.status === 'Sospechosa').length}`} tone="danger" />
                          <SummaryRow label="RevocaciÃ³n inmediata" value="Disponible" tone="blue" />
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
          <section className="space-y-5">
            <SectionHeader
              title="Planes y Suscripciones"
              description="Catalogo de planes, limites de recursos y precios del SaaS."
            />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className={`${shellCardClass} relative overflow-hidden p-6`}>
                <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-[#DBEAFE]/60 blur-3xl" />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Arquitectura comercial</p>
                    <h3 className="mt-2 text-[26px] font-semibold tracking-tight text-[#111827]">Escala cada tenant con un pricing claro</h3>
                    <p className="mt-2 max-w-2xl text-[14px] font-medium leading-7 text-[#6B7280]">
                      Ajusta limites, cobertura operativa y posicionamiento de producto sin romper la lectura del dashboard.
                    </p>
                  </div>
                  <div className="grid min-w-[280px] grid-cols-2 gap-3">
                    <SummaryMetric label="Planes activos" value={`${plans.length}`} iconTone="blue" />
                    <SummaryMetric label="Tenants en Pro" value={`${tenantCompanies.filter(company => company.planId === 'p2').length}`} iconTone="violet" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsYearly(false)}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${!isYearly ? 'bg-[#EFF6FF] text-[#2563EB] shadow-sm' : 'text-[#6B7280] hover:text-[#2563EB]'}`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setIsYearly(true)}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${isYearly ? 'bg-[#EFF6FF] text-[#2563EB] shadow-sm' : 'text-[#6B7280] hover:text-[#2563EB]'}`}
                >
                  Anual
                </button>
              </div>
            </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {plans.map(plan => {
                const price = isYearly ? (plan.yearlyPrice || plan.monthlyPrice * 10) : plan.monthlyPrice;
                const isEnterprise = plan.id === 'p3';
                const isPro = plan.id === 'p2';

                return (
                  <div 
                    key={plan.id} 
                    className={`${shellCardClass} flex flex-col p-6 rounded-[32px] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden border ${
                      isEnterprise 
                        ? 'border-purple-200 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-50/20 via-white to-white' 
                        : isPro
                          ? 'border-blue-200 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/20 via-white to-white'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Badge Popular / Recomendado */}
                    {plan.isOffer && (
                      <div className="absolute right-0 top-0 bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl shadow-sm">
                        {plan.offerText || 'Popular'}
                      </div>
                    )}

                    <div className="space-y-1.5 pb-5 border-b border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modelo de SuscripciÃ³n</p>
                      <h3 className="text-[25px] font-black tracking-tight text-slate-900">{plan.name}</h3>
                    </div>

                    <div className="py-6 space-y-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[38px] font-black tracking-tight text-slate-900">{formatCurrency(price)}</span>
                        <span className="text-sm font-semibold text-slate-400">/ {isYearly ? 'aÃ±o' : 'mes'}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-400">
                        {isYearly ? 'Cobrado anualmente en una sola cuota' : 'Cobro recurrente mensual'}
                      </p>
                    </div>

                    {/* LÃ­mites Cuantitativos del Plan */}
                    <div className="flex-1 space-y-4 pt-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">LÃ­mites y Recursos Incluidos</p>
                      
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#FCFDFF] px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:shadow-sm">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-slate-400" />
                          <span className="text-[13.5px] font-semibold text-slate-600">Clientes MÃ¡ximos</span>
                        </div>
                        <span className="text-[14px] font-black text-slate-800">{plan.maxClients === 999999 ? 'Ilimitados' : plan.maxClients}</span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#FCFDFF] px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:shadow-sm">
                        <div className="flex items-center gap-2">
                          <UserCog size={16} className="text-slate-400" />
                          <span className="text-[13.5px] font-semibold text-slate-600">Usuarios por Empresa</span>
                        </div>
                        <span className="text-[14px] font-black text-slate-800">{plan.maxUsers === 999999 ? 'Ilimitados' : plan.maxUsers}</span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#FCFDFF] px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:shadow-sm">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-slate-400" />
                          <span className="text-[13.5px] font-semibold text-slate-600">Sucursales Permitidas</span>
                        </div>
                        <span className="text-[14px] font-black text-slate-800">{plan.maxBranches === 999999 ? 'Ilimitadas' : plan.maxBranches}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(plan);
                        setIsPlanModalOpen(true);
                      }}
                      className={`mt-8 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[14px] font-bold text-slate-700 cursor-pointer ${motionButtonClass}`}
                    >
                      <Edit3 size={15} />
                      Editar parÃ¡metros del plan
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeTab === 'BILLING' ? (
          <section className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
            <SectionHeader
              title="FacturaciÃ³n"
              description="Seguimiento de suscripciones, cobros globales y estado de renovacion por empresa."
              actionLabel="Exportar resumen"
            />
            <div className={`${shellCardClass} p-5`}>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_220px]">
                <div className="relative">
                  <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    value={billingSearchTerm}
                    onChange={event => setBillingSearchTerm(event.target.value)}
                    placeholder="Buscar por empresa, plan, ciclo o estado..."
                    className={`${filterFieldClass} w-full pl-11 pr-4 text-[#111827] placeholder:text-[#9CA3AF]`}
                  />
                </div>
                <select value={billingStatusFilter} onChange={event => setBillingStatusFilter(event.target.value)} className={filterFieldClass}>
                  <option value="Todos">Todos los estados</option>
                  <option value="Pagada">Pagada</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En mora">En mora</option>
                </select>
              </div>
            </div>
            <div className={`${shellCardClass} overflow-hidden rounded-[32px]`}>
              <div className="grid gap-4 border-b border-[#E5E7EB] bg-slate-50/50 p-6 lg:grid-cols-4">
                {[
                  { label: 'MRR Mensual Estimado', value: formatCurrency(metrics.mrr), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', textColor: 'text-slate-900' },
                  { label: 'Cobros Totales', value: formatCurrency(metrics.totalRevenue), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', textColor: 'text-slate-900' },
                  { label: 'Tenants Activos', value: `${tenantCompanies.filter(c => c.status === 'ACTIVE').length}`, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50', textColor: 'text-slate-900' },
                  { label: 'Facturas Pendientes', value: `${billingRows.filter(item => item.status !== 'Pagada').length}`, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', textColor: 'text-red-600' },
                ].map(card => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{card.label}</p>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                          <Icon size={16} />
                        </div>
                      </div>
                      <p className={`mt-2 text-2xl font-black ${card.textColor}`}>{card.value}</p>
                    </div>
                  );
                })}
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[940px]">
                  {/* Header */}
                  <div className="grid grid-cols-[2fr_1.4fr_1.1fr_1.3fr_1.3fr_1.3fr] px-6 py-4.5 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-[#F8FAFC]">
                    <div>Empresa / Tenant</div>
                    <div>Plan contratado</div>
                    <div>Ciclo</div>
                    <div>Monto</div>
                    <div>Estado de pago</div>
                    <div>PrÃ³x. Vencimiento</div>
                  </div>
                  {/* Body */}
                  <div className="divide-y divide-slate-100 bg-white">
                    {filteredBillingRows.map(row => (
                      <div
                        key={row.id}
                        className="group grid grid-cols-[2fr_1.4fr_1.1fr_1.3fr_1.3fr_1.3fr] items-center border-t border-slate-100 px-6 py-4.5 text-[14.5px] hover:bg-[#FCFDFF] transition-all duration-200"
                      >
                        <div className="flex cursor-pointer items-center gap-3 text-left transition-all duration-200 group-hover:translate-x-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[12px] font-black uppercase text-[#2563EB] transition-all duration-200 group-hover:bg-[#DBEAFE]">
                            {row.companyName.slice(0, 2)}
                          </div>
                          <span className="font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors">{row.companyName}</span>
                        </div>
                        <div className="font-medium text-slate-600">{row.planName}</div>
                        <div>
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${row.cycle === 'Anual' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {row.cycle}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900">{formatCurrency(row.amount)}</div>
                        <div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${
                            row.status === 'Pagada' 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                              : row.status === 'Pendiente' 
                                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                : 'bg-red-50 text-red-600 border-red-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              row.status === 'Pagada' ? 'bg-emerald-500 animate-pulse' : row.status === 'Pendiente' ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                            {row.status}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-500">{formatDate(row.dueDate)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'REPORTS' ? (
          <section className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
            <SectionHeader
              title="Reportes Globales"
              description="Lectura ejecutiva del SaaS con resumen financiero, operativo y de riesgo."
            />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <div className={`${shellCardClass} p-6`}>
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                  <FileText size={20} className="text-[#2563EB]" />
                  <h2 className="text-[20px] font-black tracking-tight text-slate-900">Panel Ejecutivo de Reportes</h2>
                </div>
                <div className="space-y-4">
                  {reportRows.map(row => (
                    <div key={row.title} className="group rounded-[22px] border border-slate-200 bg-[#FCFDFF] p-5 transition-all duration-200 hover:translate-x-1 hover:border-slate-350">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-[16px] font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{row.title}</p>
                          <p className="text-[13.5px] font-semibold leading-relaxed text-slate-500">{row.detail}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${
                          row.badge === 'Financiero' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                            : row.badge === 'Operativo' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}>
                          {row.badge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${shellCardClass} p-6 flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                    <Download size={20} className="text-[#2563EB]" />
                    <h2 className="text-[20px] font-black tracking-tight text-slate-900">Exportaciones en Vivo</h2>
                  </div>
                  <div className="space-y-3.5">
                    <ExportRow title="Financiero global" detail="MRR, cobros, cartera y suscripciones." />
                    <ExportRow title="Uso por empresa" detail="Usuarios, actividad y adopcion por tenant." />
                    <ExportRow title="Auditoria consolidada" detail="Eventos criticos y trazabilidad del sistema." />
                  </div>
                </div>
                
                <div className="mt-8 pt-5 border-t border-slate-100 text-center">
                  <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Las exportaciones se generan bajo demanda en formato CSV o PDF de alta definiciÃ³n 1A.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'AUDIT' ? (
          <section className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
            <SectionHeader
              title="Auditoria"
              description="Bitacora global de acciones criticas, cambios administrativos y eventos de seguridad."
              actionLabel="Exportar log"
            />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
              <div className="rounded-[28px] border border-slate-800 bg-[#111827] p-4 shadow-[0_22px_60px_rgba(15,23,42,0.22)]">
                <div className="relative">
                  <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={auditSearchTerm}
                    onChange={event => setAuditSearchTerm(event.target.value)}
                    placeholder="Buscar por accion, detalle o trace id..."
                    className="h-[52px] w-full rounded-2xl border border-slate-700 bg-slate-900/80 pl-11 pr-4 text-[14px] font-medium text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-500 hover:border-slate-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 xl:grid-cols-1">
                <div className="rounded-[22px] border border-slate-800 bg-[#111827] px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Eventos</p>
                  <p className="mt-2 text-[24px] font-black text-slate-50">{filteredMasterLogs.length}</p>
                </div>
                <div className="rounded-[22px] border border-slate-800 bg-[#111827] px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Criticos</p>
                  <p className="mt-2 text-[24px] font-black text-amber-400">{masterLogs.filter(log => /suspend|error|riesgo|crit/i.test(`${log.action} ${log.detail}`)).length}</p>
                </div>
                <div className="rounded-[22px] border border-slate-800 bg-[#111827] px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Live</p>
                  <p className="mt-2 text-[24px] font-black text-emerald-400">Streaming</p>
                </div>
              </div>
            </div>

            {/* Consola Terminal Premium */}
            <div className="rounded-[32px] bg-[#0F172A] border border-slate-800 shadow-2xl p-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500" />
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-500 font-mono ml-2">master_audit_stream.log</span>
                </div>
                <div className="inline-flex rounded-lg bg-slate-800/60 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-emerald-400 font-mono">
                  LIVE CONNECTION
                </div>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 font-mono text-[13.5px] leading-relaxed custom-scrollbar">
                {filteredMasterLogs.map(log => (
                  <div key={log.id} className="group p-3.5 rounded-2xl bg-slate-900/60 border border-slate-850 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-blue-400 font-bold">[{formatDate(log.timestamp)} {new Date(log.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                          <span className="text-purple-400 font-bold transition-colors duration-200 group-hover:text-purple-300">&gt; {log.action}</span>
                        </div>
                        <p className="mt-2 text-emerald-400/90 break-words leading-relaxed pl-2 border-l-2 border-slate-700">
                          {log.detail}
                        </p>
                      </div>
                      <div className="shrink-0 text-slate-500 text-[11px] font-bold text-right pt-0.5">
                        session_trace_id: <span className="text-slate-400">{log.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'SYSTEM' ? (
          <section className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
            <SectionHeader
              title="ConfiguraciÃ³n del Sistema"
              description="Mantenimiento global, version del sistema y mensajes de difusion."
              actionLabel="Guardar configuracion"
              onAction={handleUpdateConfig}
            />
            <div className={`${shellCardClass} p-6 lg:p-8 rounded-[32px]`}>
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.09),_transparent_38%),linear-gradient(180deg,#FCFDFF_0%,#FFFFFF_100%)] p-5 shadow-sm">
                    <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#DBEAFE]/50 blur-3xl" />
                    <div className="relative flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
                      <span className="inline-flex rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">
                        Flow Designer
                      </span>
                      <span className="inline-flex rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-[11px] font-bold text-slate-500">
                        Kernel operativo
                      </span>
                    </div>
                    <div className="relative mt-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-all duration-200 ${
                          platformConfig.maintenanceMode ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'
                        }`}>
                          {platformConfig.maintenanceMode ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
                        </div>
                        <div>
                          <p className="text-[17px] font-black text-slate-900 leading-tight">Modo Mantenimiento Global</p>
                          <p className="text-[13.5px] font-semibold text-slate-500 mt-1">Control global para restringir acceso temporalmente.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlatformConfig(current => ({ ...current, maintenanceMode: !current.maintenanceMode }))}
                        className={`inline-flex h-11 items-center justify-center rounded-2xl px-5 text-[13.5px] font-bold transition-all cursor-pointer ${
                          platformConfig.maintenanceMode
                            ? 'border border-red-200 bg-red-50 text-red-600 hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-[0_12px_28px_rgba(220,38,38,0.12)]'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-600 hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-[0_12px_28px_rgba(22,163,74,0.12)]'
                        }`}
                      >
                        {platformConfig.maintenanceMode ? 'Activo' : 'Desactivado'}
                      </button>
                    </div>
                    <div className="relative mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[22px] border border-slate-100 bg-white/90 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Flow activo</p>
                        <p className="mt-2 text-[18px] font-black text-slate-900">Publicacion estable</p>
                        <p className="mt-1 text-[12.5px] font-medium text-slate-500">Reglas globales sincronizadas</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-100 bg-white/90 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Ultimo push</p>
                        <p className="mt-2 text-[18px] font-black text-slate-900">{platformConfig.maintenanceDate || 'Sin fecha'}</p>
                        <p className="mt-1 text-[12.5px] font-medium text-slate-500">Ventana programada del kernel</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-100 bg-white/90 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Version core</p>
                        <p className="mt-2 text-[18px] font-black text-slate-900">{platformConfig.systemVersion}</p>
                        <p className="mt-1 text-[12.5px] font-medium text-slate-500">Branch operativo del sistema</p>
                      </div>
                    </div>
                  </div>

                  <FieldBlock label="Mensaje de DifusiÃ³n (Broadcast)">
                    <input
                      value={platformConfig.broadcastMessage}
                      onChange={event => setPlatformConfig(current => ({ ...current, broadcastMessage: event.target.value }))}
                      className={premiumInputClass}
                      placeholder="Escribe un aviso para todas las pantallas del SaaS..."
                    />
                  </FieldBlock>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FieldBlock label="Fecha programada de mantenimiento">
                      <PlatformDateField
                        value={platformConfig.maintenanceDate}
                        onChange={value => setPlatformConfig(current => ({ ...current, maintenanceDate: value }))}
                        placeholder="Seleccionar fecha"
                      />
                    </FieldBlock>
                    <FieldBlock label="VersiÃ³n del Core">
                      <input
                        value={platformConfig.systemVersion}
                        onChange={event => setPlatformConfig(current => ({ ...current, systemVersion: event.target.value }))}
                        className={premiumInputClass}
                      />
                    </FieldBlock>
                  </div>
                </div>

                <div className="space-y-4">
                  <SidebarInfoCard title="Estado del Kernel" icon={Activity}>
                    <SummaryRow label="VersiÃ³n del Core" value={platformConfig.systemVersion} tone="blue" />
                    <SummaryRow label="Mantenimiento" value={platformConfig.maintenanceMode ? 'Activo' : 'Desactivado'} tone={platformConfig.maintenanceMode ? 'danger' : 'success'} />
                    <SummaryRow label="Mensaje Broadcast" value={platformConfig.broadcastMessage || 'Sin mensaje activo'} tone="neutral" />
                  </SidebarInfoCard>
                  <div className={`${shellCardClass} p-6`}>
                    <div className="flex items-center gap-3">
                      <Settings size={20} className="text-[#2563EB]" />
                      <h3 className="text-[20px] font-semibold text-[#111827]">Acciones del DiseÃ±ador</h3>
                    </div>
                    <div className="mt-5 space-y-3">
                      <button type="button" onClick={() => navigateToSection('AUDIT')} className={`flex h-12 w-full items-center justify-between rounded-[20px] border border-[#E5E7EB] bg-white px-4 text-left text-[14px] font-semibold text-[#111827] ${motionButtonClass}`}>
                        <span>Revisar auditorÃ­a del flujo</span>
                        <ArrowUpRight size={16} />
                      </button>
                      <button type="button" className={`flex h-12 w-full items-center justify-between rounded-[20px] border border-[#E5E7EB] bg-white px-4 text-left text-[14px] font-semibold text-[#111827] ${motionButtonClass}`}>
                        <span>Validar publicacion del kernel</span>
                        <CheckCircle2 size={16} />
                      </button>
                      <button type="button" className={`flex h-12 w-full items-center justify-between rounded-[20px] border border-[#E5E7EB] bg-white px-4 text-left text-[14px] font-semibold text-[#111827] ${motionButtonClass}`}>
                        <span>Preparar ventana de mantenimiento</span>
                        <Calendar size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'HELP' ? (
          <section className="space-y-5 animate-[platform-fade-in_180ms_ease-out]">
            <SectionHeader
              title="Centro de Ayuda"
              description="Soporte para empresas, material de onboarding y atencion operativa del SaaS."
            />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">
              <div className={`${shellCardClass} p-6`}>
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                  <LifeBuoy size={20} className="text-[#2563EB]" />
                  <h2 className="text-[20px] font-black tracking-tight text-slate-900">Cola de Ayuda & Tickets Activos</h2>
                </div>
                <div className="space-y-4">
                  {helpRows.map(row => (
                    <div key={row.title} className="group rounded-[22px] border border-slate-200 bg-[#FCFDFF] p-5 transition-all duration-200 hover:translate-x-1 hover:border-slate-350 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-[16px] font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{row.title}</p>
                          <p className="text-[13.5px] font-semibold leading-relaxed text-slate-500">{row.detail}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${
                          row.tag === 'Soporte' 
                            ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                            : row.tag === 'Tutoriales' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}>
                          {row.tag}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <SidebarInfoCard title="Atajos de soporte" icon={Headphones}>
                  <ActionListItem icon={FileClock} title="Tickets recientes" detail="Seguimiento a casos abiertos de empresas y administradores." />
                  <ActionListItem icon={Sparkles} title="Tutoriales" detail="Guias visuales para adopcion del panel global." />
                  <ActionListItem icon={AlertCircle} title="Incidentes" detail="Revision de alertas y mantenimiento del sistema." />
                </SidebarInfoCard>
              </div>
            </div>
          </section>
        ) : null}

        {isSessionPolicyModalOpen ? (
          <ModalFrame title="Endurecer polÃ­ticas de sesiÃ³n" onClose={() => setIsSessionPolicyModalOpen(false)}>
            <form onSubmit={handleSaveSessionPolicy} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <FieldBlock label="DuraciÃ³n mÃ¡xima (horas)">
                  <input type="number" min={1} value={sessionPolicy.maxDurationHours} onChange={event => setSessionPolicy(current => ({ ...current, maxDurationHours: Number(event.target.value) }))} className={premiumInputClass} />
                </FieldBlock>
                <FieldBlock label="Inactividad (min)">
                  <input type="number" min={5} value={sessionPolicy.inactivityMinutes} onChange={event => setSessionPolicy(current => ({ ...current, inactivityMinutes: Number(event.target.value) }))} className={premiumInputClass} />
                </FieldBlock>
                <FieldBlock label="Sesiones simultÃ¡neas">
                  <input type="number" min={1} value={sessionPolicy.maxConcurrentSessions} onChange={event => setSessionPolicy(current => ({ ...current, maxConcurrentSessions: Number(event.target.value) }))} className={premiumInputClass} />
                </FieldBlock>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <PolicyToggle label="Exigir 2FA SaaS" checked={sessionPolicy.requireSaas2fa} onChange={value => setSessionPolicy(current => ({ ...current, requireSaas2fa: value }))} />
                <PolicyToggle label="Exigir 2FA a Admin Empresa" checked={sessionPolicy.requireTenantAdmin2fa} onChange={value => setSessionPolicy(current => ({ ...current, requireTenantAdmin2fa: value }))} />
                <PolicyToggle label="Revocar al cambiar contraseÃ±a" checked={sessionPolicy.revokeOnPasswordChange} onChange={value => setSessionPolicy(current => ({ ...current, revokeOnPasswordChange: value }))} />
                <PolicyToggle label="Revocar al suspender" checked={sessionPolicy.revokeOnSuspend} onChange={value => setSessionPolicy(current => ({ ...current, revokeOnSuspend: value }))} />
                <PolicyToggle label="Alertas de dispositivo nuevo" checked={sessionPolicy.newDeviceAlerts} onChange={value => setSessionPolicy(current => ({ ...current, newDeviceAlerts: value }))} />
              </div>
              <FieldBlock label="IP bloqueadas">
                <textarea value={sessionPolicy.blockedIps} onChange={event => setSessionPolicy(current => ({ ...current, blockedIps: event.target.value }))} className={`${premiumInputClass} min-h-[98px] py-4`} placeholder="Separar IPs por coma..." />
              </FieldBlock>
              <div className="rounded-[22px] border border-[#FDE68A] bg-[#FFFBEB] p-4 text-[13px] font-semibold leading-6 text-[#B45309]">
                Estas polÃ­ticas quedan listas para validaciÃ³n backend, auditorÃ­a y enforcement real. No se revocan sesiones de forma silenciosa.
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsSessionPolicyModalOpen(false)} className={`${platformHeaderSecondaryActionClass} h-12 px-5`}>
                  Cancelar
                </button>
                <button type="submit" className={`${platformHeaderPrimaryActionClass} h-12 px-5`}>
                  <ShieldCheck size={16} />
                  Guardar polÃ­ticas
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}

        {isSaasMemberModalOpen ? (
          <ModalFrame title="Nuevo miembro SaaS" onClose={() => setIsSaasMemberModalOpen(false)}>
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
                <FieldBlock label="TelÃ©fono">
                  <input value={saasMemberForm.phone} onChange={event => setSaasMemberForm(current => ({ ...current, phone: event.target.value }))} className={premiumInputClass} placeholder="809-000-0000" />
                </FieldBlock>
                <FieldBlock label="Rol">
                  <FilterDropdown
                    value={saasMemberForm.role}
                    onChange={value => setSaasMemberForm(current => ({ ...current, role: (value || 'Soporte') as SaasRole }))}
                    placeholder="Seleccionar rol"
                    options={SAAS_ROLES.filter(role => role !== 'Owner SaaS').map(role => ({ value: role, label: role }))}
                  />
                </FieldBlock>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="ExpiraciÃ³n de invitaciÃ³n">
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
                <textarea value={saasMemberForm.message} onChange={event => setSaasMemberForm(current => ({ ...current, message: event.target.value }))} className={`${premiumInputClass} min-h-[110px] py-4`} placeholder="Mensaje para acompaÃ±ar la invitaciÃ³n..." />
              </FieldBlock>
              <div className="rounded-[22px] border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-[13px] font-semibold leading-6 text-[#1D4ED8]">
                Esta acciÃ³n crea una invitaciÃ³n SaaS con token de un solo uso, expiraciÃ³n obligatoria, empresa_id null y usuario pendiente hasta aceptaciÃ³n.
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsSaasMemberModalOpen(false)} className={`${platformHeaderSecondaryActionClass} h-12 px-5`}>
                  Cancelar
                </button>
                <button type="submit" className={`${platformHeaderPrimaryActionClass} h-12 px-5`}>
                  <Plus size={16} />
                  Crear invitaciÃ³n
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}

        {isTenantInvitationModalOpen ? (
          <ModalFrame title="Nueva invitacion de empresa" onClose={() => setIsTenantInvitationModalOpen(false)}>
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
                      setTenantInvitationForm(current => ({ ...current, companyId, branchId: firstBranch?.id || '' }));
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
                <FieldBlock label="Rol tenant">
                  <FilterDropdown
                    value={tenantInvitationForm.role}
                    onChange={role => setTenantInvitationForm(current => ({ ...current, role: (role || Role.COBRADOR) as Role }))}
                    placeholder="Seleccionar rol"
                    options={TENANT_INVITATION_ROLES.map(role => ({ value: role, label: role }))}
                  />
                </FieldBlock>
                <FieldBlock label="Expiracion">
                  <PlatformDateField
                    value={tenantInvitationForm.expiresAt}
                    onChange={value => setTenantInvitationForm(current => ({ ...current, expiresAt: value }))}
                    placeholder="dd/mm/aaaa"
                    required
                  />
                </FieldBlock>
              </div>
              <div className="rounded-[22px] border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-[13px] font-semibold leading-6 text-[#1D4ED8]">
                Esta invitacion crea un acceso tenant pendiente. El usuario mantiene empresa_id obligatorio, sucursal dependiente y rol de empresa, sin mezclarse con usuarios SaaS.
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsTenantInvitationModalOpen(false)} className={`${platformHeaderSecondaryActionClass} h-12 px-5`}>
                  Cancelar
                </button>
                <button type="submit" className={`${platformHeaderPrimaryActionClass} h-12 px-5`}>
                  <Bell size={16} />
                  Crear invitacion
                </button>
              </div>
            </form>
          </ModalFrame>
        ) : null}

        {isPlanModalOpen && editingPlan ? (
          <ModalFrame title={`Editar plan: ${editingPlan.name}`} onClose={() => { setIsPlanModalOpen(false); setEditingPlan(null); }}>
            <form onSubmit={handleUpdatePlan} className="space-y-5">
              <FieldBlock label="Nombre">
                <input name="name" defaultValue={editingPlan.name} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
              </FieldBlock>
              <div className="grid gap-4 md:grid-cols-3">
                <FieldBlock label="Max clientes">
                  <input name="maxClients" type="number" defaultValue={editingPlan.maxClients} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
                <FieldBlock label="Max usuarios">
                  <input name="maxUsers" type="number" defaultValue={editingPlan.maxUsers} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
                <FieldBlock label="Max sucursales">
                  <input name="maxBranches" type="number" defaultValue={editingPlan.maxBranches} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Precio mensual">
                  <input name="monthlyPrice" type="number" defaultValue={editingPlan.monthlyPrice} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
                </FieldBlock>
                <FieldBlock label="Precio anual">
                  <input name="yearlyPrice" type="number" defaultValue={editingPlan.yearlyPrice || editingPlan.monthlyPrice * 10} className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]" />
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
          <ModalFrame title={editingCompany ? 'Editar empresa' : 'Nueva empresa'} onClose={() => { setIsCompanyModalOpen(false); setEditingCompany(null); }}>
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
                <FieldBlock label="Ciclo">
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
                </FieldBlock>
              </div>
              <FieldBlock label="Precio pactado">
                <input
                  type="number"
                  value={provisionPrice}
                  onChange={event => setProvisionPrice(Number(event.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                />
              </FieldBlock>
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
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
    tone === 'blue'
      ? 'text-[#2563EB]'
      : tone === 'success'
        ? 'text-[#16A34A]'
        : tone === 'danger'
          ? 'text-[#DC2626]'
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
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#FCFDFF] px-3 py-1.5">
    <Icon size={14} className="text-[#2563EB]" />
    {label}
  </span>
);

const StatusBadge = ({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' | 'blue' | 'neutral' }) => {
  const toneMap = {
    success: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]',
    warning: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
    danger: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
    blue: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]',
    neutral: 'border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]',
  };

  return <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${toneMap[tone]}`}>{label}</span>;
};

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[#E5E7EB] bg-[#FCFDFF] px-4 py-3 text-center">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{label}</p>
    <p className="mt-2 text-[22px] font-semibold text-[#111827]">{value}</p>
  </div>
);

const MiniPanel = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-[#FCFDFF] px-4 py-3">
    <p className="text-[14px] font-medium text-[#6B7280]">{label}</p>
    <p className="text-[16px] font-semibold text-[#111827]">{value}</p>
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
  const displayValue = selected?.label || placeholder;

  return (
    <div className={`relative ${isOpen ? 'z-[90]' : 'z-10'}`} onClick={event => event.stopPropagation()}>
      <button
        type="button"
        disabled={disabled || isLoading}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => onToggle(isOpen ? '' : dropdownId)}
        className={`flex h-[54px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left outline-none transition-all duration-200 ${
          disabled || isLoading
            ? 'cursor-not-allowed border-[#E5E7EB] opacity-60'
            : isOpen
              ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
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
                  selected
                    ? 'bg-[#EFF6FF] text-[#2563EB]'
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
    <section className="relative z-30 rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
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

      {isMobileOpen
        ? createPortal(
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

const UserAvatar = ({ name }: { name: string }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[12px] font-black uppercase text-[#2563EB] transition-all duration-200 group-hover:scale-[1.04] group-hover:bg-[#DBEAFE]">
    {name.slice(0, 2)}
  </div>
);

const getInvitationTone = (status: InvitationStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'Aceptada') return 'success';
  if (status === 'Pendiente') return 'warning';
  if (status === 'Revocada') return 'danger';
  return 'neutral';
};

const SaasTeamDirectory = ({
  rows,
  totalRows,
  isLoading,
  error,
  onAction,
  activeActionsDropdown,
  dropdownCoords,
  openContextMenu,
}: {
  rows: SaasMember[];
  totalRows: number;
  isLoading: boolean;
  error?: string;
  onAction: (member: SaasMember, action: SaasMemberActionKind) => void;
  activeActionsDropdown: string | null;
  dropdownCoords: { top: number; left: number; openUpward: boolean } | null;
  openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void;
}) => {
  if (isLoading) return <TenantUsersSkeleton />;
  if (error) return <TenantUsersState icon={AlertTriangle} title="No se pudo cargar Equipo SaaS" detail={error} tone="danger" />;
  if (!totalRows) return <TenantUsersState icon={Users} title="Sin miembros SaaS" detail="AÃºn no hay operadores internos registrados." tone="neutral" />;
  if (!rows.length) return <TenantUsersState icon={Search} title="Sin resultados" detail="Ajusta la bÃºsqueda para ver mÃ¡s miembros internos." tone="warning" />;

  return (
    <div className={`${shellCardClass} overflow-visible`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Directorio Equipo SaaS</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Solo usuarios internos con user_scope SAAS y empresa_id null.</p>
        </div>
        <StatusBadge label={`${rows.length} visibles`} tone="blue" />
      </div>
      <div className="hidden lg:block">
        <div className="grid grid-cols-[minmax(0,1.45fr)_0.8fr_0.64fr_0.5fr_0.76fr_0.48fr_0.66fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
          <div>Usuario</div>
          <div>Rol SaaS</div>
          <div>Estado</div>
          <div>2FA</div>
          <div>Ãšltimo acceso</div>
          <div>Ses.</div>
          <div>Creado</div>
          <div className="text-center">Acc.</div>
        </div>
        <div className="divide-y divide-[#EEF2F7]">
          {rows.map(member => (
            <SaasTeamTableRow key={member.id} member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#EEF2F7] lg:hidden">
        {rows.map(member => (
          <SaasTeamMobileCard key={member.id} member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
        ))}
      </div>
    </div>
  );
};

const SaasTeamTableRow = ({ member, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { member: SaasMember; onAction: (member: SaasMember, action: SaasMemberActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="group grid grid-cols-[minmax(0,1.45fr)_0.8fr_0.64fr_0.5fr_0.76fr_0.48fr_0.66fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]">
    <div className="flex min-w-0 items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
      <UserAvatar name={member.name} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{member.name}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{member.email}</p>
      </div>
    </div>
    <StatusBadge label={member.role} tone={member.role === 'Owner SaaS' || member.role === 'Super Admin' ? 'blue' : 'neutral'} />
    <StatusBadge label={member.status} tone={member.status === 'Activo' ? 'success' : member.status === 'Suspendido' ? 'danger' : 'warning'} />
    <StatusBadge label={member.twoFactor ? 'Activo' : 'Pendiente'} tone={member.twoFactor ? 'success' : 'warning'} />
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{member.lastAccess}</div>
    <div className="text-[14px] font-semibold text-[#111827]">{member.sessions}</div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{member.createdAt}</div>
    <SaasMemberActionsCell member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
  </div>
);

const SaasTeamMobileCard = ({ member, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { member: SaasMember; onAction: (member: SaasMember, action: SaasMemberActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="space-y-4 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar name={member.name} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#111827]">{member.name}</p>
          <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{member.email}</p>
        </div>
      </div>
      <SaasMemberActionsCell member={member} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
    </div>
    <div className="flex flex-wrap gap-2">
      <StatusBadge label={member.role} tone={member.role === 'Owner SaaS' || member.role === 'Super Admin' ? 'blue' : 'neutral'} />
      <StatusBadge label={member.status} tone={member.status === 'Activo' ? 'success' : member.status === 'Suspendido' ? 'danger' : 'warning'} />
      <StatusBadge label={member.twoFactor ? '2FA activo' : '2FA pendiente'} tone={member.twoFactor ? 'success' : 'warning'} />
    </div>
  </div>
);

const SaasMemberActionsCell = ({ member, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { member: SaasMember; onAction: (member: SaasMember, action: SaasMemberActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  const menuId = `saas-member-${member.id}`;
  return (
    <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones de ${member.name}`}>
        <MoreHorizontal size={16} />
      </button>
      {activeActionsDropdown === menuId && dropdownCoords && createPortal(
        <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[260px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
          <TenantUserActionButton icon={UserCog} label="Ver perfil" onClick={() => onAction(member, 'view-profile')} />
          <TenantUserActionButton icon={Edit3} label="Editar" onClick={() => onAction(member, 'edit')} />
          <TenantUserActionButton icon={Crown} label="Cambiar rol" onClick={() => onAction(member, 'change-role')} />
          <TenantUserActionButton icon={ShieldCheck} label="Configurar permisos" onClick={() => onAction(member, 'configure-permissions')} />
          <TenantUserActionButton icon={RefreshCw} label="Forzar cambio de contraseÃ±a" onClick={() => onAction(member, 'force-password')} />
          <TenantUserActionButton icon={ShieldAlert} label="Forzar 2FA" onClick={() => onAction(member, 'force-2fa')} />
          <TenantUserActionButton icon={Activity} label="Revocar sesiones" tone="danger" onClick={() => onAction(member, 'revoke-sessions')} />
          <TenantUserActionButton icon={member.status === 'Suspendido' ? CheckCircle2 : AlertTriangle} label={member.status === 'Suspendido' ? 'Reactivar' : 'Suspender'} tone={member.status === 'Suspendido' ? 'success' : 'danger'} onClick={() => onAction(member, member.status === 'Suspendido' ? 'reactivate' : 'suspend')} />
          <TenantUserActionButton icon={FileClock} label="Ver auditorÃ­a" onClick={() => onAction(member, 'audit')} />
        </div>,
        document.body,
      )}
    </div>
  );
};

const InvitationDirectory = ({ rows, totalRows, isLoading, error, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { rows: InvitationRow[]; totalRows: number; isLoading: boolean; error?: string; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  if (isLoading) return <TenantUsersSkeleton />;
  if (error) return <TenantUsersState icon={AlertTriangle} title="No se pudieron cargar invitaciones" detail={error} tone="danger" />;
  if (!totalRows) return <TenantUsersState icon={Bell} title="Sin invitaciones" detail="AÃºn no hay invitaciones generadas." tone="neutral" />;
  if (!rows.length) return <TenantUsersState icon={Search} title="Sin resultados" detail="Ajusta los filtros para ver mÃ¡s invitaciones." tone="warning" />;

  return (
    <div className={`${shellCardClass} overflow-visible`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Bandeja de invitaciones</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Controla token, expiraciÃ³n, contexto y estado sin llenar artificialmente la pantalla.</p>
        </div>
        <StatusBadge label={`${rows.length} visibles`} tone="blue" />
      </div>
      <div className="hidden xl:block">
        <div className="grid grid-cols-[minmax(0,1.15fr)_0.68fr_minmax(0,0.9fr)_0.64fr_0.72fr_0.62fr_0.62fr_0.62fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
          <div>Correo</div>
          <div>Tipo</div>
          <div>Empresa</div>
          <div>Rol</div>
          <div>Invitado por</div>
          <div>EnvÃ­o</div>
          <div>ExpiraciÃ³n</div>
          <div>Estado</div>
          <div className="text-center">Acc.</div>
        </div>
        <div className="divide-y divide-[#EEF2F7]">
          {rows.map(invitation => (
            <InvitationTableRow key={invitation.id} invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#EEF2F7] xl:hidden">
        {rows.map(invitation => (
          <InvitationMobileCard key={invitation.id} invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
        ))}
      </div>
    </div>
  );
};

const InvitationTableRow = ({ invitation, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { invitation: InvitationRow; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="group grid grid-cols-[minmax(0,1.15fr)_0.68fr_minmax(0,0.9fr)_0.64fr_0.72fr_0.62fr_0.62fr_0.62fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]">
    <div className="truncate text-[14px] font-semibold text-[#111827] transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-[#2563EB]">{invitation.email}</div>
    <StatusBadge label={invitation.type} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'neutral'} />
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-[#111827]">{invitation.company}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{invitation.branch}</p>
    </div>
    <StatusBadge label={`${invitation.role}`} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'success'} />
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{invitation.invitedBy}</div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{invitation.date}</div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{invitation.expiresAt}</div>
    <StatusBadge label={invitation.status} tone={getInvitationTone(invitation.status)} />
    <InvitationActionsCell invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
  </div>
);

const InvitationMobileCard = ({ invitation, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { invitation: InvitationRow; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="space-y-4 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-[#111827]">{invitation.email}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{invitation.company} Â· {invitation.branch}</p>
      </div>
      <InvitationActionsCell invitation={invitation} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
    </div>
    <div className="flex flex-wrap gap-2">
      <StatusBadge label={invitation.type} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'neutral'} />
      <StatusBadge label={`${invitation.role}`} tone={invitation.type === 'Equipo SaaS' ? 'blue' : 'success'} />
      <StatusBadge label={invitation.status} tone={getInvitationTone(invitation.status)} />
    </div>
  </div>
);

const InvitationActionsCell = ({ invitation, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { invitation: InvitationRow; onAction: (invitation: InvitationRow, action: InvitationActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  const menuId = `invitation-row-${invitation.id}`;
  return (
    <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones de invitaciÃ³n ${invitation.email}`}>
        <MoreHorizontal size={16} />
      </button>
      {activeActionsDropdown === menuId && dropdownCoords && createPortal(
        <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[250px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
          <TenantUserActionButton icon={RefreshCw} label="Reenviar" onClick={() => onAction(invitation, 'resend')} />
          <TenantUserActionButton icon={Globe} label="Copiar enlace" onClick={() => onAction(invitation, 'copy-link')} />
          <TenantUserActionButton icon={Crown} label="Editar rol" onClick={() => onAction(invitation, 'edit-role')} />
          <TenantUserActionButton icon={Building2} label="Cambiar empresa" onClick={() => onAction(invitation, 'change-company')} />
          <TenantUserActionButton icon={MapPin} label="Cambiar sucursal" onClick={() => onAction(invitation, 'change-branch')} />
          <TenantUserActionButton icon={CalendarCheck} label="Extender expiraciÃ³n" onClick={() => onAction(invitation, 'extend-expiration')} />
          <TenantUserActionButton icon={ShieldAlert} label="Revocar" tone="danger" onClick={() => onAction(invitation, 'revoke')} />
          <TenantUserActionButton icon={Sparkles} label="Renovar" onClick={() => onAction(invitation, 'renew')} />
          <TenantUserActionButton icon={UserCog} label="Abrir usuario" onClick={() => onAction(invitation, 'open-user')} />
        </div>,
        document.body,
      )}
    </div>
  );
};

const TenantUsersDirectory = ({
  rows,
  totalRows,
  baseRows,
  isLoading,
  error,
  permissionError,
  sort,
  onSort,
  page,
  totalPages,
  visiblePages,
  onPageChange,
  onAction,
  activeActionsDropdown,
  dropdownCoords,
  openContextMenu,
  canUseSupportAccess,
}: {
  rows: TenantUserRow[];
  totalRows: number;
  baseRows: number;
  isLoading: boolean;
  error: string;
  permissionError: string;
  sort: { key: TenantUserSortKey; direction: 'asc' | 'desc' };
  onSort: (key: TenantUserSortKey) => void;
  page: number;
  totalPages: number;
  visiblePages: number[];
  onPageChange: (page: number) => void;
  onAction: (user: TenantUserRow, action: TenantUserActionKind) => void;
  activeActionsDropdown: string | null;
  dropdownCoords: { top: number; left: number; openUpward: boolean } | null;
  openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void;
  canUseSupportAccess: boolean;
}) => {
  const hasRows = rows.length > 0;
  const emptyTitle = baseRows === 0 ? 'No hay usuarios tenant registrados' : 'No hay resultados con estos filtros';
  const emptyDetail =
    baseRows === 0
      ? 'Cuando las empresas tengan usuarios operativos, apareceran aqui sin mezclar equipo SaaS.'
      : 'Ajusta filtros o busqueda para ampliar el directorio.';
  const start = totalRows ? (page - 1) * TENANT_USERS_PAGE_SIZE + 1 : 0;
  const end = Math.min(page * TENANT_USERS_PAGE_SIZE, totalRows);

  return (
    <div className={`${shellCardClass} overflow-hidden`} data-tenant-users-list>
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-[20px] font-semibold text-[#111827]">Directorio de usuarios</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Vista global cross-tenant con empresa, sucursal, rol, seguridad y trazabilidad.</p>
        </div>
        <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[13px] font-semibold text-[#475569]">{totalRows} visibles</span>
      </div>
      {permissionError ? (
        <TenantUsersState icon={ShieldAlert} title="Error de permisos" detail={permissionError} tone="danger" />
      ) : error ? (
        <TenantUsersState icon={AlertTriangle} title="No se pudo cargar el directorio" detail={error} tone="warning" />
      ) : isLoading ? (
        <TenantUsersSkeleton />
      ) : !hasRows ? (
        <TenantUsersState icon={Users} title={emptyTitle} detail={emptyDetail} tone="neutral" />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <div className="min-w-[1120px]">
              <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_0.72fr_0.72fr_0.86fr_0.58fr_58px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                <TenantUsersSortButton label="Usuario" sortKey="name" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Empresa" sortKey="companyName" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Sucursal" sortKey="branchName" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Rol" sortKey="role" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Estado" sortKey="status" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="Ultimo acceso" sortKey="lastAccess" sort={sort} onSort={onSort} />
                <TenantUsersSortButton label="2FA" sortKey="twoFactorStatus" sort={sort} onSort={onSort} />
                <div className="text-center">Acc.</div>
              </div>
              <div className="divide-y divide-[#EEF2F7]">
                {rows.map(user => (
                  <TenantUserTableRow
                    key={user.id}
                    user={user}
                    activeActionsDropdown={activeActionsDropdown}
                    dropdownCoords={dropdownCoords}
                    openContextMenu={openContextMenu}
                    onAction={onAction}
                    canUseSupportAccess={canUseSupportAccess}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="divide-y divide-[#EEF2F7] lg:hidden">
            {rows.map(user => (
              <TenantUserMobileCard
                key={user.id}
                user={user}
                activeActionsDropdown={activeActionsDropdown}
                dropdownCoords={dropdownCoords}
                openContextMenu={openContextMenu}
                onAction={onAction}
                canUseSupportAccess={canUseSupportAccess}
              />
            ))}
          </div>
          <div className="flex flex-col gap-4 border-t border-[#E5E7EB] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] font-medium text-[#6B7280]">Mostrando {start} a {end} de {totalRows} usuarios</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              {visiblePages.map(item => (
                <button key={item} type="button" onClick={() => onPageChange(item)} className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-[15px] font-medium ${item === page ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]' : 'border border-transparent text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]'}`}>
                  {item}
                </button>
              ))}
              <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TenantUsersSortButton = ({ label, sortKey, sort, onSort }: { label: string; sortKey: TenantUserSortKey; sort: { key: TenantUserSortKey; direction: 'asc' | 'desc' }; onSort: (key: TenantUserSortKey) => void }) => {
  const active = sort.key === sortKey;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className={`flex items-center gap-1 text-left transition-colors duration-200 hover:text-[#2563EB] ${active ? 'text-[#2563EB]' : ''}`}>
      <span>{label}</span>
      {active ? <ChevronDown size={13} className={`transition-transform duration-200 ${sort.direction === 'asc' ? 'rotate-180' : ''}`} /> : null}
    </button>
  );
};

const TenantUserTableRow = ({ user, activeActionsDropdown, dropdownCoords, openContextMenu, onAction, canUseSupportAccess }: { user: TenantUserRow; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void; onAction: (user: TenantUserRow, action: TenantUserActionKind) => void; canUseSupportAccess: boolean }) => {
  const menuId = `tenant-user-${user.id}`;
  return (
    <div className="group grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_0.72fr_0.72fr_0.86fr_0.58fr_58px] items-center px-5 py-4 text-[15px] transition-colors duration-200 hover:bg-[#FCFDFE]">
      <button type="button" onClick={() => onAction(user, 'view-profile')} className="group/user flex min-w-0 cursor-pointer items-center gap-4 text-left transition-all duration-200 hover:translate-x-1">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[13px] font-black uppercase text-[#2563EB] shadow-[0_10px_22px_rgba(37,99,235,0.14)]">{user.name.slice(0, 2)}</div>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-[#111827] transition-colors duration-200 group-hover/user:text-[#2563EB]">{user.name}</p>
          <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{user.email}</p>
        </div>
      </button>
      <div className="min-w-0"><p className="truncate font-semibold text-[#111827]">{user.companyName}</p><p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">ID: {user.companyId}</p></div>
      <div className="truncate font-medium text-[#374151]">{user.branchName}</div>
      <div><StatusBadge label={user.role} tone={getUserRoleTone(user.role)} /></div>
      <div><StatusBadge label={user.status} tone={user.status === 'Activo' ? 'success' : 'danger'} /></div>
      <div className="truncate text-[13px] font-medium text-[#6B7280]">{user.lastAccess}</div>
      <div><StatusBadge label={user.twoFactorStatus} tone={user.twoFactorStatus === 'Pendiente' ? 'warning' : 'neutral'} /></div>
      <TenantUserActionsCell user={user} menuId={menuId} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} onAction={onAction} canUseSupportAccess={canUseSupportAccess} />
    </div>
  );
};

const TenantUserMobileCard = ({ user, activeActionsDropdown, dropdownCoords, openContextMenu, onAction, canUseSupportAccess }: { user: TenantUserRow; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void; onAction: (user: TenantUserRow, action: TenantUserActionKind) => void; canUseSupportAccess: boolean }) => {
  const menuId = `tenant-user-mobile-${user.id}`;
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onAction(user, 'view-profile')} className="flex min-w-0 items-center gap-3 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[13px] font-black uppercase text-[#2563EB]">{user.name.slice(0, 2)}</div>
          <div className="min-w-0"><p className="truncate text-[16px] font-semibold text-[#111827]">{user.name}</p><p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{user.email}</p></div>
        </button>
        <TenantUserActionsCell user={user} menuId={menuId} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} onAction={onAction} canUseSupportAccess={canUseSupportAccess} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniPanel label="Empresa" value={user.companyName} />
        <MiniPanel label="Sucursal" value={user.branchName} />
        <MiniPanel label="Rol" value={user.role} />
        <MiniPanel label="Ãšltimo acceso" value={user.lastAccess} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge label={user.status} tone={user.status === 'Activo' ? 'success' : 'danger'} />
        <StatusBadge label={`2FA ${user.twoFactorStatus}`} tone={user.twoFactorStatus === 'Pendiente' ? 'warning' : 'neutral'} />
      </div>
    </div>
  );
};

const TenantUserActionsCell = ({ user, menuId, activeActionsDropdown, dropdownCoords, openContextMenu, onAction, canUseSupportAccess }: { user: TenantUserRow; menuId: string; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void; onAction: (user: TenantUserRow, action: TenantUserActionKind) => void; canUseSupportAccess: boolean }) => (
  <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
    <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones para ${user.name}`}>
      <MoreHorizontal size={16} />
    </button>
    {activeActionsDropdown === menuId && dropdownCoords
      ? createPortal(
          <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[268px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
            <TenantUserActionButton icon={Eye} label="Ver perfil" onClick={() => onAction(user, 'view-profile')} />
            <TenantUserActionButton icon={Building2} label="Abrir empresa" onClick={() => onAction(user, 'open-company')} />
            <TenantUserActionButton icon={UserCog} label="Abrir usuario en contexto" onClick={() => onAction(user, 'open-context')} />
            <TenantUserActionButton icon={Activity} label="Ver sesiones" onClick={() => onAction(user, 'sessions')} />
            <TenantUserActionButton icon={History} label="Ver actividad" onClick={() => onAction(user, 'activity')} />
            <TenantUserActionButton icon={ShieldCheck} label="Cambiar rol" onClick={() => onAction(user, 'change-role')} />
            <TenantUserActionButton icon={MapPin} label="Cambiar sucursal" onClick={() => onAction(user, 'change-branch')} />
            <TenantUserActionButton icon={RefreshCw} label="Restablecer acceso" onClick={() => onAction(user, 'reset-access')} />
            <TenantUserActionButton icon={RefreshCw} label="Revocar sesiones" tone="danger" onClick={() => onAction(user, 'revoke-sessions')} />
            {user.isActive ? (
              <TenantUserActionButton icon={ShieldAlert} label="Suspender" tone="danger" onClick={() => onAction(user, 'suspend')} />
            ) : (
              <TenantUserActionButton icon={CheckCircle2} label="Reactivar" tone="success" onClick={() => onAction(user, 'reactivate')} />
            )}
            <TenantUserActionButton icon={FileText} label="Ver auditorÃ­a" onClick={() => onAction(user, 'audit')} />
            {canUseSupportAccess ? <TenantUserActionButton icon={Headphones} label="Acceder como soporte" tone="danger" onClick={() => onAction(user, 'support-access')} /> : null}
          </div>,
          document.body,
        )
      : null}
  </div>
);

const TenantUserActionButton = ({ icon: Icon, label, tone = 'neutral', onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; tone?: 'neutral' | 'danger' | 'success'; onClick: () => void }) => {
  const toneClass = tone === 'danger' ? 'hover:bg-rose-50 hover:text-rose-700' : tone === 'success' ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'hover:bg-[#F8FAFC] hover:text-[#2563EB]';
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold text-slate-700 transition-all hover:translate-x-1 ${toneClass}`}>
      <Icon size={16} className={tone === 'danger' ? 'text-rose-500' : tone === 'success' ? 'text-emerald-600' : 'text-[#2563EB]'} />
      {label}
    </button>
  );
};

const TenantUsersSkeleton = () => (
  <div className="divide-y divide-[#EEF2F7]">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_0.72fr_0.72fr_0.86fr_0.58fr_58px] items-center px-5 py-4">
        {Array.from({ length: 8 }).map((__, itemIndex) => <div key={itemIndex} className="mr-4 h-5 animate-pulse rounded-full bg-[#EEF2F7]" />)}
      </div>
    ))}
  </div>
);

const TenantUsersState = ({ icon: Icon, title, detail, tone }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; detail: string; tone: 'neutral' | 'warning' | 'danger' }) => {
  const toneClass = tone === 'danger' ? 'bg-rose-50 text-rose-600' : tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-[#EFF6FF] text-[#2563EB]';
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClass}`}><Icon size={24} /></div>
      <h4 className="mt-5 text-[20px] font-semibold text-[#111827]">{title}</h4>
      <p className="mt-2 max-w-lg text-[14px] font-medium leading-6 text-[#6B7280]">{detail}</p>
    </div>
  );
};

const TenantUserDetailDrawer = ({ user, open, onClose, onAction, activityItems, sessionItems, auditItems }: { user: TenantUserRow | null; open: boolean; onClose: () => void; onAction: (user: TenantUserRow, action: TenantUserActionKind) => void; activityItems: Array<{ id: string; action?: string; detail?: string; timestamp?: string; type?: string; description?: string }>; sessionItems: Array<{ id: string; user: string; company: string; ip: string; device: string; activity: string; status: string }>; auditItems: Array<{ id: string; action: string; detail: string; timestamp?: string }> }) => {
  if (!open || !user) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9997] bg-[#0F172A]/35 backdrop-blur-sm" role="dialog" aria-modal="true">
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-[#E5E7EB] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <div className="border-b border-[#E5E7EB] px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#EFF6FF] text-[15px] font-black uppercase text-[#2563EB]">{user.name.slice(0, 2)}</div>
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Detalle de usuario tenant</p>
                <h3 className="mt-1 truncate text-[24px] font-semibold text-[#111827]">{user.name}</h3>
                <p className="mt-1 truncate text-[14px] font-medium text-[#6B7280]">{user.email}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-[#F9FAFB] p-5">
          <TenantDrawerSection title="1. Identidad">
            <MiniPanel label="Nombre" value={user.name} />
            <MiniPanel label="Correo" value={user.email} />
            <MiniPanel label="TelÃ©fono" value={user.phone} />
            <MiniPanel label="CÃ³digo interno" value={user.code} />
          </TenantDrawerSection>
          <TenantDrawerSection title="2. Empresa y sucursal">
            <MiniPanel label="Empresa" value={user.companyName} />
            <MiniPanel label="Empresa ID" value={user.companyId} />
            <MiniPanel label="Sucursal" value={user.branchName} />
            <MiniPanel label="Sucursal ID" value={user.branchId} />
          </TenantDrawerSection>
          <TenantDrawerSection title="3. Rol y permisos">
            <MiniPanel label="Rol" value={user.role} />
            <MiniPanel label="Permisos explÃ­citos" value={`${Object.keys(user.permissions).length}`} />
          </TenantDrawerSection>
          <TenantDrawerSection title="4. Seguridad">
            <MiniPanel label="Estado" value={user.status} />
            <MiniPanel label="2FA" value={user.twoFactorStatus} />
            <MiniPanel label="Ãšltimo acceso" value={user.lastAccess} />
            <MiniPanel label="Creado" value={formatDate(user.createdAt)} />
          </TenantDrawerSection>
          <TenantDrawerSection title="5. Actividad reciente">
            {activityItems.length ? activityItems.slice(0, 4).map(item => <ActionListItem key={item.id} icon={Activity} title={item.action || item.type || 'Actividad'} detail={item.detail || item.description || item.timestamp || 'Evento registrado'} />) : <p className="text-[14px] font-medium text-[#6B7280]">Sin actividad reciente disponible.</p>}
          </TenantDrawerSection>
          <TenantDrawerSection title="6. Sesiones">
            {sessionItems.length ? sessionItems.slice(0, 4).map(item => <ActionListItem key={item.id} icon={Terminal} title={`${item.device} Â· ${item.ip}`} detail={`${item.status} Â· ${item.activity}`} />) : <p className="text-[14px] font-medium text-[#6B7280]">Sin sesiones activas visibles.</p>}
          </TenantDrawerSection>
          <TenantDrawerSection title="7. AuditorÃ­a">
            {auditItems.length ? auditItems.slice(0, 4).map(item => <ActionListItem key={item.id} icon={FileText} title={item.action} detail={item.detail || item.timestamp || 'Evento auditado'} />) : <p className="text-[14px] font-medium text-[#6B7280]">Sin auditorÃ­a especÃ­fica para este usuario.</p>}
          </TenantDrawerSection>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#E5E7EB] bg-white p-5">
          <button type="button" onClick={() => onAction(user, 'sessions')} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white text-[14px] font-semibold text-[#111827] ${motionButtonClass}`}><Activity size={16} />Sesiones</button>
          <button type="button" onClick={() => onAction(user, user.isActive ? 'suspend' : 'reactivate')} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-[14px] font-semibold ${user.isActive ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'}`}>
            {user.isActive ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
            {user.isActive ? 'Suspender' : 'Reactivar'}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
};

const TenantDrawerSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
    <h4 className="text-[15px] font-semibold text-[#111827]">{title}</h4>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  </section>
);

const ClearFiltersButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="ml-auto inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[14px] font-semibold text-[#111827] shadow-sm transition-all duration-200 hover:translate-x-1 hover:border-[#BFDBFE] hover:bg-[#F8FBFF] hover:text-[#2563EB] hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
  >
    <Filter size={17} className="text-[#2563EB]" />
    <span>Limpiar filtros</span>
  </button>
);

const RolePermissionsList = ({
  roleCards,
}: {
  roleCards: {
    saas: Array<{ role: string; users: number; permissions: string[] }>;
    tenant: Array<{ role: string; users: number; permissions: string[] }>;
  };
}) => {
  const renderRows = (
    rows: Array<{ role: string; users: number; permissions: string[] }>,
    context: 'SaaS' | 'Tenant',
  ) => {
    const isSaaS = context === 'SaaS';
    const Icon = isSaaS ? Crown : Building2;

    return rows.map(card => (
      <div
        key={`${context}-${card.role}`}
        className="group grid grid-cols-[minmax(0,1.2fr)_0.58fr_minmax(0,1.65fr)_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]"
      >
        <div className="flex min-w-0 items-center gap-3 transition-transform duration-200 group-hover:translate-x-1.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
              isSaaS
                ? 'bg-[#EFF6FF] text-[#2563EB] group-hover:bg-[#DBEAFE]'
                : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
            }`}
          >
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{card.role}</p>
            <p className="mt-1 text-[12px] font-medium text-[#6B7280]">Contexto {context}</p>
          </div>
        </div>
        <div className="text-[14px] font-semibold text-[#111827]">{card.users}</div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {card.permissions.slice(0, 2).map(permission => (
            <span
              key={permission}
              className="max-w-[220px] truncate rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#475569]"
            >
              {permission}
            </span>
          ))}
          {card.permissions.length > 2 ? (
            <span
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                isSaaS
                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                  : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'
              }`}
            >
              +{card.permissions.length - 2}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-end">
          <button type="button" className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] ${motionButtonClass}`}>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div className={`${shellCardClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Matriz de roles y permisos</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">Vista por contexto, usuarios asignados y permisos principales.</p>
        </div>
        <button type="button" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
          <ShieldCheck size={15} />
          Nuevo rol
        </button>
      </div>

      <div className="border-b border-[#EEF2F7] bg-[#FCFDFF] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <Crown size={17} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">Roles SaaS</p>
            <p className="text-[12px] font-medium text-[#6B7280]">Accesos internos de ABUNDRA y soporte global.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.2fr)_0.58fr_minmax(0,1.65fr)_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
        <div>Rol</div>
        <div>Usuarios</div>
        <div>Permisos principales</div>
        <div className="text-center">Acc.</div>
      </div>
      <div className="divide-y divide-[#EEF2F7]">{renderRows(roleCards.saas, 'SaaS')}</div>

      <div className="border-y border-[#EEF2F7] bg-[#FCFDFF] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Building2 size={17} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">Roles Tenant</p>
            <p className="text-[12px] font-medium text-[#6B7280]">Accesos ligados a empresas y operaciÃ³n diaria.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.2fr)_0.58fr_minmax(0,1.65fr)_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
        <div>Rol</div>
        <div>Usuarios</div>
        <div>Permisos principales</div>
        <div className="text-center">Acc.</div>
      </div>
      <div className="divide-y divide-[#EEF2F7]">{renderRows(roleCards.tenant, 'Tenant')}</div>
    </div>
  );
};

const RolePermissionMatrix = ({
  permissionMatrix,
  onAction,
}: {
  permissionMatrix: Record<RoleContext, PermissionModule[]>;
  onAction: (roleName: string, context: RoleContext, action: RoleActionKind) => void;
}) => {
  const renderMatrix = (context: RoleContext) => {
    const isSaaS = context === 'SaaS';
    return (
      <div className={`${shellCardClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#EEF2F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isSaaS ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-emerald-50 text-emerald-600'}`}>
              {isSaaS ? <Crown size={18} /> : <Building2 size={18} />}
            </div>
            <div>
              <h4 className="text-[18px] font-semibold text-[#111827]">Matriz {context} por mÃ³dulos</h4>
              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">
                {isSaaS ? 'Permisos globales del SaaS separados de la operaciÃ³n tenant.' : 'Permisos operativos de empresa sin alcance sobre el SaaS global.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onAction(`Roles ${context}`, context, 'compare')} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] transition-all duration-200 hover:translate-x-1 hover:text-[#2563EB]">Comparar</button>
            <button type="button" onClick={() => onAction(`Roles ${context}`, context, 'archive')} className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 text-[12px] font-semibold text-[#D97706] transition-all duration-200 hover:translate-x-1">Archivar</button>
            <button type="button" onClick={() => onAction(`Roles ${context}`, context, 'restore')} className="rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-[12px] font-semibold text-[#16A34A] transition-all duration-200 hover:translate-x-1">Restaurar</button>
            <button type="button" onClick={() => onAction(`Roles ${context}`, context, 'history')} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] transition-all duration-200 hover:translate-x-1 hover:text-[#2563EB]">Historial</button>
          </div>
        </div>
        <div className="grid gap-3 p-5 lg:grid-cols-2">
          {permissionMatrix[context].map(group => (
            <div key={`${context}-${group.module}`} className="group rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4 transition-all duration-200 hover:translate-x-1 hover:border-[#BFDBFE] hover:bg-white hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{group.module}</p>
                  <p className="mt-1 text-[12px] font-medium text-[#6B7280]">{group.permissions.length} permisos configurados</p>
                </div>
                {group.critical?.length ? <StatusBadge label="CrÃ­tico" tone="danger" /> : <StatusBadge label={context} tone={isSaaS ? 'blue' : 'success'} />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.permissions.map(permission => {
                  const isCritical = group.critical?.includes(permission);
                  return (
                    <span key={permission} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${isCritical ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#E5E7EB] bg-white text-[#475569]'}`}>
                      {permission}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {renderMatrix('SaaS')}
      {renderMatrix('Tenant')}
    </div>
  );
};

const SessionDirectory = ({
  rows,
  totalRows,
  isLoading,
  error,
  onAction,
  onHardenPolicies,
  activeActionsDropdown,
  dropdownCoords,
  openContextMenu,
}: {
  rows: Array<{
    id: string;
    user: string;
    type: string;
    company: string;
    ip: string;
    device: string;
    location: string;
    activity: string;
    createdAt: string;
    status: SessionStatus;
    browser: string;
    deviceFamily: string;
  }>;
  totalRows: number;
  isLoading: boolean;
  error?: string;
  onAction: (session: any, action: SessionActionKind) => void;
  onHardenPolicies: () => void;
  activeActionsDropdown: string | null;
  dropdownCoords: { top: number; left: number; openUpward: boolean } | null;
  openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void;
}) => {
  if (isLoading) return <TenantUsersSkeleton />;
  if (error) return <TenantUsersState icon={AlertTriangle} title="No se pudieron cargar sesiones" detail={error} tone="danger" />;
  if (!totalRows) return <TenantUsersState icon={Activity} title="Sin sesiones" detail="No hay sesiones registradas para mostrar." tone="neutral" />;
  if (!rows.length) return <TenantUsersState icon={Search} title="Sin resultados" detail="Ajusta los filtros para ver mÃ¡s sesiones." tone="warning" />;

  return (
    <div className={`${shellCardClass} overflow-visible`}>
      <div className="flex flex-col gap-3 border-b border-[#EEF2F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-[18px] font-semibold text-[#111827]">Sesiones activas y trazabilidad</h4>
          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">La tabla tiene prioridad; paneles laterales quedan como lectura secundaria.</p>
        </div>
        <button type="button" onClick={onHardenPolicies} className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${motionButtonClass}`}>
          <ShieldCheck size={15} />
          Endurecer polÃ­ticas
        </button>
      </div>
      <div className="hidden xl:block">
        <div className="grid grid-cols-[minmax(0,1.04fr)_0.54fr_minmax(0,0.82fr)_minmax(0,1.04fr)_0.62fr_0.74fr_0.62fr_48px] bg-[#F8FAFC] px-5 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
          <div>Usuario</div>
          <div>Tipo</div>
          <div>Empresa</div>
          <div>Dispositivo / IP</div>
          <div>UbicaciÃ³n</div>
          <div>Actividad / creada</div>
          <div>Estado</div>
          <div className="text-center">Acc.</div>
        </div>
        <div className="divide-y divide-[#EEF2F7]">
          {rows.map(session => (
            <SessionTableRow key={session.id} session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#EEF2F7] xl:hidden">
        {rows.map(session => (
          <SessionMobileCard key={session.id} session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
        ))}
      </div>
    </div>
  );
};

const getSessionTone = (status: SessionStatus): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'Activa') return 'success';
  if (status === 'Sospechosa') return 'warning';
  if (status === 'Revocada') return 'danger';
  return 'neutral';
};

const SessionTableRow = ({ session, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { session: any; onAction: (session: any, action: SessionActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="group grid grid-cols-[minmax(0,1.04fr)_0.54fr_minmax(0,0.82fr)_minmax(0,1.04fr)_0.62fr_0.74fr_0.62fr_48px] items-center px-5 py-4 transition-all duration-200 hover:bg-[#FBFDFF]">
    <div className="truncate text-[14px] font-semibold text-[#111827] transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-[#2563EB]">{session.user}</div>
    <StatusBadge label={session.type} tone={session.type === 'SaaS' ? 'blue' : 'neutral'} />
    <div className="truncate text-[14px] font-medium text-[#475569]">{session.company}</div>
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-[#475569]">{session.device}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{session.ip}</p>
    </div>
    <div className="truncate text-[13px] font-medium text-[#6B7280]">{session.location}</div>
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-[#475569]">{session.activity}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">{session.createdAt}</p>
    </div>
    <StatusBadge label={session.status} tone={getSessionTone(session.status)} />
    <SessionActionsCell session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
  </div>
);

const SessionMobileCard = ({ session, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { session: any; onAction: (session: any, action: SessionActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => (
  <div className="space-y-4 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-[#111827]">{session.user}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[#6B7280]">{session.company} Â· {session.device}</p>
      </div>
      <SessionActionsCell session={session} onAction={onAction} activeActionsDropdown={activeActionsDropdown} dropdownCoords={dropdownCoords} openContextMenu={openContextMenu} />
    </div>
    <div className="flex flex-wrap gap-2">
      <StatusBadge label={session.type} tone={session.type === 'SaaS' ? 'blue' : 'neutral'} />
      <StatusBadge label={session.status} tone={getSessionTone(session.status)} />
      <StatusBadge label={session.ip} tone="neutral" />
    </div>
  </div>
);

const SessionActionsCell = ({ session, onAction, activeActionsDropdown, dropdownCoords, openContextMenu }: { session: any; onAction: (session: any, action: SessionActionKind) => void; activeActionsDropdown: string | null; dropdownCoords: { top: number; left: number; openUpward: boolean } | null; openContextMenu: (event: React.MouseEvent<HTMLButtonElement>, menuId: string) => void }) => {
  const menuId = `session-row-${session.id}`;
  return (
    <div className="relative flex items-center justify-end" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={event => openContextMenu(event, menuId)} className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${activeActionsDropdown === menuId ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-[0_14px_32px_rgba(37,99,235,0.14)]' : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FBFF]'} ${motionButtonClass}`} aria-label={`Acciones de sesiÃ³n ${session.user}`}>
        <MoreHorizontal size={16} />
      </button>
      {activeActionsDropdown === menuId && dropdownCoords && createPortal(
        <div style={{ position: 'absolute', top: `${dropdownCoords.top}px`, left: `${dropdownCoords.left}px` }} className="z-[9999] w-[270px] rounded-[26px] border border-[#E5E7EB] bg-white p-2 shadow-[0_28px_70px_rgba(15,23,42,0.16)] animate-[platform-fade-in_140ms_ease-out]" onClick={event => event.stopPropagation()}>
          <TenantUserActionButton icon={Eye} label="Ver detalle" onClick={() => onAction(session, 'view-detail')} />
          <TenantUserActionButton icon={AlertTriangle} label="Marcar sospechosa" onClick={() => onAction(session, 'mark-suspicious')} />
          <TenantUserActionButton icon={RefreshCw} label="Revocar sesiÃ³n" tone="danger" onClick={() => onAction(session, 'revoke')} />
          <TenantUserActionButton icon={ShieldAlert} label="Revocar todas" tone="danger" onClick={() => onAction(session, 'revoke-all')} />
          <TenantUserActionButton icon={ShieldCheck} label="Revocar excepto actual" tone="danger" onClick={() => onAction(session, 'revoke-all-except-current')} />
          <TenantUserActionButton icon={Globe} label="Bloquear IP" tone="danger" onClick={() => onAction(session, 'block-ip')} />
          <TenantUserActionButton icon={RefreshCw} label="Forzar contraseÃ±a" onClick={() => onAction(session, 'force-password')} />
          <TenantUserActionButton icon={UserCog} label="Suspender usuario" tone="danger" onClick={() => onAction(session, 'suspend-user')} />
          <TenantUserActionButton icon={Activity} label="Ver actividad" onClick={() => onAction(session, 'activity')} />
        </div>,
        document.body,
      )}
    </div>
  );
};

const SidebarInfoCard = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) => (
  <div className={`${shellCardClass} p-6`}>
    <div className="flex items-center gap-3">
      <Icon size={20} className="text-[#2563EB]" />
      <h2 className="text-[20px] font-semibold text-[#111827]">{title}</h2>
    </div>
    <div className="mt-5 space-y-3">{children}</div>
  </div>
);

const ActionListItem = ({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  detail: string;
}) => (
  <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[#111827]">{title}</p>
        <p className="mt-2 text-[14px] font-medium leading-7 text-[#6B7280]">{detail}</p>
      </div>
    </div>
  </div>
);

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
  <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#0F172A]/45 px-4 py-6 backdrop-blur-[2px]">
    <div className="w-full max-w-2xl overflow-visible rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.22)]">
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

const FilterDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-20'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(open => !open)}
        className={`flex h-[56px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 cursor-pointer ${
          disabled
            ? 'border-[#E5E7EB] opacity-60'
            : isOpen
              ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
              : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#111827]">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[80] w-max min-w-[260px] max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
              !value ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
            }`}
          >
            <span>{placeholder}</span>
            {!value && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
          </button>
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                  isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};


