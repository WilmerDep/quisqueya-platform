import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleX, Edit3, Filter, LayoutDashboard, Save, Search, User, Wallet } from 'lucide-react';
import { createLoan, getCompanyById, upsertClientsInLocalStorage, upsertLoansInLocalStorage } from '../services/dataService';
import { getBranchScope, getScopedClients, getScopedLoans, getScopedUsers } from '../services/viewScope';
import { Branch, Client, ClientStatus, Company, Frequency, Loan, User as AppUser } from '../types';
import { formatCurrency, formatDate, generateNewLoanMessage, generateSchedule } from '../utils';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import { ClientAvatar } from '../components/ui/ClientAvatar';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
  </svg>
);

type Step = 1 | 2 | 3;

const stepTitles = [
  { id: 1 as Step, label: 'Cliente' },
  { id: 2 as Step, label: 'Detalles del prestamo' },
  { id: 3 as Step, label: 'Confirmacion' },
];

const toneBadge = (value: string) =>
  value === 'Activo' || value === 'Buena' || value === 'Bajo'
    ? 'bg-[#DCFCE7] text-[#16A34A]'
    : value === 'Pendiente'
      ? 'bg-[#DBEAFE] text-[#2563EB]'
      : 'bg-[#FEF3C7] text-[#D97706]';

export const LoanCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [selectedClientStatus, setSelectedClientStatus] = useState<'APPROVED' | 'ALL'>('APPROVED');
  const [selectedRisk, setSelectedRisk] = useState<'ALL' | 'BAJO' | 'MEDIO' | 'ALTO'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [currentClientPage, setCurrentClientPage] = useState(1);
  const [amount, setAmount] = useState<number>(15000);
  const [interest, setInterest] = useState<number>(20);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.SEMANAL);
  const [disbursementType, setDisbursementType] = useState<'Efectivo' | 'Transferencia' | 'Cheque'>('Efectivo');
  const [duration, setDuration] = useState<number>(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successLoan, setSuccessLoan] = useState<any | null>(null);

  const branchScope = useMemo(() => getBranchScope(currentUser), [currentUser]);
  const canSeeAllCompanyUsers = branchScope.canSeeAllCompanyUsers;
  const motionButtonClass =
    'cursor-pointer transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]';

  useEffect(() => {
    let cancelled = false;

    const loadApiData = async () => {
      try {
        const [clientsResponse, loansResponse, usersResponse] = await Promise.all([apiClient.listClients(), apiClient.listLoans(), apiClient.listUsers()]);
        if (cancelled) return;
        upsertClientsInLocalStorage(clientsResponse.data);
        upsertLoansInLocalStorage(loansResponse.data);
        setClients(clientsResponse.data);
        setAllLoans(loansResponse.data);
        setUsers(usersResponse.data);
      } catch {
        if (cancelled) return;
        setClients(getScopedClients(currentUser));
        setAllLoans(getScopedLoans(currentUser));
        setUsers(getScopedUsers(currentUser));
      }
    };

    loadApiData();
    setBranches(branchScope.branches);
    setCompany(getCompanyById(currentUser.companyId));
    setUsers(getScopedUsers(currentUser));
    setSelectedBranchId(currentUser.branchId);

    if (location.state?.clientId) {
      setSelectedClientId(location.state.clientId);
      setStep(2);
    }

    return () => {
      cancelled = true;
    };
  }, [branchScope, currentUser, location.state]);

  useEffect(() => {
    if (!pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-loancreate-hero]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.48, ease: 'power3.out' });
      gsap.fromTo('[data-loancreate-steps]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out', delay: 0.06 });
      gsap.fromTo('[data-loancreate-main]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.48, ease: 'power3.out', delay: 0.12 });
      gsap.fromTo('[data-loancreate-side]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.48, ease: 'power3.out', delay: 0.18 });
    }, pageRef);
    return () => ctx.revert();
  }, [step]);

  const filteredClients = useMemo(() => {
    return clients.filter(
      client => {
        const score = client.creditRating === 'BUENA' ? 82 : client.creditRating === 'MALA' ? 48 : 65;
        const matchesRisk =
          selectedRisk === 'ALL' ||
          (selectedRisk === 'BAJO' && score >= 75) ||
          (selectedRisk === 'MEDIO' && score >= 60 && score < 75) ||
          (selectedRisk === 'ALTO' && score < 60);

        const matchesStatus = selectedClientStatus === 'ALL' ? true : client.status === ClientStatus.APPROVED;

        return (
        (!selectedBranchId || client.branchId === selectedBranchId) &&
        (!selectedCollectorId || client.assignedUserId === selectedCollectorId) &&
        (client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.phone.includes(searchTerm) ||
          client.cedula.includes(searchTerm)) &&
        matchesStatus &&
        !client.isBlocked &&
        matchesRisk
        );
      },
    );
  }, [clients, searchTerm, selectedBranchId, selectedCollectorId, selectedClientStatus, selectedRisk]);

  const clientsPerPage = 7;
  const totalClientPages = Math.max(1, Math.ceil(filteredClients.length / clientsPerPage));
  const paginatedClients = useMemo(
    () => filteredClients.slice((currentClientPage - 1) * clientsPerPage, currentClientPage * clientsPerPage),
    [filteredClients, currentClientPage],
  );

  useEffect(() => {
    setCurrentClientPage(1);
  }, [searchTerm, selectedBranchId, selectedCollectorId, selectedClientStatus, selectedRisk]);

  useEffect(() => {
    if (currentClientPage > totalClientPages) {
      setCurrentClientPage(totalClientPages);
    }
  }, [currentClientPage, totalClientPages]);

  const selectedClient = useMemo(
    () => clients.find(client => client.id === selectedClientId),
    [clients, selectedClientId],
  );

  const selectedClientLoans = useMemo(
    () => allLoans.filter(loan => loan.clientId === selectedClientId),
    [allLoans, selectedClientId],
  );

  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === selectedClient?.branchId) || branches.find(branch => branch.id === selectedBranchId),
    [branches, selectedBranchId, selectedClient?.branchId],
  );

  const schedule = useMemo(
    () => generateSchedule(amount || 0, interest || 0, duration || 1, frequency, startDate),
    [amount, duration, frequency, interest, startDate],
  );

  const totalToPay = schedule.reduce((sum, item) => sum + item.expectedAmount, 0);
  const quotaAmount = schedule[0]?.expectedAmount || 0;
  const pendingBalance = selectedClientLoans.reduce((sum, loan) => sum + loan.balance, 0);
  const nextInstallment = selectedClientLoans
    .flatMap(loan => loan.installments)
    .find(installment => installment.status !== 'PAGADO');
  const scoreValue =
    selectedClient?.creditRating === 'BUENA' ? 82 : selectedClient?.creditRating === 'MALA' ? 48 : 65;

  const validationRows = [
    { label: 'Cliente activo', value: selectedClient?.status === ClientStatus.APPROVED ? 'Correcto' : 'Pendiente', ok: selectedClient?.status === ClientStatus.APPROVED },
    { label: 'Sin bloqueo vigente', value: selectedClient?.isBlocked ? 'Bloqueado' : 'Correcto', ok: !selectedClient?.isBlocked },
    { label: `Score aceptable (${scoreValue}/100)`, value: 'Correcto', ok: scoreValue >= 60 },
    { label: 'Saldo pendiente actual', value: formatCurrency(pendingBalance), ok: pendingBalance < amount * 1.5 },
    { label: 'Promesas vencidas', value: pendingBalance > 0 ? 'No' : 'Sin historial', ok: true },
  ];

  const riskRows = [
    { label: 'Nivel de riesgo', value: scoreValue >= 75 ? 'Bajo' : scoreValue >= 60 ? 'Medio' : 'Alto' },
    { label: 'Capacidad de pago', value: pendingBalance < amount ? 'Buena' : 'Media' },
    { label: 'Comportamiento historico', value: scoreValue >= 75 ? 'Bueno' : 'En seguimiento' },
    { label: 'Antiguedad como cliente', value: selectedClient ? '1 ano, 3 meses' : '-' },
  ];

  const handleContinueFromClient = () => {
    if (!selectedClientId) return;
    setStep(2);
  };

  const handleResetClientFilters = () => {
    setSearchTerm('');
    setSelectedBranchId(currentUser.branchId);
    setSelectedCollectorId('');
    setSelectedClientStatus('APPROVED');
    setSelectedRisk('ALL');
  };

  const handleContinueFromDetails = () => {
    setFormError('');
    if (amount <= 0 || interest < 0 || duration <= 0) {
      setFormError('Completa capital, interes y cuotas con valores validos.');
      return;
    }
    setStep(3);
  };

  const handleSave = async () => {
    setFormError('');
    if (!selectedClientId || !agreed || !selectedClient) return;
    if (selectedClient.status !== ClientStatus.APPROVED || selectedClient.isBlocked) {
      setFormError('Solo puede desembolsar a clientes aprobados y activos.');
      return;
    }

    const payload = {
      clientId: selectedClientId,
      branchId: selectedClient.branchId,
      amount: Number(amount),
      interestRate: Number(interest),
      frequency,
      duration: Number(duration),
      startDate,
    };

    setIsSaving(true);
    try {
      const response = await apiClient.createLoan(payload);
      upsertLoansInLocalStorage([response.data]);
      setSuccessLoan(response.data);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        try {
          const newLoan = createLoan(payload, currentUser);
          setSuccessLoan(newLoan);
        } catch (localError) {
          setFormError(localError instanceof Error ? localError.message : 'No se pudo generar el prestamo.');
        }
      } else if (error instanceof ApiRequestError) {
        setFormError(error.message);
      } else {
        setFormError(error instanceof Error ? error.message : 'No se pudo generar el prestamo.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (successLoan) {
    return (
      <div ref={pageRef} className="mx-auto max-w-[1360px] space-y-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-[#E5E7EB] bg-[#2563EB] p-10 text-white shadow-sm">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
              <CheckCircle2 size={44} />
            </div>
            <h1 className="mt-8 text-[34px] font-black tracking-tight">Prestamo creado</h1>
            <p className="mt-3 max-w-md text-base font-medium text-blue-100">
              El desembolso ya quedo registrado. Ahora puedes imprimir el pagare, compartir el aviso y volver al flujo operativo.
            </p>
            <div className="mt-8 grid gap-4 rounded-[24px] border border-white/15 bg-white/10 p-6">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-blue-100">Capital</span>
                <span>{formatCurrency(successLoan.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-blue-100">Total a pagar</span>
                <span>{formatCurrency(successLoan.totalToPay)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-blue-100">Cuota estimada</span>
                <span>{formatCurrency(quotaAmount)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-[#111827]">Acciones y documentos</h2>
            <div className="mt-6 grid gap-3">
              <button onClick={() => window.print()} className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition-all duration-200 hover:translate-x-1 hover:bg-[#0F172A] hover:shadow-[0_18px_40px_rgba(15,23,42,0.24)]`}>
                <Edit3 size={16} />
                Imprimir pagare
              </button>
              <button
                onClick={() => {
                  if (!selectedClient?.phone) return;
                  const msg = generateNewLoanMessage(selectedClient, successLoan);
                  window.open(`https://wa.me/1${selectedClient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-4 text-sm font-semibold text-white transition-all duration-200 hover:translate-x-1 hover:bg-[#15803D] hover:shadow-[0_18px_40px_rgba(22,163,74,0.24)]"
              >
                <WhatsAppIcon />
                Enviar WhatsApp
              </button>
              <button onClick={() => navigate('/')} className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#374151] ${motionButtonClass}`}>
                <LayoutDashboard size={16} />
                Volver al dashboard
              </button>
            </div>
          </section>
        </div>

        <section id="loan-print" className="rounded-[28px] border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 border-b border-[#E5E7EB] pb-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-[#F8FAFC]">
                {selectedBranch?.logo ? (
                  <img src={selectedBranch.logo} alt={selectedBranch.name} className="h-full w-full object-cover" />
                ) : company?.logo ? (
                  <img src={company.logo} alt={company.name} className="h-full w-full object-contain p-3" />
                ) : (
                  <Wallet size={28} className="text-[#94A3B8]" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2563EB]">Pagare interno</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-[#111827]">{company?.name}</h3>
                <p className="mt-1 text-sm font-medium text-[#6B7280]">{selectedBranch?.name || 'Sucursal principal'}</p>
              </div>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Fecha</p>
              <p className="mt-2 text-sm font-semibold text-[#111827]">{formatDate(new Date().toISOString())}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[24px] bg-[#F8FAFC] p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Cliente</p>
              <p className="mt-3 text-2xl font-black text-[#111827]">
                {selectedClient?.firstName} {selectedClient?.lastName}
              </p>
              <p className="mt-2 text-sm font-medium text-[#6B7280]">Cedula: {selectedClient?.cedula}</p>
              <p className="mt-1 text-sm font-medium text-[#6B7280]">Telefono: {selectedClient?.phone}</p>
            </div>
            <div className="rounded-[24px] bg-[#111827] p-6 text-white">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Resumen</p>
              <p className="mt-3 text-3xl font-black">{formatCurrency(successLoan.totalToPay)}</p>
              <p className="mt-2 text-sm font-medium text-slate-300">
                {duration} cuotas de {formatCurrency(quotaAmount)}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-300">Inicio: {formatDate(startDate)}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="mx-auto max-w-[1480px] space-y-6 pb-24">
      <section data-loancreate-hero className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Prestamos</p>
          <h1 className="mt-3 text-[52px] font-black leading-none tracking-tight text-[#111827]">Crear Prestamo</h1>
          <p className="mt-3 text-xl font-medium text-[#6B7280]">
            Selecciona y valida el cliente antes de configurar los detalles del prestamo.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={() => navigate('/loans')} className={`flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}>
            <ArrowLeft size={18} />
            Cancelar
          </button>
          <button className={`flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-6 text-[17px] font-medium text-[#111827] ${motionButtonClass}`}>
            <Save size={18} />
            Guardar borrador
          </button>
          <button
            onClick={() => (step === 1 ? handleContinueFromClient() : step === 2 ? handleContinueFromDetails() : handleSave())}
            className="flex h-[56px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-[17px] font-medium text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]"
          >
            {step === 3 ? 'Crear prestamo' : 'Continuar'}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <section data-loancreate-steps className="rounded-[30px] border border-[#E5E7EB] bg-white px-8 py-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-3">
          {stepTitles.map((item, index) => {
            const isDone = step > item.id;
            const isActive = step === item.id;
            return (
              <div key={item.id} className={`rounded-[24px] border px-5 py-4 transition-all duration-200 ${isDone || isActive ? 'border-[#DBEAFE] bg-[#F8FBFF]' : 'border-[#F1F5F9] bg-white'}`}>
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-black ${isDone || isActive ? 'bg-[#2563EB] text-white' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                  {isDone ? <CheckCircle2 size={18} /> : item.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">Paso {item.id}</p>
                    <p className="mt-1 text-base font-semibold text-[#111827]">{item.label}</p>
                  </div>
                </div>
                {index < stepTitles.length - 1 && <div className="mt-4 h-px bg-[#E5E7EB] md:hidden" />}
              </div>
            );
          })}
        </div>
      </section>

      {step === 1 && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.34fr)_minmax(500px,0.84fr)]">
          <div data-loancreate-main className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
            <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Buscar clientes</h2>
            <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_172px]">
              <div className="relative">
                <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre, apodo o telefono..."
                  className="h-[56px] w-full rounded-2xl border border-[#E5E7EB] bg-white pl-14 pr-4 text-[15px] font-medium text-[#111827] outline-none placeholder:text-[#9CA3AF]"
                />
              </div>
              <button
                type="button"
                onClick={handleResetClientFilters}
                className={`flex h-[56px] min-w-[172px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[18px] border border-[#E5E7EB] bg-white px-5 text-[15px] font-semibold text-[#374151] ${motionButtonClass}`}
              >
                <Filter size={20} strokeWidth={2.3} />
                Limpiar filtros
              </button>
            </div>

            <div className="relative z-20 mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FilterDropdown
                className="w-full"
                label={selectedBranchId ? branches.find(branch => branch.id === selectedBranchId)?.name || 'Sucursal' : 'Todas las sucursales'}
                options={[
                  ...(canSeeAllCompanyUsers ? [{ label: 'Todas las sucursales', value: '' }] : []),
                  ...branches.map(branch => ({ label: branch.name, value: branch.id })),
                ]}
                value={selectedBranchId}
                onChange={setSelectedBranchId}
              />
              <FilterDropdown
                className="w-full"
                label={selectedCollectorId ? users.find(user => user.id === selectedCollectorId)?.name || 'Cobrador' : 'Todos los cobradores'}
                options={[
                  { label: 'Todos los cobradores', value: '' },
                  ...users.map(user => ({ label: user.name, value: user.id })),
                ]}
                value={selectedCollectorId}
                onChange={setSelectedCollectorId}
              />
              <FilterDropdown
                className="w-full"
                label={selectedClientStatus === 'APPROVED' ? 'Aprobados' : 'Todos los estados'}
                options={[
                  { label: 'Aprobados', value: 'APPROVED' },
                  { label: 'Todos los estados', value: 'ALL' },
                ]}
                value={selectedClientStatus}
                onChange={value => setSelectedClientStatus(value as 'APPROVED' | 'ALL')}
              />
              <FilterDropdown
                className="w-full"
                label={selectedRisk === 'ALL' ? 'Score / Riesgo' : selectedRisk}
                options={[
                  { label: 'Score / Riesgo', value: 'ALL' },
                  { label: 'Bajo', value: 'BAJO' },
                  { label: 'Medio', value: 'MEDIO' },
                  { label: 'Alto', value: 'ALTO' },
                ]}
                value={selectedRisk}
                onChange={value => setSelectedRisk(value as 'ALL' | 'BAJO' | 'MEDIO' | 'ALTO')}
              />
            </div>

            <p className="mt-6 text-sm font-medium text-[#6B7280]">{filteredClients.length} clientes encontrados</p>

            <div className="mt-4 space-y-3">
              {paginatedClients.map(client => {
                const clientLoans = allLoans.filter(loan => loan.clientId === client.id);
                const score = client.creditRating === 'BUENA' ? 82 : client.creditRating === 'MALA' ? 48 : 65;
                const clientPending = clientLoans.reduce((sum, loan) => sum + loan.balance, 0);
                const clientOverdue = clientLoans.filter(loan => loan.status === 'En Mora').length;
                const isSelected = client.id === selectedClientId;

                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`grid w-full cursor-pointer gap-5 rounded-[22px] border p-5 text-left transition-all duration-200 ${
                      isSelected ? 'border-[#2563EB] bg-[#F8FBFF] shadow-sm' : 'border-[#E5E7EB] bg-white hover:translate-x-1 hover:border-[#DBEAFE] hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]'
                    } lg:grid-cols-[1.4fr_0.9fr_0.8fr_auto]`}
                  >
                    <div className="flex items-center gap-4">
                      <ClientAvatar
                        client={client}
                        className="h-14 w-14 rounded-full"
                        textClassName="text-xl font-black text-[#2563EB]"
                      />
                      <div>
                        <p className="text-[22px] font-bold tracking-tight text-[#111827]">
                          {client.firstName} {client.lastName}
                        </p>
                        <p className="text-sm font-medium text-[#6B7280]">{client.nickname || client.phone}</p>
                        <p className="mt-1 text-sm font-medium text-[#6B7280]">{client.phone}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm font-medium text-[#374151]">
                      <p>Cobrador asignado</p>
                      <p className="font-semibold text-[#111827]">{client.assignedUserId.slice(0, 8)}</p>
                      <p className="text-[#16A34A]">Score {score}/100</p>
                    </div>
                    <div className="grid gap-2 text-sm font-medium">
                      <p className="text-[#374151]">Activos {clientLoans.length}</p>
                      <p className="text-[#111827]">Pendiente {formatCurrency(clientPending)}</p>
                      <p className={clientOverdue > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}>Atrasos {clientOverdue > 0 ? `${clientOverdue} dias` : '0 dias'}</p>
                    </div>
                    <div className="flex items-center justify-end">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isSelected ? 'bg-[#2563EB] text-white' : 'bg-[#F3F4F6] text-[#94A3B8]'}`}>
                        <CheckCircle2 size={18} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredClients.length > clientsPerPage ? (
              <div className="mt-6 flex items-center justify-between gap-4 rounded-[22px] border border-[#E5E7EB] bg-white px-5 py-4">
                <p className="text-sm font-medium text-[#6B7280]">
                  Mostrando {(currentClientPage - 1) * clientsPerPage + 1} a {Math.min(currentClientPage * clientsPerPage, filteredClients.length)} de {filteredClients.length} clientes
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentClientPage(previous => Math.max(1, previous - 1))}
                    disabled={currentClientPage === 1}
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] text-[#374151] ${motionButtonClass} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:border-[#E5E7EB] disabled:hover:bg-white disabled:hover:text-[#374151] disabled:hover:shadow-none`}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalClientPages }, (_, index) => index + 1).map(page => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentClientPage(page)}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-2xl border px-3 text-sm font-semibold transition-all duration-200 ${
                        page === currentClientPage
                          ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB]'
                          : `border-[#E5E7EB] bg-white text-[#374151] ${motionButtonClass}`
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentClientPage(previous => Math.min(totalClientPages, previous + 1))}
                    disabled={currentClientPage === totalClientPages}
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E5E7EB] text-[#374151] ${motionButtonClass} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:border-[#E5E7EB] disabled:hover:bg-white disabled:hover:text-[#374151] disabled:hover:shadow-none`}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div data-loancreate-side className="space-y-6">
            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Cliente seleccionado</h2>
              {selectedClient ? (
                <>
                  <div className="mt-6 flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <ClientAvatar
                        client={selectedClient}
                        className="h-20 w-20 shrink-0 rounded-full"
                        textClassName="text-[42px] font-black text-[#2563EB]"
                      />
                      <div className="min-w-0">
                        <p className="max-w-[280px] break-words text-[18px] font-black leading-[1.08] tracking-tight text-[#111827]">
                          {selectedClient.firstName} {selectedClient.lastName}
                        </p>
                        <p className="mt-1 text-[15px] font-medium text-[#6B7280]">{selectedClient.nickname || 'Sin apodo registrado'}</p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#374151]">
                          <span>{selectedClient.phone || '-'}</span>
                          <span className="text-[#6B7280]">{selectedClient.address || '-'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#DCFCE7] px-4 py-2 text-sm font-semibold text-[#16A34A]">Activo</span>
                  </div>

                  <div className="mt-6 grid gap-3 border-t border-[#E5E7EB] pt-6 sm:grid-cols-2">
                    <CompactStat label="Score / Riesgo" value={`${scoreValue}/100`} accent="text-[#111827]" />
                    <CompactStat label={<>Total<br />pendiente</>} value={formatCurrency(pendingBalance)} accent="text-[#111827]" valueClassName="text-[15px]" />
                    <CompactStat label={<>Prestamos<br />activos</>} value={`${selectedClientLoans.length}`} accent="text-[#111827]" valueClassName="text-[15px]" />
                    <CompactStat label="Atrasos recientes" value={selectedClientLoans.some(loan => loan.status === 'En Mora') ? 'Si' : '0 dias'} accent="text-[#111827]" />
                  </div>

                  <button onClick={() => navigate(`/clients/${selectedClient.id}`)} className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#2563EB] ${motionButtonClass}`}>
                    <User size={16} />
                    Ver perfil del cliente
                  </button>
                </>
              ) : (
                <EmptyPanel text="Selecciona un cliente para ver su validacion y contexto financiero." />
              )}
            </section>

            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Validacion del cliente</h3>
              <div className="mt-5 space-y-3">
                {validationRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between rounded-2xl border border-[#F1F5F9] px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.ok ? <CircleCheck size={18} className="text-[#16A34A]" /> : <CircleX size={18} className="text-[#F59E0B]" />}
                      <span className="text-sm font-medium text-[#374151]">{row.label}</span>
                    </div>
                    <span className={`text-sm font-semibold ${row.ok ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6">
              <section className="min-h-[230px] rounded-[30px] border border-[#E5E7EB] bg-white p-7 shadow-sm">
                <h3 className="text-xl font-black text-[#111827]">Contexto financiero</h3>
                <div className="mt-5 space-y-4">
                  <MetricLine label="Ultimo pago recibido" value={pendingBalance > 0 ? formatCurrency(Math.max(1800, pendingBalance * 0.12)) : 'Sin pagos'} />
                  <MetricLine label="Proxima cuota" value={nextInstallment ? `${formatDate(nextInstallment.dueDate)} · ${formatCurrency(nextInstallment.expectedAmount)}` : 'Sin cuota'} />
                  <MetricLine label="Total recuperado" value={formatCurrency(Math.max(0, selectedClientLoans.reduce((sum, loan) => sum + (loan.amount - loan.balance), 0)))} />
                </div>
              </section>
              <section className="min-h-[230px] rounded-[30px] border border-[#E5E7EB] bg-white p-7 shadow-sm">
                <h3 className="text-xl font-black text-[#111827]">Indicadores de riesgo</h3>
                <div className="mt-5 space-y-4">
                  {riskRows.map(row => (
                    <MetricLine key={row.label} label={row.label} value={row.value} badge />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.16fr)_minmax(430px,0.84fr)]">
          <div data-loancreate-main className="relative z-[80] space-y-6">
            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h2 className="text-[28px] font-black tracking-tight text-[#111827]">Detalles del prestamo</h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field label="Monto del prestamo">
                  <input type="number" value={amount} onChange={event => setAmount(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-base font-semibold text-[#111827] outline-none" />
                </Field>
                <Field label="Interes total (%)">
                  <input type="number" value={interest} onChange={event => setInterest(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-base font-semibold text-[#111827] outline-none" />
                </Field>
                <Field label="Frecuencia de pago">
                  <FilterDropdown
                    label={frequency}
                    value={frequency}
                    onChange={value => setFrequency(value as Frequency)}
                    options={Object.values(Frequency).map(value => ({ label: value, value }))}
                  />
                </Field>
                <Field label="Numero de cuotas">
                  <input type="number" value={duration} onChange={event => setDuration(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-base font-semibold text-[#111827] outline-none" />
                </Field>
                <Field label="Fecha de inicio">
                  <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-base font-semibold text-[#111827] outline-none" />
                </Field>
                <Field label="Tipo de desembolso">
                  <FilterDropdown
                    label={disbursementType}
                    value={disbursementType}
                    onChange={value => setDisbursementType(value as 'Efectivo' | 'Transferencia' | 'Cheque')}
                    options={[
                      { label: 'Efectivo', value: 'Efectivo' },
                      { label: 'Transferencia', value: 'Transferencia' },
                      { label: 'Cheque', value: 'Cheque' },
                    ]}
                  />
                </Field>
              </div>
              {formError && <div className="mt-5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#DC2626]">{formError}</div>}
            </section>

            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Calendario estimado</h3>
              <div className="mt-5 overflow-hidden rounded-[22px] border border-[#E5E7EB]">
                <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr] bg-[#F8FAFC] px-5 py-3 text-[12px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">
                  <span>Cuota</span>
                  <span>Fecha</span>
                  <span>Monto</span>
                  <span>Estado</span>
                </div>
                {schedule.slice(0, 6).map(item => (
                  <div key={item.id} className="grid grid-cols-[0.8fr_1fr_1fr_1fr] items-center border-t border-[#F1F5F9] px-5 py-4 text-sm font-medium text-[#374151]">
                    <span>{item.number}</span>
                    <span>{formatDate(item.dueDate)}</span>
                    <span>{formatCurrency(item.expectedAmount)}</span>
                    <span className="w-fit rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#2563EB]">Pendiente</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div data-loancreate-side className="space-y-6">
            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Resumen financiero final</h3>
              <div className="mt-5 space-y-4">
                <MetricLine label="Capital" value={formatCurrency(amount)} />
                <MetricLine label="Interes total" value={formatCurrency(totalToPay - amount)} />
                <div className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#2563EB]">Total a pagar</span>
                    <span className="text-[30px] font-black tracking-tight text-[#111827]">{formatCurrency(totalToPay)}</span>
                  </div>
                </div>
                <MetricLine label="Valor estimado por cuota" value={formatCurrency(quotaAmount)} />
                <MetricLine label="Cantidad de cuotas" value={`${duration}`} />
                <MetricLine label="Primera cuota" value={schedule[0] ? formatDate(schedule[0].dueDate) : '-'} />
                <MetricLine label="Ultima cuota" value={schedule.at(-1) ? formatDate(schedule.at(-1)!.dueDate) : '-'} />
              </div>
            </section>

            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Validacion final</h3>
              <div className="mt-5 space-y-3">
                {validationRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#374151]">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.ok ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-7 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-[1fr_1.15fr]">
                <button onClick={() => setStep(1)} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] px-6 text-sm font-semibold text-[#374151] ${motionButtonClass}`}>
                  <ArrowLeft size={16} />
                  Volver al cliente
                </button>
                <button onClick={() => setStep(3)} className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)]">
                  Continuar
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>

          </div>
        </section>
        </>
      )}

      {step === 3 && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(430px,0.82fr)]">
          <div data-loancreate-main className="space-y-6">
            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <div className="border-b border-[#E5E7EB] pb-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-start gap-5">
                    <ClientAvatar
                      client={selectedClient}
                      className="h-24 w-24 shrink-0 rounded-full"
                      textClassName="text-[42px] font-black text-[#2563EB]"
                    />
                    <div className="min-w-0">
                      <p className="text-[28px] font-black leading-[1.05] tracking-tight text-[#111827]">
                        {selectedClient?.firstName || ''} {selectedClient?.lastName || ''}
                      </p>
                      <p className="mt-1 text-[15px] font-medium text-[#6B7280]">{selectedClient?.nickname || 'Sin apodo registrado'}</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <DetailPill label="Telefono" value={selectedClient?.phone || '-'} />
                        <DetailPill label="Sector" value={selectedClient?.address || '-'} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 xl:min-w-[220px]">
                    <div className="flex items-center justify-between rounded-2xl border border-[#F1F5F9] px-4 py-3">
                      <span className="text-sm font-medium text-[#6B7280]">Estado</span>
                      <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-sm font-semibold text-[#16A34A]">Activo</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[#F1F5F9] px-4 py-3">
                      <span className="text-sm font-medium text-[#6B7280]">Score</span>
                      <span className="text-base font-black text-[#16A34A]">{scoreValue}/100</span>
                    </div>
                    <button onClick={() => selectedClient && navigate(`/clients/${selectedClient.id}`)} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#2563EB] ${motionButtonClass}`}>
                      <User size={16} />
                      Ver perfil del cliente
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-[24px] border border-[#E5E7EB]">
                <div className="grid grid-cols-2 gap-4 border-b border-[#F1F5F9] px-5 py-4 md:grid-cols-4">
                  <MetricLine label="Monto del prestamo" value={formatCurrency(amount)} compact />
                  <MetricLine label="Interes" value={`${interest}%`} compact />
                  <MetricLine label="Frecuencia" value={frequency} compact />
                  <MetricLine label="Fecha de inicio" value={formatDate(startDate)} compact />
                </div>
                <div className="grid grid-cols-2 gap-4 px-5 py-4 md:grid-cols-5">
                  <MetricLine label="Sucursal" value={selectedBranch?.name || '-'} compact />
                  <MetricLine label="Cuotas" value={`${duration}`} compact />
                  <MetricLine label="Desembolso" value={disbursementType} compact />
                  <MetricLine label="Valor por cuota" value={formatCurrency(quotaAmount)} compact />
                  <MetricLine label="Total a cobrar" value={formatCurrency(totalToPay)} compact accent="text-[#2563EB]" />
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Calendario de cuotas</h3>
              <div className="mt-5 overflow-hidden rounded-[22px] border border-[#E5E7EB]">
                <div className="grid grid-cols-[0.7fr_1fr_1fr_1fr_1fr] bg-[#F8FAFC] px-5 py-3 text-[12px] font-bold uppercase tracking-[0.15em] text-[#94A3B8]">
                  <span>Cuota</span>
                  <span>Fecha</span>
                  <span>Capital</span>
                  <span>Interes</span>
                  <span>Monto total</span>
                </div>
                {schedule.slice(0, 6).map(item => (
                  <div key={item.id} className="grid grid-cols-[0.7fr_1fr_1fr_1fr_1fr] items-center border-t border-[#F1F5F9] px-5 py-4 text-sm font-medium text-[#374151]">
                    <span>{item.number}</span>
                    <span>{formatDate(item.dueDate)}</span>
                    <span>{formatCurrency(amount / duration)}</span>
                    <span>{formatCurrency((totalToPay - amount) / duration)}</span>
                    <span>{formatCurrency(item.expectedAmount)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div data-loancreate-side className="space-y-6">
            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Resumen financiero final</h3>
              <div className="mt-5 space-y-4">
                <MetricLine label="Capital" value={formatCurrency(amount)} />
                <MetricLine label="Interes total" value={formatCurrency(totalToPay - amount)} />
                <div className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#2563EB]">Total a pagar</span>
                    <span className="text-[30px] font-black tracking-tight text-[#111827]">{formatCurrency(totalToPay)}</span>
                  </div>
                </div>
                <MetricLine label="Valor estimado por cuota" value={formatCurrency(quotaAmount)} />
                <MetricLine label="Cantidad de cuotas" value={`${duration}`} />
                <MetricLine label="Primera cuota" value={schedule[0] ? formatDate(schedule[0].dueDate) : '-'} />
                <MetricLine label="Ultima cuota" value={schedule.at(-1) ? formatDate(schedule.at(-1)!.dueDate) : '-'} />
              </div>
            </section>

            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Validacion final</h3>
              <div className="mt-5 space-y-3">
                {validationRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#374151]">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.ok ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-9 shadow-sm">
              <h3 className="text-[24px] font-black tracking-tight text-[#111827]">Acciones y documentos</h3>
              <div className="mt-5 space-y-3">
                <MetricLine label="Desembolso" value="Efectivo" badge />
                <MetricLine label="Recibo" value="Generar al crear" badge />
                <MetricLine label="Contrato / PDF" value="Disponible" badge />
                <MetricLine label="Notificacion interna" value="Activada" badge />
              </div>
            </section>

            <label className="flex items-start gap-3 rounded-[22px] border border-[#DBEAFE] bg-[#F8FBFF] p-5">
              <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} className="mt-1 h-4 w-4 cursor-pointer rounded border-[#CBD5E1] text-[#2563EB]" />
              <span className="text-sm font-medium leading-6 text-[#1E3A8A]">
                Confirmo que el cliente recibe el monto acordado y acepta el calendario de pagos mostrado.
              </span>
            </label>

            {formError && <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#DC2626]">{formError}</div>}

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
              <button onClick={() => setStep(2)} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#374151] ${motionButtonClass}`}>
                <Edit3 size={16} />
                Volver a editar
              </button>
              <button onClick={() => setStep(2)} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#374151] ${motionButtonClass}`}>
                <ArrowLeft size={16} />
                Anterior
              </button>
              <button onClick={handleSave} disabled={!agreed || isSaving} className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-4 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_18px_40px_rgba(37,99,235,0.32)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:shadow-none">
                <CheckCircle2 size={16} />
                {isSaving ? 'Creando...' : 'Confirmar y crear prestamo'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const Metric = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div>
    <p className="text-sm font-medium text-[#6B7280]">{label}</p>
    <p className={`mt-2 text-[20px] font-black tracking-tight text-[#111827] ${accent || ''}`}>{value}</p>
  </div>
);

const CompactStat = ({
  label,
  value,
  accent,
  valueClassName,
}: {
  label: React.ReactNode;
  value: string;
  accent?: string;
  valueClassName?: string;
}) => (
  <div className="rounded-2xl border border-[#F1F5F9] px-4 py-4">
    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{label}</div>
    <p className={`mt-3 text-[16px] font-black leading-tight text-[#111827] ${accent || ''} ${valueClassName || ''}`}>{value}</p>
  </div>
);

const DetailPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[#F1F5F9] px-4 py-3">
    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{label}</p>
    <p className="mt-2 text-sm font-semibold text-[#111827]">{value}</p>
  </div>
);

const MetricLine = ({
  label,
  value,
  badge,
  accent,
  compact,
}: {
  label: string;
  value: string;
  badge?: boolean;
  accent?: string;
  compact?: boolean;
}) => (
  <div className={compact ? '' : 'flex items-center justify-between'}>
    <span className="text-sm font-medium text-[#6B7280]">{label}</span>
    <span
      className={`${compact ? 'mt-2 block text-base' : 'text-sm'} font-semibold ${
        badge ? `rounded-full px-3 py-1 ${toneBadge(value)}` : accent || 'text-[#111827]'
      }`}
    >
      {value}
    </span>
  </div>
);

const Field = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={className}>
    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">{label}</label>
    {children}
  </div>
);

const FilterDropdown = ({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    placement: 'bottom' as 'bottom' | 'top',
  });

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const isInsideTrigger = containerRef.current?.contains(target);
      const isInsideMenu = menuRef.current?.contains(target);
      if (target && !isInsideTrigger && !isInsideMenu) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = Math.min(options.length, 6) * 58 + 24;
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
    <div ref={containerRef} className={`relative ${className || ''} ${isOpen ? 'z-[120]' : 'z-20'}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(previous => !previous)}
        className={`flex h-[56px] w-full cursor-pointer items-center justify-between rounded-[18px] border px-4 text-left text-[15px] font-semibold transition-all duration-200 ${
          isOpen
            ? 'border-[#93C5FD] bg-white text-[#111827] shadow-[0_16px_36px_rgba(15,23,42,0.10)]'
            : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#DBEAFE] hover:text-[#2563EB] hover:shadow-sm'
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={17} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#111827]' : 'text-[#6B7280]'}`} />
      </button>

      {isOpen ? createPortal(
        <div
          ref={menuRef}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          className="fixed z-[320] rounded-[24px] border border-[#E5E7EB] bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
          style={{
            minWidth: Math.max(menuPosition.width, 320),
            top: menuPosition.top,
            left: menuPosition.left,
            transform: menuPosition.placement === 'top' ? 'translateY(-100%)' : undefined,
          }}
        >
          <div className="space-y-1">
            {options.map(option => (
              <button
                key={`${option.label}-${option.value}`}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={event => {
                  event.stopPropagation();
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
        </div>,
        document.body,
      ) : null}
    </div>
  );
};

const EmptyPanel = ({ text }: { text: string }) => (
  <div className="rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-10 text-center text-sm font-medium text-[#64748B]">
    {text}
  </div>
);
