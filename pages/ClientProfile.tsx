import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import gsap from 'gsap';
import {
  addFicha,
  getClientById,
  getClientFichas,
  getClientLoans,
  getClientPayments,
  getClientPromises,
  getClientVisits,
  getCompanies,
  removePaymentFromLocalStorage,
  updateClient as updateLocalClient,
  updateClientStatus,
  upsertCashMovementsInLocalStorage,
  upsertClientsInLocalStorage,
  upsertLoansInLocalStorage,
  upsertPaymentsInLocalStorage,
  voidPayment,
} from '../services/dataService';
import { getBranchScope, getScopedUsers } from '../services/viewScope';
import {
  Branch,
  Client,
  ClientStatus,
  Company,
  Ficha,
  FichaType,
  Loan,
  PaymentPromise,
  PaymentReceipt,
  ReportTemplate,
  Role,
  User,
  VisitLog,
} from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import { ClientAvatar } from '../components/ui/ClientAvatar';
import {
  buildPlatformPdfFileName,
  createPlatformPdfDoc,
  drawPlatformPdfCard,
  drawPlatformPdfFooter,
  getPlatformPdfVisualPreset,
  platformPdfMarginByPreset,
  renderPlatformPdfDocument,
  resolvePlatformPdfTemplateConfig,
} from '../services/pdfBuilder';
import { emitPlatformToast } from '../services/platformEvents';
import { getPersistedPdfTemplateId, setPersistedPdfTemplateId } from '../services/pdfTemplateSelection';
import { optimizeImageFile } from '../services/imageOptimizer';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Edit2,
  FileText,
  Image as ImageIcon,
  MapPin,
  Phone,
  Plus,
  Printer,
  Save,
  ShieldAlert,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

type TabKey = 'RESUMEN' | 'EDITAR' | 'FICHAS' | 'PAGOS' | 'VISITAS' | 'PROMESAS' | 'DOCUMENTOS';

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'RESUMEN', label: 'Resumen', icon: CheckCircle2 },
  { key: 'EDITAR', label: 'Editar', icon: Edit2 },
  { key: 'FICHAS', label: 'Fichas', icon: FileText },
  { key: 'PAGOS', label: 'Historial de pagos', icon: Wallet },
  { key: 'VISITAS', label: 'Notas de visita', icon: CalendarClock },
  { key: 'PROMESAS', label: 'Promesas', icon: Clock3 },
  { key: 'DOCUMENTOS', label: 'Documentos', icon: Download },
];

const cleanTextInput = (value: string) => value.replace(/\s+/g, ' ').trimStart();

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatCedulaInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
};

const getShortId = (value?: string | null) => (value ? value.slice(0, 8).toUpperCase() : 'SIN-ID');

const getPaymentPrincipalPortion = (payment: PaymentReceipt) => {
  const baseAmount = Math.max(payment.amount - (payment.moraPaid || 0), 0);
  return Math.round(baseAmount * 0.78 * 100) / 100;
};

const getPaymentInterestPortion = (payment: PaymentReceipt) => {
  const baseAmount = Math.max(payment.amount - (payment.moraPaid || 0), 0);
  return Math.round(baseAmount * 0.22 * 100) / 100;
};

export const ClientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [promises, setPromises] = useState<PaymentPromise[]>([]);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [selectedPdfTemplateId, setSelectedPdfTemplateId] = useState<string>('');
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabKey>('RESUMEN');
  const [statementView, setStatementView] = useState<'statement' | 'payments' | null>(null);
  const [isStatementTemplateDropdownOpen, setIsStatementTemplateDropdownOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [openEditField, setOpenEditField] = useState<'branch' | 'assignee' | null>(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ type: FichaType.REGULAR, reason: '', note: '' });
  const [openIncidentField, setOpenIncidentField] = useState<'type' | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [statusToSet, setStatusToSet] = useState<ClientStatus | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedPaymentToVoid, setSelectedPaymentToVoid] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [selectedLoanDetail, setSelectedLoanDetail] = useState<Loan | null>(null);
  const [hoveredBehaviorLabel, setHoveredBehaviorLabel] = useState<string | null>(null);

  const isCollector = currentUser?.role === Role.COBRADOR;
  const branchScope = useMemo(() => (currentUser ? getBranchScope(currentUser) : null), [currentUser]);
  const visibleBranchIds = branchScope?.visibleBranchIds || [];

  useEffect(() => {
    if (currentUser) {
      setUsers(getScopedUsers(currentUser));
      setBranches(branchScope?.branches || []);
      setCompany(getCompanies().find(entry => entry.id === currentUser.companyId));
      if (id) void loadData(id);
    }
  }, [branchScope, currentUser, id]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    void apiClient
      .listReportTemplates()
      .then(response => {
        if (cancelled) return;
        setReportTemplates(response.data);
      })
      .catch(() => {
        if (cancelled) return;
        setReportTemplates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    const state = location.state as { initialTab?: TabKey } | null;
    if (!state) return;
    if (state.initialTab) setActiveTab(state.initialTab);
  }, [location.state]);

  useEffect(() => {
    if (!pageRef.current || !client) return;

    const ctx = gsap.context(() => {
      gsap.fromTo('[data-client-hero]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
      gsap.fromTo(
        '[data-client-kpi]',
        { opacity: 0, y: 24, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: 0.44, ease: 'power3.out', stagger: 0.05, delay: 0.04 },
      );
      gsap.fromTo('[data-client-main]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.44, ease: 'power3.out', delay: 0.1 });
      gsap.fromTo('[data-client-side]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.44, ease: 'power3.out', delay: 0.14 });
    }, pageRef);

    return () => ctx.revert();
  }, [client]);

  const loadData = async (clientId: string) => {
    let localClient = getClientById(clientId);
    let clientLoans = getClientLoans(clientId);
    let clientPayments = getClientPayments(clientId);

    try {
      const [clientsResponse, loansResponse, paymentsResponse] = await Promise.all([
        apiClient.listClients(),
        apiClient.listLoans(),
        apiClient.listPayments(),
      ]);
      upsertClientsInLocalStorage(clientsResponse.data);
      upsertLoansInLocalStorage(loansResponse.data);
      upsertPaymentsInLocalStorage(paymentsResponse.data);
      localClient = clientsResponse.data.find(item => item.id === clientId);
      clientLoans = loansResponse.data.filter(loan => loan.clientId === clientId);
      const loanIds = new Set(clientLoans.map(loan => loan.id));
      clientPayments = paymentsResponse.data.filter(payment => loanIds.has(payment.loanId));
    } catch {
      localClient = getClientById(clientId);
      clientLoans = getClientLoans(clientId);
      clientPayments = getClientPayments(clientId);
    }

    if (!localClient) return;
    if (currentUser && !visibleBranchIds.includes(localClient.branchId)) {
      navigate('/clients');
      return;
    }

    setClient({ ...localClient });
    setEditForm({ ...localClient });
    setLoans(clientLoans);
    setPayments(clientPayments);
    setFichas(getClientFichas(clientId));
    setVisits(getClientVisits(clientId));
    setPromises(getClientPromises(clientId));
  };

  const assignedOfficial = useMemo(
    () => users.find(user => user.id === client?.assignedUserId),
    [client?.assignedUserId, users],
  );
  const assignedBranch = useMemo(
    () => branches.find(branch => branch.id === client?.branchId),
    [branches, client?.branchId],
  );
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
    if (!currentUser?.companyId) return;
    setPersistedPdfTemplateId(currentUser.companyId, selectedPdfTemplateId);
  }, [currentUser?.companyId, selectedPdfTemplateId]);

  useEffect(() => {
    if (statementView) return;
    setIsStatementTemplateDropdownOpen(false);
  }, [statementView]);
  const assignableUsers = useMemo(
    () =>
      users.filter(user => {
        if (![Role.ADMIN, Role.SUPERVISOR, Role.COBRADOR].includes(user.role)) return false;
        return !editForm.branchId || user.branchId === editForm.branchId;
      }),
    [editForm.branchId, users],
  );

  const portfolioSummary = useMemo(() => {
    const totalPending = loans.reduce((sum, loan) => sum + loan.balance, 0);
    const nextInstallment = loans
      .flatMap(loan => (loan.installments || []).map(installment => ({ ...installment, loanId: loan.id })))
      .find(installment => installment.status !== 'PAGADO');
    const lastPayment = [...payments].sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
    const lastVisit = [...visits].sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
    const score = client?.creditRating === FichaType.BUENA ? 82 : client?.creditRating === FichaType.MALA ? 48 : 65;
    return {
      totalPending,
      nextInstallment,
      lastPayment,
      lastVisit,
      score,
      activeLoans: loans.filter(loan => loan.status !== 'Saldado' && loan.status !== 'Cancelado').length,
      principalPending: loans.reduce((sum, loan) => sum + Math.max(0, loan.balance * 0.78), 0),
      interestPending: loans.reduce((sum, loan) => sum + Math.max(0, loan.balance * 0.22), 0),
      accumulatedLate: loans.filter(loan => loan.status === 'En Mora').reduce((sum, loan) => sum + loan.balance * 0.08, 0),
    };
  }, [client?.creditRating, loans, payments, visits]);

  const recentPayments = useMemo(
    () => [...payments].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5),
    [payments],
  );

  const recentVisits = useMemo(
    () => [...visits].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 4),
    [visits],
  );

  const promisesSummary = useMemo(
    () => [...promises].sort((a, b) => +new Date(a.date) - +new Date(b.date)).slice(0, 4),
    [promises],
  );

  const behaviorSegments = useMemo(() => {
    const total = Math.max(1, payments.length + promises.length + visits.length);
    const onTime = Math.round((payments.filter(payment => payment.moraPaid === 0).length / total) * 100);
    const followup = Math.round((visits.length / total) * 100);
    const late = Math.round((loans.filter(loan => loan.status === 'En Mora').length / total) * 100);
    const promise = Math.max(0, 100 - onTime - followup - late);
    return [
      { label: 'Al dia', value: onTime, color: '#16A34A', helper: 'Cobros al ritmo esperado y sin recargo.' },
      { label: 'En seguimiento', value: followup, color: '#2563EB', helper: 'Visitas y monitoreo operativo en curso.' },
      { label: 'Atrasos', value: late, color: '#F59E0B', helper: 'Cuotas con desviacion y foco de recuperacion.' },
      { label: 'Promesas', value: promise, color: '#7C3AED', helper: 'Compromisos activos pendientes de validar.' },
    ];
  }, [loans, payments, promises.length, visits.length]);

  const timelineRows = useMemo(() => {
    return [
      ...fichas.map(ficha => ({ id: ficha.id, date: ficha.createdAt, title: ficha.reason, detail: ficha.note || ficha.type, tone: ficha.type === FichaType.MALA ? 'text-[#DC2626]' : ficha.type === FichaType.BUENA ? 'text-[#16A34A]' : 'text-[#2563EB]' })),
      ...visits.map(visit => ({ id: visit.id, date: visit.date, title: visit.result, detail: visit.note, tone: 'text-[#2563EB]' })),
      ...promises.map(promise => ({
        id: promise.id,
        date: promise.date,
        title: `Promesa ${(promise.status || 'pendiente').toLowerCase()}`,
        detail: `${formatCurrency(promise.amount)} - ${promise.note || 'Sin nota'}`,
        tone: promise.status === 'INCUMPLIDA' ? 'text-[#DC2626]' : 'text-[#7C3AED]',
      })),
    ].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [fichas, promises, visits]);

  const triggerApprovalModal = (status: ClientStatus) => {
    setStatusToSet(status);
    setIsApprovalModalOpen(true);
  };

  const handleConfirmStatus = async () => {
    if (!client || !statusToSet) return;
    const statusLabel = statusToSet === ClientStatus.APPROVED ? 'aprobado' : 'rechazado';
    const statusTone = statusToSet === ClientStatus.APPROVED ? 'success' : 'warning';

    try {
      const response = await apiClient.updateClient(client.id, { status: statusToSet });
      upsertClientsInLocalStorage([response.data]);
      setClient({ ...response.data });
      setIsApprovalModalOpen(false);
      setStatusToSet(null);
      emitPlatformToast({
        title: `Expediente ${statusLabel}`,
        message: `${response.data.firstName} ${response.data.lastName} cambio de estado correctamente.`,
        tone: statusTone,
        durationMs: 3600,
      });
      void loadData(client.id);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        const updated = updateClientStatus(client.id, statusToSet, currentUser!);
        if (updated) {
          setClient({ ...updated });
          setIsApprovalModalOpen(false);
          setStatusToSet(null);
          emitPlatformToast({
            title: `Expediente ${statusLabel}`,
            message: `${updated.firstName} ${updated.lastName} cambio de estado en modo local.`,
            tone: statusTone,
            durationMs: 4200,
          });
          void loadData(client.id);
        }
      } else if (!(error instanceof ApiRequestError)) {
        console.error(error);
      }
    }
  };

  const buildClientUpdatePayload = () => ({
    firstName: (editForm.firstName || '').trim(),
    lastName: (editForm.lastName || '').trim(),
    nickname: (editForm.nickname || '').trim(),
    cedula: (editForm.cedula || '').trim(),
    phone: (editForm.phone || '').trim(),
    address: (editForm.address || '').trim(),
    branchId: (editForm.branchId || '').trim(),
    assignedUserId: (editForm.assignedUserId || '').trim(),
    photo: editForm.photo || '',
  });

  const handleUpdateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    const payload = buildClientUpdatePayload();

    if (!payload.firstName || !payload.lastName || !payload.cedula || !payload.phone || !payload.address) {
      setEditError('Completa los campos requeridos antes de guardar.');
      return;
    }

    setEditError('');
    setIsSavingEdit(true);

    try {
      const response = await apiClient.updateClient(id, payload);
      upsertClientsInLocalStorage([response.data]);
      setClient({ ...response.data });
      setIsSavingEdit(false);
      emitPlatformToast({
        title: 'Cliente actualizado',
        message: `${response.data.firstName} ${response.data.lastName} ya refleja los cambios del perfil.`,
        tone: 'success',
        durationMs: 3600,
      });
      void loadData(id);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        const updated = updateLocalClient(id, payload);
        if (updated) {
          setClient({ ...updated });
          setIsSavingEdit(false);
          emitPlatformToast({
            title: 'Cliente actualizado',
            message: `${updated.firstName} ${updated.lastName} se guardo en modo local correctamente.`,
            tone: 'success',
            durationMs: 4200,
          });
          void loadData(id);
          return;
        }
        setEditError('No pudimos conectar con la API y tampoco guardar localmente.');
      } else if (error instanceof ApiRequestError) {
        setEditError(error.message || 'No fue posible guardar los cambios del cliente.');
      } else {
        console.error(error);
        setEditError('Ocurrio un error inesperado al guardar los cambios.');
      }
      setIsSavingEdit(false);
    }
  };

  const handleSaveIncident = (event: React.FormEvent) => {
    event.preventDefault();
    if (!client || !incidentForm.reason) return;
    const fichaTone = incidentForm.type === FichaType.MALA ? 'warning' : 'success';
    const fichaTypeLabel = incidentForm.type.toLowerCase();

    addFicha(
      {
        clientId: client.id,
        type: incidentForm.type,
        reason: incidentForm.reason,
        note: incidentForm.note,
      },
      currentUser!,
    );

    if (incidentForm.type === FichaType.MALA) {
      updateLocalClient(client.id, { creditRating: FichaType.MALA });
      apiClient.updateClient(client.id, { creditRating: FichaType.MALA }).then(response => upsertClientsInLocalStorage([response.data])).catch(() => undefined);
    } else if (incidentForm.type === FichaType.BUENA && client.creditRating === FichaType.MALA) {
      updateLocalClient(client.id, { creditRating: FichaType.REGULAR });
      apiClient.updateClient(client.id, { creditRating: FichaType.REGULAR }).then(response => upsertClientsInLocalStorage([response.data])).catch(() => undefined);
    }

    setIsIncidentModalOpen(false);
    setIncidentForm({ type: FichaType.REGULAR, reason: '', note: '' });
    emitPlatformToast({
      title: 'Ficha registrada',
      message: `Se agrego una ficha ${fichaTypeLabel} para ${client.firstName} ${client.lastName}.`,
      tone: fichaTone,
      durationMs: 3600,
    });
    void loadData(client.id);
  };

  const handleVoidPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPaymentToVoid || !voidReason || !client) return;

    try {
      await apiClient.voidPayment(selectedPaymentToVoid, voidReason);
      const [loansResponse, paymentsResponse, cashResponse] = await Promise.all([
        apiClient.listLoans(),
        apiClient.listPayments(),
        apiClient.listCashMovements(),
      ]);
      upsertLoansInLocalStorage(loansResponse.data);
      removePaymentFromLocalStorage(selectedPaymentToVoid);
      upsertPaymentsInLocalStorage(paymentsResponse.data);
      upsertCashMovementsInLocalStorage(cashResponse.data);
      setIsVoidModalOpen(false);
      setSelectedPaymentToVoid(null);
      setVoidReason('');
      await loadData(client.id);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        if (voidPayment(selectedPaymentToVoid, voidReason, currentUser!)) {
          setIsVoidModalOpen(false);
          setSelectedPaymentToVoid(null);
          setVoidReason('');
          void loadData(client.id);
        }
      } else if (!(error instanceof ApiRequestError)) {
        console.error(error);
      }
    }
  };

  const handleEditImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditError('');
    void optimizeImageFile(file)
      .then(photo => setEditForm(previous => ({ ...previous, photo })))
      .catch(() => setEditError('No pudimos procesar la imagen. Intenta con otra foto mas ligera.'));
  };

  const statementTotals = useMemo(() => {
    const paidCapital = payments.reduce((sum, payment) => sum + getPaymentPrincipalPortion(payment), 0);
    const paidInterest = payments.reduce((sum, payment) => sum + getPaymentInterestPortion(payment), 0);
    const paidLate = payments.reduce((sum, payment) => sum + (payment.moraPaid || 0), 0);
    const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return { paidCapital, paidInterest, paidLate, paidTotal };
  }, [payments]);

  const activeBehaviorTooltip = useMemo(
    () => behaviorSegments.find(item => item.label === hoveredBehaviorLabel) || null,
    [behaviorSegments, hoveredBehaviorLabel],
  );

  if (!client) {
    return <div className="p-12 text-center text-lg font-semibold text-[#94A3B8]">Cargando expediente...</div>;
  }

  const motionButtonClass =
    'cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

  const exportStatementPdf = () => {
    exportStatementPdfElite();
  };

  const exportStatementPdfPremium = () => {
    exportStatementPdfElite();
  };

  const exportStatementPdfElite = () => {
    if (!statementView) return;

    const doc = createPlatformPdfDoc({
      paperSize: activePdfTemplateConfig.paperSize,
      orientation: activePdfTemplateConfig.orientation,
    });
    const left = platformPdfMarginByPreset[activePdfTemplateConfig.marginPreset] - 4;
    const top = 24;
    const right = doc.internal.pageSize.getWidth() - left;
    const isStatement = statementView === 'statement';
    const emissionDate = formatDate(new Date().toISOString());
    const selectedTemplateLabel = activePdfTemplate?.name || activePdfVisualPreset.label;
    const clientName = `${client.firstName} ${client.lastName}`.trim();
    const companyLines = [
      assignedBranch?.name || 'Sucursal principal',
      assignedBranch?.address || client.address || 'Direccion pendiente',
      company?.rnc ? `RNC: ${company.rnc}` : '',
    ].filter(Boolean);

    const lineItems = isStatement
      ? loans.slice(0, 14).map(loan => ({
          description: `Prestamo ${getShortId(loan.id)}`,
          detail: `${loan.frequency} - Inicio ${formatDate(loan.startDate)} - ${loan.status}`,
          quantity: `${loan.duration}`,
          unit: 'Cuotas',
          price: formatCurrency(loan.amount),
          tax: `${loan.interestRate.toFixed(1)}%`,
          amount: formatCurrency(loan.balance),
        }))
      : recentPayments.slice(0, 16).map(payment => ({
          description: `Recibo ${getShortId(payment.id)}`,
          detail: `Fecha ${formatDate(payment.date)} - Capital ${formatCurrency(getPaymentPrincipalPortion(payment))} - Interes ${formatCurrency(getPaymentInterestPortion(payment))}`,
          quantity: '1',
          unit: payment.moraPaid ? 'Cobro + mora' : 'Cobro',
          price: formatCurrency(payment.amount),
          tax: formatCurrency(payment.moraPaid || 0),
          amount: formatCurrency(payment.amount + (payment.moraPaid || 0)),
        }));

    const totals = isStatement
      ? [
          { label: 'Capital recuperado', value: formatCurrency(statementTotals.paidCapital) },
          { label: 'Interes cobrado', value: formatCurrency(statementTotals.paidInterest) },
          { label: 'Mora aplicada', value: formatCurrency(statementTotals.paidLate) },
          { label: 'Balance pendiente', value: formatCurrency(portfolioSummary.totalPending), emphasis: true },
        ]
      : [
          { label: 'Recibos aplicados', value: `${recentPayments.length}` },
          { label: 'Interes cobrado', value: formatCurrency(statementTotals.paidInterest) },
          { label: 'Mora cobrada', value: formatCurrency(statementTotals.paidLate) },
          { label: 'Pagado acumulado', value: formatCurrency(statementTotals.paidTotal), emphasis: true },
        ];

    const model = {
      title: isStatement ? 'Estado de cuenta' : 'Historial de pagos',
      subtitle: isStatement
        ? 'Documento financiero con saldo pendiente, prestamos activos y contexto del cliente.'
        : 'Consolidado reciente de pagos, capital, intereses y trazabilidad operativa.',
      documentNumber: `${isStatement ? 'CLI' : 'PAG'}-${getShortId(client.id)}`,
      issueDate: emissionDate,
      dueDate: isStatement && portfolioSummary.nextInstallment ? formatDate(portfolioSummary.nextInstallment.dueDate) : undefined,
      companyName: company?.name || 'PrestaFacil RD',
      companyLogo: assignedBranch?.logo || company?.logo,
      companyLines,
      seller: {
        title: 'Emitido por',
        lines: [
          company?.name || 'PrestaFacil RD',
          assignedBranch?.name || 'Sucursal principal',
          assignedBranch?.address || 'Direccion pendiente',
          assignedOfficial?.name ? `Oficial: ${assignedOfficial.name}` : '',
        ].filter(Boolean),
      },
      buyer: {
        title: 'Cliente',
        lines: [
          clientName,
          `Cedula: ${client.cedula}`,
          `Telefono: ${client.phone}`,
          client.address,
        ].filter(Boolean),
      },
      shipTo: {
        title: isStatement ? 'Contexto financiero' : 'Contexto operativo',
        lines: isStatement
          ? [
              `Prestamos activos: ${portfolioSummary.activeLoans}`,
              `Score: ${portfolioSummary.score}/100`,
              `Proxima cuota: ${portfolioSummary.nextInstallment ? formatDate(portfolioSummary.nextInstallment.dueDate) : 'Sin cuota'}`,
              `Ultimo pago: ${portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'}`,
            ]
          : [
              `Pagos visibles: ${recentPayments.length}`,
              `Capital cobrado: ${formatCurrency(statementTotals.paidCapital)}`,
              `Ultimo pago: ${portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'}`,
              `Promesas activas: ${promises.filter(promise => promise.status === 'PENDIENTE').length}`,
            ],
      },
      summaryTitle: isStatement ? 'Balance pendiente' : 'Pagado acumulado',
      summaryValue: isStatement ? formatCurrency(portfolioSummary.totalPending) : formatCurrency(statementTotals.paidTotal),
      summaryMeta: isStatement
        ? [
            `Plantilla ${selectedTemplateLabel}`,
            `Score ${portfolioSummary.score}/100`,
            `Prestamos activos ${portfolioSummary.activeLoans}`,
          ]
        : [
            `Plantilla ${selectedTemplateLabel}`,
            `Pagos visibles ${recentPayments.length}`,
            `Ultimo pago ${portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'}`,
          ],
      lineItems,
      totals,
      notesTitle: 'Notas y condiciones',
      notesLines: isStatement
        ? [
            'Este estado de cuenta resume el saldo vigente del expediente al momento de la emision.',
            portfolioSummary.nextInstallment
              ? `La siguiente cuota vence el ${formatDate(portfolioSummary.nextInstallment.dueDate)} por ${formatCurrency(portfolioSummary.nextInstallment.expectedAmount)}.`
              : 'No hay cuotas inmediatas pendientes.',
          ]
        : [
            'Historial consolidado de cobros aplicados sobre este expediente.',
            'Los montos incluyen capital e intereses; la mora se presenta separada cuando aplica.',
          ],
      footerNote: isStatement
        ? `Documento emitido para revision de cartera del cliente ${clientName}.`
        : `Documento emitido para consulta del historial reciente de pagos del cliente ${clientName}.`,
      presetLabel: selectedTemplateLabel,
    };

    renderPlatformPdfDocument({
      doc,
      preset: activePdfVisualPreset,
      left,
      top,
      right,
      model,
    });

    doc.save(buildPlatformPdfFileName(isStatement ? `estado-cuenta-${clientName}` : `historial-pagos-${clientName}`));
  };

  const exportStatementPdfLegacy = () => {
    if (!statementView) return;

    const doc = createPlatformPdfDoc({
      paperSize: activePdfTemplateConfig.paperSize,
      orientation: activePdfTemplateConfig.orientation,
    });
    const left = platformPdfMarginByPreset[activePdfTemplateConfig.marginPreset] - 4;
    const top = 30;
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - left;
    const contentWidth = right - left;
    const isStatement = statementView === 'statement';
    const isClassicPreset = activePdfVisualPreset.visualPreset === 'CORPORATIVA_CLASICA';
    const isFiscalPreset = activePdfVisualPreset.visualPreset === 'FISCAL_ELECTRONICA';
    const isExecutivePreset = activePdfVisualPreset.visualPreset === 'FACTURA_FINANCIERA';
    const [accentR, accentG, accentB] = activePdfVisualPreset.accent;
    const [softR, softG, softB] = activePdfVisualPreset.accentSoft;
    const [neutralR, neutralG, neutralB] = activePdfVisualPreset.neutral;
    const totalValue = isStatement ? portfolioSummary.totalPending : statementTotals.paidTotal;
    const summaryTitle = isStatement ? 'Estado de cuenta' : 'Historial de pagos';
    const summaryCaption = isStatement ? 'Balance pendiente' : 'Pagado acumulado';
    const emissionDate = formatDate(new Date().toISOString());
    const selectedTemplateLabel = activePdfTemplate?.name || activePdfVisualPreset.label;
    const clientName = `${client.firstName} ${client.lastName}`.trim();
    const docNote = isStatement
      ? `Documento emitido para revision de cartera del cliente ${clientName}.`
      : `Documento emitido para consulta del historial reciente de pagos del cliente ${clientName}.`;
    const metricRows = isStatement
      ? [
          ['Capital recuperado', formatCurrency(statementTotals.paidCapital)],
          ['Interes cobrado', formatCurrency(statementTotals.paidInterest)],
          ['Mora aplicada', formatCurrency(statementTotals.paidLate)],
          ['Balance pendiente', formatCurrency(portfolioSummary.totalPending)],
        ]
      : [
          ['Recibos aplicados', `${recentPayments.length}`],
          ['Interes cobrado', formatCurrency(statementTotals.paidInterest)],
          ['Mora cobrada', formatCurrency(statementTotals.paidLate)],
          ['Capital cobrado', formatCurrency(statementTotals.paidCapital)],
        ];
    const tableHeaders = isStatement
      ? ['Prestamo', 'Monto', 'Saldo', 'Estado']
      : ['Fecha', 'Recibo', 'Monto', 'Detalle'];
    const tableRows = isStatement
      ? loans.slice(0, 10).map(loan => [
          getShortId(loan.id),
          formatCurrency(loan.amount),
          formatCurrency(loan.balance),
          loan.status,
        ])
      : recentPayments.slice(0, 10).map(payment => [
          formatDate(payment.date),
          getShortId(payment.id),
          formatCurrency(payment.amount),
          `Capital ${formatCurrency(getPaymentPrincipalPortion(payment))} - Interes ${formatCurrency(getPaymentInterestPortion(payment))} - Mora ${formatCurrency(payment.moraPaid || 0)}`,
        ]);
    const tableWidths = isStatement
      ? [110, 120, 120, contentWidth - 350]
      : [94, 98, 94, contentWidth - 286];
    const contextRows = isStatement
      ? [
          ['Sucursal', assignedBranch?.name || 'Sucursal principal'],
          ['Oficial responsable', assignedOfficial?.name || 'Sin asignar'],
          ['Proxima cuota', portfolioSummary.nextInstallment ? formatDate(portfolioSummary.nextInstallment.dueDate) : 'Sin cuota'],
          ['Ultimo pago', portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'],
        ]
      : [
          ['Sucursal', assignedBranch?.name || 'Sucursal principal'],
          ['Oficial responsable', assignedOfficial?.name || 'Sin asignar'],
          ['Ultimo pago', portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'],
          ['Promesas activas', `${promises.filter(promise => promise.status === 'PENDIENTE').length}`],
        ];

    const drawRoundedCard = (x: number, y: number, width: number, height: number, fill: [number, number, number], border: [number, number, number], radius = 18) => {
      drawPlatformPdfCard({ doc, x, y, width, height, fill, border, radius });
    };

    const drawMetricCard = (x: number, y: number, width: number, label: string, value: string, tone: [number, number, number], fill: [number, number, number]) => {
      drawRoundedCard(x, y, width, 60, fill, tone, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(tone[0], tone[1], tone[2]);
      doc.text(label.toUpperCase(), x + 12, y + 17);
      doc.setFontSize(16);
      doc.text(value, x + 12, y + 41, { maxWidth: width - 22 });
    };

    const drawInfoCard = (x: number, y: number, width: number, label: string, value: string) => {
      drawRoundedCard(x, y, width, 60, [255, 255, 255], [229, 231, 235], 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(label.toUpperCase(), x + 12, y + 18);
      doc.setFontSize(14);
      doc.setTextColor(neutralR, neutralG, neutralB);
      doc.text(doc.splitTextToSize(value, width - 24), x + 12, y + 40);
    };

    const drawTable = (y: number) => {
      const estimatedHeight = tableRows.reduce((sum, row) => {
        const lineCount = row.reduce((max, cell, index) => {
          const lines = doc.splitTextToSize(String(cell), tableWidths[index] - 12);
          return Math.max(max, lines.length);
        }, 1);
        return sum + Math.max(28, lineCount * 13 + 8);
      }, 0);
      const tableHeight = Math.max(118, estimatedHeight + 58);
      drawRoundedCard(left, y, contentWidth, tableHeight, [255, 255, 255], [229, 231, 235], 18);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(left + 16, y + 18, contentWidth - 32, 26, 12, 12, 'FD');

      let headX = left + 26;
      tableHeaders.forEach((header, index) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text(header.toUpperCase(), headX, y + 35);
        headX += tableWidths[index];
      });

      let rowY = y + 62;
      if (!tableRows.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(
          isStatement ? 'No hay prestamos visibles para este expediente.' : 'No hay pagos recientes para este cliente.',
          left + 26,
          rowY,
        );
      } else {
        tableRows.forEach((row, rowIndex) => {
          const rowHeight = row.reduce((max, cell, index) => {
            const lines = doc.splitTextToSize(String(cell), tableWidths[index] - 12);
            return Math.max(max, Math.max(24, lines.length * 13 + 8));
          }, 24);
          if (rowIndex % 2 === 1) {
            doc.setFillColor(252, 253, 255);
            doc.setDrawColor(238, 242, 247);
            doc.roundedRect(left + 16, rowY - 14, contentWidth - 32, rowHeight, 8, 8, 'FD');
          }
          let rowX = left + 26;
          row.forEach((cell, index) => {
            doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(index === row.length - 1 && !isStatement ? 100 : 17, index === row.length - 1 && !isStatement ? 116 : 24, index === row.length - 1 && !isStatement ? 139 : 39);
            const lines = doc.splitTextToSize(String(cell), tableWidths[index] - 10);
            doc.text(lines, rowX, rowY);
            rowX += tableWidths[index];
          });
          rowY += rowHeight;
        });
      }

      return tableHeight;
    };

    if (isExecutivePreset) {
      drawRoundedCard(left, top, contentWidth, 86, [neutralR, neutralG, neutralB], [neutralR, neutralG, neutralB], 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(company?.name || 'PrestaFacil RD', left + 18, top + 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);
      doc.text(assignedBranch?.name || 'Sucursal principal', left + 18, top + 52);
      doc.text(assignedBranch?.address || 'Direccion pendiente', left + 18, top + 66, { maxWidth: 220 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(191, 219, 254);
      doc.text(summaryCaption.toUpperCase(), right - 18, top + 22, { align: 'right' });
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.text(formatCurrency(totalValue), right - 18, top + 48, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Plantilla ${selectedTemplateLabel} - ${emissionDate}`, right - 18, top + 67, { align: 'right' });
    } else if (isFiscalPreset) {
      doc.setDrawColor(neutralR, neutralG, neutralB);
      doc.rect(left, top, contentWidth, 96);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(neutralR, neutralG, neutralB);
      doc.text(company?.name || 'PrestaFacil RD', left + 16, top + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(assignedBranch?.name || 'Sucursal principal', left + 16, top + 39);
      doc.text(assignedBranch?.address || 'Direccion pendiente', left + 16, top + 53, { maxWidth: 250 });
      doc.text(`Plantilla: ${selectedTemplateLabel}`, left + 16, top + 72);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(summaryTitle.toUpperCase(), right - 16, top + 20, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Fecha: ${emissionDate}`, right - 16, top + 38, { align: 'right' });
      doc.text(`Cliente: ${clientName}`, right - 16, top + 52, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.text(formatCurrency(totalValue), right - 16, top + 80, { align: 'right' });
    } else {
      drawRoundedCard(left, top, contentWidth, 88, [248, 250, 252], [219, 234, 254], 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(neutralR, neutralG, neutralB);
      doc.text(company?.name || 'PrestaFacil RD', left + 18, top + 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(assignedBranch?.name || 'Sucursal principal', left + 18, top + 52);
      doc.text(assignedBranch?.address || 'Direccion pendiente', left + 18, top + 67, { maxWidth: 220 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(summaryCaption.toUpperCase(), right - 18, top + 25, { align: 'right' });
      doc.setFontSize(28);
      doc.setTextColor(neutralR, neutralG, neutralB);
      doc.text(formatCurrency(totalValue), right - 18, top + 53, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Plantilla ${selectedTemplateLabel}`, right - 18, top + 70, { align: 'right' });
    }

    const detailsTop = top + 110;
    const leftColumnWidth = contentWidth * 0.56;
    const rightColumnWidth = contentWidth - leftColumnWidth - 16;
    const rightColumnX = left + leftColumnWidth + 16;

    drawRoundedCard(left, detailsTop, leftColumnWidth, 88, [248, 250, 252], [229, 231, 235], 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('DATOS DEL CLIENTE', left + 14, detailsTop + 18);
    doc.setFontSize(18);
    doc.setTextColor(neutralR, neutralG, neutralB);
    doc.text(clientName, left + 14, detailsTop + 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Cedula: ${client.cedula}`, left + 14, detailsTop + 58);
    doc.text(`Telefono: ${client.phone}`, left + 14, detailsTop + 72);
    doc.text(doc.splitTextToSize(`Direccion: ${client.address}`, leftColumnWidth - 28), left + 14, detailsTop + 86);

    const summaryFill: [number, number, number] = isExecutivePreset ? [neutralR, neutralG, neutralB] : [255, 255, 255];
    const summaryText: [number, number, number] = isExecutivePreset ? [255, 255, 255] : [neutralR, neutralG, neutralB];
    drawRoundedCard(rightColumnX, detailsTop, rightColumnWidth, 88, summaryFill, isExecutivePreset ? summaryFill : [229, 231, 235], 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(isExecutivePreset ? 148 : 148, isExecutivePreset ? 163 : 163, isExecutivePreset ? 184 : 184);
    doc.text(isStatement ? 'RESUMEN DE CARTERA' : 'RESUMEN DE PAGOS', rightColumnX + 14, detailsTop + 18);
    doc.setFontSize(24);
    doc.setTextColor(summaryText[0], summaryText[1], summaryText[2]);
    doc.text(formatCurrency(totalValue), rightColumnX + 14, detailsTop + 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(isStatement ? `Prestamos activos: ${portfolioSummary.activeLoans}` : `Pagos visibles: ${recentPayments.length}`, rightColumnX + 14, detailsTop + 64);
    doc.text(isStatement ? `Score: ${portfolioSummary.score}/100` : `Ultimo pago: ${portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'}`, rightColumnX + 14, detailsTop + 78, { maxWidth: rightColumnWidth - 28 });

    const kpiTop = detailsTop + 102;
    const kpiGap = 10;
    const kpiWidth = (contentWidth - kpiGap * 3) / 4;
    const kpiTones: [[number, number, number], [number, number, number]][] = [
      [[37, 99, 235], [239, 246, 255]],
      [[79, 70, 229], [238, 242, 255]],
      [[234, 88, 12], [255, 247, 237]],
      [[5, 150, 105], [236, 253, 245]],
    ];
    metricRows.forEach((item, index) => {
      drawMetricCard(left + index * (kpiWidth + kpiGap), kpiTop, kpiWidth, item[0], item[1], kpiTones[index][0], kpiTones[index][1]);
    });

    const contextTop = kpiTop + 78;
    const contextGap = 12;
    const contextWidth = (contentWidth - contextGap) / 2;
    contextRows.forEach(([label, value], index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      drawInfoCard(left + col * (contextWidth + contextGap), contextTop + row * 72, contextWidth, label, value);
    });

    const tableTop = contextTop + 154;
    const renderedTableHeight = drawTable(tableTop);
    const footerY = tableTop + renderedTableHeight + 24;
    drawPlatformPdfFooter({
      doc,
      left,
      right,
      y: footerY,
      note: docNote,
      presetLabel: selectedTemplateLabel,
    });

    doc.save(buildPlatformPdfFileName(isStatement ? `estado-cuenta-${clientName}` : `historial-pagos-${clientName}`));
  };

  return (
    <div ref={pageRef} className="space-y-6 pb-24 lg:pb-0">
      {client.status === ClientStatus.PENDING && (
        <section className="flex flex-col gap-5 rounded-[30px] border border-[#FED7AA] bg-[#FFF7ED] p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F97316] text-white">
              <Clock3 size={28} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C2410C]">Prospecto en espera</p>
              <p className="mt-2 text-lg font-semibold text-[#9A3412]">Este expediente debe validarse antes de otorgar nuevos prestamos.</p>
            </div>
          </div>
          {!isCollector && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => triggerApprovalModal(ClientStatus.REJECTED)} className={`h-12 rounded-2xl border border-[#FCA5A5] bg-white px-6 text-sm font-semibold text-[#DC2626] ${motionButtonClass}`}>
                Rechazar
              </button>
              <button onClick={() => triggerApprovalModal(ClientStatus.APPROVED)} className="h-12 cursor-pointer rounded-2xl bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]">
                Aprobar
              </button>
            </div>
          )}
        </section>
      )}

      <section data-client-hero className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-[52px] font-black leading-none tracking-tight text-[#111827]">Perfil del Cliente</h1>
          <p className="mt-3 text-xl font-medium text-[#6B7280]">Consulta el contexto financiero, comportamiento y seguimiento del cliente.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.15fr)_minmax(180px,1fr)_minmax(196px,1.1fr)_minmax(196px,1fr)]">
          <button onClick={() => navigate('/clients')} className={`flex h-[54px] min-w-[220px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}>
            <ArrowLeft size={18} />
            Volver a clientes
          </button>
          {!isCollector && (
            <button
              onClick={() =>
                navigate('/collect-today', {
                  state: {
                    focusClientId: client.id,
                    focusClientName: `${client.firstName} ${client.lastName}`.trim(),
                    openCollectionModal: true,
                  },
                })
              }
              className={`flex h-[54px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}
            >
              <Wallet size={18} />
              Cobrar
            </button>
          )}
          <button onClick={() => setStatementView('statement')} className={`flex h-[54px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}>
            <Download size={18} />
            Exportar PDF
          </button>
          <button onClick={() => navigate('/loans/new', { state: { clientId: client.id } })} className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[17px] font-medium text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]">
            <Plus size={18} />
            Crear prestamo
          </button>
        </div>
      </section>

      <section data-client-kpi className="rounded-[30px] border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <div className="flex items-start gap-5">
            <ClientAvatar
              client={client}
              className="h-28 w-28 rounded-2xl"
              textClassName="text-[42px] font-black text-[#2563EB]"
            />
            <div className="min-w-0">
              <p className="text-[42px] font-black tracking-tight text-[#111827]">
                {client.firstName} {client.lastName}
              </p>
              <p className="text-lg font-medium text-[#6B7280]">{client.nickname || '-'}</p>
              <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium text-[#374151]">
                <span className="inline-flex items-center gap-2">
                  <Phone size={16} className="text-[#2563EB]" />
                  {client.phone}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin size={16} className="text-[#2563EB]" />
                  {client.address}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-medium text-[#374151]">
                <span className="text-[#64748B]">Cobrador asignado</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1">
                  <UserRound size={14} className="text-[#2563EB]" />
                  {assignedOfficial?.name || 'Sin asignar'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1">
                  <MapPin size={14} className="text-[#2563EB]" />
                  {assignedBranch?.name || 'Sucursal'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <HeaderBadge label="Estado" value={client.isBlocked ? 'Bloqueado' : 'Activo'} tone={client.isBlocked ? 'warn' : 'ok'} />
            <HeaderBadge label="Score" value={`${portfolioSummary.score}/100`} tone="ok" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 border-t border-[#E5E7EB] pt-6 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryMetric label="Total pendiente" value={formatCurrency(portfolioSummary.totalPending)} iconTone="blue" />
          <SummaryMetric label="Proxima cuota" value={portfolioSummary.nextInstallment ? formatCurrency(portfolioSummary.nextInstallment.expectedAmount) : 'RD$0.00'} helper={portfolioSummary.nextInstallment ? formatDate(portfolioSummary.nextInstallment.dueDate) : 'Sin cuota'} iconTone="violet" />
          <SummaryMetric label="Ultimo pago" value={portfolioSummary.lastPayment ? formatCurrency(portfolioSummary.lastPayment.amount) : 'RD$0.00'} helper={portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'} iconTone="green" />
          <SummaryMetric label="Ultima visita" value={portfolioSummary.lastVisit ? formatDate(portfolioSummary.lastVisit.date) : '-'} helper={portfolioSummary.lastVisit?.result || 'Sin visitas'} iconTone="amber" />
          <SummaryMetric label="Prestamos activos" value={`${portfolioSummary.activeLoans}`} helper={assignedBranch?.name || 'Sucursal'} iconTone="slate" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.75fr)]">
        <div data-client-main className="space-y-6">
          <div className="rounded-[30px] border border-[#E5E7EB] bg-white shadow-sm">
            <div className="border-b border-[#E5E7EB] px-5 py-5">
              <div className="hidden xl:flex xl:flex-wrap xl:gap-3">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                        : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                    }`}
                  >
                    <tab.icon size={15} className={activeTab === tab.key ? 'text-[#2563EB]' : 'text-[#64748B]'} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max items-center gap-2 whitespace-nowrap pb-1">
                  {tabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-semibold transition-all duration-200 ${
                        activeTab === tab.key
                          ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.12)]'
                          : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                      }`}
                    >
                      <tab.icon size={15} className={activeTab === tab.key ? 'text-[#2563EB]' : 'text-[#64748B]'} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6">
              {activeTab === 'RESUMEN' && (
                <div className="space-y-6">
                  <section className="grid gap-4 md:grid-cols-4">
                    <PanelMetric label="Capital pendiente" value={formatCurrency(portfolioSummary.principalPending)} tone="blue" />
                    <PanelMetric label="Interes pendiente" value={formatCurrency(portfolioSummary.interestPending)} tone="violet" />
                    <PanelMetric label="Mora acumulada" value={formatCurrency(portfolioSummary.accumulatedLate)} tone="amber" />
                    <PanelMetric label="Total pendiente" value={formatCurrency(portfolioSummary.totalPending)} tone="green" />
                  </section>

                  <section className="rounded-[26px] border border-[#E5E7EB]">
                    <div className="border-b border-[#E5E7EB] px-5 py-4">
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Prestamos activos</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <colgroup>
                          <col style={{ width: '20%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '19%' }} />
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '13%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-[#F8FAFC] text-left text-[12px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">
                            <th className="px-5 py-3">Prestamo</th>
                            <th className="px-5 py-3">Monto</th>
                            <th className="px-5 py-3">Saldo pendiente</th>
                            <th className="px-5 py-3">Prox. cuota</th>
                            <th className="px-5 py-3">Estado</th>
                            <th className="px-5 py-3">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loans.slice(0, 5).map(loan => {
                            const nextInstallment = (loan.installments || []).find(installment => installment.status !== 'PAGADO');
                            return (
                              <tr key={loan.id} className="border-t border-[#F1F5F9] text-sm font-medium text-[#374151]">
                                <td className="px-5 py-4">{getShortId(loan.id)}</td>
                                <td className="px-5 py-4">{formatCurrency(loan.amount)}</td>
                                <td className="px-5 py-4">{formatCurrency(loan.balance)}</td>
                                <td className="px-5 py-4">
                                  {nextInstallment ? (<div className="space-y-1"><p className="font-semibold text-[#111827]">{formatCurrency(nextInstallment.expectedAmount)}</p><p className="text-xs font-medium text-[#6B7280]">{formatDate(nextInstallment.dueDate)}</p></div>) : ('Sin cuota')}
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${loan.status === 'En Mora' ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#DCFCE7] text-[#16A34A]'}`}>
                                    {loan.status}
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <button onClick={() => setSelectedLoanDetail(loan)} className={`whitespace-nowrap rounded-xl border border-[#DBEAFE] px-3 py-2 text-xs font-semibold text-[#2563EB] ${motionButtonClass}`}>Ver detalle</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-[26px] border border-[#E5E7EB]">
                    <div className="border-b border-[#E5E7EB] px-5 py-4">
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Historial de pagos reciente</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-[#F8FAFC] text-left text-[12px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">
                            <th className="px-5 py-3">Fecha</th>
                            <th className="px-5 py-3">Prestamo</th>
                            <th className="px-5 py-3">Monto</th>
                            <th className="px-5 py-3">Metodo</th>
                            <th className="px-5 py-3">Mora</th>
                            <th className="px-5 py-3">Registrado por</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentPayments.map(payment => (
                            <tr key={payment.id} className="border-t border-[#F1F5F9] text-sm font-medium text-[#374151]">
                              <td className="px-5 py-4">{formatDate(payment.date)}</td>
                              <td className="px-5 py-4">{getShortId(payment.loanId)}</td>
                              <td className="px-5 py-4">{formatCurrency(payment.amount)}</td>
                              <td className="px-5 py-4">
                                <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-semibold text-[#16A34A]">Efectivo</span>
                              </td>
                              <td className="px-5 py-4 text-[#DC2626]">{formatCurrency(payment.moraPaid || 0)}</td>
                              <td className="px-5 py-4">{assignedOfficial?.name || 'Sistema'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'EDITAR' && !isCollector && (
                <section className="space-y-6">
                  <div className="px-1">
                    <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Editar cliente</h3>
                    <p className="mt-2 text-[15px] font-medium leading-7 text-[#64748B]">
                      Actualiza identidad, contacto, sucursal y oficial responsable desde la misma subvista.
                    </p>
                  </div>

                  <div className="flex flex-col gap-5 rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFF] p-5 md:flex-row md:items-center">
                    <div className="relative w-fit">
                      <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 ${editForm.photo ? 'border-[#2563EB]' : 'border-[#E5E7EB] bg-white'}`}>
                        {editForm.photo ? (
                          <img src={editForm.photo} alt="Cliente" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon size={30} className="text-[#94A3B8]" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-[#111827] text-white shadow-lg transition-all duration-200 hover:translate-x-1">
                        <Camera size={15} />
                        <input type="file" accept="image/*" className="hidden" onChange={handleEditImageUpload} />
                      </label>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[18px] font-bold text-[#111827]">Foto del cliente</p>
                      <p className="text-[14px] font-medium leading-6 text-[#64748B]">
                        Mantiene el mismo lenguaje visual del expediente para que el perfil siga consistente con clientes y usuarios.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateClient} className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                    <div className="grid gap-5 md:grid-cols-2">
                      <ModalField label="Nombre" helper="Nombre legal del titular del expediente.">
                        <input
                          required
                          value={editForm.firstName || ''}
                          onChange={event => setEditForm({ ...editForm, firstName: cleanTextInput(event.target.value) })}
                          className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                        />
                      </ModalField>
                      <ModalField label="Apellido" helper="Apellido principal o familiar del cliente.">
                        <input
                          required
                          value={editForm.lastName || ''}
                          onChange={event => setEditForm({ ...editForm, lastName: cleanTextInput(event.target.value) })}
                          className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                        />
                      </ModalField>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <ModalField label="Apodo" helper="Referencia corta para ubicarlo mas rapido.">
                        <input
                          value={editForm.nickname || ''}
                          onChange={event => setEditForm({ ...editForm, nickname: cleanTextInput(event.target.value) })}
                          className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                        />
                      </ModalField>
                      <ModalField label="Cedula" helper="Se mantiene en el formato local del cliente.">
                        <input
                          value={editForm.cedula || ''}
                          onChange={event => setEditForm({ ...editForm, cedula: formatCedulaInput(event.target.value) })}
                          inputMode="numeric"
                          className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                        />
                      </ModalField>
                    </div>

                    <div className="mt-5">
                      <ModalField label="Telefono" helper="Numero principal de contacto del cliente.">
                        <input
                          value={editForm.phone || ''}
                          onChange={event => setEditForm({ ...editForm, phone: formatPhoneInput(event.target.value) })}
                          inputMode="numeric"
                          className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                        />
                      </ModalField>
                    </div>

                    <div className="mt-5">
                      <ModalField label="Direccion" helper="Sector, referencia y punto de visita del expediente.">
                        <div className="space-y-2">
                          <textarea
                            value={editForm.address || ''}
                            onChange={event => setEditForm({ ...editForm, address: cleanTextInput(event.target.value).slice(0, 180) })}
                            className="h-32 w-full rounded-2xl border border-[#E5E7EB] px-4 py-3 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD]"
                          />
                          <div className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#94A3B8]">
                            <span>Incluye calle, sector y cualquier referencia util del recorrido.</span>
                            <span>{(editForm.address || '').length}/180</span>
                          </div>
                        </div>
                      </ModalField>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <ModalField label="Sucursal" helper="Cobertura operativa donde vive el expediente.">
                        <FormDropdown
                          value={editForm.branchId || ''}
                          onChange={value => setEditForm({ ...editForm, branchId: value, assignedUserId: '' })}
                          options={branches.map(branch => ({ value: branch.id, label: branch.name }))}
                          placeholder="Selecciona una sucursal"
                          isOpen={openEditField === 'branch'}
                          onToggle={() => setOpenEditField(current => (current === 'branch' ? null : 'branch'))}
                          onRequestClose={() => setOpenEditField(null)}
                        />
                      </ModalField>
                      <ModalField label="Oficial responsable" helper="Usuario que dara seguimiento comercial y de cobro.">
                        <FormDropdown
                          value={editForm.assignedUserId || ''}
                          onChange={value => setEditForm({ ...editForm, assignedUserId: value })}
                          options={assignableUsers.map(user => ({ value: user.id, label: user.name }))}
                          placeholder="Selecciona un oficial"
                          isOpen={openEditField === 'assignee'}
                          onToggle={() => setOpenEditField(current => (current === 'assignee' ? null : 'assignee'))}
                          onRequestClose={() => setOpenEditField(null)}
                        />
                      </ModalField>
                    </div>

                    {editError ? (
                      <div className="mt-5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#DC2626]">
                        {editError}
                      </div>
                    ) : null}

                    <div className="mt-6 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="flex h-[56px] min-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[#2563EB] px-6 text-[17px] font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)] disabled:cursor-not-allowed disabled:bg-[#93C5FD] disabled:hover:translate-x-0 disabled:hover:shadow-none"
                      >
                        <Save size={18} />
                        {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {activeTab === 'FICHAS' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-[#111827]">Fichas y comportamiento</h3>
                    {!isCollector && (
                      <button onClick={() => setIsIncidentModalOpen(true)} className="cursor-pointer rounded-[18px] bg-[#2563EB] px-4 py-3 text-[15px] font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.22)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]">
                        Registrar ficha
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {timelineRows.map(row => (
                      <div key={row.id} className="rounded-[22px] border border-[#E5E7EB] px-5 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className={`text-base font-semibold ${row.tone}`}>{row.title}</p>
                            <p className="mt-1 text-sm font-medium text-[#6B7280]">{row.detail}</p>
                          </div>
                          <span className="text-sm font-medium text-[#94A3B8]">{formatDate(row.date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'PAGOS' && (
                <div className="space-y-3">
                  {payments.map(payment => (
                    <div key={payment.id} className="rounded-[22px] border border-[#E5E7EB] px-5 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-base font-semibold text-[#111827]">{formatCurrency(payment.amount)}</p>
                          <p className="mt-1 text-sm font-medium text-[#6B7280]">
                            {formatDate(payment.date)} - Prestamo {getShortId(payment.loanId)} - Efectivo
                          </p>
                        </div>
                        {!isCollector && (
                          <button
                            onClick={() => {
                              setSelectedPaymentToVoid(payment.id);
                              setIsVoidModalOpen(true);
                            }}
                            className={`rounded-2xl border border-[#FECACA] px-4 py-3 text-sm font-semibold text-[#DC2626] ${motionButtonClass}`}
                          >
                            Anular pago
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'VISITAS' && (
                <div className="space-y-3">
                  {visits.map(visit => (
                    <div key={visit.id} className="rounded-[22px] border border-[#E5E7EB] px-5 py-4">
                      <p className="text-base font-semibold text-[#111827]">{visit.result}</p>
                      <p className="mt-1 text-sm font-medium text-[#6B7280]">{visit.note || 'Sin nota adicional'}</p>
                      <p className="mt-2 text-sm font-medium text-[#94A3B8]">{formatDate(visit.date)}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'PROMESAS' && (
                <div className="space-y-3">
                  {promises.map(promise => (
                    <div key={promise.id} className="rounded-[22px] border border-[#E5E7EB] px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-[#111827]">{formatCurrency(promise.amount)}</p>
                          <p className="mt-1 text-sm font-medium text-[#6B7280]">{promise.note || 'Sin comentario'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${promise.status === 'INCUMPLIDA' ? 'bg-[#FEE2E2] text-[#DC2626]' : promise.status === 'PENDIENTE' ? 'bg-[#DBEAFE] text-[#2563EB]' : 'bg-[#DCFCE7] text-[#16A34A]'}`}>
                            {promise.status}
                          </span>
                          <p className="mt-2 text-sm font-medium text-[#94A3B8]">{formatDate(promise.date)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'DOCUMENTOS' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <DocumentCard title="Estado de cuenta PDF" description="Resumen financiero del cliente, pagos y prestamos activos." actionLabel="Generar" onClick={() => setStatementView('statement')} />
                  <DocumentCard title="Historial de pagos" description="Exporta movimientos y recibos recientes del expediente." actionLabel="Exportar" onClick={() => setStatementView('payments')} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div data-client-side className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="relative rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Comportamiento del cliente</h3>
            {activeBehaviorTooltip ? (
              <div className="pointer-events-none absolute right-6 top-6 z-10 w-[250px] rounded-[24px] border border-[#E5E7EB] bg-white/95 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{activeBehaviorTooltip.label}</p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#111827]">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeBehaviorTooltip.color }} />
                    Participacion
                  </span>
                  <span className="text-[28px] font-black tracking-tight text-[#111827]">{activeBehaviorTooltip.value}%</span>
                </div>
                <p className="mt-3 text-[13px] font-medium leading-6 text-[#64748B]">{activeBehaviorTooltip.helper}</p>
              </div>
            ) : null}
            <div className="mt-5 flex items-center gap-5">
              <div
                className="relative flex h-[128px] w-[128px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(${behaviorSegments[0].color} 0deg ${behaviorSegments[0].value * 3.6}deg, ${behaviorSegments[1].color} ${behaviorSegments[0].value * 3.6}deg ${(behaviorSegments[0].value + behaviorSegments[1].value) * 3.6}deg, ${behaviorSegments[2].color} ${(behaviorSegments[0].value + behaviorSegments[1].value) * 3.6}deg ${(behaviorSegments[0].value + behaviorSegments[1].value + behaviorSegments[2].value) * 3.6}deg, ${behaviorSegments[3].color} 0deg)`,
                }}
                onMouseEnter={() => {
                  const maxSeg = [...behaviorSegments].sort((a, b) => b.value - a.value)[0];
                  setHoveredBehaviorLabel(maxSeg ? maxSeg.label : 'Al dia');
                }}
                onMouseLeave={() => setHoveredBehaviorLabel(null)}
              >
                <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white">
                  <p className="text-[32px] font-black tracking-tight text-[#111827]">{portfolioSummary.score}</p>
                  <p className="text-[13px] font-medium text-[#6B7280]">Score</p>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {behaviorSegments.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onMouseEnter={() => setHoveredBehaviorLabel(item.label)}
                    onMouseLeave={() => setHoveredBehaviorLabel(current => (current === item.label ? null : current))}
                    className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_48px] items-center gap-3 rounded-2xl px-2 py-2 text-[14px] font-medium text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    </span>
                    <span className="shrink-0 text-right whitespace-nowrap">{item.value}%</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Promesas activas</h3>
              <CalendarClock size={18} className="text-[#94A3B8]" />
            </div>
            <div className="mt-5 space-y-3">
              {promisesSummary.map(promise => (
                <div key={promise.id} className="rounded-[20px] border border-[#F1F5F9] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-[#111827]">{formatCurrency(promise.amount)}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${promise.status === 'PENDIENTE' ? 'bg-[#FEF3C7] text-[#D97706]' : promise.status === 'CUMPLIDA' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
                      {promise.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#6B7280]">Prometido para {formatDate(promise.date)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Notas y visitas recientes</h3>
            <div className="mt-5 space-y-4">
              {recentVisits.map(visit => (
                <div key={visit.id} className="grid grid-cols-[auto_1fr] gap-3">
                  <span className="mt-1 h-3 w-3 rounded-full bg-[#2563EB]" />
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{visit.result}</p>
                    <p className="mt-1 text-sm font-medium text-[#6B7280]">{visit.note || 'Sin comentario'}</p>
                    <p className="mt-1 text-xs font-medium text-[#94A3B8]">{formatDate(visit.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h3 className="text-[28px] font-black tracking-tight text-[#111827]">Alertas</h3>
            <div className="mt-5 space-y-3">
              <AlertRow label={`${promises.filter(promise => promise.status === 'PENDIENTE').length} promesa por vencer`} detail={promises[0] ? formatDate(promises[0].date) : 'Sin fecha'} tone="warn" />
              <AlertRow label={portfolioSummary.nextInstallment ? '1 cuota en seguimiento' : 'Sin cuota inmediata'} detail={portfolioSummary.nextInstallment ? formatDate(portfolioSummary.nextInstallment.dueDate) : '-'} tone="info" />
              <AlertRow label="Documentacion completa" detail="OK" tone="ok" />
            </div>
          </section>
        </div>
      </section>

      {selectedLoanDetail && (
        <ModalShell title="Detalle de prestamo" onClose={() => setSelectedLoanDetail(null)}>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <PanelMetric label="Capital" value={formatCurrency(selectedLoanDetail.amount)} tone="blue" />
              <PanelMetric label="Saldo pendiente" value={formatCurrency(selectedLoanDetail.balance)} tone="green" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <InfoBlock label="Estado" value={selectedLoanDetail.status} />
              <InfoBlock label="Frecuencia" value={selectedLoanDetail.frequency} />
              <InfoBlock label="Inicio" value={formatDate(selectedLoanDetail.startDate)} />
            </div>
            <div className="rounded-[24px] border border-[#E5E7EB]">
              <div className="border-b border-[#E5E7EB] px-5 py-4">
                <h4 className="text-lg font-bold text-[#111827]">Cuotas</h4>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {(selectedLoanDetail.installments || []).map(installment => (
                  <div key={installment.id} className="flex items-center justify-between border-t border-[#F1F5F9] px-5 py-4 text-sm">
                    <div>
                      <p className="font-semibold text-[#111827]">Cuota #{installment.number}</p>
                      <p className="mt-1 font-medium text-[#6B7280]">{formatDate(installment.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#111827]">{formatCurrency(installment.expectedAmount)}</p>
                      <p className="mt-1 font-medium text-[#6B7280]">Pagado {formatCurrency(installment.paidAmount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {isIncidentModalOpen && (
        <ModalShell title="Registrar ficha" onClose={() => setIsIncidentModalOpen(false)}>
          <form onSubmit={handleSaveIncident} className="grid gap-5">
            <ModalField label="Tipo">
              <FormDropdown
                value={incidentForm.type}
                onChange={value => setIncidentForm({ ...incidentForm, type: value as FichaType })}
                options={Object.values(FichaType).map(type => ({ value: type, label: type }))}
                placeholder="Selecciona un tipo"
                isOpen={openIncidentField === 'type'}
                onToggle={() => setOpenIncidentField(current => (current === 'type' ? null : 'type'))}
                onRequestClose={() => setOpenIncidentField(null)}
              />
            </ModalField>
            <ModalField label="Motivo" helper="Resume brevemente la situacion principal del cliente.">
              <div className="space-y-2">
                <input
                  required
                  value={incidentForm.reason}
                  onChange={event => setIncidentForm({ ...incidentForm, reason: cleanTextInput(event.target.value).slice(0, 80) })}
                  placeholder="Ej. Retraso recurrente en la zona"
                  className="h-14 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                />
                <div className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#94A3B8]">
                  <span>Usa una descripcion corta y accionable para facilitar el seguimiento.</span>
                  <span>{incidentForm.reason.length}/80</span>
                </div>
              </div>
            </ModalField>
            <ModalField label="Nota" helper="Agrega contexto, visita, compromiso o detalle adicional.">
              <div className="space-y-2">
                <textarea
                  value={incidentForm.note}
                  onChange={event => setIncidentForm({ ...incidentForm, note: event.target.value.slice(0, 180) })}
                  placeholder="Agrega visita, contexto, compromiso o detalle adicional."
                  className="h-32 w-full rounded-2xl border border-[#E5E7EB] px-4 py-3 text-[15px] font-medium text-[#111827] outline-none transition duration-200 hover:border-[#DBEAFE] focus:border-[#93C5FD] focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
                />
                <div className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#94A3B8]">
                  <span>Incluye detalle operativo para seguimiento posterior.</span>
                  <span>{incidentForm.note.length}/180</span>
                </div>
              </div>
            </ModalField>
            <button
              type="submit"
              className="mt-2 flex h-[56px] cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[#2563EB] text-[17px] font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]"
            >
              <Save size={16} />
              Registrar ficha
            </button>
          </form>
        </ModalShell>
      )}

      {isApprovalModalOpen && (
        <ModalShell title="Confirmar accion" onClose={() => setIsApprovalModalOpen(false)} compact>
          <div className="space-y-5 text-center">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${statusToSet === ClientStatus.APPROVED ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
              {statusToSet === ClientStatus.APPROVED ? <CheckCircle2 size={34} /> : <XCircle size={34} />}
            </div>
            <p className="text-base font-medium text-[#6B7280]">
              Estas a punto de {statusToSet === ClientStatus.APPROVED ? 'aprobar' : 'rechazar'} este expediente.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => setIsApprovalModalOpen(false)} className="h-12 rounded-2xl border border-[#E5E7EB] text-sm font-semibold text-[#374151]">
                Cancelar
              </button>
              <button onClick={handleConfirmStatus} className={`h-12 rounded-2xl text-sm font-semibold text-white ${statusToSet === ClientStatus.APPROVED ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {isVoidModalOpen && (
        <ModalShell title="Anular pago" onClose={() => setIsVoidModalOpen(false)}>
          <form onSubmit={handleVoidPayment} className="grid gap-5">
            <ModalField label="Motivo de anulacion" helper="Este texto se reflejara en la anulacion para auditoria.">
              <textarea
                required
                value={voidReason}
                onChange={event => setVoidReason(event.target.value.slice(0, 180))}
                className="h-28 w-full rounded-2xl border border-[#E5E7EB] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD] focus:shadow-[0_10px_24px_rgba(37,99,235,0.10)]"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-[12px] font-medium text-[#94A3B8]">
                <span>Explica por que el pago se revierte o requiere correccion.</span>
                <span>{voidReason.length}/180</span>
              </div>
            </ModalField>
            <button type="submit" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#DC2626] text-sm font-semibold text-white">
              <ShieldAlert size={16} />
              Confirmar anulacion
            </button>
          </form>
        </ModalShell>
      )}

      {statementView && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/60 p-6 backdrop-blur-sm animate-[platform-fade-in_220ms_ease-out]">
          <div className="platform-modal-panel mx-auto max-w-6xl rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-8 py-5">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-[#111827]">
                  {statementView === 'statement' ? 'Estado de cuenta' : 'Historial de pagos'}
                </h3>
                <p className="mt-1 text-sm font-medium text-[#6B7280]">
                  {statementView === 'statement'
                    ? 'Vista premium lista para imprimir o exportar.'
                    : 'Documento consolidado de pagos y recibos recientes del expediente.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <label className="flex min-w-[260px] flex-col gap-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Plantilla PDF</span>
                  <FormDropdown
                    value={activePdfTemplate?.id || ''}
                    onChange={value => {
                      setSelectedPdfTemplateId(value);
                      setIsStatementTemplateDropdownOpen(false);
                    }}
                    options={
                      availablePdfTemplates.length === 0
                        ? [{ value: '', label: 'Financiera ejecutiva' }]
                        : availablePdfTemplates.map(template => ({ value: template.id, label: template.name }))
                    }
                    placeholder="Selecciona una plantilla"
                    isOpen={isStatementTemplateDropdownOpen}
                    onToggle={() => setIsStatementTemplateDropdownOpen(current => !current)}
                    onRequestClose={() => setIsStatementTemplateDropdownOpen(false)}
                  />
                </label>
                <button onClick={exportStatementPdfElite} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]">
                  <Printer size={16} />
                  {statementView === 'statement' ? 'Generar PDF' : 'Exportar historial'}
                </button>
                <button
                  onClick={() => {
                    setStatementView(null);
                    setIsStatementTemplateDropdownOpen(false);
                  }}
                  className="platform-modal-close flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] text-[#6B7280] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div id="statement-print" className="space-y-8 bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFDFF_100%)] p-10">
              <div className="flex flex-col gap-6 border-b border-[#E5E7EB] pb-8 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-[#111827]">{company?.name}</h2>
                  <p className="mt-2 text-sm font-medium text-[#6B7280]">{assignedBranch?.name || 'Sucursal principal'}</p>
                  <p className="mt-1 text-sm font-medium text-[#6B7280]">{assignedBranch?.address || 'Direccion pendiente'}</p>
                  <span className="mt-4 inline-flex rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">
                    {activePdfVisualPreset.label}
                  </span>
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">
                    {statementView === 'statement' ? 'Balance pendiente' : 'Pagado acumulado'}
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-[#111827]">
                    {formatCurrency(statementView === 'statement' ? portfolioSummary.totalPending : statementTotals.paidTotal)}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#6B7280]">Fecha de emision {formatDate(new Date().toISOString())}</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.32fr_0.88fr]">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-[#E5E7EB] bg-[#F8FAFC] p-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Datos del cliente</p>
                  <p className="mt-3 text-2xl font-black tracking-tight text-[#111827]">
                    {client.firstName} {client.lastName}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#6B7280]">Cedula: {client.cedula}</p>
                  <p className="mt-1 text-sm font-medium text-[#6B7280]">Telefono: {client.phone}</p>
                  <p className="mt-1 text-sm font-medium text-[#6B7280]">Direccion: {client.address}</p>
                  </div>

                  <div className={`grid gap-4 ${statementView === 'statement' ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
                    <StatementMetric
                      label={statementView === 'statement' ? 'Capital pagado' : 'Recibos aplicados'}
                      value={statementView === 'statement' ? formatCurrency(statementTotals.paidCapital) : `${recentPayments.length}`}
                      tone="blue"
                    />
                    <StatementMetric
                      label={statementView === 'statement' ? 'Intereses' : 'Interes cobrado'}
                      value={statementView === 'statement' ? formatCurrency(statementTotals.paidInterest) : formatCurrency(statementTotals.paidInterest)}
                      tone="indigo"
                    />
                    <StatementMetric
                      label={statementView === 'statement' ? 'Mora pagada' : 'Mora cobrada'}
                      value={formatCurrency(statementTotals.paidLate)}
                      tone="amber"
                    />
                    <StatementMetric
                      label={statementView === 'statement' ? 'Balance neto' : 'Capital cobrado'}
                      value={statementView === 'statement' ? formatCurrency(portfolioSummary.totalPending) : formatCurrency(statementTotals.paidCapital)}
                      tone="emerald"
                    />
                  </div>

                  <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[24px] font-black tracking-tight text-[#111827]">
                          {statementView === 'statement' ? 'Prestamos activos' : 'Recibos recientes'}
                        </h4>
                        <p className="mt-2 text-[14px] font-medium text-[#64748B]">
                          {statementView === 'statement'
                            ? 'Detalle financiero de los prestamos visibles en el expediente.'
                            : 'Ultimos pagos consolidados con mora, capital e interes.'}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#64748B]">
                        {statementView === 'statement' ? `${loans.length} prestamos` : `${recentPayments.length} pagos`}
                      </span>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-[24px] border border-[#E5E7EB]">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-[#F8FAFC] text-left text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">
                            <th className="px-5 py-4">{statementView === 'statement' ? 'Prestamo' : 'Fecha'}</th>
                            <th className="px-5 py-4">{statementView === 'statement' ? 'Monto' : 'Recibo'}</th>
                            <th className="px-5 py-4">{statementView === 'statement' ? 'Saldo' : 'Monto'}</th>
                            <th className="px-5 py-4">{statementView === 'statement' ? 'Estado' : 'Detalle'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(statementView === 'statement' ? loans : recentPayments).length === 0 ? (
                            <tr className="border-t border-[#F1F5F9]">
                              <td colSpan={4} className="px-5 py-10 text-center text-[14px] font-medium text-[#94A3B8]">
                                {statementView === 'statement'
                                  ? 'No hay prestamos visibles para este expediente.'
                                  : 'No hay pagos recientes para exportar en este cliente.'}
                              </td>
                            </tr>
                          ) : (statementView === 'statement' ? loans : recentPayments).map(item => (
                            <tr key={'loanId' in item ? item.id : item.id} className="border-t border-[#F1F5F9] text-[14px] font-medium text-[#374151]">
                              {'loanId' in item ? (
                                <>
                                  <td className="px-5 py-4 font-semibold text-[#111827]">{getShortId(item.id)}</td>
                                  <td className="px-5 py-4">{formatCurrency(item.amount)}</td>
                                  <td className="px-5 py-4">{formatCurrency(item.balance)}</td>
                                  <td className="px-5 py-4">
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'En Mora' ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#DCFCE7] text-[#16A34A]'}`}>
                                      {item.status}
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-5 py-4 font-semibold text-[#111827]">{formatDate(item.date)}</td>
                                  <td className="px-5 py-4">{getShortId(item.id)}</td>
                                  <td className="px-5 py-4">{formatCurrency(item.amount)}</td>
                                  <td className="px-5 py-4 text-[#6B7280]">
                                    Capital {formatCurrency(getPaymentPrincipalPortion(item))} - Interes {formatCurrency(getPaymentInterestPortion(item))} - Mora {formatCurrency(item.moraPaid || 0)}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] bg-[#111827] p-6 text-white shadow-[0_22px_44px_rgba(15,23,42,0.18)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {statementView === 'statement' ? 'Resumen de cartera' : 'Resumen de pagos'}
                    </p>
                    <p className="mt-3 text-[38px] font-black tracking-tight">
                      {formatCurrency(statementView === 'statement' ? portfolioSummary.totalPending : statementTotals.paidTotal)}
                    </p>
                    <div className="mt-4 space-y-2 text-sm font-medium text-slate-300">
                      {statementView === 'statement' ? (
                        <>
                          <p>Prestamos activos: {portfolioSummary.activeLoans}</p>
                          <p>Score: {portfolioSummary.score}/100</p>
                          <p>Promesas activas: {promises.filter(promise => promise.status === 'PENDIENTE').length}</p>
                        </>
                      ) : (
                        <>
                          <p>Pagos visibles: {recentPayments.length}</p>
                          <p>Ultimo pago: {portfolioSummary.lastPayment ? formatDate(portfolioSummary.lastPayment.date) : 'Sin pagos'}</p>
                          <p>Registrado por: {assignedOfficial?.name || 'Sistema'}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6">
                    <h4 className="text-[24px] font-black tracking-tight text-[#111827]">Contexto del documento</h4>
                    <div className="mt-5 space-y-4">
                      <InfoBlock label="Sucursal" value={assignedBranch?.name || 'Sucursal principal'} />
                      <InfoBlock label="Oficial responsable" value={assignedOfficial?.name || 'Sin asignar'} />
                      <InfoBlock
                        label={statementView === 'statement' ? 'Proxima cuota' : 'Ultimo pago'}
                        value={
                          statementView === 'statement'
                            ? portfolioSummary.nextInstallment
                              ? formatDate(portfolioSummary.nextInstallment.dueDate)
                              : 'Sin cuota'
                            : portfolioSummary.lastPayment
                              ? formatDate(portfolioSummary.lastPayment.date)
                              : 'Sin pagos'
                        }
                      />
                      <InfoBlock
                        label={statementView === 'statement' ? 'Ultimo pago' : 'Promesas activas'}
                        value={
                          statementView === 'statement'
                            ? portfolioSummary.lastPayment
                              ? formatDate(portfolioSummary.lastPayment.date)
                              : 'Sin pagos'
                            : `${promises.filter(promise => promise.status === 'PENDIENTE').length}`
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HeaderBadge = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn';
}) => (
  <div>
    <p className="text-sm font-medium text-[#6B7280]">{label}</p>
    <span className={`mt-3 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${tone === 'ok' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEF3C7] text-[#D97706]'}`}>{value}</span>
  </div>
);

const SummaryMetric = ({
  label,
  value,
  helper,
  iconTone,
}: {
  label: string;
  value: string;
  helper?: string;
  iconTone: 'blue' | 'violet' | 'green' | 'amber' | 'slate';
}) => {
  const toneClass =
    iconTone === 'blue'
      ? 'bg-[#DBEAFE] text-[#2563EB]'
      : iconTone === 'violet'
        ? 'bg-[#EDE9FE] text-[#7C3AED]'
        : iconTone === 'green'
          ? 'bg-[#DCFCE7] text-[#16A34A]'
          : iconTone === 'amber'
            ? 'bg-[#FEF3C7] text-[#D97706]'
            : 'bg-[#F1F5F9] text-[#64748B]';

  return (
    <div className="flex items-start gap-4 rounded-[22px] border border-[#F1F5F9] px-5 py-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClass}`}>
        <Wallet size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#6B7280]">{label}</p>
        <p className="mt-2 text-[22px] font-black tracking-tight text-[#111827]">{value}</p>
        {helper && <p className="mt-1 text-sm font-medium text-[#6B7280]">{helper}</p>}
      </div>
    </div>
  );
};

const PanelMetric = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'violet' | 'amber' | 'green';
}) => {
  const toneClass =
    tone === 'blue'
      ? 'bg-[#DBEAFE] text-[#2563EB]'
      : tone === 'violet'
        ? 'bg-[#EDE9FE] text-[#7C3AED]'
        : tone === 'amber'
          ? 'bg-[#FEF3C7] text-[#D97706]'
          : 'bg-[#DCFCE7] text-[#16A34A]';

  return (
    <div className="rounded-[22px] border border-[#E5E7EB] px-5 py-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass}`}>
        <Wallet size={18} />
      </div>
      <p className="mt-4 text-sm font-medium text-[#6B7280]">{label}</p>
      <p className="mt-2 text-[24px] font-black tracking-tight text-[#111827]">{value}</p>
    </div>
  );
};

const AlertRow = ({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: 'ok' | 'warn' | 'info';
}) => {
  const toneClass =
    tone === 'ok'
      ? 'bg-[#DCFCE7] text-[#16A34A]'
      : tone === 'warn'
        ? 'bg-[#FEF3C7] text-[#D97706]'
        : 'bg-[#DBEAFE] text-[#2563EB]';

  return (
    <div className="flex items-center justify-between rounded-[20px] border border-[#F1F5F9] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${toneClass}`}>
          <AlertTriangle size={14} />
        </div>
        <span className="text-sm font-medium text-[#374151]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[#6B7280]">{detail}</span>
    </div>
  );
};

const DocumentCard = ({
  title,
  description,
  actionLabel,
  onClick,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}) => (
  <div className="rounded-[24px] border border-[#E5E7EB] p-6">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
      <FileText size={20} />
    </div>
    <h4 className="mt-4 text-lg font-bold text-[#111827]">{title}</h4>
    <p className="mt-2 text-sm font-medium leading-6 text-[#6B7280]">{description}</p>
    <button onClick={onClick} className="mt-5 cursor-pointer rounded-2xl border border-[#E5E7EB] px-4 py-3 text-sm font-semibold text-[#2563EB] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      {actionLabel}
    </button>
  </div>
);

const StatementMetric = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'indigo' | 'amber' | 'emerald';
}) => {
  const toneMap = {
    blue: 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]',
    indigo: 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]',
    amber: 'bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA]',
    emerald: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]',
  } as const;

  return (
    <div className={`rounded-[24px] border p-5 ${toneMap[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">{label}</p>
      <p className="mt-4 text-[22px] font-black tracking-tight">{value}</p>
    </div>
  );
};

const ModalShell = ({
  title,
  onClose,
  compact,
  children,
}: {
  title: string;
  onClose: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[platform-fade-in_220ms_ease-out]">
    <div className={`platform-modal-panel w-full rounded-[28px] bg-white shadow-2xl ${compact ? 'max-w-md p-8' : 'max-w-2xl p-8'}`}>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-2xl font-black tracking-tight text-[#111827]">{title}</h3>
        <button onClick={onClose} className="platform-modal-close flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-[#E5E7EB] text-[#94A3B8] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FormDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  isOpen,
  onToggle,
  onRequestClose,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  isOpen: boolean;
  onToggle: () => void;
  onRequestClose: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    placement: 'bottom' as 'bottom' | 'top',
  });
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = containerRef.current?.contains(target);
      const isInsideMenu = menuRef.current?.contains(target);
      if (!isInsideTrigger && !isInsideMenu) {
        onRequestClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onRequestClose]);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = Math.min(options.length + 1, 6) * 58 + 18;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placement = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
      setMenuPosition({
        top: placement === 'bottom' ? rect.bottom + 10 : rect.top - 10,
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
    <div className={`relative ${isOpen ? 'z-[90]' : 'z-10'}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className={`flex h-14 w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 ${
          isOpen
            ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
            : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[#111827]">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          className="fixed z-[260] w-max max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: Math.max(menuPosition.width, 260),
            transform: menuPosition.placement === 'top' ? 'translateY(-100%)' : undefined,
          }}
        >
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange('');
              onRequestClose();
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
                onMouseDown={event => event.preventDefault()}
                onClick={event => {
                  event.stopPropagation();
                  onChange(option.value);
                  onRequestClose();
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
        </div>,
        document.body,
      )}
    </div>
  );
};

const InfoBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[22px] border border-[#E5E7EB] px-5 py-4">
    <p className="text-sm font-medium text-[#6B7280]">{label}</p>
    <p className="mt-2 text-[18px] font-semibold text-[#111827]">{value}</p>
  </div>
);

const ModalField = ({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) => (
  <div className="block">
    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">{label}</span>
    {children}
    {helper ? <span className="mt-2 block text-[12px] font-medium leading-5 text-[#94A3B8]">{helper}</span> : null}
  </div>
);


