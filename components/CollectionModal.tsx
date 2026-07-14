import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../types';
import {
  addPromise,
  addVisitLog,
  getBranchById,
  getClientById,
  getClientLoans,
  getCompanyById,
  recordPayment,
  upsertCashMovementsInLocalStorage,
  upsertLoansInLocalStorage,
  upsertPaymentsInLocalStorage,
} from '../services/dataService';
import { formatCurrency, formatDate, generateWhatsAppLink } from '../utils';
import { apiClient, ApiRequestError, ApiUnavailableError } from '../services/apiClient';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  DollarSign,
  FileText,
  Printer,
  Share2,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { PlatformDateField } from './ui/PlatformDateField';

interface CollectionModalProps {
  paymentData: any;
  currentUser: User;
  initialView?: 'MAIN' | 'PAYMENT' | 'NO_PAY' | 'PROMISE' | 'SUCCESS';
  onClose: () => void;
  onSuccess: () => void;
}

const VISIT_REASONS = ['NO ESTABA', 'NO PAGÓ', 'LOCAL CERRADO', 'DIRECCIÓN MAL'] as const;
const buttonMotionClass = 'cursor-pointer transition-all duration-200 hover:translate-x-1 active:translate-x-0';

export const CollectionModal: React.FC<CollectionModalProps> = ({
  paymentData,
  currentUser,
  initialView = 'MAIN',
  onClose,
  onSuccess,
}) => {
  const [view, setView] = useState<'MAIN' | 'PAYMENT' | 'NO_PAY' | 'PROMISE' | 'SUCCESS'>(initialView);
  const [amount, setAmount] = useState(paymentData.amountToCollect);
  const [mora, setMora] = useState(0);
  const [note, setNote] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState(paymentData.amountToCollect);
  const [visitReason, setVisitReason] = useState<(typeof VISIT_REASONS)[number] | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const company = getCompanyById(currentUser.companyId);
  const branch = getBranchById(currentUser.branchId);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setAmount(paymentData.amountToCollect);
    setPromiseAmount(paymentData.amountToCollect);
    setMora(0);
    setNote('');
    setPromiseDate('');
    setVisitReason('');
    setFormError('');
    setLastReceipt(null);
  }, [paymentData]);

  const clientInitial = paymentData.clientName?.[0] || 'C';

  const handlePayment = async () => {
    setIsLoading(true);
    setFormError('');
    const payload = {
      loanId: paymentData.loanId,
      installmentId: paymentData.installmentId,
      amount,
      moraPaid: mora,
    };

    try {
      const receipt = await apiClient.createPayment(payload);
      const [loans, payments, cash] = await Promise.all([apiClient.listLoans(), apiClient.listPayments(), apiClient.listCashMovements()]);
      upsertLoansInLocalStorage(loans.data);
      upsertPaymentsInLocalStorage(payments.data);
      upsertCashMovementsInLocalStorage(cash.data);
      setLastReceipt(receipt.data);
      setView('SUCCESS');
      onSuccess();
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        try {
          const receipt = recordPayment(payload, currentUser);
          if (receipt) {
            setLastReceipt(receipt);
            setView('SUCCESS');
            onSuccess();
          }
        } catch (localError) {
          setFormError(localError instanceof Error ? localError.message : 'No se pudo registrar el pago.');
        }
      } else if (error instanceof ApiRequestError) {
        setFormError(error.message);
      } else {
        setFormError(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoPay = () => {
    if (!visitReason) {
      setFormError('Selecciona un resultado para registrar la visita.');
      return;
    }

    addVisitLog(
      {
        clientId: paymentData.clientId,
        userId: currentUser.id,
        date: new Date().toISOString(),
        result: visitReason as any,
        note: note || `Visita sin cobro: ${visitReason}`,
      },
      currentUser,
    );

    setView('SUCCESS');
    onSuccess();
  };

  const handlePromise = () => {
    if (!promiseDate) {
      setFormError('Selecciona la fecha prometida para continuar.');
      return;
    }

    addPromise(
      {
        clientId: paymentData.clientId,
        loanId: paymentData.loanId,
        date: promiseDate,
        amount: promiseAmount,
        status: 'PENDIENTE',
        note,
      },
      currentUser,
    );

    setView('SUCCESS');
    onSuccess();
  };

  const shareReceipt = () => {
    const client = getClientById(paymentData.clientId);
    const loans = getClientLoans(paymentData.clientId);
    const loan = loans.find(item => item.id === paymentData.loanId);
    if (client && loan) {
      const waLink = generateWhatsAppLink(client.phone, client.firstName, amount, paymentData.loanId, loan.balance, new Date().toISOString());
      window.open(waLink, '_blank');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const viewConfig = {
    MAIN: {
      eyebrow: 'Gestion operativa',
      title: 'Selecciona una accion',
      description: 'Define si cobraras, registraras una promesa o dejaras una visita sin pago.',
    },
    PAYMENT: {
      eyebrow: 'Cobro',
      title: 'Registrar pago',
      description: 'Confirma monto cobrado y recargo aplicado antes de guardar el recibo.',
    },
    PROMISE: {
      eyebrow: 'Seguimiento',
      title: 'Promesa de pago',
      description: 'Registra el compromiso del cliente con fecha y monto acordado.',
    },
    NO_PAY: {
      eyebrow: 'Visita operativa',
      title: 'Registrar visita',
      description: 'Documenta la razon de no pago para dejar trazabilidad del recorrido.',
    },
    SUCCESS: {
      eyebrow: 'Registro completo',
      title: 'Operacion exitosa',
      description: 'La accion se guardo correctamente en el historial del sistema.',
    },
  }[view];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm animate-[platform-fade-in_220ms_ease-out]">
      <div className="platform-modal-panel relative w-full max-w-[720px] overflow-hidden rounded-[40px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] animate-[platform-modal-fade-up_220ms_ease-out]">
        <button
          onClick={onClose}
          className="platform-modal-close absolute right-6 top-6 z-10 flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#94A3B8] transition-all duration-200 hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >
          <X size={22} />
        </button>

        <div className="border-b border-[#E5E7EB] px-8 pb-8 pt-10">
          <div className="mx-auto max-w-[540px] text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#2563EB] text-[34px] font-black text-white shadow-[0_18px_40px_rgba(37,99,235,0.24)]">
              {clientInitial}
            </div>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-[#94A3B8]">{viewConfig.eyebrow}</p>
            <h3 className="mt-3 text-[20px] font-black leading-tight text-[#111827] sm:text-[22px]">{paymentData.clientName}</h3>
            <div className="mt-4 inline-flex items-center justify-center rounded-full border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-2 text-[12px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
              Saldo cuota:
              <span className="ml-2 text-[#2563EB]">{formatCurrency(paymentData.amountToCollect)}</span>
            </div>
            <p className="mx-auto mt-5 max-w-[54ch] text-[15px] font-medium leading-7 text-[#64748B]">{viewConfig.description}</p>
          </div>
        </div>

        <div className="p-8">
          {view === 'MAIN' ? (
            <div className="grid gap-3 animate-[platform-fade-in_180ms_ease-out] md:grid-cols-3">
              <ActionCard icon={<DollarSign size={22} />} tone="blue" title="Cobrar cuota" trailing={<CheckCircle2 size={18} />} onClick={() => setView('PAYMENT')} />
              <ActionCard icon={<Calendar size={22} />} tone="amber" title="Promesa de pago" trailing={<Calendar size={18} />} onClick={() => setView('PROMISE')} />
              <ActionCard icon={<AlertCircle size={22} />} tone="danger" title="No pago / visita" trailing={<FileText size={18} />} onClick={() => setView('NO_PAY')} />
            </div>
          ) : null}

          {view === 'PAYMENT' ? (
            <div className="space-y-6 animate-[platform-fade-in_180ms_ease-out]">
              <ModalField label="Monto a cobrar (DOP)">
                <input
                  type="number"
                  value={amount}
                  onChange={event => setAmount(Number(event.target.value))}
                  className="h-[56px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-[16px] font-bold tracking-[-0.01em] text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD] focus:bg-white"
                />
              </ModalField>

              <ModalField label="Mora / recargo">
                <input
                  type="number"
                  value={mora}
                  onChange={event => setMora(Number(event.target.value))}
                  className="h-[56px] w-full rounded-[20px] border border-[#FECACA] bg-[#FEF2F2] px-4 text-[16px] font-bold tracking-[-0.01em] text-[#DC2626] outline-none transition-all duration-200 focus:border-[#FCA5A5]"
                />
              </ModalField>

              {formError ? <InlineError message={formError} /> : null}

              <div className="mx-auto w-full max-w-[662px] space-y-4">
                <PrimaryActionButton tone="blue" onClick={handlePayment} disabled={isLoading} icon={<Wallet size={18} />}>
                  {isLoading ? 'Procesando...' : 'Registrar pago'}
                </PrimaryActionButton>

                <BackActionButton onClick={() => setView('MAIN')} />
              </div>
            </div>
          ) : null}

          {view === 'PROMISE' ? (
            <div className="space-y-6 animate-[platform-fade-in_180ms_ease-out]">
              <ModalField label="¿Para cuándo prometió?">
                <PlatformDateField value={promiseDate} onChange={setPromiseDate} placeholder="dd/mm/aaaa" />
              </ModalField>

              <ModalField label="Monto de la promesa">
                <input
                  type="number"
                  value={promiseAmount}
                  onChange={event => setPromiseAmount(Number(event.target.value))}
                  className="h-[56px] w-full rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-[16px] font-bold tracking-[-0.01em] text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD] focus:bg-white"
                />
              </ModalField>

              <ModalField label="Nota operativa">
                <textarea
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="Detalle del acuerdo, hora o contexto del compromiso."
                  className="h-[92px] w-full resize-none rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3.5 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD] focus:bg-white"
                />
              </ModalField>

              {formError ? <InlineError message={formError} /> : null}

              <div className="mx-auto w-full max-w-[662px] space-y-4">
                <PrimaryActionButton tone="amber" onClick={handlePromise} icon={<Calendar size={18} />}>
                  Registrar promesa
                </PrimaryActionButton>

                <BackActionButton onClick={() => setView('MAIN')} />
              </div>
            </div>
          ) : null}

          {view === 'NO_PAY' ? (
            <div className="space-y-6 animate-[platform-fade-in_180ms_ease-out]">
              <ModalField label="Resultado de la visita">
                <div className="grid grid-cols-2 gap-3">
                  {VISIT_REASONS.map(reason => {
                    const selected = visitReason === reason;
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          setVisitReason(reason);
                          setFormError('');
                        }}
        className={`h-[52px] rounded-[18px] border px-4 text-[14px] font-semibold tracking-[-0.01em] ${
                          selected
                            ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_12px_24px_rgba(37,99,235,0.12)]'
                            : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB]'
                        } ${buttonMotionClass}`}
                      >
                        {reason}
                      </button>
                    );
                  })}
                </div>
              </ModalField>

              <ModalField label="Nota de la visita">
                <textarea
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="Nota de lo sucedido..."
                  className="h-[92px] w-full resize-none rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3.5 text-[15px] font-medium text-[#111827] outline-none transition-all duration-200 focus:border-[#93C5FD] focus:bg-white"
                />
              </ModalField>

              {formError ? <InlineError message={formError} /> : null}

              <div className="mx-auto w-full max-w-[662px] space-y-4">
                <PrimaryActionButton tone="blue" onClick={handleNoPay} icon={<UserCheck size={18} />}>
                  Registrar visita
                </PrimaryActionButton>

                <BackActionButton onClick={() => setView('MAIN')} />
              </div>
            </div>
          ) : null}

          {view === 'SUCCESS' ? (
            <div className="space-y-8 text-center animate-[platform-fade-in_180ms_ease-out]">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A] shadow-inner">
                <CheckCircle2 size={56} />
              </div>

              <div>
                <h3 className="text-[30px] font-black tracking-tight text-[#111827]">Registro exitoso</h3>
                <p className="mt-2 text-[15px] font-medium text-[#64748B]">{viewConfig.description}</p>
              </div>

              {lastReceipt ? (
                <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FCFDFE] p-6 text-left">
                  <div className="grid grid-cols-2 gap-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">
                    <div>
                      <p>Monto</p>
                      <p className="mt-2 text-[24px] tracking-tight text-[#111827]">{formatCurrency(lastReceipt.amount)}</p>
                    </div>
                    <div>
                      <p>Fecha</p>
                      <p className="mt-2 text-[14px] normal-case tracking-normal text-[#111827]">{new Date(lastReceipt.date).toLocaleString()}</p>
                    </div>
                    <div>
                      <p>Cliente</p>
                      <p className="mt-2 text-[14px] normal-case tracking-normal text-[#111827]">{paymentData.clientName}</p>
                    </div>
                    <div>
                      <p>Recibo</p>
                      <p className="mt-2 text-[14px] normal-case tracking-normal text-[#111827]">{lastReceipt.id}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {lastReceipt ? (
                  <PrimaryActionButton tone="slate" onClick={printReceipt} icon={<Printer size={18} />}>
                    Imprimir / PDF
                  </PrimaryActionButton>
                ) : null}

                {lastReceipt ? (
                  <PrimaryActionButton tone="green" onClick={shareReceipt} icon={<Share2 size={18} />}>
                    Compartir por WhatsApp
                  </PrimaryActionButton>
                ) : null}

                <button
                  onClick={onClose}
                  className={`inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-white px-6 text-[15px] font-semibold text-[#111827] hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] ${buttonMotionClass}`}
                >
                  Cerrar ventana
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const ActionCard = ({
  icon,
  tone,
  title,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'amber' | 'danger';
  title: string;
  trailing: React.ReactNode;
  onClick: () => void;
}) => {
  const toneClass =
    tone === 'blue'
      ? 'bg-[#2563EB] text-white shadow-[0_18px_36px_rgba(37,99,235,0.24)] hover:bg-[#1D4ED8]'
      : tone === 'amber'
        ? 'bg-[#F97316] text-white shadow-[0_18px_36px_rgba(249,115,22,0.22)] hover:bg-[#EA580C]'
        : 'bg-[#DC2626] text-white shadow-[0_18px_36px_rgba(220,38,38,0.22)] hover:bg-[#B91C1C]';

  return (
    <button
      type="button"
      onClick={onClick}
        className={`flex h-[52px] w-full items-center justify-between rounded-[18px] border border-white/10 px-5 ${buttonMotionClass} ${toneClass}`}
      >
      <div className="flex items-center gap-3 text-[14px] font-semibold tracking-[-0.01em]">
        <span className="shrink-0">{icon}</span>
        <span>{title}</span>
      </div>
      <span className="shrink-0">{trailing}</span>
    </button>
  );
};

const ModalField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94A3B8]">{label}</label>
    {children}
  </div>
);

const PrimaryActionButton = ({
  tone,
  children,
  onClick,
  disabled,
  icon,
}: {
  tone: 'blue' | 'green' | 'amber' | 'slate';
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) => {
  const toneClass =
    tone === 'blue'
      ? 'bg-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.18)] hover:bg-[#1D4ED8]'
      : tone === 'green'
        ? 'bg-[#16A34A] shadow-[0_18px_36px_rgba(22,163,74,0.26)] hover:bg-[#15803D]'
      : tone === 'amber'
        ? 'bg-[#F97316] shadow-[0_12px_28px_rgba(249,115,22,0.18)] hover:bg-[#EA580C]'
        : 'bg-[#2563EB] shadow-[0_12px_28px_rgba(37,99,235,0.18)] hover:bg-[#1D4ED8]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[18px] px-6 text-[14px] font-semibold tracking-[-0.01em] text-white disabled:cursor-not-allowed disabled:opacity-40 ${buttonMotionClass} ${toneClass}`}
    >
      {icon}
      {children}
    </button>
  );
};

const BackActionButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#DBEAFE] bg-[#F8FBFF] px-5 text-[14px] font-semibold tracking-[-0.01em] text-[#2563EB] hover:border-[#93C5FD] hover:bg-[#EFF6FF] ${buttonMotionClass}`}
  >
    <ChevronLeft size={16} />
    Volver a opciones
  </button>
);

const InlineError = ({ message }: { message: string }) => (
  <div className="rounded-[20px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#DC2626]">{message}</div>
);

