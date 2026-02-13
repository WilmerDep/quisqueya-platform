import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie 
} from 'recharts';
import { getLoans, getPayments, getClients } from '../services/dataService';
import { formatCurrency, formatDate } from '../utils';
import { Loan, LoanStatus, PaymentReceipt, Client, FichaType } from '../types';
import { 
  TrendingUp, TrendingDown, Calendar, FileText, Download, 
  ChevronRight, Users, AlertCircle, CheckCircle2, Filter, 
  ArrowUpRight, ArrowDownRight, Printer, X, Phone
} from 'lucide-react';

type Period = 'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'TOTAL';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [period, setPeriod] = useState<Period>('THIS_MONTH');
  
  // Drill-down State
  const [drillDownType, setDrillDownType] = useState<'MORA' | 'ACTIVOS' | 'SALDADOS' | null>(null);

  useEffect(() => {
    setLoans(getLoans());
    setPayments(getPayments());
    setClients(getClients());
  }, []);

  const reportData = useMemo(() => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const today = new Date();
    today.setHours(0,0,0,0);

    const filterByPeriod = (dateStr: string, p: Period) => {
      const d = new Date(dateStr);
      if (p === 'TODAY') return d.toDateString() === today.toDateString();
      if (p === 'THIS_MONTH') return d >= startOfThisMonth;
      if (p === 'LAST_MONTH') return d >= startOfLastMonth && d <= endOfLastMonth;
      return true;
    };

    // Current period metrics
    const periodPayments = payments.filter(p => filterByPeriod(p.date, period));
    const periodLoans = loans.filter(l => filterByPeriod(l.createdAt, period));
    
    const collected = periodPayments.reduce((acc, p) => acc + p.amount, 0);
    const lent = periodLoans.reduce((acc, l) => acc + l.amount, 0);
    const expectedInterest = periodLoans.reduce((acc, l) => acc + (l.totalToPay - l.amount), 0);

    // Previous period for comparison (Simple logic: Month vs Month)
    const prevPeriodPayments = payments.filter(p => filterByPeriod(p.date, period === 'THIS_MONTH' ? 'LAST_MONTH' : 'TOTAL'));
    const prevCollected = prevPeriodPayments.reduce((acc, p) => acc + p.amount, 0);
    const growth = prevCollected > 0 ? ((collected - prevCollected) / prevCollected) * 100 : 0;

    // Portfolio Status (Current Global)
    const inMora = loans.filter(l => {
        if (l.status === LoanStatus.COMPLETADO) return false;
        return l.installments.some(i => i.status !== 'PAGADO' && new Date(i.dueDate) < today);
    });
    const actives = loans.filter(l => l.status === LoanStatus.ACTIVO && !inMora.find(m => m.id === l.id));
    const finished = loans.filter(l => l.status === LoanStatus.COMPLETADO);

    return { 
      collected, lent, expectedInterest, growth, 
      inMora, actives, finished,
      totalPortfolio: loans.reduce((acc, l) => acc + l.balance, 0)
    };
  }, [loans, payments, period]);

  const chartData = [
    { name: 'Cobrado', value: reportData.collected, fill: '#10b981' },
    { name: 'Prestado', value: reportData.lent, fill: '#3b82f6' },
    { name: 'Ganancia Est.', value: reportData.expectedInterest, fill: '#8b5cf6' },
  ];

  const pieData = [
    { name: 'En Mora', value: reportData.inMora.length, color: '#ef4444' },
    { name: 'Al Día', value: reportData.actives.length, color: '#3b82f6' },
    { name: 'Saldados', value: reportData.finished.length, color: '#10b981' },
  ];

  const getDrillDownList = () => {
    if (drillDownType === 'MORA') return reportData.inMora;
    if (drillDownType === 'ACTIVOS') return reportData.actives;
    if (drillDownType === 'SALDADOS') return reportData.finished;
    return [];
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header & Period Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Análisis Financiero</h1>
            <p className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <TrendingUp size={16} className="text-green-500"/>
                Rendimiento de cartera en tiempo real
            </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 no-print">
            {(['TODAY', 'THIS_MONTH', 'LAST_MONTH', 'TOTAL'] as Period[]).map(p => (
                <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all
                        ${period === p ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}
                    `}
                >
                    {p === 'TODAY' ? 'HOY' : p === 'THIS_MONTH' ? 'ESTE MES' : p === 'LAST_MONTH' ? 'MES PASADO' : 'TODO'}
                </button>
            ))}
            <div className="w-px h-6 bg-gray-100 mx-2" />
            <button 
                onClick={() => window.print()}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                title="Imprimir Reporte"
            >
                <Printer size={20} />
            </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-green-600" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Cobrado</p>
              <h3 className="text-2xl font-black text-gray-900 mb-2">{formatCurrency(reportData.collected)}</h3>
              <div className={`flex items-center gap-1 text-xs font-bold ${reportData.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {reportData.growth >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                {Math.abs(reportData.growth).toFixed(1)}% vs anterior
              </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Calendar size={64} className="text-blue-600" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Colocación (Préstamos)</p>
              <h3 className="text-2xl font-black text-gray-900 mb-2">{formatCurrency(reportData.lent)}</h3>
              <p className="text-xs text-gray-400 font-bold">Inversión en capital nuevo</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-purple-600" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ganancia Proyectada</p>
              <h3 className="text-2xl font-black text-purple-600 mb-2">{formatCurrency(reportData.expectedInterest)}</h3>
              <p className="text-xs text-gray-400 font-bold">Intereses generados en periodo</p>
          </div>

          <div className="bg-gray-900 p-6 rounded-[2rem] shadow-2xl shadow-gray-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FileText size={64} className="text-white" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Balance en Calle</p>
              <h3 className="text-2xl font-black text-white mb-2">{formatCurrency(reportData.totalPortfolio)}</h3>
              <p className="text-xs text-blue-400 font-bold">Total por recuperar</p>
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Resumen Financiero del Periodo</h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400"><div className="w-2 h-2 rounded-full bg-green-500" /> Cobrado</div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400"><div className="w-2 h-2 rounded-full bg-blue-500" /> Prestado</div>
                </div>
             </div>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} 
                            dy={10}
                        />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px'}}
                            cursor={{fill: '#f8fafc'}}
                            formatter={(value: any) => [formatCurrency(value), '']}
                        />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Portfolio Breakdown Pie */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8 w-full">Salud de Cartera</h3>
            <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={8}
                            dataKey="value"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-black text-gray-900">{loans.length}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Totales</p>
                </div>
            </div>
            <div className="mt-8 space-y-3 w-full">
                {pieData.map(item => (
                    <button 
                        key={item.name}
                        onClick={() => setDrillDownType(item.name === 'En Mora' ? 'MORA' : item.name === 'Al Día' ? 'ACTIVOS' : 'SALDADOS')}
                        className="w-full flex justify-between items-center p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}} />
                            <span className="text-xs font-bold text-gray-600">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-gray-900">{item.value}</span>
                            <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-900 transition-colors" />
                        </div>
                    </button>
                ))}
            </div>
          </div>
      </div>

      {/* Drill-down Modal */}
      {drillDownType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-scaleIn">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900">
                            {drillDownType === 'MORA' ? 'Clientes en Mora' : drillDownType === 'ACTIVOS' ? 'Clientes al Día' : 'Préstamos Saldados'}
                        </h3>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">{getDrillDownList().length} registros encontrados</p>
                    </div>
                    <button onClick={() => setDrillDownType(null)} className="p-3 bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-all">
                        <X size={20}/>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {getDrillDownList().length === 0 ? (
                        <div className="text-center py-20">
                            <CheckCircle2 size={48} className="mx-auto text-gray-100 mb-4"/>
                            <p className="text-gray-400 font-bold">No hay clientes en esta categoría.</p>
                        </div>
                    ) : (
                        getDrillDownList().map(loan => {
                            const client = clients.find(c => c.id === loan.clientId);
                            return (
                                <div key={loan.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between hover:border-blue-200 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white
                                            ${drillDownType === 'MORA' ? 'bg-red-500' : drillDownType === 'ACTIVOS' ? 'bg-blue-500' : 'bg-green-500'}
                                        `}>
                                            {client?.firstName[0]}
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-900">{client?.firstName} {client?.lastName}</p>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                                Saldo: {formatCurrency(loan.balance)} • {loan.frequency}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <a 
                                            href={`tel:${client?.phone}`}
                                            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-blue-600 shadow-sm"
                                        >
                                            <Phone size={16}/>
                                        </a>
                                        <button 
                                            onClick={() => navigate(`/clients/${client?.id}`)}
                                            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black tracking-widest shadow-lg shadow-gray-200"
                                        >
                                            PERFIL
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                
                <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-[2.5rem]">
                    <button 
                        onClick={() => setDrillDownType(null)}
                        className="w-full py-4 text-gray-400 font-black text-xs tracking-widest uppercase"
                    >
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Print View (Hidden in Screen) */}
      <div id="print-area" className="hidden p-12 bg-white font-sans text-gray-900">
          <div className="flex justify-between items-center border-b-4 border-black pb-8 mb-10">
              <div>
                <h1 className="text-4xl font-black tracking-tighter">REPORTE FINANCIERO PRESTAFÁCIL</h1>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mt-2">República Dominicana • {formatDate(new Date().toISOString())}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">Estado: {period === 'THIS_MONTH' ? 'Cierre Mensual' : 'Periodo Custom'}</p>
                <p className="text-[10px] text-gray-400 font-black">AUDITORÍA INTERNA</p>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-16">
              <div className="space-y-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Métricas de Rendimiento</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Cobrado</p>
                        <p className="text-2xl font-black">{formatCurrency(reportData.collected)}</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Crecimiento</p>
                        <p className="text-2xl font-black text-green-600">+{reportData.growth.toFixed(1)}%</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Colocación</p>
                        <p className="text-2xl font-black">{formatCurrency(reportData.lent)}</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Interés Proyectado</p>
                        <p className="text-2xl font-black text-blue-600">{formatCurrency(reportData.expectedInterest)}</p>
                    </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Estado de Riesgo</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center py-2">
                        <span className="font-bold text-gray-600">Préstamos en Mora:</span>
                        <span className="font-black text-red-600 text-lg">{reportData.inMora.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="font-bold text-gray-600">Préstamos al Día:</span>
                        <span className="font-black text-blue-600 text-lg">{reportData.actives.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="font-bold text-gray-600">Préstamos Saldados:</span>
                        <span className="font-black text-green-600 text-lg">{reportData.finished.length}</span>
                    </div>
                    <div className="pt-4 mt-4 border-t border-gray-200 flex justify-between items-center">
                        <span className="font-black uppercase tracking-widest text-xs">Total Recuperable:</span>
                        <span className="font-black text-2xl">{formatCurrency(reportData.totalPortfolio)}</span>
                    </div>
                </div>
              </div>
          </div>

          <div className="mt-20 pt-10 border-t-2 border-dashed border-gray-200 text-center">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em]">Fin del Reporte • Generado Automáticamente por PrestaFácil RD</p>
          </div>
      </div>
    </div>
  );
};