
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
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<ActivityType | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'HOY' | 'SEMANA' | 'TODO'>('TODO');

  useEffect(() => {
    setEvents(getGlobalActivity());
    setUsers(getUsers());
  }, []);

  const filteredEvents = useMemo(() => {
    let result = [...events];
    const now = new Date();
    now.setHours(0,0,0,0);
    if (dateFilter === 'HOY') result = result.filter(e => new Date(e.timestamp).toDateString() === now.toDateString());
    else if (dateFilter === 'SEMANA') {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        result = result.filter(e => new Date(e.timestamp) >= lastWeek);
    }
    if (selectedType !== 'ALL') result = result.filter(e => e.type === selectedType);
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(e => e.clientName?.toLowerCase().includes(lower) || e.userName.toLowerCase().includes(lower) || e.title.toLowerCase().includes(lower));
    }
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

  return (
    <div className="space-y-8 pb-24 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Bitácora Global</h1>
            <p className="text-sm text-gray-500 font-medium">Auditoría en tiempo real de operaciones de campo</p>
        </div>
        <button onClick={() => window.print()} className="bg-white border-2 border-gray-100 text-gray-900 px-6 py-4 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-all no-print">
            <Printer size={18}/> GENERAR REPORTE
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          <div className="md:col-span-2 relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input type="text" className="w-full pl-14 pr-6 py-5 border-2 border-gray-50 rounded-2xl outline-none focus:border-blue-500 font-bold bg-white shadow-sm" placeholder="Buscar empleado o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="w-full px-6 py-5 bg-white border-2 border-gray-50 rounded-2xl outline-none font-black text-[10px] tracking-widest uppercase focus:border-blue-500 shadow-sm" value={selectedType} onChange={(e) => setSelectedType(e.target.value as any)}>
              <option value="ALL">TODOS LOS EVENTOS</option>
              {['PAGO', 'NOTA', 'PROMESA', 'BLOQUEO', 'PRESTAMO', 'USER_MGMT', 'APPROVAL'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
      </div>

      <div className="space-y-16">
        {/* Fix: Explicitly cast Object.entries to ensure dayEvents is recognized as ActivityEvent[] instead of unknown */}
        {(Object.entries(groupedEvents) as [string, ActivityEvent[]][]).map(([date, dayEvents]) => (
            <div key={date} className="relative">
                <div className="sticky top-4 z-10 mb-8 flex justify-center no-print">
                    <span className="bg-gray-900 text-white px-8 py-2.5 rounded-full text-[10px] font-black tracking-[0.3em] shadow-2xl">
                        {new Date(date).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
                    </span>
                </div>
                <div className="space-y-6 pl-4 md:pl-12 border-l-4 border-gray-100 ml-4">
                    {dayEvents.map(event => {
                        const staff = users.find(u => u.id === event.userId);
                        return (
                            <div key={event.id} className="group relative">
                                <div className="absolute -left-[2.85rem] top-6 w-7 h-7 rounded-full bg-white border-4 border-gray-100 shadow-sm flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                </div>
                                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="flex items-start gap-5">
                                        <div className="p-4 rounded-[1.5rem] bg-gray-50 border border-gray-100 shrink-0">
                                            {getEventIcon(event.type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                                <h4 className="font-black text-gray-900 text-lg leading-none">{event.title}</h4>
                                                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-gray-600 font-medium leading-relaxed mb-4">{event.description}</p>
                                            
                                            <div className="flex flex-wrap items-center gap-6">
                                                {/* FOTO DEL EMPLEADO QUE REALIZÓ LA ACCIÓN */}
                                                <div className="flex items-center gap-2.5 group/staff">
                                                    {staff?.photo ? (
                                                        <img src={staff.photo} alt="" className="w-8 h-8 rounded-xl object-cover border-2 border-white shadow-sm ring-1 ring-gray-100" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center text-[10px] font-black text-gray-500 uppercase">{staff?.avatar}</div>
                                                    )}
                                                    <div>
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Operado por</p>
                                                        <p className="text-xs font-black text-gray-900 leading-none uppercase">{event.userName}</p>
                                                    </div>
                                                </div>
                                                {event.clientName && (
                                                    <div className="flex items-center gap-2.5 px-4 py-2 bg-blue-50/50 rounded-xl border border-blue-100">
                                                        <UserIcon size={14} className="text-blue-500" />
                                                        <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Cliente: {event.clientName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-6 md:pt-0 border-gray-50">
                                        {event.amount && (
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Impacto</p>
                                                <p className="text-2xl font-black text-gray-900 tracking-tighter">{formatCurrency(event.amount)}</p>
                                            </div>
                                        )}
                                        {event.clientId && (
                                            <button onClick={() => navigate(`/clients/${event.clientId}`)} className="p-3 bg-gray-900 text-white rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-gray-200">
                                                <ChevronRight size={24}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
