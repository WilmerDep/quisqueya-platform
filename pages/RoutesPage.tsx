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
} from 'lucide-react';
import {
  closeRoute,
  createRoute,
  getCompanyById,
  getClientById,
  getPendingInstallmentsForRoute,
  getRoutes,
  updateRouteItem,
  updateRouteStatus,
  upsertClientsInLocalStorage,
  upsertLoansInLocalStorage,
  upsertRoutesInLocalStorage,
} from '../services/dataService';
import { getBranchScope, getScopedUsers } from '../services/viewScope';
import { Branch, CollectionRoute, ReportTemplate, Role, RouteItem, RouteStatus, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils';
import { CollectionModal } from '../components/CollectionModal';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import { Badge } from '../components/ui/Badge';
import { ClientAvatar } from '../components/ui/ClientAvatar';
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
  'cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

const kpiToneMap = {
  blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]', watermark: 'text-[#DBEAFE]' },
  emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]', watermark: 'text-[#DCFCE7]' },
  red: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', note: 'text-[#DC2626]', watermark: 'text-[#FEE2E2]' },
  amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]', watermark: 'text-[#FEF3C7]' },
} as const;

const statusOptions = [
  { value: '', label: 'Todas las rutas' },
  { value: RouteStatus.OPEN, label: 'Abiertas' },
  { value: RouteStatus.IN_PROGRESS, label: 'En curso' },
  { value: RouteStatus.CLOSED, label: 'Cerradas' },
];

const pageSize = 10;
type RouteDetailTab = 'summary' | 'clients' | 'collections' | 'map' | 'history';

type RouteRow = {
  route: CollectionRoute;
  id: string;
  code: string;
  collectorName: string;
  branchName: string;
  expected: number;
  collected: number;
  progress: number;
  clientsCount: number;
  promised: number;
  failed: number;
};

export const RoutesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [routes, setRoutes] = useState<CollectionRoute[]>([]);
  const [collectors, setCollectors] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCollectorFilter, setSelectedCollectorFilter] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingInstallmentsPage, setPendingInstallmentsPage] = useState(1);
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [pendingDueDateFilter, setPendingDueDateFilter] = useState('');
  const [detailTab, setDetailTab] = useState<RouteDetailTab>('summary');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState<RouteItem | null>(null);
  const [settlementRoute, setSettlementRoute] = useState<CollectionRoute | null>(null);
  const [cashInHand, setCashInHand] = useState(0);
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingInstallments, setPendingInstallments] = useState<any[]>([]);
  const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [selectedPdfTemplateId, setSelectedPdfTemplateId] = useState('');
  const [hoveredRouteSegment, setHoveredRouteSegment] = useState<string | null>(null);

  const isCollector = currentUser?.role === Role.COBRADOR;
  const company = useMemo(
    () => (currentUser ? getCompanyById(currentUser.companyId) : undefined),
    [currentUser],
  );
  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const canSeeAllCompanyUsers = branchScope.canSeeAllCompanyUsers;
  const routeSubview = useMemo<'LIST' | 'CREATE'>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('view') === 'create' ? 'CREATE' : 'LIST';
  }, [location.search]);

  useEffect(() => {
    if (!currentUser) return;
    setSelectedBranchId(currentUser.branchId);
    setBranches(branchScope.branches);
  }, [branchScope, currentUser]);

  useEffect(() => {
    void loadBaseData();
  }, [currentUser?.companyId, currentUser?.branchId, selectedBranchId]);

  useEffect(() => {
    if (!currentUser) return;
    apiClient
      .listReportTemplates()
      .then(response => setReportTemplates(response.data))
      .catch(() => setReportTemplates([]));
  }, [currentUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranchId, selectedCollectorFilter, selectedStatus]);

  useEffect(() => {
    setDetailTab('summary');
  }, [activeRouteId]);

  const availablePdfTemplates = useMemo(
    () => reportTemplates.filter(template => template.status !== 'Archivada'),
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

  useEffect(() => {
    if (!pageRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo('[data-routes-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(
        '[data-routes-kpi]',
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.46, ease: 'power3.out', stagger: 0.05, delay: 0.02 },
      );
      gsap.fromTo('[data-routes-filter]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out', delay: 0.08 });
      gsap.fromTo('[data-routes-panel]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.46, ease: 'power3.out', delay: 0.14 });
      gsap.fromTo(
        '[data-routes-row]',
        { opacity: 0, x: -14 },
        { opacity: 1, x: 0, duration: 0.32, ease: 'power2.out', stagger: 0.025, delay: 0.2 },
      );
    }, pageRef);

    return () => ctx.revert();
  }, [activeRouteId]);

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

    setRoutes(list);
    const scopedUsers = getScopedUsers(currentUser, activeBranchId).filter(user => user.role === Role.COBRADOR && user.isActive);
    setCollectors(
      canSeeAllCompanyUsers
        ? scopedUsers.filter(user => user.branchId === activeBranchId)
        : scopedUsers.filter(user => user.branchId === currentUser.branchId),
    );
    setPendingInstallments(getPendingInstallmentsForRoute(currentUser.companyId, activeBranchId));

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

  const toggleInstallment = (id: string) => {
    setSelectedInstallments(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const handleGenerateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (isCollector || !selectedCollectorId || selectedInstallments.length === 0 || !currentUser) return;

    const selectedRows = selectedInstallments
      .map(installmentId => pendingInstallments.find(pending => pending.installmentId === installmentId))
      .filter(Boolean);

    if (selectedRows.length !== selectedInstallments.length) {
      setFormError('Una o mas cuentas seleccionadas ya no estan disponibles. Actualiza la vista y vuelve a intentarlo.');
      return;
    }

    if (selectedRows.some(item => !item?.clientId)) {
      setFormError('Una o mas cuentas no tienen un cliente valido asociado. Revisa la data antes de generar la ruta.');
      return;
    }

    const itemsToSave: RouteItem[] = selectedRows.map((data, index) => {
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
        createRoute(payload, currentUser);
      } else if (error instanceof ApiRequestError) {
        setFormError(error.message);
        return;
      } else {
        setFormError(error instanceof Error ? error.message : 'No se pudo crear la ruta.');
        return;
      }
    }

    navigate('/routes');
    resetForm();
    void loadBaseData();
  };

  const handleExportRoutePdf = ({
    route,
    routeCode,
    branch,
    collector,
    collectedAmount,
    totalToCollect,
    routeProgress,
    paidCount,
    promisedCount,
    failedCount,
  }: {
    route: CollectionRoute;
    routeCode: string;
    branch?: Branch | null;
    collector?: User;
    collectedAmount: number;
    totalToCollect: number;
    routeProgress: number;
    paidCount: number;
    promisedCount: number;
    failedCount: number;
  }) => {
    if (!currentUser) return;

    try {
      const templateLabel = activePdfTemplate?.name || activePdfVisualPreset.label;
      const companyName = company?.name || 'PrestaFacil RD';
      const companyLines = [
        branch?.name || 'Sucursal principal',
        branch?.address || 'Direccion institucional pendiente',
        company?.rnc ? `RNC: ${company.rnc}` : '',
      ].filter(Boolean);

      const lineItems = route.items.length
        ? route.items
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((item, index) => {
              const linkedClient = getClientById(item.clientId);
              const visitLabel =
                item.visitStatus === 'PAID'
                  ? 'Cobrado'
                  : item.visitStatus === 'PROMISED'
                    ? 'Promesa'
                    : item.visitStatus === 'FAILED'
                      ? 'Incidencia'
                      : 'Pendiente';

              return {
                description:
                  `${linkedClient?.firstName || ''} ${linkedClient?.lastName || ''}`.trim() ||
                  item.clientName ||
                  `Cliente ${index + 1}`,
                detail: [linkedClient?.address || item.address || 'Direccion pendiente', item.notes ? `Nota: ${item.notes}` : '']
                  .filter(Boolean)
                  .join(' · '),
                quantity: `${item.order}`,
                unit: visitLabel,
                price: formatCurrency(item.amountToCollect),
                tax: linkedClient?.phone || 'Sin telefono',
                amount: collector?.name || 'Sin cobrador asignado',
              };
            })
        : [
            {
              description: 'Sin paradas registradas',
              detail: 'Esta ruta no contiene clientes asignados al momento de exportar.',
              quantity: '-',
              unit: '-',
              price: '-',
              tax: '-',
              amount: '-',
            },
          ];

  const model: Parameters<typeof renderPlatformPdfDocument>[0]['model'] = {
    documentKind: 'route',
    title: `Ruta ${routeCode}`,
    subtitle: 'Detalle operativo del recorrido con clientes asignados, estados y lectura de cobranza.',
        documentNumber: routeCode,
        issueDate: formatDate(route.date),
        dueDate: route.status === RouteStatus.CLOSED ? 'Ruta cerrada' : 'Ruta operativa',
        companyName,
        companyLogo: branch?.logo || company?.logo,
        companyLines,
        seller: {
          title: 'Cobrador asignado',
          lines: [
            collector?.name || 'Sin cobrador asignado',
            branch?.name || 'Sucursal principal',
            route.status === RouteStatus.CLOSED ? 'Cierre confirmado' : 'Seguimiento en campo',
          ],
        },
        buyer: {
          title: 'Alcance de la ruta',
          lines: [
            `Fecha: ${formatDate(route.date)}`,
            `Clientes asignados: ${route.items.length}`,
            `Progreso: ${routeProgress}%`,
          ],
        },
        shipTo: {
          title: 'Lectura ejecutiva',
          lines: [
            `Cobro esperado: ${formatCurrency(totalToCollect)}`,
            `Cobrado: ${formatCurrency(collectedAmount)}`,
            `Promesas: ${promisedCount}`,
            `Incidencias: ${failedCount}`,
          ],
        },
        summaryTitle: 'Total cobrado',
        summaryValue: formatCurrency(collectedAmount),
        summaryMeta: [`${route.items.length} paradas`, `${paidCount} cobros`, templateLabel],
        lineItems,
        totals: [
          { label: 'Monto esperado', value: formatCurrency(totalToCollect) },
          { label: 'Cobrado', value: formatCurrency(collectedAmount) },
          { label: 'Pendiente', value: formatCurrency(Math.max(totalToCollect - collectedAmount, 0)) },
          { label: 'Progreso', value: `${routeProgress}%`, emphasis: true },
        ],
        notesTitle: 'Notas del documento',
        notesLines: [
          'La exportacion conserva el detalle visible del recorrido y las paradas asignadas.',
          'Cuando el contenido supera una pagina, el documento continua automaticamente en hojas siguientes.',
        ],
        footerNote: 'Documento emitido desde el modulo de rutas de PrestaFacil RD.',
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

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildPlatformPdfFileName(`ruta-${routeCode.toLowerCase()}`);
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      emitPlatformToast({
        title: 'Ruta exportada',
        message: `La ruta se exportó con la plantilla ${templateLabel}.`,
        tone: 'success',
        durationMs: 3200,
      });
    } catch {
      emitPlatformToast({
        title: 'No se pudo exportar la ruta',
        message: 'Intenta nuevamente en unos segundos.',
        tone: 'error',
        durationMs: 3200,
      });
    }
  };

  const resetForm = () => {
    setSelectedCollectorId('');
    setSelectedInstallments([]);
    setRouteDate(new Date().toISOString().split('T')[0]);
    setFormError('');
  };

  const resetFilters = () => {
    setSelectedBranchId(canSeeAllCompanyUsers ? '' : currentUser?.branchId || '');
    setSelectedCollectorFilter('');
    setSelectedStatus('');
    setSearchTerm('');
  };

  const openRouteGenerator = () => {
    resetForm();
    navigate('/routes?view=create');
  };

  const closeRouteGenerator = () => {
    resetForm();
    navigate('/routes');
  };

  const activeRouteData = useMemo(() => routes.find(route => route.id === activeRouteId), [activeRouteId, routes]);
  const historyRoutes = useMemo(() => routes.filter(route => route.status === RouteStatus.CLOSED), [routes]);
  const openRoutes = useMemo(
    () =>
      [...routes]
        .filter(route => route.status !== RouteStatus.CLOSED)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [routes],
  );

  const routeRows = useMemo<RouteRow[]>(() => {
    return routes
      .map((route, index) => {
        const collector = collectors.find(user => user.id === route.collectorId);
        const branch = branches.find(item => item.id === route.branchId);
        const expected = route.items.reduce((sum, item) => sum + item.amountToCollect, 0);
        const collected = route.items.reduce((sum, item) => sum + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0);
        const visited = route.items.filter(item => item.visitStatus !== 'PENDING').length;

        const row: RouteRow = {
          route,
          id: route.id,
          code: `RT-${String(index + 1).padStart(3, '0')}`,
          collectorName: collector?.name || 'Oficial de cobro',
          branchName: branch?.name || 'Sucursal',
          expected,
          collected,
          progress: route.items.length > 0 ? Math.round((visited / route.items.length) * 100) : 0,
          clientsCount: route.items.length,
          promised: route.items.filter(item => item.visitStatus === 'PROMISED').length,
          failed: route.items.filter(item => item.visitStatus === 'FAILED').length,
        };

        return { row, originalIndex: index };
      })
      .sort((a, b) => {
        const dateDelta = new Date(b.row.route.date).getTime() - new Date(a.row.route.date).getTime();
        return dateDelta !== 0 ? dateDelta : b.originalIndex - a.originalIndex;
      })
      .map(entry => entry.row);
  }, [branches, collectors, routes]);

  const filteredRouteRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return routeRows.filter(row => {
      if (selectedBranchId && row.route.branchId !== selectedBranchId) return false;
      if (selectedCollectorFilter && row.route.collectorId !== selectedCollectorFilter) return false;
      if (selectedStatus && row.route.status !== selectedStatus) return false;
      if (!query) return true;

      const haystack = [row.code, row.collectorName, row.branchName, formatDate(row.route.date)].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [routeRows, searchTerm, selectedBranchId, selectedCollectorFilter, selectedStatus]);

  const routeStats = useMemo(() => {
    const expectedTotal = routeRows.reduce((sum, row) => sum + row.expected, 0);
    const collectedTotal = routeRows.reduce((sum, row) => sum + row.collected, 0);
    const inProgress = routeRows.filter(row => row.route.status === RouteStatus.IN_PROGRESS).length;
    const open = routeRows.filter(row => row.route.status === RouteStatus.OPEN).length;
    const closed = routeRows.filter(row => row.route.status === RouteStatus.CLOSED).length;
    const assignedClients = routeRows.reduce((sum, row) => sum + row.clientsCount, 0);

    return {
      expectedTotal,
      collectedTotal,
      inProgress,
      open,
      closed,
      assignedClients,
      coverage: expectedTotal > 0 ? Math.round((collectedTotal / expectedTotal) * 100) : 0,
    };
  }, [routeRows]);

  const selectedCollector = useMemo(
    () => collectors.find(collector => collector.id === selectedCollectorId) || null,
    [collectors, selectedCollectorId],
  );
  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === (selectedBranchId || currentUser?.branchId)) || null,
    [branches, currentUser?.branchId, selectedBranchId],
  );
  const selectedInstallmentRows = useMemo(
    () => pendingInstallments.filter(item => selectedInstallments.includes(item.installmentId)),
    [pendingInstallments, selectedInstallments],
  );
  const filteredPendingInstallments = useMemo(() => {
    const query = pendingSearchTerm.trim().toLowerCase();
    return pendingInstallments.filter(item => {
      const matchesQuery =
        !query ||
        [item.clientName, item.address, String(item.amountToCollect), formatDate(item.dueDate)]
          .join(' ')
          .toLowerCase()
          .includes(query);
      const matchesDate = !pendingDueDateFilter || String(item.dueDate).slice(0, 10) === pendingDueDateFilter;
      return matchesQuery && matchesDate;
    });
  }, [pendingDueDateFilter, pendingInstallments, pendingSearchTerm]);
  const selectedInstallmentTotal = useMemo(
    () => selectedInstallmentRows.reduce((sum, item) => sum + item.amountToCollect, 0),
    [selectedInstallmentRows],
  );
  const selectedInstallmentMoraCount = useMemo(
    () => selectedInstallmentRows.filter(item => item.isMora).length,
    [selectedInstallmentRows],
  );
  const allPendingSelected =
    filteredPendingInstallments.length > 0 &&
    filteredPendingInstallments.every(item => selectedInstallments.includes(item.installmentId));
  const pendingInstallmentsTotalPages = Math.max(1, Math.ceil(filteredPendingInstallments.length / pageSize));
  const safePendingInstallmentsPage = Math.min(pendingInstallmentsPage, pendingInstallmentsTotalPages);
  const paginatedPendingInstallments = useMemo(() => {
    const start = (safePendingInstallmentsPage - 1) * pageSize;
    return filteredPendingInstallments.slice(start, start + pageSize);
  }, [filteredPendingInstallments, safePendingInstallmentsPage]);
  const visiblePendingPages = useMemo(() => {
    if (pendingInstallmentsTotalPages <= 5) return Array.from({ length: pendingInstallmentsTotalPages }, (_, index) => index + 1);
    if (safePendingInstallmentsPage <= 3) return [1, 2, 3, 4, pendingInstallmentsTotalPages];
    if (safePendingInstallmentsPage >= pendingInstallmentsTotalPages - 2) {
      return [1, pendingInstallmentsTotalPages - 3, pendingInstallmentsTotalPages - 2, pendingInstallmentsTotalPages - 1, pendingInstallmentsTotalPages];
    }
    return [1, safePendingInstallmentsPage - 1, safePendingInstallmentsPage, safePendingInstallmentsPage + 1, pendingInstallmentsTotalPages];
  }, [pendingInstallmentsTotalPages, safePendingInstallmentsPage]);

  useEffect(() => {
    setPendingInstallmentsPage(1);
  }, [filteredPendingInstallments.length, pendingDueDateFilter, pendingSearchTerm, routeDate, selectedCollectorId]);

  useEffect(() => {
    if (routeSubview !== 'CREATE' || isCollector) return;
    if (selectedCollectorId && collectors.some(collector => collector.id === selectedCollectorId)) return;
    if (collectors.length === 0) return;
    setSelectedCollectorId(collectors[0].id);
  }, [collectors, isCollector, routeSubview, selectedCollectorId]);

  const totalPages = Math.max(1, Math.ceil(filteredRouteRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRouteRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRouteRows.slice(start, start + pageSize);
  }, [filteredRouteRows, safeCurrentPage]);

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
      label: 'Rutas abiertas',
      value: `${routeStats.open}`,
      helper: `${routeRows.filter(row => row.route.status === RouteStatus.OPEN).length} listas para despacho`,
      share: routeRows.length > 0 ? Math.round((routeStats.open / routeRows.length) * 100) : 0,
      trend: `${routeStats.assignedClients} clientes`,
      trendTone: 'text-[#2563EB]',
      icon: RouteIcon,
      tone: 'blue' as const,
    },
    {
      label: 'Rutas en curso',
      value: `${routeStats.inProgress}`,
      helper: `${routeRows.filter(row => row.route.status === RouteStatus.IN_PROGRESS).reduce((sum, row) => sum + row.clientsCount, 0)} clientes en gestion`,
      share: routeRows.length > 0 ? Math.round((routeStats.inProgress / routeRows.length) * 100) : 0,
      trend: `${routeRows.filter(row => row.route.status === RouteStatus.IN_PROGRESS).reduce((sum, row) => sum + row.clientsCount, 0)}`,
      trendTone: 'text-[#16A34A]',
      icon: UserCheck,
      tone: 'emerald' as const,
    },
    {
      label: 'Cobro esperado',
      value: formatCurrency(routeStats.expectedTotal),
      helper: 'Meta total de las rutas activas',
      share: 100,
      trend: `${routeRows.length} rutas`,
      trendTone: 'text-[#D97706]',
      icon: Target,
      tone: 'amber' as const,
    },
    {
      label: 'Cobrado hasta ahora',
      value: formatCurrency(routeStats.collectedTotal),
      helper: `Recuperacion operativa ${routeStats.coverage}%`,
      share: routeStats.coverage,
      trend: `${routeStats.coverage}%`,
      trendTone: 'text-[#16A34A]',
      icon: Banknote,
      tone: 'emerald' as const,
    },
    {
      label: 'Rutas cerradas',
      value: `${routeStats.closed}`,
      helper: 'Archivadas con cierre confirmado',
      share: routeRows.length > 0 ? Math.round((routeStats.closed / routeRows.length) * 100) : 0,
      trend: `${historyRoutes.length}`,
      trendTone: 'text-[#6B7280]',
      icon: CheckCircle2,
      tone: 'blue' as const,
    },
  ];

  if (!currentUser) return null;

  if (routeSubview === 'CREATE' && !isCollector) {
    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        <section className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Rutas</p>
            <h1 className="mt-3 text-[52px] font-black leading-none tracking-tight text-[#111827]">Generador de ruta</h1>
            <p className="mt-4 max-w-3xl text-[20px] font-medium leading-9 text-[#64748B]">
              Planifica el recorrido diario por cobrador, fecha y cuentas disponibles, con una subvista limpia, operativa y alineada al resto del panel.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1.1fr)]">
            <button
              type="button"
              onClick={closeRouteGenerator}
              className={`inline-flex h-[56px] min-w-[220px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${horizontalMotionClass}`}
            >
              <ChevronLeft size={18} />
              Volver a rutas
            </button>
            <button
              type="submit"
              form="route-generator-form"
              disabled={!selectedCollectorId || selectedInstallments.length === 0}
              className="inline-flex h-[56px] min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[17px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Navigation size={18} />
              Generar hoja de ruta
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <article className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#DBEAFE] text-[#2563EB]">
                <UserCheck size={24} />
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
                <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">Ruta</p>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <p className="text-[17px] font-semibold text-[#111827]">Responsable</p>
              <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{selectedCollector ? '1' : '0'}</p>
              <p className="max-w-[240px] text-[15px] font-medium leading-6 text-[#6B7280]">
                {selectedCollector?.name || 'Selecciona un cobrador para preparar la hoja del dia.'}
              </p>
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.08] text-[#2563EB]">
              <UserCheck size={88} />
            </div>
          </article>
          <article className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#DCFCE7] text-[#16A34A]">
                <Banknote size={24} />
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
                <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">Monto</p>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <p className="text-[17px] font-semibold text-[#111827]">Monto esperado</p>
              <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{formatCurrency(selectedInstallmentTotal)}</p>
              <p className="max-w-[240px] text-[15px] font-medium leading-6 text-[#16A34A]">Total acumulado de las cuentas seleccionadas.</p>
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.08] text-[#16A34A]">
              <Banknote size={88} />
            </div>
          </article>
          <article className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#FEF3C7] text-[#D97706]">
                <AlertTriangle size={24} />
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
                <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">Mora</p>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <p className="text-[17px] font-semibold text-[#111827]">Cuentas en mora</p>
              <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{selectedInstallmentMoraCount}</p>
              <p className="max-w-[240px] text-[15px] font-medium leading-6 text-[#D97706]">Prioriza seguimiento en el despacho del dia.</p>
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.08] text-[#D97706]">
              <AlertTriangle size={88} />
            </div>
          </article>
          <article className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#F3E8FF] text-[#7C3AED]">
                <RouteIcon size={24} />
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
                <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">Despacho</p>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <p className="text-[17px] font-semibold text-[#111827]">Paradas</p>
              <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{selectedInstallments.length}</p>
              <p className="max-w-[240px] text-[15px] font-medium leading-6 text-[#6B7280]">Cantidad de visitas preparadas para esta ruta.</p>
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.08] text-[#7C3AED]">
              <RouteIcon size={88} />
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.72fr)]">
          <article className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
            <form id="route-generator-form" onSubmit={handleGenerateRoute} className="flex min-h-0 flex-col">
              <div className="border-b border-[#E5E7EB] px-6 py-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Cobrador responsable</label>
                    <FilterDropdown
                      value={selectedCollectorId}
                      onChange={setSelectedCollectorId}
                      placeholder="Elegir cobrador"
                      options={collectors.map(collector => ({ value: collector.id, label: collector.name }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Fecha de ruta</label>
                    <CalendarField value={routeDate} onChange={setRouteDate} placeholder="Selecciona fecha de ruta" allowClear={false} />
                  </div>
                </div>
                {formError ? (
                  <div className="mt-5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-medium text-[#DC2626]">
                    {formError}
                  </div>
                ) : null}
              </div>

              <div className="px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Cuentas sin asignar</h2>
                    <p className="mt-2 text-[15px] font-medium text-[#64748B]">{pendingInstallments.length} cuentas disponibles para organizar.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedInstallments(current =>
                          allPendingSelected
                            ? current.filter(id => !filteredPendingInstallments.some(item => item.installmentId === id))
                            : [...new Set([...current, ...filteredPendingInstallments.map(item => item.installmentId)])],
                        )
                      }
                      className={`inline-flex h-11 items-center gap-2 self-start rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] lg:self-auto ${horizontalMotionClass}`}
                    >
                      {allPendingSelected ? 'Vaciar seleccion' : 'Seleccionar todas'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(200px,0.9fr)_minmax(220px,0.7fr)_auto]">
                  <label className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-sm">
                    <Search size={18} className="text-[#94A3B8]" />
                    <input
                      type="text"
                      value={pendingSearchTerm}
                      onChange={event => setPendingSearchTerm(event.target.value)}
                      placeholder="Buscar cliente, direccion o monto"
                      className="w-full bg-transparent text-[15px] font-semibold text-[#111827] outline-none placeholder:text-[#94A3B8]"
                    />
                  </label>
                  <CalendarField value={pendingDueDateFilter} onChange={setPendingDueDateFilter} placeholder="Filtrar por fecha de vencimiento" />
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSearchTerm('');
                      setPendingDueDateFilter('');
                    }}
                    className={`inline-flex h-[56px] items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                  >
                    <Filter size={18} />
                    Limpiar filtros
                  </button>
                </div>

                {filteredPendingInstallments.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    {paginatedPendingInstallments.map(item => (
                      <button
                        key={item.installmentId}
                        type="button"
                        onClick={() => toggleInstallment(item.installmentId)}
                        className={`flex w-full items-center justify-between gap-4 rounded-[28px] border bg-white p-5 text-left transition-all duration-200 ${
                          selectedInstallments.includes(item.installmentId)
                            ? 'border-[#93C5FD] bg-[#F8FBFF] shadow-[0_18px_40px_rgba(37,99,235,0.12)]'
                            : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(170px,0.4fr)_minmax(170px,0.4fr)_minmax(160px,0.35fr)] lg:items-center">
                            <div className="min-w-0">
                              <p className="truncate text-[18px] font-bold text-[#111827]">{item.clientName}</p>
                              <p className="mt-1 truncate text-[14px] font-medium text-[#64748B]">{item.address}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Estado</p>
                              <div className="mt-3">
                                <Badge status={item.isMora ? 'En mora' : 'Al dia'} />
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Vence</p>
                              <p className="mt-3 text-[14px] font-semibold text-[#64748B]">{formatDate(item.dueDate)}</p>
                            </div>
                            <div className="text-left lg:text-right">
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Monto</p>
                              <p className="mt-3 text-[18px] font-bold text-[#111827]">{formatCurrency(item.amountToCollect)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pl-2 text-[#2563EB]">
                          {selectedInstallments.includes(item.installmentId) ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                          <p className="text-[13px] font-semibold">{selectedInstallments.includes(item.installmentId) ? 'Incluida' : 'Agregar'}</p>
                        </div>
                      </button>
                    ))}

                    <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-5">
                      <p className="text-[15px] font-medium text-[#6B7280]">
                        {filteredPendingInstallments.length === 0
                          ? 'No hay registros para mostrar'
                          : `Mostrando ${(safePendingInstallmentsPage - 1) * pageSize + 1} a ${Math.min(safePendingInstallmentsPage * pageSize, filteredPendingInstallments.length)} de ${filteredPendingInstallments.length} cuentas`}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPendingInstallmentsPage(page => Math.max(1, page - 1))}
                          disabled={safePendingInstallmentsPage === 1}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        {visiblePendingPages.map(page => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setPendingInstallmentsPage(page)}
                            className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-[15px] font-medium ${
                              page === safePendingInstallmentsPage
                                ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                                : 'border border-transparent text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPendingInstallmentsPage(page => Math.min(pendingInstallmentsTotalPages, page + 1))}
                          disabled={safePendingInstallmentsPage === pendingInstallmentsTotalPages}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[28px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-12 text-center">
                    <p className="text-[18px] font-black text-[#111827]">No hay cuentas visibles para generar una ruta nueva.</p>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">
                      Ajusta los filtros o espera nuevas cuotas por cobrar en la sucursal para organizarlas desde aqui.
                    </p>
                  </div>
                )}
              </div>
            </form>
          </article>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Resumen operativo</h3>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">Lectura rapida del despacho que estas armando.</p>
              <div className="mt-6 space-y-4">
                <InfoBlock label="Sucursal" value={selectedBranch?.name || 'Sucursal principal'} />
                <InfoBlock label="Cobrador" value={selectedCollector?.name || 'Pendiente de asignar'} />
                <InfoBlock label="Fecha" value={formatDate(routeDate)} />
              </div>
            </section>

            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Cuentas incluidas</p>
              <p className="mt-4 text-[40px] font-black tracking-tight text-[#111827]">{selectedInstallments.length}</p>
              <p className="mt-2 text-[14px] font-medium text-[#64748B]">Seleccionadas para la hoja del dia.</p>
              <div className="mt-6 h-2 rounded-full bg-[#E5E7EB]">
                <div
                  className="h-2 rounded-full bg-[#2563EB] transition-all duration-300"
                  style={{
                    width: `${pendingInstallments.length > 0 ? Math.min((selectedInstallments.length / pendingInstallments.length) * 100, 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#94A3B8]">
                {pendingInstallments.length > 0 ? `${selectedInstallments.length} de ${pendingInstallments.length} cuentas preparadas.` : 'No hay cuentas pendientes para asignar.'}
              </p>
            </section>

            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Hoja proyectada</h3>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">Vista rapida del valor y prioridad de la ruta que vas a despachar.</p>
              <div className="mt-6 space-y-4">
                <InfoBlock label="Monto esperado" value={formatCurrency(selectedInstallmentTotal)} />
                <InfoBlock label="Cuentas en mora" value={`${selectedInstallmentMoraCount}`} />
                <InfoBlock label="Paradas proyectadas" value={`${selectedInstallments.length}`} />
              </div>
            </section>
          </aside>
        </section>
      </div>
    );
  }

  if (activeRouteId && activeRouteData) {
    const activeCollector = collectors.find(user => user.id === activeRouteData.collectorId);
    const activeBranchData = branches.find(branch => branch.id === activeRouteData.branchId);
    const activeRow = routeRows.find(row => row.id === activeRouteData.id);
    const pendingItems = activeRouteData.items.filter(item => item.visitStatus === 'PENDING');
    const paidItems = activeRouteData.items.filter(item => item.visitStatus === 'PAID');
    const promisedItems = activeRouteData.items.filter(item => item.visitStatus === 'PROMISED');
    const failedItems = activeRouteData.items.filter(item => item.visitStatus === 'FAILED');
    const visitedItems = activeRouteData.items.filter(item => item.visitStatus !== 'PENDING');
    const collectedAmount = paidItems.reduce((sum, item) => sum + item.amountToCollect, 0);
    const totalToCollect = activeRouteData.items.reduce((sum, item) => sum + item.amountToCollect, 0);
    const routeProgress = totalToCollect > 0 ? Math.round((collectedAmount / totalToCollect) * 100) : 0;
    const routeCode = activeRow?.code || `RT-${activeRouteData.id.slice(0, 4).toUpperCase()}`;
    const routeActivity = [...activeRouteData.items].filter(item => item.visitStatus !== 'PENDING').slice(0, 6);
    const nextPendingItem = pendingItems[0];
    const itemCount = Math.max(activeRouteData.items.length, 1);
    const paidAngle = (paidItems.length / itemCount) * 360;
    const pendingAngle = (pendingItems.length / itemCount) * 360;
    const failedAngle = (failedItems.length / itemCount) * 360;
    const routeDonut = `conic-gradient(#22C55E 0deg ${paidAngle}deg, #3B82F6 ${paidAngle}deg ${paidAngle + pendingAngle}deg, #F97316 ${paidAngle + pendingAngle}deg ${paidAngle + pendingAngle + failedAngle}deg, #8B5CF6 ${paidAngle + pendingAngle + failedAngle}deg 360deg)`;
    const routeSegments = [
      { label: 'Cobrados', value: paidItems.length, percent: Math.round((paidItems.length / itemCount) * 100), color: '#22C55E', helper: 'Clientes que ya pagaron en el recorrido actual.' },
      { label: 'Pendientes', value: pendingItems.length, percent: Math.round((pendingItems.length / itemCount) * 100), color: '#3B82F6', helper: 'Visitas planificadas aun por realizar.' },
      { label: 'No localizados', value: failedItems.length, percent: Math.round((failedItems.length / itemCount) * 100), color: '#F97316', helper: 'Visitas fallidas o deudores no encontrados.' },
      { label: 'Promesas', value: promisedItems.length, percent: Math.round((promisedItems.length / itemCount) * 100), color: '#8B5CF6', helper: 'Compromisos de pago acordados para hoy.' },
    ];
    const activeRouteTooltip = routeSegments.find(item => item.label === hoveredRouteSegment) || null;
    const detailTabs: Array<{ id: RouteDetailTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
      { id: 'summary', label: 'Resumen', icon: RouteIcon },
      { id: 'clients', label: 'Clientes asignados', icon: Users },
      { id: 'collections', label: 'Cobros y visitas', icon: Banknote },
      { id: 'map', label: 'Mapa / cobertura', icon: MapIcon },
      { id: 'history', label: 'Historial', icon: History },
    ];
    const collectionItems = [...activeRouteData.items].filter(item => item.visitStatus !== 'PENDING');
    const mapTarget = encodeURIComponent(activeBranchData?.address || activeBranchData?.name || 'Ruta');
    const mapEmbedUrl = `https://www.google.com/maps?q=${mapTarget}&output=embed`;

    return (
      <div ref={pageRef} className="space-y-6 pb-24 lg:pb-0">
        <section data-routes-hero className="space-y-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
            <div className="xl:min-w-0 xl:flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Rutas</p>
              <h1 className="mt-2 text-[48px] font-black leading-none tracking-tight text-[#111827]">Ruta {routeCode}</h1>
              <p className="mt-3 max-w-[680px] text-[18px] font-medium text-[#64748B]">
                Supervisa el recorrido, clientes asignados, cobros y actividad operativa en tiempo real.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 xl:flex-nowrap xl:items-center xl:justify-end xl:self-start">
              <button
                type="button"
                onClick={() => setActiveRouteId(null)}
                className={`inline-flex h-[50px] whitespace-nowrap items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
              >
                <ChevronLeft size={18} />
                Volver a rutas
              </button>
              <button
                type="button"
                onClick={() => nextPendingItem && handleUpdateVisitResult(activeRouteId, nextPendingItem.id, 'NO ESTABA', 'VISITED')}
                className={`inline-flex h-[50px] whitespace-nowrap items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
              >
                <Navigation size={18} />
                Registrar visita
              </button>
              <button
                type="button"
                onClick={() => nextPendingItem && setShowCollectionModal(nextPendingItem)}
                className={`inline-flex h-[50px] whitespace-nowrap items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
              >
                <Banknote size={18} />
                Registrar cobro
              </button>
              {!isCollector && activeRouteData.status !== RouteStatus.CLOSED && (
                <button
                  type="button"
                  onClick={() => {
                    setSettlementRoute(activeRouteData);
                    setCashInHand(collectedAmount);
                  }}
                  className={`inline-flex h-[50px] whitespace-nowrap items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                >
                  <CheckCircle2 size={18} />
                  Cerrar ruta
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  handleExportRoutePdf({
                    route: activeRouteData,
                    routeCode,
                    branch: activeBranchData,
                    collector: activeCollector,
                    collectedAmount,
                    totalToCollect,
                    routeProgress,
                    paidCount: paidItems.length,
                    promisedCount: promisedItems.length,
                    failedCount: failedItems.length,
                  })
                }
                className="inline-flex h-[50px] whitespace-nowrap items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]"
              >
                Exportar PDF
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section data-routes-panel className="grid grid-cols-1 gap-px overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-[#E5E7EB] shadow-sm xl:grid-cols-5">
          <RouteInfoCard icon={RouteIcon} label="Codigo de ruta" value={routeCode} />
          <RouteInfoCard icon={UserCheck} label="Cobrador asignado" value={activeCollector?.name || 'Oficial de cobro'} />
          <RouteInfoCard icon={Calendar} label="Fecha" value={formatDate(activeRouteData.date)} />
          <RouteInfoCard icon={MapPin} label="Sector / zona" value={activeBranchData?.name || 'Zona general'} />
          <RouteInfoCard icon={Users} label="Clientes asignados" value={`${activeRouteData.items.length}`} />
          <RouteInfoCard icon={Target} label="Cobro esperado" value={formatCurrency(totalToCollect)} />
          <RouteInfoCard icon={Banknote} label="Cobrado hasta ahora" value={formatCurrency(collectedAmount)} />
          <RouteInfoCard icon={CalendarClock} label="Estado de la ruta" value={activeRouteData.status} />
          <RouteInfoCard icon={Navigation} label="Hora estimada de cierre" value={`${Math.max(activeRouteData.items.length, 1)} visitas`} />
          <RouteInfoCard icon={Wallet} label="Progreso" value={`${routeProgress}%`} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-6">
          <SummaryKpi icon={Users} label="Clientes visitados" value={visitedItems.length} tone="emerald" />
          <SummaryKpi icon={Banknote} label="Cobros registrados" value={paidItems.length} tone="emerald" />
          <SummaryKpi icon={CalendarClock} label="Pendientes" value={pendingItems.length} tone="blue" />
          <SummaryKpi icon={AlertTriangle} label="No localizados" value={failedItems.length} tone="red" />
          <SummaryKpi icon={History} label="Promesas de pago" value={promisedItems.length} tone="amber" />
          <SummaryKpi icon={Target} label="Recuperacion" value={`${routeProgress}%`} tone="blue" />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.68fr)_minmax(320px,0.78fr)]">
          <div className="space-y-6">
            <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
              <div className="border-b border-[#E5E7EB] px-6 py-5">
                <div className="flex flex-wrap gap-2">
                  {detailTabs.map(tab => {
                    const Icon = tab.icon;
                    const active = detailTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id)}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
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

              {(detailTab === 'summary' || detailTab === 'clients') && (
                <>
                  <div className="border-b border-[#E5E7EB] px-6 py-5">
                    <h2 className="text-[28px] font-black tracking-tight text-[#111827]">
                      {detailTab === 'summary' ? 'Clientes en la ruta' : 'Clientes asignados'}
                    </h2>
                    <p className="mt-2 text-[15px] font-medium text-[#64748B]">
                      {detailTab === 'summary'
                        ? 'Vista central del recorrido con clientes, estados y acciones directas.'
                        : 'Relacion completa de clientes incluidos en este recorrido operativo.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-[minmax(220px,1.55fr)_minmax(110px,0.75fr)_minmax(110px,0.72fr)_minmax(110px,0.72fr)_132px] gap-4 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    <span>Cliente</span>
                    <span>Telefono</span>
                    <span>Esperado</span>
                    <span>Estado</span>
                    <span className="text-center">Acciones</span>
                  </div>
                  <div className="divide-y divide-[#EEF2F7]">
                    {[...activeRouteData.items].sort((a, b) => a.order - b.order).map(item => {
                      const client = getClientById(item.clientId);
                      const itemStatus =
                        item.visitStatus === 'PAID'
                          ? 'Cobrado'
                          : item.visitStatus === 'FAILED'
                            ? 'No pago'
                            : item.visitStatus === 'PROMISED'
                              ? 'Promesa'
                              : item.visitStatus === 'VISITED'
                                ? 'Visitado'
                                : 'Pendiente';

                      return (
                        <div
                          key={item.id}
                          data-routes-row
                          className="group grid grid-cols-[minmax(220px,1.55fr)_minmax(110px,0.75fr)_minmax(110px,0.72fr)_minmax(110px,0.72fr)_132px] items-center gap-4 px-6 py-4 transition-colors duration-200 hover:bg-[#FCFDFF]"
                        >
                          <button onClick={() => navigate(`/clients/${item.clientId}`)} className="flex min-w-0 items-center gap-3 text-left">
                            <ClientAvatar
                              client={client || { firstName: item.clientName, lastName: '', photo: '' }}
                              className="h-11 w-11 rounded-2xl shadow-[0_10px_22px_rgba(37,99,235,0.12)]"
                              textClassName="text-[15px] font-black text-[#2563EB]"
                            />
                            <div className="min-w-0 transition-transform duration-200 group-hover:translate-x-1">
                              <p className="truncate text-[16px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{item.clientName}</p>
                              <p className="mt-1 truncate text-[12px] font-medium text-[#94A3B8]">{item.address}</p>
                            </div>
                          </button>
                          <span className="text-[14px] font-medium text-[#64748B]">{client?.phone || 'Sin telefono'}</span>
                          <div>
                            <p className="text-[15px] font-bold text-[#111827]">{formatCurrency(item.amountToCollect)}</p>
                            <p className="mt-1 text-[11px] font-medium text-[#94A3B8]">Orden {item.order}</p>
                          </div>
                          <div className="flex">
                            <RouteVisitStatusBadge status={itemStatus} />
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <div className="group/tooltip relative">
                              <button
                                type="button"
                                onClick={() => navigate(`/clients/${item.clientId}`)}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`}
                                aria-label="Ver cliente"
                              >
                                <Eye size={16} />
                              </button>
                              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-xl bg-[#111827] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition-all duration-200 group-hover/tooltip:-translate-y-1 group-hover/tooltip:opacity-100">
                                Ver cliente
                              </span>
                            </div>
                            <div className="group/tooltip relative">
                              <button
                                type="button"
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`, '_blank')}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`}
                                aria-label="Abrir mapa"
                              >
                                <MapPin size={16} />
                              </button>
                              <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-xl bg-[#111827] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition-all duration-200 group-hover/tooltip:-translate-y-1 group-hover/tooltip:opacity-100">
                                Abrir mapa
                              </span>
                            </div>
                            {item.visitStatus === 'PENDING' ? (
                              <div className="group/tooltip relative">
                                <button
                                  type="button"
                                  onClick={() => setShowCollectionModal(item)}
                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`}
                                  aria-label="Registrar cobro"
                                >
                                  <Banknote size={16} />
                                </button>
                                <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-xl bg-[#111827] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition-all duration-200 group-hover/tooltip:-translate-y-1 group-hover/tooltip:opacity-100">
                                  Registrar cobro
                                </span>
                              </div>
                            ) : (
                              <div className="group/tooltip relative">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateVisitResult(activeRouteId, item.id, 'NO ESTABA', 'VISITED')}
                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`}
                                  aria-label="Registrar visita"
                                >
                                  <Navigation size={16} />
                                </button>
                                <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-xl bg-[#111827] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition-all duration-200 group-hover/tooltip:-translate-y-1 group-hover/tooltip:opacity-100">
                                  Registrar visita
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {detailTab === 'collections' && (
                <>
                  <div className="border-b border-[#E5E7EB] px-6 py-5">
                    <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Cobros y visitas</h2>
                    <p className="mt-2 text-[15px] font-medium text-[#64748B]">Seguimiento detallado de clientes visitados, cobros registrados y promesas activas.</p>
                  </div>
                  <div className="space-y-3 px-6 py-6">
                    {collectionItems.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-[#E5E7EB] px-5 py-12 text-center">
                        <History size={32} className="mx-auto text-[#CBD5E1]" />
                        <p className="mt-3 text-[15px] font-semibold text-[#64748B]">Todavia no hay cobros ni visitas registradas en esta ruta.</p>
                      </div>
                    ) : (
                      collectionItems.map(item => (
                        <div key={item.id} data-routes-row className={`flex items-center justify-between rounded-[24px] border border-[#E5E7EB] bg-white px-5 py-4 ${horizontalMotionClass}`}>
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                                item.visitStatus === 'PAID'
                                  ? 'bg-[#DCFCE7] text-[#16A34A]'
                                  : item.visitStatus === 'PROMISED'
                                    ? 'bg-[#EDE9FE] text-[#8B5CF6]'
                                    : item.visitStatus === 'FAILED'
                                      ? 'bg-[#FEE2E2] text-[#DC2626]'
                                      : 'bg-[#DBEAFE] text-[#2563EB]'
                              }`}
                            >
                              {item.visitStatus === 'PAID' ? <Banknote size={18} /> : item.visitStatus === 'PROMISED' ? <History size={18} /> : item.visitStatus === 'FAILED' ? <AlertTriangle size={18} /> : <Navigation size={18} />}
                            </div>
                            <div>
                              <p className="text-[15px] font-bold text-[#111827]">{item.clientName}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#64748B]">{item.visitResult || item.visitStatus}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-semibold text-[#111827]">{formatCurrency(item.amountToCollect)}</p>
                            <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">Parada {item.order}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {detailTab === 'map' && (
                <div className="px-6 py-6">
                  <div className="overflow-hidden rounded-[24px] border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-6">
                    <div className="overflow-hidden rounded-[20px] border border-[#DBEAFE] bg-white shadow-[0_18px_36px_rgba(37,99,235,0.08)]">
                      <iframe
                        title="Mapa de cobertura de la ruta"
                        src={mapEmbedUrl}
                        className="h-[320px] w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 rounded-[20px] bg-white px-4 py-3">
                      <div>
                        <p className="text-[14px] font-semibold text-[#111827]">Cobertura actual de la ruta</p>
                        <p className="mt-1 text-[13px] font-medium text-[#64748B]">Mini mapa operativo; el live tracking estilo Uber lo integramos en la siguiente fase.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${mapTarget}`, '_blank')}
                      className={`mt-4 inline-flex items-center gap-2 text-[14px] font-semibold text-[#2563EB] ${horizontalMotionClass}`}
                    >
                      <MapPin size={16} />
                      Ver mapa completo
                    </button>
                  </div>
                </div>
              )}

              {detailTab === 'history' && (
                <>
                  <div className="border-b border-[#E5E7EB] px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-[26px] font-black tracking-tight text-[#111827]">Historial de la ruta</h2>
                      <button type="button" onClick={() => navigate('/activity')} className={`text-[14px] font-semibold text-[#2563EB] ${horizontalMotionClass}`}>
                        Ver toda la actividad
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 px-6 py-6">
                    {routeActivity.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-[#E5E7EB] px-5 py-10 text-center">
                        <History size={32} className="mx-auto text-[#CBD5E1]" />
                        <p className="mt-3 text-[15px] font-semibold text-[#64748B]">Todavia no hay actividad registrada en esta ruta.</p>
                      </div>
                    ) : (
                      routeActivity.map(item => (
                        <div key={item.id} data-routes-row className={`flex items-center justify-between rounded-[24px] border border-[#E5E7EB] bg-white px-4 py-4 ${horizontalMotionClass}`}>
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                                item.visitStatus === 'PAID'
                                  ? 'bg-[#DCFCE7] text-[#16A34A]'
                                  : item.visitStatus === 'PROMISED'
                                    ? 'bg-[#EDE9FE] text-[#8B5CF6]'
                                    : item.visitStatus === 'FAILED'
                                      ? 'bg-[#FEE2E2] text-[#DC2626]'
                                      : 'bg-[#DBEAFE] text-[#2563EB]'
                              }`}
                            >
                              {item.visitStatus === 'PAID' ? <Banknote size={18} /> : item.visitStatus === 'PROMISED' ? <History size={18} /> : item.visitStatus === 'FAILED' ? <AlertTriangle size={18} /> : <Navigation size={18} />}
                            </div>
                            <div>
                              <p className="text-[15px] font-bold text-[#111827]">{item.clientName}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#64748B]">{item.visitResult || item.visitStatus}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-semibold text-[#111827]">{formatCurrency(item.amountToCollect)}</p>
                            <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">Parada {item.order}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </article>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article data-routes-panel className="relative rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Estado de la ruta</h2>
              {activeRouteTooltip ? (
                <div className="pointer-events-none absolute right-6 top-6 z-10 w-[250px] rounded-[24px] border border-[#E5E7EB] bg-white/95 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                  <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{activeRouteTooltip.label}</p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#111827]">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeRouteTooltip.color }} />
                      Proporcion
                    </span>
                    <span className="text-[28px] font-black tracking-tight text-[#111827]">{activeRouteTooltip.percent}%</span>
                  </div>
                  <p className="mt-3 text-[13px] font-medium leading-6 text-[#64748B]">{activeRouteTooltip.helper}</p>
                </div>
              ) : null}
              <div className="mt-6 flex items-center gap-6">
                <div
                  className="relative flex h-40 w-40 items-center justify-center rounded-full"
                  style={{ backgroundImage: routeDonut }}
                  onMouseEnter={() => {
                    const maxSeg = [...routeSegments].sort((a, b) => b.value - a.value)[0];
                    setHoveredRouteSegment(maxSeg ? maxSeg.label : 'Cobrados');
                  }}
                  onMouseLeave={() => setHoveredRouteSegment(null)}
                >
                  <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center">
                    <span className="text-[34px] font-black text-[#111827]">{activeRouteData.items.length}</span>
                    <span className="text-[12px] font-semibold text-[#64748B]">Clientes</span>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <LegendRow
                    label="Cobrados"
                    color="bg-[#22C55E]"
                    value={`${paidItems.length} (${Math.round((paidItems.length / itemCount) * 100)}%)`}
                    onMouseEnter={() => setHoveredRouteSegment('Cobrados')}
                    onMouseLeave={() => setHoveredRouteSegment(null)}
                  />
                  <LegendRow
                    label="Pendientes"
                    color="bg-[#3B82F6]"
                    value={`${pendingItems.length} (${Math.round((pendingItems.length / itemCount) * 100)}%)`}
                    onMouseEnter={() => setHoveredRouteSegment('Pendientes')}
                    onMouseLeave={() => setHoveredRouteSegment(null)}
                  />
                  <LegendRow
                    label="No localizados"
                    color="bg-[#F97316]"
                    value={`${failedItems.length} (${Math.round((failedItems.length / itemCount) * 100)}%)`}
                    onMouseEnter={() => setHoveredRouteSegment('No localizados')}
                    onMouseLeave={() => setHoveredRouteSegment(null)}
                  />
                  <LegendRow
                    label="Promesas"
                    color="bg-[#8B5CF6]"
                    value={`${promisedItems.length} (${Math.round((promisedItems.length / itemCount) * 100)}%)`}
                    onMouseEnter={() => setHoveredRouteSegment('Promesas')}
                    onMouseLeave={() => setHoveredRouteSegment(null)}
                  />
                </div>
              </div>
            </article>

            <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Cobranza acumulada</h2>
              <div className="mt-6 space-y-5">
                <MetricRow label="Esperado" value={formatCurrency(totalToCollect)} accent="bg-[#CBD5E1]" percent={100} />
                <MetricRow label="Cobrado" value={formatCurrency(collectedAmount)} accent="bg-[#22C55E]" percent={routeProgress} />
                <MetricRow label="Restante" value={formatCurrency(Math.max(totalToCollect - collectedAmount, 0))} accent="bg-[#F97316]" percent={Math.max(100 - routeProgress, 0)} />
              </div>
            </article>

            <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Mapa / recorrido</h2>
              <div className="mt-5 overflow-hidden rounded-[24px] border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-6">
                <div className="overflow-hidden rounded-[20px] border border-[#DBEAFE] bg-white shadow-[0_18px_36px_rgba(37,99,235,0.08)]">
                  <iframe
                    title="Mini mapa de la ruta"
                    src={mapEmbedUrl}
                    className="h-44 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <p className="mt-3 text-[13px] font-medium text-[#64748B]">Mini mapa operativo de la ruta actual. El live tracking lo montamos cuando integremos la capa GPS.</p>
                <button
                  type="button"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeBranchData?.address || activeBranchData?.name || 'Ruta')}`, '_blank')}
                  className="mt-4 inline-flex items-center gap-2 text-[14px] font-semibold text-[#2563EB]"
                >
                  <MapPin size={16} />
                  Ver mapa completo
                </button>
              </div>
            </article>

            <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Resumen del cobrador</h2>
              <div className="mt-6 flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#DBEAFE] text-[24px] font-black text-[#2563EB]">
                  {(activeCollector?.name || 'OC').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[20px] font-bold text-[#111827]">{activeCollector?.name || 'Oficial de cobro'}</p>
                  <p className="mt-1 text-[14px] font-medium text-[#64748B]">{activeCollector?.phone || 'Sin telefono registrado'}</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <LegendRow label="Rutas activas" color="bg-[#2563EB]" value={`${routeStats.open + routeStats.inProgress}`} />
                <LegendRow label="Visitas registradas" color="bg-[#22C55E]" value={`${visitedItems.length}`} />
                <LegendRow label="GPS activo" color="bg-[#22C55E]" value="En linea" />
                <LegendRow label="Ultima actualizacion" color="bg-[#94A3B8]" value={new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })} />
              </div>
            </article>
          </div>
        </section>

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
      <section data-routes-hero>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[52px] font-black leading-none tracking-tight text-[#111827]">Rutas</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
              Controla la operacion diaria de recorridos, asignaciones, ejecucion en campo y cierres de ruta.
            </p>
          </div>
          {!isCollector && (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={openRouteGenerator}
                className={`inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm ${horizontalMotionClass}`}
              >
                <Plus size={18} />
                Crear ruta
              </button>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]"
              >
                <History size={18} />
                Ver reportes
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
            <article
              key={kpi.label}
              data-routes-kpi
              className="group relative overflow-hidden rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm"
            >
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${tone.iconWrap}`}>
                  <Icon size={24} />
                </div>
                <div className={`rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${kpi.trendTone}`}>{kpi.trend}</div>
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
                <p className={`mt-3 max-w-[185px] text-[15px] font-medium leading-6 ${tone.note}`}>{kpi.helper}</p>
              </div>
              <Icon size={72} className={`absolute bottom-4 right-4 ${tone.watermark} opacity-70`} strokeWidth={1.7} />
            </article>
          );
        })}
      </section>

      <section data-routes-filter className="relative z-30 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[210px_210px_210px_minmax(260px,1fr)_auto]">
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
            placeholder="Todos los cobradores"
            options={collectors.map(collector => ({ value: collector.id, label: collector.name }))}
          />
          <FilterDropdown
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="Todas las rutas"
            options={statusOptions.filter(option => option.value).map(option => ({ value: option.value, label: option.label }))}
          />
          <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD]">
            <Search size={18} className="text-[#6B7280]" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar codigo, cobrador, sucursal o fecha"
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.68fr)_minmax(320px,0.78fr)]">
        <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Listado de rutas</h2>
                <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[13px] font-semibold text-[#64748B]">{filteredRouteRows.length} rutas</span>
              </div>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">
                Despacho, seguimiento de avance y acceso rapido al detalle de cada recorrido.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/activity')}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
            >
              Ver actividad
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-[minmax(220px,1.55fr)_minmax(140px,0.8fr)_minmax(120px,0.72fr)_minmax(120px,0.72fr)_96px_72px] gap-4 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
            <span>Ruta</span>
            <span className="text-center">Cobrador</span>
            <span className="text-center">Esperado</span>
            <span className="text-center">Cobrado</span>
            <span className="text-center">Estado</span>
            <span className="text-center">Accion</span>
          </div>

          <div className="divide-y divide-[#EEF2F7]">
            {filteredRouteRows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <MapIcon size={40} className="mx-auto text-[#CBD5E1]" />
                <p className="mt-4 text-[16px] font-semibold text-[#64748B]">No hay rutas para los filtros actuales.</p>
              </div>
            ) : (
              paginatedRouteRows.map(row => (
                <div key={row.id} data-routes-row className="group px-4 py-3 transition-colors duration-200 hover:bg-[#FCFDFF]">
                  <div className="grid grid-cols-[minmax(220px,1.55fr)_minmax(140px,0.8fr)_minmax(120px,0.72fr)_minmax(120px,0.72fr)_96px_72px] items-center gap-4 rounded-[24px] px-2 py-2">
                    <div className="min-w-0 transition-transform duration-200 group-hover:translate-x-2">
                      <button type="button" onClick={() => setActiveRouteId(row.id)} className="min-w-0 text-left">
                        <p className="truncate text-[17px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{row.code}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[#64748B]">
                          <span>{formatDate(row.route.date)}</span>
                          <span className="text-[#CBD5E1]">•</span>
                          <span>{row.branchName}</span>
                        </div>
                        <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{row.clientsCount} clientes asignados</p>
                      </button>
                    </div>

                    <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                      <p className="line-clamp-1 text-[13px] font-semibold text-[#111827]">{row.collectorName}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#64748B]">{row.promised} promesas • {row.failed} no loc.</p>
                    </div>

                    <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                      <p className="text-[16px] font-bold text-[#111827]">{formatCurrency(row.expected)}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#64748B]">Meta del recorrido</p>
                    </div>

                    <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                      <p className="text-[16px] font-bold text-[#111827]">{formatCurrency(row.collected)}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#16A34A]">{row.progress}% recuperado</p>
                    </div>

                    <div className="flex justify-center transition-transform duration-200 group-hover:translate-x-2">
                      <RouteStatusBadge status={row.route.status} />
                    </div>

                    <div className="flex justify-center">
                      <div className="group/tooltip relative">
                        <button
                          type="button"
                          onClick={() => setActiveRouteId(row.id)}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`}
                          aria-label="Abrir ruta"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-[#111827] px-3 py-1 text-[11px] font-semibold text-white opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition-all duration-200 group-hover/tooltip:-translate-y-1 group-hover/tooltip:opacity-100">
                          Abrir ruta
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {filteredRouteRows.length > pageSize && (
            <div className="flex flex-col gap-4 border-t border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-[15px] font-medium text-[#64748B]">
                Mostrando {(safeCurrentPage - 1) * pageSize + 1} a {Math.min(safeCurrentPage * pageSize, filteredRouteRows.length)} de {filteredRouteRows.length} registros
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
          <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Resumen operativo</h2>
            <p className="mt-2 text-[15px] font-medium text-[#64748B]">Lectura rapida del estado general del despacho.</p>
            <div className="mt-6 space-y-5">
              <MetricRow label="Rutas abiertas" value={`${routeStats.open}`} accent="bg-[#2563EB]" percent={routeRows.length > 0 ? Math.round((routeStats.open / routeRows.length) * 100) : 0} />
              <MetricRow label="Rutas en curso" value={`${routeStats.inProgress}`} accent="bg-[#16A34A]" percent={routeRows.length > 0 ? Math.round((routeStats.inProgress / routeRows.length) * 100) : 0} />
              <MetricRow label="Rutas cerradas" value={`${routeStats.closed}`} accent="bg-[#94A3B8]" percent={routeRows.length > 0 ? Math.round((routeStats.closed / routeRows.length) * 100) : 0} />
              <MetricRow label="Cobertura" value={`${routeStats.coverage}%`} accent="bg-[#F59E0B]" percent={routeStats.coverage} />
            </div>
          </article>

          <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <div>
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Rutas activas</h2>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">Acceso rapido a recorridos abiertos o en ejecucion.</p>
            </div>
            <div className="mt-6 space-y-3">
              {openRoutes.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#E5E7EB] px-5 py-10 text-center">
                  <RouteIcon size={32} className="mx-auto text-[#CBD5E1]" />
                  <p className="mt-3 text-[15px] font-semibold text-[#64748B]">No hay rutas activas hoy.</p>
                </div>
              ) : (
                openRoutes.slice(0, 3).map(route => {
                  const collector = collectors.find(user => user.id === route.collectorId);
                  const progress = route.items.length > 0 ? Math.round((route.items.filter(item => item.visitStatus !== 'PENDING').length / route.items.length) * 100) : 0;
                  const expected = route.items.reduce((sum, item) => sum + item.amountToCollect, 0);

                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setActiveRouteId(route.id)}
                      data-routes-row
                      className={`group flex w-full flex-col rounded-[26px] border bg-white p-5 text-left shadow-sm ${horizontalMotionClass}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[18px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">
                            {collector?.name || 'Oficial de cobro'}
                          </p>
                          <p className="mt-1 text-[13px] font-medium text-[#64748B]">{route.items.length} paradas • {formatDate(route.date)}</p>
                        </div>
                        <RouteStatusBadge status={route.status} />
                      </div>

                      <div className="mt-4 flex items-center justify-between text-[14px] font-medium text-[#64748B]">
                        <span>{formatCurrency(expected)}</span>
                        <span className="font-semibold text-[#111827]">{progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                        <div className="h-full rounded-full bg-[#2563EB] transition-all duration-700" style={{ width: `${progress}%` }} />
                      </div>

                      {!isCollector && route.status === RouteStatus.OPEN && (
                        <span
                          onClick={event => {
                            event.stopPropagation();
                            handleStartRoute(route.id);
                          }}
                          className="mt-4 inline-flex h-10 self-start items-center gap-2 rounded-2xl bg-[#2563EB] px-3 text-[13px] font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.2)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]"
                        >
                          <Bike size={16} />
                          Despachar
                        </span>
                      )}
                      {!isCollector && route.status === RouteStatus.IN_PROGRESS && (
                        <span
                          onClick={event => {
                            event.stopPropagation();
                            setSettlementRoute(route);
                            setCashInHand(route.items.reduce((acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0));
                          }}
                          className="mt-4 inline-flex h-10 self-start items-center gap-2 rounded-2xl bg-[#16A34A] px-3 text-[13px] font-semibold text-white shadow-[0_18px_36px_rgba(22,163,74,0.2)] transition-all duration-200 hover:translate-x-1 hover:bg-[#15803D]"
                        >
                          <CheckCircle2 size={16} />
                          Liquidar
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {openRoutes.length > 3 && <p className="mt-4 text-[13px] font-medium text-[#64748B]">Mostrando 3 de {openRoutes.length} rutas activas.</p>}
          </article>

          <article data-routes-panel className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Cierres recientes</h2>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Rutas archivadas con monto conciliado.</p>
              </div>
              <button type="button" onClick={() => navigate('/reports')} className={`inline-flex h-10 min-w-[132px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[12px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                Ver reportes
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="mt-6 space-y-3">
              {historyRoutes.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#E5E7EB] px-5 py-10 text-center">
                  <History size={32} className="mx-auto text-[#CBD5E1]" />
                  <p className="mt-3 text-[15px] font-semibold text-[#64748B]">Todavia no hay cierres archivados.</p>
                </div>
              ) : (
                historyRoutes.slice(0, 5).map(route => {
                  const collector = collectors.find(user => user.id === route.collectorId);
                  const collected = route.items.reduce((sum, item) => sum + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0);

                  return (
                    <div
                      key={route.id}
                      data-routes-row
                      className={`flex items-center justify-between rounded-[24px] border border-[#E5E7EB] bg-white p-4 ${horizontalMotionClass}`}
                    >
                      <div>
                        <p className="text-[16px] font-bold text-[#111827]">{collector?.name || 'Oficial de cobro'}</p>
                        <p className="mt-1 text-[13px] font-medium text-[#64748B]">{formatDate(route.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[18px] font-bold text-[#111827]">{formatCurrency(collected)}</p>
                        <p className="mt-1 text-[13px] font-medium text-[#16A34A]">Liquidado</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </div>
      </section>

      {settlementRoute && !isCollector && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-8 py-7">
              <div>
                <h3 className="text-[34px] font-black tracking-tight text-[#111827]">Liquidar ruta</h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Cierre de caja y archivo del recorrido ejecutado.</p>
              </div>
              <button
                type="button"
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
                    <p className="mt-2 text-[38px] font-black tracking-tight">
                      {formatCurrency(settlementRoute.items.reduce((acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/60">Cobros efectivos</p>
                    <p className="mt-2 text-[32px] font-black tracking-tight">
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
                  className="h-[72px] w-full rounded-[28px] border border-[#E5E7EB] bg-white px-6 text-[30px] font-black tracking-tight text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD]"
                  value={cashInHand}
                  onChange={event => setCashInHand(Number(event.target.value))}
                  autoFocus
                />
              </div>

              {cashInHand > 0 &&
                cashInHand !== settlementRoute.items.reduce((acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0) && (
                  <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-5 text-[14px] font-medium text-[#991B1B]">
                    Existe una diferencia de{' '}
                    <span className="font-bold">
                      {formatCurrency(
                        Math.abs(cashInHand - settlementRoute.items.reduce((acc, item) => acc + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0)),
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

      {showCollectionModal && (
        <CollectionModal
          paymentData={showCollectionModal}
          currentUser={currentUser}
          initialView="MAIN"
          onClose={() => setShowCollectionModal(null)}
          onSuccess={() => {
            if (!activeRouteId) return;
            handleUpdateVisitResult(activeRouteId, showCollectionModal.id, 'COBRÓ', 'PAID');
            setShowCollectionModal(null);
          }}
        />
      )}
    </div>
  );
};

const InfoBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFE] px-4 py-4">
    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{label}</p>
    <p className="mt-3 text-[16px] font-bold text-[#111827]">{value}</p>
  </div>
);

const RouteInfoCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="bg-white p-5">
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">{label}</p>
        <p className="mt-2 text-[22px] font-black tracking-tight text-[#111827]">{value}</p>
      </div>
    </div>
  </div>
);

const SummaryKpi = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number | string;
  tone: keyof typeof kpiToneMap;
}) => {
  const colors = kpiToneMap[tone];
  return (
    <article data-routes-kpi className="rounded-[28px] border border-[#E5E7EB] bg-white p-5 text-center shadow-sm">
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${colors.iconWrap}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-[14px] font-semibold text-[#64748B]">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{value}</p>
    </article>
  );
};

const LegendRow = ({
  label,
  color,
  value,
  onMouseEnter,
  onMouseLeave,
}: {
  label: string;
  color: string;
  value: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) => (
  <div
    className="flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F8FAFC] px-1.5 py-1 rounded-xl transition-all duration-200"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span className="text-[14px] font-medium text-[#64748B]">{label}</span>
    </div>
    <span className="text-[14px] font-semibold text-[#111827]">{value}</span>
  </div>
);

const MetricRow = ({
  label,
  value,
  accent,
  percent,
}: {
  label: string;
  value: string;
  accent: string;
  percent: number;
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-4">
      <span className="text-[14px] font-medium text-[#64748B]">{label}</span>
      <span className="text-[14px] font-semibold text-[#111827]">{value}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
      <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }} />
    </div>
  </div>
);

const RouteStatusBadge = ({ status }: { status: RouteStatus }) => {
  const classes =
    status === RouteStatus.OPEN
      ? 'border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB]'
      : status === RouteStatus.IN_PROGRESS
        ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
        : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#475569]';

  return <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${classes}`}>{status}</span>;
};

const RouteVisitStatusBadge = ({ status }: { status: string }) => {
  const normalized = status.toLowerCase();
  const classes = normalized.includes('cobrado')
    ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
    : normalized.includes('promesa')
      ? 'border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED]'
      : normalized.includes('visitado')
        ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
        : normalized.includes('mora') || normalized.includes('no pago') || normalized.includes('no localizado')
          ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
          : 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]';

  return <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${classes}`}>{status}</span>;
};

const CALENDAR_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CALENDAR_WEEKDAYS = ['do.', 'lu.', 'ma.', 'mi.', 'ju.', 'vi.', 'sa.'];

const parseIsoDate = (value: string) => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const buildCalendarDays = (monthDate: Date) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDay = firstDay.getDay();
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startDay);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return day;
  });
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CalendarField = ({
  value,
  onChange,
  placeholder,
  allowClear = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  allowClear?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const base = value ? parseIsoDate(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!value) return;
    const base = parseIsoDate(value);
    setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedDate = value ? parseIsoDate(value) : null;
  const calendarDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);
  const todayIso = toIsoDate(new Date());

  return (
    <div ref={containerRef} className={`relative ${isOpen ? 'z-[80]' : 'z-20'}`}>
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className={`flex h-[56px] w-full items-center justify-between gap-3 rounded-2xl border bg-white px-5 text-left transition-all duration-200 ${
          isOpen ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]' : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className={`truncate text-[15px] font-semibold ${value ? 'text-[#111827]' : 'text-[#94A3B8]'}`}>{value ? formatDate(value) : placeholder}</span>
        <Calendar size={18} className={`transition-colors duration-200 ${isOpen ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+10px)] w-[320px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] animate-[platform-fade-in_180ms_ease-out]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setDisplayMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-[15px] font-black text-[#111827]">
              {CALENDAR_MONTHS[displayMonth.getMonth()]} de {displayMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setDisplayMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {CALENDAR_WEEKDAYS.map(day => (
              <div key={day} className="text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                {day}
              </div>
            ))}
            {calendarDays.map(day => {
              const dayIso = toIsoDate(day);
              const isSelected = !!selectedDate && dayIso === toIsoDate(selectedDate);
              const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
              const isToday = dayIso === todayIso;
              return (
                <button
                  key={dayIso}
                  type="button"
                  onClick={() => {
                    onChange(dayIso);
                    setIsOpen(false);
                  }}
                  className={`flex h-10 items-center justify-center rounded-2xl text-[14px] font-semibold transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#2563EB] text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]'
                      : isToday
                        ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                        : isCurrentMonth
                          ? 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                          : 'text-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4">
            <button
              type="button"
              onClick={() => {
                if (!allowClear) return;
                onChange('');
                setIsOpen(false);
              }}
              disabled={!allowClear}
              className={`text-[14px] font-semibold transition-colors duration-200 ${
                allowClear ? 'text-[#64748B] hover:text-[#2563EB]' : 'cursor-not-allowed text-[#CBD5E1]'
              }`}
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setIsOpen(false);
              }}
              className="text-[14px] font-semibold text-[#2563EB] transition-colors duration-200 hover:text-[#1D4ED8]"
            >
              Hoy
            </button>
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
            ? 'cursor-not-allowed border-[#E5E7EB] opacity-60'
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
