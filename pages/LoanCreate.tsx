import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClients, createLoan } from '../services/dataService';
import { Client, Frequency } from '../types';
import { formatCurrency, generateSchedule } from '../utils';
import { Calculator, ArrowRight, ArrowLeft, Check, User, DollarSign, Percent, Calendar, Layers, Clock } from 'lucide-react';

export const LoanCreate: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  
  // State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [amount, setAmount] = useState<number>(5000);
  const [interest, setInterest] = useState<number>(20); // 20% es estándar calle
  const [frequency, setFrequency] = useState<Frequency>(Frequency.SEMANAL);
  const [duration, setDuration] = useState<number>(13); // 13 semanas es estándar
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setClients(getClients());
  }, []);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Calcular resumen en tiempo real
  const schedule = generateSchedule(amount || 0, interest || 0, duration || 1, frequency, startDate);
  const totalToPay = schedule.reduce((sum, i) => sum + i.expectedAmount, 0);
  const quotaAmount = schedule.length > 0 ? schedule[0].expectedAmount : 0;

  const handleSave = () => {
    if (!selectedClientId) return;
    createLoan({
      clientId: selectedClientId,
      amount,
      interestRate: interest,
      frequency,
      duration,
      startDate
    });
    navigate('/loans');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Nuevo Préstamo</h1>
            <p className="text-gray-500 mt-1">Configure los detalles del financiamiento</p>
         </div>
         <div className="bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-blue-600 shadow-sm">
            Paso {step} de 3
         </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${(step/3)*100}%` }}></div>
      </div>

      {/* STEP 1: Select Client */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 animate-fadeIn">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={24}/></div>
            Seleccionar Cliente
          </h2>
          
          <div className="space-y-6">
             <div className="relative">
                <select 
                    className="w-full p-4 pl-5 border border-gray-200 rounded-xl text-lg text-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white shadow-sm transition-all appearance-none cursor-pointer hover:border-blue-300"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    size={6} // List view style
                    style={{ backgroundImage: 'none' }} // Remove default arrow
                >
                    {clients.length === 0 && <option disabled className="bg-white">No hay clientes registrados</option>}
                    {clients.map(c => (
                        <option key={c.id} value={c.id} className="bg-white py-3 px-2 rounded-lg hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 text-gray-700">
                            {c.firstName} {c.lastName} — {c.cedula}
                        </option>
                    ))}
                </select>
                <div className="absolute top-0 right-0 p-4 pointer-events-none text-gray-400 text-xs uppercase font-bold tracking-wider">
                    {clients.length} disponibles
                </div>
             </div>
             
             {selectedClientId && (
                 <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-md shadow-blue-50/50 flex items-center justify-between ring-1 ring-blue-100">
                    <div className="flex gap-4 items-center">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                            {selectedClient?.firstName[0]}
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-lg">{selectedClient?.firstName} {selectedClient?.lastName}</p>
                            <p className="text-sm text-gray-500">{selectedClient?.nickname || 'Sin apodo'} • {selectedClient?.phone}</p>
                        </div>
                    </div>
                    <div className="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <Check size={20} strokeWidth={3} />
                    </div>
                 </div>
             )}

             <button 
                onClick={() => setStep(2)}
                disabled={!selectedClientId}
                className="w-full mt-6 bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
             >
                Continuar <ArrowRight className="ml-2 w-5 h-5" />
             </button>
          </div>
        </div>
      )}

      {/* STEP 2: Calculator */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 animate-fadeIn">
          <h2 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-3">
             <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Calculator size={24}/></div>
             Calculadora de Préstamo
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Monto */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Monto Capital</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500" />
                    </div>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="block w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-xl font-semibold shadow-sm"
                        placeholder="0.00"
                    />
                </div>
            </div>

            {/* Interes */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Interés (%)</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Percent className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500" />
                    </div>
                    <input 
                        type="number" 
                        value={interest}
                        onChange={(e) => setInterest(Number(e.target.value))}
                        className="block w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all text-xl font-semibold shadow-sm"
                    />
                </div>
            </div>

            {/* Frecuencia */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Frecuencia</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Clock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500" />
                    </div>
                    <select 
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as Frequency)}
                        className="block w-full pl-12 pr-10 py-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-lg font-medium shadow-sm appearance-none cursor-pointer"
                    >
                        {Object.values(Frequency).map(f => <option key={f} value={f} className="bg-white">{f}</option>)}
                    </select>
                </div>
            </div>

            {/* Duración */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Cuotas</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Layers className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500" />
                    </div>
                    <input 
                        type="number" 
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="block w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-xl font-semibold shadow-sm"
                    />
                </div>
            </div>
            
            {/* Fecha */}
            <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">Inicio de Pagos</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500" />
                    </div>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-lg font-medium shadow-sm"
                    />
                </div>
            </div>
          </div>

          {/* Live Preview Moderno */}
          <div className="mt-10 bg-white p-6 rounded-2xl border border-blue-100 shadow-xl shadow-blue-50/50 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center relative z-10">
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Cuota {frequency}</p>
                    <p className="text-2xl font-black text-blue-600">{formatCurrency(quotaAmount)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total a Pagar</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(totalToPay)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Ganancia</p>
                    <p className="text-xl font-bold text-green-600">+{formatCurrency(totalToPay - amount)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Termina</p>
                    <p className="text-xl font-bold text-gray-900">
                        {schedule.length > 0 ? new Date(schedule[schedule.length-1].dueDate).toLocaleDateString() : '-'}
                    </p>
                </div>
             </div>
          </div>

          <div className="flex gap-4 mt-8">
             <button onClick={() => setStep(1)} className="flex-1 py-4 border border-gray-200 bg-white rounded-xl font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <ArrowLeft className="inline w-5 h-5 mr-2"/> Volver
             </button>
             <button onClick={() => setStep(3)} className="flex-1 bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg shadow-gray-200">
                Revisar <ArrowRight className="inline w-5 h-5 ml-2"/>
             </button>
          </div>
        </div>
      )}

       {/* STEP 3: Review */}
       {step === 3 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Check size={24}/></div>
                Confirmar Préstamo
            </h2>
            
            <div className="space-y-6">
                {/* Changed from bg-gray-50 to bg-white with border and shadow */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">Cliente</span>
                        <span className="font-bold text-lg text-gray-900">{selectedClient?.firstName} {selectedClient?.lastName}</span>
                    </div>
                    <div className="h-px bg-gray-100"></div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">Capital Prestado</span>
                        <span className="font-bold text-lg text-gray-900">{formatCurrency(amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">Interés (Rédito)</span>
                        <span className="font-bold text-lg text-gray-900">{interest}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">Plan</span>
                        <span className="font-bold text-lg text-gray-900">{duration} pagos {frequency.toLowerCase()}s</span>
                    </div>
                </div>

                 <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg shadow-blue-200 flex justify-between items-center">
                    <span className="font-medium text-blue-100 uppercase tracking-wide">Cuota a pagar</span>
                    <span className="font-black text-3xl">{formatCurrency(quotaAmount)}</span>
                </div>
            </div>

            <div className="mt-8 flex gap-4">
             <button onClick={() => setStep(2)} className="flex-1 py-4 border border-gray-200 bg-white rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                Corregir
             </button>
             <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-xl shadow-green-100 transition-all transform hover:-translate-y-1">
                Crear Préstamo
             </button>
          </div>
        </div>
       )}
    </div>
  );
};