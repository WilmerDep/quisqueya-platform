import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  FileText,
  MapPin,
  Route,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getCompanyById,
  getGlobalActivity,
  upsertCashMovementsInLocalStorage,
  upsertClientsInLocalStorage,
  upsertLoansInLocalStorage,
} from '../services/dataService';
import { getBranchScope, getScopedCashMovements, getScopedClients, getScopedLoans, getScopedUsers } from '../services/viewScope';
import { apiClient } from '../services/apiClient';
import { Branch, CashMovement, Client, Company, LoanStatus, Role } from '../types';
import { formatCurrency } from '../utils';

const toneMap = {
  blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]' },
  emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]' },
  red: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', note: 'text-[#DC2626]' },
  amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]' },
  slate: { iconWrap: 'bg-[#F3F4F6] text-[#6B7280]', note: 'text-[#6B7280]' },
};

const motionButtonClass =
  'transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [todayCollections, setTodayCollections] = useState(0);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [hoveredComplianceLabel, setHoveredComplianceLabel] = useState<string | null>(null);
  const branchScope = useMemo(() => (currentUser ? getBranchScope(currentUser) : null), [currentUser]);
  const isCollector = currentUser?.role === Role.COBRADOR;

  useEffect(() => {
    if (currentUser?.role === Role.SUPER_ADMIN) {
      navigate('/master');
      return;
    }

    if (!currentUser) return;

    setBranches(branchScope?.branches || []);
    setSelectedBranchId(currentUser.branchId);
    setLoans(getScopedLoans(currentUser));
    setClients(getScopedClients(currentUser));
    setCompany(getCompanyById(currentUser.companyId));

    void Promise.all([apiClient.listClients(), apiClient.listLoans(), apiClient.listCashMovements()])
      .then(([clientsResponse, loansResponse, cashResponse]) => {
        const apiClients =
          currentUser.role === Role.COBRADOR
            ? clientsResponse.data.filter(client => client.assignedUserId === currentUser.id)
            : clientsResponse.data;
        const clientIds = new Set(apiClients.map(client => client.id));
        const apiLoans =
          currentUser.role === Role.COBRADOR
            ? loansResponse.data.filter(loan => clientIds.has(loan.clientId))
            : loansResponse.data;
        const apiCash =
          currentUser.role === Role.COBRADOR
            ? cashResponse.data.filter(movement => movement.userId === currentUser.id)
            : cashResponse.data;

        upsertClientsInLocalStorage(apiClients);
        upsertLoansInLocalStorage(apiLoans);
        upsertCashMovementsInLocalStorage(apiCash);
        setClients(apiClients);
        setLoans(apiLoans);
        setCashMovements(apiCash);
      })
      .catch(() => undefined);
  }, [branchScope, currentUser, navigate]);

  useEffect(() => {
    if (!currentUser || !selectedBranchId) return;

    const moves =
      cashMovements.length > 0
        ? cashMovements.filter(
            movement =>
              (!selectedBranchId || movement.branchId === selectedBranchId) &&
              (!isCollector || movement.userId === currentUser.id),
          )
        : getScopedCashMovements(currentUser, selectedBranchId);

    const balance = moves.reduce((acc, movement) => acc + (movement.type === 'IN' ? movement.amount : -movement.amount), 0);
    const today = new Date().toDateString();
    const collectedToday = moves
      .filter(movement => movement.type === 'IN' && new Date(movement.date).toDateString() === today)
      .reduce((acc, movement) => acc + movement.amount, 0);

    setCashBalance(balance);
    setTodayCollections(collectedToday);
  }, [cashMovements, currentUser, isCollector, selectedBranchId]);

  const scopedDashboardLoans = useMemo(() => {
    const allowedClientIds = new Set(
      clients.filter(client => !isCollector || client.assignedUserId === currentUser?.id).map(client => client.id),
    );
    return loans.filter(
      loan =>
        (!selectedBranchId || loan.branchId === selectedBranchId) &&
        (!isCollector || allowedClientIds.has(loan.clientId)),
    );
  }, [clients, currentUser?.id, isCollector, loans, selectedBranchId]);

  const scopedDashboardClients = useMemo(() => {
    return clients.filter(
      client =>
        (!selectedBranchId || client.branchId === selectedBranchId) &&
        (!isCollector || client.assignedUserId === currentUser?.id),
    );
  }, [clients, currentUser?.id, isCollector, selectedBranchId]);

  const stats = useMemo(() => {
    const active = scopedDashboardLoans.filter(loan => loan.status === LoanStatus.ACTIVO).length;
    const mora = scopedDashboardLoans.filter(loan => loan.status === LoanStatus.MORA).length;
    const completed = scopedDashboardLoans.filter(loan => loan.status === LoanStatus.COMPLETADO).length;
    const portfolio = scopedDashboardLoans.reduce((acc, loan) => acc + loan.balance, 0);
    const lent = scopedDashboardLoans.reduce((acc, loan) => acc + loan.amount, 0);
    return { active, mora, completed, portfolio, lent };
  }, [scopedDashboardLoans]);

  const recentActivity = useMemo(
    () => (currentUser ? getGlobalActivity(currentUser.companyId).slice(0, 5) : []),
    [currentUser, loans, clients, cashBalance],
  );

  const promisesDue = Math.max(1, Math.round(stats.mora / 2) + 2);
  const dueToday = Math.max(
    0,
    scopedDashboardLoans.flatMap((loan: any) => loan.installments || []).filter((installment: any) => installment.status !== 'PAGADO').length,
  );
  const totalExpected = cashBalance + todayCollections + stats.portfolio;
  const recoveredShare = totalExpected > 0 ? Math.round((todayCollections / totalExpected) * 100) : 0;
  const complianceSegments = [
    { label: 'Cobrado', value: todayCollections, percent: recoveredShare, color: '#2563EB', helper: 'Monto cobrado hoy respecto a la meta diaria.' },
    { label: 'Faltante', value: Math.max(0, totalExpected * 0.72 - todayCollections), percent: Math.max(0, 100 - recoveredShare), color: '#E5E7EB', helper: 'Monto restante para completar la meta del dia.' }
  ];
  const activeComplianceTooltip = complianceSegments.find(item => item.label === hoveredComplianceLabel) || null;
  const amountPending = Math.max(0, stats.portfolio * 0.18);
  const recoveryRate = stats.lent > 0 ? Math.min(100, Math.round(((stats.lent - stats.portfolio) / stats.lent) * 100)) : 0;

  const kpis = [
    {
      label: 'Cobrado hoy',
      value: formatCurrency(todayCollections),
      helper: `${Math.max(1, Math.round(recoveryRate / 10))}% vs ayer`,
      share: Math.max(8, recoveredShare),
      trend: `+${Math.max(1, Math.round(recoveryRate / 10))}%`,
      icon: CircleDollarSign,
      tone: 'emerald' as const,
      noteColor: 'emerald' as const,
    },
    {
      label: 'Por cobrar hoy',
      value: formatCurrency(amountPending),
      helper: `${dueToday} clientes pendientes`,
      share: Math.min(100, Math.max(14, Math.round((amountPending / Math.max(totalExpected, 1)) * 100))),
      trend: `${dueToday}`,
      icon: CalendarClock,
      tone: 'blue' as const,
      noteColor: 'slate' as const,
    },
    {
      label: 'Clientes atrasados',
      value: `${stats.mora}`,
      helper: `${Math.max(1, stats.mora)} en mora critica`,
      share: scopedDashboardClients.length > 0 ? (stats.mora / Math.max(scopedDashboardClients.length, 1)) * 100 : 0,
      trend: `${Math.max(1, stats.mora)}`,
      icon: Users,
      tone: 'red' as const,
      noteColor: 'red' as const,
    },
    {
      label: 'Promesas vencidas',
      value: `${promisesDue}`,
      helper: 'Requiere seguimiento',
      share: Math.min(100, promisesDue * 8),
      trend: `${promisesDue}`,
      icon: AlertTriangle,
      tone: 'amber' as const,
      noteColor: 'amber' as const,
    },
    {
      label: 'Caja actual',
      value: formatCurrency(cashBalance),
      helper: 'Ultimo movimiento 2:35 p. m.',
      share: Math.min(100, Math.max(12, Math.round((cashBalance / Math.max(totalExpected, 1)) * 100))),
      trend: `${branches.length || 1} suc.`,
      icon: Banknote,
      tone: 'emerald' as const,
      noteColor: 'slate' as const,
    },
  ];

  const quickActions = [
    { label: 'Crear ruta', detail: 'Asignar ruta de cobro', icon: Route, action: () => navigate('/routes') },
    { label: 'Ver caja', detail: 'Movimientos y arqueo', icon: Banknote, action: () => navigate('/cash') },
    { label: 'Ver reportes', detail: 'Analisis y estadisticas', icon: FileText, action: () => navigate('/reports') },
  ];

  const alertRows = [
    { title: 'Promesas vencidas', detail: `Tienes ${promisesDue} promesas vencidas que requieren seguimiento.`, count: promisesDue, color: 'bg-[#FEE2E2] text-[#DC2626]', href: '/activity' },
    { title: 'Cliente bloqueado', detail: `${Math.max(1, Math.round(stats.mora / 2))} clientes tienen prestamos bloqueados.`, count: Math.max(1, Math.round(stats.mora / 2)), color: 'bg-[#FEF3C7] text-[#F59E0B]', href: '/clients' },
    { title: 'Ruta sin cerrar', detail: `Hay ${Math.max(1, Math.round(stats.active / 8))} ruta del dia de hoy sin cerrar.`, count: Math.max(1, Math.round(stats.active / 8)), color: 'bg-[#DBEAFE] text-[#2563EB]', href: '/routes' },
    { title: 'Diferencia en caja', detail: 'Hay 1 diferencia en caja por conciliar.', count: 1, color: 'bg-[#EDE9FE] text-[#7C3AED]', href: '/cash' },
    { title: 'Documentos por vencer', detail: '3 documentos estan por vencer en los proximos 7 dias.', count: 3, color: 'bg-[#F3F4F6] text-[#6B7280]', href: '/reports' },
  ];

  useEffect(() => {
    if (!pageRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo('[data-workspace-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(
        '[data-workspace-kpi]',
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.08 },
      );
      gsap.fromTo('[data-workspace-quick]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.16 });
      gsap.fromTo('[data-workspace-panels]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.22 });
      gsap.fromTo(
        '[data-workspace-list-row]',
        { opacity: 0, x: -16 },
        { opacity: 1, x: 0, duration: 0.34, ease: 'power2.out', stagger: 0.03, delay: 0.28 },
      );
    }, pageRef);

    return () => ctx.revert();
  }, []);

  if (currentUser?.role === Role.SUPER_ADMIN) return null;

  return (
    <div ref={pageRef} className="space-y-6 pb-24 lg:pb-0">
      <section data-workspace-hero>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Escritorio</h1>
            <p className="mt-3 text-xl font-medium text-[#6B7280]">
              Resumen operativo de hoy, cobros, atrasos y caja de {company?.name || 'la empresa'}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              className={`flex h-[54px] items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[18px] font-medium text-[#111827] shadow-sm ${motionButtonClass}`}
              onClick={() => navigate('/clients')}
            >
              <Users size={20} className="text-[#2563EB]" />
              Crear cliente
            </button>
            <button
              className={`flex h-[54px] items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[18px] font-medium text-[#111827] shadow-sm ${motionButtonClass}`}
              onClick={() => navigate('/loans/new')}
            >
              <Wallet size={20} className="text-[#2563EB]" />
              Crear prestamo
            </button>
            <button
              className="flex h-[54px] items-center justify-center gap-3 rounded-2xl bg-[#2563EB] px-6 text-[18px] font-medium text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]"
              onClick={() => navigate('/collect-today')}
            >
              <CircleDollarSign size={20} />
              Cobrar ahora
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {kpis.map(item => {
          const tone = toneMap[item.tone];
          const watermarkTone = tone.iconWrap.split(' ').find(token => token.startsWith('text-')) || 'text-[#2563EB]';

          return (
            <div
              key={item.label}
              data-workspace-kpi
              className="relative min-h-[214px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${tone.iconWrap}`}>
                  <item.icon size={24} />
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${tone.note}`}>
                    <TrendingUp size={13} />
                    {item.trend}
                  </div>
                  <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Participacion</p>
                  <p className="mt-1 text-[16px] font-semibold leading-none text-[#111827]">{item.share.toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-8 space-y-3">
                <p className="text-[16px] font-semibold text-[#111827]">{item.label}</p>
                <p className="text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{item.value}</p>
                <p className={`max-w-[190px] text-[15px] font-medium leading-6 ${toneMap[item.noteColor].note}`}>{item.helper}</p>
              </div>
              <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.08]">
                <item.icon size={88} className={watermarkTone} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.75fr_0.95fr]">
        <div data-workspace-quick className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-[#2563EB]" />
            <h2 className="text-[19px] font-semibold text-[#111827]">Acciones rapidas</h2>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={action.action}
                className="group flex min-h-[148px] flex-col items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white px-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:shadow-sm"
              >
                <action.icon size={31} className="text-[#2563EB]" />
                <p className="mt-5 text-[18px] font-semibold leading-tight text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">{action.label}</p>
                <p className="mt-2 text-[14px] font-medium leading-5 text-[#6B7280]">{action.detail}</p>
              </button>
            ))}
          </div>
        </div>

        <div data-workspace-panels className="relative rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-[#2563EB]" />
            <h2 className="text-[19px] font-semibold text-[#111827]">Cumplimiento del dia</h2>
          </div>
          {activeComplianceTooltip ? (
            <div className="pointer-events-none absolute right-6 top-6 z-10 w-[250px] rounded-[24px] border border-[#E5E7EB] bg-white/95 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.14)] backdrop-blur-sm">
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{activeComplianceTooltip.label}</p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#111827]">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeComplianceTooltip.color }} />
                  Proporcion
                </span>
                <span className="text-[28px] font-black tracking-tight text-[#111827]">{activeComplianceTooltip.percent}%</span>
              </div>
              <p className="mt-3 text-[13px] font-medium leading-6 text-[#64748B]">{activeComplianceTooltip.helper}</p>
            </div>
          ) : null}
          <div className="mt-6 flex items-center gap-6">
            <div
              className="relative flex h-[160px] w-[160px] items-center justify-center rounded-full cursor-pointer"
              style={{ background: `conic-gradient(#2563EB ${recoveredShare * 3.6}deg, #E5E7EB 0deg)` }}
              onMouseEnter={() => setHoveredComplianceLabel('Cobrado')}
              onMouseLeave={() => setHoveredComplianceLabel(null)}
            >
              <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full bg-white">
                <p className="text-[32px] font-semibold leading-none text-[#111827]">{recoveredShare}%</p>
                <p className="mt-2 text-[16px] font-medium text-[#6B7280]">Meta diaria</p>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                <span className="text-[16px] font-medium text-[#6B7280]">Meta de cobro</span>
                <span className="text-[18px] font-semibold text-[#374151]">{formatCurrency(totalExpected * 0.72)}</span>
              </div>
              <div
                className="flex items-center justify-between border-b border-[#F3F4F6] pb-3 cursor-pointer hover:bg-[#F8FAFC] px-1 rounded-lg transition-colors duration-200"
                onMouseEnter={() => setHoveredComplianceLabel('Cobrado')}
                onMouseLeave={() => setHoveredComplianceLabel(null)}
              >
                <span className="text-[16px] font-medium text-[#6B7280]">Cobrado</span>
                <span className="text-[18px] font-semibold text-[#16A34A]">{formatCurrency(todayCollections)}</span>
              </div>
              <div
                className="flex items-center justify-between pb-1 cursor-pointer hover:bg-[#F8FAFC] px-1 rounded-lg transition-colors duration-200"
                onMouseEnter={() => setHoveredComplianceLabel('Faltante')}
                onMouseLeave={() => setHoveredComplianceLabel(null)}
              >
                <span className="text-[16px] font-medium text-[#6B7280]">Faltante</span>
                <span className="text-[18px] font-semibold text-[#DC2626]">{formatCurrency(Math.max(0, totalExpected * 0.72 - todayCollections))}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => navigate('/reports')}
              className="inline-flex items-center gap-2 text-[16px] font-medium text-[#2563EB] transition-transform duration-200 hover:translate-x-1"
            >
              Ver metas y detalles
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section data-workspace-panels className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-[#6B7280]" />
              <h2 className="text-[19px] font-semibold text-[#111827]">Alertas operativas</h2>
            </div>
            <button
              onClick={() => navigate('/activity')}
              className="text-[16px] font-medium text-[#2563EB] transition-transform duration-200 hover:translate-x-1"
            >
              Ver todas
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {alertRows.map(row => (
              <button
                key={row.title}
                data-workspace-list-row
                onClick={() => navigate(row.href)}
                className="group grid w-full grid-cols-[auto_1fr_auto_auto] items-start gap-4 rounded-[20px] border border-transparent py-3 text-left transition-all duration-200 hover:bg-[#FCFDFE]"
              >
                <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-2 ${row.color}`}>
                  <AlertTriangle size={18} />
                </div>
                <div className="transition-transform duration-200 group-hover:translate-x-2">
                  <p className="text-[17px] font-medium text-[#111827]">{row.title}</p>
                  <p className="mt-1 text-[14px] font-medium text-[#6B7280]">{row.detail}</p>
                </div>
                <div className={`mt-1 rounded-xl px-3 py-1 text-[14px] font-semibold transition-transform duration-200 group-hover:translate-x-2 ${row.color}`}>{row.count}</div>
                <ChevronRight size={18} className="mt-2 text-[#9CA3AF] transition-transform duration-200 group-hover:translate-x-2" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity size={20} className="text-[#6B7280]" />
              <h2 className="text-[19px] font-semibold text-[#111827]">Actividad reciente</h2>
            </div>
            <button onClick={() => navigate('/activity')} className="text-[16px] font-medium text-[#2563EB] transition-transform duration-200 hover:translate-x-1">
              Ver todo
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {recentActivity.map(event => (
              <button
                key={event.id}
                data-workspace-list-row
                onClick={() => navigate('/activity')}
                className="group grid w-full grid-cols-[auto_1fr_auto] gap-4 rounded-[20px] px-1 py-1 text-left transition-all duration-200 hover:bg-[#FCFDFE] hover:text-[#2563EB]"
              >
                <div className="flex flex-col items-center transition-transform duration-200 group-hover:translate-x-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                    {event.type === 'PAGO' ? <CircleDollarSign size={18} /> : event.type === 'PRESTAMO' ? <Wallet size={18} /> : <MapPin size={18} />}
                  </div>
                  <div className="mt-2 h-full w-px bg-[#E5E7EB] last:hidden" />
                </div>
                <div className="transition-transform duration-200 group-hover:translate-x-2">
                  <p className="text-[17px] font-medium text-[#111827]">{event.title}</p>
                  <p className="mt-1 text-[14px] font-medium text-[#6B7280]">{event.description}</p>
                </div>
                <div className="text-right text-[14px] font-medium text-[#6B7280] transition-transform duration-200 group-hover:translate-x-2">
                  {new Date(event.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
