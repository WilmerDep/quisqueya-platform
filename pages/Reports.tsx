import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LayoutTemplate,
  Printer,
  Search,
  Share2,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import {
  getCompanyById,
  getClientPromises,
  getPayments,
  upsertClientsInLocalStorage,
  upsertLoansInLocalStorage,
  upsertPaymentsInLocalStorage,
} from '../services/dataService';
import {
  buildPlatformPdfFileName,
  createPlatformPdfDoc,
  drawPlatformPdfCard,
  drawPlatformPdfDivider,
  drawPlatformPdfFooter,
  getPlatformPdfVisualPreset,
  platformPdfMarginByPreset,
  platformPdfVisualPresets,
  renderPlatformPdfDocument,
  resolvePlatformPdfTemplateConfig,
} from '../services/pdfBuilder';
import { getPersistedPdfTemplateId, setPersistedPdfTemplateId } from '../services/pdfTemplateSelection';
import { getBranchScope, getScopedClients, getScopedLoans, getScopedUsers } from '../services/viewScope';
import { formatCurrency, formatDate } from '../utils';
import { Branch, CashClosure, Client, Company, Loan, LoanStatus, PaymentPromise, PaymentReceipt, ReportExport, ReportSchedule, ReportTemplate, Role, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient, ReportSummary } from '../services/apiClient';
import { emitPlatformToast } from '../services/platformEvents';

type Period = 'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'TOTAL';
type ReportTab = 'SUMMARY' | 'FINANCIAL' | 'OPERATIONAL' | 'EXPORTS';
type DrillDownType = 'MORA' | 'ACTIVOS' | 'SALDADOS' | null;
type ReportFilterKey =
  | 'period'
  | 'branch'
  | 'collector'
  | 'report'
  | 'documentType'
  | 'documentStatus'
  | 'templateLibrary'
  | 'templatePreset'
  | 'templateStatus'
  | 'templateStyle'
  | 'templatePaperSize'
  | 'templateOrientation'
  | 'templateMargin';
type ExportWorkspace = 'PREVIEW' | 'PDF' | 'CSV' | 'SCHEDULE' | 'TEMPLATE' | 'DOCUMENTS' | 'SHARE' | null;

const reportTabs: Array<{ key: ReportTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { key: 'SUMMARY', label: 'Resumen', icon: TrendingUp },
  { key: 'FINANCIAL', label: 'Financieros', icon: WalletCards },
  { key: 'OPERATIONAL', label: 'Operativos', icon: FileSpreadsheet },
  { key: 'EXPORTS', label: 'Exportaciones', icon: FileText },
];

const horizontalMotionClass =
  'cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

const kpiToneMap = {
  blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]', watermark: 'text-[#DBEAFE]' },
  emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]', watermark: 'text-[#DCFCE7]' },
  red: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', note: 'text-[#DC2626]', watermark: 'text-[#FEE2E2]' },
  amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]', watermark: 'text-[#FEF3C7]' },
} as const;

const defaultTemplateConfig: NonNullable<ReportTemplate['config']> = {
  visualPreset: 'FACTURA_FINANCIERA',
  description: '',
  ...resolvePlatformPdfTemplateConfig({ visualPreset: 'FACTURA_FINANCIERA' }),
  visibleFields: [],
  receiptOptions: {
    showNextInstallment: true,
    showRemainingBalance: true,
    includeSignature: true,
  },
};

const createDefaultTemplateForm = () => ({
  name: '',
  status: 'Borrador',
  isDefault: false,
  sections: [] as string[],
  ...defaultTemplateConfig,
  visibleFields: allTemplateFields,
});

const templateFieldGroups = [
  {
    title: 'Informacion de empresa',
    items: ['Logo', 'Razon social', 'RNC', 'Direccion', 'Telefonos'],
  },
  {
    title: 'Informacion del reporte',
    items: ['Titulo', 'Periodo', 'Sucursal', 'Cobrador', 'Fecha de emision'],
  },
  {
    title: 'Datos financieros',
    items: ['Capital cobrado', 'Intereses cobrados', 'Mora cobrada', 'Total cobrado'],
  },
  {
    title: 'Recibos y pagos',
    items: ['No. de recibo', 'Metodo de pago', 'Saldo restante', 'Proxima cuota', 'Firma'],
  },
];

const allTemplateFields = templateFieldGroups.flatMap(group => group.items);
const templatePresetOptions = Object.values(platformPdfVisualPresets).map(item => ({
  value: item.visualPreset,
  label: item.label,
}));

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [collectors, setCollectors] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [period, setPeriod] = useState<Period>('THIS_MONTH');
  const [activeTab, setActiveTab] = useState<ReportTab>('SUMMARY');
  const [apiSummary, setApiSummary] = useState<ReportSummary | null>(null);
  const [reportExports, setReportExports] = useState<ReportExport[]>([]);
  const [reportSchedules, setReportSchedules] = useState<ReportSchedule[]>([]);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);
  const [drillDownType, setDrillDownType] = useState<DrillDownType>(null);
  const [exportWorkspace, setExportWorkspace] = useState<ExportWorkspace>(null);
  const [exportingFormat, setExportingFormat] = useState<'PDF' | 'CSV' | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [selectedGeneratedDocumentId, setSelectedGeneratedDocumentId] = useState<string>('');
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    frequency: 'Semanal',
    format: 'PDF' as 'PDF' | 'CSV',
    deliveryHour: '08:00',
    targetLabel: 'Gerencia general',
  });
  const [templateForm, setTemplateForm] = useState(createDefaultTemplateForm);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openFilter, setOpenFilter] = useState<ReportFilterKey | null>(null);
  const [summaryActivityPage, setSummaryActivityPage] = useState(1);
  const [financialBreakdownPage, setFinancialBreakdownPage] = useState(1);
  const [financialMovementsPage, setFinancialMovementsPage] = useState(1);
  const [operationalRiskPage, setOperationalRiskPage] = useState(1);
  const [exportsActivityPage, setExportsActivityPage] = useState(1);
  const [documentTypeFilter, setDocumentTypeFilter] = useState('ALL');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('ALL');
  const [documentsPage, setDocumentsPage] = useState(1);

  const isCollector = currentUser?.role === Role.COBRADOR;
  const branchScope = useMemo(() => (currentUser ? getBranchScope(currentUser) : null), [currentUser]);
  const canSeeAllCompanyUsers = branchScope?.canSeeAllCompanyUsers || false;

  const getPeriodRange = (value: Period) => {
    const now = new Date();
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    if (value === 'TODAY') return { startDate: iso(now), endDate: iso(now) };
    if (value === 'THIS_MONTH') return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: iso(now) };
    if (value === 'LAST_MONTH') {
      return {
        startDate: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        endDate: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    }
    return {};
  };

  useEffect(() => {
    if (!currentUser) return;

    let allLoans = getScopedLoans(currentUser);
    let allPayments = getPayments(currentUser.companyId);
    let allClients = getScopedClients(currentUser);
    let allCollectors = getScopedUsers(currentUser, currentUser.branchId).filter(user => user.role === Role.COBRADOR && user.isActive);
    setCompany(getCompanyById(currentUser.companyId));
    setBranches(branchScope?.branches || []);
    setSelectedBranchId(currentUser.branchId);

    if (isCollector) {
      allClients = allClients.filter(client => client.assignedUserId === currentUser.id);
      const clientIds = new Set(allClients.map(client => client.id));
      allLoans = allLoans.filter(loan => clientIds.has(loan.clientId));
      const loanIds = new Set(allLoans.map(loan => loan.id));
      allPayments = allPayments.filter(payment => loanIds.has(payment.loanId));
      allCollectors = allCollectors.filter(collector => collector.id === currentUser.id);
    }

    setLoans(allLoans);
    setPayments(allPayments);
    setClients(allClients);
    setCollectors(allCollectors);

    void Promise.all([apiClient.listClients(), apiClient.listLoans(), apiClient.listPayments(), apiClient.listUsers()])
      .then(([clientsResponse, loansResponse, paymentsResponse, usersResponse]) => {
        upsertClientsInLocalStorage(clientsResponse.data);
        upsertLoansInLocalStorage(loansResponse.data);
        upsertPaymentsInLocalStorage(paymentsResponse.data);

        let apiClients = clientsResponse.data;
        let apiLoans = loansResponse.data;
        let apiPayments = paymentsResponse.data;
        let apiCollectors = usersResponse.data.filter(user => user.role === Role.COBRADOR && user.isActive);

        if (isCollector) {
          apiClients = apiClients.filter(client => client.assignedUserId === currentUser.id);
          const clientIds = new Set(apiClients.map(client => client.id));
          apiLoans = apiLoans.filter(loan => clientIds.has(loan.clientId));
          const loanIds = new Set(apiLoans.map(loan => loan.id));
          apiPayments = apiPayments.filter(payment => loanIds.has(payment.loanId));
          apiCollectors = apiCollectors.filter(collector => collector.id === currentUser.id);
        }

        setClients(apiClients);
        setLoans(apiLoans);
        setPayments(apiPayments);
        setCollectors(apiCollectors);
      })
      .catch(() => undefined);
  }, [branchScope, currentUser, isCollector]);

  useEffect(() => {
    if (!currentUser) return;
    const params = {
      ...getPeriodRange(period),
      branchId: selectedBranchId || undefined,
      collectorId: selectedCollectorId || (isCollector ? currentUser.id : undefined),
    };
    apiClient.getReportSummary(params).then(response => setApiSummary(response.data)).catch(() => setApiSummary(null));
  }, [currentUser, isCollector, period, selectedBranchId, selectedCollectorId]);

  useEffect(() => {
    if (!currentUser) return;
    apiClient
      .listReportExports({ branchId: selectedBranchId || undefined })
      .then(response => setReportExports(response.data))
      .catch(() => setReportExports([]));
  }, [currentUser, selectedBranchId]);

  useEffect(() => {
    if (!currentUser) return;
    apiClient
      .listReportSchedules({ branchId: selectedBranchId || undefined })
      .then(response => setReportSchedules(response.data))
      .catch(() => setReportSchedules([]));
  }, [currentUser, selectedBranchId]);

  useEffect(() => {
    if (!currentUser) return;
    apiClient
      .listReportTemplates()
      .then(response => setReportTemplates(response.data))
      .catch(() => setReportTemplates([]));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    apiClient
      .listCashClosures()
      .then(response => setCashClosures(response.data))
      .catch(() => setCashClosures([]));
  }, [currentUser]);

  useEffect(() => {
    if (!reportTemplates.length) return;
    const persistedTemplateId = getPersistedPdfTemplateId(currentUser?.companyId);
    if (selectedTemplateId && reportTemplates.some(template => template.id === selectedTemplateId)) return;
    const nextTemplate =
      reportTemplates.find(template => template.id === persistedTemplateId) ||
      reportTemplates.find(template => template.isDefault) ||
      reportTemplates[0];
    setSelectedTemplateId(nextTemplate.id);
  }, [currentUser?.companyId, reportTemplates, selectedTemplateId]);

  useEffect(() => {
    if (!currentUser?.companyId) return;
    setPersistedPdfTemplateId(currentUser.companyId, selectedTemplateId);
  }, [currentUser?.companyId, selectedTemplateId]);

  useEffect(() => {
    if (!isCollector || !currentUser) return;
    setSelectedCollectorId(currentUser.id);
  }, [currentUser, isCollector]);

  const scopedClients = useMemo(() => {
    let base = selectedBranchId ? clients.filter(client => client.branchId === selectedBranchId) : clients;
    if (selectedCollectorId) {
      base = base.filter(client => client.assignedUserId === selectedCollectorId);
    }
    const query = searchTerm.trim().toLowerCase();
    if (!query) return base;
    return base.filter(client =>
      `${client.firstName} ${client.lastName}`.toLowerCase().includes(query) ||
      client.phone.toLowerCase().includes(query) ||
      client.cedula.toLowerCase().includes(query),
    );
  }, [clients, searchTerm, selectedBranchId, selectedCollectorId]);

  const scopedLoans = useMemo(() => {
    const allowedClientIds = new Set(scopedClients.map(client => client.id));
    return loans.filter(loan => (!selectedBranchId || loan.branchId === selectedBranchId) && allowedClientIds.has(loan.clientId));
  }, [loans, scopedClients, selectedBranchId]);

  const scopedPayments = useMemo(() => {
    const loanIds = new Set(scopedLoans.map(loan => loan.id));
    return payments.filter(payment => loanIds.has(payment.loanId));
  }, [payments, scopedLoans]);

  const activeBranch = useMemo(() => branches.find(branch => branch.id === selectedBranchId), [branches, selectedBranchId]);
  const scopedCollectors = useMemo(() => {
    const branchFiltered = selectedBranchId ? collectors.filter(collector => collector.branchId === selectedBranchId) : collectors;
    if (isCollector && currentUser) {
      return branchFiltered.filter(collector => collector.id === currentUser.id);
    }
    return branchFiltered;
  }, [collectors, currentUser, isCollector, selectedBranchId]);

  useEffect(() => {
    if (!selectedCollectorId) return;
    if (scopedCollectors.some(collector => collector.id === selectedCollectorId)) return;
    setSelectedCollectorId(isCollector && currentUser ? currentUser.id : '');
  }, [currentUser, isCollector, scopedCollectors, selectedCollectorId]);

  useEffect(() => {
    setSummaryActivityPage(1);
    setFinancialBreakdownPage(1);
    setFinancialMovementsPage(1);
    setOperationalRiskPage(1);
    setExportsActivityPage(1);
  }, [activeTab, period, searchTerm, selectedBranchId, selectedCollectorId]);

  useEffect(() => {
    setDocumentsPage(1);
  }, [documentStatusFilter, documentTypeFilter]);

  useEffect(() => {
    setExportFeedback(null);
  }, [exportWorkspace]);

  const reportData = useMemo(() => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filterByPeriod = (dateStr: string, activePeriod: Period) => {
      const date = new Date(dateStr);
      if (activePeriod === 'TODAY') return date.toDateString() === today.toDateString();
      if (activePeriod === 'THIS_MONTH') return date >= startOfThisMonth;
      if (activePeriod === 'LAST_MONTH') return date >= startOfLastMonth && date <= endOfLastMonth;
      return true;
    };

    const periodPayments = scopedPayments.filter(payment => filterByPeriod(payment.date, period));
    const periodLoans = scopedLoans.filter(loan => filterByPeriod(loan.createdAt, period));

    const collected = periodPayments.reduce((acc, payment) => acc + payment.amount, 0);
    const lent = periodLoans.reduce((acc, loan) => acc + loan.amount, 0);
    const expectedInterest = periodLoans.reduce((acc, loan) => acc + (loan.totalToPay - loan.amount), 0);
    const moraCollected = periodPayments.reduce((acc, payment) => acc + payment.moraPaid, 0);

    const previousPeriodPayments = scopedPayments.filter(payment =>
      filterByPeriod(payment.date, period === 'THIS_MONTH' ? 'LAST_MONTH' : 'TOTAL'),
    );
    const previousCollected = previousPeriodPayments.reduce((acc, payment) => acc + payment.amount, 0);
    const growth = previousCollected > 0 ? ((collected - previousCollected) / previousCollected) * 100 : 0;

    const inMora = scopedLoans.filter(loan => {
      if (loan.status === LoanStatus.COMPLETADO) return false;
      return loan.installments.some(installment => installment.status !== 'PAGADO' && new Date(installment.dueDate) < today);
    });
    const actives = scopedLoans.filter(loan => loan.status === LoanStatus.ACTIVO && !inMora.find(item => item.id === loan.id));
    const finished = scopedLoans.filter(loan => loan.status === LoanStatus.COMPLETADO);

    return {
      collected,
      lent,
      expectedInterest,
      moraCollected,
      growth,
      inMora,
      actives,
      finished,
      totalPortfolio: scopedLoans.reduce((acc, loan) => acc + loan.balance, 0),
      movementCount: periodPayments.length,
    };
  }, [period, scopedLoans, scopedPayments]);

  const exportActivityFallback = useMemo(
    () => [
      { name: 'Resumen general semanal', type: 'Resumen', range: '19/05/2026 - 25/05/2026', owner: currentUser?.name || 'Sistema', date: '25/05/2026 08:00 a. m.', format: 'PDF' as const },
      { name: 'Cobros por cobrador', type: 'Operativo', range: '19/05/2026 - 25/05/2026', owner: currentUser?.name || 'Sistema', date: '25/05/2026 07:45 a. m.', format: 'CSV' as const },
      { name: 'Ingresos por sucursal', type: 'Financiero', range: '01/05/2026 - 25/05/2026', owner: currentUser?.name || 'Sistema', date: '24/05/2026 06:30 p. m.', format: 'PDF' as const },
      { name: 'Mora consolidada', type: 'Financiero', range: '01/05/2026 - 25/05/2026', owner: currentUser?.name || 'Sistema', date: '24/05/2026 05:10 p. m.', format: 'PDF' as const },
      { name: 'Productividad por ruta', type: 'Operativo', range: '19/05/2026 - 25/05/2026', owner: currentUser?.name || 'Sistema', date: '23/05/2026 04:20 p. m.', format: 'CSV' as const },
      { name: 'Resumen ejecutivo mensual', type: 'Resumen', range: '01/05/2026 - 31/05/2026', owner: currentUser?.name || 'Sistema', date: '22/05/2026 11:00 a. m.', format: 'PDF' as const },
    ],
    [currentUser?.name],
  );

  const exportHistoryRows = useMemo(
    () =>
      reportExports.map(item => ({
        id: item.id,
        name: item.reportName,
        type: item.reportType,
        range: item.rangeLabel,
        owner: item.collectorName || currentUser?.name || 'Sistema',
        date: new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        }).format(new Date(item.createdAt)),
        format: item.format,
        source: item,
      })),
    [currentUser?.name, reportExports],
  );

  const reportActivityRows = reportExports.length ? exportHistoryRows : exportActivityFallback;
  const effectiveTemplate = useMemo(
    () =>
      reportTemplates.find(template => template.id === selectedTemplateId) ||
      reportTemplates.find(template => template.isDefault) ||
      reportTemplates[0] ||
      null,
    [reportTemplates, selectedTemplateId],
  );

  const effectiveTemplateConfig = useMemo(
    () => ({
      ...defaultTemplateConfig,
      ...resolvePlatformPdfTemplateConfig({
        visualPreset: effectiveTemplate?.config?.visualPreset || defaultTemplateConfig.visualPreset,
        paperSize: effectiveTemplate?.config?.paperSize,
        orientation: effectiveTemplate?.config?.orientation,
        marginPreset: effectiveTemplate?.config?.marginPreset,
        documentStyle: effectiveTemplate?.config?.documentStyle,
      }),
      ...(effectiveTemplate?.config || {}),
      visibleFields: effectiveTemplate?.config?.visibleFields?.length ? effectiveTemplate.config.visibleFields : allTemplateFields,
      receiptOptions: {
        ...defaultTemplateConfig.receiptOptions,
        ...(effectiveTemplate?.config?.receiptOptions || {}),
      },
    }),
    [effectiveTemplate],
  );

  const sampleReceiptContext = useMemo(() => {
    const latestPayment = [...scopedPayments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const payment = latestPayment || payments[0];
    if (!payment) return null;
    const loan = scopedLoans.find(item => item.id === payment.loanId) || loans.find(item => item.id === payment.loanId);
    const client = loan
      ? scopedClients.find(item => item.id === loan.clientId) || clients.find(item => item.id === loan.clientId)
      : null;
    const nextInstallment = loan?.installments.find(item => item.status !== 'PAGADO');
    const totalPaid = payment.amount + payment.moraPaid;

    return {
      payment,
      loan,
      client,
      nextInstallment,
      totalPaid,
      receiptNumber: `REC-${new Date(payment.date).getFullYear()}-${payment.id.slice(0, 6).toUpperCase()}`,
    };
  }, [clients, loans, payments, scopedClients, scopedLoans, scopedPayments]);

  const scopedPromises = useMemo<PaymentPromise[]>(
    () => scopedClients.flatMap(client => getClientPromises(client.id)),
    [scopedClients],
  );

  const generatedDocuments = useMemo(() => {
    const branchName = activeBranch?.name || 'Sucursal principal';
    const ownerName = currentUser.name;
    const docsFromHistory = exportHistoryRows.map((item, index) => ({
      id: item.id || `${item.name}-${index}`,
      kind: 'EXPORT' as const,
      type: item.format === 'PDF' ? 'Reporte exportado' : 'Analisis CSV',
      clientName: item.owner,
      reference: item.name,
      date: item.date,
      dateISO: item.source.createdAt,
      status: 'Generado',
      channel: item.format === 'PDF' ? 'Descarga' : 'CSV',
      format: item.format,
      owner: item.owner,
      branchName,
    }));

    const paymentDocs = scopedPayments.slice(0, 8).map(payment => {
      const loan = scopedLoans.find(item => item.id === payment.loanId) || loans.find(item => item.id === payment.loanId);
      const client = loan
        ? scopedClients.find(item => item.id === loan.clientId) || clients.find(item => item.id === loan.clientId)
        : null;
      const installment = loan?.installments.find(item => item.id === payment.installmentId);
      const isPartial = installment ? payment.amount < installment.expectedAmount : false;
      return {
        id: `receipt-${payment.id}`,
        kind: isPartial ? 'PARTIAL_PAYMENT' as const : 'PAYMENT_RECEIPT' as const,
        type: isPartial ? 'Pago parcial' : 'Recibo de pago',
        clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente',
        reference: loan?.id || payment.loanId,
        date: new Intl.DateTimeFormat('es-DO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(payment.date)),
        dateISO: payment.date,
        status: 'Generado',
        channel: 'Sistema',
        format: 'PDF' as const,
        owner: ownerName,
        amount: payment.amount + payment.moraPaid,
        branchName,
        payment,
        loan,
        client,
        installment,
      };
    });

    const promiseDocs = scopedPromises.slice(0, 4).map(promise => {
      const loan = scopedLoans.find(item => item.id === promise.loanId) || loans.find(item => item.id === promise.loanId);
      const client = scopedClients.find(item => item.id === promise.clientId) || clients.find(item => item.id === promise.clientId);
      return {
        id: `promise-${promise.id}`,
        kind: 'PAYMENT_PROMISE' as const,
        type: 'Promesa de pago',
        clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente',
        reference: loan?.id || promise.loanId,
        date: formatDate(promise.date),
        dateISO: promise.date,
        status: promise.status === 'INCUMPLIDA' ? 'Incumplida' : promise.status === 'CUMPLIDA' ? 'Cumplida' : 'Pendiente',
        channel: 'Gestion',
        format: 'PDF' as const,
        owner: ownerName,
        amount: promise.amount,
        branchName,
        promise,
        loan,
        client,
      };
    });

    const moraDocs = reportData.inMora.slice(0, 3).map(loan => {
      const client = scopedClients.find(item => item.id === loan.clientId) || clients.find(item => item.id === loan.clientId);
      const lateDays = loan.installments.reduce((max, installment) => {
        if (installment.status === 'PAGADO') return max;
        const diff = Math.floor((Date.now() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        return diff > max ? diff : max;
      }, 0);
      return {
      id: `mora-${loan.id}`,
      kind: 'MORA_NOTICE' as const,
      type: 'Mora',
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente',
      reference: loan.id,
      date: formatDate(loan.startDate),
      dateISO: loan.startDate,
      status: 'Pendiente',
      channel: 'Sistema',
      format: 'PDF' as const,
      owner: ownerName,
      amount: loan.balance,
      branchName,
      loan,
      client,
      lateDays,
    };
    });

    const accountStatementDocs = reportData.actives.slice(0, 3).map(loan => {
      const client = scopedClients.find(item => item.id === loan.clientId) || clients.find(item => item.id === loan.clientId);
      return {
      id: `statement-${loan.id}`,
      kind: 'ACCOUNT_STATEMENT' as const,
      type: 'Estado de cuenta',
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente',
      reference: loan.id,
      date: formatDate(loan.startDate),
      dateISO: loan.startDate,
      status: 'Generado',
      channel: 'Sistema',
      format: 'PDF' as const,
      owner: ownerName,
      amount: loan.balance,
      branchName,
      loan,
      client,
    };
    });

    const closureDocs = cashClosures.slice(0, 3).map(closure => ({
      id: `closure-${closure.id}`,
      kind: 'CASH_CLOSURE' as const,
      type: 'Cierre de caja',
      clientName: closure.branchName,
      reference: closure.id.slice(0, 8).toUpperCase(),
      date: formatDate(closure.businessDate),
      dateISO: closure.businessDate,
      status: closure.status === 'BALANCED' ? 'Cuadrado' : 'Con diferencia',
      channel: 'Caja',
      format: 'PDF' as const,
      owner: closure.userName,
      amount: closure.countedAmount,
      branchName: closure.branchName,
      closure,
    }));

    return [...paymentDocs, ...promiseDocs, ...moraDocs, ...accountStatementDocs, ...closureDocs, ...docsFromHistory]
      .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime())
      .slice(0, 18);
  }, [activeBranch?.name, cashClosures, clients, currentUser.name, exportHistoryRows, loans, reportData.actives, reportData.inMora, scopedClients, scopedLoans, scopedPayments, scopedPromises]);

  const filteredGeneratedDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return generatedDocuments.filter(item => {
      if (documentTypeFilter !== 'ALL' && item.kind !== documentTypeFilter) return false;
      if (documentStatusFilter !== 'ALL' && item.status !== documentStatusFilter) return false;
      if (!query) return true;
      return (
        item.type.toLowerCase().includes(query) ||
        item.clientName.toLowerCase().includes(query) ||
        item.reference.toLowerCase().includes(query) ||
        item.channel.toLowerCase().includes(query)
      );
    });
  }, [documentStatusFilter, documentTypeFilter, generatedDocuments, searchTerm]);

  const documentsPageData = useMemo(
    () => paginateItems(filteredGeneratedDocuments, documentsPage, 10),
    [documentsPage, filteredGeneratedDocuments],
  );

  useEffect(() => {
    if (!filteredGeneratedDocuments.length) {
      setSelectedGeneratedDocumentId('');
      return;
    }
    if (selectedGeneratedDocumentId && filteredGeneratedDocuments.some(item => item.id === selectedGeneratedDocumentId)) return;
    setSelectedGeneratedDocumentId(filteredGeneratedDocuments[0].id);
  }, [filteredGeneratedDocuments, selectedGeneratedDocumentId]);

  const selectedGeneratedDocument =
    filteredGeneratedDocuments.find(item => item.id === selectedGeneratedDocumentId) ||
    filteredGeneratedDocuments[0] ||
    null;

  const selectedDocumentPreview = useMemo(() => {
    if (!selectedGeneratedDocument) return null;

    if (selectedGeneratedDocument.kind === 'PAYMENT_RECEIPT' || selectedGeneratedDocument.kind === 'PARTIAL_PAYMENT') {
      return {
        title: selectedGeneratedDocument.kind === 'PARTIAL_PAYMENT' ? 'Recibo de pago parcial' : 'Recibo de pago',
        accent: 'green' as const,
        summaryLabel: 'Total pagado',
        summaryValue: formatCurrency(selectedGeneratedDocument.amount || 0),
        rows: [
          ['Cliente', selectedGeneratedDocument.clientName],
          ['Prestamo', selectedGeneratedDocument.reference],
          ['Fecha de pago', selectedGeneratedDocument.date],
          ['Capital', formatCurrency(selectedGeneratedDocument.payment?.amount || 0)],
          ['Mora', formatCurrency(selectedGeneratedDocument.payment?.moraPaid || 0)],
          ['Estado', selectedGeneratedDocument.status],
        ],
      };
    }

    if (selectedGeneratedDocument.kind === 'PAYMENT_PROMISE') {
      return {
        title: 'Promesa de pago',
        accent: 'amber' as const,
        summaryLabel: 'Monto prometido',
        summaryValue: formatCurrency(selectedGeneratedDocument.amount || 0),
        rows: [
          ['Cliente', selectedGeneratedDocument.clientName],
          ['Prestamo', selectedGeneratedDocument.reference],
          ['Fecha compromiso', selectedGeneratedDocument.date],
          ['Estado', selectedGeneratedDocument.status],
          ['Nota', selectedGeneratedDocument.promise?.note || 'Sin comentario'],
        ],
      };
    }

    if (selectedGeneratedDocument.kind === 'MORA_NOTICE') {
      return {
        title: 'Notificacion de mora',
        accent: 'red' as const,
        summaryLabel: 'Saldo vencido',
        summaryValue: formatCurrency(selectedGeneratedDocument.amount || 0),
        rows: [
          ['Cliente', selectedGeneratedDocument.clientName],
          ['Prestamo', selectedGeneratedDocument.reference],
          ['Dias de atraso', `${selectedGeneratedDocument.lateDays || 0}`],
          ['Estado', selectedGeneratedDocument.status],
          ['Sucursal', selectedGeneratedDocument.branchName || activeBranch?.name || 'Sucursal'],
        ],
      };
    }

    if (selectedGeneratedDocument.kind === 'ACCOUNT_STATEMENT') {
      return {
        title: 'Estado de cuenta',
        accent: 'blue' as const,
        summaryLabel: 'Balance actual',
        summaryValue: formatCurrency(selectedGeneratedDocument.amount || 0),
        rows: [
          ['Cliente', selectedGeneratedDocument.clientName],
          ['Prestamo', selectedGeneratedDocument.reference],
          ['Fecha de apertura', selectedGeneratedDocument.date],
          ['Cuotas', `${selectedGeneratedDocument.loan?.installments.length || 0}`],
          ['Estado', selectedGeneratedDocument.loan?.status || selectedGeneratedDocument.status],
        ],
      };
    }

    if (selectedGeneratedDocument.kind === 'CASH_CLOSURE') {
      return {
        title: 'Cierre de caja',
        accent: 'violet' as const,
        summaryLabel: 'Monto contado',
        summaryValue: formatCurrency(selectedGeneratedDocument.amount || 0),
        rows: [
          ['Sucursal', selectedGeneratedDocument.clientName],
          ['Fecha operativa', selectedGeneratedDocument.date],
          ['Responsable', selectedGeneratedDocument.owner],
          ['Estado', selectedGeneratedDocument.status],
          ['Diferencia', formatCurrency(selectedGeneratedDocument.closure?.differenceAmount || 0)],
        ],
      };
    }

    return {
      title: selectedGeneratedDocument.type,
      accent: 'blue' as const,
      summaryLabel: 'Formato',
      summaryValue: selectedGeneratedDocument.format,
      rows: [
        ['Referencia', selectedGeneratedDocument.reference],
        ['Generado por', selectedGeneratedDocument.owner],
        ['Fecha', selectedGeneratedDocument.date],
        ['Canal', selectedGeneratedDocument.channel],
      ],
    };
  }, [activeBranch?.name, selectedGeneratedDocument]);

  const reportsSubview = useMemo<'MAIN' | 'PREVIEW' | 'TEMPLATE' | 'DOCUMENTS'>(() => {
    const path = location.pathname.toLowerCase();
    if (path.endsWith('/preview')) return 'PREVIEW';
    if (path.endsWith('/templates')) return 'TEMPLATE';
    if (path.endsWith('/documents')) return 'DOCUMENTS';
    return 'MAIN';
  }, [location.pathname]);

  const openReportsSubview = (target: 'preview' | 'templates' | 'documents') => {
    navigate(`/reports/${target}`);
  };

  const closeReportsSubview = () => {
    navigate('/reports');
  };

  const kpiCards = useMemo(() => {
    const collected = apiSummary?.payments.collected ?? reportData.collected;
    const interest = apiSummary?.loans.expectedInterest ?? reportData.expectedInterest;
    const mora = apiSummary?.payments.moraCollected ?? reportData.moraCollected;
    const overdueClientsCount = apiSummary?.overdue.overdueLoans ?? reportData.inMora.length;
    const routeProductivity = apiSummary?.routes.totalRoutes
      ? Math.round((apiSummary.routes.closedRoutes / Math.max(apiSummary.routes.totalRoutes, 1)) * 1000) / 10
      : 0;
    const receipts = apiSummary?.payments.receipts ?? reportData.movementCount;
    const cashBalance = apiSummary?.cash.balance ?? 0;
    const totalRoutes = Math.max(apiSummary?.routes.totalRoutes ?? 0, 1);
    const totalLoans = Math.max(scopedLoans.length, 1);

    if (activeTab === 'FINANCIAL') {
      return [
        { label: 'Capital cobrado', value: formatCurrency(collected), helper: `${reportData.growth >= 0 ? '+' : '-'}${Math.abs(reportData.growth).toFixed(1)}% vs periodo anterior`, share: Math.min(Math.max((collected / Math.max(collected + interest + mora, 1)) * 100, 0), 100), tone: 'blue' as const, icon: WalletCards },
        { label: 'Interes cobrado', value: formatCurrency(interest), helper: `${receipts} movimientos conciliados`, share: Math.min(Math.max((interest / Math.max(collected + interest + mora, 1)) * 100, 0), 100), tone: 'emerald' as const, icon: TrendingUp },
        { label: 'Mora cobrada', value: formatCurrency(mora), helper: `${apiSummary?.payments.voidedPayments ?? 0} ajustes o anulaciones`, share: Math.min(Math.max((mora / Math.max(collected + interest + mora, 1)) * 100, 0), 100), tone: 'red' as const, icon: AlertTriangle },
        { label: 'Movimientos de caja', value: `${receipts}`, helper: 'Actividad financiera visible', share: Math.min(Math.max((receipts / Math.max(scopedPayments.length || 1, 1)) * 100, 0), 100), tone: 'amber' as const, icon: FileText },
        { label: 'Prestamos activos', value: `${scopedLoans.filter(loan => loan.status === LoanStatus.ACTIVO).length}`, helper: 'Base financiada del periodo', share: Math.min(Math.max((scopedLoans.filter(loan => loan.status === LoanStatus.ACTIVO).length / totalLoans) * 100, 0), 100), tone: 'blue' as const, icon: Users },
        { label: 'Balance neto', value: formatCurrency(cashBalance), helper: activeBranch?.name || 'Sucursal activa', share: 100, tone: 'emerald' as const, icon: Printer },
      ];
    }

    if (activeTab === 'OPERATIONAL') {
      return [
        { label: 'Prestamos al dia', value: `${reportData.actives.length}`, helper: 'Base saludable de gestion', share: Math.min(Math.max((reportData.actives.length / totalLoans) * 100, 0), 100), tone: 'blue' as const, icon: CheckCircle2 },
        { label: 'Clientes atrasados', value: `${reportData.inMora.length}`, helper: 'Requieren accion inmediata', share: Math.min(Math.max((reportData.inMora.length / totalLoans) * 100, 0), 100), tone: 'red' as const, icon: AlertTriangle },
        { label: 'Prestamos saldados', value: `${reportData.finished.length}`, helper: 'Cierres completados', share: Math.min(Math.max((reportData.finished.length / totalLoans) * 100, 0), 100), tone: 'emerald' as const, icon: FileText },
        { label: 'Cobros pendientes', value: formatCurrency(reportData.totalPortfolio), helper: 'Pendiente de recuperar', share: 100, tone: 'amber' as const, icon: WalletCards },
        { label: 'Recibos emitidos', value: `${receipts}`, helper: 'Actividad operativa del periodo', share: Math.min(Math.max((receipts / Math.max(scopedPayments.length || 1, 1)) * 100, 0), 100), tone: 'blue' as const, icon: CalendarDays },
        { label: 'Productividad', value: `${routeProductivity}%`, helper: 'Rutas cerradas vs programadas', share: Math.min(Math.max((apiSummary?.routes.closedRoutes ?? 0) / totalRoutes * 100, 0), 100), tone: 'emerald' as const, icon: Share2 },
      ];
    }

    if (activeTab === 'EXPORTS') {
      const pdfExports = exportHistoryRows.filter(item => item.format === 'PDF').length;
      const csvExports = exportHistoryRows.filter(item => item.format === 'CSV').length;
      return [
        { label: 'PDF generados', value: String(pdfExports), helper: 'Cortes ejecutivos recientes', share: Math.min(pdfExports * 12, 100), tone: 'blue' as const, icon: FileText },
        { label: 'CSV emitidos', value: String(csvExports), helper: 'Analisis operativos descargados', share: Math.min(csvExports * 12, 100), tone: 'emerald' as const, icon: FileSpreadsheet },
        { label: 'Programaciones activas', value: String(reportSchedules.filter(item => item.isActive).length), helper: 'Envios automaticos vigentes', share: Math.min(reportSchedules.filter(item => item.isActive).length * 18, 100), tone: 'amber' as const, icon: CalendarDays },
        { label: 'Plantillas listas', value: String(reportTemplates.length), helper: 'Formatos reutilizables', share: Math.min(reportTemplates.length * 16, 100), tone: 'blue' as const, icon: LayoutTemplate },
        { label: 'Compartidos', value: '9', helper: 'Entregas internas y externas', share: 44, tone: 'emerald' as const, icon: Share2 },
        { label: 'Ultimo corte', value: exportHistoryRows.length ? 'Hoy' : 'Pendiente', helper: currentUser.name, share: 100, tone: 'red' as const, icon: Download },
      ];
    }

    return [
      { label: 'Capital cobrado', value: formatCurrency(collected), helper: `${reportData.growth >= 0 ? '+' : '-'}${Math.abs(reportData.growth).toFixed(1)}% vs periodo anterior`, share: Math.min(Math.max((collected / Math.max(collected + interest + mora, 1)) * 100, 0), 100), tone: 'blue' as const, icon: WalletCards },
      { label: 'Interes cobrado', value: formatCurrency(interest), helper: `${receipts} recibos procesados`, share: Math.min(Math.max((interest / Math.max(collected + interest + mora, 1)) * 100, 0), 100), tone: 'emerald' as const, icon: TrendingUp },
      { label: 'Mora cobrada', value: formatCurrency(mora), helper: `${apiSummary?.payments.voidedPayments ?? 0} recibos anulados`, share: Math.min(Math.max((mora / Math.max(collected + interest + mora, 1)) * 100, 0), 100), tone: 'red' as const, icon: AlertTriangle },
      { label: 'Clientes atrasados', value: overdueClientsCount.toLocaleString(), helper: `${reportData.inMora.length} prestamos en riesgo`, share: Math.min(Math.max((overdueClientsCount / Math.max(scopedClients.length, 1)) * 100, 0), 100), tone: 'amber' as const, icon: Users },
      { label: 'Rutas cerradas', value: `${apiSummary?.routes.closedRoutes ?? 0}/${apiSummary?.routes.totalRoutes ?? 0}`, helper: `${routeProductivity}% de productividad operativa`, share: Math.min(Math.max((apiSummary?.routes.closedRoutes ?? 0) / totalRoutes * 100, 0), 100), tone: 'emerald' as const, icon: CheckCircle2 },
      { label: 'Balance de caja', value: formatCurrency(cashBalance), helper: activeBranch?.name || 'Sucursal activa', share: 100, tone: 'blue' as const, icon: Printer },
    ];
  }, [activeBranch?.name, activeTab, apiSummary, currentUser.name, exportHistoryRows, reportData, reportSchedules, reportTemplates.length, scopedClients.length, scopedLoans, scopedPayments.length]);

  const chartData = useMemo(() => {
    const labels =
      period === 'TODAY'
        ? ['08h', '10h', '12h', '14h', '16h', '18h']
        : period === 'TOTAL'
          ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']
          : ['01', '05', '10', '15', '20', '25', '30'];

    return labels.map((label, index) => {
      const divisor = Math.max(labels.length - index, 1);
      const collected = Math.round(reportData.collected / divisor);
      const interest = Math.round(reportData.expectedInterest / divisor / 1.8);
      const mora = Math.round(reportData.moraCollected / divisor / 1.2);
      return {
        label,
        collected,
        interest,
        mora,
        total: collected + interest + mora,
      };
    });
  }, [period, reportData.collected, reportData.expectedInterest, reportData.moraCollected]);

  const compositionData = useMemo(() => {
    const collected = Math.max(apiSummary?.payments.collected ?? reportData.collected, 0);
    const interest = Math.max(reportData.expectedInterest, 0);
    const mora = Math.max(apiSummary?.payments.moraCollected ?? reportData.moraCollected, 0);
    const other = Math.max((apiSummary?.cash.cashIn ?? 0) - collected, 0);
    const total = Math.max(collected + interest + mora + other, 1);

    return [
      { name: 'Capital', value: collected, color: '#2563EB', share: Math.round((collected / total) * 1000) / 10 },
      { name: 'Interes', value: interest, color: '#22C55E', share: Math.round((interest / total) * 1000) / 10 },
      { name: 'Mora', value: mora, color: '#F97316', share: Math.round((mora / total) * 1000) / 10 },
      { name: 'Otros ingresos', value: other, color: '#7C3AED', share: Math.round((other / total) * 1000) / 10 },
    ];
  }, [apiSummary, reportData.collected, reportData.expectedInterest, reportData.moraCollected]);

  const financialBreakdown = useMemo(() => {
    return branches
      .filter(branch => !selectedBranchId || branch.id === selectedBranchId)
      .map(branch => {
        const branchLoans = loans.filter(loan => loan.branchId === branch.id);
        const branchLoanIds = new Set(branchLoans.map(loan => loan.id));
        const branchPayments = payments.filter(payment => branchLoanIds.has(payment.loanId));
        const capital = branchPayments.reduce((acc, payment) => acc + payment.amount, 0);
        const interest = branchLoans.reduce((acc, loan) => acc + Math.max(loan.totalToPay - loan.amount, 0), 0);
        const mora = branchPayments.reduce((acc, payment) => acc + payment.moraPaid, 0);
        const total = capital + interest + mora;
        return { branch, capital, interest, mora, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [branches, loans, payments, selectedBranchId]);

  const recentFinancialMovements = useMemo(() => {
    const loanById = new Map(scopedLoans.map(loan => [loan.id, loan]));
    const clientById = new Map(scopedClients.map(client => [client.id, client]));

    return scopedPayments
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
      .map(payment => {
        const loan = loanById.get(payment.loanId);
        const client = loan ? clientById.get(loan.clientId) : undefined;
        return {
          id: payment.id,
          date: payment.date,
          concept: payment.moraPaid > 0 ? 'Cobro con mora' : 'Cobro de cuota',
          category: payment.moraPaid > 0 ? 'Mora' : 'Cobros',
          amount: payment.amount,
          origin: client ? `${client.firstName} ${client.lastName}` : payment.loanId,
          status: 'Completado',
        };
      });
  }, [scopedClients, scopedLoans, scopedPayments]);

  const operationalStatusData = useMemo(() => {
    const atRisk = reportData.inMora.length;
    const current = reportData.actives.length;
    const settled = reportData.finished.length;
    const critical = Math.max(atRisk - Math.floor(atRisk * 0.4), 0);
    const total = Math.max(atRisk + current + settled + critical, 1);
    return [
      { name: 'Al dia', value: current, color: '#22C55E', share: Math.round((current / total) * 1000) / 10 },
      { name: 'Atrasados 1-30', value: Math.max(atRisk - critical, 0), color: '#F59E0B', share: Math.round(((atRisk - critical) / total) * 1000) / 10 },
      { name: 'Atrasados +30', value: critical, color: '#EF4444', share: Math.round((critical / total) * 1000) / 10 },
      { name: 'Saldados', value: settled, color: '#7C3AED', share: Math.round((settled / total) * 1000) / 10 },
    ];
  }, [reportData.actives.length, reportData.finished.length, reportData.inMora.length]);

  const overdueClients = useMemo(() => {
    const today = new Date();
    return reportData.inMora
      .map(loan => {
        const client = scopedClients.find(item => item.id === loan.clientId);
        const nextLateInstallment = loan.installments.find(installment => installment.status !== 'PAGADO' && new Date(installment.dueDate) < today);
        const lateDays = nextLateInstallment
          ? Math.max(1, Math.floor((today.getTime() - new Date(nextLateInstallment.dueDate).getTime()) / 86400000))
          : 0;
        return { loan, client, lateDays };
      })
      .sort((a, b) => b.lateDays - a.lateDays)
      .slice(0, 6);
  }, [reportData.inMora, scopedClients]);

  const exportDataset = useMemo(() => {
    if (activeTab === 'FINANCIAL') {
      return {
        title: 'Reporte financiero',
        columns: ['Sucursal', 'Capital', 'Interes', 'Mora', 'Total'],
        rows: financialBreakdown.map(item => [
          item.branch.name,
          formatCurrency(item.capital),
          formatCurrency(item.interest),
          formatCurrency(item.mora),
          formatCurrency(item.total),
        ]),
      };
    }

    if (activeTab === 'OPERATIONAL') {
      return {
        title: 'Reporte operativo',
        columns: ['Cliente', 'Dias atraso', 'Pendiente', 'Estado'],
        rows: overdueClients.map(item => [
          `${item.client.firstName} ${item.client.lastName}`,
          String(item.lateDays),
          formatCurrency(item.loan.balance),
          item.loan.status,
        ]),
      };
    }

    if (activeTab === 'EXPORTS') {
      return {
        title: 'Reporte de exportaciones',
        columns: ['Reporte', 'Tipo', 'Rango', 'Generado por', 'Formato'],
        rows: exportHistoryRows.map(item => [item.name, item.type, item.range, item.owner, item.format]),
      };
    }

    return {
      title: 'Reporte resumen',
      columns: ['Seccion', 'Indicador', 'Valor'],
      rows: [
        ['Resumen', 'Capital cobrado', formatCurrency(apiSummary?.payments.collected ?? reportData.collected)],
        ['Resumen', 'Interes proyectado', formatCurrency(apiSummary?.loans.expectedInterest ?? reportData.expectedInterest)],
        ['Resumen', 'Mora cobrada', formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected)],
        ['Resumen', 'Prestamos activos', String(apiSummary?.loans.active ?? reportData.actives.length)],
        ['Resumen', 'Clientes en riesgo', String(apiSummary?.overdue.overdueLoans ?? reportData.inMora.length)],
        ['Resumen', 'Sucursal', activeBranch?.name || 'Todas'],
      ],
    };
  }, [
    activeBranch?.name,
    activeTab,
    apiSummary,
    exportHistoryRows,
    financialBreakdown,
    overdueClients,
    reportData.actives.length,
    reportData.collected,
    reportData.expectedInterest,
    reportData.inMora.length,
    reportData.moraCollected,
  ]);

  const getDatasetByReportType = (reportType: string) => {
    const normalized = reportType.toLowerCase();
    if (normalized.includes('financier')) {
      return {
        title: 'Reporte financiero',
        columns: ['Sucursal', 'Capital', 'Interes', 'Mora', 'Total'],
        rows: financialBreakdown.map(item => [
          item.branch.name,
          formatCurrency(item.capital),
          formatCurrency(item.interest),
          formatCurrency(item.mora),
          formatCurrency(item.total),
        ]),
      };
    }
    if (normalized.includes('operativ')) {
      return {
        title: 'Reporte operativo',
        columns: ['Cliente', 'Dias atraso', 'Pendiente', 'Estado'],
        rows: overdueClients.map(item => [
          `${item.client.firstName} ${item.client.lastName}`,
          String(item.lateDays),
          formatCurrency(item.loan.balance),
          item.loan.status,
        ]),
      };
    }
    if (normalized.includes('export')) {
      return {
        title: 'Reporte de exportaciones',
        columns: ['Reporte', 'Tipo', 'Rango', 'Generado por', 'Formato'],
        rows: exportHistoryRows.map(item => [item.name, item.type, item.range, item.owner, item.format]),
      };
    }
    return exportDataset;
  };

  const exportCards = [
    {
      workspace: 'PREVIEW' as const,
      title: 'Vista previa',
      detail: 'Revisa la estructura final antes de exportar.',
      icon: Printer,
      accent: 'bg-white text-[#111827]',
    },
    {
      workspace: 'PDF' as const,
      title: 'Exportar PDF',
      detail: 'Resumen ejecutivo listo para compartir o imprimir.',
      icon: FileText,
      accent: 'bg-[#2563EB] text-white',
    },
    {
      workspace: 'CSV' as const,
      title: 'Exportar CSV',
      detail: 'Descarga operativa para analisis externo y hojas de calculo.',
      icon: FileSpreadsheet,
      accent: 'bg-white text-[#111827]',
    },
    {
      workspace: 'SCHEDULE' as const,
      title: 'Programar reporte',
      detail: 'Configura envios automáticos por periodo o sucursal.',
      icon: CalendarDays,
      accent: 'bg-white text-[#111827]',
    },
    {
      workspace: 'TEMPLATE' as const,
      title: 'Plantillas',
      detail: 'Gestiona variantes de reportes y formatos exportables.',
      icon: LayoutTemplate,
      accent: 'bg-white text-[#111827]',
    },
    {
      workspace: 'DOCUMENTS' as const,
      title: 'Documentos',
      detail: 'Gestiona recibos y salidas finales generadas por el sistema.',
      icon: FileText,
      accent: 'bg-white text-[#111827]',
    },
    {
      workspace: 'SHARE' as const,
      title: 'Compartir enlace',
      detail: 'Entrega cortes consolidados a liderazgo o clientes.',
      icon: Share2,
      accent: 'bg-white text-[#111827]',
    },
  ];

  const exportActivity = reportActivityRows;

  const scheduledReports = reportSchedules;

  const previewSections = [
    'Portada con branding y periodo',
    'KPIs destacados del reporte',
    'Graficos de tendencia y composicion',
    'Tablas de respaldo y observaciones',
  ];

  const summaryActivity = useMemo(
    () => paginateItems(exportActivity, summaryActivityPage, 5),
    [summaryActivityPage, exportActivity],
  );
  const financialBreakdownPageData = useMemo(
    () => paginateItems(financialBreakdown, financialBreakdownPage, 5),
    [financialBreakdown, financialBreakdownPage],
  );
  const financialMovementsPageData = useMemo(
    () => paginateItems(recentFinancialMovements, financialMovementsPage, 5),
    [financialMovementsPage, recentFinancialMovements],
  );
  const overdueClientsPageData = useMemo(
    () => paginateItems(overdueClients, operationalRiskPage, 5),
    [operationalRiskPage, overdueClients],
  );
  const exportsActivityPageData = useMemo(
    () => paginateItems(exportHistoryRows, exportsActivityPage, 5),
    [exportHistoryRows, exportsActivityPage],
  );

  const resetFilters = () => {
    setPeriod('THIS_MONTH');
    setSelectedBranchId(canSeeAllCompanyUsers ? '' : currentUser.branchId);
    setSelectedCollectorId(isCollector ? currentUser.id : '');
    setActiveTab('SUMMARY');
    setSearchTerm('');
    setOpenFilter(null);
  };

  const rangeLabelByPeriod: Record<Period, string> = {
    TODAY: 'Hoy',
    THIS_MONTH: 'Este mes',
    LAST_MONTH: 'Mes pasado',
    TOTAL: 'Historico completo',
  };

  const activeReportLabel = reportTabs.find(tab => tab.key === activeTab)?.label || 'Resumen';
  const templateVisibleFields = templateForm.visibleFields.length ? templateForm.visibleFields : allTemplateFields;
  const isTemplateFieldVisible = (field: string) => templateVisibleFields.includes(field);
  const buildTemplateCanvasModel = ({
    visualPreset,
    documentStyle,
    visibleFields,
    templateName,
    templateDescription,
    preferSelectedDocument,
  }: {
    visualPreset: keyof typeof platformPdfVisualPresets;
    documentStyle: NonNullable<ReportTemplate['config']>['documentStyle'];
    visibleFields: string[];
    templateName: string;
    templateDescription?: string;
    preferSelectedDocument?: boolean;
  }): TemplatePreviewModel => {
    const isFieldVisible = (field: string) => visibleFields.includes(field);
    const currentPreset = getPlatformPdfVisualPreset(visualPreset);
    const companyName = company?.name || 'PrestaFacil RD';
    const companyLines = [
      activeBranch?.name || 'Sede principal',
      activeBranch?.address || 'Santo Domingo, RD',
      company?.rnc ? `RNC: ${company.rnc}` : 'Panel administrativo premium',
    ].filter(Boolean);
    const defaultNotes = [
      templateDescription || currentPreset.description,
      'Documento preparado para descarga, validacion o archivo institucional.',
    ];

    if (preferSelectedDocument && selectedDocumentPreview && selectedGeneratedDocument?.kind !== 'EXPORT') {
      const docRows = selectedDocumentPreview.rows;
      return {
        companyName,
        companyLines,
        title: selectedDocumentPreview.title,
        subtitle: templateDescription || 'Previsualizacion del documento usando la plantilla aplicada.',
        documentNumber: selectedGeneratedDocument.reference,
        issueDate: selectedGeneratedDocument.date,
        dueDate: selectedGeneratedDocument.status,
        billedToTitle: 'Cliente vinculado',
        billedToLines: [
          selectedGeneratedDocument.clientName,
          selectedGeneratedDocument.branchName || activeBranch?.name || 'Sucursal principal',
          `Canal: ${selectedGeneratedDocument.channel}`,
        ],
        issuedByTitle: 'Emitido por',
        issuedByLines: [selectedGeneratedDocument.owner, selectedGeneratedDocument.branchName || activeBranch?.name || 'Sucursal principal'],
        contextTitle: 'Detalle del evento',
        contextLines: docRows.slice(0, 4).map(([label, value]) => `${label}: ${value}`),
        metrics: [
          { label: selectedDocumentPreview.summaryLabel, value: selectedDocumentPreview.summaryValue, tone: 'blue' },
          { label: 'Estado', value: selectedGeneratedDocument.status, tone: 'violet' },
          { label: 'Formato', value: selectedGeneratedDocument.format, tone: 'amber' },
          { label: 'Plantilla', value: templateName, tone: 'green' },
        ],
        lineItems: docRows.map(([label, value], index) => ({
          code: `${index + 1}`.padStart(3, '0'),
          description: label,
          detail: selectedDocumentPreview.title,
          quantity: '1',
          unit: selectedGeneratedDocument.format,
          price: typeof value === 'string' ? value : String(value),
          tax: '-',
          total: typeof value === 'string' ? value : String(value),
        })),
        totals: [
          { label: 'Documento', value: selectedGeneratedDocument.type },
          { label: 'Estado', value: selectedGeneratedDocument.status },
          { label: selectedDocumentPreview.summaryLabel, value: selectedDocumentPreview.summaryValue, emphasis: true },
        ],
        notesTitle: 'Observaciones',
        notesLines: defaultNotes,
        footerLeft: 'Documento emitido desde el centro premium de reportes de PrestaFacil RD.',
        footerRight: `Plantilla aplicada: ${templateName}`,
      };
    }

    if (documentStyle === 'Recibo de pago' && sampleReceiptContext) {
      const { payment, loan, client, nextInstallment, totalPaid, receiptNumber } = sampleReceiptContext;
      return {
        companyName,
        companyLines,
        title: currentPreset.visualPreset === 'FISCAL_ELECTRONICA' ? 'Factura / recibo de pago' : 'Recibo de pago',
        subtitle: templateDescription || 'Documento de cobro con capital, mora y trazabilidad operativa.',
        documentNumber: receiptNumber,
        issueDate: formatDate(payment.date),
        dueDate: nextInstallment ? formatDate(nextInstallment.dueDate) : undefined,
        billedToTitle: 'Cobrar a',
        billedToLines: [
          client ? `${client.firstName} ${client.lastName}` : 'Cliente no disponible',
          client?.cedula ? `Cedula: ${client.cedula}` : '',
          client?.phone ? `Telefono: ${client.phone}` : '',
        ].filter(Boolean),
        issuedByTitle: 'Emitido por',
        issuedByLines: [currentUser.name, activeBranch?.name || 'Sede principal', selectedCollectorId ? scopedCollectors.find(item => item.id === selectedCollectorId)?.name || 'Cobro asignado' : 'Cobro asignado'],
        contextTitle: 'Detalle del cobro',
        contextLines: [
          `Prestamo: ${loan?.id || payment.loanId}`,
          `Saldo restante: ${formatCurrency(Math.max((loan?.balance || 0) - payment.amount, 0))}`,
          nextInstallment ? `Proxima cuota: ${formatDate(nextInstallment.dueDate)}` : 'Sin cuota inmediata',
        ],
        metrics: [
          { label: 'Capital aplicado', value: formatCurrency(payment.amount), tone: 'blue' },
          { label: 'Mora aplicada', value: formatCurrency(payment.moraPaid), tone: 'amber' },
          { label: 'Total pagado', value: formatCurrency(totalPaid), tone: 'green' },
          { label: 'Plantilla', value: templateName, tone: 'violet' },
        ],
        lineItems: [
          {
            code: '001',
            description: 'Cobro aplicado',
            detail: client ? `${client.firstName} ${client.lastName}` : 'Cliente del expediente',
            quantity: '1',
            unit: 'Cobro',
            price: formatCurrency(payment.amount),
            tax: formatCurrency(payment.moraPaid),
            total: formatCurrency(totalPaid),
          },
        ],
        totals: [
          { label: 'Capital', value: formatCurrency(payment.amount) },
          { label: 'Mora', value: formatCurrency(payment.moraPaid) },
          { label: 'Total pagado', value: formatCurrency(totalPaid), emphasis: true },
        ],
        notesTitle: 'Condiciones',
        notesLines: [
          'Documento listo para entrega, archivo o soporte de caja.',
          nextInstallment ? `Seguimiento sugerido para la cuota del ${formatDate(nextInstallment.dueDate)}.` : 'No hay cuota inmediata visible.',
        ],
        footerLeft: 'Recibo emitido desde el panel premium de PrestaFacil RD.',
        footerRight: `Plantilla aplicada: ${templateName}`,
      };
    }

    const reportRows = financialBreakdown.length
      ? financialBreakdown.slice(0, 4).map((item, index) => ({
          code: `${index + 1}`.padStart(3, '0'),
          description: item.branch.name,
          detail: `Capital ${formatCurrency(item.capital)} · Interes ${formatCurrency(item.interest)} · Mora ${formatCurrency(item.mora)}`,
          quantity: '1',
          unit: 'Sucursal',
          price: formatCurrency(item.capital),
          tax: formatCurrency(item.mora),
          total: formatCurrency(item.total),
        }))
      : [
          {
            code: '000',
            description: 'Sin filas visibles',
            detail: 'Ajusta el rango, sucursal o cobrador para poblar el reporte.',
            quantity: '-',
            unit: '-',
            price: '-',
            tax: '-',
            total: '-',
          },
        ];

    const metricItems = [
      isFieldVisible('Capital cobrado') ? { label: 'Capital cobrado', value: formatCurrency(apiSummary?.payments.collected ?? reportData.collected), tone: 'blue' as const } : null,
      isFieldVisible('Intereses cobrados') ? { label: 'Intereses cobrados', value: formatCurrency(apiSummary?.loans.expectedInterest ?? reportData.expectedInterest), tone: 'violet' as const } : null,
      isFieldVisible('Mora cobrada') ? { label: 'Mora cobrada', value: formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected), tone: 'amber' as const } : null,
      isFieldVisible('Total cobrado') ? { label: 'Balance neto', value: formatCurrency(apiSummary?.cash.balance ?? 0), tone: 'green' as const } : null,
    ].filter((item): item is TemplatePreviewMetric => Boolean(item));

    return {
      companyName,
      companyLines,
      title: isFieldVisible('Titulo') ? templateName : activeReportLabel,
      subtitle: templateDescription || `Preset ${currentPreset.label.toLowerCase()} listo para exportacion institucional.`,
      documentNumber: `REP-${Date.now().toString().slice(-6)}`,
      issueDate: formatDate(new Date().toISOString()),
      dueDate: rangeLabelByPeriod[period],
      billedToTitle: 'Documento para',
      billedToLines: [activeReportLabel, activeBranch?.name || 'Vista consolidada', selectedCollectorId ? scopedCollectors.find(item => item.id === selectedCollectorId)?.name || 'Todos los cobradores' : 'Todos los cobradores'],
      issuedByTitle: 'Emitido por',
      issuedByLines: [currentUser.name, activeBranch?.name || 'Sede principal', companyName],
      contextTitle: 'Contexto exportable',
      contextLines: [
        `Periodo: ${rangeLabelByPeriod[period]}`,
        `Sucursal: ${activeBranch?.name || 'Vista consolidada'}`,
        `Filas visibles: ${reportRows.length}`,
      ],
      metrics: metricItems.length ? metricItems : [{ label: 'Sin datos', value: '0', tone: 'blue' }],
      lineItems: reportRows,
      totals: [
        { label: 'Filas exportadas', value: `${reportRows.length}` },
        { label: 'Preset aplicado', value: currentPreset.label },
        { label: 'Plantilla', value: templateName, emphasis: true },
      ],
      notesTitle: 'Instrucciones de salida',
      notesLines: defaultNotes,
      footerLeft: 'Documento generado desde el centro premium de reportes de PrestaFacil RD.',
      footerRight: `Plantilla aplicada: ${templateName}`,
    };
  };

  const templateEditorCanvasModel = buildTemplateCanvasModel({
    visualPreset: templateForm.visualPreset,
    documentStyle: templateForm.documentStyle,
    visibleFields: templateVisibleFields,
    templateName: templateForm.name || getPlatformPdfVisualPreset(templateForm.visualPreset).label,
    templateDescription: templateForm.description,
  });

  const isTemplateWorkspaceActive =
    reportsSubview === 'TEMPLATE' ||
    reportsSubview === 'PREVIEW' ||
    exportWorkspace === 'TEMPLATE' ||
    exportWorkspace === 'PREVIEW';

  const activePdfTemplateConfig = useMemo(
    () =>
      isTemplateWorkspaceActive
        ? {
            ...defaultTemplateConfig,
            ...resolvePlatformPdfTemplateConfig({
              visualPreset: templateForm.visualPreset,
              paperSize: templateForm.paperSize,
              orientation: templateForm.orientation,
              marginPreset: templateForm.marginPreset,
              documentStyle: templateForm.documentStyle,
            }),
            ...templateForm,
            visibleFields: templateForm.visibleFields?.length ? templateForm.visibleFields : allTemplateFields,
            receiptOptions: {
              ...defaultTemplateConfig.receiptOptions,
              ...(templateForm.receiptOptions || {}),
            },
          }
        : effectiveTemplateConfig,
    [effectiveTemplateConfig, isTemplateWorkspaceActive, templateForm],
  );

  const activePdfTemplateName = useMemo(() => {
    if (isTemplateWorkspaceActive) {
      return templateForm.name || getPlatformPdfVisualPreset(templateForm.visualPreset).label;
    }
    return effectiveTemplate?.name || getPlatformPdfVisualPreset(effectiveTemplateConfig.visualPreset).label;
  }, [effectiveTemplate, effectiveTemplateConfig.visualPreset, isTemplateWorkspaceActive, templateForm.name, templateForm.visualPreset]);

  const activePdfTemplateSections = useMemo(
    () =>
      isTemplateWorkspaceActive
        ? templateForm.sections.length
          ? templateForm.sections
          : previewSections
        : effectiveTemplate?.sections?.length
          ? effectiveTemplate.sections
          : previewSections,
    [effectiveTemplate?.sections, isTemplateWorkspaceActive, templateForm.sections],
  );
  const previewCanvasVisibleFields =
    activePdfTemplateConfig.visibleFields?.length ? activePdfTemplateConfig.visibleFields : allTemplateFields;

  const previewCanvasModel = buildTemplateCanvasModel({
    visualPreset: activePdfTemplateConfig.visualPreset,
    documentStyle: activePdfTemplateConfig.documentStyle,
    visibleFields: previewCanvasVisibleFields,
    templateName: activePdfTemplateName,
    templateDescription: activePdfTemplateConfig.description,
    preferSelectedDocument: true,
  });
  const documentTypeOptions = [
    { value: 'ALL', label: 'Todos los documentos' },
    { value: 'PAYMENT_RECEIPT', label: 'Recibo de pago' },
    { value: 'PARTIAL_PAYMENT', label: 'Pago parcial' },
    { value: 'PAYMENT_PROMISE', label: 'Promesa de pago' },
    { value: 'MORA_NOTICE', label: 'Mora' },
    { value: 'ACCOUNT_STATEMENT', label: 'Estado de cuenta' },
    { value: 'CASH_CLOSURE', label: 'Cierre de caja' },
    { value: 'EXPORT', label: 'Exportados' },
  ];
  const documentStatusOptions = [
    { value: 'ALL', label: 'Todos los estados' },
    { value: 'Generado', label: 'Generado' },
    { value: 'Pendiente', label: 'Pendiente' },
    { value: 'Cumplida', label: 'Cumplida' },
    { value: 'Incumplida', label: 'Incumplida' },
    { value: 'Cuadrado', label: 'Cuadrado' },
    { value: 'Con diferencia', label: 'Con diferencia' },
  ];
  const documentBranchOptions = [
    { value: '', label: 'Todas las sucursales' },
    ...branches.map(branch => ({ value: branch.id, label: branch.name })),
  ];
  const documentPeriodOptions: Array<{ value: Period; label: string }> = [
    { value: 'TODAY', label: 'Hoy' },
    { value: 'THIS_MONTH', label: 'Este mes' },
    { value: 'LAST_MONTH', label: 'Mes pasado' },
    { value: 'TOTAL', label: 'Historico completo' },
  ];

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const persistExportLog = async (format: 'PDF' | 'CSV', fileSizeLabel: string) => {
    const params = getPeriodRange(period);
    const response = await apiClient.createReportExport({
      reportName: `${activeReportLabel} premium`,
      reportType: activeReportLabel,
      format,
      rangeLabel: rangeLabelByPeriod[period],
      startDate: params.startDate,
      endDate: params.endDate,
      branchId: selectedBranchId || undefined,
      branchName: activeBranch?.name,
      collectorId: selectedCollectorId || undefined,
      collectorName: scopedCollectors.find(collector => collector.id === selectedCollectorId)?.name,
      fileSizeLabel,
      filters: {
        period,
        branchId: selectedBranchId || null,
        collectorId: selectedCollectorId || null,
        searchTerm: searchTerm || null,
        activeTab,
      },
    });

    setReportExports(current => [response.data, ...current].slice(0, 50));
  };

  const downloadCsvReport = async (dataset: { title: string; columns: string[]; rows: string[][] }, reportTypeLabel = activeReportLabel) => {
    const rows = [dataset.columns, ...dataset.rows];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `reporte-${dataset.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    await persistExportLog('CSV', formatBytes(blob.size));
    setExportFeedback(`CSV de ${reportTypeLabel.toLowerCase()} generado y registrado en el historial.`);
  };

  const downloadPdfReportUnifiedLegacy = async (
    dataset: { title: string; columns: string[]; rows: string[][] },
    reportTypeLabel = activeReportLabel,
    rangeLabel = rangeLabelByPeriod[period],
    branchLabel = activeBranch?.name || 'Todas',
    collectorLabel = scopedCollectors.find(collector => collector.id === selectedCollectorId)?.name || 'Todos',
  ) => {
    const doc = createPlatformPdfDoc({
      paperSize: effectiveTemplateConfig.paperSize,
      orientation: effectiveTemplateConfig.orientation,
    });
    const visualPreset = getPlatformPdfVisualPreset(effectiveTemplateConfig.visualPreset);
    const [accentR, accentG, accentB] = visualPreset.accent;
    const [accentSoftR, accentSoftG, accentSoftB] = visualPreset.accentSoft;
    const [neutralR, neutralG, neutralB] = visualPreset.neutral;
    const isFinancialPreset = visualPreset.visualPreset === 'FACTURA_FINANCIERA';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = platformPdfMarginByPreset[effectiveTemplateConfig.marginPreset || 'Normal'];
    const right = pageWidth - left;
    const contentWidth = right - left;
    const templateSections = effectiveTemplate?.sections?.length ? effectiveTemplate.sections : previewSections;
    const showCover = templateSections.includes('Portada con branding y periodo');
    const showKpis = templateSections.includes('KPIs destacados del reporte');
    const showCharts = templateSections.includes('Graficos de tendencia y composicion');
    const showTables = templateSections.includes('Tablas de respaldo y observaciones');
    const activeDocument = exportWorkspace === 'DOCUMENTS' || reportsSubview === 'DOCUMENTS' ? selectedGeneratedDocument : null;
    const textPrimary: [number, number, number] = [15, 23, 42];
    const textMuted: [number, number, number] = [100, 116, 139];
    const borderSoft: [number, number, number] = [226, 232, 240];
    let y = 48;

    const setText = (size: number, weight: 'normal' | 'bold', color: [number, number, number]) => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
    };

    const ensureSpace = (height: number) => {
      if (y + height <= pageHeight - 60) return;
      doc.addPage();
      y = 48;
    };

    const renderHeader = (title: string, subtitle: string, metaLeft: string, metaRight: string) => {
      drawPlatformPdfCard({
        doc,
        x: left,
        y,
        width: contentWidth,
        height: 102,
        fill: isFinancialPreset ? [neutralR, neutralG, neutralB] : [248, 250, 252],
        border: isFinancialPreset ? [neutralR, neutralG, neutralB] : [accentSoftR, accentSoftG, accentSoftB],
        radius: 20,
      });
      setText(12, 'bold', isFinancialPreset ? [255, 255, 255] : [accentR, accentG, accentB]);
      doc.text(company?.name || 'PrestaFacil RD', left + 22, y + 24);
      setText(10, 'normal', isFinancialPreset ? [226, 232, 240] : textMuted);
      doc.text(metaLeft, left + 22, y + 42);
      doc.text(metaRight, left + 22, y + 58);
      setText(21, 'bold', isFinancialPreset ? [255, 255, 255] : textPrimary);
      doc.text(title, left + 22, y + 80);
      setText(10, 'normal', isFinancialPreset ? [226, 232, 240] : textMuted);
      doc.text(subtitle, left + 22, y + 94);
      y += 124;
    };

    const renderInfoCard = (x: number, cardY: number, width: number, label: string, value: string, height = 68) => {
      drawPlatformPdfCard({
        doc,
        x,
        y: cardY,
        width,
        height,
        fill: [255, 255, 255],
        border: borderSoft,
        radius: 16,
      });
      setText(9, 'bold', textMuted);
      doc.text(label.toUpperCase(), x + 14, cardY + 18);
      setText(12, 'bold', textPrimary);
      doc.text(doc.splitTextToSize(value || '-', width - 28), x + 14, cardY + 38, { maxWidth: width - 28 });
    };

    const renderMetricCard = (
      x: number,
      cardY: number,
      width: number,
      label: string,
      value: string,
      fill: [number, number, number],
      border: [number, number, number],
      accent: [number, number, number],
    ) => {
      drawPlatformPdfCard({
        doc,
        x,
        y: cardY,
        width,
        height: 64,
        fill,
        border,
        radius: 16,
      });
      setText(9, 'bold', accent);
      doc.text(label.toUpperCase(), x + 14, cardY + 18);
      setText(17, 'bold', accent);
      doc.text(value, x + 14, cardY + 42);
    };

    const renderSectionHeader = (title: string, description?: string) => {
      setText(15, 'bold', textPrimary);
      doc.text(title, left, y);
      if (description) {
        setText(10, 'normal', textMuted);
        doc.text(description, left, y + 16);
        y += 28;
      } else {
        y += 16;
      }
      drawPlatformPdfDivider({ doc, x1: left, x2: right, y: y + 4 });
      y += 18;
    };

    const renderMetaGrid = (rows: string[][], columns = 2) => {
      const gap = 16;
      const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
      for (let index = 0; index < rows.length; index += columns) {
        ensureSpace(84);
        const slice = rows.slice(index, index + columns);
        slice.forEach(([label, value], columnIndex) => {
          renderInfoCard(left + columnIndex * (cardWidth + gap), y, cardWidth, label, String(value ?? '-'));
        });
        y += 82;
      }
    };

    const renderTable = (columns: string[], rows: string[][], title?: string, description?: string) => {
      if (title) renderSectionHeader(title, description);
      ensureSpace(42);
      drawPlatformPdfCard({
        doc,
        x: left,
        y,
        width: contentWidth,
        height: 28,
        fill: [248, 250, 252],
        border: borderSoft,
        radius: 12,
      });
      const colWidth = contentWidth / Math.max(columns.length, 1);
      setText(9, 'bold', textMuted);
      columns.forEach((column, index) => {
        doc.text(column.toUpperCase(), left + 12 + index * colWidth, y + 18, { maxWidth: colWidth - 20 });
      });
      y += 40;
      rows.forEach((row, rowIndex) => {
        const prepared = row.map((cell, index) => doc.splitTextToSize(String(cell ?? '-'), colWidth - 20));
        const rowHeight = Math.max(...prepared.map(lines => lines.length)) * 14 + 12;
        ensureSpace(rowHeight + 6);
        if (rowIndex % 2 === 0) {
          drawPlatformPdfCard({
            doc,
            x: left,
            y: y - 5,
            width: contentWidth,
            height: rowHeight,
            fill: [252, 253, 255],
            border: [252, 253, 255],
            radius: 10,
          });
        }
        prepared.forEach((lines, index) => {
          setText(10, 'normal', textPrimary);
          doc.text(lines, left + 12 + index * colWidth, y + 8, { maxWidth: colWidth - 20 });
        });
        y += rowHeight;
        drawPlatformPdfDivider({ doc, x1: left, x2: right, y: y - 4, color: [241, 245, 249] });
        y += 6;
      });
    };

    const savePdf = async (fileName: string, message: string) => {
      const blob = doc.output('blob');
      doc.save(fileName);
      await persistExportLog('PDF', formatBytes(blob.size));
      setExportFeedback(message);
    };

    if (activeDocument && selectedDocumentPreview) {
      renderHeader(
        selectedDocumentPreview.title,
        `Documento institucional generado con la plantilla ${visualPreset.label.toLowerCase()}.`,
        `Sucursal: ${activeDocument.branchName || branchLabel}`,
        `Generado por: ${activeDocument.owner}`,
      );
      renderMetaGrid(selectedDocumentPreview.rows, 2);
      ensureSpace(86);
      renderMetricCard(
        left,
        y,
        contentWidth,
        selectedDocumentPreview.summaryLabel,
        selectedDocumentPreview.summaryValue,
        isFinancialPreset ? [15, 23, 42] : [248, 250, 252],
        isFinancialPreset ? [15, 23, 42] : borderSoft,
        isFinancialPreset ? [255, 255, 255] : [accentR, accentG, accentB],
      );
      y += 88;
      if (activeDocument.kind === 'PAYMENT_PROMISE' && activeDocument.promise?.note) {
        ensureSpace(76);
        renderInfoCard(left, y, contentWidth, 'Observacion operativa', activeDocument.promise.note, 62);
        y += 76;
      }
      drawPlatformPdfFooter({
        doc,
        left,
        right,
        y: Math.min(pageHeight - 42, y + 6),
        note: 'Documento institucional generado desde el centro de reportes premium de PrestaFacil RD.',
        presetLabel: visualPreset.label,
      });
      await savePdf(
        `${activeDocument.type.toLowerCase().replace(/\s+/g, '-')}-${activeDocument.reference.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        `PDF de ${activeDocument.type.toLowerCase()} generado y registrado en el historial.`,
      );
      return;
    }

    if (effectiveTemplateConfig.documentStyle === 'Recibo de pago' && sampleReceiptContext) {
      const { payment, loan, client, nextInstallment, totalPaid, receiptNumber } = sampleReceiptContext;
      renderHeader(
        visualPreset.visualPreset === 'FISCAL_ELECTRONICA' ? 'Factura / recibo' : 'Recibo de pago',
        `Recibo ${receiptNumber} con detalle de capital, mora y saldo vinculado.`,
        `Sucursal: ${branchLabel}`,
        `Cobrado por: ${collectorLabel}`,
      );
      const receiptRows = [
        ['Cliente', client ? `${client.firstName} ${client.lastName}` : 'Cliente no disponible'],
        ['Prestamo', loan?.id || payment.loanId],
        ['Fecha de pago', formatDate(payment.date)],
        ['Capital aplicado', formatCurrency(payment.amount)],
        ['Mora aplicada', formatCurrency(payment.moraPaid)],
        ['Total pagado', formatCurrency(totalPaid)],
      ];
      if (effectiveTemplateConfig.receiptOptions?.showRemainingBalance) {
        receiptRows.push(['Saldo restante', formatCurrency(Math.max((loan?.balance || 0) - payment.amount, 0))]);
      }
      if (effectiveTemplateConfig.receiptOptions?.showNextInstallment && nextInstallment) {
        receiptRows.push(['Proxima cuota', `${formatDate(nextInstallment.dueDate)} - ${formatCurrency(nextInstallment.expectedAmount)}`]);
      }
      renderMetaGrid(receiptRows, 2);
      if (effectiveTemplateConfig.receiptOptions?.includeSignature) {
        ensureSpace(56);
        drawPlatformPdfDivider({ doc, x1: left + 120, x2: right - 120, y: y + 14, color: [148, 163, 184] });
        setText(10, 'normal', textMuted);
        doc.text('Firma y sello autorizado', pageWidth / 2, y + 30, { align: 'center' });
        y += 48;
      }
      drawPlatformPdfFooter({
        doc,
        left,
        right,
        y: Math.min(pageHeight - 42, y + 4),
        note: 'Recibo generado desde PrestaFacil RD con formato profesional y trazabilidad operativa.',
        presetLabel: visualPreset.label,
      });
      await savePdf(`recibo-${receiptNumber.toLowerCase()}.pdf`, 'PDF de recibo generado y registrado en el historial.');
      return;
    }

    if (showCover) {
      renderHeader(
        dataset.title,
        `${reportTypeLabel} consolidado para exportacion institucional.`,
        `Periodo: ${rangeLabel}`,
        `Sucursal: ${branchLabel} · Cobrador: ${collectorLabel}`,
      );
    }

    if (showKpis) {
      ensureSpace(88);
      const gap = 16;
      const cardWidth = (contentWidth - gap * 2) / 3;
      const cards = [
        { label: 'Filas exportadas', value: String(dataset.rows.length), fill: [239, 246, 255] as [number, number, number], border: [191, 219, 254] as [number, number, number], accent: [37, 99, 235] as [number, number, number] },
        { label: 'Columnas visibles', value: String(dataset.columns.length), fill: [245, 243, 255] as [number, number, number], border: [221, 214, 254] as [number, number, number], accent: [109, 40, 217] as [number, number, number] },
        { label: 'Plantilla aplicada', value: effectiveTemplate?.name || 'Base', fill: [240, 253, 244] as [number, number, number], border: [187, 247, 208] as [number, number, number], accent: [22, 163, 74] as [number, number, number] },
      ];
      cards.forEach((card, index) => {
        renderMetricCard(left + index * (cardWidth + gap), y, cardWidth, card.label, card.value, card.fill, card.border, card.accent);
      });
      y += 84;
    }

    if (showCharts) {
      renderTable(
        ['Indicador', 'Valor'],
        [
          ['Capital cobrado', formatCurrency(apiSummary?.payments.collected ?? reportData.collected)],
          ['Interes proyectado', formatCurrency(apiSummary?.loans.expectedInterest ?? reportData.expectedInterest)],
          ['Mora cobrada', formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected)],
          ['Clientes en riesgo', String(apiSummary?.overdue.overdueLoans ?? reportData.inMora.length)],
        ],
        'Lectura ejecutiva',
        'Resumen corto del comportamiento financiero y operativo visible.',
      );
      y += 10;
    }

    if (showTables) {
      renderTable(dataset.columns, dataset.rows, 'Detalle exportable', 'Tabla consolidada para auditoria, revision o descarga institucional.');
    }

    drawPlatformPdfFooter({
      doc,
      left,
      right,
      y: Math.min(pageHeight - 42, y + 4),
      note: 'Documento generado desde el centro premium de reportes de PrestaFacil RD.',
      presetLabel: visualPreset.label,
    });

    await savePdf(
      `reporte-${dataset.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`,
      `PDF de ${reportTypeLabel.toLowerCase()} generado y registrado en el historial.`,
    );
  };

  const downloadPdfReportUnified = async (
    dataset: { title: string; columns: string[]; rows: string[][] },
    reportTypeLabel = activeReportLabel,
    rangeLabel = rangeLabelByPeriod[period],
    branchLabel = activeBranch?.name || 'Todas',
    collectorLabel = scopedCollectors.find(collector => collector.id === selectedCollectorId)?.name || 'Todos',
  ) => {
    const doc = createPlatformPdfDoc({
      paperSize: activePdfTemplateConfig.paperSize,
      orientation: activePdfTemplateConfig.orientation,
    });
    const visualPreset = getPlatformPdfVisualPreset(activePdfTemplateConfig.visualPreset);
    const left = platformPdfMarginByPreset[activePdfTemplateConfig.marginPreset || 'Normal'];
    const right = doc.internal.pageSize.getWidth() - left;
    const templateName = activePdfTemplateName;
    const activeDocument = exportWorkspace === 'DOCUMENTS' || reportsSubview === 'DOCUMENTS' ? selectedGeneratedDocument : null;
    const templateSections = activePdfTemplateSections;
    const showTables = templateSections.includes('Tablas de respaldo y observaciones');

    const savePdf = async (fileName: string, message: string) => {
      const blob = doc.output('blob');
      doc.save(fileName);
      await persistExportLog('PDF', formatBytes(blob.size));
      setExportFeedback(message);
    };

    const renderAndSave = async ({
      fileBaseName,
      successMessage,
      model,
    }: {
      fileBaseName: string;
      successMessage: string;
      model: Parameters<typeof renderPlatformPdfDocument>[0]['model'];
    }) => {
      renderPlatformPdfDocument({
        doc,
        preset: visualPreset,
        left,
        top: 28,
        right,
        model: {
          ...model,
          lineItems: model.lineItems.length || model.tableRows?.length
            ? model.lineItems
            : [
                {
                  description: 'Sin registros visibles para exportar',
                  detail: 'Ajusta filtros o periodo para generar contenido.',
                  quantity: '-',
                  unit: '-',
                  price: '-',
                  tax: '-',
                  amount: '-',
                },
              ],
        },
      });

      await savePdf(buildPlatformPdfFileName(fileBaseName), successMessage);
    };

    const buildDocumentModel = () => {
      if (!activeDocument || !selectedDocumentPreview) return null;

      const companyLines = [
        activeDocument.branchName || branchLabel,
        activeBranch?.address || 'Direccion institucional pendiente',
        company?.rnc ? `RNC: ${company.rnc}` : '',
      ].filter(Boolean);

      if (activeDocument.kind === 'PAYMENT_RECEIPT' || activeDocument.kind === 'PARTIAL_PAYMENT') {
        const capital = activeDocument.payment?.amount || 0;
        const mora = activeDocument.payment?.moraPaid || 0;
        return {
          title: activeDocument.kind === 'PARTIAL_PAYMENT' ? 'Recibo de pago parcial' : 'Recibo de pago',
          subtitle: 'Comprobante emitido con desglose de capital, mora y total aplicado.',
          documentNumber: activeDocument.reference,
          issueDate: activeDocument.date,
          companyName: company?.name || 'PrestaFacil RD',
          companyLogo: activeBranch?.logo || company?.logo,
          companyLines,
          seller: { title: 'Emitido por', lines: [activeDocument.owner, activeDocument.branchName || branchLabel, collectorLabel] },
          buyer: { title: 'Cliente', lines: [activeDocument.clientName, `Estado: ${activeDocument.status}`] },
          shipTo: {
            title: 'Detalle del cobro',
            lines: [
              `Prestamo: ${activeDocument.payment?.loanId || activeDocument.reference}`,
              `Capital aplicado: ${formatCurrency(capital)}`,
              `Mora aplicada: ${formatCurrency(mora)}`,
            ],
          },
          summaryTitle: 'Total pagado',
          summaryValue: formatCurrency(capital + mora),
          summaryMeta: [`Sucursal ${activeDocument.branchName || branchLabel}`, `Plantilla ${templateName}`],
          lineItems: [
            {
              description: 'Cobro aplicado',
              detail: `Pago registrado para ${activeDocument.clientName}`,
              quantity: '1',
              unit: 'Cobro',
              price: formatCurrency(capital),
              tax: formatCurrency(mora),
              amount: formatCurrency(capital + mora),
            },
          ],
          totals: [
            { label: 'Capital', value: formatCurrency(capital) },
            { label: 'Mora', value: formatCurrency(mora) },
            { label: 'Total pagado', value: formatCurrency(capital + mora), emphasis: true },
          ],
          notesTitle: 'Observaciones',
          notesLines: ['Documento institucional listo para entrega o archivo.'],
          footerNote: 'Recibo emitido desde el centro de reportes de PrestaFacil RD.',
          presetLabel: templateName,
        };
      }

      if (activeDocument.kind === 'PAYMENT_PROMISE') {
        return {
          title: 'Promesa de pago',
          subtitle: 'Compromiso operativo con fecha, monto y nota de seguimiento.',
          documentNumber: activeDocument.reference,
          issueDate: activeDocument.date,
          companyName: company?.name || 'PrestaFacil RD',
          companyLogo: activeBranch?.logo || company?.logo,
          companyLines,
          seller: { title: 'Gestionado por', lines: [activeDocument.owner, activeDocument.branchName || branchLabel] },
          buyer: { title: 'Cliente', lines: [activeDocument.clientName, `Estado: ${activeDocument.status}`] },
          shipTo: {
            title: 'Compromiso',
            lines: [
              `Monto: ${formatCurrency(activeDocument.amount || 0)}`,
              `Fecha: ${activeDocument.date}`,
              activeDocument.promise?.note || 'Sin comentario operativo',
            ],
          },
          summaryTitle: 'Monto comprometido',
          summaryValue: formatCurrency(activeDocument.amount || 0),
          summaryMeta: [`Plantilla ${templateName}`],
          lineItems: [
            {
              description: 'Promesa registrada',
              detail: activeDocument.promise?.note || 'Pendiente de seguimiento',
              quantity: '1',
              unit: 'Promesa',
              price: formatCurrency(activeDocument.amount || 0),
              tax: '-',
              amount: formatCurrency(activeDocument.amount || 0),
            },
          ],
          totals: [{ label: 'Compromiso total', value: formatCurrency(activeDocument.amount || 0), emphasis: true }],
          notesTitle: 'Nota operativa',
          notesLines: [activeDocument.promise?.note || 'Sin nota adicional.'],
          footerNote: 'Promesa emitida para seguimiento del expediente.',
          presetLabel: templateName,
        };
      }

      if (activeDocument.kind === 'ACCOUNT_STATEMENT') {
        const installments = (activeDocument.loan?.installments || []).slice(0, 12);
        return {
          title: 'Estado de cuenta',
          subtitle: 'Resumen financiero de cuotas, saldo y estado del expediente.',
          documentNumber: activeDocument.reference,
          issueDate: activeDocument.date,
          dueDate: installments.find(installment => installment.status !== 'PAGADO')?.dueDate,
          companyName: company?.name || 'PrestaFacil RD',
          companyLogo: activeBranch?.logo || company?.logo,
          companyLines,
          seller: { title: 'Emitido por', lines: [activeDocument.owner, activeDocument.branchName || branchLabel] },
          buyer: { title: 'Cliente', lines: [activeDocument.clientName, `Prestamo: ${activeDocument.reference}`] },
          shipTo: {
            title: 'Contexto financiero',
            lines: [
              `Cuotas: ${activeDocument.loan?.installments.length || 0}`,
              `Estado: ${activeDocument.loan?.status || activeDocument.status}`,
              `Balance: ${formatCurrency(activeDocument.amount || 0)}`,
            ],
          },
          summaryTitle: 'Balance pendiente',
          summaryValue: formatCurrency(activeDocument.amount || 0),
          summaryMeta: [`Plantilla ${templateName}`],
          lineItems: installments.map((installment, index) => ({
            description: `Cuota ${index + 1}`,
            detail: `Vence ${formatDate(installment.dueDate)} - ${installment.status}`,
            quantity: '1',
            unit: 'Cuota',
            price: formatCurrency(installment.expectedAmount),
            tax: '-',
            amount: formatCurrency(installment.paidAmount || 0),
          })),
          totals: [
            { label: 'Cuotas visibles', value: `${installments.length}` },
            { label: 'Balance pendiente', value: formatCurrency(activeDocument.amount || 0), emphasis: true },
          ],
          notesTitle: 'Observaciones',
          notesLines: ['Documento preparado para revision, descarga o archivo del expediente.'],
          footerNote: 'Estado de cuenta consolidado desde el centro de reportes.',
          presetLabel: templateName,
        };
      }

      if (activeDocument.kind === 'CASH_CLOSURE') {
        return {
          title: 'Cierre de caja',
          subtitle: 'Corte operativo con trazabilidad de balance, contado y diferencia.',
          documentNumber: activeDocument.reference,
          issueDate: activeDocument.date,
          companyName: company?.name || 'PrestaFacil RD',
          companyLogo: activeBranch?.logo || company?.logo,
          companyLines,
          seller: { title: 'Responsable', lines: [activeDocument.owner, activeDocument.branchName || branchLabel] },
          buyer: { title: 'Sucursal', lines: [activeDocument.clientName, activeDocument.date] },
          shipTo: {
            title: 'Conciliacion',
            lines: [
              `Teorico: ${formatCurrency(activeDocument.closure?.theoreticalAmount || 0)}`,
              `Contado: ${formatCurrency(activeDocument.closure?.countedAmount || 0)}`,
              `Diferencia: ${formatCurrency(activeDocument.closure?.differenceAmount || 0)}`,
            ],
          },
          summaryTitle: 'Balance final',
          summaryValue: formatCurrency(activeDocument.amount || 0),
          summaryMeta: [`Plantilla ${templateName}`],
          lineItems: [
            {
              description: 'Cierre operacional',
              detail: activeDocument.closure?.note || 'Sin observaciones de cierre',
              quantity: '1',
              unit: 'Corte',
              price: formatCurrency(activeDocument.closure?.theoreticalAmount || 0),
              tax: formatCurrency(activeDocument.closure?.differenceAmount || 0),
              amount: formatCurrency(activeDocument.amount || 0),
            },
          ],
          totals: [
            { label: 'Teorico', value: formatCurrency(activeDocument.closure?.theoreticalAmount || 0) },
            { label: 'Contado', value: formatCurrency(activeDocument.closure?.countedAmount || 0) },
            { label: 'Balance final', value: formatCurrency(activeDocument.amount || 0), emphasis: true },
          ],
          notesTitle: 'Notas de cierre',
          notesLines: [activeDocument.closure?.note || 'Sin hallazgos reportados.'],
          footerNote: 'Cierre operativo emitido desde el modulo de reportes.',
          presetLabel: templateName,
        };
      }

      return {
        title: selectedDocumentPreview.title,
        subtitle: 'Documento institucional consolidado desde reportes con estructura profesional.',
        documentNumber: activeDocument.reference,
        issueDate: activeDocument.date,
        companyName: company?.name || 'PrestaFacil RD',
        companyLogo: activeBranch?.logo || company?.logo,
        companyLines,
        seller: { title: 'Generado por', lines: [activeDocument.owner, activeDocument.branchName || branchLabel] },
        buyer: { title: 'Vinculo principal', lines: [activeDocument.clientName, activeDocument.channel] },
        shipTo: { title: 'Resumen', lines: selectedDocumentPreview.rows.slice(0, 4).map(([label, value]) => `${label}: ${value}`) },
        summaryTitle: selectedDocumentPreview.summaryLabel,
        summaryValue: selectedDocumentPreview.summaryValue,
        summaryMeta: [`Estado ${activeDocument.status}`, `Plantilla ${templateName}`],
        lineItems: selectedDocumentPreview.rows.map(([label, value]) => ({
          description: label,
          detail: selectedDocumentPreview.title,
          quantity: '1',
          unit: activeDocument.format,
          price: value,
          tax: '-',
          amount: value,
        })),
        totals: [{ label: selectedDocumentPreview.summaryLabel, value: selectedDocumentPreview.summaryValue, emphasis: true }],
        notesTitle: 'Observaciones',
        notesLines: ['Documento preparado para descarga o archivo institucional.'],
        footerNote: 'Documento institucional generado desde el centro de reportes de PrestaFacil RD.',
        presetLabel: templateName,
      };
    };

    const buildReceiptModel = () => {
      if (activePdfTemplateConfig.documentStyle !== 'Recibo de pago' || !sampleReceiptContext) return null;
      const { payment, loan, client, nextInstallment, totalPaid, receiptNumber } = sampleReceiptContext;
      return {
        title: visualPreset.visualPreset === 'FISCAL_ELECTRONICA' ? 'Factura / recibo de pago' : 'Recibo de pago',
        subtitle: 'Documento de cobro emitido con capital aplicado, mora y saldo posterior.',
        documentNumber: receiptNumber,
        issueDate: formatDate(payment.date),
        dueDate: nextInstallment ? formatDate(nextInstallment.dueDate) : undefined,
        companyName: company?.name || 'PrestaFacil RD',
        companyLogo: activeBranch?.logo || company?.logo,
        companyLines: [branchLabel, activeBranch?.address || 'Direccion institucional pendiente', company?.rnc ? `RNC: ${company.rnc}` : ''].filter(Boolean),
        seller: { title: 'Emitido por', lines: [collectorLabel, branchLabel, currentUser.name] },
        buyer: {
          title: 'Cliente',
          lines: [client ? `${client.firstName} ${client.lastName}` : 'Cliente no disponible', client?.cedula ? `Cedula: ${client.cedula}` : '', client?.phone ? `Telefono: ${client.phone}` : ''].filter(Boolean),
        },
        shipTo: {
          title: 'Prestamo vinculado',
          lines: [
            loan?.id || payment.loanId,
            `Saldo restante: ${formatCurrency(Math.max((loan?.balance || 0) - payment.amount, 0))}`,
            nextInstallment ? `Proxima cuota: ${formatDate(nextInstallment.dueDate)} - ${formatCurrency(nextInstallment.expectedAmount)}` : 'Sin cuota inmediata',
          ],
        },
        summaryTitle: 'Total pagado',
        summaryValue: formatCurrency(totalPaid),
        summaryMeta: [`Plantilla ${templateName}`],
        lineItems: [
          {
            description: 'Capital aplicado',
            detail: `Cobro registrado para ${client ? `${client.firstName} ${client.lastName}` : 'cliente'}`,
            quantity: '1',
            unit: 'Cobro',
            price: formatCurrency(payment.amount),
            tax: formatCurrency(payment.moraPaid),
            amount: formatCurrency(totalPaid),
          },
        ],
        totals: [
          { label: 'Capital aplicado', value: formatCurrency(payment.amount) },
          { label: 'Mora aplicada', value: formatCurrency(payment.moraPaid) },
          { label: 'Total pagado', value: formatCurrency(totalPaid), emphasis: true },
        ],
        notesTitle: 'Condiciones',
        notesLines: [
          activePdfTemplateConfig.receiptOptions?.showRemainingBalance ? `Saldo restante luego del cobro: ${formatCurrency(Math.max((loan?.balance || 0) - payment.amount, 0))}.` : 'Cobro consolidado sin saldo mostrado.',
          activePdfTemplateConfig.receiptOptions?.includeSignature ? 'Documento listo para firma o validacion operativa.' : 'Documento listo para archivo institucional.',
        ],
        footerNote: 'Recibo emitido desde PrestaFacil RD con trazabilidad operativa.',
        presetLabel: templateName,
      };
    };

    const buildReportModel = () => {
      const maxRows = showTables ? dataset.rows.length : Math.min(dataset.rows.length, 24);
      const safeValue = (value?: string) => {
        const normalized = String(value || '').trim();
        return normalized.length ? normalized : '-';
      };
      const tableHeaders = dataset.columns.map(column => safeValue(column));
      const tableRows = dataset.rows.slice(0, maxRows).map(row => tableHeaders.map((_, index) => safeValue(row[index])));
      const getReportColumnWidths = (columnCount: number) => {
        const preset = activePdfTemplateConfig.visualPreset;
        if (columnCount <= 1) return [1];
        if (columnCount === 2) return [0.56, 0.44];
        if (columnCount === 3) {
          if (preset === 'CORPORATIVA_CLASICA') return [0.4, 0.2, 0.4];
          if (preset === 'FISCAL_ELECTRONICA') return [0.36, 0.24, 0.4];
          return [0.38, 0.22, 0.4];
        }
        if (columnCount === 4) {
          if (preset === 'CORPORATIVA_CLASICA') return [0.3, 0.18, 0.28, 0.24];
          if (preset === 'FISCAL_ELECTRONICA') return [0.28, 0.18, 0.28, 0.26];
          return [0.3, 0.18, 0.26, 0.26];
        }
        if (columnCount === 5) {
          if (preset === 'CORPORATIVA_CLASICA') return [0.3, 0.14, 0.16, 0.26, 0.14];
          if (preset === 'FISCAL_ELECTRONICA') return [0.3, 0.14, 0.16, 0.26, 0.14];
          return [0.3, 0.14, 0.16, 0.26, 0.14];
        }
        if (columnCount === 6) {
          if (preset === 'CORPORATIVA_CLASICA') return [0.24, 0.2, 0.1, 0.15, 0.13, 0.18];
          if (preset === 'FISCAL_ELECTRONICA') return [0.22, 0.24, 0.1, 0.14, 0.12, 0.18];
          return [0.24, 0.2, 0.1, 0.14, 0.12, 0.2];
        }
        const primary = preset === 'FISCAL_ELECTRONICA' ? 0.26 : 0.24;
        const secondary = preset === 'CORPORATIVA_CLASICA' ? 0.16 : 0.14;
        const remaining = 1 - primary - secondary;
        const each = remaining / Math.max(columnCount - 2, 1);
        return [primary, secondary, ...Array.from({ length: columnCount - 2 }, () => each)];
      };
      return {
        documentKind: 'report' as const,
        title: dataset.title,
        subtitle: `${reportTypeLabel} consolidado para revision institucional con preset exportable.`,
        documentNumber: `REP-${Date.now().toString().slice(-6)}`,
        issueDate: formatDate(new Date().toISOString()),
        dueDate: rangeLabel,
        companyName: company?.name || 'PrestaFacil RD',
        companyLogo: activeBranch?.logo || company?.logo,
        companyLines: [branchLabel, activeBranch?.address || 'Direccion institucional pendiente', company?.rnc ? `RNC: ${company.rnc}` : ''].filter(Boolean),
        seller: {
          title: 'Generado por',
          lines: [currentUser.name, branchLabel, collectorLabel === 'Todos' ? 'Cobertura general' : collectorLabel],
        },
        buyer: {
          title: 'Alcance del reporte',
          lines: [`Periodo: ${rangeLabel}`, `Sucursal: ${branchLabel}`, `Cobertura: ${collectorLabel}`],
        },
        shipTo: {
          title: 'Lectura ejecutiva',
          lines: [
            `Capital cobrado: ${formatCurrency(apiSummary?.payments.collected ?? reportData.collected)}`,
            `Interes proyectado: ${formatCurrency(apiSummary?.loans.expectedInterest ?? reportData.expectedInterest)}`,
            `Mora cobrada: ${formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected)}`,
            `Clientes en riesgo: ${String(apiSummary?.overdue.overdueLoans ?? reportData.inMora.length)}`,
          ],
        },
        summaryTitle: 'Plantilla aplicada',
        summaryValue: templateName,
        summaryMeta: [`Filas ${dataset.rows.length}`, `Columnas ${dataset.columns.length}`, `Periodo ${rangeLabel}`],
        lineItems: [],
        tableHeaders,
        tableRows,
        tableColumnWidths: getReportColumnWidths(tableHeaders.length),
        totals: [
          { label: 'Filas exportadas', value: String(dataset.rows.length) },
          { label: 'Columnas visibles', value: String(dataset.columns.length) },
          { label: 'Capital cobrado', value: formatCurrency(apiSummary?.payments.collected ?? reportData.collected) },
          { label: 'Mora cobrada', value: formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected) },
          { label: 'Balance en caja', value: formatCurrency(apiSummary?.cash.balance ?? 0), emphasis: true },
        ],
        notesTitle: 'Notas del documento',
        notesLines: showTables
          ? ['La exportacion conserva el detalle visible en el centro de reportes.', 'Usa esta salida para auditoria, archivo o distribucion institucional.']
          : ['Documento ejecutivo resumido con indicadores principales del periodo.'],
        footerNote: 'Documento generado desde el centro premium de reportes de PrestaFacil RD.',
        presetLabel: templateName,
      };
    };

    const documentModel = buildDocumentModel();
    if (documentModel && activeDocument) {
      await renderAndSave({
        fileBaseName: `${activeDocument.type}-${activeDocument.reference}`,
        successMessage: `PDF de ${activeDocument.type.toLowerCase()} generado y registrado en el historial.`,
        model: documentModel,
      });
      return;
    }

    const receiptModel = buildReceiptModel();
    if (receiptModel) {
      await renderAndSave({
        fileBaseName: `recibo-${receiptModel.documentNumber || 'cobro'}`,
        successMessage: 'PDF de recibo generado y registrado en el historial.',
        model: receiptModel,
      });
      return;
    }

    await renderAndSave({
      fileBaseName: `reporte-${dataset.title}`,
      successMessage: `PDF de ${reportTypeLabel.toLowerCase()} generado y registrado en el historial.`,
      model: buildReportModel(),
    });
  };

  const downloadPdfReport = async (
    dataset: { title: string; columns: string[]; rows: string[][] },
    reportTypeLabel = activeReportLabel,
    rangeLabel = rangeLabelByPeriod[period],
    branchLabel = activeBranch?.name || 'Todas',
    collectorLabel = scopedCollectors.find(collector => collector.id === selectedCollectorId)?.name || 'Todos',
  ) => {
    const doc = createPlatformPdfDoc({
      paperSize: effectiveTemplateConfig.paperSize,
      orientation: effectiveTemplateConfig.orientation,
    });
    const visualPreset = getPlatformPdfVisualPreset(effectiveTemplateConfig.visualPreset);
    const [accentR, accentG, accentB] = visualPreset.accent;
    const [accentSoftR, accentSoftG, accentSoftB] = visualPreset.accentSoft;
    const [neutralR, neutralG, neutralB] = visualPreset.neutral;
    const isFiscalPreset = visualPreset.visualPreset === 'FISCAL_ELECTRONICA';
    const isFinancialPreset = visualPreset.visualPreset === 'FACTURA_FINANCIERA';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = platformPdfMarginByPreset[effectiveTemplateConfig.marginPreset || 'Normal'];
    const right = pageWidth - left;
    let y = 48;
    const templateSections = effectiveTemplate?.sections?.length ? effectiveTemplate.sections : previewSections;
    const showCover = templateSections.includes('Portada con branding y periodo');
    const showKpis = templateSections.includes('KPIs destacados del reporte');
    const showCharts = templateSections.includes('Graficos de tendencia y composicion');
    const showTables = templateSections.includes('Tablas de respaldo y observaciones');
    const activeDocument = exportWorkspace === 'DOCUMENTS' || reportsSubview === 'DOCUMENTS' ? selectedGeneratedDocument : null;

    if (activeDocument && selectedDocumentPreview) {
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(left, y, right - left, pageHeight - 96, 22, 22, 'FD');
      if (isFinancialPreset) {
        doc.setFillColor(neutralR, neutralG, neutralB);
        doc.roundedRect(left + 18, y + 18, right - left - 36, 92, 20, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(company?.name || 'PrestaFacil RD', left + 38, y + 48);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`Sucursal: ${activeDocument.branchName || branchLabel}`, left + 38, y + 70);
        doc.text(`Generado por: ${activeDocument.owner}`, left + 38, y + 88);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(selectedDocumentPreview.title, right - 220, y + 48);
        doc.setFont('helvetica', 'normal');
        doc.text(`Ref: ${activeDocument.reference}`, right - 220, y + 72);
        doc.text(`Fecha: ${activeDocument.date}`, right - 220, y + 90);
      } else if (isFiscalPreset) {
        doc.setTextColor(neutralR, neutralG, neutralB);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(company?.name || 'PrestaFacil RD', left + 24, y + 34);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Sucursal: ${activeDocument.branchName || branchLabel}`, left + 24, y + 54);
        doc.text(`Generado por: ${activeDocument.owner}`, left + 24, y + 68);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(selectedDocumentPreview.title.toUpperCase(), right - 210, y + 34);
        doc.setFont('helvetica', 'normal');
        doc.text(`Ref: ${activeDocument.reference}`, right - 210, y + 54);
        doc.text(`Fecha: ${activeDocument.date}`, right - 210, y + 68);
        doc.setDrawColor(accentR, accentG, accentB);
        doc.line(left + 24, y + 84, right - 24, y + 84);
      } else {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(company?.name || 'PrestaFacil RD', left + 24, y + 36);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Sucursal: ${activeDocument.branchName || branchLabel}`, left + 24, y + 56);
        doc.text(`Generado por: ${activeDocument.owner}`, left + 24, y + 72);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(selectedDocumentPreview.title, right - 210, y + 36);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`Ref: ${activeDocument.reference}`, right - 210, y + 58);
        doc.text(`Fecha: ${activeDocument.date}`, right - 210, y + 74);
      }
      y += 108;

      doc.setFontSize(11);
      selectedDocumentPreview.rows.forEach(([label, value], index) => {
        const rowY = y + index * 28;
        doc.setDrawColor(241, 245, 249);
        doc.line(left + 24, rowY + 16, right - 24, rowY + 16);
        doc.setTextColor(100, 116, 139);
        doc.text(`${label}:`, left + 24, rowY);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(String(value), left + 170, rowY);
        doc.setFont('helvetica', 'normal');
      });

      const summaryY = Math.min(pageHeight - 120, y + selectedDocumentPreview.rows.length * 28 + 30);
      doc.setFillColor(isFinancialPreset ? neutralR : isFiscalPreset ? accentSoftR : 248, isFinancialPreset ? neutralG : isFiscalPreset ? accentSoftG : 250, isFinancialPreset ? neutralB : isFiscalPreset ? accentSoftB : 252);
      doc.roundedRect(left + 24, summaryY, right - left - 48, 54, 16, 16, 'F');
      doc.setTextColor(isFinancialPreset ? 255 : 100, isFinancialPreset ? 255 : 116, isFinancialPreset ? 255 : 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(selectedDocumentPreview.summaryLabel.toUpperCase(), left + 40, summaryY + 20);
      doc.setTextColor(isFinancialPreset ? 255 : neutralR, isFinancialPreset ? 255 : neutralG, isFinancialPreset ? 255 : neutralB);
      doc.setFontSize(18);
      doc.text(selectedDocumentPreview.summaryValue, left + 40, summaryY + 42);

      if (activeDocument.kind === 'PAYMENT_PROMISE' && activeDocument.promise?.note) {
        const noteY = summaryY + 78;
        if (noteY < pageHeight - 40) {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(10);
          doc.text('Observacion', left + 24, noteY);
          doc.setTextColor(15, 23, 42);
          doc.text(activeDocument.promise.note, left + 24, noteY + 18);
        }
      }

      const blob = doc.output('blob');
      doc.save(`${activeDocument.type.toLowerCase().replace(/\s+/g, '-')}-${activeDocument.reference.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      await persistExportLog('PDF', formatBytes(blob.size));
      setExportFeedback(`PDF de ${activeDocument.type.toLowerCase()} generado y registrado en el historial.`);
      return;
    }

    if (effectiveTemplateConfig.documentStyle === 'Recibo de pago' && sampleReceiptContext) {
      const { payment, loan, client, nextInstallment, totalPaid, receiptNumber } = sampleReceiptContext;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(left, y, right - left, pageHeight - 96, 22, 22, 'FD');
      if (isFinancialPreset) {
        doc.setFillColor(accentR, accentG, accentB);
        doc.roundedRect(left + 18, y + 18, right - left - 36, 84, 20, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(company?.name || 'PrestaFacil RD', left + 36, y + 46);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Sucursal: ${branchLabel}`, left + 36, y + 64);
        doc.text(`Generado por: ${collectorLabel}`, left + 36, y + 80);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text('Recibo de pago', right - 180, y + 46);
        doc.setFont('helvetica', 'normal');
        doc.text(`No. ${receiptNumber}`, right - 180, y + 64);
        doc.text(`Fecha: ${formatDate(payment.date)}`, right - 180, y + 80);
      } else {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(company?.name || 'PrestaFacil RD', left + 24, y + 36);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Sucursal: ${branchLabel}`, left + 24, y + 56);
        doc.text(`Generado por: ${collectorLabel}`, left + 24, y + 72);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(isFiscalPreset ? 'Factura / recibo' : 'Recibo de pago', right - 170, y + 36);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`No. ${receiptNumber}`, right - 170, y + 58);
        doc.text(`Fecha: ${formatDate(payment.date)}`, right - 170, y + 74);
      }
      y += 108;

      const details = [
        ['Cliente', client ? `${client.firstName} ${client.lastName}` : 'Cliente no disponible'],
        ['Prestamo', loan?.id || payment.loanId],
        ['Concepto', 'Pago aplicado'],
        ['Capital', formatCurrency(payment.amount)],
        ['Mora', formatCurrency(payment.moraPaid)],
        ['Total pagado', formatCurrency(totalPaid)],
      ];
      if (effectiveTemplateConfig.receiptOptions?.showRemainingBalance) {
        details.push(['Saldo restante', formatCurrency(Math.max((loan?.balance || 0) - payment.amount, 0))]);
      }
      if (effectiveTemplateConfig.receiptOptions?.showNextInstallment && nextInstallment) {
        details.push(['Proxima cuota', `${formatDate(nextInstallment.dueDate)} · ${formatCurrency(nextInstallment.expectedAmount)}`]);
      }

      doc.setFontSize(11);
      details.forEach(([label, value], index) => {
        const rowY = y + index * 28;
        doc.setDrawColor(241, 245, 249);
        doc.line(left + 24, rowY + 16, right - 24, rowY + 16);
        doc.setTextColor(100, 116, 139);
        doc.text(`${label}:`, left + 24, rowY);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(value, left + 150, rowY);
        doc.setFont('helvetica', 'normal');
      });

      if (effectiveTemplateConfig.receiptOptions?.includeSignature) {
        const signatureY = Math.min(pageHeight - 100, y + details.length * 28 + 70);
        doc.setDrawColor(148, 163, 184);
        doc.line(left + 120, signatureY, right - 120, signatureY);
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.text('Firma y sello', pageWidth / 2 - 24, signatureY + 18);
      }

      const blob = doc.output('blob');
      doc.save(`recibo-${receiptNumber.toLowerCase()}.pdf`);
      await persistExportLog('PDF', formatBytes(blob.size));
      setExportFeedback('PDF de recibo generado y registrado en el historial.');
      return;
    }

    if (showCover) {
      if (isFinancialPreset) {
        doc.setFillColor(neutralR, neutralG, neutralB);
        doc.roundedRect(left, y, right - left, 102, 18, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('REPORTE EJECUTIVO', left + 20, y + 24);
        doc.setFontSize(22);
        doc.text(company?.name || 'PrestaFacil RD', left + 20, y + 50);
        doc.setFontSize(16);
        doc.text(dataset.title, left + 20, y + 74);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Periodo: ${rangeLabel}   |   Sucursal: ${branchLabel}   |   Cobrador: ${collectorLabel}`, left + 20, y + 92);
      } else if (isFiscalPreset) {
        doc.setTextColor(neutralR, neutralG, neutralB);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(dataset.title.toUpperCase(), left, y + 18);
        doc.setFontSize(12);
        doc.text(company?.name || 'PrestaFacil RD', left, y + 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Periodo: ${rangeLabel}`, left, y + 60);
        doc.text(`Sucursal: ${branchLabel}`, left, y + 76);
        doc.text(`Cobrador: ${collectorLabel}`, right - 150, y + 60);
        doc.text(`Plantilla: ${visualPreset.label}`, right - 150, y + 76);
        doc.setDrawColor(accentR, accentG, accentB);
        doc.line(left, y + 92, right, y + 92);
      } else {
        doc.setFillColor(accentSoftR, accentSoftG, accentSoftB);
        doc.setDrawColor(accentR, accentG, accentB);
        doc.roundedRect(left, y, right - left, 96, 18, 18, 'FD');
        doc.setTextColor(neutralR, neutralG, neutralB);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('REPORTE CORPORATIVO', left + 20, y + 24);
        doc.setFontSize(22);
        doc.text(company?.name || 'PrestaFacil RD', left + 20, y + 50);
        doc.setFontSize(16);
        doc.text(dataset.title, left + 20, y + 74);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Periodo: ${rangeLabel}   |   Sucursal: ${branchLabel}   |   Cobrador: ${collectorLabel}`, left + 20, y + 92);
      }
      y += 126;
    }

    if (showKpis) {
      const summaryCards = [
        { label: 'Filas exportadas', value: String(dataset.rows.length) },
        { label: 'Columnas', value: String(dataset.columns.length) },
        { label: 'Plantilla', value: effectiveTemplate?.name || 'Base' },
      ];
      const cardWidth = (right - left - 24) / 3;
      summaryCards.forEach((card, index) => {
        const x = left + index * (cardWidth + 12);
        doc.setFillColor(isFinancialPreset ? accentSoftR : isFiscalPreset ? 255 : 248, isFinancialPreset ? accentSoftG : isFiscalPreset ? 255 : 250, isFinancialPreset ? accentSoftB : isFiscalPreset ? 255 : 252);
        doc.setDrawColor(isFiscalPreset ? accentR : 226, isFiscalPreset ? accentG : 232, isFiscalPreset ? accentB : 240);
        doc.roundedRect(x, y, cardWidth, 58, 14, 14, 'FD');
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(card.label.toUpperCase(), x + 14, y + 18);
        doc.setTextColor(isFinancialPreset ? accentR : neutralR, isFinancialPreset ? accentG : neutralG, isFinancialPreset ? accentB : neutralB);
        doc.setFontSize(card.label === 'Plantilla' ? 12 : 16);
        doc.text(card.value, x + 14, y + 40);
      });
      y += 82;
    }

    if (showCharts) {
      doc.setTextColor(neutralR, neutralG, neutralB);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Lectura ejecutiva', left, y);
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const summaryLines = [
        `Capital cobrado: ${formatCurrency(apiSummary?.payments.collected ?? reportData.collected)}`,
        `Interes proyectado: ${formatCurrency(apiSummary?.loans.expectedInterest ?? reportData.expectedInterest)}`,
        `Mora cobrada: ${formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected)}`,
        `Clientes en riesgo: ${apiSummary?.overdue.overdueLoans ?? reportData.inMora.length}`,
      ];
      summaryLines.forEach(line => {
        doc.text(`• ${line}`, left, y);
        y += 16;
      });
      y += 8;
    }

    if (showTables) {
      doc.setFillColor(isFiscalPreset ? accentSoftR : isFinancialPreset ? 248 : 255, isFiscalPreset ? accentSoftG : isFinancialPreset ? 250 : 255, isFiscalPreset ? accentSoftB : isFinancialPreset ? 252 : 255);
      doc.roundedRect(left, y - 12, right - left, 22, 10, 10, 'F');
      doc.setTextColor(neutralR, neutralG, neutralB);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(dataset.columns.join('  |  '), left, y);
      y += 18;
      doc.setDrawColor(accentR, accentG, accentB);
      doc.line(left, y, right, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      dataset.rows.forEach(row => {
        const lines = doc.splitTextToSize(row.join('  |  '), right - left);
        const requiredHeight = lines.length * 15 + 10;
        if (y + requiredHeight > pageHeight - 44) {
          doc.addPage();
          y = 54;
        }
        doc.text(lines, left, y);
        y += requiredHeight;
        doc.setDrawColor(241, 245, 249);
        doc.line(left, y - 4, right, y - 4);
      });
    }

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-${dataset.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    await persistExportLog('PDF', formatBytes(blob.size));
    setExportFeedback(`PDF de ${reportTypeLabel.toLowerCase()} generado y registrado en el historial.`);
  };

  const handleCsvExport = async () => {
    try {
      setExportingFormat('CSV');
      setExportFeedback(null);
      await downloadCsvReport(exportDataset);
    } catch {
      setExportFeedback('No se pudo generar el CSV en este momento.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handlePdfExport = async () => {
    try {
      setExportingFormat('PDF');
      setExportFeedback(null);
      await downloadPdfReportUnified(exportDataset);
    } catch {
      setExportFeedback('No se pudo preparar el PDF en este momento.');
    } finally {
      setExportingFormat(null);
    }
  };

  const resetDocumentFilters = () => {
    setDocumentTypeFilter('ALL');
    setDocumentStatusFilter('ALL');
    setSelectedBranchId(canSeeAllCompanyUsers ? '' : currentUser.branchId);
    setPeriod('THIS_MONTH');
    setSearchTerm('');
    setDocumentsPage(1);
    setOpenFilter(null);
  };

  const handlePrintDocument = async () => {
    try {
      setExportingFormat('PDF');
      setExportFeedback(null);
      await downloadPdfReportUnified(exportDataset);
      window.print();
    } catch {
      setExportFeedback('No se pudo preparar la impresion del documento.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleShareDocument = async (channel: 'WHATSAPP' | 'EMAIL') => {
    if (!selectedGeneratedDocument) return;
    const message = `${selectedGeneratedDocument.type} · ${selectedGeneratedDocument.reference} · ${selectedGeneratedDocument.clientName} · ${selectedGeneratedDocument.date}`;
    try {
      if (channel === 'WHATSAPP') {
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        setExportFeedback('Se preparo el mensaje para compartir por WhatsApp.');
        return;
      }

      const subject = encodeURIComponent(`${selectedGeneratedDocument.type} ${selectedGeneratedDocument.reference}`);
      const body = encodeURIComponent(message);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      setExportFeedback('Se preparo el borrador para enviar por correo.');
    } catch {
      setExportFeedback(channel === 'WHATSAPP' ? 'No se pudo abrir WhatsApp.' : 'No se pudo abrir el correo.');
    }
  };

  const handleHistoryRegenerate = async (item: (typeof exportHistoryRows)[number]) => {
    try {
      setExportingFormat(item.format);
      setExportFeedback(null);
      const dataset = getDatasetByReportType(item.type);
      if (item.format === 'PDF') {
        await downloadPdfReportUnified(dataset, item.type, item.range, item.source.branchName || 'Todas', item.source.collectorName || item.owner);
      } else {
        await downloadCsvReport(dataset, item.type);
      }
    } catch {
      setExportFeedback(`No se pudo regenerar el ${item.format}.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleCreateSchedule = async () => {
    try {
      setSavingSchedule(true);
      setExportFeedback(null);
      const response = await apiClient.createReportSchedule({
        name: scheduleForm.name || `${activeReportLabel} programado`,
        reportType: activeReportLabel,
        format: scheduleForm.format,
        frequency: scheduleForm.frequency,
        deliveryHour: scheduleForm.deliveryHour,
        targetLabel: scheduleForm.targetLabel,
        branchId: selectedBranchId || undefined,
      });
      setReportSchedules(current => [response.data, ...current].slice(0, 50));
      setScheduleForm({
        name: '',
        frequency: 'Semanal',
        format: 'PDF',
        deliveryHour: '08:00',
        targetLabel: 'Gerencia general',
      });
      setExportFeedback('Programacion guardada en el centro de reportes.');
    } catch {
      setExportFeedback('No se pudo guardar la programacion.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleTemplateSection = (section: string) => {
    setTemplateForm(current => ({
      ...current,
      sections: current.sections.includes(section)
        ? current.sections.filter(item => item !== section)
        : [...current.sections, section],
    }));
  };

  const toggleVisibleField = (field: string) => {
    setTemplateForm(current => ({
      ...current,
      visibleFields: current.visibleFields.includes(field)
        ? current.visibleFields.filter(item => item !== field)
        : [...current.visibleFields, field],
    }));
  };

  const handleCreateTemplate = async () => {
    try {
      setSavingTemplate(true);
      setExportFeedback(null);
      const isEditing = Boolean(editingTemplateId);
      const normalizedSections = templateForm.sections.length ? [...templateForm.sections] : [...previewSections];
      const normalizedVisibleFields = templateForm.visibleFields.length ? [...templateForm.visibleFields] : [...allTemplateFields];
      const normalizedConfig = {
        visualPreset: templateForm.visualPreset,
        description: templateForm.description.trim(),
        paperSize: templateForm.paperSize,
        orientation: templateForm.orientation,
        marginPreset: templateForm.marginPreset,
        documentStyle: templateForm.documentStyle,
        visibleFields: normalizedVisibleFields,
        receiptOptions: {
          showNextInstallment: Boolean(templateForm.receiptOptions.showNextInstallment),
          showRemainingBalance: Boolean(templateForm.receiptOptions.showRemainingBalance),
          includeSignature: Boolean(templateForm.receiptOptions.includeSignature),
        },
      } satisfies NonNullable<ReportTemplate['config']>;
      const payload = {
        name: templateForm.name || `${activeReportLabel} premium`,
        reportType: activeReportLabel,
        status: templateForm.status,
        isDefault: templateForm.isDefault,
        sections: normalizedSections,
        config: normalizedConfig,
      };
      const response = editingTemplateId
        ? await apiClient.updateReportTemplate(editingTemplateId, payload)
        : await apiClient.createReportTemplate(payload);
      setReportTemplates(current => {
        const filtered = current.filter(item => item.id !== response.data.id);
        const next = [response.data, ...filtered].slice(0, 50);
        return response.data.isDefault
          ? next.map(item => ({ ...item, isDefault: item.id === response.data.id }))
          : next;
      });
      try {
        handleEditTemplate(response.data);
      } catch (uiSyncError) {
        console.error('No se pudo resincronizar el editor de plantillas.', uiSyncError);
        setTemplateForm(current => ({
          ...current,
          name: response.data.name,
          status: response.data.status,
          isDefault: response.data.isDefault,
          sections: response.data.sections?.length ? response.data.sections : normalizedSections,
          ...normalizedConfig,
        }));
      }
      setSelectedTemplateId(response.data.id);
      setExportFeedback(isEditing ? 'Preset actualizado y listo para exportacion.' : 'Preset listo y activo para exportacion.');
      emitPlatformToast({
        tone: 'success',
        title: isEditing ? 'Preset actualizado' : 'Preset listo',
        message: isEditing
          ? 'Los cambios se aplicaron y el formato sigue activo en el editor.'
          : 'El formato quedo activo para vista previa y exportacion.',
      });
    } catch (error) {
      const fallbackMessage = editingTemplateId ? 'No se pudo actualizar el preset.' : 'No se pudo guardar el preset.';
      const rawMessage = error instanceof Error ? error.message : fallbackMessage;
      const normalizedMessage =
        rawMessage === 'Invalid or expired token'
          ? 'Tu sesion de API vencio. Vuelve a iniciar sesion para actualizar la plantilla.'
          : rawMessage === 'Missing bearer token'
            ? 'No hay una sesion API activa para actualizar la plantilla.'
            : rawMessage === 'Missing API session'
              ? 'Tu sesion de API no esta activa. Inicia sesion de nuevo para guardar la plantilla.'
              : rawMessage || fallbackMessage;
      setExportFeedback(normalizedMessage);
      emitPlatformToast({
        tone: 'error',
        title: editingTemplateId ? 'No se pudo actualizar el preset' : 'No se pudo guardar el preset',
        message: normalizedMessage,
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleEditTemplate = (template: ReportTemplate) => {
    const resolvedConfig = resolvePlatformPdfTemplateConfig({
      visualPreset: template.config?.visualPreset || defaultTemplateConfig.visualPreset,
      paperSize: template.config?.paperSize,
      orientation: template.config?.orientation,
      marginPreset: template.config?.marginPreset,
      documentStyle: template.config?.documentStyle,
    });
    setSelectedTemplateId(template.id);
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      status: template.status,
      isDefault: template.isDefault,
      sections: template.sections,
      visualPreset: resolvedConfig.visualPreset,
      description: template.config?.description || '',
      paperSize: resolvedConfig.paperSize,
      orientation: resolvedConfig.orientation,
      marginPreset: resolvedConfig.marginPreset,
      documentStyle: resolvedConfig.documentStyle,
      visibleFields: template.config?.visibleFields?.length ? template.config.visibleFields : allTemplateFields,
      receiptOptions: {
        ...defaultTemplateConfig.receiptOptions,
        ...(template.config?.receiptOptions || {}),
      },
    });
  };

  const exportFeedbackIsError = Boolean(
    exportFeedback &&
      /(no se pudo|sesion de api|sesión de api|invalid|expired token|missing bearer token)/i.test(exportFeedback),
  );

  const resetTemplateEditor = () => {
    setEditingTemplateId(null);
    setTemplateForm(createDefaultTemplateForm());
  };

  const getDrillDownList = () => {
    if (drillDownType === 'MORA') return reportData.inMora;
    if (drillDownType === 'ACTIVOS') return reportData.actives;
    if (drillDownType === 'SALDADOS') return reportData.finished;
    return [];
  };

  if (!currentUser) return null;

  if (reportsSubview === 'TEMPLATE') {
    const financialTemplateSections = templateForm.sections.length ? templateForm.sections : previewSections;

    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        <section>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Exportaciones</p>
              <h1 className="mt-3 text-[44px] font-black leading-none tracking-tight text-[#111827]">Editor de plantilla</h1>
              <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
                Configura una plantilla financiera en ancho completo, con preview central tipo builder y campos reutilizables.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
              <button
                type="button"
                onClick={closeReportsSubview}
                className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}
              >
                <ArrowLeft size={18} className="pointer-events-none" />
                Volver a reportes
              </button>
              <button
                type="button"
                onClick={() => openReportsSubview('preview')}
                className={`inline-flex h-[56px] min-w-[172px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}
              >
                Vista previa
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={savingTemplate}
                className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTemplate ? 'Guardando...' : editingTemplateId ? 'Actualizar plantilla' : 'Guardar plantilla'}
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          {exportFeedback ? (
            <div className="mt-4 flex justify-end">
              <div
                className={`inline-flex max-w-[560px] items-center gap-3 rounded-2xl border px-4 py-3 text-[14px] font-semibold shadow-sm animate-[platform-toast-in_220ms_ease-out] ${
                  exportFeedbackIsError
                    ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                    : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                }`}
              >
                {exportFeedbackIsError ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                <span>{exportFeedback}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="relative z-20 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <ReportFilterDropdown
                value={selectedTemplateId}
                onChange={value => {
                  setSelectedTemplateId(value);
                  const target = reportTemplates.find(item => item.id === value);
                  if (target) handleEditTemplate(target);
                }}
                placeholder="Plantillas disponibles"
                options={reportTemplates.length ? reportTemplates.map(item => ({ value: item.id, label: item.name })) : [{ value: '', label: 'Sin plantillas' }]}
                isOpen={openFilter === 'templateLibrary'}
                onToggle={() => setOpenFilter(current => (current === 'templateLibrary' ? null : 'templateLibrary'))}
                onRequestClose={() => setOpenFilter(null)}
              />
              <div className="flex h-[56px] items-center rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827]">
                {getPlatformPdfVisualPreset(templateForm.visualPreset).label} · {templateForm.paperSize} · {templateForm.orientation}
              </div>
            </div>
          </div>

          <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Nombre de plantilla</span>
                <input value={templateForm.name} onChange={event => setTemplateForm(current => ({ ...current, name: event.target.value }))} placeholder={`${activeReportLabel} premium`} className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Descripcion</span>
                <input value={templateForm.description} onChange={event => setTemplateForm(current => ({ ...current, description: event.target.value }))} placeholder="Describe el enfoque del documento o recibo." className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]" />
              </label>
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Preset visual</span>
                <ReportFilterDropdown
                  value={templateForm.visualPreset}
                  onChange={value => {
                    const presetConfig = resolvePlatformPdfTemplateConfig({ visualPreset: value as NonNullable<ReportTemplate['config']>['visualPreset'] });
                    setTemplateForm(current => ({
                      ...current,
                      visualPreset: presetConfig.visualPreset,
                      paperSize: presetConfig.paperSize,
                      orientation: presetConfig.orientation,
                      marginPreset: presetConfig.marginPreset,
                      documentStyle: presetConfig.documentStyle,
                    }));
                  }}
                  placeholder="Preset visual"
                  options={templatePresetOptions}
                  isOpen={openFilter === 'templatePreset'}
                  onToggle={() => setOpenFilter(current => (current === 'templatePreset' ? null : 'templatePreset'))}
                  onRequestClose={() => setOpenFilter(null)}
                />
                <p className="text-[13px] font-medium text-[#64748B]">{getPlatformPdfVisualPreset(templateForm.visualPreset).description}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Estado</span>
                <ReportFilterDropdown
                  value={templateForm.status}
                  onChange={value => setTemplateForm(current => ({ ...current, status: value }))}
                  placeholder="Estado"
                  options={[
                    { value: 'Activo', label: 'Activo' },
                    { value: 'Listo', label: 'Listo' },
                    { value: 'Borrador', label: 'Borrador' },
                  ]}
                  isOpen={openFilter === 'templateStatus'}
                  onToggle={() => setOpenFilter(current => (current === 'templateStatus' ? null : 'templateStatus'))}
                  onRequestClose={() => setOpenFilter(null)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Estilo del documento</span>
                <ReportFilterDropdown
                  value={templateForm.documentStyle}
                  onChange={value => setTemplateForm(current => ({ ...current, documentStyle: value as 'Reporte premium' | 'Recibo de pago' }))}
                  placeholder="Estilo"
                  options={[
                    { value: 'Reporte premium', label: 'Reporte premium' },
                    { value: 'Recibo de pago', label: 'Recibo de pago' },
                  ]}
                  isOpen={openFilter === 'templateStyle'}
                  onToggle={() => setOpenFilter(current => (current === 'templateStyle' ? null : 'templateStyle'))}
                  onRequestClose={() => setOpenFilter(null)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Tamano</span>
                <ReportFilterDropdown
                  value={templateForm.paperSize}
                  onChange={value => setTemplateForm(current => ({ ...current, paperSize: value as 'A4' | 'Carta' | 'Oficio' }))}
                  placeholder="Tamano"
                  options={[
                    { value: 'A4', label: 'A4' },
                    { value: 'Carta', label: 'Carta' },
                    { value: 'Oficio', label: 'Oficio' },
                  ]}
                  isOpen={openFilter === 'templatePaperSize'}
                  onToggle={() => setOpenFilter(current => (current === 'templatePaperSize' ? null : 'templatePaperSize'))}
                  onRequestClose={() => setOpenFilter(null)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Orientacion</span>
                <ReportFilterDropdown
                  value={templateForm.orientation}
                  onChange={value => setTemplateForm(current => ({ ...current, orientation: value as 'Vertical' | 'Horizontal' }))}
                  placeholder="Orientacion"
                  options={[
                    { value: 'Vertical', label: 'Vertical' },
                    { value: 'Horizontal', label: 'Horizontal' },
                  ]}
                  isOpen={openFilter === 'templateOrientation'}
                  onToggle={() => setOpenFilter(current => (current === 'templateOrientation' ? null : 'templateOrientation'))}
                  onRequestClose={() => setOpenFilter(null)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Margenes</span>
                <ReportFilterDropdown
                  value={templateForm.marginPreset}
                  onChange={value => setTemplateForm(current => ({ ...current, marginPreset: value as 'Compacto' | 'Normal' | 'Amplio' }))}
                  placeholder="Margenes"
                  options={[
                    { value: 'Compacto', label: 'Compacto' },
                    { value: 'Normal', label: 'Normal' },
                    { value: 'Amplio', label: 'Amplio' },
                  ]}
                  isOpen={openFilter === 'templateMargin'}
                  onToggle={() => setOpenFilter(current => (current === 'templateMargin' ? null : 'templateMargin'))}
                  onRequestClose={() => setOpenFilter(null)}
                />
              </div>

              <label className="flex items-center gap-3 rounded-[22px] border border-[#E5E7EB] px-4 py-3">
                <input type="checkbox" checked={templateForm.isDefault} onChange={event => setTemplateForm(current => ({ ...current, isDefault: event.target.checked }))} />
                <span className="text-[14px] font-semibold text-[#111827]">Usar como plantilla principal</span>
              </label>

              <details className="rounded-[22px] border border-[#E5E7EB] bg-white p-4">
                <summary className="flex list-none items-center justify-between gap-3 text-[14px] font-semibold text-[#111827]">
                  Campos visibles
                  <ChevronDown size={16} className="pointer-events-none text-[#94A3B8]" />
                </summary>
                <p className="mt-3 text-[13px] font-medium text-[#64748B]">Activa o desactiva los campos que quieres reflejar en la propuesta financiera y en la vista previa.</p>
                <div className="mt-4 space-y-4">
                  {templateFieldGroups.map(group => (
                    <div key={group.title} className="rounded-[20px] border border-[#EEF2F7] bg-[#FCFDFF] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{group.title}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.items.map(field => {
                          const active = templateForm.visibleFields.includes(field);
                          return (
                            <button
                              key={field}
                              type="button"
                              onClick={() => toggleVisibleField(field)}
                              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
                                active
                                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                                  : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                              }`}
                            >
                              {field}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Bloques del documento</p>
                <div className="mt-3 grid gap-3">
                  {previewSections.map(section => {
                    const active = templateForm.sections.includes(section);
                    return (
                      <button key={section} type="button" onClick={() => toggleTemplateSection(section)} className={`rounded-[22px] border px-4 py-3 text-left text-[14px] font-semibold transition-all duration-200 ${
                        active ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#DBEAFE] hover:bg-[#F8FAFC]'
                      }`}>
                        {section}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] pb-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Canvas</p>
                <h2 className="mt-2 text-[28px] font-black tracking-tight text-[#111827]">Propuesta de plantilla financiera</h2>
              </div>
              <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">{getPlatformPdfVisualPreset(templateForm.visualPreset).label} · {templateForm.paperSize}</span>
            </div>

            <div className="mt-6 rounded-[28px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
              <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <TemplatePresetCanvas preset={templateForm.visualPreset} model={templateEditorCanvasModel} />
                {false && (
                  <>
                <div className="flex items-start justify-between gap-6 border-b border-[#EEF2F7] pb-5">
                  <div>
                    <h3 className="text-[30px] font-black tracking-tight text-[#111827]">{isTemplateFieldVisible('Razon social') ? company?.name || 'PrestaFacil RD' : 'Documento financiero'}</h3>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">
                      {[isTemplateFieldVisible('Sucursal') ? activeBranch?.name || 'Vista consolidada' : null, isTemplateFieldVisible('Periodo') ? rangeLabelByPeriod[period] : null]
                        .filter(Boolean)
                        .join(' · ') || 'Plantilla premium editable'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[26px] font-black tracking-tight text-[#111827]">{isTemplateFieldVisible('Titulo') ? templateForm.name || 'Reporte financiero premium' : 'Plantilla configurada'}</p>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">{templateForm.description || 'Capital, intereses, mora y composicion general del periodo.'}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-4">
                  {[
                    isTemplateFieldVisible('Capital cobrado') ? { label: 'Capital cobrado', value: formatCurrency(apiSummary?.payments.collected ?? reportData.collected) } : null,
                    isTemplateFieldVisible('Intereses cobrados') ? { label: 'Interes cobrado', value: formatCurrency(apiSummary?.loans.expectedInterest ?? reportData.expectedInterest) } : null,
                    isTemplateFieldVisible('Mora cobrada') ? { label: 'Mora cobrada', value: formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected) } : null,
                    isTemplateFieldVisible('Total cobrado') ? { label: 'Balance neto', value: formatCurrency(apiSummary?.cash.balance ?? 0) } : null,
                  ].filter((item): item is { label: string; value: string } => Boolean(item)).map(item => (
                    <div key={item.label} className="rounded-[22px] border border-[#EEF2F7] bg-[#FCFDFF] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{item.label}</p>
                      <p className="mt-3 text-[24px] font-black tracking-tight text-[#111827]">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
                  <div className="rounded-[22px] border border-[#EEF2F7] p-5">
                    <p className="text-[16px] font-black text-[#111827]">Tendencia del periodo</p>
                    <div className="mt-5 flex h-[210px] items-end gap-3">
                      {chartData.slice(0, 7).map(item => (
                        <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                          <div className="w-full rounded-t-[14px] bg-[#2563EB]/85" style={{ height: `${Math.max(32, Math.min(180, item.total / Math.max(chartData[0]?.total || 1, 1) * 180))}px` }} />
                          <span className="text-[11px] font-semibold text-[#94A3B8]">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-[#EEF2F7] p-5">
                    <p className="text-[16px] font-black text-[#111827]">Bloques activos</p>
                    <div className="mt-4 space-y-3">
                      {financialTemplateSections.map(section => (
                        <div key={section} className="rounded-[18px] border border-[#E5E7EB] px-4 py-3">
                          <p className="text-[14px] font-semibold text-[#111827]">{section}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[22px] border border-[#EEF2F7] bg-[#FCFDFF] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[16px] font-black text-[#111827]">Campos visibles activos</p>
                    <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">{templateVisibleFields.length} activos</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {templateVisibleFields.map(field => (
                      <span key={field} className="rounded-full border border-[#DBEAFE] bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#2563EB]">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-[22px] border border-[#EEF2F7] p-5">
                  <p className="text-[16px] font-black text-[#111827]">Detalle financiero</p>
                  <div className="mt-4 grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-[#EEF2F7] pb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">
                    <span>{isTemplateFieldVisible('Sucursal') ? 'Sucursal' : 'Segmento'}</span>
                    <span>{isTemplateFieldVisible('Capital cobrado') ? 'Capital' : 'Monto base'}</span>
                    <span>{isTemplateFieldVisible('Intereses cobrados') ? 'Interes' : 'Dato 2'}</span>
                    <span>{isTemplateFieldVisible('Mora cobrada') ? 'Mora' : 'Dato 3'}</span>
                    <span>{isTemplateFieldVisible('Total cobrado') ? 'Total' : 'Resultado'}</span>
                  </div>
                  <div className="divide-y divide-[#EEF2F7]">
                    {financialBreakdown.slice(0, 4).map(item => (
                      <div key={item.branch.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-4 py-3">
                        <span className="text-[14px] font-semibold text-[#111827]">{item.branch.name}</span>
                        <span className="text-[14px] text-[#64748B]">{formatCurrency(item.capital)}</span>
                        <span className="text-[14px] text-[#64748B]">{formatCurrency(item.interest)}</span>
                        <span className="text-[14px] text-[#64748B]">{formatCurrency(item.mora)}</span>
                        <span className="text-[14px] font-bold text-[#2563EB]">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                  </>
                )}
              </div>
            </div>
            </section>
          </div>
        </section>
        </section>
      </div>
    );
  }

  if (reportsSubview === 'PREVIEW') {
    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        <section>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Exportaciones</p>
              <h1 className="mt-3 text-[44px] font-black leading-none tracking-tight text-[#111827]">Vista previa del reporte</h1>
              <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
                Revisa el documento en una vista amplia antes de descargarlo, compartirlo o convertirlo en plantilla.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
              <button type="button" onClick={closeReportsSubview} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                <ArrowLeft size={18} className="pointer-events-none" />
                Volver a reportes
              </button>
              <button type="button" onClick={() => openReportsSubview('documents')} className={`inline-flex h-[56px] min-w-[172px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                Documentos
              </button>
              <button type="button" onClick={handlePdfExport} disabled={exportingFormat === 'PDF'} className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60">
                Descargar PDF
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="rounded-[28px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6">
              <div className="mx-auto max-w-[980px] rounded-[28px] border border-[#E5E7EB] bg-white p-8 shadow-sm">
                {selectedDocumentPreview ? (
                  <>
                    <div className="flex items-start justify-between gap-6 border-b border-[#EEF2F7] pb-5">
                      <div>
                        <h2 className="text-[34px] font-black tracking-tight text-[#111827]">{company?.name || 'PrestaFacil RD'}</h2>
                        <p className="mt-2 text-[15px] font-medium text-[#64748B]">{activeBranch?.name || 'Vista consolidada'} · {rangeLabelByPeriod[period]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[30px] font-black tracking-tight text-[#111827]">{selectedDocumentPreview.title}</p>
                        <p className="mt-2 text-[14px] font-medium text-[#64748B]">{selectedGeneratedDocument?.reference || effectiveTemplate?.name || 'Documento premium'}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <div className="space-y-3">
                        {selectedDocumentPreview.rows.slice(0, Math.ceil(selectedDocumentPreview.rows.length / 2)).map(([label, value]) => (
                          <InfoPill key={label} label={label} value={value} />
                        ))}
                      </div>
                      <div className="space-y-3">
                        {selectedDocumentPreview.rows.slice(Math.ceil(selectedDocumentPreview.rows.length / 2)).map(([label, value]) => (
                          <InfoPill key={label} label={label} value={value} />
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 rounded-[24px] border border-[#DBEAFE] bg-[#EFF6FF] px-6 py-5">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[14px] font-black uppercase tracking-[0.18em] text-[#2563EB]">{selectedDocumentPreview.summaryLabel}</p>
                        <p className="text-[28px] font-black tracking-tight text-[#111827]">{selectedDocumentPreview.summaryValue}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <TemplatePresetCanvas preset={effectiveTemplateConfig.visualPreset} model={previewCanvasModel} />
                    {false && (
                      <>
                    <div className="flex items-start justify-between gap-6 border-b border-[#EEF2F7] pb-5">
                      <div>
                        <h2 className="text-[34px] font-black tracking-tight text-[#111827]">{isTemplateFieldVisible('Razon social') ? company?.name || 'PrestaFacil RD' : 'Documento financiero'}</h2>
                        <p className="mt-2 text-[15px] font-medium text-[#64748B]">
                          {[isTemplateFieldVisible('Sucursal') ? activeBranch?.name || 'Vista consolidada' : null, isTemplateFieldVisible('Periodo') ? rangeLabelByPeriod[period] : null]
                            .filter(Boolean)
                            .join(' · ') || 'Vista previa del formato guardado'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[30px] font-black tracking-tight text-[#111827]">{isTemplateFieldVisible('Titulo') ? effectiveTemplate?.name || 'Reporte financiero premium' : 'Documento activo'}</p>
                        <p className="mt-2 text-[14px] font-medium text-[#64748B]">{effectiveTemplateConfig.description || effectiveTemplateConfig.documentStyle}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-4">
                      {[
                        isTemplateFieldVisible('Capital cobrado') ? { label: 'Capital cobrado', value: formatCurrency(apiSummary?.payments.collected ?? reportData.collected) } : null,
                        isTemplateFieldVisible('Intereses cobrados') ? { label: 'Interes cobrado', value: formatCurrency(apiSummary?.loans.expectedInterest ?? reportData.expectedInterest) } : null,
                        isTemplateFieldVisible('Mora cobrada') ? { label: 'Mora cobrada', value: formatCurrency(apiSummary?.payments.moraCollected ?? reportData.moraCollected) } : null,
                        isTemplateFieldVisible('Total cobrado') ? { label: 'Balance neto', value: formatCurrency(apiSummary?.cash.balance ?? 0) } : null,
                      ].filter((item): item is { label: string; value: string } => Boolean(item)).map(item => (
                        <div key={item.label} className="rounded-[18px] border border-[#EEF2F7] bg-[#FCFDFF] px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{item.label}</p>
                          <p className="mt-2 text-[21px] font-black tracking-tight text-[#111827]">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
                      <div className="rounded-[22px] border border-[#EEF2F7] p-5">
                        <p className="text-[16px] font-black text-[#111827]">Tendencia del periodo</p>
                        <div className="mt-5 flex h-[210px] items-end gap-3">
                          {chartData.slice(0, 7).map(item => (
                            <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                              <div className="w-full rounded-t-[14px] bg-[#2563EB]/85" style={{ height: `${Math.max(32, Math.min(180, item.total / Math.max(chartData[0]?.total || 1, 1) * 180))}px` }} />
                              <span className="text-[11px] font-semibold text-[#94A3B8]">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-[#EEF2F7] p-5">
                        <p className="text-[16px] font-black text-[#111827]">Bloques activos</p>
                        <div className="mt-4 space-y-3">
                          {(effectiveTemplate?.sections?.length ? effectiveTemplate.sections : previewSections).map(section => (
                            <div key={section} className="rounded-[18px] border border-[#E5E7EB] px-4 py-3">
                              <p className="text-[14px] font-semibold text-[#111827]">{section}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-[22px] border border-[#EEF2F7] p-5">
                      <p className="text-[16px] font-black text-[#111827]">Detalle financiero</p>
                      <div className="mt-4 grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-[#EEF2F7] pb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">
                        <span>{isTemplateFieldVisible('Sucursal') ? 'Sucursal' : 'Segmento'}</span>
                        <span>{isTemplateFieldVisible('Capital cobrado') ? 'Capital' : 'Monto base'}</span>
                        <span>{isTemplateFieldVisible('Intereses cobrados') ? 'Interes' : 'Dato 2'}</span>
                        <span>{isTemplateFieldVisible('Mora cobrada') ? 'Mora' : 'Dato 3'}</span>
                        <span>{isTemplateFieldVisible('Total cobrado') ? 'Total' : 'Resultado'}</span>
                      </div>
                      <div className="divide-y divide-[#EEF2F7]">
                        {financialBreakdown.slice(0, 4).map(item => (
                          <div key={item.branch.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-4 py-3">
                            <span className="text-[14px] font-semibold text-[#111827]">{item.branch.name}</span>
                            <span className="text-[14px] text-[#64748B]">{formatCurrency(item.capital)}</span>
                            <span className="text-[14px] text-[#64748B]">{formatCurrency(item.interest)}</span>
                            <span className="text-[14px] text-[#64748B]">{formatCurrency(item.mora)}</span>
                            <span className="text-[14px] font-bold text-[#2563EB]">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 rounded-[22px] border border-[#EEF2F7] bg-[#FCFDFF] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[16px] font-black text-[#111827]">Campos visibles de la plantilla</p>
                        <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">{effectiveTemplateConfig.visibleFields?.length || allTemplateFields.length} activos</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(effectiveTemplateConfig.visibleFields?.length ? effectiveTemplateConfig.visibleFields : allTemplateFields).map(field => (
                          <span key={field} className="rounded-full border border-[#DBEAFE] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#2563EB]">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <SidebarCard title="Configuracion actual">
              <InfoPill label="Plantilla" value={effectiveTemplate?.name || 'Base del sistema'} />
              <InfoPill label="Estilo" value={effectiveTemplateConfig.documentStyle} />
              <InfoPill label="Sucursal" value={activeBranch?.name || 'Vista consolidada'} />
              <InfoPill label="Periodo" value={rangeLabelByPeriod[period]} />
            </SidebarCard>
            <SidebarCard title="Acciones">
              <button type="button" onClick={handlePdfExport} disabled={exportingFormat === 'PDF'} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                Descargar PDF
              </button>
              <button type="button" onClick={() => openReportsSubview('templates')} className={`mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                Editar plantilla
              </button>
            </SidebarCard>
          </div>
        </section>
      </div>
    );
  }

  if (reportsSubview === 'DOCUMENTS') {
    return (
      <div className="space-y-6 pb-24 lg:pb-0">
        <section>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#2563EB]">Exportaciones</p>
              <h1 className="mt-3 text-[44px] font-black leading-none tracking-tight text-[#111827]">Documentos generados</h1>
              <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
                Gestiona recibos, promesas, cierres y documentos finales desde una subvista completa, con selección y acciones por registro.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
              <button type="button" onClick={closeReportsSubview} className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                <ArrowLeft size={18} className="pointer-events-none" />
                Volver a reportes
              </button>
              <button type="button" onClick={() => openReportsSubview('preview')} className={`inline-flex h-[56px] min-w-[172px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                Vista previa
              </button>
              <button type="button" onClick={handlePdfExport} disabled={exportingFormat === 'PDF'} className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60">
                Descargar PDF
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="relative z-20 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_220px_220px_200px_minmax(240px,1fr)_188px]">
              <ReportFilterDropdown
                value={documentTypeFilter}
                onChange={setDocumentTypeFilter}
                placeholder="Tipo de documento"
                options={documentTypeOptions}
                isOpen={openFilter === 'documentType'}
                onToggle={() => setOpenFilter(current => (current === 'documentType' ? null : 'documentType'))}
                onRequestClose={() => setOpenFilter(null)}
              />
              <ReportFilterDropdown
                value={documentStatusFilter}
                onChange={setDocumentStatusFilter}
                placeholder="Estado"
                options={documentStatusOptions}
                isOpen={openFilter === 'documentStatus'}
                onToggle={() => setOpenFilter(current => (current === 'documentStatus' ? null : 'documentStatus'))}
                onRequestClose={() => setOpenFilter(null)}
              />
              <ReportFilterDropdown
                value={selectedBranchId}
                onChange={value => {
                  setSelectedBranchId(value);
                  setDocumentsPage(1);
                }}
                placeholder="Sucursal"
                options={documentBranchOptions}
                isOpen={openFilter === 'branch'}
                onToggle={() => setOpenFilter(current => (current === 'branch' ? null : 'branch'))}
                onRequestClose={() => setOpenFilter(null)}
              />
              <ReportFilterDropdown
                value={period}
                onChange={value => {
                  setPeriod(value as Period);
                  setDocumentsPage(1);
                }}
                placeholder="Periodo"
                options={documentPeriodOptions}
                isOpen={openFilter === 'period'}
                onToggle={() => setOpenFilter(current => (current === 'period' ? null : 'period'))}
                onRequestClose={() => setOpenFilter(null)}
              />
              <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD] focus-within:shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
                <Search size={18} className="pointer-events-none text-[#6B7280]" />
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Buscar documento, cliente o referencia"
                  className="w-full bg-transparent text-[15px] font-semibold text-[#111827] outline-none placeholder:text-[#94A3B8]"
                />
              </div>
              <button type="button" onClick={resetDocumentFilters} className={`inline-flex h-[56px] w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#374151] ${horizontalMotionClass}`}>
                <Filter size={18} className="pointer-events-none" />
                Limpiar filtros
              </button>
            </div>
          </div>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] pb-4">
              <div>
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Documentos</h2>
                <p className="mt-1 text-[15px] font-medium text-[#64748B]">Recibos, reportes y salidas finales registradas en el sistema.</p>
              </div>
              <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#64748B]">{filteredGeneratedDocuments.length} visibles</span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[1.25fr_1.1fr_1.2fr_1fr_0.8fr_0.8fr] gap-4 border-b border-[#EEF2F7] px-2 pb-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  <span>Tipo</span>
                  <span>Cliente</span>
                  <span>Referencia</span>
                  <span>Fecha</span>
                  <span>Canal</span>
                  <span>Formato</span>
                </div>
                <div className="divide-y divide-[#EEF2F7]">
                  {documentsPageData.items.map(item => (
                    <button key={item.id} type="button" onClick={() => setSelectedGeneratedDocumentId(item.id)} className={`grid w-full grid-cols-[1.25fr_1.1fr_1.2fr_1fr_0.8fr_0.8fr] gap-4 px-2 py-4 text-left transition-colors ${selectedGeneratedDocumentId === item.id ? 'bg-[#F8FAFC]' : 'hover:bg-[#FCFDFF]'}`}>
                      <div>
                        <span className="text-[14px] font-semibold text-[#111827]">{item.type}</span>
                        <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{item.status}</p>
                      </div>
                      <span className="text-[14px] font-medium text-[#64748B]">{item.clientName}</span>
                      <span className="text-[14px] font-medium text-[#64748B]">{item.reference}</span>
                      <span className="text-[14px] font-medium text-[#64748B]">{item.date}</span>
                      <span className="text-[14px] font-medium text-[#64748B]">{item.channel}</span>
                      <span className="text-[14px] font-bold text-[#2563EB]">{item.format}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <PanelPagination page={documentsPageData.page} totalPages={documentsPageData.totalPages} totalItems={filteredGeneratedDocuments.length} pageSize={10} onChange={setDocumentsPage} />
          </section>

          <div className="space-y-5">
            <SidebarCard title="Documento seleccionado">
              {selectedGeneratedDocument && selectedDocumentPreview ? (
                <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[16px] font-black text-[#111827]">{selectedDocumentPreview.title}</p>
                      <p className="mt-1 text-[13px] font-medium text-[#64748B]">{selectedGeneratedDocument.reference}</p>
                    </div>
                    <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-semibold text-[#16A34A]">{selectedGeneratedDocument.status}</span>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                    <div className="space-y-2 text-[13px] font-medium text-[#334155]">
                      {selectedDocumentPreview.rows.slice(0, 4).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-3">
                          <span>{label}</span>
                          <span className="font-semibold text-[#111827]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-[#E5E7EB] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{selectedDocumentPreview.summaryLabel}</span>
                      <span className="text-[15px] font-bold text-[#111827]">{selectedDocumentPreview.summaryValue}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button type="button" onClick={() => openReportsSubview('preview')} className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                      Vista previa
                    </button>
                    <button type="button" onClick={handlePdfExport} disabled={exportingFormat === 'PDF'} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                      Descargar PDF
                    </button>
                    <button type="button" onClick={handlePrintDocument} disabled={exportingFormat === 'PDF'} className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass} disabled:cursor-not-allowed disabled:opacity-60`}>
                      Imprimir
                    </button>
                    <button type="button" onClick={() => void handleShareDocument('WHATSAPP')} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#BBF7D0] bg-white px-4 text-[14px] font-semibold text-[#16A34A] transition-all duration-200 hover:translate-x-1 hover:bg-[#F0FDF4]">
                      Compartir por WhatsApp
                    </button>
                    <button type="button" onClick={() => void handleShareDocument('EMAIL')} className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                      Enviar por correo
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState label="Aun no hay documentos disponibles." compact />
              )}
            </SidebarCard>
          </div>
          </section>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[52px] font-black leading-none tracking-tight text-[#111827]">Reportes</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
              Analiza rendimiento financiero y operativo con una vista premium de negocio, productividad y exportaciones.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
            <button
              type="button"
              onClick={() => setExportWorkspace('PDF')}
              className="inline-flex h-[56px] min-w-[164px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]"
            >
              <Download size={18} />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => setExportWorkspace('CSV')}
              className={`inline-flex h-[56px] min-w-[164px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm ${horizontalMotionClass}`}
            >
              <FileSpreadsheet size={18} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => setExportWorkspace('SCHEDULE')}
              className={`inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm ${horizontalMotionClass}`}
            >
              <CalendarDays size={18} />
              Programar reporte
            </button>
          </div>
        </div>
      </section>

      <section className="relative z-20 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_220px_220px_220px_minmax(280px,1fr)_auto]">
          <ReportFilterDropdown
            value={period}
            onChange={value => setPeriod(value as Period)}
            placeholder="Rango de fechas"
            options={[
              { value: 'TODAY', label: 'Hoy' },
              { value: 'THIS_MONTH', label: 'Este mes' },
              { value: 'LAST_MONTH', label: 'Mes pasado' },
              { value: 'TOTAL', label: 'Total' },
            ]}
            isOpen={openFilter === 'period'}
            onToggle={() => setOpenFilter(current => (current === 'period' ? null : 'period'))}
            onRequestClose={() => setOpenFilter(null)}
          />

          <ReportFilterDropdown
            value={selectedBranchId}
            onChange={setSelectedBranchId}
            placeholder={canSeeAllCompanyUsers ? 'Todas las sucursales' : activeBranch?.name || 'Sucursal actual'}
            options={[
              ...(canSeeAllCompanyUsers ? [{ value: '', label: 'Todas las sucursales' }] : []),
              ...branches.map(branch => ({ value: branch.id, label: branch.name })),
            ]}
            disabled={!canSeeAllCompanyUsers && !isCollector}
            isOpen={openFilter === 'branch'}
            onToggle={() => setOpenFilter(current => (current === 'branch' ? null : 'branch'))}
            onRequestClose={() => setOpenFilter(null)}
          />

          <ReportFilterDropdown
            value={selectedCollectorId}
            onChange={setSelectedCollectorId}
            placeholder={isCollector ? currentUser.name : 'Todos los cobradores'}
            options={[
              ...(!isCollector ? [{ value: '', label: 'Todos los cobradores' }] : []),
              ...scopedCollectors.map(collector => ({ value: collector.id, label: collector.name })),
            ]}
            disabled={isCollector}
            isOpen={openFilter === 'collector'}
            onToggle={() => setOpenFilter(current => (current === 'collector' ? null : 'collector'))}
            onRequestClose={() => setOpenFilter(null)}
          />

          <ReportFilterDropdown
            value={activeTab}
            onChange={value => setActiveTab(value as ReportTab)}
            placeholder="Tipo de reporte"
            options={reportTabs.map(tab => ({ value: tab.key, label: tab.label }))}
            isOpen={openFilter === 'report'}
            onToggle={() => setOpenFilter(current => (current === 'report' ? null : 'report'))}
            onRequestClose={() => setOpenFilter(null)}
          />

          <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD] focus-within:shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
            <Search size={18} className="text-[#6B7280]" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, cedula o telefono"
              className="w-full bg-transparent text-[15px] font-semibold text-[#111827] outline-none placeholder:text-[#94A3B8]"
            />
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className={`inline-flex h-[56px] min-w-[176px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#374151] ${horizontalMotionClass}`}
          >
            <Filter size={18} />
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-6">
        {kpiCards.map(card => {
          const tone = kpiToneMap[card.tone];
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="relative min-h-[210px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${tone.iconWrap}`}>
                  <Icon size={24} />
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#64748B]">
                    {card.share.toFixed(1)}%
                  </span>
                  <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Participacion</p>
                  <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">{card.share.toFixed(1)}%</p>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <p className="text-[17px] font-semibold text-[#111827]">{card.label}</p>
                <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{card.value}</p>
                <p className={`max-w-[200px] text-[15px] font-medium leading-6 ${tone.note}`}>{card.helper}</p>
              </div>

              <Icon size={64} className={`pointer-events-none absolute bottom-3 right-3 ${tone.watermark} opacity-50`} strokeWidth={1.6} />
            </article>
          );
        })}
      </section>

      <section className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Centro de reportes</h2>
              <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[13px] font-semibold text-[#64748B]">
                {activeBranch?.name || 'Vista consolidada'}
              </span>
            </div>
            <p className="mt-2 text-[15px] font-medium text-[#64748B]">
              Estructura premium basada en las plantillas de resumen, financiero, operativo y exportaciones.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {reportTabs.map(tab => {
              const active = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setOpenFilter(null);
                  }}
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

        <div className="p-6">
          {activeTab === 'SUMMARY' && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Tendencia de cobros</h3>
                      <p className="mt-2 text-[14px] font-medium text-[#64748B]">Capital, interes y mora cobrados segun el periodo seleccionado.</p>
                    </div>
                    <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[13px] font-semibold text-[#64748B]">
                      {period === 'TODAY' ? 'Hoy' : period === 'THIS_MONTH' ? 'Este mes' : period === 'LAST_MONTH' ? 'Mes pasado' : 'Total'}
                    </span>
                  </div>
                  <div className="mt-6 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                        <YAxis hide />
                        <Tooltip content={<PremiumChartTooltip />} wrapperStyle={{ zIndex: 80, pointerEvents: 'none' }} />
                        <Bar dataKey="collected" name="Capital" radius={[6, 6, 0, 0]} fill="#2563EB" />
                        <Bar dataKey="interest" name="Interes" radius={[6, 6, 0, 0]} fill="#22C55E" />
                        <Bar dataKey="mora" name="Mora" radius={[6, 6, 0, 0]} fill="#F97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Distribucion de ingresos</h3>
                  <p className="mt-2 text-[14px] font-medium text-[#64748B]">Composicion aproximada del flujo economico actual.</p>
                  <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-1">
                    <div className="relative mx-auto h-[236px] w-[236px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={compositionData} dataKey="value" innerRadius={64} outerRadius={88} paddingAngle={3}>
                            {compositionData.map(item => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<PremiumChartTooltip />} wrapperStyle={{ zIndex: 80, pointerEvents: 'none' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[13px] font-semibold text-[#64748B]">RD$</p>
                        <p className="text-[24px] font-black tracking-tight text-[#111827]">
                          {formatCompactCurrency(compositionData.reduce((acc, item) => acc + item.value, 0))}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">Total</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {compositionData.map(item => (
                        <div key={item.name} className="flex items-center justify-between rounded-[20px] border border-[#F1F5F9] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-[14px] font-semibold text-[#374151]">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-bold text-[#111827]">{formatCurrency(item.value)}</p>
                            <p className="text-[12px] font-semibold text-[#94A3B8]">{item.share}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Actividad reciente de reportes</h3>
                      <p className="mt-2 text-[14px] font-medium text-[#64748B]">Ultimos cortes operativos y consolidaciones generadas.</p>
                    </div>
                    <button type="button" className={`inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                      Ver historial
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[2fr_1fr_1.4fr_1.3fr_1fr] gap-4 border-b border-[#EEF2F7] px-2 pb-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                        <span>Reporte</span>
                        <span>Tipo</span>
                        <span>Rango</span>
                        <span>Generado por</span>
                        <span>Formato</span>
                      </div>
                      <div className="divide-y divide-[#EEF2F7]">
                        {summaryActivity.items.map(item => (
                          <div key={item.name} className="grid grid-cols-[2fr_1fr_1.4fr_1.3fr_1fr] gap-4 px-2 py-4">
                            <span className="text-[14px] font-semibold text-[#111827]">{item.name}</span>
                            <span className="text-[14px] font-medium text-[#64748B]">{item.type}</span>
                            <span className="text-[14px] font-medium text-[#64748B]">{item.range}</span>
                            <span className="text-[14px] font-medium text-[#64748B]">{item.owner}</span>
                            <span className="text-[14px] font-bold text-[#2563EB]">{item.format}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <PanelPagination
                    page={summaryActivity.page}
                    totalPages={summaryActivity.totalPages}
                    totalItems={exportActivity.length}
                    pageSize={5}
                    onChange={setSummaryActivityPage}
                  />
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Alertas operativas</h3>
                  <p className="mt-2 text-[14px] font-medium text-[#64748B]">Lectura priorizada para seguimiento inmediato.</p>
                  <div className="mt-5 space-y-3">
                    <AlertRow label="Clientes con mas de 30 dias de atraso" detail="Requieren accion inmediata" value={reportData.inMora.length.toString()} tone="red" />
                    <AlertRow label="Recibos anulados en el periodo" detail="Impactan consistencia financiera" value={`${apiSummary?.payments.voidedPayments ?? 0}`} tone="amber" />
                    <AlertRow label="Rutas cerradas" detail="Seguimiento al rendimiento operativo" value={`${apiSummary?.routes.closedRoutes ?? 0}`} tone="blue" />
                    <AlertRow label="Prestamos activos al dia" detail="Base saludable de cartera" value={`${reportData.actives.length}`} tone="green" />
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'FINANCIAL' && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Capital vs interes vs mora</h3>
                  <p className="mt-2 text-[14px] font-medium text-[#64748B]">Monitorea la mezcla financiera del periodo contra el volumen de cobro.</p>
                  <div className="mt-6 h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} />
                        <YAxis hide />
                        <Tooltip content={<PremiumChartTooltip />} wrapperStyle={{ zIndex: 80, pointerEvents: 'none' }} />
                        <Bar dataKey="collected" name="Capital cobrado" radius={[6, 6, 0, 0]} fill="#2563EB" />
                        <Bar dataKey="interest" name="Interes cobrado" radius={[6, 6, 0, 0]} fill="#22C55E" />
                        <Bar dataKey="mora" name="Mora cobrada" radius={[6, 6, 0, 0]} fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Composicion financiera</h3>
                  <p className="mt-2 text-[14px] font-medium text-[#64748B]">Equilibrio entre capital, interes, mora y otros ingresos.</p>
                  <div className="mt-6 space-y-5">
                    <div className="relative mx-auto h-[236px] w-[236px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={compositionData} dataKey="value" innerRadius={64} outerRadius={88} paddingAngle={3}>
                            {compositionData.map(item => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<PremiumChartTooltip />} wrapperStyle={{ zIndex: 80, pointerEvents: 'none' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[13px] font-semibold text-[#64748B]">RD$</p>
                        <p className="text-[24px] font-black tracking-tight text-[#111827]">
                          {formatCompactCurrency(compositionData.reduce((acc, item) => acc + item.value, 0))}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">Total</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {compositionData.map(item => (
                        <MetricRow key={item.name} label={item.name} value={formatCurrency(item.value)} accentColor={item.color} percent={item.share} />
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Desglose financiero por sucursal</h3>
                      <p className="mt-2 text-[14px] font-medium text-[#64748B]">Capital, interes y mora agrupados por sede.</p>
                    </div>
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <div className="min-w-[720px]">
                      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 border-b border-[#EEF2F7] px-2 pb-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                        <span>Sucursal</span>
                        <span>Capital</span>
                        <span>Interes</span>
                        <span>Mora</span>
                        <span>Total</span>
                      </div>
                      <div className="divide-y divide-[#EEF2F7]">
                        {financialBreakdownPageData.items.map(item => (
                          <div key={item.branch.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 px-2 py-4">
                            <span className="text-[14px] font-semibold text-[#111827]">{item.branch.name}</span>
                            <span className="text-[14px] font-medium text-[#64748B]">{formatCurrency(item.capital)}</span>
                            <span className="text-[14px] font-medium text-[#64748B]">{formatCurrency(item.interest)}</span>
                            <span className="text-[14px] font-medium text-[#64748B]">{formatCurrency(item.mora)}</span>
                            <span className="text-[14px] font-bold text-[#2563EB]">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <PanelPagination
                    page={financialBreakdownPageData.page}
                    totalPages={financialBreakdownPageData.totalPages}
                    totalItems={financialBreakdown.length}
                    pageSize={5}
                    onChange={setFinancialBreakdownPage}
                  />
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Movimientos financieros recientes</h3>
                      <p className="mt-2 text-[14px] font-medium text-[#64748B]">Ultimos recibos y cobros reflejados en el periodo.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {recentFinancialMovements.length === 0 ? (
                      <EmptyState label="No hay movimientos recientes para mostrar." compact />
                    ) : (
                      financialMovementsPageData.items.map(item => (
                        <div key={item.id} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[15px] font-bold text-[#111827]">{item.concept}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#64748B]">{item.origin} · {formatDate(item.date)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[15px] font-bold text-[#2563EB]">{formatCurrency(item.amount)}</p>
                              <p className="mt-1 text-[12px] font-semibold text-[#16A34A]">{item.status}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <PanelPagination
                    page={financialMovementsPageData.page}
                    totalPages={financialMovementsPageData.totalPages}
                    totalItems={recentFinancialMovements.length}
                    pageSize={5}
                    onChange={setFinancialMovementsPage}
                  />
                </section>
              </div>
            </div>
          )}

          {activeTab === 'OPERATIONAL' && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_420px]">
                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Estado de clientes</h3>
                  <p className="mt-2 text-[14px] font-medium text-[#64748B]">Distribucion operativa entre cartera saludable, atrasada y saldada.</p>
                  <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="relative mx-auto h-[240px] w-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={operationalStatusData} dataKey="value" innerRadius={60} outerRadius={84} paddingAngle={3}>
                            {operationalStatusData.map(item => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<PremiumChartTooltip />} wrapperStyle={{ zIndex: 80, pointerEvents: 'none' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[28px] font-black tracking-tight text-[#111827]">{scopedClients.length}</p>
                        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">Clientes</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {operationalStatusData.map(item => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-[20px] border border-[#F1F5F9] px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-[14px] font-semibold text-[#374151]">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-bold text-[#111827]">{item.value.toLocaleString()}</p>
                            <p className="text-[12px] font-semibold text-[#94A3B8]">{item.share}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Salud de cartera</h3>
                      <p className="mt-2 text-[14px] font-medium text-[#64748B]">Accesos rapidos por estado de prestamos.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {operationalStatusData.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setDrillDownType(item.name === 'Al dia' ? 'ACTIVOS' : item.name === 'Saldados' ? 'SALDADOS' : 'MORA')}
                        className={`flex w-full items-center justify-between rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-4 text-left ${horizontalMotionClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <div>
                            <p className="text-[15px] font-bold text-[#111827]">{item.name}</p>
                            <p className="mt-1 text-[13px] font-medium text-[#64748B]">Ver prestamos relacionados</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-bold text-[#111827]">{item.value}</span>
                          <ChevronRight size={16} className="text-[#94A3B8]" />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Clientes en riesgo</h3>
                      <p className="mt-2 text-[14px] font-medium text-[#64748B]">Priorizacion por dias de atraso y saldo pendiente.</p>
                    </div>
                    <button type="button" className={`inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                      Ver todos
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="mt-5 space-y-3">
                    {overdueClients.length === 0 ? (
                      <EmptyState label="No hay clientes en riesgo para mostrar." compact />
                    ) : (
                      overdueClientsPageData.items.map(item => (
                        <div key={item.loan.id} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[15px] font-bold text-[#111827]">
                                {item.client ? `${item.client.firstName} ${item.client.lastName}` : item.loan.clientId}
                              </p>
                              <p className="mt-1 text-[13px] font-medium text-[#64748B]">
                                {item.lateDays} dias de atraso · saldo {formatCurrency(item.loan.balance)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => item.client && navigate(`/clients/${item.client.id}`)}
                              className={`inline-flex h-10 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                            >
                              Ver perfil
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <PanelPagination
                    page={overdueClientsPageData.page}
                    totalPages={overdueClientsPageData.totalPages}
                    totalItems={overdueClients.length}
                    pageSize={5}
                    onChange={setOperationalRiskPage}
                  />
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Cumplimiento operativo</h3>
                  <p className="mt-2 text-[14px] font-medium text-[#64748B]">Indicadores rapidos de ejecucion sobre la cartera visible.</p>
                  <div className="mt-6 space-y-5">
                    <MetricRow label="Prestamos al dia" value={`${reportData.actives.length}`} accentColor="#16A34A" percent={scopedLoans.length > 0 ? Math.round((reportData.actives.length / scopedLoans.length) * 100) : 0} />
                    <MetricRow label="Prestamos en mora" value={`${reportData.inMora.length}`} accentColor="#DC2626" percent={scopedLoans.length > 0 ? Math.round((reportData.inMora.length / scopedLoans.length) * 100) : 0} />
                    <MetricRow label="Prestamos saldados" value={`${reportData.finished.length}`} accentColor="#2563EB" percent={scopedLoans.length > 0 ? Math.round((reportData.finished.length / scopedLoans.length) * 100) : 0} />
                    <MetricRow label="Rutas cerradas" value={`${apiSummary?.routes.closedRoutes ?? 0}/${apiSummary?.routes.totalRoutes ?? 0}`} accentColor="#7C3AED" percent={apiSummary?.routes.totalRoutes ? Math.round((apiSummary.routes.closedRoutes / apiSummary.routes.totalRoutes) * 100) : 0} />
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'EXPORTS' && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                <div className="flex flex-col gap-3 border-b border-[#EEF2F7] pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Accesos de exportacion</h3>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">
                      Elige una accion principal y trabaja el detalle dentro de su modal, manteniendo esta vista limpia.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReportsSubview('preview')}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                  >
                    Abrir vista previa
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {exportCards.map(card => {
                    const Icon = card.icon;
                    const isPrimary = card.workspace === 'PDF';
                    const subviewTarget =
                      card.workspace === 'PREVIEW'
                        ? 'preview'
                        : card.workspace === 'TEMPLATE'
                          ? 'templates'
                          : card.workspace === 'DOCUMENTS'
                            ? 'documents'
                            : null;
                    return (
                      <button
                        key={card.title}
                        type="button"
                        onClick={() => {
                          if (subviewTarget) {
                            openReportsSubview(subviewTarget);
                            return;
                          }
                          setExportWorkspace(card.workspace);
                        }}
                        className={`group flex min-h-[132px] items-center justify-between gap-4 rounded-[26px] border p-5 text-left transition-all duration-200 ${
                          isPrimary
                            ? 'border-[#BFDBFE] bg-[#EFF6FF] shadow-[0_16px_36px_rgba(37,99,235,0.10)] hover:-translate-y-1 hover:bg-[#E8F1FF]'
                            : 'border-[#E5E7EB] bg-white shadow-sm hover:-translate-y-1 hover:border-[#DBEAFE] hover:bg-[#FCFDFF] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl ${isPrimary ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-[#2563EB]'}`}>
                            <Icon size={24} />
                          </div>
                          <div>
                            <h4 className="text-[22px] font-black tracking-tight text-[#111827]">{card.title}</h4>
                            <p className="mt-2 max-w-[360px] text-[14px] font-medium leading-6 text-[#64748B]">{card.detail}</p>
                          </div>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#94A3B8] transition-all duration-200 group-hover:border-[#DBEAFE] group-hover:text-[#2563EB]">
                          <ChevronRight size={18} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Centro de reportes</h3>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">
                      La vista principal se mantiene liviana; programaciones, plantillas, vista previa y compartir viven dentro de modales dedicados.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExportWorkspace('SCHEDULE')}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                    >
                      Programaciones
                      <ChevronRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openReportsSubview('templates')}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                    >
                      Plantillas
                      <ChevronRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openReportsSubview('documents')}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                    >
                      Documentos
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Historial de exportaciones</h3>
                    <p className="mt-2 text-[14px] font-medium text-[#64748B]">Ultimos archivos generados y listos para descarga o auditoria.</p>
                  </div>
                  <button type="button" onClick={() => openReportsSubview('preview')} className={`inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                    Abrir centro
                    <ChevronRight size={16} />
                  </button>
                </div>
                {exportHistoryRows.length ? (
                  <>
                    <div className="mt-5 overflow-x-auto">
                      <div className="min-w-[760px]">
                        <div className="grid grid-cols-[2fr_1fr_1.4fr_1.3fr_0.7fr_0.9fr] gap-4 border-b border-[#EEF2F7] px-2 pb-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                          <span>Reporte</span>
                          <span>Tipo</span>
                          <span>Rango</span>
                          <span>Generado por</span>
                          <span>Formato</span>
                          <span>Accion</span>
                        </div>
                        <div className="divide-y divide-[#EEF2F7]">
                          {exportsActivityPageData.items.map(item => (
                            <div key={`${item.id || item.name}-${item.date}`} className="grid grid-cols-[2fr_1fr_1.4fr_1.3fr_0.7fr_0.9fr] gap-4 px-2 py-4">
                              <div>
                                <span className="text-[14px] font-semibold text-[#111827]">{item.name}</span>
                                <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{item.date}</p>
                              </div>
                              <span className="text-[14px] font-medium text-[#64748B]">{item.type}</span>
                              <span className="text-[14px] font-medium text-[#64748B]">{item.range}</span>
                              <span className="text-[14px] font-medium text-[#64748B]">{item.owner}</span>
                              <span className="text-[14px] font-bold text-[#2563EB]">{item.format}</span>
                              <button
                                type="button"
                                onClick={() => handleHistoryRegenerate(item)}
                                disabled={exportingFormat === item.format}
                                className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Regenerar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <PanelPagination
                      page={exportsActivityPageData.page}
                      totalPages={exportsActivityPageData.totalPages}
                      totalItems={exportHistoryRows.length}
                      pageSize={5}
                      onChange={setExportsActivityPage}
                    />
                  </>
                ) : (
                  <div className="mt-5">
                    <EmptyState label="Aun no hay exportaciones registradas. Cuando generes un PDF o CSV desde este centro, el historial persistido aparecerá aqui." />
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>

      {exportWorkspace && (
        <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-[940px] flex-col overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-8 py-7">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Exportaciones</p>
                <h3 className="mt-2 text-[26px] font-black tracking-tight text-[#111827]">
                  {exportWorkspace === 'PDF'
                    ? 'Exportar PDF'
                    : exportWorkspace === 'CSV'
                      ? 'Exportar CSV'
                      : exportWorkspace === 'SCHEDULE'
                        ? 'Programar reporte'
                        : exportWorkspace === 'TEMPLATE'
                          ? 'Editor de plantilla'
                          : exportWorkspace === 'SHARE'
                            ? 'Compartir reporte'
                            : 'Vista previa del reporte'}
                </h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">
                  {exportWorkspace === 'PDF'
                    ? 'Prepara una salida ejecutiva con portada, KPIs, graficos y tablas de respaldo.'
                    : exportWorkspace === 'CSV'
                      ? 'Define la descarga tabular para analisis financiero u operativo.'
                    : exportWorkspace === 'SCHEDULE'
                      ? 'Configura frecuencia, destinatarios y alcance del envio automatico.'
                    : exportWorkspace === 'TEMPLATE'
                      ? 'Organiza encabezado, bloques, orden y branding del documento.'
                      : exportWorkspace === 'DOCUMENTS'
                        ? 'Consulta recibos y documentos finales generados desde reportes y pagos.'
                      : exportWorkspace === 'SHARE'
                        ? 'Comparte un acceso rapido con liderazgo o stakeholders.'
                        : 'Revisa el armado del reporte antes de exportar o compartir.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExportWorkspace(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-7">
              {exportWorkspace === 'PREVIEW' && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_320px]">
                  <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                    {selectedDocumentPreview && selectedGeneratedDocument?.kind !== 'EXPORT' ? (
                      <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Vista previa del documento</p>
                        <div className="mt-4 rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-4 border-b border-[#EEF2F7] pb-5">
                            <div>
                              <h4 className="text-[30px] font-black tracking-tight text-[#111827]">{company?.name || 'PrestaFacil RD'}</h4>
                              <p className="mt-2 text-[14px] font-medium text-[#64748B]">{activeBranch?.name || 'Vista consolidada'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[26px] font-black tracking-tight text-[#111827]">{selectedDocumentPreview.title}</p>
                              <p className="mt-2 text-[15px] font-semibold text-[#64748B]">{selectedGeneratedDocument.reference}</p>
                            </div>
                          </div>

                          <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                              {selectedDocumentPreview.rows.slice(0, Math.ceil(selectedDocumentPreview.rows.length / 2)).map(([label, value]) => (
                                <InfoPill key={label} label={label} value={value} />
                              ))}
                            </div>
                            <div className="space-y-3">
                              {selectedDocumentPreview.rows.slice(Math.ceil(selectedDocumentPreview.rows.length / 2)).map(([label, value]) => (
                                <InfoPill key={label} label={label} value={value} />
                              ))}
                            </div>
                          </div>

                          <div className={`mt-6 rounded-[22px] px-5 py-4 ${
                            selectedDocumentPreview.accent === 'green'
                              ? 'border border-[#DCFCE7] bg-[#F0FDF4]'
                              : selectedDocumentPreview.accent === 'amber'
                                ? 'border border-[#FDE68A] bg-[#FFFBEB]'
                                : selectedDocumentPreview.accent === 'red'
                                  ? 'border border-[#FECACA] bg-[#FEF2F2]'
                                  : selectedDocumentPreview.accent === 'violet'
                                    ? 'border border-[#DDD6FE] bg-[#F5F3FF]'
                                    : 'border border-[#DBEAFE] bg-[#EFF6FF]'
                          }`}>
                            <div className="flex items-center justify-between gap-4">
                              <p className="text-[15px] font-black uppercase tracking-[0.18em] text-[#334155]">{selectedDocumentPreview.summaryLabel}</p>
                              <p className="text-[26px] font-black tracking-tight text-[#111827]">{selectedDocumentPreview.summaryValue}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : effectiveTemplateConfig.documentStyle === 'Recibo de pago' && sampleReceiptContext ? (
                      <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Vista previa del recibo</p>
                        <div className="mt-4 rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-4 border-b border-[#EEF2F7] pb-5">
                            <div>
                              <h4 className="text-[30px] font-black tracking-tight text-[#111827]">{company?.name || 'PrestaFacil RD'}</h4>
                              <p className="mt-2 text-[14px] font-medium text-[#64748B]">{activeBranch?.name || 'Vista consolidada'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[26px] font-black tracking-tight text-[#111827]">Recibo de pago</p>
                              <p className="mt-2 text-[15px] font-semibold text-[#16A34A]">{sampleReceiptContext.receiptNumber}</p>
                            </div>
                          </div>

                          <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                              <InfoPill label="Cliente" value={sampleReceiptContext.client ? `${sampleReceiptContext.client.firstName} ${sampleReceiptContext.client.lastName}` : 'Cliente'} />
                              <InfoPill label="Prestamo" value={sampleReceiptContext.loan?.id || sampleReceiptContext.payment.loanId} />
                              <InfoPill label="Fecha de pago" value={formatDate(sampleReceiptContext.payment.date)} />
                            </div>
                            <div className="space-y-3">
                              <InfoPill label="Capital" value={formatCurrency(sampleReceiptContext.payment.amount)} />
                              <InfoPill label="Mora" value={formatCurrency(sampleReceiptContext.payment.moraPaid)} />
                              <InfoPill label="Total pagado" value={formatCurrency(sampleReceiptContext.totalPaid)} />
                            </div>
                          </div>

                          <div className="mt-6 rounded-[22px] border border-[#DCFCE7] bg-[#F0FDF4] px-5 py-4">
                            <div className="flex items-center justify-between gap-4">
                              <p className="text-[15px] font-black uppercase tracking-[0.18em] text-[#166534]">Total pagado</p>
                              <p className="text-[26px] font-black tracking-tight text-[#16A34A]">{formatCurrency(sampleReceiptContext.totalPaid)}</p>
                            </div>
                          </div>

                          <div className="mt-6 grid gap-4 md:grid-cols-3">
                            {effectiveTemplateConfig.receiptOptions.showNextInstallment && sampleReceiptContext.nextInstallment && (
                              <div className="rounded-[20px] border border-[#EEF2F7] p-4">
                                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Proxima cuota</p>
                                <p className="mt-3 text-[15px] font-semibold text-[#111827]">{formatDate(sampleReceiptContext.nextInstallment.dueDate)}</p>
                              </div>
                            )}
                            {effectiveTemplateConfig.receiptOptions.showRemainingBalance && (
                              <div className="rounded-[20px] border border-[#EEF2F7] p-4">
                                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Saldo restante</p>
                                <p className="mt-3 text-[15px] font-semibold text-[#111827]">{formatCurrency(Math.max((sampleReceiptContext.loan?.balance || 0) - sampleReceiptContext.payment.amount, 0))}</p>
                              </div>
                            )}
                            {effectiveTemplateConfig.receiptOptions.includeSignature && (
                              <div className="rounded-[20px] border border-[#EEF2F7] p-4">
                                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Firma y sello</p>
                                <p className="mt-3 text-[15px] font-semibold text-[#111827]">{currentUser.name}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Vista previa del documento</p>
                        <div className="mt-4 rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                          <div className="flex items-center justify-between gap-4 border-b border-[#EEF2F7] pb-4">
                            <div>
                              <h4 className="text-[24px] font-black tracking-tight text-[#111827]">{effectiveTemplate?.name || 'Reporte ejecutivo'}</h4>
                              <p className="mt-1 text-[14px] font-medium text-[#64748B]">{company?.name || 'PrestaFacil RD'} · {activeBranch?.name || 'Vista consolidada'}</p>
                            </div>
                            <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">
                              {period === 'TODAY' ? 'Hoy' : period === 'THIS_MONTH' ? 'Este mes' : period === 'LAST_MONTH' ? 'Mes pasado' : 'Total'}
                            </span>
                          </div>
                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            {(effectiveTemplate?.sections?.length ? effectiveTemplate.sections : previewSections).map(section => (
                              <div key={section} className="rounded-[20px] border border-[#EEF2F7] p-4">
                                <p className="text-[15px] font-bold text-[#111827]">{section}</p>
                                <p className="mt-2 text-[13px] font-medium text-[#64748B]">Bloque incluido en la composicion del documento final.</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-5">
                    <SidebarCard title="Configuracion actual">
                      <InfoPill label="Formato" value="PDF" />
                      <InfoPill label="Sucursal" value={activeBranch?.name || 'Vista consolidada'} />
                      <InfoPill label="Cobrador" value={selectedCollectorId ? scopedCollectors.find(item => item.id === selectedCollectorId)?.name || 'Filtrado' : 'Todos'} />
                      <InfoPill label="Plantilla" value={effectiveTemplate?.name || 'Base del sistema'} />
                      <InfoPill label="Estilo" value={effectiveTemplateConfig.documentStyle} />
                      {selectedGeneratedDocument && <InfoPill label="Documento" value={selectedGeneratedDocument.type} />}
                    </SidebarCard>
                    <SidebarCard title="Proximo paso">
                      <StatusLine label="Documento listo para exportar" status="Preparado" tone="green" />
                      <StatusLine label="Motor PDF real" status="Fase 2" tone="amber" />
                    </SidebarCard>
                  </div>
                </div>
              )}

              {exportWorkspace === 'PDF' && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <SidebarCard title="Salida PDF">
                    <StatusLine label="Resumen ejecutivo premium" status="Incluido" tone="green" />
                    <StatusLine label="Graficos y tablas visibles" status="Incluido" tone="green" />
                    <StatusLine label="Branding y plantilla" status={effectiveTemplate?.name || 'Base'} tone="blue" />
                    <div className="mt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Plantilla activa</p>
                      <select
                        value={selectedTemplateId}
                        onChange={event => setSelectedTemplateId(event.target.value)}
                        className="mt-2 h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[14px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                      >
                        {reportTemplates.length ? (
                          reportTemplates.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))
                        ) : (
                          <option value="">Base del sistema</option>
                        )}
                      </select>
                    </div>
                  </SidebarCard>
                  <SidebarCard title="Accion">
                    <p className="text-[14px] font-medium text-[#64748B]">Genera una salida imprimible inmediata mientras cerramos el constructor completo del documento.</p>
                    <button
                      type="button"
                      onClick={handlePdfExport}
                      disabled={exportingFormat === 'PDF'}
                      className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exportingFormat === 'PDF' ? 'Preparando PDF...' : 'Generar PDF'}
                      <ChevronRight size={16} />
                    </button>
                    {exportWorkspace === 'PDF' && exportFeedback && <p className="mt-3 text-[13px] font-semibold text-[#2563EB]">{exportFeedback}</p>}
                  </SidebarCard>
                </div>
              )}

              {exportWorkspace === 'CSV' && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <SidebarCard title="Salida CSV">
                    <StatusLine label="Detalle tabular por reporte" status="Listo" tone="green" />
                    <StatusLine label="Campos exportables" status="Visible" tone="blue" />
                    <StatusLine label="Conector real de descarga" status="Activo" tone="green" />
                  </SidebarCard>
                  <SidebarCard title="Destino sugerido">
                    <p className="text-[14px] font-medium text-[#64748B]">Usa CSV para conciliacion, auditoria rápida y analisis externo.</p>
                    <button
                      type="button"
                      onClick={handleCsvExport}
                      disabled={exportingFormat === 'CSV'}
                      className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exportingFormat === 'CSV' ? 'Generando CSV...' : 'Descargar CSV'}
                      <ChevronRight size={16} />
                    </button>
                    {exportWorkspace === 'CSV' && exportFeedback && <p className="mt-3 text-[13px] font-semibold text-[#2563EB]">{exportFeedback}</p>}
                  </SidebarCard>
                </div>
              )}

              {exportWorkspace === 'SCHEDULE' && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_320px]">
                  <div className="space-y-5">
                    <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">
                            {editingTemplateId ? 'Editando plantilla' : 'Nueva plantilla'}
                          </p>
                          <p className="mt-1 text-[14px] font-medium text-[#64748B]">
                            {editingTemplateId ? 'Ajusta bloques, estado y uso principal antes de guardar.' : 'Crea variantes reutilizables para PDF y exportaciones.'}
                          </p>
                        </div>
                        {editingTemplateId && (
                          <button
                            type="button"
                            onClick={resetTemplateEditor}
                            className="inline-flex h-10 items-center rounded-2xl border border-[#E5E7EB] px-3 text-[13px] font-semibold text-[#111827] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                          >
                            Cancelar edicion
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Nombre</span>
                          <input
                            value={scheduleForm.name}
                            onChange={event => setScheduleForm(current => ({ ...current, name: event.target.value }))}
                            placeholder={`${activeReportLabel} programado`}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Frecuencia</span>
                          <select
                            value={scheduleForm.frequency}
                            onChange={event => setScheduleForm(current => ({ ...current, frequency: event.target.value }))}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          >
                            <option>Diario</option>
                            <option>Semanal</option>
                            <option>Quincenal</option>
                            <option>Mensual</option>
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Formato</span>
                          <select
                            value={scheduleForm.format}
                            onChange={event => setScheduleForm(current => ({ ...current, format: event.target.value as 'PDF' | 'CSV' }))}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          >
                            <option value="PDF">PDF</option>
                            <option value="CSV">CSV</option>
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Hora</span>
                          <input
                            value={scheduleForm.deliveryHour}
                            onChange={event => setScheduleForm(current => ({ ...current, deliveryHour: event.target.value }))}
                            placeholder="08:00"
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Destino</span>
                          <input
                            value={scheduleForm.targetLabel}
                            onChange={event => setScheduleForm(current => ({ ...current, targetLabel: event.target.value }))}
                            placeholder="Gerencia general"
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateSchedule}
                        disabled={savingSchedule}
                        className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingSchedule ? 'Guardando...' : 'Guardar programacion'}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <SidebarCard title="Programaciones activas">
                    {scheduledReports.length ? (
                      scheduledReports.map(item => (
                        <div key={item.id} className="rounded-[22px] border border-[#E5E7EB] bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[15px] font-bold text-[#111827]">{item.name}</p>
                            <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">{item.format}</span>
                          </div>
                          <p className="mt-2 text-[13px] font-medium text-[#64748B]">{item.frequency} · {item.deliveryHour}</p>
                          <p className="mt-1 text-[13px] font-medium text-[#94A3B8]">{item.targetLabel}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState label="Aun no hay programaciones guardadas." compact />
                    )}
                  </SidebarCard>
                </div>
              )}

              {exportWorkspace === 'TEMPLATE' && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_320px]">
                  <div className="space-y-5">
                    <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">
                            {editingTemplateId ? 'Editando plantilla' : 'Nueva plantilla'}
                          </p>
                          <p className="mt-1 text-[14px] font-medium text-[#64748B]">
                            Configura documento, estilo y opciones del recibo sin salir del centro de reportes.
                          </p>
                        </div>
                        {editingTemplateId && (
                          <button
                            type="button"
                            onClick={resetTemplateEditor}
                            className="inline-flex h-10 items-center rounded-2xl border border-[#E5E7EB] px-3 text-[13px] font-semibold text-[#111827] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                          >
                            Cancelar edicion
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Nombre de plantilla</span>
                          <input
                            value={templateForm.name}
                            onChange={event => setTemplateForm(current => ({ ...current, name: event.target.value }))}
                            placeholder={`${activeReportLabel} premium`}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Estado</span>
                          <select
                            value={templateForm.status}
                            onChange={event => setTemplateForm(current => ({ ...current, status: event.target.value }))}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          >
                            <option>Activo</option>
                            <option>Listo</option>
                            <option>Borrador</option>
                          </select>
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Descripcion</span>
                          <input
                            value={templateForm.description}
                            onChange={event => setTemplateForm(current => ({ ...current, description: event.target.value }))}
                            placeholder="Describe el enfoque del documento o recibo."
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-medium text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Tamano</span>
                          <select
                            value={templateForm.paperSize}
                            onChange={event => setTemplateForm(current => ({ ...current, paperSize: event.target.value as 'A4' | 'Carta' | 'Oficio' }))}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          >
                            <option>A4</option>
                            <option>Carta</option>
                            <option>Oficio</option>
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Orientacion</span>
                          <select
                            value={templateForm.orientation}
                            onChange={event => setTemplateForm(current => ({ ...current, orientation: event.target.value as 'Vertical' | 'Horizontal' }))}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          >
                            <option>Vertical</option>
                            <option>Horizontal</option>
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Margenes</span>
                          <select
                            value={templateForm.marginPreset}
                            onChange={event => setTemplateForm(current => ({ ...current, marginPreset: event.target.value as 'Compacto' | 'Normal' | 'Amplio' }))}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          >
                            <option>Compacto</option>
                            <option>Normal</option>
                            <option>Amplio</option>
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Estilo del documento</span>
                          <select
                            value={templateForm.documentStyle}
                            onChange={event => setTemplateForm(current => ({ ...current, documentStyle: event.target.value as 'Reporte premium' | 'Recibo de pago' }))}
                            className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                          >
                            <option>Reporte premium</option>
                            <option>Recibo de pago</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-3 rounded-[22px] border border-[#E5E7EB] px-4 py-3 md:col-span-2">
                          <input
                            type="checkbox"
                            checked={templateForm.isDefault}
                            onChange={event => setTemplateForm(current => ({ ...current, isDefault: event.target.checked }))}
                          />
                          <span className="text-[14px] font-semibold text-[#111827]">Usar como plantilla principal</span>
                        </label>
                      </div>

                      <div className="mt-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Bloques del documento</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {previewSections.map(section => {
                            const active = templateForm.sections.includes(section);
                            return (
                              <button
                                key={section}
                                type="button"
                                onClick={() => toggleTemplateSection(section)}
                                className={`rounded-[22px] border px-4 py-3 text-left text-[14px] font-semibold transition-all duration-200 ${
                                  active
                                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                                    : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#DBEAFE] hover:bg-[#F8FAFC]'
                                }`}
                              >
                                {section}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-5 rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Opciones del recibo</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3">
                            <span className="text-[14px] font-semibold text-[#111827]">Proxima cuota</span>
                            <input
                              type="checkbox"
                              checked={templateForm.receiptOptions.showNextInstallment}
                              onChange={event =>
                                setTemplateForm(current => ({
                                  ...current,
                                  receiptOptions: { ...current.receiptOptions, showNextInstallment: event.target.checked },
                                }))
                              }
                            />
                          </label>
                          <label className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3">
                            <span className="text-[14px] font-semibold text-[#111827]">Saldo restante</span>
                            <input
                              type="checkbox"
                              checked={templateForm.receiptOptions.showRemainingBalance}
                              onChange={event =>
                                setTemplateForm(current => ({
                                  ...current,
                                  receiptOptions: { ...current.receiptOptions, showRemainingBalance: event.target.checked },
                                }))
                              }
                            />
                          </label>
                          <label className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3">
                            <span className="text-[14px] font-semibold text-[#111827]">Firma</span>
                            <input
                              type="checkbox"
                              checked={templateForm.receiptOptions.includeSignature}
                              onChange={event =>
                                setTemplateForm(current => ({
                                  ...current,
                                  receiptOptions: { ...current.receiptOptions, includeSignature: event.target.checked },
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateTemplate}
                        disabled={savingTemplate}
                        className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingTemplate ? 'Guardando...' : editingTemplateId ? 'Actualizar plantilla' : 'Guardar plantilla'}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <SidebarCard title="Vista previa de recibo">
                      {sampleReceiptContext ? (
                        <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[16px] font-black text-[#111827]">{company?.name || 'PrestaFacil RD'}</p>
                              <p className="mt-1 text-[12px] font-medium text-[#64748B]">{templateForm.documentStyle}</p>
                            </div>
                            <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-semibold text-[#16A34A]">Vista</span>
                          </div>
                          <div className="mt-4 space-y-2 text-[13px] font-medium text-[#334155]">
                            <div className="flex items-center justify-between gap-3">
                              <span>Cliente</span>
                              <span className="font-semibold text-[#111827]">{sampleReceiptContext.client ? `${sampleReceiptContext.client.firstName} ${sampleReceiptContext.client.lastName}` : 'Cliente'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Recibo</span>
                              <span className="font-semibold text-[#111827]">{sampleReceiptContext.receiptNumber}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Total</span>
                              <span className="font-semibold text-[#16A34A]">{formatCurrency(sampleReceiptContext.totalPaid)}</span>
                            </div>
                            {templateForm.receiptOptions.showRemainingBalance && (
                              <div className="flex items-center justify-between gap-3">
                                <span>Saldo restante</span>
                                <span className="font-semibold text-[#111827]">{formatCurrency(Math.max((sampleReceiptContext.loan?.balance || 0) - sampleReceiptContext.payment.amount, 0))}</span>
                              </div>
                            )}
                            {templateForm.receiptOptions.showNextInstallment && sampleReceiptContext.nextInstallment && (
                              <div className="flex items-center justify-between gap-3">
                                <span>Proxima cuota</span>
                                <span className="font-semibold text-[#111827]">{formatDate(sampleReceiptContext.nextInstallment.dueDate)}</span>
                              </div>
                            )}
                          </div>
                          {templateForm.receiptOptions.includeSignature && (
                            <div className="mt-5 border-t border-dashed border-[#CBD5E1] pt-4 text-center">
                              <p className="text-[12px] font-semibold text-[#111827]">{currentUser?.name || 'Administrador'}</p>
                              <p className="text-[11px] font-medium text-[#94A3B8]">Firma y sello</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <EmptyState label="Aun no hay pagos disponibles para construir la vista previa del recibo." compact />
                      )}
                    </SidebarCard>

                    <SidebarCard title="Campos disponibles">
                      <div className="space-y-3">
                        {templateFieldGroups.map(group => (
                          <div key={group.title} className="rounded-[20px] border border-[#E5E7EB] bg-white p-4">
                            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{group.title}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.items.map(item => (
                                <span key={item} className="rounded-full border border-[#DBEAFE] bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#2563EB]">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </SidebarCard>

                    <SidebarCard title="Plantillas disponibles">
                      {reportTemplates.length ? (
                        reportTemplates.map(item => (
                          <div key={item.id} className="rounded-[22px] border border-[#E5E7EB] bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[15px] font-bold text-[#111827]">{item.name}</p>
                              <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#64748B]">{item.status}</span>
                            </div>
                            <p className="mt-2 text-[13px] font-medium text-[#64748B]">{item.config?.documentStyle || item.reportType}</p>
                            <p className="mt-1 text-[13px] font-medium text-[#94A3B8]">{item.sections.length} bloques activos{item.isDefault ? ' · Principal' : ''}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedTemplateId(item.id)}
                                className={`inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-[13px] font-semibold transition-all duration-200 ${
                                  selectedTemplateId === item.id
                                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                                    : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                                }`}
                              >
                                {selectedTemplateId === item.id ? 'Plantilla en uso' : 'Usar en PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditTemplate(item)}
                                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#111827] transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                              >
                                Editar plantilla
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState label="Aun no hay plantillas guardadas." compact />
                      )}
                    </SidebarCard>
                  </div>
                </div>
              )}

              {exportWorkspace === 'SHARE' && (
                <div className="space-y-5">
                  <SidebarCard title="Compartir reporte">
                    <StatusLine label="Enlace temporal" status="Pendiente" tone="amber" />
                    <StatusLine label="Permisos por rol" status="Fase 3" tone="blue" />
                    <StatusLine label="Historial de acceso" status="Fase 3" tone="blue" />
                  </SidebarCard>
                </div>
              )}

              {exportWorkspace === 'DOCUMENTS' && (
                <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
                  <SidebarCard title="Filtros">
                    <label className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Tipo de documento</span>
                      <select
                        value={documentTypeFilter}
                        onChange={event => setDocumentTypeFilter(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[14px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                      >
                        <option value="ALL">Todos</option>
                        <option value="PAYMENT_RECEIPT">Recibo de pago</option>
                        <option value="PARTIAL_PAYMENT">Pago parcial</option>
                        <option value="PAYMENT_PROMISE">Promesa de pago</option>
                        <option value="MORA_NOTICE">Mora</option>
                        <option value="ACCOUNT_STATEMENT">Estado de cuenta</option>
                        <option value="CASH_CLOSURE">Cierre de caja</option>
                        <option value="EXPORT">Exportados</option>
                      </select>
                    </label>
                    <label className="mt-4 space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Estado</span>
                      <select
                        value={documentStatusFilter}
                        onChange={event => setDocumentStatusFilter(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#E5E7EB] px-4 text-[14px] font-semibold text-[#111827] outline-none transition focus:border-[#93C5FD]"
                      >
                        <option value="ALL">Todos</option>
                        <option value="Generado">Generado</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Cumplida">Cumplida</option>
                        <option value="Incumplida">Incumplida</option>
                        <option value="Cuadrado">Cuadrado</option>
                        <option value="Con diferencia">Con diferencia</option>
                      </select>
                    </label>
                    <div className="mt-4">
                      <InfoPill label="Sucursal" value={activeBranch?.name || 'Todas las sucursales'} />
                    </div>
                    <div className="mt-3">
                      <InfoPill label="Periodo" value={rangeLabelByPeriod[period]} />
                    </div>
                    <button
                      type="button"
                      onClick={resetDocumentFilters}
                      className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                    >
                      <Filter size={16} />
                      Limpiar filtros
                    </button>
                  </SidebarCard>

                  <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                    <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F7] pb-4">
                      <div>
                        <h4 className="text-[22px] font-black tracking-tight text-[#111827]">Documentos generados</h4>
                        <p className="mt-1 text-[14px] font-medium text-[#64748B]">Recibos, reportes y salidas finales registradas en el sistema.</p>
                      </div>
                      <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold text-[#64748B]">
                        {filteredGeneratedDocuments.length} visibles
                      </span>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <div className="min-w-[760px]">
                        <div className="grid grid-cols-[1.25fr_1.1fr_1.2fr_1fr_0.8fr_0.8fr] gap-4 border-b border-[#EEF2F7] px-2 pb-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                          <span>Tipo</span>
                          <span>Cliente</span>
                          <span>Referencia</span>
                          <span>Fecha</span>
                          <span>Canal</span>
                          <span>Formato</span>
                        </div>
                        <div className="divide-y divide-[#EEF2F7]">
                          {documentsPageData.items.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedGeneratedDocumentId(item.id)}
                              className={`grid w-full grid-cols-[1.25fr_1.1fr_1.2fr_1fr_0.8fr_0.8fr] gap-4 px-2 py-4 text-left transition-colors ${
                                selectedGeneratedDocumentId === item.id ? 'bg-[#F8FAFC]' : 'hover:bg-[#FCFDFF]'
                              }`}
                            >
                              <div>
                                <span className="text-[14px] font-semibold text-[#111827]">{item.type}</span>
                                <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{item.status}</p>
                              </div>
                              <span className="text-[14px] font-medium text-[#64748B]">{item.clientName}</span>
                              <span className="text-[14px] font-medium text-[#64748B]">{item.reference}</span>
                              <span className="text-[14px] font-medium text-[#64748B]">{item.date}</span>
                              <span className="text-[14px] font-medium text-[#64748B]">{item.channel}</span>
                              <span className="text-[14px] font-bold text-[#2563EB]">{item.format}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <PanelPagination
                      page={documentsPageData.page}
                      totalPages={documentsPageData.totalPages}
                      totalItems={filteredGeneratedDocuments.length}
                      pageSize={10}
                      onChange={setDocumentsPage}
                    />
                  </div>

                  <div className="space-y-5">
                    <SidebarCard title="Documento seleccionado">
                      {selectedGeneratedDocument && selectedDocumentPreview ? (
                        <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[16px] font-black text-[#111827]">{selectedDocumentPreview.title}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#64748B]">{selectedGeneratedDocument.reference}</p>
                            </div>
                            <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-semibold text-[#16A34A]">{selectedGeneratedDocument.status}</span>
                          </div>

                          <div className="mt-4 rounded-[22px] border border-[#EEF2F7] bg-[#F8FAFC] p-4">
                            <div className="space-y-2 text-[13px] font-medium text-[#334155]">
                              {selectedDocumentPreview.rows.slice(0, 4).map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-3">
                                  <span>{label}</span>
                                  <span className="font-semibold text-[#111827]">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 rounded-[18px] border border-[#E5E7EB] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{selectedDocumentPreview.summaryLabel}</span>
                              <span className="text-[15px] font-bold text-[#111827]">{selectedDocumentPreview.summaryValue}</span>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <button
                              type="button"
                              onClick={() => setExportWorkspace('PREVIEW')}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                            >
                              Vista previa
                            </button>
                            <button
                              type="button"
                              onClick={handlePdfExport}
                              disabled={exportingFormat === 'PDF'}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-[14px] font-semibold text-white transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Descargar PDF
                            </button>
                            <button
                              type="button"
                              onClick={handlePrintDocument}
                              disabled={exportingFormat === 'PDF'}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Imprimir
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleShareDocument('WHATSAPP')}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#BBF7D0] bg-white px-4 text-[14px] font-semibold text-[#16A34A] transition-all duration-200 hover:translate-x-1 hover:bg-[#F0FDF4]"
                            >
                              Compartir por WhatsApp
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleShareDocument('EMAIL')}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                            >
                              Enviar por correo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <EmptyState label="Aun no hay documentos disponibles." compact />
                      )}
                    </SidebarCard>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {drillDownType && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[84vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-8 py-7">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Detalle operativo</p>
                <h3 className="mt-2 text-[26px] font-black tracking-tight text-[#111827]">
                  {drillDownType === 'MORA' ? 'Prestamos en mora' : drillDownType === 'ACTIVOS' ? 'Prestamos al dia' : 'Prestamos saldados'}
                </h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Consulta segmentada desde el modulo premium de reportes.</p>
              </div>
              <button
                type="button"
                onClick={() => setDrillDownType(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-8 py-7">
              {getDrillDownList().length === 0 ? (
                <EmptyState label="No hay registros en esta categoria." compact />
              ) : (
                getDrillDownList().map(loan => {
                  const client = scopedClients.find(item => item.id === loan.clientId);
                  return (
                    <div key={loan.id} className="flex items-center justify-between rounded-[24px] border border-[#E5E7EB] bg-white px-4 py-4">
                      <div>
                        <p className="text-[16px] font-bold text-[#111827]">
                          {client ? `${client.firstName} ${client.lastName}` : loan.clientId}
                        </p>
                        <p className="mt-1 text-[13px] font-medium text-[#64748B]">
                          Saldo {formatCurrency(loan.balance)} · {loan.frequency}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => client && navigate(`/clients/${client.id}`)}
                        className={`inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}
                      >
                        Ver perfil
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4">
    <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{title}</p>
    <div className="mt-4 space-y-3">{children}</div>
  </div>
);

const InfoPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3">
    <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{label}</p>
    <p className="mt-2 text-[14px] font-semibold text-[#111827]">{value}</p>
  </div>
);

type TemplatePreviewMetricTone = 'blue' | 'violet' | 'amber' | 'green';

type TemplatePreviewMetric = {
  label: string;
  value: string;
  tone: TemplatePreviewMetricTone;
};

type TemplatePreviewLineItem = {
  code?: string;
  description: string;
  detail?: string;
  quantity?: string;
  unit?: string;
  price?: string;
  tax?: string;
  total: string;
};

type TemplatePreviewTotal = {
  label: string;
  value: string;
  emphasis?: boolean;
};

type TemplatePreviewModel = {
  companyName: string;
  companyLines: string[];
  title: string;
  subtitle: string;
  documentNumber?: string;
  issueDate?: string;
  dueDate?: string;
  billedToTitle: string;
  billedToLines: string[];
  issuedByTitle: string;
  issuedByLines: string[];
  contextTitle: string;
  contextLines: string[];
  metrics: TemplatePreviewMetric[];
  lineItems: TemplatePreviewLineItem[];
  totals: TemplatePreviewTotal[];
  notesTitle: string;
  notesLines: string[];
  footerLeft: string;
  footerRight: string;
};

const getTemplatePreviewMonogram = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(token => token[0]?.toUpperCase() || '')
    .join('') || 'PF';

const templatePreviewToneClass: Record<
  TemplatePreviewMetricTone,
  { card: string; value: string; border: string; chip: string }
> = {
  blue: {
    card: 'bg-[#EFF6FF]',
    value: 'text-[#2563EB]',
    border: 'border-[#BFDBFE]',
    chip: 'bg-[#DBEAFE] text-[#2563EB]',
  },
  violet: {
    card: 'bg-[#F5F3FF]',
    value: 'text-[#4F46E5]',
    border: 'border-[#C4B5FD]',
    chip: 'bg-[#EDE9FE] text-[#7C3AED]',
  },
  amber: {
    card: 'bg-[#FFF7ED]',
    value: 'text-[#EA580C]',
    border: 'border-[#FDBA74]',
    chip: 'bg-[#FEF3C7] text-[#D97706]',
  },
  green: {
    card: 'bg-[#ECFDF5]',
    value: 'text-[#059669]',
    border: 'border-[#86EFAC]',
    chip: 'bg-[#DCFCE7] text-[#16A34A]',
  },
};

const TemplatePreviewMetricCard = ({ item }: { item: TemplatePreviewMetric }) => {
  const tone = templatePreviewToneClass[item.tone];

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${tone.card} ${tone.border}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{item.label}</p>
      <p className={`mt-3 text-[16px] font-black tracking-tight ${tone.value}`}>{item.value}</p>
    </div>
  );
};

const TemplatePreviewTable = ({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
}) => (
  <div className="overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white">
    <div
      className="grid gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#94A3B8]"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map(column => (
        <span key={column}>{column}</span>
      ))}
    </div>
    <div className="divide-y divide-[#EEF2F7]">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3 px-4 py-3 text-[12px] text-[#334155]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, cellIndex) => (
            <div key={cellIndex} className="min-w-0 break-words leading-5">
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const TemplatePresetCanvas = ({
  preset,
  model,
}: {
  preset: keyof typeof platformPdfVisualPresets;
  model: TemplatePreviewModel;
}) => {
  const monogram = getTemplatePreviewMonogram(model.companyName);
  const previewRows = model.lineItems.length
    ? model.lineItems.slice(0, 4)
    : [
        {
          description: 'Sin registros visibles',
          detail: 'Ajusta filtros, plantilla o periodo para cargar contenido.',
          quantity: '-',
          unit: '-',
          price: '-',
          tax: '-',
          total: '-',
        },
      ];
  const emphasisTotal = model.totals.find(item => item.emphasis) || model.totals[model.totals.length - 1];

  if (preset === 'CORPORATIVA_CLASICA') {
    return (
      <div className="space-y-6">
        <div className="grid gap-5 border-b border-[#E5E7EB] pb-6 md:grid-cols-[112px_minmax(0,1fr)]">
          <div className="flex h-[112px] items-center justify-center rounded-[24px] border border-[#E5E7EB] bg-[#FAFAFA]">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#E5E7EB] bg-white text-[28px] font-black tracking-tight text-[#111827]">
                {monogram}
              </div>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h3 className="text-[26px] font-black tracking-tight text-[#111827]">{model.companyName}</h3>
              <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#475569]">
                {model.companyLines.slice(0, 4).map(line => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[28px] font-black tracking-tight text-[#111827]">{model.title}</p>
              <p className="mt-2 text-[13px] leading-6 text-[#64748B]">{model.subtitle}</p>
              <div className="mt-4 space-y-1 text-[12px] leading-6 text-[#475569]">
                {model.documentNumber ? <p><span className="font-bold text-[#111827]">Documento:</span> {model.documentNumber}</p> : null}
                {model.issueDate ? <p><span className="font-bold text-[#111827]">Fecha:</span> {model.issueDate}</p> : null}
                {model.dueDate ? <p><span className="font-bold text-[#111827]">Vencimiento:</span> {model.dueDate}</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{model.billedToTitle}</p>
            <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#334155]">
              {model.billedToLines.map(line => <p key={line}>{line}</p>)}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{model.issuedByTitle}</p>
            <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#334155]">
              {model.issuedByLines.map(line => <p key={line}>{line}</p>)}
            </div>
          </div>
        </div>

        <TemplatePreviewTable
          columns={['Descripcion', 'Cantidad', 'Unidad', 'Precio', 'Fiscal', 'Importe']}
          rows={previewRows.map(item => [
            <div>
              <p className="font-semibold text-[#111827]">{item.description}</p>
              {item.detail ? <p className="mt-1 text-[11px] text-[#64748B]">{item.detail}</p> : null}
            </div>,
            item.quantity || '1',
            item.unit || 'Item',
            item.price || '-',
            item.tax || '-',
            <span className="font-bold text-[#111827]">{item.total}</span>,
          ])}
        />

        <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-5">
            <p className="text-[14px] font-black text-[#111827]">{model.notesTitle}</p>
            <div className="mt-3 space-y-2 text-[12px] leading-6 text-[#64748B]">
              {model.notesLines.map(line => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#E5E7EB] bg-white p-5">
            <div className="space-y-3">
              {model.totals.map(total => (
                <div
                  key={total.label}
                  className={`flex items-center justify-between gap-4 rounded-[16px] px-3 py-2 ${
                    total.emphasis ? 'bg-[#F8FAFC]' : ''
                  }`}
                >
                  <span className="text-[12px] font-semibold text-[#475569]">{total.label}</span>
                  <span className={`text-[13px] font-black ${total.emphasis ? 'text-[#111827]' : 'text-[#334155]'}`}>{total.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#94A3B8]">
          <span>{model.footerLeft}</span>
          <span>{model.footerRight}</span>
        </div>
      </div>
    );
  }

  if (preset === 'FISCAL_ELECTRONICA') {
    return (
      <div className="space-y-6">
        <div className="grid gap-5 border-b border-[#E5E7EB] pb-5 md:grid-cols-[120px_minmax(0,1fr)]">
          <div className="flex h-[116px] items-center justify-center rounded-[24px] border border-[#CFFAFE] bg-[#F0FDFF]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0F172A] text-[28px] font-black text-white">
              {monogram}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-1 text-[13px] leading-6 text-[#334155]">
              <h3 className="text-[18px] font-black tracking-tight text-[#111827]">{model.companyName}</h3>
              {model.companyLines.slice(0, 5).map(line => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="text-right">
              <p className="text-[24px] font-black uppercase tracking-tight text-[#111827]">{model.title}</p>
              <div className="mt-3 grid gap-1 text-[12px] text-[#475569]">
                {model.documentNumber ? <p><span className="font-bold text-[#111827]">Numero:</span> {model.documentNumber}</p> : null}
                {model.issueDate ? <p><span className="font-bold text-[#111827]">Fecha:</span> {model.issueDate}</p> : null}
                {model.dueDate ? <p><span className="font-bold text-[#111827]">Plazo:</span> {model.dueDate}</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[22px] border border-[#E5E7EB] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{model.billedToTitle}</p>
            <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#334155]">
              {model.billedToLines.map(line => <p key={line}>{line}</p>)}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#E5E7EB] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{model.contextTitle}</p>
            <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#334155]">
              {model.contextLines.map(line => <p key={line}>{line}</p>)}
            </div>
          </div>
        </div>

        <TemplatePreviewTable
          columns={['Cod.', 'Articulo', 'Cantidad', 'Precio', 'Fiscal', 'Total']}
          rows={previewRows.map(item => [
            item.code || '001',
            <div>
              <p className="font-semibold text-[#111827]">{item.description}</p>
              {item.detail ? <p className="mt-1 text-[11px] text-[#64748B]">{item.detail}</p> : null}
            </div>,
            item.quantity || '1',
            item.price || '-',
            item.tax || '-',
            <span className="font-bold text-[#111827]">{item.total}</span>,
          ])}
        />

        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFF] p-5">
            <p className="text-[14px] font-black text-[#111827]">{model.notesTitle}</p>
            <div className="mt-3 space-y-2 text-[12px] leading-6 text-[#64748B]">
              {model.notesLines.map(line => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[22px] border border-[#BFDBFE] bg-[#F0F9FF] p-4">
              <div className="space-y-2">
                {model.totals.map(total => (
                  <div key={total.label} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-[#475569]">{total.label}</span>
                    <span className={`text-[12px] font-black ${total.emphasis ? 'text-[#0F172A]' : 'text-[#334155]'}`}>{total.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-white p-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[18px] border border-[#E5E7EB] bg-[#F8FAFC] text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                QR / CUFE
              </div>
              <p className="mt-3 text-center text-[11px] leading-5 text-[#64748B]">Validacion y trazabilidad fiscal del documento.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#94A3B8]">
          <span>{model.footerLeft}</span>
          <span>{model.footerRight}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 border-b border-[#E5E7EB] pb-6 md:grid-cols-[120px_minmax(0,1fr)]">
        <div className="flex items-center justify-center">
          <div className="flex h-[110px] w-[110px] items-center justify-center rounded-[28px] bg-[#2563EB] text-[46px] font-black text-white shadow-[0_24px_48px_rgba(37,99,235,0.18)]">
            {monogram}
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-[14px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">De</p>
            <h3 className="mt-2 text-[22px] font-black tracking-tight text-[#111827]">{model.companyName}</h3>
            <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#475569]">
              {model.companyLines.slice(0, 4).map(line => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[32px] font-black tracking-tight text-[#111827]">{model.title}</p>
            <p className="mt-2 text-[13px] leading-6 text-[#64748B]">{model.subtitle}</p>
            <div className="mt-4 space-y-1 text-[12px] text-[#475569]">
              {model.documentNumber ? <p><span className="font-bold text-[#111827]">Orden:</span> {model.documentNumber}</p> : null}
              {model.issueDate ? <p><span className="font-bold text-[#111827]">Fecha:</span> {model.issueDate}</p> : null}
              {model.dueDate ? <p><span className="font-bold text-[#111827]">Aplicacion:</span> {model.dueDate}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] border border-[#E5E7EB] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{model.issuedByTitle}</p>
          <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#334155]">
            {model.issuedByLines.map(line => <p key={line}>{line}</p>)}
          </div>
        </div>
        <div className="rounded-[22px] border border-[#E5E7EB] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{model.billedToTitle}</p>
          <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#334155]">
            {model.billedToLines.map(line => <p key={line}>{line}</p>)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {model.metrics.slice(0, 4).map(item => (
          <TemplatePreviewMetricCard key={item.label} item={item} />
        ))}
      </div>

      <TemplatePreviewTable
        columns={['Descripcion', 'Tarifa', 'Cantidad', 'Fiscal', 'Detalle', 'Total']}
        rows={previewRows.map(item => [
          <div>
            <p className="font-semibold text-[#111827]">{item.description}</p>
            {item.detail ? <p className="mt-1 text-[11px] text-[#64748B]">{item.detail}</p> : null}
          </div>,
          item.price || '-',
          item.quantity || '1',
          item.tax || '-',
          item.unit || 'Registro',
          <span className="font-bold text-[#111827]">{item.total}</span>,
        ])}
      />

      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <div className="rounded-[22px] border border-[#E5E7EB] p-5">
            <p className="text-[14px] font-black text-[#111827]">{model.notesTitle}</p>
            <div className="mt-3 space-y-2 text-[12px] leading-6 text-[#64748B]">
              {model.notesLines.map(line => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] border border-[#E5E7EB] p-5">
            <p className="text-[14px] font-black text-[#111827]">{model.contextTitle}</p>
            <div className="mt-3 space-y-2 text-[12px] leading-6 text-[#475569]">
              {model.contextLines.map(line => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-[24px] bg-[#111827] p-5 text-white shadow-[0_20px_42px_rgba(15,23,42,0.14)]">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
            {emphasisTotal?.label || 'Total'}
          </p>
          <p className="mt-3 text-[28px] font-black tracking-tight">{emphasisTotal?.value || '-'}</p>
          <div className="mt-5 space-y-2 text-[12px] text-white/80">
            {model.totals.map(total => (
              <div key={total.label} className="flex items-center justify-between gap-3">
                <span>{total.label}</span>
                <span className="font-semibold text-white">{total.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-right text-[28px] leading-none text-[#2563EB]">~</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#94A3B8]">
        <span>{model.footerLeft}</span>
        <span>{model.footerRight}</span>
      </div>
    </div>
  );
};

const StatusLine = ({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: 'green' | 'amber' | 'blue';
}) => {
  const toneClass =
    tone === 'green'
      ? 'bg-[#DCFCE7] text-[#16A34A]'
      : tone === 'amber'
        ? 'bg-[#FEF3C7] text-[#D97706]'
        : 'bg-[#EFF6FF] text-[#2563EB]';

  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E5E7EB] px-4 py-3">
      <p className="text-[14px] font-semibold text-[#111827]">{label}</p>
      <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${toneClass}`}>{status}</span>
    </div>
  );
};

const ReportFilterDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  isOpen,
  onToggle,
  onRequestClose,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onRequestClose: () => void;
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onRequestClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onRequestClose]);

  return (
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-20'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-[56px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 ${
          disabled
            ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8]'
            : isOpen
              ? 'border-[#111827] bg-white text-[#111827] shadow-[0_16px_36px_rgba(15,23,42,0.08)]'
              : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#DBEAFE] hover:text-[#2563EB]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#111827]' : ''}`} />
      </button>

      {isOpen && !disabled ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[80] w-max min-w-[260px] max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={`${placeholder}-${option.value}`}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  onRequestClose();
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                  isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {isSelected ? <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const paginateItems = <T,>(items: T[], page: number, pageSize: number) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
};

const formatCompactCurrency = (value: number) => {
  if (Math.abs(value) < 100_000_000) {
    return formatCurrency(value).replace('RD$', '').trim();
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

const PremiumChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; payload?: { share?: number } }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-[200px] rounded-[20px] border border-[#E5E7EB] bg-white/96 px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-sm">
      {label ? <p className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{label}</p> : null}
      <div className="space-y-2.5">
        {payload.map(item => (
          <div key={`${item.name}-${item.value}`} className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || '#2563EB' }} />
              <div>
                <p className="text-[13px] font-bold text-[#111827]">{item.name || 'Serie'}</p>
                {typeof item.payload?.share === 'number' ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-[#94A3B8]">{item.payload.share}% del total</p>
                ) : null}
              </div>
            </div>
            <p className="text-[13px] font-black text-[#111827]">{formatCurrency(Number(item.value || 0))}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const PanelPagination = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}) => {
  if (totalItems <= pageSize) return null;

  return (
    <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#EEF2F7] pt-4">
      <p className="text-[13px] font-medium text-[#64748B]">
        {`Mostrando ${(page - 1) * pageSize + 1} a ${Math.min(page * pageSize, totalItems)} de ${totalItems} registros`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
        >
          <ChevronDown size={16} className="rotate-90" />
        </button>
        <span className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-[14px] font-semibold text-[#2563EB]">
          {page}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
        >
          <ChevronDown size={16} className="-rotate-90" />
        </button>
      </div>
    </div>
  );
};

const AlertRow = ({
  label,
  detail,
  value,
  tone,
}: {
  label: string;
  detail: string;
  value: string;
  tone: 'red' | 'amber' | 'blue' | 'green';
}) => {
  const valueClass =
    tone === 'red'
      ? 'text-[#DC2626]'
      : tone === 'amber'
        ? 'text-[#D97706]'
        : tone === 'blue'
          ? 'text-[#2563EB]'
          : 'text-[#16A34A]';

  return (
    <div className="flex items-center justify-between rounded-[22px] border border-[#F1F5F9] px-4 py-4">
      <div>
        <p className="text-[15px] font-bold text-[#111827]">{label}</p>
        <p className="mt-1 text-[13px] font-medium text-[#64748B]">{detail}</p>
      </div>
      <div className={`text-[22px] font-black ${valueClass}`}>{value}</div>
    </div>
  );
};

const MetricRow = ({
  label,
  value,
  accentColor,
  percent,
}: {
  label: string;
  value: string;
  accentColor: string;
  percent: number;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[14px] font-medium text-[#64748B]">{label}</span>
      <span className="text-[14px] font-semibold text-[#111827]">{value}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(percent, 100))}%`, backgroundColor: accentColor }}
      />
    </div>
  </div>
);

const EmptyState = ({ label, compact }: { label: string; compact?: boolean }) => (
  <div className={`rounded-[24px] border border-dashed border-[#E5E7EB] text-center ${compact ? 'px-4 py-8' : 'px-6 py-16'}`}>
    <WalletCards size={compact ? 28 : 40} className="mx-auto text-[#CBD5E1]" />
    <p className={`mt-4 font-semibold text-[#64748B] ${compact ? 'text-[14px]' : 'text-[16px]'}`}>{label}</p>
  </div>
);
