import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  Building2,
  ChevronLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Filter,
  Lock,
  Printer,
  Search,
  ShieldAlert,
  Sparkles,
  StickyNote,
  User as UserIcon,
  Users2,
} from 'lucide-react';
import gsap from 'gsap';
import { getCompanyById, getGlobalActivity, getReportTemplates, upsertReportTemplatesInLocalStorage } from '../services/dataService';
import { getBranchScope, getScopedUsers } from '../services/viewScope';
import { ActivityEvent, ActivityType, Branch, ReportTemplate, Role, User } from '../types';
import { formatCurrency } from '../utils';
import { useAuth } from '../context/AuthContext';
import { apiClient, AuditLogItem } from '../services/apiClient';
import {
  buildPlatformPdfFileName,
  createPlatformPdfDoc,
  getPlatformPdfVisualPreset,
  platformPdfMarginByPreset,
  renderPlatformPdfDocument,
  resolvePlatformPdfTemplateConfig,
} from '../services/pdfBuilder';
import { getPersistedPdfTemplateId } from '../services/pdfTemplateSelection';
import { emitPlatformToast } from '../services/platformEvents';

const horizontalMotionClass =
  'transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

const typeLabels: Record<string, string> = {
  ALL: 'Todos los eventos',
  PAGO: 'Pagos',
  NOTA: 'Notas',
  PROMESA: 'Promesas',
  BLOQUEO: 'Bloqueos',
  PRESTAMO: 'Prestamos',
  USER_MGMT: 'Usuarios',
  APPROVAL: 'Aprobaciones',
  CONDUCTA: 'Conducta',
  ROUTE_CLOSE: 'Cierre de ruta',
  CASH_MOVE: 'Caja',
};

const periodLabels: Record<'HOY' | 'SEMANA' | 'TODO', string> = {
  HOY: 'Hoy',
  SEMANA: 'Semana',
  TODO: 'Todo',
};

const FEED_PAGE_SIZE = 12;

const getDateRange = (value: 'HOY' | 'SEMANA' | 'TODO') => {
  const now = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  if (value === 'HOY') return { startDate: iso(now), endDate: iso(now) };
  if (value === 'SEMANA') return { startDate: iso(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), endDate: iso(now) };
  return {};
};

const getTypeTone = (type: string) => {
  switch (type) {
    case 'PAGO':
      return {
        badge: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
        iconWrap: 'bg-[#DCFCE7] text-[#16A34A]',
        note: 'text-[#16A34A]',
        watermark: 'text-[#86EFAC]',
      };
    case 'PROMESA':
      return {
        badge: 'bg-[#FEF3C7] text-[#D97706] border-[#FCD34D]',
        iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]',
        note: 'text-[#D97706]',
        watermark: 'text-[#FDE68A]',
      };
    case 'BLOQUEO':
      return {
        badge: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
        iconWrap: 'bg-[#FEE2E2] text-[#DC2626]',
        note: 'text-[#DC2626]',
        watermark: 'text-[#FECACA]',
      };
    case 'PRESTAMO':
      return {
        badge: 'bg-[#EDE9FE] text-[#7C3AED] border-[#DDD6FE]',
        iconWrap: 'bg-[#EDE9FE] text-[#7C3AED]',
        note: 'text-[#7C3AED]',
        watermark: 'text-[#C4B5FD]',
      };
    default:
      return {
        badge: 'bg-[#DBEAFE] text-[#2563EB] border-[#BFDBFE]',
        iconWrap: 'bg-[#DBEAFE] text-[#2563EB]',
        note: 'text-[#2563EB]',
        watermark: 'text-[#BFDBFE]',
      };
  }
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'PAGO':
      return <Banknote size={18} />;
    case 'PROMESA':
      return <Clock3 size={18} />;
    case 'BLOQUEO':
      return <ShieldAlert size={18} />;
    case 'PRESTAMO':
      return <Sparkles size={18} />;
    default:
      return <StickyNote size={18} />;
  }
};

const translateEventTitle = (title: string) => {
  const normalized = title.trim().toLowerCase();

  if (normalized === 'login failed') return 'Inicio de sesion fallido';
  if (normalized === 'login success') return 'Inicio de sesion exitoso';
  if (normalized === 'logout') return 'Cierre de sesion';
  if (normalized === 'user invited') return 'Usuario invitado';
  if (normalized === 'user created') return 'Usuario creado';
  if (normalized === 'user updated') return 'Usuario actualizado';
  if (normalized === 'user suspended') return 'Usuario suspendido';
  if (normalized === 'user reactivated') return 'Usuario reactivado';

  return title;
};

const translateEventDescription = (description: string) =>
  description
    .replace(/login failed/gi, 'inicio de sesion fallido')
    .replace(/login success/gi, 'inicio de sesion exitoso')
    .replace(/logout/gi, 'cierre de sesion')
    .replace(/password reset/gi, 'restablecimiento de clave')
    .replace(/user invited/gi, 'usuario invitado')
    .replace(/user created/gi, 'usuario creado')
    .replace(/user updated/gi, 'usuario actualizado')
    .replace(/user suspended/gi, 'usuario suspendido')
    .replace(/user reactivated/gi, 'usuario reactivado');

const normalizeActivityEvent = (event: ActivityEvent): ActivityEvent => ({
  ...event,
  title: translateEventTitle(event.title),
  description: translateEventDescription(event.description),
});

const mapAuditToActivity = (item: AuditLogItem): ActivityEvent =>
  normalizeActivityEvent({
    id: item.id,
    companyId: item.companyId,
    type: item.activityType as ActivityType,
    timestamp: item.createdAt,
    userId: item.actorUserId,
    userName: item.actorName,
    title: item.title,
    description: item.description,
    clientId: item.entityType === 'client' ? item.entityId : undefined,
    clientName: item.entityType === 'client' ? String(item.metadata.clientName || '') : undefined,
    amount: typeof item.metadata.amount === 'number' ? item.metadata.amount : undefined,
  });

type FilterOption = {
  value: string;
  label: string;
};

const FilterDropdown = ({
  id,
  value,
  options,
  placeholder,
  disabled = false,
  isOpen,
  onChange,
  onToggle,
  onRequestClose,
}: {
  id: string;
  value: string;
  options: FilterOption[];
  placeholder: string;
  disabled?: boolean;
  isOpen: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  onRequestClose: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 260, placement: 'bottom' as 'top' | 'bottom' });

  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        onRequestClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onRequestClose]);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = Math.min(56 + options.length * 54, 320);
      const spacing = 10;
      const shouldOpenUp = window.innerHeight - rect.bottom < menuHeight + spacing && rect.top > menuHeight + spacing;
      const placement = shouldOpenUp ? 'top' : 'bottom';
      const top = shouldOpenUp ? rect.top - spacing : rect.bottom + spacing;
      setMenuPosition({
        top,
        left: rect.left,
        width: rect.width,
        placement,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, options.length]);

  return (
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-20'}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-[58px] w-full items-center gap-3 rounded-[20px] border bg-white px-5 text-left transition-all duration-200 ${
          disabled
            ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8]'
            : isOpen
              ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
              : 'border-[#D8E1F0] text-[#111827] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#111827]' : ''}`} />
      </button>

      {isOpen &&
        !disabled &&
        createPortal(
          <div
            id={`activity-filter-${id}`}
            ref={menuRef}
            onMouseDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}
            className="fixed z-[360] w-max max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: Math.max(menuPosition.width, 240),
              transform: menuPosition.placement === 'top' ? 'translateY(-100%)' : undefined,
            }}
          >
            {options.map(option => {
              const active = option.value === value;
              return (
                <button
                  key={`${option.value}-${option.label}`}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    onRequestClose();
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                    active ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                  }`}
                >
                  <span>{option.label}</span>
                  {active ? <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};

export const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>(() => getReportTemplates());
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPdfTemplateId, setSelectedPdfTemplateId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<ActivityType | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'HOY' | 'SEMANA' | 'TODO'>('TODO');
  const [isApiSource, setIsApiSource] = useState(false);
  const [openFilter, setOpenFilter] = useState<'type' | 'branch' | 'user' | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'summary' | 'operators' | 'alerts'>('feed');
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);
  const [feedPage, setFeedPage] = useState(1);

  const isCollector = currentUser?.role === Role.COBRADOR;
  const branchScope = useMemo(() => (currentUser ? getBranchScope(currentUser) : null), [currentUser]);
  const canSeeAllCompanyUsers = branchScope?.canSeeAllCompanyUsers || false;
  const company = useMemo(
    () => (currentUser ? getCompanyById(currentUser.companyId) : undefined),
    [currentUser],
  );


  useEffect(() => {
    gsap.fromTo('[data-activity-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
    gsap.fromTo('[data-activity-kpis]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.1 });
    gsap.fromTo('[data-activity-filters]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.16 });
    gsap.fromTo('[data-activity-content]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let allEvents = getGlobalActivity(currentUser.companyId);
    const companyUsers = getScopedUsers(currentUser);
    setBranches(branchScope?.branches || []);
    setSelectedBranchId(currentUser.branchId);

    const visibleUserIds = new Set(companyUsers.map(user => user.id));
    allEvents = allEvents.filter(event => !event.userId || visibleUserIds.has(event.userId));
    if (isCollector) allEvents = allEvents.filter(event => event.userId === currentUser.id);

    setEvents(allEvents.map(normalizeActivityEvent));
    setUsers(companyUsers);
  }, [branchScope, currentUser, isCollector]);

  useEffect(() => {
    if (!currentUser) return;
    apiClient
      .listAuditLogs({
        ...getDateRange(dateFilter),
        branchId: selectedBranchId || undefined,
        userId: selectedUserId || undefined,
        search: searchTerm || undefined,
      })
      .then(response => {
        setEvents(response.data.map(mapAuditToActivity));
        setIsApiSource(true);
      })
      .catch(() => setIsApiSource(false));
  }, [currentUser, dateFilter, searchTerm, selectedBranchId, selectedUserId]);

  useEffect(() => {
    if (!currentUser) return;
    apiClient
      .listReportTemplates()
      .then(response => {
        upsertReportTemplatesInLocalStorage(response.data);
        setReportTemplates(response.data);
      })
      .catch(() => setReportTemplates(getReportTemplates()));
  }, [currentUser]);

  const branchMap = useMemo(() => new Map(branches.map(branch => [branch.id, branch.name])), [branches]);
  const availablePdfTemplates = useMemo(
    () => reportTemplates.filter(template => template.status !== 'Archivada' && template.reportType && template.reportType.split(',').includes('ACTIVITY_HISTORY')),
    [reportTemplates],
  );
  const fallbackPdfTemplate = useMemo(
    () => availablePdfTemplates.find(template => template.isDefault) || availablePdfTemplates[0] || null,
    [availablePdfTemplates],
  );
  const activePdfTemplate = useMemo(
    () => availablePdfTemplates.find(template => template.id === selectedPdfTemplateId) || fallbackPdfTemplate,
    [availablePdfTemplates, fallbackPdfTemplate, selectedPdfTemplateId],
  );
  const activePdfTemplateConfig = useMemo(
    () =>
      resolvePlatformPdfTemplateConfig({
        visualPreset: activePdfTemplate?.config?.visualPreset || 'FACTURA_FINANCIERA',
        paperSize: activePdfTemplate?.config?.paperSize,
        orientation: activePdfTemplate?.config?.orientation,
        marginPreset: activePdfTemplate?.config?.marginPreset,
        documentStyle: activePdfTemplate?.config?.documentStyle,
      }),
    [activePdfTemplate],
  );
  const activePdfVisualPreset = useMemo(
    () => getPlatformPdfVisualPreset(activePdfTemplateConfig.visualPreset),
    [activePdfTemplateConfig.visualPreset],
  );

  useEffect(() => {
    if (!availablePdfTemplates.length) return;
    const persistedTemplateId = getPersistedPdfTemplateId(currentUser?.companyId);
    if (selectedPdfTemplateId && availablePdfTemplates.some(template => template.id === selectedPdfTemplateId)) return;
    setSelectedPdfTemplateId(
      availablePdfTemplates.find(template => template.id === persistedTemplateId)?.id ||
        fallbackPdfTemplate?.id ||
        availablePdfTemplates[0].id,
    );
  }, [availablePdfTemplates, currentUser?.companyId, fallbackPdfTemplate, selectedPdfTemplateId]);

  const filteredEvents = useMemo(() => {
    let result = [...events];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (dateFilter === 'HOY') {
      result = result.filter(event => new Date(event.timestamp).toDateString() === now.toDateString());
    } else if (dateFilter === 'SEMANA') {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(event => new Date(event.timestamp) >= lastWeek);
    }

    if (selectedBranchId) {
      const branchUserIds = new Set(users.filter(user => user.branchId === selectedBranchId).map(user => user.id));
      result = result.filter(event => !event.userId || branchUserIds.has(event.userId));
    }

    if (selectedUserId) result = result.filter(event => event.userId === selectedUserId);
    if (selectedType !== 'ALL') result = result.filter(event => event.type === selectedType);

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        event =>
          event.clientName?.toLowerCase().includes(lower) ||
          event.userName.toLowerCase().includes(lower) ||
          event.title.toLowerCase().includes(lower) ||
          event.description.toLowerCase().includes(lower),
      );
    }

    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [dateFilter, events, searchTerm, selectedBranchId, selectedType, selectedUserId, users]);

  const groupedEvents = useMemo(
    () =>
      filteredEvents.reduce((acc, event) => {
        const date = new Date(event.timestamp).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
      }, {} as Record<string, ActivityEvent[]>),
    [filteredEvents],
  );

  useEffect(() => {
    setFeedPage(1);
  }, [searchTerm, selectedType, selectedBranchId, selectedUserId, dateFilter, activeTab]);

  const totalFeedPages = Math.max(1, Math.ceil(filteredEvents.length / FEED_PAGE_SIZE));
  const currentFeedPage = Math.min(feedPage, totalFeedPages);
  const paginatedFeedEvents = useMemo(
    () =>
      filteredEvents.slice(
        (currentFeedPage - 1) * FEED_PAGE_SIZE,
        currentFeedPage * FEED_PAGE_SIZE,
      ),
    [currentFeedPage, filteredEvents],
  );
  const groupedFeedEvents = useMemo(
    () =>
      paginatedFeedEvents.reduce((acc, event) => {
        const date = new Date(event.timestamp).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
      }, {} as Record<string, ActivityEvent[]>),
    [paginatedFeedEvents],
  );
  const feedStart = filteredEvents.length ? (currentFeedPage - 1) * FEED_PAGE_SIZE + 1 : 0;
  const feedEnd = Math.min(currentFeedPage * FEED_PAGE_SIZE, filteredEvents.length);

  const metrics = useMemo(() => {
    const total = filteredEvents.length;
    const payments = filteredEvents.filter(event => event.type === 'PAGO').length;
    const promises = filteredEvents.filter(event => event.type === 'PROMESA').length;
    const blocks = filteredEvents.filter(event => event.type === 'BLOQUEO').length;
    const amount = filteredEvents.reduce((sum, event) => sum + (event.amount || 0), 0);
    return { total, payments, promises, blocks, amount };
  }, [filteredEvents]);

  const metricCards = [
    {
      label: isCollector ? 'Mis movimientos' : 'Eventos visibles',
      value: `${metrics.total}`,
      share: '100.0%',
      metaLabel: 'Participacion',
      helper: `${Object.keys(groupedEvents).length} jornadas visibles`,
      icon: Sparkles,
      iconWrap: 'bg-[#DBEAFE] text-[#2563EB]',
      note: 'text-[#2563EB]',
      watermark: 'text-[#BFDBFE]',
    },
    {
      label: 'Pagos registrados',
      value: `${metrics.payments}`,
      share: metrics.total > 0 ? `${((metrics.payments / metrics.total) * 100).toFixed(1)}%` : '0.0%',
      metaLabel: 'Participacion',
      helper: 'Cobros procesados en la lectura',
      icon: Banknote,
      iconWrap: 'bg-[#DCFCE7] text-[#16A34A]',
      note: 'text-[#16A34A]',
      watermark: 'text-[#86EFAC]',
    },
    {
      label: 'Promesas activas',
      value: `${metrics.promises}`,
      share: metrics.total > 0 ? `${((metrics.promises / metrics.total) * 100).toFixed(1)}%` : '0.0%',
      metaLabel: 'Participacion',
      helper: 'Seguimientos pendientes o vigentes',
      icon: Clock3,
      iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]',
      note: 'text-[#D97706]',
      watermark: 'text-[#FCD34D]',
    },
    {
      label: 'Impacto monetario',
      value: formatCurrency(metrics.amount),
      share: 'Monto',
      metaLabel: 'Lectura',
      helper: 'Total de eventos con valor asociado',
      icon: Building2,
      iconWrap: 'bg-[#EDE9FE] text-[#7C3AED]',
      note: 'text-[#7C3AED]',
      watermark: 'text-[#C4B5FD]',
    },
    {
      label: 'Bloqueos o alertas',
      value: `${metrics.blocks}`,
      share: metrics.total > 0 ? `${((metrics.blocks / metrics.total) * 100).toFixed(1)}%` : '0.0%',
      metaLabel: 'Participacion',
      helper: 'Eventos sensibles detectados',
      icon: ShieldAlert,
      iconWrap: 'bg-[#FEE2E2] text-[#DC2626]',
      note: 'text-[#DC2626]',
      watermark: 'text-[#FECACA]',
    },
  ];

  const topOperators = useMemo(() => {
    const counter = new Map<string, { name: string; count: number; branchId?: string }>();
    filteredEvents.forEach(event => {
      const user = users.find(item => item.id === event.userId);
      const current = counter.get(event.userName) || { name: event.userName, count: 0, branchId: user?.branchId };
      current.count += 1;
      counter.set(event.userName, current);
    });
    return [...counter.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredEvents, users]);

  const recentHighlights = useMemo(() => filteredEvents.slice(0, 4), [filteredEvents]);
  const typeOptions = useMemo<FilterOption[]>(
    () => Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
    [],
  );
  const branchOptions = useMemo<FilterOption[]>(
    () => [
      ...(canSeeAllCompanyUsers ? [{ value: '', label: 'Todas las sucursales' }] : []),
      ...branches.map(branch => ({ value: branch.id, label: branch.name })),
    ],
    [branches, canSeeAllCompanyUsers],
  );
  const userOptions = useMemo<FilterOption[]>(
    () => [
      ...(!isCollector ? [{ value: '', label: 'Todos los usuarios' }] : []),
      ...users.map(user => ({ value: user.id, label: user.name })),
    ],
    [isCollector, users],
  );

  const selectedEventOperator = useMemo(
    () => (selectedEvent ? users.find(user => user.id === selectedEvent.userId) : null),
    [selectedEvent, users],
  );
  const selectedEventBranchName = selectedEventOperator?.branchId
    ? branchMap.get(selectedEventOperator.branchId) || 'Sin sucursal'
    : 'Sin sucursal';

  const handleExportActivityPdf = () => {
    if (!currentUser) return;

    try {
      const activeBranch =
        branches.find(branch => branch.id === selectedBranchId) ||
        branches.find(branch => branch.id === currentUser.branchId);
      const templateLabel = activePdfTemplate?.name || activePdfVisualPreset.label;
      const companyName = company?.name || 'PrestaFacil RD';
      const companyLines = [
        activeBranch?.name || 'Sucursal principal',
        activeBranch?.address || 'Direccion institucional pendiente',
        company?.rnc ? `RNC: ${company.rnc}` : '',
      ].filter(Boolean);
      const activeUserName =
        selectedUserId ? users.find(user => user.id === selectedUserId)?.name || 'Usuario seleccionado' : 'Todos los usuarios';
      const activeBranchName = selectedBranchId ? branchMap.get(selectedBranchId) || 'Sin sucursal' : 'Todas las sucursales';
      const lineItems = filteredEvents.length
        ? filteredEvents.map((event, index) => ({
            description: event.title,
            detail: [
              event.description,
              event.clientName ? `Cliente: ${event.clientName}` : 'Sin cliente vinculado',
            ]
              .filter(Boolean)
              .join(' · '),
            quantity: `${index + 1}`,
            unit: typeLabels[event.type] || event.type,
            price: typeof event.amount === 'number' ? formatCurrency(event.amount) : '-',
            tax: new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: event.userName,
          }))
        : [
            {
              description: 'Sin actividad visible',
              detail: 'No hay eventos con los filtros actuales.',
              quantity: '-',
              unit: '-',
              price: '-',
              tax: '-',
              amount: '-',
            },
          ];

      const model: Parameters<typeof renderPlatformPdfDocument>[0]['model'] = {
        title: 'Historial de actividad',
        subtitle: 'Bitacora operativa consolidada para seguimiento, auditoria y trazabilidad institucional.',
        documentNumber: `ACT-${Date.now().toString().slice(-6)}`,
        issueDate: new Date().toLocaleDateString('es-DO'),
        dueDate: periodLabels[dateFilter],
        companyName,
        companyLogo: activeBranch?.logo || company?.logo,
        companyLines,
        seller: {
          title: 'Generado por',
          lines: [
            currentUser.name,
            activeBranch?.name || 'Sucursal principal',
            isApiSource ? 'Fuente API sincronizada' : 'Fuente local',
          ].filter(Boolean),
        },
        buyer: {
          title: 'Alcance del reporte',
          lines: [
            `Periodo: ${periodLabels[dateFilter]}`,
            `Sucursal: ${activeBranchName}`,
            `Usuario: ${activeUserName}`,
          ],
        },
        shipTo: {
          title: 'Lectura ejecutiva',
          lines: [
            `Eventos visibles: ${filteredEvents.length}`,
            `Pagos registrados: ${metrics.payments}`,
            `Promesas activas: ${metrics.promises}`,
            `Bloqueos detectados: ${metrics.blocks}`,
          ],
        },
        summaryTitle: 'Impacto monetario',
        summaryValue: formatCurrency(metrics.amount),
        summaryMeta: [`Plantilla ${templateLabel}`, `${Object.keys(groupedEvents).length} jornadas`, `${filteredEvents.length} eventos`],
        lineItems,
        totals: [
          { label: 'Eventos visibles', value: `${filteredEvents.length}` },
          { label: 'Pagos registrados', value: `${metrics.payments}` },
          { label: 'Promesas activas', value: `${metrics.promises}` },
          { label: 'Impacto monetario', value: formatCurrency(metrics.amount), emphasis: true },
        ],
        notesTitle: 'Notas del documento',
        notesLines: [
          'La bitacora exporta la lectura visible segun los filtros activos.',
          'Cuando el contenido supera una pagina, el detalle continua automaticamente en hojas siguientes.',
        ],
        footerNote: 'Documento emitido desde el modulo de actividad de PrestaFacil RD.',
        presetLabel: templateLabel,
      };

      const doc = createPlatformPdfDoc({
        paperSize: activePdfTemplateConfig.paperSize,
        orientation: activePdfTemplateConfig.orientation,
      });
      const left = platformPdfMarginByPreset[activePdfTemplateConfig.marginPreset] - 4;
      const top = 24;
      const right = doc.internal.pageSize.getWidth() - left;

      renderPlatformPdfDocument({
        doc,
        preset: activePdfVisualPreset,
        left,
        top,
        right,
        model,
      });

      doc.save(buildPlatformPdfFileName('actividad-operativa'));
      emitPlatformToast({
        title: 'PDF generado',
        message: `Actividad exportada con la plantilla ${templateLabel}.`,
        tone: 'success',
        durationMs: 3200,
      });
    } catch {
      emitPlatformToast({
        title: 'No se pudo exportar la actividad',
        message: 'Intenta nuevamente con los filtros actuales.',
        tone: 'error',
        durationMs: 4200,
      });
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <section data-activity-hero className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-black uppercase tracking-[0.34em] text-[#2563EB]">Actividad</p>
          <h1 className="mt-3 text-[46px] font-semibold leading-[0.98] tracking-[-0.04em] text-[#111827]">
            {isCollector ? 'Mi historial operativo' : 'Historial de actividad'}
          </h1>
          <p className="mt-5 max-w-[820px] text-[17px] font-medium leading-8 text-[#64748B]">
            Consolida eventos, cobros, promesas, bloqueos y movimientos recientes con una lectura clara del pulso operativo.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {!isCollector && (
            <button
              type="button"
              onClick={handleExportActivityPdf}
              className={`inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#DBEAFE] bg-[#2563EB] px-5 py-4 text-[15px] font-semibold text-white shadow-[0_22px_55px_rgba(37,99,235,0.26)] cursor-pointer ${horizontalMotionClass}`}
            >
              <Printer size={18} />
              Imprimir reporte
            </button>
          )}
        </div>
      </section>

      <section data-activity-kpis className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${card.iconWrap}`}>
                  <Icon size={22} />
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-black uppercase tracking-[0.26em] text-[#94A3B8]">{card.metaLabel}</p>
                  <p className="mt-1 text-[13px] font-bold text-[#0F172A]">{card.share}</p>
                </div>
              </div>
              <div className="mt-10 relative z-[1]">
                <p className="text-[14px] font-medium text-[#334155]">{card.label}</p>
                <p className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[#0F172A]">{card.value}</p>
                <p className={`mt-3 text-[14px] font-medium ${card.note}`}>{card.helper}</p>
              </div>
              <Icon
                size={78}
                strokeWidth={1.4}
                className={`pointer-events-none absolute bottom-4 right-4 ${card.watermark} opacity-35`}
              />
            </div>
          );
        })}
      </section>

      <section data-activity-filters className="rounded-[30px] border border-[#E2E8F0] bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_220px_220px_220px_210px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, operador o descripcion"
              className="h-[58px] w-full rounded-[20px] border border-[#D8E1F0] bg-white pl-14 pr-4 text-[15px] font-medium text-[#0F172A] outline-none transition-all focus:border-[#93C5FD] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]"
            />
          </label>

          <FilterDropdown
            id="type"
            value={selectedType}
            options={typeOptions}
            placeholder="Todos los eventos"
            isOpen={openFilter === 'type'}
            onToggle={() => setOpenFilter(current => (current === 'type' ? null : 'type'))}
            onRequestClose={() => setOpenFilter(null)}
            onChange={value => setSelectedType(value as ActivityType | 'ALL')}
          />

          <FilterDropdown
            id="branch"
            value={selectedBranchId}
            options={branchOptions}
            placeholder="Todas las sucursales"
            disabled={!canSeeAllCompanyUsers}
            isOpen={openFilter === 'branch'}
            onToggle={() => setOpenFilter(current => (current === 'branch' ? null : 'branch'))}
            onRequestClose={() => setOpenFilter(null)}
            onChange={setSelectedBranchId}
          />

          <FilterDropdown
            id="user"
            value={selectedUserId}
            options={userOptions}
            placeholder="Todos los usuarios"
            disabled={isCollector}
            isOpen={openFilter === 'user'}
            onToggle={() => setOpenFilter(current => (current === 'user' ? null : 'user'))}
            onRequestClose={() => setOpenFilter(null)}
            onChange={setSelectedUserId}
          />

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedType('ALL');
              setSelectedUserId('');
              setDateFilter('TODO');
              setSelectedBranchId(currentUser?.branchId || '');
            }}
            className={`inline-flex h-[58px] cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-[#D8E1F0] bg-white px-5 text-[15px] font-semibold text-[#0F172A] ${horizontalMotionClass}`}
          >
            <Filter size={16} />
            Limpiar filtros
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {[
            { id: 'HOY', label: 'Hoy' },
            { id: 'SEMANA', label: 'Semana' },
            { id: 'TODO', label: 'Todo' },
          ].map(option => {
            const active = dateFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDateFilter(option.id as 'HOY' | 'SEMANA' | 'TODO')}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all ${
                  active
                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <CalendarDays size={14} />
                {option.label}
              </button>
            );
          })}
          {isApiSource && (
            <span className="inline-flex items-center rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-[12px] font-semibold text-[#16A34A]">
              Fuente API activa
            </span>
          )}
        </div>
      </section>

      <section data-activity-content className="rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="border-b border-[#E2E8F0] px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-[#0F172A]">Bitacora operativa</h2>
              <p className="mt-2 text-[16px] font-medium leading-7 text-[#64748B]">
                Sigue el rastro de cobros, bloqueos, promesas y acciones administrativas con un formato compacto y mas claro.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full bg-[#F8FAFC] px-4 py-2 text-[13px] font-semibold text-[#64748B]">
                {filteredEvents.length} eventos visibles
              </div>
              <div className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-[13px] font-semibold text-[#64748B]">
                {Object.keys(groupedEvents).length} jornadas
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { id: 'feed', label: 'Bitacora', icon: StickyNote },
              { id: 'summary', label: 'Resumen', icon: Sparkles },
              { id: 'operators', label: 'Operadores', icon: Users2 },
              { id: 'alerts', label: 'Alertas', icon: Lock },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as 'feed' | 'summary' | 'operators' | 'alerts')}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition-all ${
                    active
                      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                      : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-6">
          {activeTab === 'feed' && (
            <div className="space-y-6">
              {Object.entries(groupedFeedEvents).length ? (
                Object.entries(groupedFeedEvents).map(([date, dayEvents]) => (
                  <section key={date} className="space-y-3">
                    <div className="inline-flex rounded-full border border-[#DBEAFE] bg-[#F8FAFC] px-4 py-2 text-[12px] font-black uppercase tracking-[0.26em] text-[#64748B]">
                      {new Date(date).toLocaleDateString('es-DO', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </div>

                    <div className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white">
                      <div className="grid grid-cols-[minmax(0,2.2fr)_1.2fr_1.2fr_1fr_1fr_1fr] gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
                        {['Evento', 'Operador', 'Cliente', 'Sucursal', 'Hora', 'Accion'].map(label => (
                          <p key={label} className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">
                            {label}
                          </p>
                        ))}
                      </div>

                      <div className="divide-y divide-[#E2E8F0]">
                        {dayEvents.map(event => {
                          const tone = getTypeTone(event.type);
                          const staff = users.find(user => user.id === event.userId);
                          const branchName = staff?.branchId ? branchMap.get(staff.branchId) : '';

                          return (
                            <article
                              key={event.id}
                              className="grid grid-cols-[minmax(0,2.2fr)_1.2fr_1.2fr_1fr_1fr_1fr] gap-4 px-5 py-5 transition-colors hover:bg-[#FBFDFF]"
                            >
                              <div className="min-w-0">
                                <div className="flex items-start gap-3">
                                  <div className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${tone.iconWrap}`}>
                                    {getEventIcon(event.type)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="break-words text-[16px] font-semibold leading-6 text-[#0F172A]">{event.title}</p>
                                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                                        {typeLabels[event.type] || event.type}
                                      </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-[14px] font-medium leading-6 text-[#64748B]">
                                      {event.description}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <p className="break-words text-[14px] font-semibold leading-6 text-[#0F172A]">{event.userName}</p>
                                <p className="mt-1 text-[13px] font-medium text-[#64748B]">
                                  {typeof event.amount === 'number' ? formatCurrency(event.amount) : 'Sin monto'}
                                </p>
                              </div>

                              <div className="min-w-0">
                                {event.clientName ? (
                                  <button
                                    type="button"
                                    onClick={() => event.clientId && navigate(`/clients/${event.clientId}`)}
                                    className="group flex w-full cursor-pointer items-start gap-2 text-left"
                                  >
                                    <span className="break-words text-[14px] font-semibold leading-6 text-[#0F172A] transition-colors group-hover:text-[#2563EB]">
                                      {event.clientName}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-[14px] font-medium text-[#94A3B8]">Sin cliente</span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="break-words text-[14px] font-semibold leading-6 text-[#0F172A]">{branchName || 'Sin sucursal'}</p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-[#0F172A]">
                                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>

                              <div className="flex items-center justify-start">
                                {event.clientId ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEvent(event)}
                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-[16px] border border-[#D8E1F0] bg-white px-3 py-2 text-[13px] font-semibold text-[#0F172A] ${horizontalMotionClass}`}
                                  >
                                    Ver detalle
                                    <ChevronRight size={15} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEvent(event)}
                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-[16px] border border-[#D8E1F0] bg-white px-3 py-2 text-[13px] font-semibold text-[#0F172A] ${horizontalMotionClass}`}
                                  >
                                    Ver detalle
                                    <ChevronRight size={15} />
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-[28px] border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-16 text-center">
                  <StickyNote size={42} className="mx-auto text-[#CBD5E1]" />
                  <h3 className="mt-5 text-[20px] font-semibold text-[#0F172A]">Sin actividad para esta lectura</h3>
                  <p className="mt-2 text-[15px] font-medium leading-7 text-[#64748B]">
                    Ajusta los filtros o espera nuevos eventos para poblar el historial operativo.
                  </p>
                </div>
              )}

              {filteredEvents.length > FEED_PAGE_SIZE && (
                <div className="flex flex-col gap-3 border-t border-[#E2E8F0] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[14px] font-medium text-[#64748B]">
                    Mostrando {feedStart} a {feedEnd} de {filteredEvents.length} eventos
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFeedPage(page => Math.max(1, page - 1))}
                      disabled={currentFeedPage === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E1F0] bg-white text-[#64748B] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="inline-flex min-w-[42px] items-center justify-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[13px] font-semibold text-[#2563EB]">
                      {currentFeedPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFeedPage(page => Math.min(totalFeedPages, page + 1))}
                      disabled={currentFeedPage === totalFeedPages}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E1F0] bg-white text-[#64748B] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6">
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0F172A]">Resumen operativo</h3>
                <p className="mt-2 text-[15px] font-medium leading-7 text-[#64748B]">Lectura corta de actividad, operadores y estado de la fuente actual.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[20px] border border-[#E2E8F0] px-4 py-4">
                    <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Fuente</p>
                    <p className="mt-2 text-[16px] font-semibold text-[#0F172A]">{isApiSource ? 'API sincronizada' : 'Lectura local'}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#E2E8F0] px-4 py-4">
                    <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Sucursal activa</p>
                    <p className="mt-2 text-[16px] font-semibold text-[#0F172A]">
                      {selectedBranchId ? branchMap.get(selectedBranchId) || 'Sin sucursal' : 'Todas las sucursales'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-[#E2E8F0] px-4 py-4">
                    <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Periodo</p>
                    <p className="mt-2 text-[16px] font-semibold text-[#0F172A]">{periodLabels[dateFilter]}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0F172A]">Actividad reciente</h3>
                    <p className="mt-2 text-[15px] font-medium leading-7 text-[#64748B]">
                      Lectura corta de los ultimos eventos visibles en la bitacora actual.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#64748B]">
                    {recentHighlights.length}
                  </span>
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-[#E2E8F0]">
                  <div className="grid grid-cols-[minmax(0,1.8fr)_1.1fr_120px] gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
                    {['Evento', 'Operador', 'Hora'].map(label => (
                      <p key={label} className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">
                        {label}
                      </p>
                    ))}
                  </div>

                  <div className="divide-y divide-[#E2E8F0]">
                    {recentHighlights.length ? (
                      recentHighlights.map(event => {
                        const tone = getTypeTone(event.type);
                        return (
                          <div key={event.id} className="grid grid-cols-[minmax(0,1.8fr)_1.1fr_120px] gap-4 px-5 py-4 transition-colors hover:bg-[#FBFDFF]">
                            <div className="min-w-0">
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${tone.iconWrap}`}>
                                  {getEventIcon(event.type)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[14px] font-semibold text-[#0F172A]">{event.title}</p>
                                  <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-6 text-[#64748B]">
                                    {event.description}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-[#0F172A]">{event.userName}</p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#94A3B8]">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex min-h-[140px] items-center justify-center px-6 py-10 text-center text-[14px] font-medium text-[#94A3B8]">
                        No hay eventos recientes.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'operators' && (
            <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0F172A]">Operadores visibles</h3>
                <Users2 size={18} className="text-[#94A3B8]" />
              </div>
              <div className={`mt-5 grid gap-4 ${topOperators.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {topOperators.length ? (
                  topOperators.map(operator => (
                    <div key={operator.name} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#E2E8F0] px-5 py-5">
                      <div>
                        <p className="text-[15px] font-semibold text-[#0F172A]">{operator.name}</p>
                        <p className="mt-1 text-[13px] font-medium text-[#64748B]">
                          {operator.branchId ? branchMap.get(operator.branchId) || 'Sin sucursal' : 'Sin sucursal'}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">{operator.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex min-h-[160px] items-center justify-center rounded-[22px] border border-dashed border-[#E2E8F0] px-4 py-10 text-center text-[14px] font-medium text-[#94A3B8]">
                    Aun no hay operadores con actividad.
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'alerts' && (
            <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0F172A]">Eventos sensibles</h3>
                <Lock size={18} className="text-[#94A3B8]" />
              </div>
              <div
                className={`mt-5 grid gap-4 ${
                  filteredEvents.filter(event => ['BLOQUEO', 'APPROVAL', 'CONDUCTA'].includes(event.type)).slice(0, 6).length > 1
                    ? 'lg:grid-cols-2'
                    : 'grid-cols-1'
                }`}
              >
                {filteredEvents.filter(event => ['BLOQUEO', 'APPROVAL', 'CONDUCTA'].includes(event.type)).slice(0, 6).map(event => (
                  <div key={event.id} className="rounded-[22px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-5">
                    <p className="text-[15px] font-semibold text-[#B91C1C]">{event.title}</p>
                    <p className="mt-2 text-[13px] font-medium leading-6 text-[#991B1B]">{event.description}</p>
                    <p className="mt-3 text-[12px] font-semibold text-[#B91C1C]/80">{event.userName}</p>
                  </div>
                ))}
                {!filteredEvents.some(event => ['BLOQUEO', 'APPROVAL', 'CONDUCTA'].includes(event.type)) && (
                  <div className="flex min-h-[160px] items-center justify-center rounded-[22px] border border-dashed border-[#E2E8F0] px-4 py-10 text-center text-[14px] font-medium text-[#94A3B8]">
                    No hay alertas criticas en este rango.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </section>

      {selectedEvent && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-[#0F172A]/55 px-4 py-8 backdrop-blur-sm animate-[platform-fade-in_180ms_ease-out]">
          <div className="relative w-full max-w-[860px] overflow-hidden rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] animate-[platform-modal-in_220ms_ease-out]">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="absolute right-6 top-6 flex h-12 w-12 cursor-pointer items-center justify-center rounded-[18px] border border-[#E2E8F0] bg-white text-[#94A3B8] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
            >
              <span className="text-[24px] leading-none">×</span>
            </button>

            <div className="border-b border-[#E2E8F0] px-8 py-8 text-center">
              <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] ${getTypeTone(selectedEvent.type).iconWrap}`}>
                {React.cloneElement(getEventIcon(selectedEvent.type), { size: 34 })}
              </div>
              <p className="mt-6 text-[12px] font-black uppercase tracking-[0.34em] text-[#94A3B8]">Evento operativo</p>
              <h3 className="mt-3 text-[32px] font-semibold tracking-[-0.03em] text-[#0F172A]">{selectedEvent.title}</h3>
              <p className="mx-auto mt-3 max-w-[620px] text-[16px] font-medium leading-7 text-[#64748B]">{selectedEvent.description}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <span className={`inline-flex rounded-full border px-4 py-2 text-[14px] font-semibold ${getTypeTone(selectedEvent.type).badge}`}>
                  {typeLabels[selectedEvent.type] || selectedEvent.type}
                </span>
                <span className="inline-flex rounded-full border border-[#D8E1F0] bg-[#F8FAFC] px-4 py-2 text-[14px] font-semibold text-[#64748B]">
                  {new Date(selectedEvent.timestamp).toLocaleString([], {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <div className="px-8 py-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-5">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Operador</p>
                  <p className="mt-3 text-[18px] font-semibold text-[#0F172A]">{selectedEvent.userName}</p>
                  <p className="mt-1 text-[14px] font-medium text-[#64748B]">{selectedEventBranchName}</p>
                </div>

                <div className="rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-5">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Impacto</p>
                  <p className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[#0F172A]">
                    {typeof selectedEvent.amount === 'number' ? formatCurrency(selectedEvent.amount) : 'Sin monto'}
                  </p>
                  <p className="mt-1 text-[14px] font-medium text-[#64748B]">Valor asociado al evento</p>
                </div>

                <div className="rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-5">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Cliente vinculado</p>
                  <p className="mt-3 text-[18px] font-semibold text-[#0F172A]">{selectedEvent.clientName || 'Sin cliente vinculado'}</p>
                </div>

                <div className="rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-5">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Hora del evento</p>
                  <p className="mt-3 text-[18px] font-semibold text-[#0F172A]">
                    {new Date(selectedEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="rounded-[24px] border border-[#E2E8F0] bg-[#FBFCFE] px-5 py-5 md:col-span-2 xl:col-span-2">
                  <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">Descripcion completa</p>
                  <p className="mt-3 text-[15px] font-medium leading-7 text-[#475569]">{selectedEvent.description}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E2E8F0] px-8 py-6">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className={`inline-flex min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-[#D8E1F0] bg-white px-6 py-4 text-[15px] font-semibold text-[#0F172A] ${horizontalMotionClass}`}
                >
                  <span className="text-[18px] leading-none">×</span>
                  Cerrar detalle
                </button>

                {selectedEvent.clientId ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/clients/${selectedEvent.clientId}`);
                      setSelectedEvent(null);
                    }}
                    className={`inline-flex min-w-[220px] cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-[#DBEAFE] bg-[#2563EB] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_20px_45px_rgba(37,99,235,0.22)] ${horizontalMotionClass}`}
                  >
                    <UserIcon size={16} />
                    Abrir cliente
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

