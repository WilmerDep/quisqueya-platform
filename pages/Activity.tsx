
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGlobalActivity, getUsers } from '../services/dataService';
import { ActivityEvent, ActivityType, User } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { 
  Search, Calendar, Filter, Download, Printer, ChevronRight, 
  Banknote, StickyNote, Hourglass, ShieldOff, PlusCircle, 
  TrendingUp, X, User as UserIcon, Clock
} from 'lucide-react';

export const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<ActivityType | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'HOY' | 'SEMANA' | 'TODO'>('TODO');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    setEvents(getGlobalActivity());
  }, []);

  const filteredEvents = useMemo(() => {
    let result = [...events];
    const now = new Date();
    now.setHours(0,0,0,0);

    if (dateFilter === 'HOY') {
        result = result.filter(e => new Date(e.timestamp).toDateString() === now.toDateString());
    } else if (dateFilter === 'SEMANA') {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        result = result.filter(e => new Date(e.timestamp) >= lastWeek);
    }

    if (selectedType !== 'ALL') {
        result = result.filter(e => e.type === selectedType);
    }

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(e => 
            e.clientName.toLowerCase().includes(lower) || 
            e.title.toLowerCase().includes(lower) ||
            e.userName.toLowerCase().includes(lower)
        );
    }

    return result;
  }, [events, searchTerm, selectedType, dateFilter]);

  const groupedEvents = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
        const date = new Date(event.timestamp).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
    }, {} as Record<string, ActivityEvent[]>);
  }, [filteredEvents]);

  const getEventIcon = (type: ActivityType) => {
    switch (type) {
        case 'PAGO': return <Banknote className="text-green-600" size={18}/>;
        case 'NOTA': return <StickyNote className="text-blue-600" size={18}/>;
        case 'PROMESA': return <Hourglass className="text-orange-600" size={18}/>;
        case 'BLOQUEO': return <ShieldOff className="text-red-600" size={18}/>;
        case 'PRESTAMO': return <PlusCircle className="text-purple-600" size={18}/>;
        default: return <StickyNote className="text-gray-600" size={18}/>;
    }
  };

  const getEventColor = (type: ActivityType) => {
    switch (type) {
        case 'PAGO': return 'bg-green-50 border-green-100';
        case 'NOTA': return 'bg-blue-50 border-blue-100';
        case 'PROMESA': return 'bg-orange-50 border-orange-100';
        case 'BLOQUEO': return 'bg-red-50 border-red-100';
        case 'PRESTAMO': return 'bg-purple-50 border-purple-100';
        default: return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Actividad Reciente</h1>
            <p className="text-sm text-gray-500 font-medium">Auditoría global de eventos en tiempo real</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => window.print()}
                className="bg-white border border-gray-100 text-gray-600 px-5 py-3 rounded-2xl font-black text-xs tracking-widest flex items-center gap-2 shadow-sm hover:bg-gray-50 transition-all"
            >
                <Printer size={16}/> EXPORTAR PDF
            </button>
        </div>
      </div>

      {/* Quick Filters Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar no-print">
         {[
            { id: 'TODO', label: 'Todo el Historial' },
            { id: 'HOY', label: 'Eventos de Hoy' },
            { id: 'SEMANA', label: 'Esta Semana' }
         ].map(chip => (
             <button
                key={chip.id}
                onClick={() => setDateFilter(chip.id as any)}
                className={`px-5 py-2 rounded-full text-[10px] font-black tracking-widest whitespace-nowrap transition-all border-2
                    ${dateFilter === chip.id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 text-gray-400'}
                `}
             >
                 {chip.label.toUpperCase()}
             </button>
         ))}
      </div>

      {/* Search & Type Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <div className="md:col-span-2 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar cliente, staff o concepto..."
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-50 rounded-2xl outline-none focus:border-blue-500 font-medium shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-50 rounded-2xl outline-none focus:border-blue-500 font-black text-xs tracking-widest appearance-none shadow-sm"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
            >
                <option value="ALL">TODOS LOS TIPOS</option>
                <option value="PAGO">PAGOS RECIBIDOS</option>
                <option value="NOTA">NOTAS / VISITAS</option>
                <option value="PROMESA">PROMESAS DE PAGO</option>
                <option value="CONDUCTA">CAMBIOS CONDUCTA</option>
                <option value="PRESTAMO">NUEVOS PRESTAMOS</option>
            </select>
        </div>
      </div>

      {/* Timeline View */}
      <div className="space-y-12 mt-8">
        {Object.keys(groupedEvents).length === 0 ? (
            <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 no-print">
                <Clock size={48} className="mx-auto text-gray-100 mb-4" />
                <p className="text-gray-400 font-bold">No hay actividad para mostrar con los filtros actuales.</p>
            </div>
        ) : (
            Object.entries(groupedEvents).map(([date, dayEvents]) => (
                <div key={date} className="relative">
                    <div className="sticky top-4 z-10 mb-8 no-print">
                        <span className="bg-gray-900 text-white px-6 py-2 rounded-full text-[10px] font-black tracking-[0.2em] shadow-xl">
                            {new Date(date).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                        </span>
                    </div>

                    <div className="space-y-4 pl-4 md:pl-8 border-l-2 border-gray-100 ml-4">
                        {dayEvents.map(event => (
                            <div key={event.id} className="group relative">
                                <div className={`absolute -left-[2.35rem] top-4 w-5 h-5 rounded-full border-4 border-white shadow-sm transition-all group-hover:scale-125
                                    ${getEventColor(event.type).split(' ')[0].replace('bg-', 'bg-')}
                                `}></div>
                                
                                <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all group-hover:border-blue-100 group-hover:shadow-md bg-white`}>
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl border shrink-0 ${getEventColor(event.type)}`}>
                                            {getEventIcon(event.type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-black text-gray-900 text-base">{event.title}</h4>
                                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">• {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 font-medium leading-relaxed">{event.description}</p>
                                            
                                            <div className="flex flex-wrap items-center gap-4 mt-3">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                    <UserIcon size={12} className="text-blue-500"/>
                                                    Cliente: <span className="text-gray-900">{event.clientName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                    <TrendingUp size={12} className="text-purple-500"/>
                                                    Staff: <span className="text-gray-900">{event.userName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-gray-50">
                                        {event.amount && (
                                            <div className="text-right mr-4">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Monto</p>
                                                <p className="font-black text-gray-900 text-lg">{formatCurrency(event.amount)}</p>
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => navigate(`/clients/${event.clientId}`)}
                                            className="px-5 py-2.5 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-black tracking-widest hover:bg-gray-900 hover:text-white transition-all whitespace-nowrap"
                                        >
                                            VER PERFIL
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* PRINT VIEW TEMPLATE (HIDDEN) */}
      <div id="print-area" className="hidden p-12 bg-white font-sans">
          <div className="flex justify-between items-center border-b-4 border-black pb-8 mb-10">
              <div>
                <h1 className="text-3xl font-black tracking-tighter">HISTORIAL DE ACTIVIDAD</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mt-2">PRESTAFÁCIL RD • {formatDate(new Date().toISOString())}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest">Auditoría General</p>
                <p className="text-[9px] text-gray-400 font-black">Periodo: {dateFilter === 'TODO' ? 'Histórico' : dateFilter}</p>
              </div>
          </div>

          <table className="w-full text-left text-[10px]">
              <thead className="border-b-2 border-gray-100 font-black uppercase tracking-widest text-gray-400">
                  <tr>
                      <th className="py-4">Fecha/Hora</th>
                      <th className="py-4">Tipo</th>
                      <th className="py-4">Cliente</th>
                      <th className="py-4">Concepto</th>
                      <th className="py-4 text-right">Monto</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                  {filteredEvents.map(e => (
                      <tr key={e.id} className="py-4">
                          <td className="py-4 font-bold">{formatDate(e.timestamp)} {new Date(e.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                          <td className="py-4 font-black text-blue-600">{e.type}</td>
                          <td className="py-4 font-bold">{e.clientName}</td>
                          <td className="py-4 text-gray-600">{e.title}: {e.description.slice(0, 50)}...</td>
                          <td className="py-4 text-right font-black">{e.amount ? formatCurrency(e.amount) : '---'}</td>
                      </tr>
                  ))}
              </tbody>
          </table>

          <div className="mt-20 pt-10 border-t border-gray-200 text-center">
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.5em]">Fin del Reporte de Actividad</p>
          </div>
      </div>
    </div>
  );
};
