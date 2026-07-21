import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  updateCompanyConfig,
  getBranches,
  createBranch,
  updateCompany,
  canCreateResource,
  deleteBranch,
  getCompanyById,
  getSaaSPlans,
  updateBranch,
  canManageCompanySettings,
  removeBranchFromLocalStorage,
  upsertBranchesInLocalStorage,
  upsertCompaniesInLocalStorage,
  updateUser,
  upsertUsersInLocalStorage,
} from '../services/dataService';
import { Branch, Company, CompanyConfig, Role } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import { readSession } from '../services/authService';
import { optimizeImageFile } from '../services/imageOptimizer';
import gsap from 'gsap';
import { emitPlatformToast, openPlatformCriticalModal, setPlatformLoading } from '../services/platformEvents';
import { PlatformStateCard } from '../components/PlatformStateCard';
import {
  ArrowRight,
  Building,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Edit3,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sliders,
  Trash2,
  TrendingUp,
  Wallet,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '../utils';
import { PdfTemplateBuilder } from '../components/PdfTemplateBuilder';
import { platformShellCardClass, platformPrimaryButtonClass, platformHeaderSecondaryActionClass, platformMotionButtonClass, platformPageTitleClass, platformPageDescriptionClass } from '../components/ui/platformStyles';

const horizontalMotionClass = 'transition-all duration-200 hover:translate-x-1';

const cleanTextInput = (value: string) => value.replace(/\s+/g, ' ').trimStart();
const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};
const formatRncInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 8)}-${digits.slice(8)}`;
};

const getMoraTypeLabel = (value: CompanyConfig['moraType']) =>
  value === 'DAILY' ? 'Diaria' : value === 'PERCENT' ? 'Porcentaje' : 'Monto fijo';

const getMoraTypeSummary = (value: CompanyConfig['moraType']) =>
  value === 'DAILY' ? 'Incremento por dia' : value === 'PERCENT' ? 'Basado en la cuota' : 'Cargo unico por atraso';

const whatsappDefaults = {
  welcome:
    'Hola [CLIENTE], te damos la bienvenida a PrestaFacil RD. Tu gestion fue registrada en [SUCURSAL]. Si necesitas soporte o seguimiento, responde a este mensaje.',
  receipt:
    'Hola [CLIENTE], confirmamos tu pago por [MONTO] con recibo [RECIBO] en fecha [FECHA]. Gracias por mantener tu cuenta al dia con PrestaFacil RD.',
};

const whatsappShortcodes = ['[CLIENTE]', '[MONTO]', '[RECIBO]', '[SUCURSAL]', '[FECHA]', '[CUOTA]', '[SALDO]'];

type SettingsFallbackReason = 'missing-session' | 'token-expired' | 'api-unavailable';

const getSettingsFallbackReason = (error: unknown): SettingsFallbackReason | null => {
  if (error instanceof ApiRequestError && error.status === 401) return 'token-expired';
  if (error instanceof ApiUnavailableError && error.message === 'Missing API session') return 'missing-session';
  if (error instanceof ApiUnavailableError) return 'api-unavailable';
  return null;
};

const getSettingsFallbackToast = (reason: SettingsFallbackReason, scope: string) => {
  if (reason === 'missing-session') {
    return {
      title: `${scope} guardado localmente`,
      message: 'Estas en modo local o de simulacion. El cambio no se sincronizo con el servidor.',
      tone: 'warning' as const,
    };
  }

  if (reason === 'token-expired') {
    return {
      title: `${scope} guardado localmente`,
      message: 'La sesion API vencio. El cambio quedo local y requiere volver a iniciar sesion para sincronizar.',
      tone: 'warning' as const,
    };
  }

  return {
    title: `${scope} guardado localmente`,
    message: 'La API no estuvo disponible. El cambio se mantuvo local hasta recuperar conexion.',
    tone: 'warning' as const,
  };
};

const getSettingsNotice = (reason: SettingsFallbackReason | null) => {
  if (reason === 'missing-session') {
    return 'Estas trabajando en modo local o de simulacion. Para guardar en servidor, inicia sesion por API.';
  }
  if (reason === 'token-expired') {
    return 'La sesion API vencio. Vuelve a iniciar sesion para sincronizar los cambios con servidor.';
  }
  if (reason === 'api-unavailable') {
    return 'La API no estuvo disponible en este momento. Los cambios solo quedaron locales.';
  }
  return '';
};

const subviews = [
  { id: 'profile', label: 'Mi Perfil', path: '/settings/profile', icon: UserRound },
  { id: 'overview', label: 'Resumen', path: '/settings', icon: Sliders },
  { id: 'identity', label: 'Marca', path: '/settings/identity', icon: ImageIcon },
  { id: 'collections', label: 'Cobro', path: '/settings/collections', icon: Wallet },
  { id: 'scoring', label: 'Conducta', path: '/settings/scoring', icon: ShieldCheck },
  { id: 'whatsapp', label: 'WhatsApp', path: '/settings/whatsapp', icon: MessageCircle },
  { id: 'branches', label: 'Sucursales', path: '/settings/branches', icon: Building },
  { id: 'templates', label: 'Plantillas', path: '/settings/templates', icon: FileText },
] as const;

type SubviewId = (typeof subviews)[number]['id'];


const SectionShell: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isMainView?: boolean;
}> = ({ eyebrow, title, description, actions, children, isMainView }) => (
  <div className="space-y-6 pb-24 lg:pb-0 animate-[platform-fade-in_180ms_ease-out]">
    <section data-settings-hero={isMainView ? "" : undefined}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#2563EB] mb-2">{eyebrow}</p>
          <h1 className={platformPageTitleClass}>{title}</h1>
          <p className={platformPageDescriptionClass}>{description}</p>
        </div>
        {actions ? <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">{actions}</div> : null}
      </div>
    </section>
    {children}
  </div>
);

const ActionButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}> = ({ label, icon, onClick, primary, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={
      primary
        ? `${platformPrimaryButtonClass} h-[54px] min-w-[188px] px-6 text-[17px] disabled:cursor-not-allowed disabled:opacity-60`
        : `${platformHeaderSecondaryActionClass} ${platformMotionButtonClass} min-w-[176px] disabled:cursor-not-allowed disabled:opacity-60`
    }
  >
    {icon}
    {label}
  </button>
);

const KpiCard: React.FC<{
  title: string;
  value: string;
  helper: string;
  tone: 'blue' | 'green' | 'amber' | 'red';
  icon: LucideIcon;
  participation: string;
}> = ({ title, value, helper, tone, icon: Icon, participation }) => {
  const tones = {
    blue: {
      chip: 'bg-[#DBEAFE] text-[#2563EB]',
      helper: 'text-[#2563EB]',
      watermark: 'text-[#BFDBFE]',
    },
    green: {
      chip: 'bg-[#DCFCE7] text-[#16A34A]',
      helper: 'text-[#16A34A]',
      watermark: 'text-[#BBF7D0]',
    },
    amber: {
      chip: 'bg-[#FEF3C7] text-[#D97706]',
      helper: 'text-[#D97706]',
      watermark: 'text-[#FCD34D]',
    },
    red: {
      chip: 'bg-[#FEE2E2] text-[#DC2626]',
      helper: 'text-[#DC2626]',
      watermark: 'text-[#FECACA]',
    },
  } as const;

  return (
    <article className={`relative min-h-[214px] overflow-hidden ${platformShellCardClass} p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${tones[tone].chip}`}>
          <Icon size={24} strokeWidth={2.2} />
        </div>
        <div className="text-right">
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
          <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">{participation}</p>
        </div>
      </div>
      <div className="relative z-10 mt-8 space-y-3">
        <p className="text-[17px] font-semibold text-[#111827]">{title}</p>
        <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{value}</p>
        <p className={`max-w-[180px] text-[15px] font-medium leading-6 ${tones[tone].helper}`}>{helper}</p>
      </div>
      <div className={`pointer-events-none absolute bottom-4 right-4 z-0 opacity-[0.22] ${tones[tone].watermark}`}>
        <Icon size={88} strokeWidth={1.7} />
      </div>
    </article>
  );
};

const SettingsKpiGrid: React.FC<{
  branchesCount: number;
  branchMonthlyGoal: number;
  defaultMoraAmount: number;
  graceDays: number;
  whatsappReady: number;
}> = ({ branchesCount, branchMonthlyGoal, defaultMoraAmount, graceDays, whatsappReady }) => (
  <section className="grid gap-5 xl:grid-cols-4">
    <KpiCard title="Sucursales activas" value={`${branchesCount}`} helper="Cobertura registrada" tone="blue" icon={Building} participation="100.0%" />
    <KpiCard title="Meta consolidada" value={formatCurrency(branchMonthlyGoal)} helper="Objetivo mensual visible" tone="green" icon={TrendingUp} participation="Capital" />
    <KpiCard title="Mora base" value={formatCurrency(defaultMoraAmount)} helper={`${graceDays} dias de gracia`} tone="red" icon={Wallet} participation="Cobro" />
    <KpiCard title="WhatsApp listo" value={`${whatsappReady}/2`} helper="Plantillas completadas" tone="amber" icon={MessageCircle} participation="Mensajeria" />
  </section>
);

const Panel: React.FC<{ title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, description, action, children }) => (
  <section className={`${platformShellCardClass} p-6`}>
    <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-5 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-[#111827]">{title}</h2>
        {description ? <p className="mt-2 text-[14px] font-medium text-[#64748B]">{description}</p> : null}
      </div>
      {action}
    </div>
    <div className="mt-6">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; helper?: string; children: React.ReactNode }> = ({ label, helper, children }) => (
  <div className="space-y-2">
    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">{label}</label>
    {children}
    {helper ? <p className="text-[12px] font-medium text-[#94A3B8]">{helper}</p> : null}
  </div>
);

const SubviewTabs: React.FC<{
  activeSubview: SubviewId;
  onNavigate: (path: string) => void;
  canManageSettings: boolean;
}> = ({ activeSubview, onNavigate, canManageSettings }) => {
  const visibleSubviews = useMemo(() => {
    if (!canManageSettings) return subviews.filter(item => item.id === 'profile');
    return subviews;
  }, [canManageSettings]);

  return (
    <section data-settings-menu className={`${platformShellCardClass} p-2`}>
      <div className="flex flex-wrap gap-2">
        {visibleSubviews.map(item => {
          const active = item.id === activeSubview;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                active
                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
              }`}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};

const MoraTypePicker: React.FC<{
  value: CompanyConfig['moraType'];
  onChange: (value: CompanyConfig['moraType']) => void;
}> = ({ value, onChange }) => (
  <div className="grid gap-3 md:grid-cols-3">
    {[
      { value: 'FLAT' as const, label: 'Monto fijo', helper: 'Cargo unico por atraso' },
      { value: 'DAILY' as const, label: 'Diaria', helper: 'Incremento por dia' },
      { value: 'PERCENT' as const, label: 'Porcentaje', helper: 'Basado en la cuota' },
    ].map(option => {
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-[24px] border px-5 py-4 text-left transition-all duration-200 hover:translate-x-1 ${
            active
              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_16px_36px_rgba(37,99,235,0.10)]'
              : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#DBEAFE]'
          }`}
        >
          <p className="text-[15px] font-bold">{option.label}</p>
          <p className="mt-2 text-[12px] font-medium text-[#64748B]">{option.helper}</p>
        </button>
      );
    })}
  </div>
);

const ConfigurationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [activeWhatsappField, setActiveWhatsappField] = useState<'welcome' | 'receipt'>('welcome');
  const welcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const receiptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const branchLimitToastShownRef = useRef(false);
  const localConfigToastShownRef = useRef(false);
  const localBranchesToastShownRef = useRef(false);

  const [configForm, setConfigForm] = useState<CompanyConfig>({
    defaultMoraAmount: 0,
    moraType: 'FLAT',
    graceDays: 0,
    currency: 'DOP',
    receiptFooter: '',
    scoringThresholdRegular: 5,
    scoringThresholdMala: 15,
    skipSundays: true,
    whatsappWelcomeTemplate: '',
    whatsappReceiptTemplate: '',
  });

  const [companyForm, setCompanyForm] = useState({
    name: '',
    rnc: '',
    logo: '',
  });

  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    photo: currentUser?.photo || '',
  });

  const [themePreference, setThemePreference] = useState(() => localStorage.getItem('pref-theme') || 'LIGHT');
  const [densityPreference, setDensityPreference] = useState(() => localStorage.getItem('pref-density') || 'COMFORTABLE');
  const [whatsappNotifyPreference, setWhatsappNotifyPreference] = useState(() => localStorage.getItem('pref-whatsapp') === 'true');

  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    managerName: '',
    monthlyGoal: 0,
    phone: '',
    logo: '',
  });

  const canManageSettings = currentUser ? canManageCompanySettings(currentUser) : false;
  const activeSession = readSession();
  const isApiSessionActive = activeSession?.mode === 'api' && Boolean(activeSession.accessToken);
  const currentPlan = useMemo(() => getSaaSPlans().find(plan => plan.id === company?.planId), [company?.planId]);
  const branchLimit = currentPlan?.maxBranches || Math.max(branches.length, 1);
  const branchUsageRatio = Math.min(branches.length / branchLimit, 1);
  const sessionModeBanner = !isApiSessionActive ? (
    <div className="rounded-[24px] border border-[#FDE68A] bg-[#FFF7ED] px-5 py-4 text-[13px] font-semibold text-[#B45309]">
      Estas operando en modo local o de simulacion. Los cambios pueden guardarse solo en este equipo hasta volver a iniciar sesion por API.
    </div>
  ) : null;

  const pushSettingsToast = useCallback((title: string, message: string, tone: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    emitPlatformToast({ title, message, tone, durationMs: tone === 'error' || tone === 'warning' ? 5200 : 3200 });
  }, []);

  const activeSubview = useMemo<SubviewId>(() => {
    const match = subviews.find(item => item.path === location.pathname);
    return match?.id || 'overview';
  }, [location.pathname]);

  const refreshData = useCallback(() => {
    if (!currentUser) return;
    const comp = getCompanyById(currentUser.companyId);
    if (comp) {
      setCompany(comp);
      setConfigForm({ ...comp.config });
      setCompanyForm({ name: comp.name, rnc: comp.rnc || '', logo: comp.logo || '' });
    }

    apiClient
      .getMyCompany()
      .then(response => {
        upsertCompaniesInLocalStorage([response.data]);
        setCompany(response.data);
        setConfigForm({ ...response.data.config });
        setCompanyForm({ name: response.data.name, rnc: response.data.rnc || '', logo: response.data.logo || '' });
        localConfigToastShownRef.current = false;
      })
      .catch(error => {
        const fallbackReason = getSettingsFallbackReason(error);
        if (!fallbackReason) {
          pushSettingsToast('No se pudo cargar configuracion', error instanceof Error ? error.message : 'No se pudo cargar la configuracion de empresa.', 'error');
          return;
        }
        if (!localConfigToastShownRef.current) {
          pushSettingsToast('Configuracion disponible en modo local', getSettingsNotice(fallbackReason), 'warning');
          localConfigToastShownRef.current = true;
        }
      });

    setBranches(getBranches(currentUser.companyId));
    apiClient
      .listBranches()
      .then(response => {
        upsertBranchesInLocalStorage(response.data);
        setBranches(response.data.filter(branch => currentUser.role === Role.SUPER_ADMIN || branch.companyId === currentUser.companyId));
        localBranchesToastShownRef.current = false;
      })
      .catch(error => {
        const fallbackReason = getSettingsFallbackReason(error);
        if (!fallbackReason) {
          pushSettingsToast('No se pudieron cargar sucursales', error instanceof Error ? error.message : 'No se pudieron cargar las sucursales.', 'error');
          return;
        }
        if (!localBranchesToastShownRef.current) {
          pushSettingsToast('Sucursales disponibles en modo local', getSettingsNotice(fallbackReason), 'warning');
          localBranchesToastShownRef.current = true;
        }
      });
  }, [currentUser]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    gsap.fromTo('[data-settings-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
    gsap.fromTo('[data-settings-menu]', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out', delay: 0.1 });
    gsap.fromTo('[data-settings-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.18 });
  }, []);

  useEffect(() => {
    if (isApiSessionActive) {
      localConfigToastShownRef.current = false;
      localBranchesToastShownRef.current = false;
    }
  }, [isApiSessionActive]);

  useEffect(() => {
    const branchLimitReached = Boolean(
      currentUser &&
      activeSubview === 'branches' &&
      !editingBranch &&
      !canCreateResource(currentUser.companyId, 'BRANCH'),
    );

    if (branchLimitReached && !branchLimitToastShownRef.current) {
      pushSettingsToast(
        'Limite de sucursales alcanzado',
        'Tu plan actual ya alcanzo el maximo de sucursales disponibles. Puedes editar las existentes o ampliar el plan.',
        'warning',
      );
      branchLimitToastShownRef.current = true;
      return;
    }

    if (!branchLimitReached) {
      branchLimitToastShownRef.current = false;
    }
  }, [activeSubview, currentUser, editingBranch, pushSettingsToast]);

  const resetBranchForm = () => {
    setEditingBranch(null);
    setBranchForm({ name: '', address: '', managerName: '', monthlyGoal: 0, phone: '', logo: '' });
  };

  const handleProfilePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void optimizeImageFile(file)
      .then(photo => setProfileForm(current => ({ ...current, photo })))
      .catch(() => pushSettingsToast('No pudimos procesar la foto', 'Intenta con un formato diferente o una imagen más ligera.', 'error'));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setPlatformLoading({ active: true, label: 'Guardando perfil' });

    try {
      // Guardar preferencias visuales y operativas en localStorage
      localStorage.setItem('pref-theme', themePreference);
      localStorage.setItem('pref-density', densityPreference);
      localStorage.setItem('pref-whatsapp', String(whatsappNotifyPreference));

      // Guardar datos del usuario de forma persistente en la BD de localStorage
      updateUser(currentUser.id, {
        name: profileForm.name,
        phone: profileForm.phone,
        photo: profileForm.photo,
      });

      // Actualizar objeto en sesión actual
      currentUser.name = profileForm.name;
      currentUser.phone = profileForm.phone;
      currentUser.photo = profileForm.photo;
      
      // Intentar enviar actualización del perfil al backend si aplica
      try {
        const response = await (apiClient as any).updateProfile({
          name: profileForm.name,
          phone: profileForm.phone,
          photo: profileForm.photo,
        });
        if (response.data) {
          upsertUsersInLocalStorage([response.data]);
        }
      } catch {
        // En modo local o de simulacion
      }

      // Aplicar preferencias en caliente en el DOM
      const root = document.documentElement;
      if (themePreference === 'DARK') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      emitPlatformToast({
        title: 'Perfil y preferencias guardados',
        message: 'Tus datos y configuración visual de la plataforma han sido actualizados.',
        tone: 'success',
      });
      refreshData();
    } catch (error) {
      pushSettingsToast('Error al guardar perfil', error instanceof Error ? error.message : 'No se pudo guardar la configuración.', 'error');
    } finally {
      setIsSaving(false);
      setPlatformLoading({ active: false });
    }
  };

  const handleSaveConfig = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setPlatformLoading({ active: true, label: 'Guardando configuracion' });
    let fallbackReason: SettingsFallbackReason | null = null;
    try {
      try {
        const response = await apiClient.updateMyCompany({ config: configForm });
        upsertCompaniesInLocalStorage([response.data]);
        setCompany(response.data);
        setConfigForm({ ...response.data.config });
      } catch (error) {
        fallbackReason = getSettingsFallbackReason(error);
        if (!fallbackReason) throw error;
        updateCompanyConfig(currentUser.companyId, configForm);
      }
      if (fallbackReason) {
        emitPlatformToast(getSettingsFallbackToast(fallbackReason, 'Configuracion'));
      } else {
        emitPlatformToast({
          title: 'Configuracion guardada',
          message: 'Los cambios quedaron actualizados correctamente.',
          tone: 'success',
        });
      }
      refreshData();
    } catch (error) {
      pushSettingsToast('No se pudo guardar configuracion', error instanceof Error ? error.message : 'Intenta nuevamente.', 'error');
    } finally {
      setPlatformLoading({ active: false });
      setIsSaving(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setPlatformLoading({ active: true, label: 'Guardando identidad' });
    let fallbackReason: SettingsFallbackReason | null = null;
    try {
      try {
        const response = await apiClient.updateMyCompany(companyForm);
        upsertCompaniesInLocalStorage([response.data]);
        setCompany(response.data);
        setCompanyForm({ name: response.data.name, rnc: response.data.rnc || '', logo: response.data.logo || '' });
      } catch (error) {
        fallbackReason = getSettingsFallbackReason(error);
        if (!fallbackReason) throw error;
        updateCompany(currentUser.companyId, companyForm);
      }
      if (fallbackReason) {
        emitPlatformToast(getSettingsFallbackToast(fallbackReason, 'Identidad'));
      } else {
        emitPlatformToast({
          title: 'Identidad actualizada',
          message: 'La marca e informacion legal fueron actualizadas.',
          tone: 'success',
        });
      }
      refreshData();
    } catch (error) {
      pushSettingsToast('No se pudo guardar identidad', error instanceof Error ? error.message : 'Intenta nuevamente.', 'error');
    } finally {
      setPlatformLoading({ active: false });
      setIsSaving(false);
    }
  };

  const handleAddBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !branchForm.name.trim()) return;
    setPlatformLoading({ active: true, label: editingBranch ? 'Actualizando sucursal' : 'Creando sucursal' });
    let fallbackReason: SettingsFallbackReason | null = null;
    try {
      const payload = {
        companyId: currentUser.companyId,
        name: branchForm.name,
        address: branchForm.address,
        managerName: branchForm.managerName,
        monthlyGoal: branchForm.monthlyGoal,
        phone: branchForm.phone,
        logo: branchForm.logo,
      };

      if (editingBranch) {
        try {
          const response = await apiClient.updateBranch(editingBranch.id, payload);
          upsertBranchesInLocalStorage([response.data]);
        } catch (error) {
          fallbackReason = getSettingsFallbackReason(error);
          if (!fallbackReason) throw error;
          updateBranch(editingBranch.id, branchForm);
        }
      } else {
        try {
          const response = await apiClient.createBranch(payload);
          upsertBranchesInLocalStorage([response.data]);
        } catch (error) {
          fallbackReason = getSettingsFallbackReason(error);
          if (!fallbackReason) throw error;
          createBranch(payload);
        }
      }

      resetBranchForm();
      refreshData();
      if (fallbackReason) {
        emitPlatformToast(getSettingsFallbackToast(fallbackReason, editingBranch ? 'Sucursal actualizada' : 'Sucursal creada'));
      } else {
        emitPlatformToast({
          title: editingBranch ? 'Sucursal actualizada' : 'Sucursal creada',
          message: editingBranch ? 'Los datos de la sucursal quedaron actualizados.' : 'La sucursal ya esta disponible para la operacion.',
          tone: 'success',
        });
      }
    } catch (error) {
      pushSettingsToast('No se pudo guardar la sucursal', error instanceof Error ? error.message : 'Intenta nuevamente.', 'error');
    } finally {
      setPlatformLoading({ active: false });
    }
  };

  const deleteBranchConfirmed = async (id: string) => {
    setPlatformLoading({ active: true, label: 'Eliminando sucursal' });
    try {
      let fallbackReason: SettingsFallbackReason | null = null;
      try {
        await apiClient.deleteBranch(id);
        removeBranchFromLocalStorage(id);
      } catch (error) {
        fallbackReason = getSettingsFallbackReason(error);
        if (!fallbackReason) throw error;
        deleteBranch(id);
      }
      refreshData();
      if (fallbackReason) {
        emitPlatformToast(getSettingsFallbackToast(fallbackReason, 'Sucursal eliminada'));
      } else {
        emitPlatformToast({
          title: 'Sucursal eliminada',
          message: 'La sucursal fue removida correctamente.',
          tone: 'success',
        });
      }
    } catch (error) {
      pushSettingsToast('No se pudo eliminar la sucursal', error instanceof Error ? error.message : 'Intenta nuevamente.', 'error');
    } finally {
      setPlatformLoading({ active: false });
    }
  };

  const handleDeleteBranch = (id: string) => {
    const branch = branches.find(item => item.id === id);
    openPlatformCriticalModal({
      id: 'delete-branch-confirmation',
      title: '¿Eliminar esta sucursal?',
      description: 'Esta accion removera la sucursal del panel operativo actual. Si continuas, no se podra revertir desde esta misma vista.',
      tone: 'danger',
      confirmLabel: 'Eliminar sucursal',
      cancelLabel: 'Conservar sucursal',
      highlights: [
        { label: 'Sucursal', value: branch?.name || 'Sucursal seleccionada' },
        { label: 'Cobertura', value: branch?.address || 'Sin direccion visible' },
      ],
      onConfirm: () => deleteBranchConfirmed(id),
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void optimizeImageFile(file)
      .then(logo => setCompanyForm(current => ({ ...current, logo })))
      .catch(() => pushSettingsToast('No se pudo procesar el logo', 'Intenta con una imagen mas ligera o en mejor formato.', 'error'));
  };

  const handleBranchLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void optimizeImageFile(file)
      .then(logo => setBranchForm(current => ({ ...current, logo })))
      .catch(() => pushSettingsToast('No se pudo procesar la foto de sucursal', 'Intenta con una imagen mas ligera o en mejor formato.', 'error'));
  };

  const branchMonthlyGoal = branches.reduce((acc, branch) => acc + Number(branch.monthlyGoal || 0), 0);
  const whatsappReady = Number(Boolean(configForm.whatsappWelcomeTemplate)) + Number(Boolean(configForm.whatsappReceiptTemplate));

  const insertWhatsappToken = (token: string, targetField?: 'welcome' | 'receipt') => {
    const field = targetField || activeWhatsappField;
    const ref = field === 'welcome' ? welcomeTextareaRef : receiptTextareaRef;
    const currentValue = field === 'welcome' ? configForm.whatsappWelcomeTemplate : configForm.whatsappReceiptTemplate;
    const element = ref.current;

    const start = element?.selectionStart ?? currentValue.length;
    const end = element?.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`.slice(0, 360);

    setConfigForm(current =>
      field === 'welcome'
        ? { ...current, whatsappWelcomeTemplate: nextValue }
        : { ...current, whatsappReceiptTemplate: nextValue },
    );

    requestAnimationFrame(() => {
      if (!ref.current) return;
      const cursor = Math.min(start + token.length, nextValue.length);
      ref.current.focus();
      ref.current.setSelectionRange(cursor, cursor);
    });
  };

  const applyWhatsappExample = (field: 'welcome' | 'receipt') => {
    setActiveWhatsappField(field);
    setConfigForm(current =>
      field === 'welcome'
        ? { ...current, whatsappWelcomeTemplate: whatsappDefaults.welcome }
        : { ...current, whatsappReceiptTemplate: whatsappDefaults.receipt },
    );
  };

  if (!currentUser || (!canManageSettings && activeSubview !== 'profile')) {
    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        <section className="mx-auto max-w-[640px] pt-16">
          <PlatformStateCard
            kind="permission-denied"
            title="Sin permisos"
            message="No tienes permisos para acceder a esta seccion. Vuelve al inicio o entra con una cuenta administrativa."
            primaryLabel="Volver al inicio"
            secondaryLabel="Ir al login"
            onPrimary={() => navigate('/')}
            onSecondary={() => navigate('/auth')}
          />
        </section>
      </div>
    );
  }

  const commonActions = (
    <>
      <ActionButton label="Volver al resumen" icon={<ChevronLeft size={18} />} onClick={() => navigate('/settings')} />
      <ActionButton label="Sucursales" icon={<Building size={18} />} onClick={() => navigate('/settings/branches')} />
    </>
  );

  if (activeSubview === 'profile') {
    return (
      <SectionShell
        eyebrow="Ajustes de usuario"
        title="Mi Perfil y Preferencias"
        description="Gestiona tus datos personales, foto de perfil y personaliza la experiencia visual de tu sesión en la plataforma."
        actions={
          <ActionButton
            label={isSaving ? 'Guardando...' : 'Guardar perfil'}
            icon={<ArrowRight size={18} />}
            onClick={() => void handleSaveProfile()}
            primary
            disabled={isSaving}
          />
        }
      >
        <SubviewTabs activeSubview={activeSubview} onNavigate={navigate} canManageSettings={canManageSettings} />
        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Panel title="Información personal" description="Identificación operativa del usuario en la plataforma.">
            <div className="grid gap-6 xl:grid-cols-[200px_1fr]">
              <div className="flex flex-col items-center rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-6 text-center">
                <div className="relative">
                  <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[24px] border-4 border-[#E5E7EB] bg-white">
                    {profileForm.photo ? (
                      <img src={profileForm.photo} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound size={64} className="text-[#CBD5E1]" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition-all duration-200 hover:translate-x-1">
                    <Camera size={15} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} />
                  </label>
                </div>
                <p className="mt-4 text-[12px] font-medium text-[#64748B]">Sube tu foto para identificarte en rutas, cobros y auditorías.</p>
              </div>

              <div className="grid gap-5">
                <Field label="Nombre completo" helper="Tu nombre visible para otros usuarios y en recibos oficiales.">
                  <input
                    className={inputClassName}
                    value={profileForm.name}
                    onChange={event => setProfileForm(current => ({ ...current, name: cleanTextInput(event.target.value) }))}
                  />
                </Field>
                <Field label="Teléfono de contacto" helper="Teléfono celular para notificaciones o alertas rápidas.">
                  <input
                    className={inputClassName}
                    value={profileForm.phone}
                    onChange={event => setProfileForm(current => ({ ...current, phone: formatPhoneInput(event.target.value) }))}
                    placeholder="809-555-4400"
                    inputMode="numeric"
                  />
                </Field>
                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={isSaving}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Personalización visual" description="Personaliza tu espacio de trabajo.">
              <div className="space-y-5">
                <Field label="Tema de la plataforma" helper="Elige cómo se adaptan los colores a tu pantalla.">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { value: 'LIGHT', label: 'Claro☀️' },
                      { value: 'DARK', label: 'Oscuro🌙' },
                    ].map(opt => {
                      const active = themePreference === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setThemePreference(opt.value)}
                          className={`rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                            active
                              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-sm'
                              : 'border-[#E5E7EB] bg-white text-[#475569] hover:border-[#DBEAFE]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Densidad de tablas" helper="Controla la separación de las filas de datos.">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { value: 'COMFORTABLE', label: 'Cómodo (Normal)' },
                      { value: 'COMPACT', label: 'Compacto (Móvil)' },
                    ].map(opt => {
                      const active = densityPreference === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDensityPreference(opt.value)}
                          className={`rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-all duration-200 ${
                            active
                              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-sm'
                              : 'border-[#E5E7EB] bg-white text-[#475569] hover:border-[#DBEAFE]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="border-t border-[#F1F5F9] pt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappNotifyPreference}
                      onChange={event => setWhatsappNotifyPreference(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">Enviar WhatsApp automático</p>
                      <p className="text-xs text-[#64748B] mt-0.5">Disparar plantilla de recibo al registrar un cobro en vivo.</p>
                    </div>
                  </label>
                </div>
              </div>
            </Panel>
          </div>
        </section>
      </SectionShell>
    );
  }

  if (activeSubview === 'identity') {
    return (
      <SectionShell
        eyebrow="Configuracion"
        title="Identidad de la empresa"
        description="Gestiona marca, razon social, RNC y activos visuales oficiales para recibos, reportes y documentos."
        actions={
          <>
            {commonActions}
            <ActionButton label={isSaving ? 'Guardando...' : 'Guardar identidad'} icon={<ArrowRight size={18} />} onClick={() => void handleSaveIdentity()} primary disabled={isSaving} />
          </>
        }
      >
        <SettingsKpiGrid
          branchesCount={branches.length}
          branchMonthlyGoal={branchMonthlyGoal}
          defaultMoraAmount={configForm.defaultMoraAmount}
          graceDays={configForm.graceDays}
          whatsappReady={whatsappReady}
        />
        <SubviewTabs activeSubview={activeSubview} onNavigate={navigate} canManageSettings={canManageSettings} />
        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Panel title="Marca institucional" description="Aplica estos datos a recibos, reportes y visuales del sistema.">
            <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
              <div className="flex flex-col items-center rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-6 text-center">
                <div className="relative">
                  <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-[24px] border-4 border-[#E5E7EB] bg-white">
                    {companyForm.logo ? <img src={companyForm.logo} alt="Logo" className="h-full w-full object-cover" /> : <ImageIcon size={76} className="text-[#CBD5E1]" />}
                  </div>
                  <label className="absolute bottom-0 right-0 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition-all duration-200 hover:translate-x-1">
                    <Camera size={16} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
                <p className="mt-4 text-[13px] font-medium text-[#64748B]">Sube un logo limpio para documentos y encabezados oficiales.</p>
              </div>
              <div className="grid gap-5">
                <Field label="Nombre legal" helper="Se usa en encabezados, reportes y documentos exportados.">
                  <input className={inputClassName} value={companyForm.name} onChange={event => setCompanyForm(current => ({ ...current, name: cleanTextInput(event.target.value) }))} />
                </Field>
                <Field label="RNC" helper="Identificador tributario visible en formatos financieros.">
                  <input className={inputClassName} value={companyForm.rnc} onChange={event => setCompanyForm(current => ({ ...current, rnc: formatRncInput(event.target.value) }))} placeholder="XXX-XXXXX-X" inputMode="numeric" />
                </Field>
              </div>
            </div>
          </Panel>
          <Panel title="Resumen institucional" description="Lectura rapida de la configuracion vigente.">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Empresa</p>
                <p className="mt-2 text-[18px] font-bold text-[#111827]">{companyForm.name || 'Pendiente'}</p>
              </div>
              <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">RNC</p>
                <p className="mt-2 text-[18px] font-bold text-[#111827]">{companyForm.rnc || 'Pendiente'}</p>
              </div>
              <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Plan</p>
                <p className="mt-2 text-[18px] font-bold text-[#111827]">{company?.planId || 'N/D'}</p>
              </div>
            </div>
          </Panel>
        </section>
      </SectionShell>
    );
  }

  if (activeSubview === 'collections') {
    return (
      <SectionShell
        eyebrow="Configuracion"
        title="Reglas de cobro"
        description="Define mora, dias de gracia y pie de recibo para mantener una operacion consistente por sucursal."
        actions={
          <>
            {commonActions}
            <ActionButton label={isSaving ? 'Guardando...' : 'Guardar reglas'} icon={<ArrowRight size={18} />} onClick={() => void handleSaveConfig()} primary disabled={isSaving} />
          </>
        }
      >
        <SettingsKpiGrid
          branchesCount={branches.length}
          branchMonthlyGoal={branchMonthlyGoal}
          defaultMoraAmount={configForm.defaultMoraAmount}
          graceDays={configForm.graceDays}
          whatsappReady={whatsappReady}
        />
        <SubviewTabs activeSubview={activeSubview} onNavigate={navigate} canManageSettings={canManageSettings} />
        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Panel title="Motor financiero" description="Controla el comportamiento de mora y los textos de recibo.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Mora base RD$" helper="Cargo inicial sugerido para atrasos.">
                <input type="number" min={0} className={inputClassName} value={configForm.defaultMoraAmount} onChange={event => setConfigForm(current => ({ ...current, defaultMoraAmount: Math.max(0, Number(event.target.value)) }))} />
              </Field>
              <Field label="Dias de gracia" helper="Ventana sin mora luego del vencimiento.">
                <input type="number" min={0} className={inputClassName} value={configForm.graceDays} onChange={event => setConfigForm(current => ({ ...current, graceDays: Math.max(0, Number(event.target.value)) }))} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Modalidad de mora" helper="Selecciona como se acumula el cargo financiero.">
                  <MoraTypePicker value={configForm.moraType} onChange={value => setConfigForm(current => ({ ...current, moraType: value }))} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Pie de recibo" helper="Mensaje visible en recibos y confirmaciones impresas.">
                  <div className="space-y-2">
                    <textarea className={textareaClassName} value={configForm.receiptFooter} onChange={event => setConfigForm(current => ({ ...current, receiptFooter: event.target.value.slice(0, 180) }))} placeholder="Gracias por su puntualidad..." />
                    <div className="flex items-center justify-end">
                      <span className="text-[12px] font-semibold text-[#94A3B8]">{configForm.receiptFooter.length}/180</span>
                    </div>
                  </div>
                </Field>
              </div>
            </div>
          </Panel>
          <div className="space-y-6">
            <KpiCard title="Mora configurada" value={formatCurrency(configForm.defaultMoraAmount)} helper={`${getMoraTypeLabel(configForm.moraType)} · ${configForm.graceDays} dias de gracia`} tone="red" icon={Wallet} participation="100%" />
            <Panel title="Resumen" description="Configuracion activa para caja y cobro.">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Modalidad</p>
                  <p className="mt-2 text-[18px] font-bold text-[#111827]">{getMoraTypeLabel(configForm.moraType)}</p>
                  <p className="mt-1 text-[13px] font-medium text-[#64748B]">{getMoraTypeSummary(configForm.moraType)}</p>
                </div>
                <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Moneda</p>
                  <p className="mt-2 text-[18px] font-bold text-[#111827]">{configForm.currency}</p>
                </div>
              </div>
            </Panel>
          </div>
        </section>
      </SectionShell>
    );
  }

  if (activeSubview === 'scoring') {
    return (
      <SectionShell
        eyebrow="Configuracion"
        title="Politica de conducta"
        description="Controla los umbrales de scoring y los criterios automáticos de seguimiento y riesgo."
        actions={
          <>
            {commonActions}
            <ActionButton label={isSaving ? 'Guardando...' : 'Guardar scoring'} icon={<ArrowRight size={18} />} onClick={() => void handleSaveConfig()} primary disabled={isSaving} />
          </>
        }
      >
        <SettingsKpiGrid
          branchesCount={branches.length}
          branchMonthlyGoal={branchMonthlyGoal}
          defaultMoraAmount={configForm.defaultMoraAmount}
          graceDays={configForm.graceDays}
          whatsappReady={whatsappReady}
        />
        <SubviewTabs activeSubview={activeSubview} onNavigate={navigate} canManageSettings={canManageSettings} />
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel title="Umbrales de comportamiento" description="Define como escala el riesgo del cliente.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Umbral regular" helper="Cantidad de incidencias para degradacion leve.">
                <input type="number" min={0} className={inputClassName} value={configForm.scoringThresholdRegular} onChange={event => setConfigForm(current => ({ ...current, scoringThresholdRegular: Math.max(0, Number(event.target.value)) }))} />
              </Field>
              <Field label="Umbral mala paga" helper="Cantidad de incidencias para riesgo alto.">
                <input type="number" min={0} className={inputClassName} value={configForm.scoringThresholdMala} onChange={event => setConfigForm(current => ({ ...current, scoringThresholdMala: Math.max(0, Number(event.target.value)) }))} />
              </Field>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setConfigForm(current => ({ ...current, skipSundays: !current.skipSundays }))}
                  className={`flex h-14 w-full items-center justify-between rounded-2xl border border-[#E5E7EB] px-4 text-left text-[15px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                >
                  <span>Omitir domingos en reglas operativas</span>
                  <span className={configForm.skipSundays ? 'text-[#16A34A]' : 'text-[#DC2626]'}>{configForm.skipSundays ? 'Activo' : 'Inactivo'}</span>
                </button>
              </div>
            </div>
          </Panel>
          <div className="space-y-6">
            <KpiCard title="Umbral regular" value={`${configForm.scoringThresholdRegular}`} helper="Incidencias moderadas" tone="blue" icon={ShieldCheck} participation="Base" />
            <KpiCard title="Umbral mala paga" value={`${configForm.scoringThresholdMala}`} helper="Escalamiento de riesgo" tone="amber" icon={TrendingUp} participation="Critico" />
          </div>
        </section>
      </SectionShell>
    );
  }

  if (activeSubview === 'whatsapp') {
    return (
      <SectionShell
        eyebrow="Configuracion"
        title="Plantillas de WhatsApp"
        description="Define mensajes base para bienvenida, desembolso y confirmación de pago del cliente."
        actions={
          <>
            {commonActions}
            <ActionButton label={isSaving ? 'Guardando...' : 'Guardar plantillas'} icon={<ArrowRight size={18} />} onClick={() => void handleSaveConfig()} primary disabled={isSaving} />
          </>
        }
      >
        <SettingsKpiGrid
          branchesCount={branches.length}
          branchMonthlyGoal={branchMonthlyGoal}
          defaultMoraAmount={configForm.defaultMoraAmount}
          graceDays={configForm.graceDays}
          whatsappReady={whatsappReady}
        />
        <SubviewTabs activeSubview={activeSubview} onNavigate={navigate} canManageSettings={canManageSettings} />
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel title="Mensajeria operativa" description="Usa variables como [CLIENTE], [MONTO] o [RECIBO].">
            <div className="grid gap-5">
              <Field label="Mensaje de bienvenida" helper="Se envia o reutiliza al momento del alta o desembolso.">
                <div className="space-y-2">
                  <textarea
                    ref={welcomeTextareaRef}
                    className={textareaClassName}
                    value={configForm.whatsappWelcomeTemplate}
                    onFocus={() => setActiveWhatsappField('welcome')}
                    onChange={event => setConfigForm(current => ({ ...current, whatsappWelcomeTemplate: event.target.value.slice(0, 360) }))}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault();
                      const token = event.dataTransfer.getData('text/plain');
                      if (token) insertWhatsappToken(token, 'welcome');
                    }}
                    placeholder={whatsappDefaults.welcome}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => applyWhatsappExample('welcome')} className={`inline-flex h-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                      Usar ejemplo
                    </button>
                    <span className="text-[12px] font-semibold text-[#94A3B8]">{configForm.whatsappWelcomeTemplate.length}/360</span>
                  </div>
                </div>
              </Field>
              <Field label="Mensaje de recibo" helper="Confirma el pago y resume la operacion realizada.">
                <div className="space-y-2">
                  <textarea
                    ref={receiptTextareaRef}
                    className={textareaClassName}
                    value={configForm.whatsappReceiptTemplate}
                    onFocus={() => setActiveWhatsappField('receipt')}
                    onChange={event => setConfigForm(current => ({ ...current, whatsappReceiptTemplate: event.target.value.slice(0, 360) }))}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault();
                      const token = event.dataTransfer.getData('text/plain');
                      if (token) insertWhatsappToken(token, 'receipt');
                    }}
                    placeholder={whatsappDefaults.receipt}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => applyWhatsappExample('receipt')} className={`inline-flex h-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                      Usar ejemplo
                    </button>
                    <span className="text-[12px] font-semibold text-[#94A3B8]">{configForm.whatsappReceiptTemplate.length}/360</span>
                  </div>
                </div>
              </Field>
            </div>
          </Panel>
          <div className="space-y-6">
            <KpiCard title="Plantillas listas" value={`${whatsappReady}/2`} helper="Mensajes completados" tone="green" icon={MessageCircle} participation="Mensajeria" />
            <Panel title="Sugerencias inteligentes" description="Haz clic o arrastra un shortcode al mensaje activo.">
              <div className="space-y-5">
                <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
                  <p className="text-[13px] font-semibold text-[#64748B]">Campo activo</p>
                  <p className="mt-2 text-[16px] font-bold text-[#111827]">
                    {activeWhatsappField === 'welcome' ? 'Mensaje de bienvenida' : 'Mensaje de recibo'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {whatsappShortcodes.map(token => (
                    <button
                      key={token}
                      type="button"
                      draggable
                      onDragStart={event => event.dataTransfer.setData('text/plain', token)}
                      onClick={() => insertWhatsappToken(token)}
                      className="inline-flex rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-2 text-[13px] font-semibold text-[#2563EB] transition-all duration-200 hover:translate-x-1 hover:border-[#93C5FD] hover:bg-[#DBEAFE]"
                    >
                      {token}
                    </button>
                  ))}
                </div>
                <div className="rounded-[24px] border border-[#E5E7EB] p-4">
                  <p className="text-[13px] font-semibold text-[#64748B]">Buenas practicas</p>
                  <ul className="mt-3 space-y-2 text-[14px] font-medium leading-6 text-[#64748B]">
                    <li>Usa mensajes cortos, claros y con tono profesional.</li>
                    <li>Incluye siempre monto, fecha o recibo cuando aplique.</li>
                    <li>Evita abreviaturas confusas y promesas no verificadas.</li>
                  </ul>
                </div>
              </div>
            </Panel>
          </div>
        </section>
      </SectionShell>
    );
  }

  if (activeSubview === 'branches') {
    return (
      <SectionShell
        eyebrow="Configuracion"
        title="Sucursales y cobertura"
        description="Administra oficinas, metas mensuales, responsables y activos visuales de cada punto operativo."
        actions={
          <>
            <ActionButton label="Volver al resumen" icon={<ChevronLeft size={18} />} onClick={() => navigate('/settings')} />
            <button
              type="submit"
              form="branch-settings-form"
              disabled={!editingBranch && !canCreateResource(currentUser.companyId, 'BRANCH')}
              className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRight size={18} />
              {editingBranch ? 'Actualizar sucursal' : 'Crear sucursal'}
            </button>
          </>
        }
      >
        <SettingsKpiGrid
          branchesCount={branches.length}
          branchMonthlyGoal={branchMonthlyGoal}
          defaultMoraAmount={configForm.defaultMoraAmount}
          graceDays={configForm.graceDays}
          whatsappReady={whatsappReady}
        />
        <SubviewTabs activeSubview={activeSubview} onNavigate={navigate} canManageSettings={canManageSettings} />
        {sessionModeBanner}
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title={editingBranch ? 'Editar sucursal' : 'Nueva sucursal'} description="Usa el mismo estándar operativo para todas las oficinas.">
            <form id="branch-settings-form" onSubmit={handleAddBranch} className="space-y-5">
              <div className="flex justify-center">
                <div className="relative">
                  <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-[24px] border-4 ${branchForm.logo ? 'border-[#2563EB] bg-white' : 'border-[#E5E7EB] bg-[#FCFDFF]'}`}>
                    {branchForm.logo ? <img src={branchForm.logo} alt="Sucursal" className="h-full w-full object-cover" /> : <ImageIcon size={34} className="text-[#CBD5E1]" />}
                  </div>
                  <label className="absolute bottom-0 right-0 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition-all duration-200 hover:translate-x-1">
                    <Camera size={15} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleBranchLogoUpload} />
                  </label>
                </div>
              </div>
              <Field label="Nombre de sucursal">
                <input required className={inputClassName} value={branchForm.name} onChange={event => setBranchForm(current => ({ ...current, name: cleanTextInput(event.target.value) }))} placeholder="Ej: Central Santo Domingo" />
              </Field>
              <Field label="Direccion">
                <input required className={inputClassName} value={branchForm.address} onChange={event => setBranchForm(current => ({ ...current, address: cleanTextInput(event.target.value) }))} placeholder="Calle, sector y referencia" />
              </Field>
              <Field label="Gerente local">
                <input className={inputClassName} value={branchForm.managerName} onChange={event => setBranchForm(current => ({ ...current, managerName: cleanTextInput(event.target.value) }))} placeholder="Nombre del responsable" />
              </Field>
              <Field label="Telefono">
                <input className={inputClassName} value={branchForm.phone} onChange={event => setBranchForm(current => ({ ...current, phone: formatPhoneInput(event.target.value) }))} placeholder="809-000-0000" inputMode="numeric" />
              </Field>
              <Field label="Meta mensual RD$">
                <input type="number" min={0} className={inputClassName} value={branchForm.monthlyGoal} onChange={event => setBranchForm(current => ({ ...current, monthlyGoal: Math.max(0, Number(event.target.value)) }))} />
              </Field>
              <div className="flex gap-3">
                {editingBranch ? <ActionButton label="Cancelar" icon={<ChevronLeft size={18} />} onClick={resetBranchForm} /> : null}
                <button type="submit" disabled={!editingBranch && !canCreateResource(currentUser.companyId, 'BRANCH')} className="inline-flex h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60">
                  <ArrowRight size={18} />
                  {editingBranch ? 'Guardar sucursal' : 'Crear sucursal'}
                </button>
              </div>
            </form>
          </Panel>
          <Panel
            title="Sucursales registradas"
            description="Vista administrativa de oficinas visibles para esta empresa."
            action={(
              <div className="flex flex-wrap items-center gap-3 text-right">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5">
                  <span className="text-[13px] font-semibold text-[#475569]">{branches.length} registros</span>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E2E8F0]">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${branchUsageRatio * 100}%` }} />
                  </div>
                  <span className="text-[12px] font-semibold text-[#94A3B8]">{branchLimit}</span>
                </div>
                <span className="text-[13px] font-medium text-[#94A3B8]">{currentPlan ? `Plan ${currentPlan.name}` : 'Cobertura operativa'}</span>
              </div>
            )}
          >
            <div className="space-y-4">
              {branches.length ? (
                branches.map(branch => (
                  <article key={branch.id} className="rounded-[28px] border border-[#E5E7EB] bg-[#FCFDFF] p-5 transition-all duration-200 hover:border-[#DBEAFE] hover:bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-[20px] font-black tracking-tight text-[#111827]">{branch.name}</h3>
                        <p className="mt-2 flex items-center gap-2 text-[13px] font-medium text-[#64748B]">
                          <MapPin size={14} />
                          {branch.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBranchForm({
                              name: branch.name,
                              address: branch.address,
                              managerName: branch.managerName || '',
                              monthlyGoal: branch.monthlyGoal || 0,
                              phone: branch.phone || '',
                              logo: branch.logo || '',
                            });
                            setEditingBranch(branch);
                          }}
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#4B5563] ${horizontalMotionClass}`}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button type="button" onClick={() => void handleDeleteBranch(branch.id)} className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FECACA] bg-white text-[#DC2626] ${horizontalMotionClass}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <div className="rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Gerente</p>
                        <p className="mt-2 text-[15px] font-bold text-[#111827]">{branch.managerName || 'Vacante'}</p>
                      </div>
                      <div className="rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Telefono</p>
                        <p className="mt-2 text-[15px] font-bold text-[#111827]">{branch.phone || 'Sin telefono'}</p>
                      </div>
                      <div className="rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Meta mensual</p>
                        <p className="mt-2 text-[15px] font-bold text-[#111827]">{formatCurrency(branch.monthlyGoal || 0)}</p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[28px] border border-dashed border-[#E5E7EB] bg-[#FCFDFF] px-6 py-10 text-center text-[13px] font-semibold text-[#94A3B8]">
                  No hay sucursales registradas todavia.
                </div>
              )}
            </div>
          </Panel>
        </section>
      </SectionShell>
    );
  }

  if (activeSubview === 'templates') {
    return (
      <PdfTemplateBuilder
        companyId={currentUser?.companyId || ''}
        onBack={() => navigate('/settings')}
      />
    );
  }

  return (
    <SectionShell
      eyebrow="Configuracion"
      title="Centro de configuracion"
      description="Controla identidad, reglas financieras, conducta, mensajeria y sucursales desde un solo modulo administrativo."
      actions={<ActionButton label="Ir a sucursales" icon={<Building size={18} />} onClick={() => navigate('/settings/branches')} primary />}
      isMainView={true}
    >
      <div data-settings-panel className="space-y-6 animate-[platform-fade-in_180ms_ease-out]">
        <SettingsKpiGrid
          branchesCount={branches.length}
          branchMonthlyGoal={branchMonthlyGoal}
          defaultMoraAmount={configForm.defaultMoraAmount}
          graceDays={configForm.graceDays}
          whatsappReady={whatsappReady}
        />
        <SubviewTabs activeSubview={activeSubview} onNavigate={navigate} canManageSettings={canManageSettings} />
        {sessionModeBanner}
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Areas de configuracion" description="Accede a las subvistas del modulo con el mismo patron del resto del sistema.">
            <div className="grid gap-4 md:grid-cols-2">
              {subviews.filter(item => item.id !== 'overview').map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="group rounded-[28px] border border-[#E5E7EB] bg-white p-5 text-left shadow-sm transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#FCFDFF]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                      <Icon size={18} />
                    </div>
                    <h3 className="mt-5 text-[20px] font-black tracking-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{item.label}</h3>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">
                      {item.id === 'identity' && 'Logotipo, nombre legal, RNC y activos de marca.'}
                      {item.id === 'collections' && 'Mora, dias de gracia y pie de recibo.'}
                      {item.id === 'scoring' && 'Umbrales de riesgo y conducta operativa.'}
                      {item.id === 'whatsapp' && 'Mensajes base para clientes y recibos.'}
                      {item.id === 'branches' && 'Sucursales, metas y responsables visibles.'}
                      {item.id === 'templates' && 'Diseñador de PDF con drag & drop y configuración visual.'}
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Estado actual" description="Lectura rapida de la empresa visible.">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Empresa</p>
                  <p className="mt-2 text-[18px] font-bold text-[#111827]">{company?.name || 'PrestaFacil RD'}</p>
                </div>
                <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Sucursal principal</p>
                  <p className="mt-2 text-[18px] font-bold text-[#111827]">{branches[0]?.name || 'Sede Principal'}</p>
                </div>
                <div className="rounded-[24px] border border-[#E5E7EB] px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Politica de mora</p>
                  <p className="mt-2 text-[18px] font-bold text-[#111827]">{getMoraTypeLabel(configForm.moraType)}</p>
                  <p className="mt-1 text-[13px] font-medium text-[#64748B]">{getMoraTypeSummary(configForm.moraType)}</p>
                </div>
              </div>
            </Panel>
            <Panel title="Acciones recomendadas" description="Proximo paso sugerido para completar el modulo.">
              <div className="space-y-3">
                <button type="button" onClick={() => navigate('/settings/identity')} className={`inline-flex h-12 w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                  Completar marca y RNC
                  <ArrowRight size={16} />
                </button>
                <button type="button" onClick={() => navigate('/settings/collections')} className={`inline-flex h-12 w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                  Revisar reglas de cobro
                  <ArrowRight size={16} />
                </button>
                <button type="button" onClick={() => navigate('/settings/branches')} className={`inline-flex h-12 w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                  Validar sucursales visibles
                  <ArrowRight size={16} />
                </button>
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </SectionShell>
  );
};

export { ConfigurationPage };
