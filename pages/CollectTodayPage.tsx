import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bike,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  History,
  Map as MapIcon,
  MapPin,
  Navigation,
  Plus,
  Route as RouteIcon,
  Search,
  Target,
  UserCheck,
  Users,
  Wallet,
  X,
  MoreVertical,
} from 'lucide-react';
import {
  closeRoute,
  createRoute,
  getClientById,
  getClientPromises,
  getPendingInstallmentsForRoute,
  getRoutes,
  updateRouteItem,
  updateRouteStatus,
  upsertClientsInLocalStorage,
  upsertLoansInLocalStorage,
  upsertRoutesInLocalStorage,
} from '../services/dataService';
import { getBranchScope, getScopedUsers } from '../services/viewScope';
import { Branch, CollectionRoute, Role, RouteItem, RouteStatus, User } from '../types';
import { PlatformDateField } from '../components/ui/PlatformDateField';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils';
import { CollectionModal } from '../components/CollectionModal';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import { Badge } from '../components/ui/Badge';
import { ClientAvatar } from '../components/ui/ClientAvatar';
import { openPlatformCriticalModal } from '../services/platformEvents';

const horizontalMotionClass =
  'transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';
const verticalMotionClass =
  'transition-all duration-200 hover:-translate-y-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

type QueueRow = {
  key: string;
  routeId?: string;
  itemId?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  address: string;
  amount: number;
  dueDate?: string;
  collectorId?: string;
  collectorName: string;
  routeStatus?: RouteStatus;
  visitStatus: RouteItem['visitStatus'];
  isMora: boolean;
  source: 'SIN_RUTA' | 'RUTA';
};

const kpiToneMap = {
  blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]', watermark: 'text-[#DBEAFE]' },
  emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]', watermark: 'text-[#DCFCE7]' },
  red: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', note: 'text-[#DC2626]', watermark: 'text-[#FEE2E2]' },
  amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]', watermark: 'text-[#FEF3C7]' },
};

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'OPEN', label: 'Ruta abierta' },
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'PAID', label: 'Cobrado' },
  { value: 'FAILED', label: 'No pago' },
  { value: 'VISITED', label: 'Visitado' },
  { value: 'MORA', label: 'En mora' },
];

const pageSize = 10;

export const CollectTodayPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [routes, setRoutes] = useState<CollectionRoute[]>([]);
  const [collectors, setCollectors] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCollectorFilter, setSelectedCollectorFilter] = useState(() =>
    currentUser?.role === Role.COBRADOR ? currentUser.id : ''
  );
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState<RouteItem | null>(null);
  const [settlementRoute, setSettlementRoute] = useState<CollectionRoute | null>(null);
  const [cashInHand, setCashInHand] = useState(0);
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingInstallments, setPendingInstallments] = useState<any[]>([]);
  const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);
  const [activeDropdownRowKey, setActiveDropdownRowKey] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [focusStateApplied, setFocusStateApplied] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownRowKey(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const isCollector = currentUser?.role === Role.COBRADOR;
  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const canSeeAllCompanyUsers = branchScope.canSeeAllCompanyUsers;

  useEffect(() => {
    if (!currentUser) return;
    setSelectedBranchId(currentUser.branchId);
    setBranches(branchScope.branches);
  }, [branchScope, currentUser]);

  useEffect(() => {
    void loadBaseData();
  }, [currentUser?.companyId, currentUser?.branchId, selectedBranchId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranchId, selectedCollectorFilter, selectedStatus]);

  useEffect(() => {
    if (!pageRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo('[data-collect-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(
        '[data-collect-kpi]',
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.46, ease: 'power3.out', stagger: 0.05, delay: 0.02 },
      );
      gsap.fromTo('[data-collect-filter]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out', delay: 0.08 });
      gsap.fromTo('[data-collect-panel]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.46, ease: 'power3.out', delay: 0.14 });
      gsap.fromTo(
        '[data-collect-row]',
        { opacity: 0, x: -14 },
        { opacity: 1, x: 0, duration: 0.32, ease: 'power2.out', stagger: 0.025, delay: 0.2 },
      );
    }, pageRef);

    return () => ctx.revert();
  }, []);

  const loadBaseData = async () => {
    if (!currentUser) return;
    const activeBranchId = selectedBranchId || currentUser.branchId;
    let list = getRoutes(currentUser.companyId, activeBranchId);

    try {
      const [routesResponse, clientsResponse, loansResponse] = await Promise.all([
        apiClient.listRoutes(),
        apiClient.listClients(),
        apiClient.listLoans(),
      ]);
      upsertRoutesInLocalStorage(routesResponse.data);
      upsertClientsInLocalStorage(clientsResponse.data);
      upsertLoansInLocalStorage(loansResponse.data);
      list = routesResponse.data.filter(
        route => route.companyId === currentUser.companyId && (!activeBranchId || route.branchId === activeBranchId),
      );
    } catch {
      list = getRoutes(currentUser.companyId, activeBranchId);
    }

    if (currentUser.role === Role.COBRADOR) {
      list = list.filter(route => route.collectorId === currentUser.id);
    }

    setRoutes(list);
    const scopedUsers = getScopedUsers(currentUser, activeBranchId).filter(user => user.role === Role.COBRADOR && user.isActive);
    setCollectors(
      canSeeAllCompanyUsers
        ? scopedUsers.filter(user => user.branchId === activeBranchId)
        : scopedUsers.filter(user => user.branchId === currentUser.branchId),
    );

    let rawPending = getPendingInstallmentsForRoute(currentUser.companyId, activeBranchId);
    if (currentUser.role === Role.COBRADOR) {
      rawPending = rawPending.filter(item => {
        const cl = getClientById(item.clientId);
        return cl?.assignedUserId === currentUser.id;
      });
    }
    setPendingInstallments(rawPending);

    if (currentUser.role === Role.COBRADOR) {
      const active = list.find(route => route.collectorId === currentUser.id && route.status === RouteStatus.IN_PROGRESS);
      if (active) setActiveRouteId(active.id);
    }
  };

  const handleStartRoute = async (id: string) => {
    try {
      const route = await apiClient.updateRouteStatus(id, RouteStatus.IN_PROGRESS);
      upsertRoutesInLocalStorage([route.data]);
    } catch {
      updateRouteStatus(id, RouteStatus.IN_PROGRESS);
    }
    setActiveRouteId(id);
    void loadBaseData();
  };

  const handleCloseRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementRoute || isCollector) return;
    try {
      const route = await apiClient.closeRoute(settlementRoute.id, cashInHand);
      upsertRoutesInLocalStorage([route.data]);
    } catch {
      closeRoute(settlementRoute.id, cashInHand, currentUser!);
    }
    setSettlementRoute(null);
    setCashInHand(0);
    void loadBaseData();
  };

  const handleUpdateVisitResult = async (
    routeId: string,
    itemId: string,
    result: RouteItem['visitResult'],
    visitStatus: RouteItem['visitStatus'],
  ) => {
    try {
      await apiClient.updateRouteItem(routeId, itemId, { visitResult: result, visitStatus });
      const routesResponse = await apiClient.listRoutes();
      upsertRoutesInLocalStorage(routesResponse.data);
    } catch {
      updateRouteItem(routeId, itemId, { visitResult: result, visitStatus });
    }
    void loadBaseData();
  };

  const requestVisitConfirmation = (routeId: string, item: RouteItem | { id: string; clientName: string; amountToCollect: number }) => {
    openPlatformCriticalModal({
      id: `collect-today-visit-${item.id}`,
      title: '¿Registrar visita sin cobro?',
      description: 'La parada quedara marcada como visitada y se reflejara en el seguimiento operativo del recorrido.',
      tone: 'info',
      confirmLabel: 'Registrar visita',
      cancelLabel: 'Cancelar',
      highlights: [
        { label: 'Cliente', value: item.clientName },
        { label: 'Monto pendiente', value: formatCurrency(item.amountToCollect) },
        { label: 'Resultado', value: 'No estaba', tone: 'warning' },
      ],
      onConfirm: () => handleUpdateVisitResult(routeId, item.id, 'NO ESTABA', 'VISITED'),
    });
  };

  const requestNoPayConfirmation = (routeId: string, item: RouteItem | { id: string; clientName: string; amountToCollect: number }) => {
    openPlatformCriticalModal({
      id: `collect-today-no-pay-${item.id}`,
      title: '¿Marcar esta parada como no pago?',
      description: 'La cuenta quedara registrada como no pagada dentro del recorrido actual para seguimiento posterior.',
      tone: 'danger',
      confirmLabel: 'Marcar no pago',
      cancelLabel: 'Seguir revisando',
      highlights: [
        { label: 'Cliente', value: item.clientName },
        { label: 'Monto pendiente', value: formatCurrency(item.amountToCollect) },
        { label: 'Estado nuevo', value: 'No pago', tone: 'danger' },
      ],
      onConfirm: () => handleUpdateVisitResult(routeId, item.id, 'NO PAGÓ', 'FAILED'),
    });
  };

  const toggleInstallment = (id: string) => {
    setSelectedInstallments(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const handleGenerateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (isCollector || !selectedCollectorId || selectedInstallments.length === 0) return;

    const itemsToSave: RouteItem[] = selectedInstallments.map((installmentId, index) => {
      const data = pendingInstallments.find(pending => pending.installmentId === installmentId);
      return {
        id: crypto.randomUUID(),
        loanId: data.loanId,
        installmentId: data.installmentId,
        clientId: data.clientId,
        clientName: data.clientName,
        address: data.address,
        amountToCollect: data.amountToCollect,
        order: index + 1,
        visitStatus: 'PENDING',
      };
    });

    const payload = {
      branchId: selectedBranchId || currentUser.branchId,
      collectorId: selectedCollectorId,
      date: routeDate,
      items: itemsToSave,
    };

    try {
      const route = await apiClient.createRoute(payload);
      upsertRoutesInLocalStorage([route.data]);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        createRoute(payload, currentUser!);
      } else if (error instanceof ApiRequestError) {
        setFormError(error.message);
        return;
      } else {
        setFormError(error instanceof Error ? error.message : 'No se pudo crear la ruta.');
        return;
      }
    }

    setIsModalOpen(false);
    resetForm();
    void loadBaseData();
  };

  const resetForm = () => {
    setSelectedCollectorId('');
    setSelectedInstallments([]);
    setRouteDate(new Date().toISOString().split('T')[0]);
  };

  const resetFilters = () => {
    setSelectedBranchId(canSeeAllCompanyUsers ? '' : currentUser.branchId);
    setSelectedCollectorFilter(currentUser?.role === Role.COBRADOR ? currentUser.id : '');
    setSelectedStatus('');
    setSearchTerm('');
  };

  const activeRouteData = useMemo(() => routes.find(route => route.id === activeRouteId), [activeRouteId, routes]);
  const historyRoutes = useMemo(() => routes.filter(route => route.status === RouteStatus.CLOSED), [routes]);
  const activeBranch = useMemo(() => branches.find(branch => branch.id === selectedBranchId), [branches, selectedBranchId]);
  const openRoutes = useMemo(
    () =>
      routes
        .map((route, index) => ({ route, originalIndex: index }))
        .filter(entry => entry.route.status !== RouteStatus.CLOSED)
        .sort((a, b) => {
          const dateDelta = new Date(b.route.date).getTime() - new Date(a.route.date).getTime();
          return dateDelta !== 0 ? dateDelta : b.originalIndex - a.originalIndex;
        })
        .map(entry => entry.route),
    [routes],
  );

  const queueRows = useMemo<QueueRow[]>(() => {
    const routeRows = openRoutes.flatMap(route => {
      const collector = collectors.find(user => user.id === route.collectorId);
      return route.items.map(item => {
        const client = getClientById(item.clientId);
        return {
          key: `${route.id}-${item.id}`,
          routeId: route.id,
          itemId: item.id,
          clientId: item.clientId,
          clientName: item.clientName,
          clientPhone: client?.phone || 'Sin telefono',
          address: item.address,
          amount: item.amountToCollect,
          dueDate: route.date,
          collectorId: route.collectorId,
          collectorName: collector?.name || 'Cobrador asignado',
          routeStatus: route.status,
          visitStatus: item.visitStatus,
          isMora: new Date(route.date) < new Date(new Date().toISOString().slice(0, 10)),
          source: 'RUTA' as const,
        };
      });
    });

    const pendingRows = pendingInstallments.map(item => {
      const client = getClientById(item.clientId);
      return {
        key: item.installmentId,
        clientId: item.clientId,
        clientName: item.clientName,
        clientPhone: client?.phone || 'Sin telefono',
        address: item.address,
        amount: item.amountToCollect,
        dueDate: item.dueDate,
        collectorName: 'Sin asignar',
        visitStatus: 'PENDING' as const,
        isMora: item.isMora,
        source: 'SIN_RUTA' as const,
      };
    });

    return [...routeRows, ...pendingRows];
  }, [collectors, openRoutes, pendingInstallments]);

  const filteredQueueRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return queueRows.filter(row => {
      if (selectedCollectorFilter && row.collectorId !== selectedCollectorFilter) return false;
      if (selectedStatus) {
        if (selectedStatus === 'MORA' && !row.isMora) return false;
        else if (selectedStatus === 'OPEN' && row.routeStatus !== RouteStatus.OPEN) return false;
        else if (selectedStatus === 'IN_PROGRESS' && row.routeStatus !== RouteStatus.IN_PROGRESS) return false;
        else if (!['MORA', 'OPEN', 'IN_PROGRESS'].includes(selectedStatus) && row.visitStatus !== selectedStatus) return false;
      }
      if (!query) return true;
      const haystack = [row.clientName, row.clientPhone, row.address, row.collectorName].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [queueRows, searchTerm, selectedCollectorFilter, selectedStatus]);

  useEffect(() => {
    const routeState = (location.state || {}) as {
      focusClientId?: string;
      focusClientName?: string;
      openCollectionModal?: boolean;
    };

    if (focusStateApplied || !routeState.focusClientId || queueRows.length === 0) return;

    const clearFocusRouteState = () => {
      if (!location.state) return;
      navigate(location.pathname, { replace: true, state: null });
    };

    const targetRow = queueRows.find(row => row.clientId === routeState.focusClientId);
    if (!targetRow) {
      setFocusStateApplied(true);
      clearFocusRouteState();
      return;
    }

    setSearchTerm(targetRow.clientName || routeState.focusClientName || '');

    if (targetRow.routeId) {
      setActiveRouteId(targetRow.routeId);
      if (routeState.openCollectionModal && targetRow.itemId) {
        const route = routes.find(item => item.id === targetRow.routeId);
        const routeItem = route?.items.find(item => item.id === targetRow.itemId);
        if (routeItem) {
          setShowCollectionModal(routeItem);
        }
      }
    }

    setFocusStateApplied(true);
    clearFocusRouteState();
  }, [focusStateApplied, location.pathname, location.state, navigate, queueRows, routes]);

  const stats = useMemo(() => {
    const toCollectAmount = queueRows
      .filter(row => row.visitStatus === 'PENDING' || row.visitStatus === 'VISITED')
      .reduce((sum, row) => sum + row.amount, 0);
    const managedCount = queueRows.filter(row => row.visitStatus !== 'PENDING').length;
    const overdueCount = queueRows.filter(row => row.isMora).length;
    const collectedAmount = openRoutes.reduce(
      (sum, route) => sum + route.items.reduce((acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0),
      0,
    );

    return {
      toCollectAmount,
      managedCount,
      overdueCount,
      collectedAmount,
      activeRoutes: openRoutes.length,
      unassignedCount: pendingInstallments.length,
    };
  }, [openRoutes, pendingInstallments.length, queueRows]);

  const totalPages = Math.max(1, Math.ceil(filteredQueueRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedQueueRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredQueueRows.slice(start, start + pageSize);
  }, [filteredQueueRows, safeCurrentPage]);

  const visiblePages = useMemo(() => {
    let pages: number[];
    if (totalPages <= 5) {
      pages = Array.from({ length: totalPages }, (_, index) => index + 1);
    } else if (safeCurrentPage <= 3) {
      pages = [1, 2, 3, 4, totalPages];
    } else if (safeCurrentPage >= totalPages - 2) {
      pages = [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, totalPages];
    }

    return [...new Set(pages)].sort((a, b) => a - b);
  }, [safeCurrentPage, totalPages]);

  const kpis = [
    {
      label: 'Por cobrar hoy',
      value: formatCurrency(stats.toCollectAmount),
      helper: `${filteredQueueRows.filter(row => row.visitStatus === 'PENDING').length} cuentas pendientes`,
      share: queueRows.length > 0 ? Math.round((filteredQueueRows.filter(row => row.visitStatus === 'PENDING').length / queueRows.length) * 100) : 0,
      trend: `${Math.max(1, openRoutes.length)} rutas`,
      trendTone: 'text-[#2563EB]',
      icon: Wallet,
      tone: 'blue' as const,
    },
    {
      label: 'Cobrado en ruta',
      value: formatCurrency(stats.collectedAmount),
      helper: `${queueRows.filter(row => row.visitStatus === 'PAID').length} cobros registrados`,
      share: stats.toCollectAmount > 0 ? Math.round((stats.collectedAmount / (stats.toCollectAmount + stats.collectedAmount)) * 100) : 0,
      trend: `+${queueRows.filter(row => row.visitStatus === 'PAID').length}`,
      trendTone: 'text-[#16A34A]',
      icon: Banknote,
      tone: 'emerald' as const,
    },
    {
      label: 'Cuentas en mora',
      value: `${stats.overdueCount}`,
      helper: 'Requieren prioridad operativa',
      share: queueRows.length > 0 ? Math.round((stats.overdueCount / queueRows.length) * 100) : 0,
      trend: `${stats.overdueCount}`,
      trendTone: 'text-[#DC2626]',
      icon: AlertTriangle,
      tone: 'red' as const,
    },
    {
      label: 'Rutas activas',
      value: `${stats.activeRoutes}`,
      helper: `${queueRows.filter(row => row.routeStatus === RouteStatus.IN_PROGRESS).length} cuentas en ejecucion`,
      share: Math.min(100, stats.activeRoutes * 18),
      trend: `${queueRows.filter(row => row.routeStatus === RouteStatus.IN_PROGRESS).length}`,
      trendTone: 'text-[#2563EB]',
      icon: RouteIcon,
      tone: 'blue' as const,
    },
    {
      label: 'Sin asignar',
      value: `${stats.unassignedCount}`,
      helper: 'Pendientes de organizar en ruta',
      share: queueRows.length > 0 ? Math.round((stats.unassignedCount / queueRows.length) * 100) : 0,
      trend: `${stats.unassignedCount}`,
      trendTone: 'text-[#D97706]',
      icon: Users,
      tone: 'amber' as const,
    },
  ];

  if (!currentUser) return null;

  if (activeRouteId && activeRouteData) {
    const itemsLeft = activeRouteData.items.filter(item => item.visitStatus === 'PENDING');
    const collectedAmount = activeRouteData.items.reduce(
      (acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0),
      0,
    );
    const totalToCollect = activeRouteData.items.reduce((acc, item) => acc + item.amountToCollect, 0);

    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-24">
        <section className="overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[12px] font-semibold text-[#2563EB]">Ruta del {formatDate(activeRouteData.date)}</p>
              <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Cobrar Hoy</h1>
              <p className="mt-3 max-w-2xl text-[18px] font-medium text-[#64748B]">
                Jornada operativa en campo para registrar cobros, negativas y visitas del recorrido asignado.
              </p>
            </div>
            <button
              onClick={() => setActiveRouteId(null)}
              className={`inline-flex h-12 min-w-[148px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${horizontalMotionClass}`}
            >
              <ChevronLeft size={16} />
              Cerrar vista
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={`rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm ${verticalMotionClass}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-[#64748B]">Recaudado</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#16A34A]">
                <Banknote size={18} />
              </div>
            </div>
            <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{formatCurrency(collectedAmount)}</p>
            <p className="mt-2 text-[14px] font-medium text-[#16A34A]">Cobros aplicados en esta jornada</p>
          </div>
          <div className={`rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm ${verticalMotionClass}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-[#64748B]">Pendientes</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
                <CalendarClock size={18} />
              </div>
            </div>
            <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{itemsLeft.length}</p>
            <p className="mt-2 text-[14px] font-medium text-[#64748B]">Paradas por gestionar</p>
          </div>
          <div className={`rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm ${verticalMotionClass}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-[#64748B]">Avance de ruta</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
                <Target size={18} />
              </div>
            </div>
            <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#111827]">
              {totalToCollect > 0 ? Math.round((collectedAmount / totalToCollect) * 100) : 0}%
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all duration-700"
                style={{ width: `${totalToCollect > 0 ? (collectedAmount / totalToCollect) * 100 : 0}%` }}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between px-2">
            <div>
              <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">Paradas del recorrido</h2>
              <p className="mt-1 text-[15px] font-medium text-[#64748B]">Gestiona cobros, negativas y seguimiento de cada visita.</p>
            </div>
          </div>
          <div className="space-y-3">
            {[...activeRouteData.items].sort((a, b) => a.order - b.order).map(item => (
              <div
                key={item.id}
                id={`stop-${item.clientId}`}
                className={`rounded-[26px] border p-5 transition-all ${
                  item.visitStatus === 'PENDING'
                    ? 'border-[#E5E7EB] bg-white hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]'
                    : 'border-[#E5E7EB] bg-[#F8FAFC]'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[16px] font-black text-[#2563EB]">
                      {item.order}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[20px] font-semibold text-[#111827]">{item.clientName}</h3>
                      <p className="mt-1 text-[14px] font-medium text-[#64748B]">{item.address}</p>
                      <p className="mt-2 text-[15px] font-semibold text-[#111827]">Cobrar {formatCurrency(item.amountToCollect)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge status={item.visitStatus === 'PAID' ? 'Cobrado' : item.visitStatus === 'FAILED' ? 'No pago' : item.visitStatus === 'VISITED' ? 'Visitado' : 'Pendiente'} />
                    <button
                      onClick={() => navigate('/routes', { state: { trackingRouteId: activeRouteId, clientId: item.clientId } })}
                      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                    >
                      <Navigation size={16} />
                      Abrir mapa
                    </button>
                    <button
                      onClick={() => navigate(`/clients/${item.clientId}`)}
                      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                    >
                      <Eye size={16} />
                      Ver cliente
                    </button>
                  </div>
                </div>

                {item.visitStatus === 'PENDING' && (
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      onClick={() => setShowCollectionModal(item)}
                      className="inline-flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 text-[15px] font-semibold text-white shadow-[0_22px_44px_rgba(37,99,235,0.24)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#1D4ED8]"
                    >
                      <Banknote size={17} />
                      Registrar cobro
                    </button>
                    <button
                      onClick={() => requestVisitConfirmation(activeRouteId!, item)}
                      className={`inline-flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                    >
                      <UserCheck size={17} />
                      Registrar visita
                    </button>
                    <button
                      onClick={() => requestNoPayConfirmation(activeRouteId!, item)}
                      className="inline-flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#FECACA] bg-white px-5 text-[15px] font-semibold text-[#DC2626] transition-all duration-200 hover:translate-x-1 hover:bg-[#FEF2F2]"
                    >
                      <AlertTriangle size={17} />
                      No pago
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <button
          onClick={() => setActiveRouteId(null)}
          className="inline-flex h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-[22px] bg-[#111827] px-6 text-[15px] font-semibold text-white shadow-[0_24px_48px_rgba(15,23,42,0.16)] transition-all duration-200 hover:-translate-y-1 hover:bg-black"
        >
          <CheckCircle2 size={18} />
          Terminar recorrido
        </button>

        {showCollectionModal && (
          <CollectionModal
            paymentData={showCollectionModal}
            currentUser={currentUser}
            initialView="MAIN"
            onClose={() => setShowCollectionModal(null)}
            onSuccess={() => {
              handleUpdateVisitResult(activeRouteId, showCollectionModal.id, 'COBRÓ', 'PAID');
              setShowCollectionModal(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-6 pb-24 lg:pb-0">
      <section data-collect-hero>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Cobrar Hoy</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
              Vista operativa de cobros del dia por sucursal, cobrador, atraso y estado. Desde aqui organizamos cartera,
              despachamos rutas y supervisamos cierres.
            </p>
          </div>
          {!isCollector && (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                onClick={() => navigate('/routes?view=create')}
                className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
              >
                <Plus size={18} />
                Crear ruta
              </button>
              <button
                onClick={() => navigate('/cash')}
                className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]"
              >
                <Banknote size={18} />
                Ver caja
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          const tone = kpiToneMap[kpi.tone];
          return (
            <div
              key={kpi.label}
              data-collect-kpi
              className="relative overflow-hidden rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm"
            >
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${tone.iconWrap}`}>
                  <Icon size={24} />
                </div>
                <div className={`rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${kpi.trendTone}`}>
                  {kpi.trend}
                </div>
              </div>
              <div className="relative z-10 mt-8">
                <div className="flex items-start justify-between gap-4">
                  <p className="max-w-[150px] text-[14px] font-semibold text-[#111827]">{kpi.label}</p>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">Participacion</p>
                    <p className="mt-1 text-[15px] font-bold text-[#111827]">{kpi.share.toFixed(1)}%</p>
                  </div>
                </div>
                <p className="mt-4 text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{kpi.value}</p>
                <p className="mt-3 max-w-[185px] text-[15px] font-medium leading-6 text-[#6B7280]">{kpi.helper}</p>
              </div>
              <Icon size={72} className={`absolute bottom-4 right-4 ${tone.watermark} opacity-70`} strokeWidth={1.7} />
            </div>
          );
        })}
      </section>

      <section data-collect-filter className="relative z-30 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[210px_210px_210px_minmax(280px,1fr)_auto]">
          <FilterDropdown
            value={selectedBranchId}
            onChange={setSelectedBranchId}
            disabled={!canSeeAllCompanyUsers}
            placeholder={canSeeAllCompanyUsers ? 'Todas las sucursales' : 'Sucursal actual'}
            options={branches.map(branch => ({ value: branch.id, label: branch.name }))}
          />
          <FilterDropdown
            value={selectedCollectorFilter}
            onChange={setSelectedCollectorFilter}
            placeholder={isCollector ? currentUser.name : "Todos los cobradores"}
            disabled={isCollector}
            options={collectors.map(collector => ({ value: collector.id, label: collector.name }))}
          />
          <FilterDropdown
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="Todos los estados"
            options={statusOptions.filter(option => option.value).map(option => ({ value: option.value, label: option.label }))}
          />
          <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD]">
            <Search size={18} className="text-[#6B7280]" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, telefono, direccion o cobrador"
              className="w-full bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8]"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className={`inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${horizontalMotionClass}`}
          >
            <Filter size={18} />
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[2.1fr_0.7fr]">
        <article data-collect-panel className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">Cartera del dia</h2>
                <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[13px] font-semibold text-[#64748B]">
                  {filteredQueueRows.length} cuentas
                </span>
              </div>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">
                Seguimiento centralizado de cobros, asignaciones, visitas y cuentas en mora.
              </p>
            </div>
            <button
              onClick={() => navigate('/activity')}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
            >
              Ver actividad
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="w-full">
            <div className="grid grid-cols-[minmax(320px,2fr)_110px_100px_90px_90px_110px_100px] gap-4 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
              <span>Cliente</span>
              <span className="text-center">Cobrador</span>
              <span className="text-center">Monto</span>
              <span className="text-center">Atraso</span>
              <span className="text-center">Score</span>
              <span className="text-center">Estado</span>
              <span className="text-center">Acciones</span>
            </div>

            <div className="divide-y divide-[#EEF2F7]">
              {filteredQueueRows.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <MapIcon size={40} className="mx-auto text-[#CBD5E1]" />
                  <p className="mt-4 text-[16px] font-semibold text-[#64748B]">No hay cuentas para los filtros actuales.</p>
                </div>
              ) : (
                paginatedQueueRows.map(row => (
                  <div key={row.key} data-collect-row className="group px-4 py-3 transition-colors duration-200 hover:bg-[#FCFDFF]">
                    {(() => {
                      const client = getClientById(row.clientId);
                      const rating = client?.creditRating || 'REGULAR';
                      const ratingColor = rating === 'BUENA' ? 'text-[#16A34A] bg-[#DCFCE7]' : rating === 'MALA' ? 'text-[#DC2626] bg-[#FEE2E2]' : 'text-[#F59E0B] bg-[#FEF3C7]';
                      
                      // Cálculo de días de atraso
                      let delayDays = 0;
                      if (row.dueDate) {
                        const due = new Date(row.dueDate).getTime();
                        const today = new Date().setHours(0,0,0,0);
                        if (due < today) {
                          delayDays = Math.round((today - due) / (1000 * 60 * 60 * 24));
                        }
                      }

                      // Buscar promesas activas del cliente
                      const clientPromises = getClientPromises ? getClientPromises(row.clientId) : [];
                      const activePromise = clientPromises.find((p: any) => p.status === 'PENDIENTE');

                      const hasMultipleActions = row.routeId && row.visitStatus === 'PENDING' && (row.collectorId === currentUser.id || !isCollector);

                      return (
                    <div className="grid grid-cols-[minmax(320px,2fr)_110px_100px_90px_90px_110px_100px] items-center gap-4 rounded-[24px] px-2 py-2">
                      <div className="min-w-0 transition-transform duration-200 group-hover:translate-x-2">
                        <button
                          onClick={() => {
                            const stopEl = document.getElementById(`stop-${row.clientId}`);
                            if (stopEl) {
                              stopEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              // Resaltado visual con destello
                              stopEl.classList.add('!bg-yellow-50', 'border-yellow-300');
                              setTimeout(() => {
                                stopEl.classList.remove('!bg-yellow-50', 'border-yellow-300');
                              }, 1800);
                            } else {
                              navigate(`/clients/${row.clientId}`);
                            }
                          }}
                          className="flex min-w-0 items-center gap-3 text-left"
                        >
                          <ClientAvatar
                            client={client || { firstName: row.clientName, lastName: '', photo: '' }}
                            className="h-12 w-12 shrink-0 rounded-full shadow-[0_10px_22px_rgba(37,99,235,0.12)]"
                            textClassName="text-[16px] font-black text-[#2563EB]"
                          />
                          <div className="min-w-0">
                            <p className="break-words whitespace-normal line-clamp-2 text-[15px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">
                              {row.clientName}
                            </p>
                            {client?.nickname && (
                              <p className="text-[12px] font-medium italic text-[#2563EB]">
                                {client.nickname}
                              </p>
                            )}
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-medium text-[#64748B]">
                              <span>{row.clientPhone}</span>
                              {activePromise && (
                                <span className="rounded-md bg-[#EDE9FE] px-1.5 py-0.5 text-[10px] font-bold text-[#7C3AED]">
                                  Promesa
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-[#94A3B8]">
                              📍 {client?.address?.split(',')[1] || client?.address?.split(';')[0] || row.address || 'Sin sector'}
                            </p>
                          </div>
                        </button>
                      </div>

                      <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                        <p className="line-clamp-1 text-[13px] font-semibold text-[#111827]">{row.collectorName}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                          {row.source === 'SIN_RUTA'
                            ? 'Sin ruta'
                            : row.routeStatus === RouteStatus.IN_PROGRESS
                              ? 'En curso'
                              : 'Ruta abierta'}
                        </p>
                      </div>

                      <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                        <p className="text-[15px] font-bold text-[#111827]">{formatCurrency(row.amount)}</p>
                        <p className={`mt-0.5 text-[11px] font-medium ${row.source === 'SIN_RUTA' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
                          {row.source === 'SIN_RUTA' ? 'Sin asignar' : 'En ruta'}
                        </p>
                      </div>

                      <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                        {delayDays > 0 ? (
                          <span className="inline-flex rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-bold text-[#DC2626]">
                            {delayDays} días
                          </span>
                        ) : (
                          <span className="text-[12px] font-medium text-[#94A3B8]">Al día</span>
                        )}
                      </div>

                      <div className="flex justify-center transition-transform duration-200 group-hover:translate-x-2">
                        <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${ratingColor}`}>
                          {rating}
                        </span>
                      </div>

                      <div className="flex justify-center transition-transform duration-200 group-hover:translate-x-2">
                        <Badge
                          status={
                            row.visitStatus === 'PAID'
                              ? 'Cobrado'
                              : row.visitStatus === 'FAILED'
                                ? 'No pago'
                                : row.visitStatus === 'VISITED'
                                  ? 'Visitado'
                                  : row.isMora
                                    ? 'En mora'
                                    : row.source === 'SIN_RUTA'
                                      ? 'Sin asignar'
                                      : 'Pendiente'
                          }
                        />
                      </div>

                      <div className="relative flex justify-center">
                        {hasMultipleActions ? (
                          <>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveDropdownRowKey(activeDropdownRowKey === row.key ? null : row.key);
                              }}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#64748B] hover:text-[#2563EB] ${horizontalMotionClass}`}
                              title="Acciones"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeDropdownRowKey === row.key && (
                              <div 
                                onClick={(event) => event.stopPropagation()}
                                className="absolute right-0 top-10 z-50 w-52 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_36px_rgba(15,23,42,0.12)] animate-in fade-in slide-in-from-top-2 duration-150"
                              >
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => {
                                      const route = routes.find(item => item.id === row.routeId);
                                      const routeItem = route?.items.find(item => item.id === row.itemId);
                                      if (routeItem) {
                                        setActiveRouteId(row.routeId);
                                        setShowCollectionModal(routeItem);
                                      }
                                      setActiveDropdownRowKey(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-bold text-[#2563EB] hover:bg-[#EFF6FF] whitespace-nowrap"
                                  >
                                    <Banknote size={15} />
                                    Registrar Cobro
                                  </button>
                                  <button
                                    onClick={() => {
                                      requestVisitConfirmation(row.routeId!, { id: row.itemId!, clientName: row.clientName, amountToCollect: row.amount });
                                      setActiveDropdownRowKey(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] whitespace-nowrap"
                                  >
                                    <UserCheck size={15} />
                                    Registrar Visita
                                  </button>
                                  <button
                                    onClick={() => {
                                      requestNoPayConfirmation(row.routeId!, { id: row.itemId!, clientName: row.clientName, amountToCollect: row.amount });
                                      setActiveDropdownRowKey(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] whitespace-nowrap"
                                  >
                                    <AlertTriangle size={15} />
                                    No Pago
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigate(`/clients/${row.clientId}`);
                                      setActiveDropdownRowKey(null);
                                    }}
                                    className="border-t border-[#F3F4F6] mt-1 pt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#F8FAFC] whitespace-nowrap"
                                  >
                                    <Eye size={15} />
                                    Ver perfil
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => navigate(`/clients/${row.clientId}`)}
                            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-[12px] font-bold text-[#111827] ${horizontalMotionClass}`}
                          >
                            <Eye size={14} />
                            Ver perfil
                          </button>
                        )}
                      </div>
                    </div>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>
          </div>

          {filteredQueueRows.length > pageSize && (
            <div className="flex flex-col gap-4 border-t border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-[15px] font-medium text-[#64748B]">
                Mostrando {(safeCurrentPage - 1) * pageSize + 1} a {Math.min(safeCurrentPage * pageSize, filteredQueueRows.length)} de {filteredQueueRows.length} registros
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] disabled:cursor-not-allowed disabled:opacity-35 ${horizontalMotionClass}`}
                >
                  <ChevronLeft size={18} />
                </button>

                {visiblePages.map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border px-4 text-[15px] font-semibold transition-all duration-200 ${
                      page === safeCurrentPage
                        ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
                        : `border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] disabled:cursor-not-allowed disabled:opacity-35 ${horizontalMotionClass}`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </article>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <article data-collect-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">Rutas activas</h2>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Despacho, avance y acceso rapido a cada recorrido.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {openRoutes.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#E5E7EB] px-5 py-10 text-center">
                  <RouteIcon size={32} className="mx-auto text-[#CBD5E1]" />
                  <p className="mt-3 text-[15px] font-semibold text-[#64748B]">No hay rutas abiertas hoy.</p>
                </div>
              ) : (
                openRoutes.slice(0, 3).map(route => {
                  const collector = collectors.find(user => user.id === route.collectorId);
                  const progress =
                    route.items.length > 0
                      ? (route.items.filter(item => item.visitStatus !== 'PENDING').length / route.items.length) * 100
                      : 0;
                  const paidCount = route.items.filter(item => item.visitStatus === 'PAID').length;

                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setActiveRouteId(route.id)}
                      data-collect-row
                      className={`group flex w-full flex-col rounded-[26px] border bg-white p-5 text-left shadow-sm ${horizontalMotionClass}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[18px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">
                            {collector?.name || 'Oficial de cobro'}
                          </p>
                          <p className="mt-1 text-[13px] font-medium text-[#64748B]">
                            {route.items.length} paradas · {formatDate(route.date)}
                          </p>
                        </div>
                        <Badge status={route.status === RouteStatus.IN_PROGRESS ? 'En curso' : 'Abierta'} />
                      </div>

                      <div className="mt-4 flex items-center justify-between text-[14px] font-medium text-[#64748B]">
                        <span>{paidCount} cobros gestionados</span>
                        <span className="font-semibold text-[#111827]">{Math.round(progress)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                        <div className="h-full rounded-full bg-[#2563EB] transition-all duration-700" style={{ width: `${progress}%` }} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {route.status === RouteStatus.OPEN && (!isCollector || route.collectorId === currentUser.id) && (
                          <span
                            onClick={event => {
                              event.stopPropagation();
                              handleStartRoute(route.id);
                            }}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[13px] font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.2)]"
                          >
                            <Bike size={16} />
                            Despachar
                          </span>
                        )}
                        {route.status === RouteStatus.IN_PROGRESS && !isCollector && (
                          <span
                            onClick={event => {
                              event.stopPropagation();
                              setSettlementRoute(route);
                              setCashInHand(
                                route.items.reduce((acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0),
                              );
                            }}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#16A34A] px-4 text-[13px] font-semibold text-white shadow-[0_18px_36px_rgba(22,163,74,0.2)]"
                          >
                            <CheckCircle2 size={16} />
                            Liquidar
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </article>

          <article data-collect-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">Liquidaciones recientes</h2>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Cierres archivados con su monto recaudado.</p>
              </div>
              <button
                onClick={() => navigate('/reports')}
                className={`inline-flex h-9 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#111827] ${horizontalMotionClass}`}
              >
                Ver reportes
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {historyRoutes.slice(0, 5).map(route => {
                const collector = collectors.find(user => user.id === route.collectorId);
                const collected = route.items.reduce(
                  (acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0),
                  0,
                );
                return (
                  <div
                    key={route.id}
                    data-collect-row
                    className="group flex items-center justify-between rounded-[24px] border border-[#E5E7EB] bg-white p-4 transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                  >
                    <div className="transition-transform duration-200 group-hover:translate-x-2">
                      <p className="text-[16px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">
                        {collector?.name || 'Oficial de cobro'}
                      </p>
                      <p className="mt-1 text-[13px] font-medium text-[#64748B]">{formatDate(route.date)}</p>
                    </div>
                    <div className="text-right transition-transform duration-200 group-hover:translate-x-2">
                      <p className="text-[18px] font-bold text-[#111827]">{formatCurrency(collected)}</p>
                      <p className="mt-1 text-[13px] font-medium text-[#16A34A]">Liquidado</p>
                    </div>
                  </div>
                );
              })}
              {historyRoutes.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-[#E5E7EB] px-5 py-10 text-center">
                  <History size={32} className="mx-auto text-[#CBD5E1]" />
                  <p className="mt-3 text-[15px] font-semibold text-[#64748B]">Todavia no hay cierres archivados.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>

      {isModalOpen && !isCollector && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <div className="flex shrink-0 items-start justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-8 py-7">
              <div>
                <h3 className="text-[24px] font-semibold tracking-tight text-[#111827]">Generador de ruta</h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Planifica el recorrido de cobro del dia por cobrador y fecha.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerateRoute} className="flex min-h-0 flex-1 flex-col">
              {formError && (
                <div className="mx-8 mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-medium text-[#DC2626]">
                  {formError}
                </div>
              )}

              <div className="grid shrink-0 grid-cols-1 gap-4 px-8 py-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Cobrador responsable</label>
                  <select
                    required
                    className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD]"
                    value={selectedCollectorId}
                    onChange={event => setSelectedCollectorId(event.target.value)}
                  >
                    <option value="">Elegir cobrador</option>
                    {collectors.map(collector => (
                      <option key={collector.id} value={collector.id}>
                        {collector.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Fecha de ruta</label>
                  <PlatformDateField value={routeDate} onChange={setRouteDate} placeholder="dd/mm/aaaa" required />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] px-8 pb-8">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-[#F8FAFC] py-4">
                  <div>
                    <h4 className="text-[22px] font-black tracking-tight text-[#111827]">Cuentas sin asignar</h4>
                    <p className="mt-1 text-[14px] font-medium text-[#64748B]">{pendingInstallments.length} cuentas disponibles para organizar.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInstallments(pendingInstallments.map(item => item.installmentId))}
                    className="text-[14px] font-semibold text-[#2563EB]"
                  >
                    Seleccionar todas
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {pendingInstallments.map(item => (
                    <button
                      key={item.installmentId}
                      type="button"
                      onClick={() => toggleInstallment(item.installmentId)}
                      className={`flex items-center justify-between rounded-[28px] border bg-white p-5 text-left transition-all duration-200 ${
                        selectedInstallments.includes(item.installmentId)
                          ? 'border-[#93C5FD] shadow-[0_18px_40px_rgba(37,99,235,0.12)]'
                          : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[18px] font-bold text-[#111827]">{item.clientName}</p>
                        <p className="mt-1 truncate text-[14px] font-medium text-[#64748B]">{item.address}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge status={item.isMora ? 'En mora' : 'Al dia'} />
                          <span className="text-[13px] font-medium text-[#94A3B8]">{formatDate(item.dueDate)}</span>
                        </div>
                      </div>
                      <div className="pl-4 text-right">
                        <p className="text-[18px] font-bold text-[#111827]">{formatCurrency(item.amountToCollect)}</p>
                        <p className="mt-2 text-[13px] font-medium text-[#2563EB]">
                          {selectedInstallments.includes(item.installmentId) ? 'Incluida' : 'Agregar'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-[#E5E7EB] bg-white px-8 py-6">
                <div>
                  <p className="text-[24px] font-semibold tracking-tight text-[#111827]">{selectedInstallments.length}</p>
                  <p className="text-[13px] font-medium text-[#64748B]">Cuentas seleccionadas para esta ruta.</p>
                </div>
                <button
                  type="submit"
                  disabled={selectedInstallments.length === 0}
                  className="inline-flex h-[56px] items-center justify-center rounded-2xl bg-[#111827] px-8 text-[15px] font-semibold text-white shadow-[0_22px_44px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-1 hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Generar hoja de ruta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {settlementRoute && !isCollector && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-8 py-7">
              <div>
                <h3 className="text-[24px] font-semibold tracking-tight text-[#111827]">Liquidar ruta</h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Cierre de caja y archivo del recorrido ejecutado.</p>
              </div>
              <button
                onClick={() => setSettlementRoute(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCloseRoute} className="space-y-6 p-8">
              <div className="rounded-[28px] bg-[#111827] p-6 text-white shadow-[0_22px_44px_rgba(15,23,42,0.18)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">Monto recaudado</p>
                    <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
                      {formatCurrency(
                        settlementRoute.items.reduce(
                          (acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0),
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">Cobros efectivos</p>
                    <p className="mt-2 text-[24px] font-semibold tracking-tight">
                      {settlementRoute.items.filter(item => item.visitStatus === 'PAID').length}/{settlementRoute.items.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Efectivo entregado (RD$)</label>
                <input
                  type="number"
                  required
                  className="h-[72px] w-full rounded-[28px] border border-[#E5E7EB] bg-white px-6 text-[24px] font-semibold tracking-tight text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD]"
                  value={cashInHand}
                  onChange={event => setCashInHand(Number(event.target.value))}
                  autoFocus
                />
              </div>

              {cashInHand > 0 &&
                cashInHand !==
                  settlementRoute.items.reduce(
                    (acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0),
                    0,
                  ) && (
                  <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-5 text-[14px] font-medium text-[#991B1B]">
                    Existe una diferencia de{' '}
                    <span className="font-bold">
                      {formatCurrency(
                        Math.abs(
                          cashInHand -
                            settlementRoute.items.reduce(
                              (acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0),
                              0,
                            ),
                        ),
                      )}
                    </span>
                    . Revisa la entrega antes de cerrar.
                  </div>
                )}

              <button
                type="submit"
                className="inline-flex h-[56px] w-full items-center justify-center rounded-2xl bg-[#111827] px-8 text-[15px] font-semibold text-white shadow-[0_22px_44px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-1 hover:bg-black"
              >
                Finalizar y archivar ruta
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
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
  const containerRef = useRef<HTMLDivElement>(null);
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
        className={`flex h-[56px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 ${
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
