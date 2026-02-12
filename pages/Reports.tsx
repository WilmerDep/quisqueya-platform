import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getLoans, getPayments } from '../services/dataService';
import { formatCurrency } from '../utils';
import { Loan, LoanStatus, PaymentReceipt } from '../types';
import { TrendingUp } from 'lucide-react';

export const Reports: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);

  useEffect(() => {
    // Cargar datos al montar el componente para asegurar frescura
    setLoans(getLoans());
    setPayments(getPayments());
  }, []);
  
  // Cálculos dinámicos basados en el estado real de las cuotas y balances
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a inicio del día

    let saldados = 0;
    let enMora = 0;
    let activosAlDia = 0;
    let collectedToday = 0;

    // 1. Calcular Métricas de Préstamos
    loans.forEach(loan => {
        // Verificar si está saldado (completado o balance < 1)
        if (loan.status === LoanStatus.COMPLETADO || loan.balance < 1) {
            saldados++;
            return;
        }

        // Verificar si tiene atrasos reales (Dinámico)
        const hasOverdueInstallments = loan.installments.some(inst => {
            if (inst.status === 'PAGADO') return false;
            const dueDate = new Date(inst.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < today; // Venció ayer o antes
        });

        if (hasOverdueInstallments || loan.status === LoanStatus.MORA) {
            enMora++;
        } else {
            activosAlDia++;
        }
    });

    // 2. Calcular Cobrado Hoy usando recibos de pago
    collectedToday = payments.reduce((sum, p) => {
        const pDate = new Date(p.date);
        pDate.setHours(0, 0, 0, 0);
        
        if (pDate.getTime() === today.getTime()) {
            return sum + p.amount;
        }
        return sum;
    }, 0);

    return { saldados, enMora, activosAlDia, collectedToday };
  }, [loans, payments]);

  // Datos para el gráfico
  const chartData = [
    { name: 'Prestado', amount: loans.reduce((acc, l) => acc + l.amount, 0), fill: '#3b82f6' },
    { name: 'Ganancia', amount: loans.reduce((acc, l) => acc + (l.totalToPay - l.amount), 0), fill: '#22c55e' },
    { name: 'Pendiente', amount: loans.reduce((acc, l) => acc + l.balance, 0), fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reportes Financieros</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gráfico */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-96">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Flujo de Capital</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis tickFormatter={(value) => `$${value/1000}k`} />
                    <Tooltip 
                        formatter={(value: number) => formatCurrency(value)} 
                        cursor={{fill: 'transparent'}}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Tarjetas de Métricas */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-96 flex flex-col">
             <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Estado de Cartera</h3>
             <div className="flex-1 space-y-3 overflow-y-auto">
                {/* Nueva Tarjeta: Cobrado Hoy */}
                <div className="flex justify-between items-center p-4 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                             <TrendingUp size={20} />
                        </div>
                        <span className="font-bold">Cobrado Hoy</span>
                    </div>
                    <span className="font-extrabold text-2xl">{formatCurrency(metrics.collectedToday)}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-blue-50 text-blue-900 rounded-lg border border-blue-100">
                    <span className="font-medium">Activos (Al día)</span>
                    <span className="font-bold text-2xl">{metrics.activosAlDia}</span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-red-50 text-red-900 rounded-lg border border-red-100">
                    <span className="font-medium">En Mora (Atrasados)</span>
                    <span className="font-bold text-2xl">{metrics.enMora}</span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-gray-50 text-gray-700 rounded-lg border border-gray-100">
                    <span className="font-medium">Saldados / Completados</span>
                    <span className="font-bold text-2xl">{metrics.saldados}</span>
                </div>
             </div>
             
             <div className="pt-4 mt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm text-gray-500">
                    <span>Total Préstamos Registrados:</span>
                    <span className="font-medium">{loans.length}</span>
                </div>
             </div>
          </div>
      </div>
    </div>
  );
};