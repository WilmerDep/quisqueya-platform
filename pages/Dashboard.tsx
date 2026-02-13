
import React, { useEffect, useState } from 'react';
import { getLoans, processPayment, getClients, addFicha } from '../services/dataService';
import { Loan, Installment, Role, PaymentReceipt, FichaType } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, generateWhatsAppLink } from '../utils';
import { Badge } from '../components/ui/Badge';
import { 
  Wallet, TrendingUp, AlertCircle, CheckCircle, Search, 
  Printer, X, Phone, Calendar, Hash, MessageSquare, Clock, AlertTriangle, User 
} from 'lucide-react';

// Shared Components
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="mr-2">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const RatingBadge = ({ type }: { type?: FichaType }) => {
  const styles = {
    [FichaType.BUENA]: 'bg-green-100 text-green-700 border-green-200',
    [FichaType.REGULAR]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    [FichaType.MALA]: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-tight ${styles[type || FichaType.BUENA]}`}>
      {type || 'BUENA'}
    </span>
  );
};

interface DailyInstallment extends Installment {
  clientId: string;
  clientName: string;
  clientNickname?: string;
  clientPhone: string;
  clientRating?: FichaType;
  assignedUserId?: string;
  loanBalance: number;
}

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [dueToday, setDueToday] = useState<DailyInstallment[]>([]);
  const [fullList, setFullList] = useState<DailyInstallment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    collectedToday: 0,
    pendingToday: 0,
    activeLoans: 0
  });
  
  // Modals State
  const [showPayModal, setShowPayModal] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState<string | null>(null);
  const [showPromiseModal, setShowPromiseModal] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  
  const [successReceipt, setSuccessReceipt] = useState<{
    receipt: PaymentReceipt;
    clientName: string;
    phone: string;
    balance: number;
    loanNumber: string;
  } | null>(null);

  const loadData = () => {
    const loans = getLoans();
    const clients = getClients();
    const today = new Date().toDateString(); 
    
    let dailyList: DailyInstallment[] = [];
    let collected = 0;
    let pending = 0;
    let active = 0;

    loans.forEach(loan => {
      if (loan.status === 'Activo' || loan.status === 'En Mora') active++;
      const client = clients.find(c => c.id === loan.clientId);
      
      loan.installments.forEach(inst => {
        if (inst.status !== 'PAGADO') {
           dailyList.push({
             ...inst,
             clientId: loan.clientId,
             clientName: client ? `${client.firstName} ${client.lastName}` : 'Desconocido',
             clientNickname: client?.nickname,
             clientPhone: client?.phone || '',
             clientRating: client?.creditRating,
             assignedUserId: client?.assignedUserId,
             loanBalance: loan.balance
           });
           
           if (new Date(inst.dueDate) <= new Date()) {
                pending += (inst.expectedAmount - inst.paidAmount);
           }
        }
        if (inst.paidAt && new Date(inst.paidAt).toDateString() === today) {
           collected += inst.paidAmount; 
        }
      });
    });

    dailyList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    setFullList(dailyList);
    setStats({ collectedToday: collected, pendingToday: pending, activeLoans: active });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = fullList;
    if (currentUser.role === Role.COBRADOR) {
        filtered = filtered.filter(item => item.assignedUserId === currentUser.id);
    }
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(item => 
            item.clientName.toLowerCase().includes(lowerTerm) ||
            (item.clientNickname && item.clientNickname.toLowerCase().includes(lowerTerm)) ||
            item.clientPhone.includes(lowerTerm) ||
            item.number.toString().includes(lowerTerm)
        );
    }
    setDueToday(filtered);
  }, [fullList, currentUser, searchTerm]);

  const handlePay = (installment: DailyInstallment) => {
    if (currentUser.role === Role.SUPERVISOR) {
        alert("Los supervisores tienen acceso de solo lectura.");
        return;
    }
    setPayAmount((installment.expectedAmount - installment.paidAmount).toString());
    setShowPayModal(installment.id);
  };

  const confirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    const inst = dueToday.find(i => i.id === showPayModal);
    if (!inst) return;

    try {
      const receipt = processPayment(inst.loanId, inst.id, parseFloat(payAmount));
      const newBalance = inst.loanBalance - parseFloat(payAmount);
      setSuccessReceipt({
        receipt,
        clientName: inst.clientName,
        phone: inst.clientPhone,
        balance: newBalance,
        loanNumber: inst.loanId
      });
      setShowPayModal(null);
      loadData(); 
    } catch (error) {
      alert("Error al procesar pago");
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showNoteModal || !noteText) return;
    const inst = dueToday.find(i => i.id === showNoteModal);
    if (!inst) return;

    // Added impact property to fix the missing property error
    addFicha({
      clientId: inst.clientId,
      type: FichaType.REGULAR,
      reason: 'Visita sin cobro',
      note: noteText,
      impact: 'NEUTRAL',
      createdBy: currentUser.id
    });
    
    setNoteText('');
    setShowNoteModal(null);
    loadData();
    alert("Visita registrada.");
  };

  const handleAddPromise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPromiseModal || !promiseDate) return;
    const inst = dueToday.find(i => i.id === showPromiseModal);
    if (!inst) return;

    // Added impact property to fix the missing property error
    addFicha({
      clientId: inst.clientId,
      type: FichaType.REGULAR,
      reason: 'Promesa de Pago',
      note: `Acordado para: ${formatDate(promiseDate)}`,
      impact: 'NEUTRAL',
      createdBy: currentUser.id
    });
    
    setPromiseDate('');
    setShowPromiseModal(null);
    loadData();
    alert("Promesa guardada.");
  };

  // Payment Calculation Logic for Modal
  const selectedInst = showPayModal ? dueToday.find(i => i.id === showPayModal) : null;
  const currentInstallmentAmount = selectedInst ? (selectedInst.expectedAmount - selectedInst.paidAmount) : 0;
  const isOverdue = selectedInst ? new Date(selectedInst.dueDate) < new Date() : false;
  const moraAmount = isOverdue ? 50 : 0; // RD$50 flat mock
  const totalDue = currentInstallmentAmount + moraAmount;
  const currentInput = parseFloat(payAmount) || 0;
  const pendingAfterPay = totalDue - currentInput;

  return (
    <div className="space-y-6 pb-24">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 10px; }
          .no-print { display: none !important; }
        }
        @keyframes scaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn { animation: scaleIn 0.2s cubic-bezier(0, 0, 0.2, 1) forwards; }
      `}</style>

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cobrar Hoy</h1>
            <p className="text-sm text-gray-500 font-medium">
                Ruta: <span className="text-blue-600 font-bold">{currentUser.name}</span>
            </p>
        </div>
        <div className="bg-white px-4 py-2.5 rounded-2xl text-sm text-blue-700 font-black border border-blue-100 shadow-sm flex items-center gap-2">
            <Calendar size={16} />
            {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'short' })}
        </div>
      </div>
      
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-2xl text-green-600"><TrendingUp size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cobrado Hoy</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(stats.collectedToday)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Wallet size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pendiente Hoy</p>
            <p className="text-xl font-black text-blue-600">{formatCurrency(stats.pendingToday)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-gray-50 rounded-2xl text-gray-600"><User size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Préstamos Activos</p>
            <p className="text-xl font-black text-gray-900">{stats.activeLoans}</p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 border-2 border-gray-100 rounded-2xl bg-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm font-medium"
            placeholder="Buscar por nombre, apodo o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main Content Area: Responsive Switch */}
      <div className="space-y-4">
        {dueToday.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-gray-100">
             <Search className="h-16 w-16 text-gray-100 mx-auto mb-4"/>
             <p className="text-gray-400 font-bold text-lg">No hay cobros pendientes</p>
          </div>
        ) : (
          <>
            {/* MOBILE (1 col) & TABLET (2 col) VIEW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-5">
              {dueToday.map((item) => (
                <div key={item.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 animate-fadeIn flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    {/* Card Header: Client Info */}
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-black text-gray-900 text-lg leading-tight truncate max-w-[180px]">{item.clientName}</h3>
                            <RatingBadge type={item.clientRating} />
                        </div>
                        {item.clientNickname && (
                            <p className="text-xs text-gray-400 font-bold italic mb-2">"{item.clientNickname}"</p>
                        )}
                        <a href={`tel:${item.clientPhone}`} className="text-blue-600 text-sm font-bold flex items-center">
                          <Phone size={14} className="mr-1.5"/> {item.clientPhone}
                        </a>
                      </div>
                      <Badge status={item.status} />
                    </div>
                    
                    {/* Info Strip */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
                          <Hash size={10} className="mr-1"/> Cuota
                        </p>
                        <p className="font-black text-gray-800 text-sm">#{item.number}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
                          <Clock size={10} className="mr-1"/> Vencimiento
                        </p>
                        <p className={`font-black text-sm ${new Date(item.dueDate) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatDate(item.dueDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                      {/* Action Row */}
                      <div className="flex gap-2">
                        <button 
                            onClick={() => setShowNoteModal(item.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-500 rounded-xl text-xs font-black hover:bg-gray-100 active:scale-95 transition-all"
                        >
                            <MessageSquare size={14} /> NOTA
                        </button>
                        <button 
                            onClick={() => setShowPromiseModal(item.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black hover:bg-blue-100 active:scale-95 transition-all"
                        >
                            <Clock size={14} /> PROMESA
                        </button>
                      </div>

                      {/* Main Collection Action */}
                      <div className="flex items-center justify-between gap-4 border-t border-gray-50 pt-4">
                        <div className="flex-1">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Monto Hoy</p>
                            <p className="text-2xl font-black text-gray-900 leading-none">
                                {formatCurrency(item.expectedAmount - item.paidAmount)}
                            </p>
                        </div>
                        <button 
                            onClick={() => handlePay(item)}
                            disabled={currentUser.role === Role.SUPERVISOR}
                            className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-green-100 active:scale-95 transition-all disabled:opacity-50 text-sm tracking-wide"
                        >
                            COBRAR
                        </button>
                      </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW: Classical Table (Only from lg screen upwards) */}
            <div className="hidden lg:block bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-5">Cliente / Estado</th>
                    <th className="px-6 py-5">Contacto</th>
                    <th className="px-6 py-5 text-center">Cuota</th>
                    <th className="px-6 py-5">Vencimiento</th>
                    <th className="px-6 py-5 text-right">Cobro Hoy</th>
                    <th className="px-6 py-5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {dueToday.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-gray-900 text-base">{item.clientName}</span>
                            <div className="flex items-center gap-2">
                                <RatingBadge type={item.clientRating} />
                                {item.clientNickname && <span className="text-[10px] text-gray-400 font-bold italic">"{item.clientNickname}"</span>}
                            </div>
                          </div>
                      </td>
                      <td className="px-6 py-5">
                        <a href={`tel:${item.clientPhone}`} className="text-blue-600 font-bold hover:underline flex items-center gap-1.5">
                            <Phone size={14}/> {item.clientPhone}
                        </a>
                      </td>
                      <td className="px-6 py-5 text-center font-bold text-gray-500">#{item.number}</td>
                      <td className="px-6 py-5 font-bold">
                        <span className={new Date(item.dueDate) < new Date() ? 'text-red-600 flex items-center gap-1' : 'text-gray-700'}>
                          {new Date(item.dueDate) < new Date() && <AlertTriangle size={14}/>}
                          {formatDate(item.dueDate)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-gray-900 text-lg">
                        {formatCurrency(item.expectedAmount - item.paidAmount)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setShowNoteModal(item.id)} className="p-2.5 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl transition-colors" title="Nota rápida"><MessageSquare size={18}/></button>
                            <button onClick={() => setShowPromiseModal(item.id)} className="p-2.5 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl transition-colors" title="Promesa"><Clock size={18}/></button>
                            <button 
                                onClick={() => handlePay(item)}
                                disabled={currentUser.role === Role.SUPERVISOR}
                                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-black shadow-md transition-all active:scale-95 disabled:opacity-50"
                            >
                                Cobrar
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* INTELLIGENT PAYMENT MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-scaleIn border border-white/20">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-gray-900">Registrar Pago</h3>
                <button onClick={() => setShowPayModal(null)} className="p-2.5 bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                  <X size={20}/>
                </button>
            </div>
            
            <form onSubmit={confirmPayment}>
              {/* Payment Breakdown Cards */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1">Cuota</p>
                    <p className="font-bold text-gray-800 text-sm">{formatCurrency(currentInstallmentAmount)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1">Mora</p>
                    <p className={`font-bold text-sm ${moraAmount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatCurrency(moraAmount)}
                    </p>
                </div>
                <div className="bg-blue-600 p-3 rounded-2xl text-center text-white shadow-lg shadow-blue-100">
                    <p className="text-[9px] font-black text-blue-200 uppercase tracking-tighter mb-1">Total</p>
                    <p className="font-black text-sm">{formatCurrency(totalDue)}</p>
                </div>
              </div>

              <div className="mb-10 text-center">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4">¿Cuánto recibiste? (RD$)</label>
                <div className="relative inline-block w-full">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 font-black text-3xl">$</span>
                  <input 
                    type="number" 
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-12 pr-6 py-8 text-5xl font-black border-2 border-gray-100 rounded-[2rem] focus:border-blue-500 focus:ring-0 outline-none bg-white text-center text-blue-600 transition-all placeholder-gray-100"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                
                {/* Dynamic Logic Message */}
                {pendingAfterPay > 0 && currentInput > 0 && (
                    <div className="mt-6 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center justify-center gap-3 animate-fadeIn">
                        <AlertTriangle size={18} className="text-orange-600 shrink-0" />
                        <p className="text-sm text-orange-800 font-bold text-left leading-tight">
                            Pago parcial. Quedarán pendientes <span className="font-black underline">{formatCurrency(pendingAfterPay)}</span>
                        </p>
                    </div>
                )}
                {pendingAfterPay <= 0 && currentInput > 0 && (
                     <div className="mt-6 p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-center gap-3 animate-fadeIn">
                        <CheckCircle size={18} className="text-green-600" />
                        <p className="text-sm text-green-800 font-bold">Cobro completo registrado.</p>
                    </div>
                )}
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={() => setShowPayModal(null)} className="flex-1 py-5 text-gray-400 font-black text-sm tracking-widest hover:text-gray-600">CANCELAR</button>
                <button type="submit" className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-100 active:scale-95 transition-all text-sm tracking-widest">
                    CONFIRMAR PAGO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK NOTE MODAL */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-scaleIn">
            <h3 className="text-2xl font-black text-gray-900 mb-6">Nota de Visita</h3>
            <form onSubmit={handleAddNote} className="space-y-6">
                <textarea 
                    className="w-full border-2 border-gray-100 rounded-2xl p-5 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all h-40 font-medium placeholder-gray-300"
                    placeholder="Ej: No estaba en casa, dice que pase mañana..."
                    required
                    autoFocus
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                />
                <div className="flex gap-4">
                    <button type="button" onClick={() => setShowNoteModal(null)} className="flex-1 py-4 font-black text-gray-400">ATRÁS</button>
                    <button type="submit" className="flex-[2] bg-gray-900 text-white py-4 rounded-2xl font-black shadow-xl shadow-gray-200">GUARDAR NOTA</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* PROMISE MODAL */}
      {showPromiseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-scaleIn">
            <h3 className="text-2xl font-black text-gray-900 mb-2">Promesa de Pago</h3>
            <p className="text-gray-400 text-sm font-medium mb-8">¿Cuándo dijo el cliente que pagará?</p>
            <form onSubmit={handleAddPromise} className="space-y-8">
                <input 
                    type="date"
                    className="w-full border-2 border-gray-100 rounded-2xl p-6 bg-gray-50 text-2xl font-black text-blue-600 focus:bg-white focus:border-blue-500 transition-all outline-none"
                    required
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                />
                <div className="flex gap-4">
                    <button type="button" onClick={() => setShowPromiseModal(null)} className="flex-1 py-4 font-black text-gray-400">CANCELAR</button>
                    <button type="submit" className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100">GUARDAR FECHA</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS RECEIPT / PRINTING */}
      {successReceipt && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 px-4 no-print">
            <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-0 shadow-2xl overflow-hidden animate-scaleIn">
                <div className="bg-green-600 p-10 text-center text-white">
                    <div className="bg-white/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <CheckCircle size={48} />
                    </div>
                    <h3 className="text-3xl font-black mb-1">RD$ {parseFloat(successReceipt.receipt.amount.toString()).toLocaleString()}</h3>
                    <p className="text-green-100 font-bold uppercase tracking-widest text-xs">Cobro Registrado</p>
                </div>
                <div className="p-10 space-y-8">
                     <div className="space-y-4">
                        <div className="flex justify-between items-center text-gray-400 font-bold text-xs uppercase tracking-widest">
                            <span>Balance Restante:</span>
                            <span className="font-black text-gray-900 text-lg tracking-normal">{formatCurrency(successReceipt.balance)}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400 font-bold text-xs uppercase tracking-widest">
                            <span>Fecha Pago:</span>
                            <span className="text-gray-900">{formatDate(successReceipt.receipt.date)}</span>
                        </div>
                     </div>
                     <div className="space-y-4">
                         <a 
                            href={generateWhatsAppLink(
                                successReceipt.phone, 
                                successReceipt.clientName, 
                                successReceipt.receipt.amount,
                                successReceipt.loanNumber,
                                successReceipt.balance,
                                successReceipt.receipt.date
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-full py-5 bg-green-500 hover:bg-green-600 text-white font-black rounded-[1.5rem] transition-all shadow-xl shadow-green-100"
                         >
                            <WhatsAppIcon /> ENVIAR WHATSAPP
                         </a>
                         <button onClick={() => window.print()} className="flex items-center justify-center w-full py-5 bg-gray-900 hover:bg-black text-white font-black rounded-[1.5rem] shadow-xl shadow-gray-200">
                            <Printer className="mr-3" size={20}/> IMPRIMIR RECIBO
                         </button>
                         <button onClick={() => setSuccessReceipt(null)} className="w-full py-2 text-gray-400 font-black text-xs hover:text-gray-900 uppercase tracking-[0.2em] transition-colors">
                            CERRAR
                         </button>
                     </div>
                </div>
            </div>
          </div>

          {/* Hidden Print Content */}
          <div id="printable-receipt" className="hidden font-mono text-[10px] leading-tight">
            <div className="text-center mb-6">
                <h1 className="text-xl font-bold">PRESTAFÁCIL RD</h1>
                <p>Santo Domingo, Rep. Dom.</p>
                <p className="mt-1">{formatDate(successReceipt.receipt.date)}</p>
            </div>
            <div className="border-b border-black mb-4 border-dashed"></div>
            <div className="mb-4 space-y-1">
                <p><strong>RECIBO:</strong> {successReceipt.receipt.id.slice(0, 8)}</p>
                <p><strong>CLIENTE:</strong> {successReceipt.clientName}</p>
                <p><strong>PRESTAMO:</strong> #{successReceipt.loanNumber.slice(0, 6)}</p>
            </div>
            <div className="border-b border-black mb-4 border-dashed"></div>
            <div className="flex justify-between text-lg font-bold mb-4 uppercase">
                <span>PAGO:</span>
                <span>{formatCurrency(successReceipt.receipt.amount)}</span>
            </div>
            <div className="flex justify-between mb-6">
                <span>BALANCE PEND.:</span>
                <span>{formatCurrency(successReceipt.balance)}</span>
            </div>
            <div className="mt-12 text-center border-t border-black pt-4 border-dashed">
                <p>Gracias por su puntualidad.</p>
                <p>PrestaFácil - Rapidez y Confianza</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
