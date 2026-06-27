import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Filter,
  Info,
  Landmark,
  MinusCircle,
  Plus,
  PlusCircle,
  Search,
  ShieldAlert,
  TrendingUp,
  UserRound,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react';
import { addCashMovement, upsertCashMovementsInLocalStorage } from '../services/dataService';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { emitPlatformToast, openPlatformCriticalModal, setPlatformLoading } from '../services/platformEvents';
import { getBranchScope, getScopedCashMovements } from '../services/viewScope';
import { Branch, CashClosure, CashMovement, Role } from '../types';
import { formatCurrency, formatDate } from '../utils';

type CashTab = 'RESUMEN' | 'MOVIMIENTOS' | 'CIERRE' | 'HISTORIAL';

const cashTabs: Array<{ key: CashTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { key: 'RESUMEN', label: 'Resumen', icon: WalletCards },
  { key: 'MOVIMIENTOS', label: 'Movimientos', icon: Banknote },
  { key: 'CIERRE', label: 'Cierre de caja', icon: ShieldAlert },
  { key: 'HISTORIAL', label: 'Historial', icon: CalendarDays },
];

const horizontalMotionClass =
  'cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

const kpiToneMap = {
  blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]', watermark: 'text-[#DBEAFE]' },
  emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]', watermark: 'text-[#DCFCE7]' },
  red: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', note: 'text-[#DC2626]', watermark: 'text-[#FEE2E2]' },
  amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]', watermark: 'text-[#FEF3C7]' },
} as const;

const categories: Array<{ label: string; value: '' | CashMovement['category'] }> = [
  { label: 'Todas las categorias', value: '' },
  { label: 'Cobros', value: 'COBRO' },
  { label: 'Prestamos', value: 'PRESTAMO' },
  { label: 'Gastos', value: 'GASTO' },
  { label: 'Aportes', value: 'APORTE' },
  { label: 'Comisiones', value: 'COMISION' },
  { label: 'Dietas', value: 'DIETA' },
  { label: 'Gasolina', value: 'GASOLINA' },
  { label: 'Retiros', value: 'RETIRO' },
  { label: 'Otros', value: 'OTRO' },
];

const movementTypeOptions = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Entradas', value: 'IN' },
  { label: 'Salidas', value: 'OUT' },
];

const categoryLabelMap: Record<CashMovement['category'], string> = {
  COBRO: 'Cobros',
  PRESTAMO: 'Prestamos',
  GASTO: 'Gastos',
  APORTE: 'Aportes',
  COMISION: 'Comisiones',
  DIETA: 'Dietas',
  GASOLINA: 'Gasolina',
  RETIRO: 'Retiros',
  OTRO: 'Otros',
};

export const CashManagement: React.FC = () => {
  const historyPageSize = 10;
  const movementPageSize = 10;
  const { currentUser } = useAuth();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [closures, setClosures] = useState<CashClosure[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<CashTab>('RESUMEN');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'' | CashMovement['type']>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'' | CashMovement['category']>('');
  const [openFilterId, setOpenFilterId] = useState<'branch' | 'type' | 'category' | 'movementCategory' | null>(null);
  const [currentHistoryPage, setCurrentHistoryPage] = useState(1);
  const [currentMovementPage, setCurrentMovementPage] = useState(1);
  const [isMovementInsightsOpen, setIsMovementInsightsOpen] = useState(false);
  const [isClosingCash, setIsClosingCash] = useState(false);
  const [closureError, setClosureError] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [formData, setFormData] = useState({
    type: 'OUT' as 'IN' | 'OUT',
    category: 'GASTO' as CashMovement['category'],
    amount: 0,
    note: '',
  });

  const isAdmin = currentUser?.role === Role.ADMIN || currentUser?.role === Role.SUPER_ADMIN;
  const branchScope = useMemo(() => (currentUser ? getBranchScope(currentUser) : null), [currentUser]);
  const canSeeAllCompanyUsers = branchScope?.canSeeAllCompanyUsers || false;

  useEffect(() => {
    if (!currentUser) return;
    setBranches(branchScope?.branches || []);
    setSelectedBranch(currentUser.branchId);
  }, [branchScope, currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedBranch) return;
    setMovements(getScopedCashMovements(currentUser, selectedBranch));
  }, [currentUser, selectedBranch]);

  useEffect(() => {
    if (!currentUser || !selectedBranch) return;

    void Promise.all([apiClient.listCashMovements(), apiClient.listCashClosures()])
      .then(([movementsResponse, closuresResponse]) => {
        upsertCashMovementsInLocalStorage(movementsResponse.data);
        setMovements(getScopedCashMovements(currentUser, selectedBranch));
        setClosures(closuresResponse.data);
      })
      .catch(() => {
        setClosures([]);
      });
  }, [currentUser, selectedBranch]);

  useEffect(() => {
    setCurrentHistoryPage(1);
    setCurrentMovementPage(1);
  }, [searchTerm, selectedTypeFilter, selectedCategoryFilter, selectedBranch]);

  const activeBranch = useMemo(() => branches.find(branch => branch.id === selectedBranch), [branches, selectedBranch]);
  const activeBranchClosures = useMemo(
    () =>
      closures
        .filter(closure => closure.branchId === selectedBranch)
        .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()),
    [closures, selectedBranch],
  );

  const filteredMovements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return movements.filter(movement => {
      const matchesSearch =
        !query ||
        movement.note.toLowerCase().includes(query) ||
        movement.category.toLowerCase().includes(query) ||
        movement.userName.toLowerCase().includes(query) ||
        movement.id.toLowerCase().includes(query);
      const matchesType = !selectedTypeFilter || movement.type === selectedTypeFilter;
      const matchesCategory = !selectedCategoryFilter || movement.category === selectedCategoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [movements, searchTerm, selectedTypeFilter, selectedCategoryFilter]);

  const stats = useMemo(() => {
    const income = movements.filter(m => m.type === 'IN').reduce((acc, m) => acc + m.amount, 0);
    const outcome = movements.filter(m => m.type === 'OUT').reduce((acc, m) => acc + m.amount, 0);
    const balance = income - outcome;
    const expected = income + Math.abs(outcome);
    const operations = movements.length;
    const pendingReview = movements.filter(m => !m.note.trim()).length;
    const entries = movements.filter(m => m.type === 'IN').length;
    const exits = movements.filter(m => m.type === 'OUT').length;
    return { income, outcome, balance, expected, operations, pendingReview, entries, exits };
  }, [movements]);

  const closingDifference = useMemo(() => {
    const parsed = Number(countedCash);
    if (!countedCash || !Number.isFinite(parsed)) return null;
    return parsed - stats.balance;
  }, [countedCash, stats.balance]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredMovements.length / historyPageSize));
  const normalizedHistoryPage = Math.min(currentHistoryPage, historyTotalPages);
  const historyPageStart = (normalizedHistoryPage - 1) * historyPageSize;
  const movementTotalPages = Math.max(1, Math.ceil(filteredMovements.length / movementPageSize));
  const safeCurrentMovementPage = Math.min(currentMovementPage, movementTotalPages);
  const movementPageStart = (safeCurrentMovementPage - 1) * movementPageSize;
  const showSidebar = false;
  const paginatedMovements = useMemo(
    () => filteredMovements.slice(movementPageStart, movementPageStart + movementPageSize),
    [filteredMovements, movementPageStart, movementPageSize],
  );
  const paginatedHistoryRows = useMemo(
    () => filteredMovements.slice(historyPageStart, historyPageStart + historyPageSize),
    [filteredMovements, historyPageSize, historyPageStart],
  );
  const visibleMovementPages = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, safeCurrentMovementPage - 1);
    const end = Math.min(movementTotalPages, start + 2);
    for (let page = start; page <= end; page += 1) pages.push(page);
    if (pages.length < 3) {
      const missing = 3 - pages.length;
      const prependStart = Math.max(1, start - missing);
      const extraPages: number[] = [];
      for (let page = prependStart; page < start; page += 1) extraPages.push(page);
      return [...extraPages, ...pages];
    }
    return pages;
  }, [movementTotalPages, safeCurrentMovementPage]);

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, CashMovement[]>();
    paginatedHistoryRows.forEach(movement => {
      const key = movement.date.slice(0, 10);
      groups.set(key, [...(groups.get(key) || []), movement]);
    });
    return [...groups.entries()].map(([date, rows]) => ({ date, rows }));
  }, [paginatedHistoryRows]);

  const kpis = [
    {
      label: 'Balance disponible',
      value: formatCurrency(stats.balance),
      helper: `Caja actual de ${activeBranch?.name || 'la sucursal'}`,
      share: 100,
      trend: `${stats.operations} registros`,
      trendTone: 'text-[#2563EB]',
      icon: Wallet,
      tone: 'blue' as const,
    },
    {
      label: 'Entradas del dia',
      value: formatCurrency(stats.income),
      helper: `${stats.entries} ingresos registrados`,
      share: stats.expected > 0 ? Math.round((stats.income / stats.expected) * 100) : 0,
      trend: `${stats.entries}`,
      trendTone: 'text-[#16A34A]',
      icon: ArrowDownCircle,
      tone: 'emerald' as const,
    },
    {
      label: 'Salidas del dia',
      value: formatCurrency(stats.outcome),
      helper: `${stats.exits} egresos registrados`,
      share: stats.expected > 0 ? Math.round((stats.outcome / stats.expected) * 100) : 0,
      trend: `${stats.exits}`,
      trendTone: 'text-[#DC2626]',
      icon: ArrowUpCircle,
      tone: 'red' as const,
    },
    {
      label: 'Monto teorico',
      value: formatCurrency(stats.balance),
      helper: closingDifference === null ? 'Pendiente de arqueo' : 'Listo para cierre',
      share: Math.min(100, Math.round((stats.balance / Math.max(stats.expected, 1)) * 100)),
      trend: activeTab === 'CIERRE' ? 'Cierre activo' : 'Operativo',
      trendTone: 'text-[#F59E0B]',
      icon: Banknote,
      tone: 'amber' as const,
    },
    {
      label: 'Pendientes revision',
      value: `${stats.pendingReview}`,
      helper: stats.pendingReview === 0 ? 'Sin alertas de caja' : 'Notas o ajustes por validar',
      share: stats.operations > 0 ? Math.round((stats.pendingReview / stats.operations) * 100) : 0,
      trend: stats.pendingReview === 0 ? 'Estable' : 'Atencion',
      trendTone: stats.pendingReview === 0 ? 'text-[#16A34A]' : 'text-[#DC2626]',
      icon: ShieldAlert,
      tone: stats.pendingReview === 0 ? ('emerald' as const) : ('red' as const),
    },
  ];

  const handleOpenMovementModal = (type: 'IN' | 'OUT') => {
    setFormData(previous => ({
      ...previous,
      type,
      category: type === 'IN' ? 'APORTE' : 'GASTO',
    }));
    setIsModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedTypeFilter('');
    setSelectedCategoryFilter('');
    setOpenFilterId(null);
  };

  const handleCloseCash = async () => {
    if (!currentUser) return;
    const countedAmount = Number(countedCash);

    setIsClosingCash(true);
    setClosureError('');
    setPlatformLoading({ active: true, label: 'Guardando cierre de caja' });

    try {
      const response = await apiClient.closeCash({
        branchId: selectedBranch,
        countedAmount,
        note: closingNote.trim() || undefined,
        businessDate: new Date().toISOString().slice(0, 10),
      });

      setClosures(previous => [response.data, ...previous.filter(item => item.id !== response.data.id)]);
      emitPlatformToast({
        title: 'Caja cerrada',
        message: 'El cierre quedo guardado correctamente en el historial operativo.',
        tone: 'success',
      });
      setCountedCash('');
      setClosingNote('');
      setActiveTab('HISTORIAL');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el cierre de caja.';
      emitPlatformToast({
        title: 'No se pudo cerrar la caja',
        message,
        tone: 'error',
      });
    } finally {
      setPlatformLoading({ active: false });
      setIsClosingCash(false);
    }
  };

  const requestCloseCashConfirmation = () => {
    if (!currentUser) return;

    const countedAmount = Number(countedCash);
    if (!countedCash || !Number.isFinite(countedAmount) || countedAmount < 0) {
      setClosureError('Debes registrar un monto contado valido antes de cerrar la caja.');
      return;
    }

    if (closingDifference !== null && closingDifference !== 0 && !closingNote.trim()) {
      setClosureError('Agrega una observacion para justificar la diferencia detectada en el cierre.');
      return;
    }

    setClosureError('');

    openPlatformCriticalModal({
      id: 'close-cash-confirmation',
      title: '¿Cerrar caja y guardar historial?',
      description: 'Se registrara el arqueo actual y el resultado quedara persistido en el historial operativo de la sucursal.',
      tone: closingDifference && closingDifference !== 0 ? 'warning' : 'info',
      confirmLabel: 'Confirmar cierre',
      cancelLabel: 'Seguir revisando',
      highlights: [
        { label: 'Sucursal', value: activeBranch?.name || 'Sucursal principal' },
        { label: 'Monto teorico', value: formatCurrency(stats.balance) },
        { label: 'Monto contado', value: formatCurrency(countedAmount) },
        {
          label: 'Diferencia',
          value: closingDifference === null ? 'Sin arqueo' : formatCurrency(closingDifference),
          tone: closingDifference && closingDifference !== 0 ? 'warning' : 'success',
        },
      ],
      onConfirm: handleCloseCash,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || formData.amount <= 0) return;

    try {
      const response = await apiClient.createCashMovement({
        branchId: selectedBranch,
        type: formData.type,
        category: formData.category,
        amount: formData.amount,
        note: formData.note,
      });

      upsertCashMovementsInLocalStorage([response.data]);
      setMovements(getScopedCashMovements(currentUser, selectedBranch));
      setIsModalOpen(false);
      setFormData({ type: 'OUT', category: 'GASTO', amount: 0, note: '' });
    } catch {
      addCashMovement(
        {
          companyId: currentUser.companyId,
          branchId: selectedBranch,
          userId: currentUser.id,
          userName: currentUser.name,
          ...formData,
        },
        currentUser,
      );
      setMovements(getScopedCashMovements(currentUser, selectedBranch));
      setIsModalOpen(false);
      setFormData({ type: 'OUT', category: 'GASTO', amount: 0, note: '' });
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <section>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[52px] font-black leading-none tracking-tight text-[#111827]">Caja</h1>
            <p className="mt-4 max-w-3xl text-[18px] font-medium text-[#64748B]">
              Controla ingresos, salidas, arqueo y cierre operativo del efectivo por sucursal.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
            <button
              type="button"
              onClick={() => handleOpenMovementModal('IN')}
              className={`inline-flex h-[56px] min-w-[172px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm ${horizontalMotionClass}`}
            >
              <ArrowDownCircle size={18} />
              Registrar entrada
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovementModal('OUT')}
              className={`inline-flex h-[56px] min-w-[168px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm ${horizontalMotionClass}`}
            >
              <ArrowUpCircle size={18} />
              Registrar salida
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CIERRE')}
              className={`inline-flex h-[56px] min-w-[170px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] shadow-sm ${horizontalMotionClass}`}
            >
              <WalletCards size={18} />
              Cierre de caja
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-[56px] min-w-[164px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8]"
            >
              <Download size={18} />
              Exportar PDF
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          const tone = kpiToneMap[kpi.tone];
          return (
            <article
              key={kpi.label}
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
                <p className={`mt-3 max-w-[190px] text-[15px] font-medium leading-6 ${tone.note}`}>{kpi.helper}</p>
              </div>
              <Icon size={72} className={`absolute bottom-4 right-4 ${tone.watermark} opacity-70`} strokeWidth={1.7} />
            </article>
          );
        })}
      </section>

      <section className="relative z-30 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[210px_210px_230px_minmax(260px,1fr)_auto]">
          {isAdmin ? (
            <FilterDropdown
              id="branch"
              value={selectedBranch}
              onChange={setSelectedBranch}
              isOpen={openFilterId === 'branch'}
              onToggle={() => setOpenFilterId(current => (current === 'branch' ? null : 'branch'))}
              placeholder="Sucursal actual"
              options={branches.map(branch => ({ value: branch.id, label: branch.name }))}
            />
          ) : (
            <StaticFilter label={activeBranch?.name || 'Sucursal actual'} />
          )}
          <FilterDropdown
            id="type"
            value={selectedTypeFilter}
            onChange={value => setSelectedTypeFilter(value as '' | CashMovement['type'])}
            isOpen={openFilterId === 'type'}
            onToggle={() => setOpenFilterId(current => (current === 'type' ? null : 'type'))}
            placeholder="Todos los tipos"
            options={movementTypeOptions.filter(option => option.value)}
          />
          <FilterDropdown
            id="category"
            value={selectedCategoryFilter}
            onChange={value => setSelectedCategoryFilter(value as '' | CashMovement['category'])}
            isOpen={openFilterId === 'category'}
            onToggle={() => setOpenFilterId(current => (current === 'category' ? null : 'category'))}
            placeholder="Todas las categorias"
            options={categories.filter(option => option.value)}
          />
          <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 transition-all duration-200 focus-within:border-[#93C5FD]">
            <Search size={18} className="text-[#6B7280]" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar concepto, categoria, usuario o referencia"
              className="w-full bg-transparent text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8]"
            />
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className={`inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#111827] ${horizontalMotionClass}`}
          >
            <Filter size={18} />
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6">
        <article className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Control de caja</h2>
                <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[13px] font-semibold text-[#64748B]">{filteredMovements.length} registros</span>
              </div>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">
                Monitoreo operativo de movimientos, validacion del arqueo y seguimiento del historial.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cashTabs.map(tab => {
                const active = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.key)}
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

          {activeTab === 'RESUMEN' && (
            <div className="p-6">
              <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Movimientos recientes</h3>
                        <p className="mt-2 text-[14px] font-medium text-[#64748B]">Vista limpia del flujo reciente de ingresos, salidas y ajustes operativos.</p>
                      </div>
                      <button type="button" onClick={() => setActiveTab('MOVIMIENTOS')} className={`inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] ${horizontalMotionClass}`}>
                        Ver detalle
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="mt-5 space-y-3">
                      {filteredMovements.length === 0 ? (
                        <EmptyState label="No hay movimientos registrados todavia." />
                      ) : (
                        filteredMovements.slice(0, 6).map(movement => (
                          <div key={movement.id} className="group flex items-center justify-between rounded-[24px] border border-[#E5E7EB] bg-white p-4 transition-all duration-200 hover:border-[#DBEAFE] hover:bg-[#FCFDFF] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
                            <div className="min-w-0 transition-transform duration-200 group-hover:translate-x-2">
                              <div className="flex items-center gap-3">
                                <MovementTypeIcon type={movement.type} />
                                <div className="min-w-0">
                                  <p className="truncate text-[16px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{movement.note || 'Movimiento manual de caja'}</p>
                                  <p className="mt-1 text-[13px] font-medium text-[#64748B]">{categoryLabelMap[movement.category]} · {movement.userName}</p>
                                </div>
                              </div>
                            </div>
                            <div className="pl-4 text-right transition-transform duration-200 group-hover:translate-x-2">
                              <p className={`text-[18px] font-bold ${movement.type === 'IN' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                {movement.type === 'IN' ? '+' : '-'}
                                {formatCurrency(movement.amount)}
                              </p>
                              <p className="mt-1 text-[13px] font-medium text-[#94A3B8]">{formatDate(movement.date)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  
              </div>
            </div>
          )}

          {activeTab === 'MOVIMIENTOS' && (
            <div>
              <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Movimientos registrados</h3>
                  <p className="mt-2 text-[15px] font-medium text-[#64748B]">Consulta completa de entradas, salidas, conceptos y responsables con los filtros activos.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMovementInsightsOpen(true)}
                  className={`inline-flex h-11 items-center gap-2 self-start rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#111827] lg:self-auto ${horizontalMotionClass}`}
                >
                  Ver resumen
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <div className="grid min-w-[910px] grid-cols-[150px_130px_minmax(220px,1fr)_140px_150px_120px] gap-4 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  <span>Fecha</span>
                  <span className="text-center">Tipo</span>
                  <span>Concepto</span>
                  <span className="text-center">Categoria</span>
                  <span className="text-center">Monto</span>
                  <span className="text-center">Usuario</span>
                </div>
              </div>
              <div className="divide-y divide-[#EEF2F7]">
                {filteredMovements.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <Banknote size={40} className="mx-auto text-[#CBD5E1]" />
                    <p className="mt-4 text-[16px] font-semibold text-[#64748B]">No hay movimientos para los filtros actuales.</p>
                  </div>
                ) : (
                  paginatedMovements.map(movement => (
                    <div key={movement.id} className="group px-4 py-3 transition-colors duration-200 hover:bg-[#FCFDFF]">
                      <div className="overflow-x-auto">
                        <div className="grid min-w-[910px] grid-cols-[150px_130px_minmax(220px,1fr)_140px_150px_120px] items-center gap-4 rounded-[24px] px-2 py-2">
                        <div className="text-[14px] font-semibold text-[#64748B] transition-transform duration-200 group-hover:translate-x-2">{formatDate(movement.date)}</div>
                        <div className="flex justify-center transition-transform duration-200 group-hover:translate-x-2">
                          <div className="flex items-center gap-2">
                            <MovementTypeIcon type={movement.type} compact />
                            <span className="text-[13px] font-semibold text-[#111827]">{movement.type === 'IN' ? 'Entrada' : 'Salida'}</span>
                          </div>
                        </div>
                        <div className="min-w-0 transition-transform duration-200 group-hover:translate-x-2">
                          <p className="truncate text-[16px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{movement.note || 'Movimiento manual de caja'}</p>
                          <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{movement.id}</p>
                        </div>
                        <div className="flex justify-center transition-transform duration-200 group-hover:translate-x-2">
                          <CategoryBadge category={movement.category} />
                        </div>
                        <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                          <p className={`text-[16px] font-bold ${movement.type === 'IN' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {movement.type === 'IN' ? '+' : '-'}
                            {formatCurrency(movement.amount)}
                          </p>
                        </div>
                        <div className="text-center transition-transform duration-200 group-hover:translate-x-2">
                          <p className="text-[13px] font-semibold text-[#64748B]">{movement.userName}</p>
                        </div>
                      </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between border-t border-[#E5E7EB] px-8 py-6">
                <p className="text-[15px] font-medium text-[#6B7280]">
                  {filteredMovements.length === 0
                    ? 'No hay registros para mostrar'
                    : `Mostrando ${movementPageStart + 1} a ${Math.min(movementPageStart + movementPageSize, filteredMovements.length)} de ${filteredMovements.length} registros`}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentMovementPage(page => Math.max(1, page - 1))}
                    disabled={safeCurrentMovementPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {visibleMovementPages.map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentMovementPage(page)}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-[15px] font-medium ${
                        page === safeCurrentMovementPage
                          ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                          : 'border border-transparent text-[#374151] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentMovementPage(page => Math.min(movementTotalPages, page + 1))}
                    disabled={safeCurrentMovementPage === movementTotalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CIERRE' && (
            <div className="space-y-6 p-6">
                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Resumen de cierre</h3>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <MiniSummaryCard label="Monto teorico" value={formatCurrency(stats.balance)} tone="blue" />
                    <MiniSummaryCard label="Monto contado" value={countedCash ? formatCurrency(Number(countedCash)) : 'Pendiente'} tone="amber" />
                    <MiniSummaryCard label="Diferencia" value={closingDifference === null ? 'Sin arqueo' : formatCurrency(closingDifference)} tone={closingDifference && closingDifference !== 0 ? 'red' : 'green'} />
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-3">
                      <ChecklistItem label="Revisar entradas del dia" complete />
                      <ChecklistItem label="Revisar salidas del dia" complete />
                      <ChecklistItem label="Validar notas y referencias" complete={stats.pendingReview === 0} />
                      <ChecklistItem label="Confirmar monto contado" complete={closingDifference !== null} />
                      <ChecklistItem label="Consolidar observaciones" complete={closingNote.trim().length > 0} />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Monto contado real</label>
                      <input
                        type="number"
                        value={countedCash}
                        onChange={event => setCountedCash(event.target.value)}
                        placeholder="0.00"
                        className="mt-2 h-[72px] w-full rounded-[28px] border border-[#E5E7EB] bg-white px-6 text-[28px] font-semibold tracking-tight text-[#111827] outline-none focus:border-[#93C5FD]"
                      />
                      <label className="mt-4 block text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Observaciones del cierre</label>
                      <textarea
                        value={closingNote}
                        onChange={event => setClosingNote(event.target.value)}
                        placeholder="Describe incidencias, justificaciones o hallazgos del cierre..."
                        className="mt-2 h-32 w-full rounded-[24px] border border-[#E5E7EB] bg-white px-5 py-4 text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#93C5FD]"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Confirmar cierre</h3>
                      <p className="mt-2 text-[15px] font-medium text-[#64748B]">
                        Guarda el arqueo de la caja actual y registra el resultado en el historial operativo de la sucursal.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={requestCloseCashConfirmation}
                      disabled={isClosingCash}
                      className="inline-flex h-[56px] min-w-[220px] items-center justify-center rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileText size={18} className="mr-2" />
                      {isClosingCash ? 'Guardando cierre...' : 'Cerrar caja y guardar historial'}
                    </button>
                  </div>
                  {closureError && (
                    <div className="mt-4 rounded-[20px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#B91C1C]">
                      {closureError}
                    </div>
                  )}
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                    <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Balance final</h3>
                    <p className="mt-2 text-[15px] font-medium text-[#64748B]">Comparativo operativo del arqueo actual.</p>
                    <div className="mt-6 space-y-4">
                      <DetailLine label="Entradas del dia" value={formatCurrency(stats.income)} accent="text-[#16A34A]" />
                      <DetailLine label="Salidas del dia" value={formatCurrency(stats.outcome)} accent="text-[#DC2626]" />
                      <DetailLine label="Monto teorico" value={formatCurrency(stats.balance)} accent="text-[#2563EB]" />
                      <DetailLine label="Monto contado" value={countedCash ? formatCurrency(Number(countedCash)) : 'Pendiente'} />
                      <DetailLine label="Diferencia" value={closingDifference === null ? 'Pendiente' : formatCurrency(closingDifference)} accent={closingDifference && closingDifference !== 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'} />
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                    <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Estado de conciliacion</h3>
                    <p className="mt-2 text-[15px] font-medium text-[#64748B]">Validaciones base antes de cerrar la caja.</p>
                    <div className="mt-6 space-y-5">
                      <MetricRow label="Operaciones conciliadas" value={`${stats.operations - stats.pendingReview}/${Math.max(stats.operations, 1)}`} accent="bg-[#16A34A]" percent={stats.operations > 0 ? Math.round(((stats.operations - stats.pendingReview) / stats.operations) * 100) : 100} />
                      <MetricRow label="Saldo verificado" value={countedCash ? `${formatCurrency(Number(countedCash))} / ${formatCurrency(stats.balance)}` : formatCurrency(stats.balance)} accent="bg-[#2563EB]" percent={closingDifference === null ? 35 : closingDifference === 0 ? 100 : 55} />
                      <MetricRow label="Pendientes revision" value={`${stats.pendingReview}`} accent="bg-[#F59E0B]" percent={stats.operations > 0 ? Math.round((stats.pendingReview / stats.operations) * 100) : 0} />
                    </div>
                  </section>
                </div>
            </div>
          )}

          {activeTab === 'HISTORIAL' && (
            <div className="space-y-4 p-6">
              {groupedHistory.length === 0 && activeBranchClosures.length === 0 ? (
                <EmptyState label="No hay historial para mostrar con los filtros actuales." />
              ) : (
                <>
                  <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[22px] font-black tracking-tight text-[#111827]">Cierres guardados</h3>
                        <p className="mt-2 text-[14px] font-medium text-[#64748B]">Registro persistido de cierres de caja para la sucursal activa.</p>
                      </div>
                      <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[13px] font-semibold text-[#64748B]">{activeBranchClosures.length} cierres</span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {activeBranchClosures.length === 0 ? (
                        <EmptyState label="Todavia no hay cierres de caja guardados para esta sucursal." compact />
                      ) : (
                        activeBranchClosures.map(closure => (
                          <article key={closure.id} className="rounded-[24px] border border-[#E5E7EB] bg-white p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-[16px] font-bold text-[#111827]">Cierre {formatDate(closure.businessDate)}</h4>
                                  <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${closure.status === 'BALANCED' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEF3C7] text-[#D97706]'}`}>
                                    {closure.status === 'BALANCED' ? 'Cuadrado' : 'Con diferencia'}
                                  </span>
                                </div>
                                <p className="mt-2 text-[13px] font-medium text-[#64748B]">
                                  {closure.branchName} · {closure.userName} · {formatDate(closure.closedAt)}
                                </p>
                                {closure.note && <p className="mt-2 text-[14px] font-medium text-[#475569]">{closure.note}</p>}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <DetailLine label="Teorico" value={formatCurrency(closure.theoreticalAmount)} accent="text-[#2563EB]" />
                                <DetailLine label="Contado" value={formatCurrency(closure.countedAmount)} accent="text-[#111827]" />
                                <DetailLine label="Diferencia" value={formatCurrency(closure.differenceAmount)} accent={closure.differenceAmount === 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'} />
                              </div>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <DetailLine label="Sucursal" value={activeBranch?.name || 'Sucursal principal'} />
                    <DetailLine label="Responsable" value={currentUser.name} />
                    <DetailLine label="Movimientos visibles" value={`${filteredMovements.length}`} />
                  </div>
                  <div className="flex flex-col gap-3 rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[16px] font-bold text-[#111827]">Historial paginado por fecha</p>
                      <p className="mt-1 text-[14px] font-medium text-[#64748B]">
                        Mostrando {historyPageStart + 1} a {Math.min(historyPageStart + historyPageSize, filteredMovements.length)} de {filteredMovements.length} movimientos.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={() => setCurrentHistoryPage(page => Math.max(1, page - 1))}
                        disabled={normalizedHistoryPage === 1}
                        className={`inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-[14px] font-semibold ${
                          normalizedHistoryPage === 1
                            ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8]'
                            : `border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`
                        }`}
                      >
                        Anterior
                      </button>
                      <div className="inline-flex h-11 items-center rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 text-[14px] font-semibold text-[#2563EB]">
                        Pagina {normalizedHistoryPage} de {historyTotalPages}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentHistoryPage(page => Math.min(historyTotalPages, page + 1))}
                        disabled={normalizedHistoryPage === historyTotalPages}
                        className={`inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-[14px] font-semibold ${
                          normalizedHistoryPage === historyTotalPages
                            ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8]'
                            : `border-[#E5E7EB] bg-white text-[#111827] ${horizontalMotionClass}`
                        }`}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                  {groupedHistory.map(group => (
                    <section key={group.date} className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                    <h3 className="text-[22px] font-black tracking-tight text-[#111827]">{formatDate(group.date)}</h3>
                    <div className="mt-4 space-y-3">
                      {group.rows.map(movement => (
                        <div key={movement.id} className="flex items-center justify-between rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                          <div className="flex items-center gap-3">
                            <MovementTypeIcon type={movement.type} compact />
                            <div>
                              <p className="text-[15px] font-semibold text-[#111827]">{movement.note || 'Movimiento manual de caja'}</p>
                              <p className="mt-1 text-[13px] font-medium text-[#64748B]">{categoryLabelMap[movement.category]} · {movement.userName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-[15px] font-bold ${movement.type === 'IN' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                              {movement.type === 'IN' ? '+' : '-'}
                              {formatCurrency(movement.amount)}
                            </p>
                            <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">{formatDate(movement.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    </section>
                  ))}
                </>
              )}
            </div>
          )}
        </article>

        {showSidebar && <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          {activeTab === 'MOVIMIENTOS' && (
            <>
              <article className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Resumen por tipo</h2>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Desglose de entradas, salidas y carga operativa.</p>
                <div className="mt-6 space-y-5">
                  <MetricRow label="Entradas" value={formatCurrency(stats.income)} accent="bg-[#16A34A]" percent={stats.expected > 0 ? Math.round((stats.income / stats.expected) * 100) : 0} />
                  <MetricRow label="Salidas" value={formatCurrency(stats.outcome)} accent="bg-[#DC2626]" percent={stats.expected > 0 ? Math.round((stats.outcome / stats.expected) * 100) : 0} />
                  <MetricRow label="Movimientos" value={`${stats.operations}`} accent="bg-[#2563EB]" percent={100} />
                </div>
              </article>

              <article className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Actividad reciente</h2>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Ultimos eventos visibles para los filtros activos.</p>
                <div className="mt-6 space-y-3">
                  {filteredMovements.slice(0, 6).map(movement => (
                    <div key={movement.id} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                      <p className="text-[15px] font-semibold text-[#111827]">{movement.note || 'Movimiento manual de caja'}</p>
                      <p className="mt-1 text-[13px] font-medium text-[#64748B]">{categoryLabelMap[movement.category]} · {movement.userName}</p>
                    </div>
                  ))}
                </div>
              </article>
            </>
          )}

          {activeTab === 'CIERRE' && (
            <>
              <article className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Balance final</h2>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Comparativo operativo del arqueo actual.</p>
                <div className="mt-6 space-y-4">
                  <DetailLine label="Entradas del dia" value={formatCurrency(stats.income)} accent="text-[#16A34A]" />
                  <DetailLine label="Salidas del dia" value={formatCurrency(stats.outcome)} accent="text-[#DC2626]" />
                  <DetailLine label="Monto teorico" value={formatCurrency(stats.balance)} accent="text-[#2563EB]" />
                  <DetailLine label="Monto contado" value={countedCash ? formatCurrency(Number(countedCash)) : 'Pendiente'} />
                  <DetailLine label="Diferencia" value={closingDifference === null ? 'Pendiente' : formatCurrency(closingDifference)} accent={closingDifference && closingDifference !== 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'} />
                </div>
              </article>

              <article className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
                <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Estado de conciliacion</h2>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Validaciones base antes de cerrar la caja.</p>
                <div className="mt-6 space-y-5">
                  <MetricRow label="Notas revisadas" value={`${stats.operations - stats.pendingReview}/${Math.max(stats.operations, 1)}`} accent="bg-[#16A34A]" percent={stats.operations > 0 ? Math.round(((stats.operations - stats.pendingReview) / stats.operations) * 100) : 100} />
                  <MetricRow label="Saldo verificado" value={countedCash ? `${formatCurrency(Number(countedCash))}` : 'Pendiente'} accent="bg-[#2563EB]" percent={closingDifference === null ? 35 : closingDifference === 0 ? 100 : 55} />
                  <MetricRow label="Alertas activas" value={`${stats.pendingReview}`} accent="bg-[#F59E0B]" percent={stats.operations > 0 ? Math.round((stats.pendingReview / stats.operations) * 100) : 0} />
                </div>
              </article>
            </>
          )}

          {activeTab === 'HISTORIAL' && (
            <article className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Sucursal activa</h2>
              <p className="mt-2 text-[15px] font-medium text-[#64748B]">Referencia del historial que estas consultando.</p>
              <div className="mt-6 space-y-4">
                <DetailLine label="Sucursal" value={activeBranch?.name || 'Sucursal principal'} />
                <DetailLine label="Responsable" value={currentUser.name} />
                <DetailLine label="Movimientos visibles" value={`${filteredMovements.length}`} />
              </div>
            </article>
          )}
        </div>}
      </section>

      {isMovementInsightsOpen && (
        <div className="fixed inset-0 z-[315] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-8 py-7">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Apoyo operativo</p>
                <h3 className="mt-2 text-[26px] font-black tracking-tight text-[#111827]">Resumen de movimientos</h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Vista complementaria del tab de movimientos sin recargar la tabla principal.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMovementInsightsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-8 py-7">
              <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                <h4 className="text-[24px] font-black tracking-tight text-[#111827]">Resumen por tipo</h4>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Desglose de entradas, salidas y carga operativa visible.</p>
                <div className="mt-6 space-y-5">
                  <MetricRow label="Entradas" value={formatCurrency(stats.income)} accent="bg-[#16A34A]" percent={stats.expected > 0 ? Math.round((stats.income / stats.expected) * 100) : 0} />
                  <MetricRow label="Salidas" value={formatCurrency(stats.outcome)} accent="bg-[#DC2626]" percent={stats.expected > 0 ? Math.round((stats.outcome / stats.expected) * 100) : 0} />
                  <MetricRow label="Movimientos" value={`${stats.operations}`} accent="bg-[#2563EB]" percent={100} />
                </div>
              </section>

              <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-5">
                <h4 className="text-[24px] font-black tracking-tight text-[#111827]">Actividad reciente</h4>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Ultimos eventos visibles para los filtros activos.</p>
                <div className="mt-6 space-y-3">
                  {filteredMovements.length === 0 ? (
                    <EmptyState label="No hay actividad disponible." compact />
                  ) : (
                    filteredMovements.slice(0, 6).map(movement => (
                      <div key={movement.id} className="rounded-[22px] border border-[#F1F5F9] px-4 py-4">
                        <p className="text-[15px] font-semibold text-[#111827]">{movement.note || 'Movimiento manual de caja'}</p>
                        <p className="mt-1 text-[13px] font-medium text-[#64748B]">{categoryLabelMap[movement.category]} · {movement.userName}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-[platform-fade-in_220ms_ease-out]">
          <div className="platform-modal-panel w-full max-w-[640px] overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-8 py-7">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Movimiento manual</p>
                <h3 className="mt-2 text-[26px] font-black tracking-tight text-[#111827]">Registrar ajuste de caja</h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">Registra una entrada o salida operativa sin mezclar cobros de cuotas.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="platform-modal-close inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#64748B] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-8">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(previous => ({ ...previous, type: 'IN' }))}
                  className={`flex h-[56px] items-center justify-center gap-2 rounded-2xl border text-[15px] font-semibold transition-all duration-200 ${
                    formData.type === 'IN'
                      ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A] shadow-[0_16px_36px_rgba(22,163,74,0.10)]'
                      : 'border-[#E5E7EB] bg-white text-[#475569] hover:translate-x-1 hover:border-[#BBF7D0] hover:bg-[#F0FDF4]'
                  }`}
                >
                  <ArrowDownCircle size={18} />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(previous => ({ ...previous, type: 'OUT' }))}
                  className={`flex h-[56px] items-center justify-center gap-2 rounded-2xl border text-[15px] font-semibold transition-all duration-200 ${
                    formData.type === 'OUT'
                      ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] shadow-[0_16px_36px_rgba(220,38,38,0.10)]'
                      : 'border-[#E5E7EB] bg-white text-[#475569] hover:translate-x-1 hover:border-[#FECACA] hover:bg-[#FEF2F2]'
                  }`}
                >
                  <ArrowUpCircle size={18} />
                  Salida
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Categoria</label>
                  <FilterDropdown
                    id="movementCategory"
                    value={formData.category}
                    onChange={value => setFormData(previous => ({ ...previous, category: value as CashMovement['category'] }))}
                    isOpen={openFilterId === 'movementCategory'}
                    onToggle={() => setOpenFilterId(current => (current === 'movementCategory' ? null : 'movementCategory'))}
                    placeholder="Selecciona categoria"
                    options={categories.filter(item => item.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Monto</label>
                  <input
                    type="number"
                    required
                    value={formData.amount || ''}
                    onChange={event => setFormData(previous => ({ ...previous, amount: Number(event.target.value) }))}
                    placeholder="0.00"
                    className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 text-[24px] font-semibold tracking-tight text-[#111827] outline-none focus:border-[#93C5FD]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Detalle del movimiento</label>
                <textarea
                  value={formData.note}
                  onChange={event => setFormData(previous => ({ ...previous, note: event.target.value.slice(0, 180) }))}
                  placeholder="Describe la razon del ajuste, referencia o soporte..."
                  className="h-28 w-full rounded-[24px] border border-[#E5E7EB] bg-white px-5 py-4 text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-[#93C5FD]"
                />
                <div className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#94A3B8]">
                  <span>Incluye referencia o soporte del ajuste para trazabilidad.</span>
                  <span>{formData.note.length}/180</span>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-5">
                <div className="flex items-start gap-3">
                  <Info size={18} className="mt-0.5 shrink-0 text-[#2563EB]" />
                  <p className="text-[14px] font-medium text-[#1E3A8A]">
                    Este movimiento afecta el balance de caja de la sucursal. Usa esta opcion solo para ajustes manuales, no para registrar cobros de cuotas.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-8 text-[15px] font-semibold text-white shadow-[0_22px_44px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-1 hover:bg-black"
              >
                <Plus size={18} />
                Registrar en caja
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StaticFilter = ({ label }: { label: string }) => (
  <div className="flex h-[56px] items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 text-left">
    <span className="truncate text-[15px] font-semibold text-[#111827]">{label}</span>
    <ChevronDown size={18} className="text-[#CBD5E1]" />
  </div>
);

const MiniSummaryCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'red' | 'blue' | 'amber';
}) => {
  const toneClass = tone === 'green' ? 'text-[#16A34A]' : tone === 'red' ? 'text-[#DC2626]' : tone === 'amber' ? 'text-[#F59E0B]' : 'text-[#2563EB]';
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFE] px-4 py-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{label}</p>
      <p className={`mt-3 text-[18px] font-black tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
};

const SidebarCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <article className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
    <h2 className="text-[28px] font-black tracking-tight text-[#111827]">{title}</h2>
    <p className="mt-2 text-[15px] font-medium text-[#64748B]">{description}</p>
    <div className="mt-6 space-y-5">{children}</div>
  </article>
);

const QuickActionButton = ({
  label,
  detail,
  icon,
  onClick,
}: {
  label: string;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-[24px] border border-[#E5E7EB] bg-white px-4 py-4 text-left ${horizontalMotionClass}`}>
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F8FAFC]">{icon}</div>
      <div>
        <p className="text-[15px] font-semibold text-[#111827]">{label}</p>
        <p className="mt-1 text-[13px] font-medium text-[#64748B]">{detail}</p>
      </div>
    </div>
    <ArrowRight size={16} />
  </button>
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

const DetailLine = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#F1F5F9] px-4 py-3">
    <span className="text-[14px] font-medium text-[#64748B]">{label}</span>
    <span className={`text-[14px] font-semibold text-[#111827] ${accent || ''}`}>{value}</span>
  </div>
);

const ChecklistItem = ({ label, complete }: { label: string; complete: boolean }) => (
  <div className="flex items-center justify-between rounded-[20px] border border-[#F1F5F9] px-4 py-3">
    <div className="flex items-center gap-3">
      <CheckCircle2 size={18} className={complete ? 'text-[#16A34A]' : 'text-[#CBD5E1]'} />
      <span className="text-[14px] font-medium text-[#374151]">{label}</span>
    </div>
    <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${complete ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
      {complete ? 'Completado' : 'Pendiente'}
    </span>
  </div>
);

const MovementTypeIcon = ({ type, compact }: { type: CashMovement['type']; compact?: boolean }) => (
  <div className={`flex items-center justify-center rounded-2xl ${compact ? 'h-9 w-9' : 'h-11 w-11'} ${type === 'IN' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
    {type === 'IN' ? <PlusCircle size={compact ? 16 : 18} /> : <MinusCircle size={compact ? 16 : 18} />}
  </div>
);

const CategoryBadge = ({ category }: { category: CashMovement['category'] }) => {
  const tone =
    category === 'COBRO'
      ? 'bg-[#DCFCE7] text-[#16A34A]'
      : category === 'GASTO'
        ? 'bg-[#FEE2E2] text-[#DC2626]'
        : category === 'PRESTAMO'
          ? 'bg-[#DBEAFE] text-[#2563EB]'
          : 'bg-[#F8FAFC] text-[#64748B]';
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${tone}`}>{categoryLabelMap[category]}</span>;
};

const EmptyState = ({ label, compact }: { label: string; compact?: boolean }) => (
  <div className={`rounded-[24px] border border-dashed border-[#E5E7EB] text-center ${compact ? 'px-4 py-8' : 'px-6 py-16'}`}>
    <Landmark size={compact ? 28 : 40} className="mx-auto text-[#CBD5E1]" />
    <p className={`mt-4 font-semibold text-[#64748B] ${compact ? 'text-[14px]' : 'text-[16px]'}`}>{label}</p>
  </div>
);

const FilterDropdown = ({
  id,
  value,
  onChange,
  options,
  placeholder,
  isOpen,
  onToggle,
}: {
  id: 'branch' | 'type' | 'category' | 'movementCategory';
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    placement: 'bottom' as 'bottom' | 'top',
  });
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = containerRef.current?.contains(target);
      const isInsideMenu = menuRef.current?.contains(target);
      if (!isInsideTrigger && !isInsideMenu) {
        onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = Math.min(options.length + 1, 7) * 58 + 18;
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
    <div className={`relative ${isOpen ? 'z-[70]' : 'z-20'}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={`cash-filter-${id}`}
        onClick={onToggle}
        className={`flex h-[56px] w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition-all duration-200 ${
          isOpen
            ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
            : 'border-[#E5E7EB] hover:border-[#DBEAFE] hover:shadow-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#111827]">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen &&
        createPortal(
          <div
            id={`cash-filter-${id}`}
            ref={menuRef}
            onMouseDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}
            className="fixed z-[360] w-max max-w-[340px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
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
                onToggle();
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
                    onToggle();
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
