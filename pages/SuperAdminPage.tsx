import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  Crown,
  DollarSign,
  Download,
  Edit3,
  FileClock,
  FileText,
  Ghost,
  Globe,
  Headphones,
  History,
  LifeBuoy,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  UserCog,
  WalletCards,
  X,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  createCompany,
  getAllUsers,
  getCompanies,
  getGlobalConfig,
  getGlobalMetrics,
  getMasterLogs,
  getNodesTelemetry,
  getPayments,
  getSaaSPlans,
  getUsers,
  saveSaaSPlan,
  updateCompany,
  updateGlobalConfig,
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
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

const shellCardClass = 'rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm';
const motionButtonClass =
  'transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

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
  { id: 'GLOBAL_USERS', label: 'Usuarios Globales', icon: Users },
  { id: 'PLANS', label: 'Planes y Suscripciones', icon: Package },
  { id: 'BILLING', label: 'Facturacion', icon: CreditCard },
  { id: 'REPORTS', label: 'Reportes Globales', icon: FileText },
  { id: 'AUDIT', label: 'Auditoria', icon: History },
  { id: 'SYSTEM', label: 'Configuracion del Sistema', icon: Settings },
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

  const refreshData = useCallback(() => {
    setCompanies(getCompanies());
    setPlans(getSaaSPlans());
    setGlobalUsers(getAllUsers());
    setPlatformConfig(getGlobalConfig());
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

  const metrics = useMemo(() => getGlobalMetrics(), [companies]);
  const masterLogs = useMemo(() => getMasterLogs(), [companies, platformConfig]);
  const telemetry = useMemo(() => getNodesTelemetry(), [activeTab]);
  const tenantCompanies = useMemo(() => companies.filter(company => company.id !== 'SYSTEM'), [companies]);
  const tenantUsers = useMemo(() => globalUsers.filter(user => user.companyId !== 'SYSTEM'), [globalUsers]);
  const companyUsers = useMemo(() => tenantUsers.filter(user => user.role !== Role.SUPER_ADMIN), [tenantUsers]);

  const filteredCompanies = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return tenantCompanies;
    return tenantCompanies.filter(company => company.name.toLowerCase().includes(query) || company.id.toLowerCase().includes(query));
  }, [searchTerm, tenantCompanies]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return companyUsers;
    return companyUsers.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query),
    );
  }, [companyUsers, searchTerm]);

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
      { title: 'Tutoriales del panel', detail: 'Recorridos para facturacion, auditoria, planes y configuracion global.', tag: 'Tutoriales' },
    ],
    [tenantCompanies.length],
  );

  const roleCounts = useMemo(() => {
    const admins = companyUsers.filter(user => user.role === Role.ADMIN).length;
    const supervisors = companyUsers.filter(user => user.role === Role.SUPERVISOR).length;
    const collectors = companyUsers.filter(user => user.role === Role.COBRADOR).length;
    return { admins, supervisors, collectors };
  }, [companyUsers]);

  const paymentsCount = useMemo(() => getPayments('ALL').length, [companies]);
  const navigateToSection = useCallback(
    (tab: SuperAdminTab) => {
      const params = new URLSearchParams(location.search);
      params.set('section', tabToSectionMap[tab]);
      navigate(`/master?${params.toString()}`, { replace: false });
    },
    [location.search, navigate],
  );

  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section') || 'dashboard';
    const nextTab = sectionToTabMap[section] || 'DASHBOARD';
    if (activeTab !== nextTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, location.search]);

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
      label: 'MRR estimado',
      value: formatCurrency(metrics.mrr),
      helper: `${tenantCompanies.filter(company => company.status === 'ACTIVE').length} empresas facturando`,
      trend: '+12%',
      tone: 'blue' as const,
      icon: DollarSign,
    },
    {
      label: 'Cobros globales',
      value: formatCurrency(metrics.totalRevenue),
      helper: `${paymentsCount} pagos registrados`,
      trend: '+8%',
      tone: 'emerald' as const,
      icon: WalletCards,
    },
    {
      label: 'Usuarios globales',
      value: `${companyUsers.length}`,
      helper: `${roleCounts.admins} admins, ${roleCounts.supervisors} supervisores`,
      trend: '+5%',
      tone: 'blue' as const,
      icon: Users,
    },
    {
      label: 'Empresas activas',
      value: `${metrics.totalTenants}`,
      helper: `${tenantCompanies.filter(company => company.status === 'TRIAL').length} en prueba`,
      trend: 'SaaS',
      tone: 'amber' as const,
      icon: Building2,
    },
  ];

  if (currentUser?.role === Role.SUPER_ADMIN) {
    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        {activeTab === 'DASHBOARD' && (
          <section>
            <div className={`${shellCardClass} overflow-hidden`}>
              <div className="px-6 py-6 lg:px-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-2 text-[12px] font-semibold text-[#2563EB]">
                      <Crown size={14} />
                      Super Admin SaaS
                    </div>
                    <h1 className="mt-4 text-[32px] font-semibold leading-[1.08] tracking-tight text-[#111827]">Control global de ABUNDRA</h1>
                    <p className="mt-3 max-w-3xl text-[18px] font-medium leading-8 text-[#6B7280]">
                      Monitorea empresas, usuarios globales, suscripciones, facturacion, auditoria y configuracion del sistema con la misma identidad visual del panel Admin Empresa.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setIsCompanyModalOpen(true)}
                      className="flex h-[54px] items-center justify-center gap-3 rounded-2xl bg-[#2563EB] px-6 text-[16px] font-medium text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] cursor-pointer"
                    >
                      <Plus size={18} />
                      Nueva empresa
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToSection('SYSTEM')}
                      className={`flex h-[54px] items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-medium text-[#111827] shadow-sm ${motionButtonClass} cursor-pointer`}
                    >
                      <Settings size={18} className="text-[#2563EB]" />
                      Configuracion
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'DASHBOARD' && (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4 animate-[platform-fade-in_180ms_ease-out]">
            {kpis.map(item => (
              <MetricCard key={item.label} {...item} />
            ))}
          </section>
        )}

        <section className="space-y-5">
        {activeTab === 'DASHBOARD' ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_1fr]">
            <div className={`${shellCardClass} p-6`}>
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-[#2563EB]" />
                <h2 className="text-[20px] font-semibold text-[#111827]">Monitor global</h2>
              </div>
              <p className="mt-2 text-[14px] font-medium text-[#6B7280]">Actividad y crecimiento agregado del SaaS durante la semana.</p>
              <div className="mt-6 h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="super-admin-performance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#94A3B8" axisLine={false} tickLine={false} fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '18px',
                        border: '1px solid #E5E7EB',
                        boxShadow: '0 18px 48px rgba(15,23,42,0.14)',
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} fill="url(#super-admin-performance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-5">
              <div className={`${shellCardClass} p-6`}>
                <div className="flex items-center gap-3">
                  <MapPin size={20} className="text-[#2563EB]" />
                  <h2 className="text-[20px] font-semibold text-[#111827]">Telemetria</h2>
                </div>
                <div className="mt-5 space-y-4">
                  {telemetry.map(node => (
                    <div key={node.id} className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-semibold text-[#111827]">{node.id}</p>
                          <p className="mt-1 text-[13px] font-medium text-[#6B7280]">{node.region}</p>
                        </div>
                        <StatusBadge label="Activo" tone="success" />
                      </div>
                      <div className="mt-4 space-y-3">
                        <ProgressRow label="CPU" value={`${node.cpu}%`} percent={node.cpu} color="#2563EB" />
                        <ProgressRow label="RAM" value={`${node.ram}%`} percent={node.ram} color="#16A34A" />
                        <ProgressRow label="DB" value={`${node.db}%`} percent={node.db} color="#F59E0B" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${shellCardClass} p-6`}>
                <div className="flex items-center gap-3">
                  <Bell size={20} className="text-[#2563EB]" />
                  <h2 className="text-[20px] font-semibold text-[#111827]">Resumen rapido</h2>
                </div>
                <div className="mt-5 space-y-3">
                  <SummaryRow label="Facturacion mensual estimada" value={formatCurrency(metrics.mrr)} tone="blue" />
                  <SummaryRow label="Capital gestionado" value={formatCurrency(metrics.totalPortfolio)} tone="neutral" />
                  <SummaryRow label="Usuarios globales" value={`${companyUsers.length}`} tone="blue" />
                  <SummaryRow label="Cobros acumulados" value={formatCurrency(metrics.totalRevenue)} tone="success" />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'COMPANIES' ? (
          selectedCompanyDetail ? (
            // ==================== DETALLE DE EMPRESA (SOPORTE Y TENANT) ====================
            <section className="space-y-6 animate-[platform-fade-in_180ms_ease-out]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedCompanyDetail(null)}
                    className="inline-flex h-12 px-4 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[13.5px] font-bold text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                    Volver al listado
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[24px] font-black tracking-tight text-slate-900">{selectedCompanyDetail.name}</h2>
                      <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600">
                        ID: {selectedCompanyDetail.id}
                      </span>
                    </div>
                    <p className="text-[13.5px] font-semibold text-slate-500 mt-0.5">Ficha de soporte global y estado de suscripción.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Modo Fantasma (Diagnóstico de Soporte)"
                    onClick={() => handleToggleGhost(selectedCompanyDetail.id, !!selectedCompanyDetail.isGhostMode)}
                    className={`inline-flex h-11 px-4 items-center justify-center gap-2 rounded-2xl border transition-all ${
                      selectedCompanyDetail.isGhostMode 
                        ? 'border-purple-300 bg-purple-50 text-purple-600 shadow-sm' 
                        : 'border-slate-200 bg-white text-slate-500 hover:border-purple-200 hover:bg-purple-50/50 hover:text-purple-600'
                    } cursor-pointer`}
                  >
                    <Ghost size={16} />
                    {selectedCompanyDetail.isGhostMode ? 'Emulando...' : 'Emular'}
                  </button>
                </div>
              </div>

              {/* Sub-navegación Horizontal de la Empresa */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
                {(['RESUMEN', 'USUARIOS', 'SUCURSALES', 'SUSCRIPCION', 'ACTIVIDAD'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2.5 text-[13.5px] font-bold border-b-2 transition-all cursor-pointer ${
                      detailTab === tab 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'RESUMEN' && 'Resumen'}
                    {tab === 'USUARIOS' && 'Usuarios'}
                    {tab === 'SUCURSALES' && 'Sucursales'}
                    {tab === 'SUSCRIPCION' && 'Suscripción'}
                    {tab === 'ACTIVIDAD' && 'Actividad'}
                  </button>
                ))}
              </div>

              {/* Contenido de cada Tab del Detalle */}
              {detailTab === 'RESUMEN' && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className={`${shellCardClass} p-6 space-y-4`}>
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-[17px] font-black text-slate-900">Salud Financiera de la Empresa</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-100 bg-[#FCFDFF] p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-450">Cobros Totales</p>
                        <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(selectedCompanyDetail.id === 'c1' ? 845200 : 0)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-[#FCFDFF] p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-450">Capital Prestado</p>
                        <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(selectedCompanyDetail.id === 'c1' ? 1250000 : 0)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-[#FCFDFF] p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-450">Cartera Activa</p>
                        <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(selectedCompanyDetail.id === 'c1' ? 689000 : 0)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-[#FCFDFF] p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-450">Mora Acumulada</p>
                        <p className="text-xl font-black text-red-650 mt-1">{formatCurrency(selectedCompanyDetail.id === 'c1' ? 45000 : 0)}</p>
                      </div>
                    </div>
                  </div>

                  <div className={`${shellCardClass} p-6 space-y-4`}>
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-[17px] font-black text-slate-900">Configuración General</h3>
                    </div>
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-500">Plan Contratado</span>
                        <span className="font-bold text-slate-800">
                          {plans.find(p => p.id === selectedCompanyDetail.planId)?.name || 'Estándar'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-500">Ciclo de Facturación</span>
                        <span className="font-bold text-slate-800">
                          {selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-500">Precio de suscripción</span>
                        <span className="font-bold text-slate-800">{formatCurrency(selectedCompanyDetail.subscriptionPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-500">Estado de Operación</span>
                        <span className="font-bold text-slate-800 uppercase text-xs">
                          {selectedCompanyDetail.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'USUARIOS' && (
                <div className={`${shellCardClass} overflow-hidden rounded-[32px]`}>
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-[17px] font-black text-slate-900">Usuarios Registrados en el Tenant</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-[#F8FAFC]">
                        <tr className="text-left">
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Usuario</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Nombre</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Rol</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {globalUsers.filter(u => u.companyId === selectedCompanyDetail.id).map(user => (
                          <tr key={user.id} className="hover:bg-slate-50/55 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-[14px] font-bold text-slate-900">@{user.username}</p>
                            </td>
                            <td className="px-6 py-4 text-[14px] font-semibold text-slate-700">{user.name}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-600">
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                                user.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
                              }`}>
                                {user.isActive ? 'Activo' : 'Suspendido'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab === 'SUCURSALES' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(selectedCompanyDetail.id === 'c1' ? [
                    { id: 'b1', name: 'Sucursal Central Santo Domingo', address: 'Av. Winston Churchill', monthlyGoal: 250000 },
                    { id: 'b2', name: 'Sucursal Santiago', address: 'Av. Estrella Sadhalá', monthlyGoal: 180000 },
                    { id: 'b3', name: 'Sucursal Herrera', address: 'Av. Isabel Aguiar', monthlyGoal: 150000 }
                  ] : [
                    { id: 'b4', name: 'Sucursal Central', address: 'Oficinas Administrativas', monthlyGoal: 100000 }
                  ]).map(branch => (
                    <div key={branch.id} className={`${shellCardClass} p-5 space-y-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                          <Building2 size={18} />
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Meta Mensual</p>
                          <p className="text-[15px] font-black text-slate-900 mt-0.5">{formatCurrency(branch.monthlyGoal)}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[16px] font-black text-slate-900 leading-tight">{branch.name}</h4>
                        <p className="text-xs font-semibold text-slate-500 mt-1">{branch.address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'SUSCRIPCION' && (
                <div className={`${shellCardClass} overflow-hidden rounded-[32px]`}>
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-[17px] font-black text-slate-900">Historial de Cobros al Tenant</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-[#F8FAFC]">
                        <tr className="text-left">
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Factura</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Ciclo</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Monto</th>
                          <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Vencimiento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        <tr className="hover:bg-slate-50/55 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-[14px] font-bold text-slate-900">FAC-2026-001</p>
                          </td>
                          <td className="px-6 py-4 text-[14px] font-semibold text-slate-700">
                            {selectedCompanyDetail.billingCycle === 'YEARLY' ? 'Anual' : 'Mensual'}
                          </td>
                          <td className="px-6 py-4 text-[14.5px] font-black text-slate-900">{formatCurrency(selectedCompanyDetail.subscriptionPrice)}</td>
                          <td className="px-6 py-4 text-[13.5px] font-semibold text-slate-500">{formatDate(selectedCompanyDetail.expiresAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab === 'ACTIVIDAD' && (
                <div className="rounded-[32px] bg-[#0F172A] border border-slate-800 shadow-2xl p-6 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                    <span className="text-xs font-bold text-slate-500 font-mono">tenant_logs_{selectedCompanyDetail.id}.log</span>
                  </div>
                  
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 font-mono text-[13px] leading-relaxed custom-scrollbar">
                    {masterLogs.filter(l => l.detail.toLowerCase().includes(selectedCompanyDetail.name.toLowerCase()) || l.action.toLowerCase().includes('company')).map(log => (
                      <div key={log.id} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-850">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400 font-bold">[{formatDate(log.timestamp)}]</span>
                          <span className="text-purple-400 font-bold">&gt; {log.action}</span>
                        </div>
                        <p className="mt-2 text-emerald-400/90 leading-relaxed pl-2 border-l-2 border-slate-700">
                          {log.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            // ==================== LISTADO GENERAL DE EMPRESAS ====================
            <section className="space-y-5">
              <SectionHeader
                title="Empresas"
                description="Gestion global de tenants, estado, plan contratado y controles de soporte."
                actionLabel="Aprovisionar empresa"
                onAction={() => {
                  setEditingCompany(null);
                  setProvisionName('');
                  setProvisionPlanId('p2');
                  setProvisionCycle('MONTHLY');
                  setProvisionPrice(3500);
                  setIsCompanyModalOpen(true);
                }}
              />

              <div className={`${shellCardClass} p-5`}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder="Buscar empresa por nombre o ID..."
                      className="h-[54px] w-full rounded-2xl border border-[#E5E7EB] bg-white pl-12 pr-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <div className="rounded-2xl border border-[#E5E7EB] bg-[#FCFDFF] px-4 py-3 text-right">
                      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Empresas visibles</p>
                      <p className="mt-2 text-[24px] font-semibold text-[#111827]">{filteredCompanies.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredCompanies.map(company => {
                  const plan = plans.find(item => item.id === company.planId);
                  const isGhost = !!company.isGhostMode;
                  // Contar usuarios y sucursales de este tenant para mayor contexto
                  const companyUsersCount = globalUsers.filter(u => u.companyId === company.id).length;
                  const companyBranchesCount = company.id === 'c1' ? 3 : 1;

                  return (
                    <div key={company.id} className={`${shellCardClass} p-5 lg:p-6 transition-all duration-300 hover:shadow-md hover:border-slate-300/80`}>
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-[20px] font-black text-white shadow-sm ${
                            company.status === 'SUSPENDED' 
                              ? 'bg-slate-400' 
                              : isGhost 
                                ? 'bg-purple-600 shadow-purple-200' 
                                : 'bg-blue-600 shadow-blue-200'
                          }`}>
                            {company.name[0].toUpperCase()}
                            {isGhost && (
                              <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-purple-600 text-white animate-pulse">
                                <Ghost size={12} />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 
                                onClick={() => {
                                  setSelectedCompanyDetail(company);
                                  setDetailTab('RESUMEN');
                                }}
                                className="text-[19px] font-black tracking-tight text-[#111827] cursor-pointer hover:text-blue-600 transition-colors"
                              >
                                {company.name}
                              </h3>
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                                company.status === 'ACTIVE' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                                  : company.status === 'TRIAL' 
                                    ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                              }`}>
                                {company.status === 'ACTIVE' ? 'Activo' : company.status === 'TRIAL' ? 'Prueba' : 'Suspendido'}
                              </span>
                              {company.isGhostMode && (
                                <span className="inline-flex rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-600">
                                  Emulación Activa
                                </span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3.5 text-[13px] font-medium text-slate-500 pt-1">
                              <div className="flex items-center gap-1.5">
                                <Package size={14} className="text-slate-400" />
                                <span className="font-bold text-slate-700">{plan?.name || 'Básico estándar'}</span>
                              </div>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-center gap-1.5">
                                <Users size={14} className="text-slate-400" />
                                <span>{companyUsersCount} usuarios</span>
                              </div>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-center gap-1.5">
                                <MapPin size={14} className="text-slate-400" />
                                <span>{companyBranchesCount} sucursales</span>
                              </div>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-center gap-1.5">
                                <Clock3 size={14} className="text-slate-400" />
                                <span>Expira: <strong className="text-slate-700">{formatDate(company.expiresAt)}</strong></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Lado Financiero e Interactivo del Tenant */}
                        <div className="flex flex-wrap items-center gap-5 justify-between lg:justify-end border-t border-slate-100 pt-4 lg:border-none lg:pt-0">
                          <div className="text-left lg:text-right">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Facturación Anual/Mensual</p>
                            <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(company.subscriptionPrice)}</p>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">{company.billingCycle === 'YEARLY' ? 'Ciclo Anual' : 'Ciclo Mensual'}</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              title="Modo Fantasma (Diagnóstico de Soporte)"
                              onClick={() => handleToggleGhost(company.id, isGhost)}
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
                                isGhost 
                                  ? 'border-purple-300 bg-purple-50 text-purple-600 shadow-sm' 
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-purple-200 hover:bg-purple-50/50 hover:text-purple-600'
                              } cursor-pointer`}
                            >
                              <Ghost size={16} />
                            </button>
                            <button
                              type="button"
                              title="Editar plan y aprovisionamiento"
                              onClick={() => {
                                setEditingCompany(company);
                                setProvisionName(company.name);
                                setProvisionPlanId(company.planId);
                                setProvisionCycle(company.billingCycle);
                                setProvisionPrice(company.subscriptionPrice || 0);
                                setIsCompanyModalOpen(true);
                              }}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-350 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (company.status === 'ACTIVE') {
                                  // Mostrar confirmación crítica para suspensión
                                  window.dispatchEvent(new CustomEvent('PLATFORM_MODAL_EVENT', {
                                    detail: {
                                      id: `suspend-${company.id}`,
                                      state: 'open',
                                      tone: 'danger',
                                      title: `¿Suspender acceso de ${company.name}?`,
                                      description: `Esta acción denegará de inmediato el acceso a todos los administradores, supervisores y cobradores registrados bajo esta empresa. Ninguna sucursal podrá realizar cobros ni arqueos.`,
                                      confirmLabel: 'Confirmar Suspensión',
                                      cancelLabel: 'Cancelar',
                                      onConfirm: () => handleToggleCompany(company.id, company.status)
                                    }
                                  }));
                                } else {
                                  handleToggleCompany(company.id, company.status);
                                }
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-2xl px-4 text-[13.5px] font-bold transition-all cursor-pointer ${
                                company.status === 'ACTIVE'
                                  ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700'
                              }`}
                            >
                              {company.status === 'ACTIVE' ? 'Suspender' : 'Activar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )
        ) : null}

        {activeTab === 'GLOBAL_USERS' ? (
          <section className="space-y-5">
            <SectionHeader
              title="Usuarios Globales"
              description="Vista consolidada del equipo distribuido en todas las empresas, con enfoque en adopcion y seguridad."
            />
            <div className={`${shellCardClass} overflow-hidden`}>
              <div className="border-b border-[#E5E7EB] px-5 py-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder="Buscar por nombre, usuario o correo..."
                      className="h-[54px] w-full rounded-2xl border border-[#E5E7EB] bg-white pl-12 pr-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat label="Admins" value={`${roleCounts.admins}`} />
                    <MiniStat label="Supervisores" value={`${roleCounts.supervisors}`} />
                    <MiniStat label="Cobradores" value={`${roleCounts.collectors}`} />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="text-left">
                      <th className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Usuario</th>
                      <th className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Empresa</th>
                      <th className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Rol</th>
                      <th className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Estado</th>
                      <th className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Ultimo acceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-t border-[#EEF2F7] hover:bg-[#FCFDFF]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563EB] text-[12px] font-black uppercase text-white">
                              {user.avatar || user.name.slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-[14px] font-semibold text-[#111827]">{user.name}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">@{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[14px] font-medium text-[#111827]">{tenantCompanies.find(company => company.id === user.companyId)?.name || 'Sin empresa'}</td>
                        <td className="px-5 py-4">
                          <StatusBadge label={user.role} tone={getUserRoleTone(user.role)} />
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge label={user.isActive ? 'Activo' : 'Suspendido'} tone={user.isActive ? 'success' : 'danger'} />
                        </td>
                        <td className="px-5 py-4 text-[13px] font-medium text-[#6B7280]">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Sin acceso reciente'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white p-1.5">
                <button
                  type="button"
                  onClick={() => setIsYearly(false)}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold ${!isYearly ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#6B7280]'}`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setIsYearly(true)}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold ${isYearly ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#6B7280]'}`}
                >
                  Anual
                </button>
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
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modelo de Suscripción</p>
                      <h3 className="text-[25px] font-black tracking-tight text-slate-900">{plan.name}</h3>
                    </div>

                    <div className="py-6 space-y-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[38px] font-black tracking-tight text-slate-900">{formatCurrency(price)}</span>
                        <span className="text-sm font-semibold text-slate-400">/ {isYearly ? 'año' : 'mes'}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-400">
                        {isYearly ? 'Cobrado anualmente en una sola cuota' : 'Cobro recurrente mensual'}
                      </p>
                    </div>

                    {/* Límites Cuantitativos del Plan */}
                    <div className="flex-1 space-y-4 pt-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Límites y Recursos Incluidos</p>
                      
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#FCFDFF] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-slate-400" />
                          <span className="text-[13.5px] font-semibold text-slate-600">Clientes Máximos</span>
                        </div>
                        <span className="text-[14px] font-black text-slate-800">{plan.maxClients === 999999 ? 'Ilimitados' : plan.maxClients}</span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#FCFDFF] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserCog size={16} className="text-slate-400" />
                          <span className="text-[13.5px] font-semibold text-slate-600">Usuarios por Empresa</span>
                        </div>
                        <span className="text-[14px] font-black text-slate-800">{plan.maxUsers === 999999 ? 'Ilimitados' : plan.maxUsers}</span>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#FCFDFF] px-4 py-3">
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
                      className="mt-8 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[14px] font-bold text-slate-700 transition-all hover:border-slate-350 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                    >
                      <Edit3 size={15} />
                      Editar parámetros del plan
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
              title="Facturacion"
              description="Seguimiento de suscripciones, cobros globales y estado de renovacion por empresa."
              actionLabel="Exportar resumen"
            />
            <div className={`${shellCardClass} overflow-hidden rounded-[32px]`}>
              <div className="grid gap-4 border-b border-[#E5E7EB] bg-slate-50/50 p-6 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">MRR Mensual Estimado</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(metrics.mrr)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cobros Totales</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(metrics.totalRevenue)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tenants Activos</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{tenantCompanies.filter(c => c.status === 'ACTIVE').length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Facturas Pendientes</p>
                  <p className="mt-2 text-2xl font-black text-red-600">{billingRows.filter(item => item.status !== 'Pagada').length}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="text-left">
                      <th className="px-6 py-4.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Empresa / Tenant</th>
                      <th className="px-6 py-4.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Plan contratado</th>
                      <th className="px-6 py-4.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Ciclo</th>
                      <th className="px-6 py-4.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Monto</th>
                      <th className="px-6 py-4.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Estado de pago</th>
                      <th className="px-6 py-4.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Próx. Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {billingRows.map(row => (
                      <tr key={row.id} className="hover:bg-[#FCFDFF] transition-colors">
                        <td className="px-6 py-4 text-[14.5px] font-bold text-slate-900">{row.companyName}</td>
                        <td className="px-6 py-4 text-[14px] font-medium text-slate-600">{row.planName}</td>
                        <td className="px-6 py-4 text-[14px] font-medium text-slate-700">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${row.cycle === 'Anual' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {row.cycle}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[14.5px] font-bold text-slate-900">{formatCurrency(row.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            row.status === 'Pagada' 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                              : row.status === 'Pendiente' 
                                ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                                : 'bg-red-50 text-red-600 border border-red-200'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[13.5px] font-semibold text-slate-500">{formatDate(row.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    Las exportaciones se generan bajo demanda en formato CSV o PDF de alta definición 1A.
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
                {masterLogs.map(log => (
                  <div key={log.id} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-850 hover:bg-slate-900 transition-colors">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-blue-400 font-bold">[{formatDate(log.timestamp)} {new Date(log.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                          <span className="text-purple-400 font-bold">&gt; {log.action}</span>
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
              title="Configuracion del Sistema"
              description="Mantenimiento global, version del sistema y mensajes de difusion."
              actionLabel="Guardar configuracion"
              onAction={handleUpdateConfig}
            />
            <div className={`${shellCardClass} p-6 lg:p-8 rounded-[32px]`}>
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <div className="rounded-[24px] border border-slate-200 bg-[#FCFDFF] p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${platformConfig.maintenanceMode ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'}`}>
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
                            ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {platformConfig.maintenanceMode ? 'Activo' : 'Desactivado'}
                      </button>
                    </div>
                  </div>

                  <FieldBlock label="Mensaje de Difusión (Broadcast)">
                    <input
                      value={platformConfig.broadcastMessage}
                      onChange={event => setPlatformConfig(current => ({ ...current, broadcastMessage: event.target.value }))}
                      className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-800 outline-none transition-all duration-200 hover:border-blue-200 focus:border-blue-500"
                      placeholder="Escribe un aviso para todas las pantallas del SaaS..."
                    />
                  </FieldBlock>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FieldBlock label="Fecha programada de mantenimiento">
                      <input
                        type="date"
                        value={platformConfig.maintenanceDate}
                        onChange={event => setPlatformConfig(current => ({ ...current, maintenanceDate: event.target.value }))}
                        className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-800 outline-none transition-all duration-200 hover:border-blue-200 focus:border-blue-500"
                      />
                    </FieldBlock>
                    <FieldBlock label="Versión del Core">
                      <input
                        value={platformConfig.systemVersion}
                        onChange={event => setPlatformConfig(current => ({ ...current, systemVersion: event.target.value }))}
                        className="h-[56px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-800 outline-none transition-all duration-200 hover:border-blue-200 focus:border-blue-500"
                      />
                    </FieldBlock>
                  </div>
                </div>

                <div className="space-y-4">
                  <SidebarInfoCard title="Estado del Kernel" icon={Activity}>
                    <SummaryRow label="Versión del Core" value={platformConfig.systemVersion} tone="blue" />
                    <SummaryRow label="Mantenimiento" value={platformConfig.maintenanceMode ? 'Activo' : 'Desactivado'} tone={platformConfig.maintenanceMode ? 'danger' : 'success'} />
                    <SummaryRow label="Mensaje Broadcast" value={platformConfig.broadcastMessage || 'Sin mensaje activo'} tone="neutral" />
                  </SidebarInfoCard>
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
        </section>

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
                  <select
                    value={provisionPlanId}
                    onChange={event => {
                      const value = event.target.value;
                      setProvisionPlanId(value);
                      const selectedPlan = plans.find(plan => plan.id === value);
                      if (selectedPlan) {
                        setProvisionPrice(provisionCycle === 'YEARLY' ? (selectedPlan.yearlyPrice || selectedPlan.monthlyPrice * 10) : selectedPlan.monthlyPrice);
                      }
                    }}
                    className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                  >
                    {plans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </FieldBlock>
                <FieldBlock label="Ciclo">
                  <select
                    value={provisionCycle}
                    onChange={event => {
                      const value = event.target.value as 'MONTHLY' | 'YEARLY';
                      setProvisionCycle(value);
                      const selectedPlan = plans.find(plan => plan.id === provisionPlanId);
                      if (selectedPlan) {
                        setProvisionPrice(value === 'YEARLY' ? (selectedPlan.yearlyPrice || selectedPlan.monthlyPrice * 10) : selectedPlan.monthlyPrice);
                      }
                    }}
                    className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                  >
                    <option value="MONTHLY">Mensual</option>
                    <option value="YEARLY">Anual</option>
                  </select>
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
  tone: 'blue' | 'emerald' | 'amber';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) => {
  const toneMap = {
    blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]' },
    emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]' },
    amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]' },
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
    <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-6 py-5">
        <h3 className="text-[22px] font-semibold tracking-tight text-[#111827]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#6B7280] ${motionButtonClass}`}
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
