
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getClients, createLoan, getLoans } from '../services/dataService';
import { Client, Frequency, FichaType, LoanStatus, ClientStatus } from '../types';
import { formatCurrency, generateSchedule, formatDate, generateNewLoanMessage } from '../utils';
import { 
  Calculator, ArrowRight, ArrowLeft, Check, User, DollarSign, 
  Percent, Calendar, Layers, Clock, Search, AlertTriangle, ShieldAlert,
  Info, CheckCircle2, Mail, Printer, ListOrdered, ShieldOff
} from 'lucide-react';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="mr-2">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

export const LoanCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [successLoan, setSuccessLoan] = useState<any | null>(null);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [amount, setAmount] = useState<number>(5000);
  const [interest, setInterest] = useState<number>(20);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.SEMANAL);
  const [duration, setDuration] = useState<number>(13);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    setClients(getClients());
    // Si viene del perfil, seleccionar automático
    if (location.state?.clientId) {
        setSelectedClientId(location.state.clientId);
        setStep(2);
    }
  }, [location.state]);

  const allLoans = useMemo(() => getLoans(), []);

  const filteredClients = useMemo(() => {
    // Solo permitir clientes aprobados y no bloqueados para nuevos préstamos
    return clients.filter(c => 
        (c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || c.cedula.includes(searchTerm)) &&
        c.status === ClientStatus.APPROVED &&
        !c.isBlocked
    );
  }, [clients, searchTerm]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const schedule = useMemo(() => {
    return generateSchedule(amount || 0, interest || 0, duration || 1, frequency, startDate);
  }, [amount, interest, duration, frequency, startDate]);

  const totalToPay = schedule.reduce((sum, i) => sum + i.expectedAmount, 0);
  const quotaAmount = schedule.length > 0 ? schedule[0].expectedAmount : 0;

  const handleSave = () => {
    if (!selectedClientId || !agreed) return;
    const newLoan = createLoan({
      clientId: selectedClientId,
      amount,
      interestRate: interest,
      frequency,
      duration,
      startDate
    });
    setSuccessLoan(newLoan);
  };

  if (successLoan) {
    return (
        <div className="max-w-2xl mx-auto py-12 px-4 animate-scaleIn">
            <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
                <div className="md:w-1/2 bg-blue-600 p-12 text-center text-white flex flex-col justify-center">
                    <div className="bg-white/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={56} /></div>
                    <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase">Desembolso Exitoso</h2>
                    <div className="mt-8 space-y-4 text-left bg-white/10 p-6 rounded-3xl border border-white/10">
                         <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-[10px] font-black uppercase opacity-60">Capital</span><span className="font-black">{formatCurrency(successLoan.amount)}</span></div>
                         <div className="flex justify-between pt-2"><span className="text-[10px] font-black uppercase opacity-60">Total a Pagar</span><span className="text-xl font-black text-blue-200">{formatCurrency(successLoan.totalToPay)}</span></div>
                    </div>
                </div>
                <div className="md:w-1/2 p-10 flex flex-col">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Próximos Pasos</h3>
                    <div className="space-y-4 mb-10">
                        <button onClick={() => window.print()} className="w-full flex items-center justify-center py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase"><Printer size={16} className="mr-2"/> Imprimir Pagaré</button>
                        <button onClick={() => {
                            const msg = generateNewLoanMessage(selectedClient, successLoan);
                            window.open(`https://wa.me/1${selectedClient?.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                        }} className="w-full flex items-center justify-center py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase"><WhatsAppIcon /> Enviar WhatsApp</button>
                    </div>
                    <button onClick={() => navigate('/')} className="w-full py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-gray-900 transition-colors">Volver al Inicio</button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Nuevo Préstamo</h1>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Solo para clientes con expediente aprobado</p>
         </div>
         <div className="flex gap-1">
            {[1, 2, 3].map(i => <div key={i} className={`h-1.5 w-8 rounded-full transition-all ${step >= i ? 'bg-blue-600' : 'bg-gray-200'}`} />)}
         </div>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 animate-fadeIn">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3"><User className="text-blue-600" size={24}/> Elegir Cliente</h2>
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Buscar por nombre o cédula..." className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2">
                {filteredClients.map(c => (
                    <button key={c.id} onClick={() => setSelectedClientId(c.id)} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${selectedClientId === c.id ? 'border-blue-600 bg-blue-50/50' : 'border-gray-50 bg-gray-50 hover:border-gray-200'}`}>
                        <div className="flex items-center gap-4">
                            {c.photo ? (
                                <img src={c.photo} alt={c.firstName} className="h-10 w-10 rounded-xl object-cover border border-blue-200" />
                            ) : (
                                <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white">{c.firstName[0]}</div>
                            )}
                            <div className="text-left">
                                <p className="font-black text-gray-900 text-sm">{c.firstName} {c.lastName}</p>
                                <p className="text-[10px] text-gray-400 font-black tracking-widest">{c.cedula}</p>
                            </div>
                        </div>
                        {selectedClientId === c.id && <CheckCircle2 className="text-blue-600" size={20} />}
                    </button>
                ))}
                {filteredClients.length === 0 && (
                    <div className="p-10 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                        <AlertTriangle className="mx-auto text-orange-400 mb-2" size={32}/>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No hay clientes aprobados con este nombre.</p>
                    </div>
                )}
            </div>
            <button onClick={() => setStep(2)} disabled={!selectedClientId} className="w-full mt-8 bg-gray-900 disabled:opacity-30 text-white py-5 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl hover:bg-black active:scale-95 transition-all">Siguiente Paso</button>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 animate-fadeIn">
            <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3"><Calculator className="text-purple-600" size={24}/> Configurar Crédito</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Capital (RD$)</label>
                    <input type="number" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-black text-lg placeholder-gray-300" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Ej: 10000" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Interés Total (%)</label>
                    <input type="number" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-black text-lg placeholder-gray-300" value={interest} onChange={(e) => setInterest(Number(e.target.value))} placeholder="Ej: 20" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Frecuencia</label>
                    <select className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-black text-xs tracking-widest uppercase" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                        {Object.values(Frequency).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Número de Pagos</label>
                    <input type="number" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-black text-lg placeholder-gray-300" value={duration} onChange={(e) => setDuration(Number(e.target.value))} placeholder="Ej: 13" />
                </div>
            </div>
            
            <div className="mt-10 bg-gray-900 rounded-[2rem] p-8 text-white flex flex-col sm:flex-row justify-between items-center gap-6 shadow-2xl text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cuota Resultante</p>
                    <p className="text-3xl font-black leading-none">{formatCurrency(quotaAmount)}</p>
                </div>
                <div className="flex flex-col items-center sm:items-end">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Monto Final</p>
                    <p className="text-xl font-black text-blue-400 leading-none">{formatCurrency(totalToPay)}</p>
                </div>
            </div>

            <div className="flex gap-4 mt-10">
                <button onClick={() => setStep(1)} className="flex-1 py-5 font-black text-gray-400 text-xs tracking-widest">ATRÁS</button>
                <button onClick={() => setStep(3)} className="flex-[2] bg-blue-600 text-white py-5 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl active:scale-95 transition-all">Verificar Plan</button>
            </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 animate-fadeIn">
            <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3"><CheckCircle2 className="text-green-600" size={24}/> Confirmar Desembolso</h2>
            <div className="bg-gray-50 rounded-[2rem] p-8 space-y-6">
                <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</span>
                    <span className="font-black text-gray-900">{selectedClient?.firstName} {selectedClient?.lastName}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plan de Pago</span>
                    <span className="font-black text-gray-900">{duration} cuotas de {formatCurrency(quotaAmount)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total a Cobrar</span>
                    <span className="font-black text-green-600 text-2xl">{formatCurrency(totalToPay)}</span>
                </div>
            </div>
            
            <label className="flex items-start gap-4 p-6 bg-blue-50/50 rounded-2xl border-2 border-blue-100 mt-8 cursor-pointer group">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600" />
                <span className="text-xs font-bold text-blue-900 leading-tight">Certifico que el cliente ha recibido el monto en efectivo o transferencia y acepta el calendario de pagos presentado.</span>
            </label>

            <div className="flex gap-4 mt-10">
                <button onClick={() => setStep(2)} className="flex-1 py-5 font-black text-gray-400 text-xs tracking-widest">CORREGIR</button>
                <button onClick={handleSave} disabled={!agreed} className="flex-[2] bg-green-600 disabled:opacity-30 text-white py-5 rounded-2xl font-black text-sm tracking-widest uppercase shadow-2xl active:scale-95 transition-all">Generar Préstamo</button>
            </div>
        </div>
      )}
    </div>
  );
};
