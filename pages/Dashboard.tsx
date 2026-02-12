import React, { useEffect, useState } from 'react';
import { getLoans, processPayment, getClients } from '../services/dataService';
import { Loan, Installment, Role, PaymentReceipt } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, generateWhatsAppLink } from '../utils';
import { Badge } from '../components/ui/Badge';
import { Wallet, TrendingUp, AlertCircle, CheckCircle, Search, Printer, X, Phone, Calendar, Hash, DollarSign } from 'lucide-react';

// Icono Oficial de WhatsApp
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="mr-2">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

interface DailyInstallment extends Installment {
  clientName: string;
  clientPhone: string;
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
  
  const [showPayModal, setShowPayModal] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  
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
             clientName: client ? `${client.firstName} ${client.lastName} (${client.nickname || ''})` : 'Desconocido',
             clientPhone: client?.phone || '',
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

  return (
    <div className="space-y-6 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 10px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">
                {currentUser.role === Role.COBRADOR ? 'Mi Ruta de Cobro' : 'Ruta Global (Admin)'}
            </h1>
            <p className="text-sm text-gray-500">Sesión: <span className="font-semibold text-blue-600">{currentUser.name}</span></p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl text-sm text-blue-700 font-bold border border-blue-100 shadow-sm">
            {new Date().toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cobrado Hoy</p>
              <p className="text-2xl font-black text-green-600">{formatCurrency(stats.collectedToday)}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl text-green-600"><TrendingUp size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pendiente</p>
              <p className="text-2xl font-black text-blue-600">{formatCurrency(stats.pendingToday)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Wallet size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Activos</p>
              <p className="text-2xl font-black text-gray-800">{stats.activeLoans}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl text-gray-600"><AlertCircle size={24} /></div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                placeholder="Buscar cliente por nombre o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* Content Area: Card Grid for Mobile/Tablet & Table for Desktop */}
      <div className="space-y-4">
        {dueToday.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
             <Search className="h-12 w-12 text-gray-200 mx-auto mb-4"/>
             <p className="text-gray-500 font-medium">No se encontraron visitas pendientes</p>
          </div>
        ) : (
          <>
            {/* MOBILE & TABLET VIEW: Card-based Layout (1 col mobile, 2 col tablet) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
              {dueToday.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-fadeIn flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{item.clientName}</h3>
                        <a href={`tel:${item.clientPhone}`} className="text-blue-600 text-sm font-medium flex items-center mt-1">
                          <Phone size={14} className="mr-1"/> {item.clientPhone}
                        </a>
                      </div>
                      <Badge status={item.status} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1 flex items-center">
                          <Hash size={10} className="mr-1"/> Cuota #
                        </p>
                        <p className="font-bold text-gray-800 text-sm">{item.number}</p>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1 flex items-center">
                          <Calendar size={10} className="mr-1"/> Vencimiento
                        </p>
                        <p className={`font-bold text-sm ${new Date(item.dueDate) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatDate(item.dueDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 mt-auto border-t border-gray-50 pt-4">
                    <div className="flex-1 text-left">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Cobro</p>
                      <p className="text-xl font-black text-gray-900">
                        {formatCurrency(item.expectedAmount - item.paidAmount)}
                      </p>
                    </div>
                    <button 
                      onClick={() => handlePay(item)}
                      disabled={currentUser.role === Role.SUPERVISOR}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-green-100 active:scale-95 transition-all disabled:opacity-50 text-sm"
                    >
                      COBRAR
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW: Classical Table (Only from lg upwards) */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Teléfono</th>
                    <th className="px-6 py-4">Cuota</th>
                    <th className="px-6 py-4">Vencimiento</th>
                    <th className="px-6 py-4 text-right">Monto</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {dueToday.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{item.clientName}</td>
                      <td className="px-6 py-4">
                        <a href={`tel:${item.clientPhone}`} className="text-blue-600 hover:underline">{item.clientPhone}</a>
                      </td>
                      <td className="px-6 py-4">{item.number}</td>
                      <td className="px-6 py-4">
                        <span className={new Date(item.dueDate) < new Date() ? 'text-red-600 font-bold' : ''}>
                          {formatDate(item.dueDate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-gray-900">
                        {formatCurrency(item.expectedAmount - item.paidAmount)}
                      </td>
                      <td className="px-6 py-4 text-center"><Badge status={item.status} /></td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handlePay(item)}
                          disabled={currentUser.role === Role.SUPERVISOR}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                          Cobrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal de Cobro */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-900">Registrar Pago</h3>
                <button onClick={() => setShowPayModal(null)} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20}/>
                </button>
            </div>
            <form onSubmit={confirmPayment}>
              <div className="mb-8 text-center">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Monto Recibido (RD$)</label>
                <div className="relative inline-block w-full">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black text-2xl">$</span>
                  <input 
                    type="number" 
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-6 text-4xl font-black border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:ring-0 outline-none bg-white text-center text-blue-600 transition-all"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-400 mt-4 font-medium italic">
                    * Si el monto es menor, el sistema lo marcará como pago parcial.
                </p>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowPayModal(null)} className="flex-1 px-4 py-4 bg-white border-2 border-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-50">Cerrar</button>
                <button type="submit" className="flex-2 px-4 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100">CONFIRMAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Éxito / Recibo */}
      {successReceipt && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 no-print">
            <div className="bg-white rounded-3xl w-full max-w-sm p-0 shadow-2xl overflow-hidden animate-scaleIn">
                <div className="bg-green-600 p-8 text-center text-white">
                    <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-black">¡Cobro Exitoso!</h3>
                    <p className="text-green-100 text-xl font-bold mt-1">{formatCurrency(successReceipt.receipt.amount)}</p>
                </div>
                <div className="p-8 space-y-6 bg-white">
                     <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center text-gray-500 font-medium">
                            <span>Balance Restante:</span>
                            <span className="font-black text-gray-900 text-lg">{formatCurrency(successReceipt.balance)}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-500 font-medium">
                            <span>Fecha Pago:</span>
                            <span className="text-gray-900">{formatDate(successReceipt.receipt.date)}</span>
                        </div>
                     </div>
                     <div className="space-y-3">
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
                            className="flex items-center justify-center w-full py-4 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-green-100"
                         >
                            <WhatsAppIcon /> ENVIAR RECIBO
                         </a>
                         <button onClick={() => window.print()} className="flex items-center justify-center w-full py-4 bg-gray-900 hover:bg-black text-white font-black rounded-2xl shadow-lg shadow-gray-200">
                            <Printer className="mr-2" size={20}/> IMPRIMIR TICKET
                         </button>
                         <button onClick={() => setSuccessReceipt(null)} className="w-full py-2 text-gray-400 font-black text-xs hover:text-gray-600 uppercase tracking-widest">
                            FINALIZAR
                         </button>
                     </div>
                </div>
            </div>
          </div>

          <div id="printable-receipt" className="hidden font-mono text-[10px] leading-tight">
            <div className="text-center mb-4">
                <h1 className="text-lg font-bold">PRESTAFÁCIL RD</h1>
                <p>Santo Domingo, Rep. Dom.</p>
                <p className="mt-1">{formatDate(successReceipt.receipt.date)}</p>
            </div>
            <div className="border-b border-black mb-2 border-dashed"></div>
            <div className="mb-2">
                <p><strong>RECIBO:</strong> {successReceipt.receipt.id.slice(0, 8)}</p>
                <p><strong>CLIENTE:</strong> {successReceipt.clientName}</p>
                <p><strong>PRESTAMO:</strong> #{successReceipt.loanNumber.slice(0, 6)}</p>
            </div>
            <div className="border-b border-black mb-3 border-dashed"></div>
            <div className="flex justify-between text-base font-bold mb-3 uppercase">
                <span>PAGO:</span>
                <span>{formatCurrency(successReceipt.receipt.amount)}</span>
            </div>
            <div className="flex justify-between mb-4">
                <span>BALANCE PEND.:</span>
                <span>{formatCurrency(successReceipt.balance)}</span>
            </div>
            <div className="mt-8 text-center border-t border-black pt-2 border-dashed">
                <p>Gracias por su puntualidad.</p>
                <p>PrestaFácil - Rapidez y Confianza</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};