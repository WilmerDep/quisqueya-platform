import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { getCompanyById, upsertClientsInLocalStorage, upsertLoansInLocalStorage } from '../services/dataService';
import { getBranchScope, getScopedClients, getScopedLoans } from '../services/viewScope';
import { Branch, Client, Company, Frequency, Loan, LoanStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { formatCurrency, formatDate } from '../utils';
import { Badge } from '../components/ui/Badge';
import { ClientAvatar } from '../components/ui/ClientAvatar';

const pageSize = 10;

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const motionButtonClass =
  'cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

const loanKpiToneMap = {
  blue: { iconWrap: 'bg-[#DBEAFE] text-[#2563EB]', note: 'text-[#2563EB]', watermark: 'text-[#DBEAFE]' },
  emerald: { iconWrap: 'bg-[#DCFCE7] text-[#16A34A]', note: 'text-[#16A34A]', watermark: 'text-[#DCFCE7]' },
  red: { iconWrap: 'bg-[#FEE2E2] text-[#DC2626]', note: 'text-[#DC2626]', watermark: 'text-[#FEE2E2]' },
  amber: { iconWrap: 'bg-[#FEF3C7] text-[#F59E0B]', note: 'text-[#F59E0B]', watermark: 'text-[#FEF3C7]' },
} as const;

export const LoansPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, selectedBranchId, setSelectedBranchId } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);

  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const canSeeAllCompanyUsers = branchScope.canSeeAllCompanyUsers;

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [clientsResponse, loansResponse] = await Promise.all([apiClient.listClients(), apiClient.listLoans()]);
        if (cancelled) return;
        upsertClientsInLocalStorage(clientsResponse.data);
        upsertLoansInLocalStorage(loansResponse.data);
        setClients(clientsResponse.data);
        setLoans(loansResponse.data);
      } catch {
        if (cancelled) return;
        setClients(getScopedClients(currentUser));
        setLoans(getScopedLoans(currentUser));
      }
    };

    loadData();
    setBranches(branchScope.branches);
    setCompany(getCompanyById(currentUser.companyId));

    return () => {
      cancelled = true;
    };
  }, [branchScope, currentUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranchId, selectedStatus, selectedFrequency]);

  const clientMap = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients]);
  const branchMap = useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches]);

  const loansWithContext = useMemo(() => {
    return loans.map(loan => {
      const client = clientMap.get(loan.clientId);
      const nextInstallment = loan.installments.find(installment => installment.status !== 'PAGADO');
      const overdueInstallments = loan.installments.filter(installment => installment.status === 'VENCIDO').length;
      return {
        loan,
        client,
        nextInstallment,
        overdueInstallments,
      };
    });
  }, [clientMap, loans]);

  const filteredLoans = useMemo(() => {
    let result = [...loansWithContext];

    if (selectedBranchId) result = result.filter(entry => entry.loan.branchId === selectedBranchId);
    if (selectedStatus) result = result.filter(entry => entry.loan.status === selectedStatus);
    if (selectedFrequency) result = result.filter(entry => entry.loan.frequency === selectedFrequency);

    if (searchTerm) {
      const query = normalizeText(searchTerm);
      result = result.filter(entry => {
        const clientName = `${entry.client?.firstName || ''} ${entry.client?.lastName || ''}`;
        const searchable = normalizeText(
          [
            entry.loan.id,
            entry.client?.cedula || '',
            entry.client?.phone || '',
            clientName,
            entry.client?.nickname || '',
            branchMap.get(entry.loan.branchId)?.name || '',
          ].join(' '),
        );
        return searchable.includes(query);
      });
    }

    return result.sort((a, b) => new Date(b.loan.createdAt).getTime() - new Date(a.loan.createdAt).getTime());
  }, [branchMap, loansWithContext, searchTerm, selectedBranchId, selectedFrequency, selectedStatus]);

  const metrics = useMemo(() => {
    const total = loansWithContext.length;
    const active = loansWithContext.filter(entry => entry.loan.status === LoanStatus.ACTIVO).length;
    const inMora = loansWithContext.filter(entry => entry.loan.status === LoanStatus.MORA).length;
    const completed = loansWithContext.filter(entry => entry.loan.status === LoanStatus.COMPLETADO).length;
    const portfolio = loansWithContext.reduce((sum, entry) => sum + entry.loan.balance, 0);
    const lent = loansWithContext.reduce((sum, entry) => sum + entry.loan.amount, 0);
    return { total, active, inMora, completed, portfolio, lent };
  }, [loansWithContext]);

  const metricCards = useMemo(() => {
    const total = Math.max(metrics.total, 1);
    return [
      {
        label: 'Total prestamos',
        value: metrics.total,
        share: 100,
        helper: 'Base general de cartera',
        icon: Wallet,
        trend: `${metrics.total}`,
        trendTone: 'text-[#2563EB]',
        tone: 'blue' as const,
      },
      {
        label: 'Activos',
        value: metrics.active,
        share: (metrics.active / total) * 100,
        helper: 'Con cobranza en curso',
        icon: ShieldCheck,
        trend: `${metrics.active}`,
        trendTone: 'text-[#16A34A]',
        tone: 'emerald' as const,
      },
      {
        label: 'En mora',
        value: metrics.inMora,
        share: (metrics.inMora / total) * 100,
        helper: 'Requieren prioridad operativa',
        icon: CircleAlert,
        trend: `${metrics.inMora}`,
        trendTone: 'text-[#DC2626]',
        tone: 'red' as const,
      },
      {
        label: 'Saldados',
        value: metrics.completed,
        share: (metrics.completed / total) * 100,
        helper: 'Ciclos ya completados',
        icon: ArrowUpRight,
        trend: `${metrics.completed}`,
        trendTone: 'text-[#2563EB]',
        tone: 'blue' as const,
      },
      {
        label: 'Cartera pendiente',
        value: formatCurrency(metrics.portfolio),
        share: total ? (metrics.portfolio / Math.max(metrics.lent, 1)) * 100 : 0,
        helper: 'Saldo global por recuperar',
        icon: ArrowDownRight,
        trend: formatCurrency(metrics.lent),
        trendTone: 'text-[#D97706]',
        tone: 'amber' as const,
      },
    ];
  }, [metrics]);

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLoans = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredLoans.slice(start, start + pageSize);
  }, [filteredLoans, safeCurrentPage]);

  const visiblePages = useMemo(() => {
    const pages = new Set<number>();
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    [1, safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, totalPages].forEach(page => {
      if (page >= 1 && page <= totalPages) pages.add(page);
    });
    return Array.from(pages).sort((a, b) => a - b);
  }, [safeCurrentPage, totalPages]);

  useEffect(() => {
    if (!pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-loans-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(
        '[data-loans-kpi]',
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out', stagger: 0.07, delay: 0.06 },
      );
      gsap.fromTo('[data-loans-filters]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.14 });
      gsap.fromTo('[data-loans-list]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.52, ease: 'power3.out', delay: 0.2 });
      gsap.fromTo('[data-loan-row]', { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.34, ease: 'power2.out', stagger: 0.035, delay: 0.26 });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  const resetFilters = () => {
    setSelectedBranchId(canSeeAllCompanyUsers ? '' : currentUser.branchId);
    setSelectedStatus('');
    setSelectedFrequency('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  return (
    <div ref={pageRef} className="space-y-6 pb-24">
      <section data-loans-hero className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-[32px] font-semibold leading-[1.1] tracking-tight text-[#111827]">Prestamos</h1>
          <p className="mt-3 text-xl font-medium text-[#6B7280]">Gestiona cartera, saldo pendiente, mora, ciclos activos y nuevos desembolsos.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={() => setIsPortfolioOpen(true)} className={`flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}>
            <ShieldCheck size={18} />
            Estado de cartera
          </button>
          <button className={`flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}>
            <Download size={18} />
            Exportar
          </button>
          <button onClick={() => navigate('/loans/new')} className="flex h-[56px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[17px] font-medium text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]">
            <Plus size={18} />
            Crear prestamo
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        {metricCards.map(card => {
          const Icon = card.icon;
          const tone = loanKpiToneMap[card.tone];
          return (
            <article key={card.label} data-loans-kpi className="group relative overflow-hidden rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${tone.iconWrap}`}>
                  <Icon size={24} />
                </div>
                <div className={`rounded-full bg-[#F8FAFC] px-3 py-1 text-[12px] font-semibold ${card.trendTone}`}>
                  {card.trend}
                </div>
              </div>
              <div className="relative z-10 mt-8">
                <div className="flex items-start justify-between gap-4">
                  <p className="max-w-[150px] text-[14px] font-semibold text-[#111827]">{card.label}</p>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">Participacion</p>
                    <p className="mt-1 text-[15px] font-bold text-[#111827]">{Math.min(card.share, 100).toFixed(1)}%</p>
                  </div>
                </div>
                <p className="mt-4 text-[28px] font-semibold leading-none tracking-tight text-[#111827]">{card.value}</p>
                <p className={`mt-3 max-w-[185px] text-[15px] font-medium leading-6 ${tone.note}`}>{card.helper}</p>
              </div>
              <Icon size={80} className={`absolute bottom-4 right-4 ${tone.watermark} opacity-80`} strokeWidth={1.7} />
            </article>
          );
        })}
      </section>

      <section data-loans-filters className="relative z-30 rounded-[32px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[220px_220px_220px_minmax(0,1fr)_220px]">
          <FilterDropdown
            label={selectedBranchId ? branchMap.get(selectedBranchId)?.name || 'Sucursal' : 'Todas las sucursales'}
            options={[
              ...(canSeeAllCompanyUsers ? [{ label: 'Todas las sucursales', value: '' }] : []),
              ...branches.map(branch => ({ label: branch.name, value: branch.id })),
            ]}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
          />
          <FilterDropdown
            label={selectedStatus || 'Todos los estados'}
            options={[
              { label: 'Todos los estados', value: '' },
              { label: LoanStatus.ACTIVO, value: LoanStatus.ACTIVO },
              { label: LoanStatus.MORA, value: LoanStatus.MORA },
              { label: LoanStatus.COMPLETADO, value: LoanStatus.COMPLETADO },
              { label: LoanStatus.CANCELADO, value: LoanStatus.CANCELADO },
            ]}
            value={selectedStatus}
            onChange={setSelectedStatus}
          />
          <FilterDropdown
            label={selectedFrequency || 'Todas las frecuencias'}
            options={[
              { label: 'Todas las frecuencias', value: '' },
              { label: Frequency.DIARIO, value: Frequency.DIARIO },
              { label: Frequency.SEMANAL, value: Frequency.SEMANAL },
              { label: Frequency.QUINCENAL, value: Frequency.QUINCENAL },
              { label: Frequency.MENSUAL, value: Frequency.MENSUAL },
            ]}
            value={selectedFrequency}
            onChange={setSelectedFrequency}
          />
          <label className="flex h-[56px] items-center gap-3 rounded-[18px] border border-[#E5E7EB] bg-white px-4">
            <Search size={20} className="text-[#6B7280]" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, cedula, telefono o prestamo"
              className="w-full bg-transparent text-[17px] font-medium text-[#111827] outline-none placeholder:text-[#9CA3AF]"
            />
          </label>
          <button onClick={resetFilters} className={`flex h-[56px] items-center justify-center gap-2 rounded-[18px] border border-[#E5E7EB] bg-white px-4 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}>
            <Filter size={18} />
            Limpiar filtros
          </button>
        </div>
      </section>

      <section data-loans-list className="rounded-[32px] border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <div className="flex items-center gap-4">
            <h2 className="text-[24px] font-semibold tracking-tight text-[#111827]">Listado de prestamos</h2>
            <div className="inline-flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
              <span className="text-sm font-medium text-[#64748B]">{filteredLoans.length} registros</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-[#94A3B8]">{company?.name || 'ABUNDRA'}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-[#FCFDFF] text-left text-[12px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-4 py-4 text-center">Frecuencia</th>
                <th className="px-4 py-4 text-center">Monto</th>
                <th className="px-4 py-4 text-center">Saldo</th>
                <th className="px-4 py-4 text-center">Prox. cuota</th>
                <th className="px-4 py-4 text-center">Estado</th>
                <th className="px-4 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLoans.map(({ loan, client, nextInstallment, overdueInstallments }) => (
                <LoanRow
                  key={loan.id}
                  loan={loan}
                  client={client}
                  nextInstallment={nextInstallment ? { amount: nextInstallment.expectedAmount, dueDate: nextInstallment.dueDate } : null}
                  overdueInstallments={overdueInstallments}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E7EB] px-6 py-5">
          <p className="text-sm font-medium text-[#6B7280]">
            Mostrando {(safeCurrentPage - 1) * pageSize + 1} a {Math.min(safeCurrentPage * pageSize, filteredLoans.length)} de {filteredLoans.length} registros
          </p>
          <div className="flex items-center gap-2">
            <button disabled={safeCurrentPage === 1} onClick={() => setCurrentPage(previous => Math.max(previous - 1, 1))} className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] ${motionButtonClass} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0`}>
              <ChevronLeft size={18} />
            </button>
            {visiblePages.map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`flex h-11 min-w-11 items-center justify-center rounded-2xl border px-3 text-sm font-semibold transition-all duration-200 ${
                  safeCurrentPage === page
                    ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB]'
                    : `border-transparent bg-transparent text-[#111827] ${motionButtonClass}`
                }`}
              >
                {page}
              </button>
            ))}
            <button disabled={safeCurrentPage === totalPages} onClick={() => setCurrentPage(previous => Math.min(previous + 1, totalPages))} className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] ${motionButtonClass} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0`}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {isPortfolioOpen ? (
        <PortfolioDrawer
          metrics={metrics}
          onClose={() => setIsPortfolioOpen(false)}
        />
      ) : null}
    </div>
  );
};

const LoanRow = ({
  loan,
  client,
  nextInstallment,
  overdueInstallments,
}: {
  loan: Loan;
  client?: Client;
  nextInstallment: { amount: number; dueDate: string } | null;
  overdueInstallments: number;
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-loan-actions-menu]') && !triggerRef.current?.contains(target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const toggleMenu = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 10, left: rect.right - 220 });
    setIsOpen(previous => !previous);
  };

  return (
    <tr data-loan-row className="group border-t border-[#F1F5F9] text-sm font-medium text-[#374151]">
      <td className="px-6 py-5">
        <div className="min-w-0 transition-transform duration-200 group-hover:translate-x-2">
          {client ? (
            <button
              onClick={() => navigate(`/clients/${client.id}`)}
              className="flex min-w-0 items-center gap-4 text-left cursor-pointer"
            >
              <ClientAvatar
                client={client}
                className="h-12 w-12 rounded-full shadow-[0_10px_22px_rgba(37,99,235,0.12)]"
                textClassName="text-lg font-black text-[#2563EB]"
                alt={`${client.firstName} ${client.lastName}`}
              />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#111827] transition-colors duration-200 group-hover:text-[#2563EB]">
                  {client.firstName} {client.lastName}
                </p>
                <p className="mt-1 text-sm font-medium text-[#6B7280]">
                  {client.cedula} • {client.phone}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#94A3B8]">{loan.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-4 text-left">
              <ClientAvatar
                className="h-12 w-12 rounded-full shadow-[0_10px_22px_rgba(37,99,235,0.12)]"
                textClassName="text-lg font-black text-[#2563EB]"
                alt="Prestamo"
              />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#111827]">
                  {loan.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-5 text-center">{loan.frequency}</td>
      <td className="px-4 py-5 text-center font-semibold text-[#111827]">{formatCurrency(loan.amount)}</td>
      <td className="px-4 py-5 text-center">
        <div>
          <p className="font-semibold text-[#111827]">{formatCurrency(loan.balance)}</p>
          <p className="mt-1 text-xs font-medium text-[#6B7280]">{overdueInstallments > 0 ? `${overdueInstallments} vencidas` : 'Al dia'}</p>
        </div>
      </td>
      <td className="px-4 py-5 text-center">
        {nextInstallment ? (
          <div>
            <p className="font-semibold text-[#111827]">{formatCurrency(nextInstallment.amount)}</p>
            <p className="mt-1 text-xs font-medium text-[#6B7280]">{formatDate(nextInstallment.dueDate)}</p>
          </div>
        ) : (
          <span className="text-sm font-medium text-[#94A3B8]">Sin cuota</span>
        )}
      </td>
      <td className="px-4 py-5 text-center">
        <div className="flex justify-center">
          <Badge status={loan.status} />
        </div>
      </td>
      <td className="px-4 py-5 text-center">
        <button ref={triggerRef} onClick={toggleMenu} className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#6B7280] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]">
          <MoreHorizontal size={18} />
        </button>
        {isOpen && position
          ? createPortal(
              <div data-loan-actions-menu className="fixed z-[260] w-[220px] rounded-[24px] border border-[#E5E7EB] bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" style={{ top: position.top, left: position.left }}>
                <button
                  onClick={() => {
                    if (client) navigate(`/clients/${client.id}`);
                    setIsOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                >
                  <Eye size={16} className="text-[#2563EB]" />
                  Ver cliente
                </button>
                <button
                  onClick={() => {
                    navigate('/collect-today');
                    setIsOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                >
                  <Wallet size={16} className="text-[#2563EB]" />
                  Cobrar hoy
                </button>
                <button
                  onClick={() => {
                    navigate('/loans/new', { state: { clientId: client?.id } });
                    setIsOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-[#111827] transition-all duration-200 hover:translate-x-1 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
                >
                  <Plus size={16} className="text-[#2563EB]" />
                  Nuevo prestamo
                </button>
              </div>,
              document.body,
            )
          : null}
      </td>
    </tr>
  );
};

const FilterDropdown = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(previous => !previous)}
        className={`flex h-[56px] w-full cursor-pointer items-center justify-between rounded-[18px] border px-4 text-left text-[17px] font-medium transition-all duration-200 ${
          isOpen ? 'border-[#111827] bg-white text-[#111827] shadow-[0_16px_36px_rgba(15,23,42,0.08)]' : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#DBEAFE] hover:text-[#2563EB]'
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={18} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#111827]' : 'text-[#6B7280]'}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[250] w-max min-w-[260px] max-w-[340px] rounded-[24px] border border-[#E5E7EB] bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="space-y-1">
            {options.map(option => (
              <button
                key={`${option.label}-${option.value}`}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 hover:translate-x-1 ${
                  value === option.value ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                }`}
              >
                <span>{option.label}</span>
                {value === option.value ? <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const PortfolioDrawer = ({
  metrics,
  onClose,
}: {
  metrics: {
    total: number;
    active: number;
    inMora: number;
    completed: number;
    portfolio: number;
    lent: number;
  };
  onClose: () => void;
}) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const recoveryRatio = metrics.lent > 0 ? Math.max(0, ((metrics.lent - metrics.portfolio) / metrics.lent) * 100) : 0;
  const delinquencyRatio = metrics.total > 0 ? (metrics.inMora / metrics.total) * 100 : 0;

  useEffect(() => {
    if (!modalRef.current || !overlayRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      gsap.fromTo(modalRef.current, { opacity: 0, y: 22, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' });
    });
    return () => ctx.revert();
  }, []);

  const handleClose = () => {
    if (isLeaving || !modalRef.current || !overlayRef.current) return;
    setIsLeaving(true);
    gsap.to(modalRef.current, { opacity: 0, y: 18, scale: 0.985, duration: 0.2, ease: 'power2.inOut' });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.18, ease: 'power2.inOut', onComplete: onClose });
  };

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[280] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <button aria-label="Cerrar" className="absolute inset-0 cursor-default" onClick={handleClose} />
      <aside ref={modalRef} className="relative z-[1] max-h-[92vh] w-full max-w-[920px] overflow-y-auto rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Prestamos</p>
            <h3 className="mt-2 text-[24px] font-semibold tracking-tight text-[#111827]">Estado de cartera</h3>
          </div>
          <button onClick={handleClose} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[#E5E7EB] text-[#6B7280] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="grid gap-4 md:grid-cols-2">
            <PortfolioStatCard label="Cartera pendiente" value={formatCurrency(metrics.portfolio)} tone="blue" />
            <PortfolioStatCard label="Capital colocado" value={formatCurrency(metrics.lent)} tone="amber" />
            <PortfolioStatCard label="Prestamos en mora" value={`${metrics.inMora}`} tone="red" />
            <PortfolioStatCard label="Prestamos saldados" value={`${metrics.completed}`} tone="green" />
          </section>

          <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h4 className="text-xl font-black tracking-tight text-[#111827]">Indicadores clave</h4>
            <div className="mt-5 space-y-5">
              <PortfolioLine label="Recuperacion estimada" value={`${recoveryRatio.toFixed(1)}%`} tone="green" progress={Math.min(recoveryRatio, 100)} />
              <PortfolioLine label="Indice de mora" value={`${delinquencyRatio.toFixed(1)}%`} tone="red" progress={Math.min(delinquencyRatio, 100)} />
              <PortfolioLine label="Prestamos activos" value={`${metrics.active}`} tone="blue" progress={metrics.total ? (metrics.active / metrics.total) * 100 : 0} />
            </div>
          </section>

          <section className="rounded-[28px] border border-[#E5E7EB] bg-[#F8FAFC] p-6">
            <h4 className="text-lg font-black tracking-tight text-[#111827]">Lectura operativa</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm font-medium text-[#6B7280]">
              <p>Activos: <span className="font-semibold text-[#111827]">{metrics.active}</span></p>
              <p>En mora: <span className="font-semibold text-[#111827]">{metrics.inMora}</span></p>
              <p>Saldados: <span className="font-semibold text-[#111827]">{metrics.completed}</span></p>
              <p>Total de cartera: <span className="font-semibold text-[#111827]">{metrics.total}</span></p>
            </div>
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
};

const PortfolioStatCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'amber' | 'red' | 'green';
}) => {
  const toneClass =
    tone === 'blue'
      ? 'bg-[#EFF6FF] text-[#2563EB]'
      : tone === 'amber'
        ? 'bg-[#FEF3C7] text-[#D97706]'
        : tone === 'red'
          ? 'bg-[#FEE2E2] text-[#DC2626]'
          : 'bg-[#DCFCE7] text-[#16A34A]';

  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-5">
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{label}</div>
      <p className="mt-4 break-words text-[22px] font-black leading-tight tracking-tight text-[#111827] sm:text-[24px]">{value}</p>
    </div>
  );
};

const PortfolioLine = ({
  label,
  value,
  tone,
  progress,
}: {
  label: string;
  value: string;
  tone: 'green' | 'red' | 'blue';
  progress: number;
}) => {
  const barClass = tone === 'green' ? 'bg-[#16A34A]' : tone === 'red' ? 'bg-[#DC2626]' : 'bg-[#2563EB]';

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#111827]">{label}</p>
        <p className="text-sm font-black text-[#111827]">{value}</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#E5E7EB]">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(4, Math.min(progress, 100))}%` }} />
      </div>
    </div>
  );
};
