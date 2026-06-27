import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    getCompanies, createCompany, getGlobalMetrics, 
    updateCompany, getGlobalConfig, updateGlobalConfig,
    getSaaSPlans, saveSaaSPlan, getNodesTelemetry, getMasterLogs
} from '../services/dataService';
import { Company, Role, SaaSPlan, GlobalConfig } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
    Crown, Building, Plus, Search, Globe, Users, 
    X, TrendingUp, TrendingDown, DollarSign, Zap, Settings, 
    Monitor, Bell, Package, Tag, Edit3, Calendar,
    Hammer, History, ArrowRight, Activity, ShieldCheck,
    AlertCircle, Database, MapPin, Ghost, EyeOff, Sparkles,
    ShieldAlert, Terminal, Clock, Download
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, refreshUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformConfig, setPlatformConfig] = useState<GlobalConfig>(getGlobalConfig());
  const [activeTab, setActiveTab] = useState<'NEXUS' | 'TENANTS' | 'PLANS' | 'SYSTEM' | 'AUDIT'>('NEXUS');
  const [isYearly, setIsYearly] = useState(false);
  
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);

  // Form states
  const [provisionName, setProvisionName] = useState('');
  const [provisionPlanId, setProvisionPlanId] = useState('p2');
  const [provisionCycle, setProvisionCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [provisionPrice, setProvisionPrice] = useState(3500);

  const refreshData = useCallback(() => {
    setCompanies(getCompanies());
    setPlans(getSaaSPlans());
    setPlatformConfig(getGlobalConfig());
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== Role.SUPER_ADMIN) {
        navigate('/');
        return;
    }
    refreshData();
    // Auto-refresh telemetry every 5 seconds
    const interval = setInterval(() => {
      if (activeTab === 'NEXUS') refreshData();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.role, navigate, refreshData, activeTab]);

  const metrics = useMemo(() => getGlobalMetrics(), [companies, activeTab]);
  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) && c.id !== 'SYSTEM');
  const masterLogs = useMemo(() => getMasterLogs(), [activeTab, companies, platformConfig]);
  const telemetria = useMemo(() => getNodesTelemetry(), [activeTab]);

  const performanceData = [
    { name: 'Lun', trans: 120 }, { name: 'Mar', trans: 230 }, { name: 'Mie', trans: 190 },
    { name: 'Jue', trans: 450 }, { name: 'Vie', trans: 380 }, { name: 'Sab', trans: 620 }, { name: 'Dom', trans: 540 }
  ];

  const handleUpdateConfig = () => {
      updateGlobalConfig(platformConfig);
      refreshData();
  };

  const handleToggleCompany = (id: string, status: Company['status']) => {
      const newStatus = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      updateCompany(id, { status: newStatus });
      refreshData();
  };

  const handleToggleGhost = (id: string, current: boolean) => {
      updateCompany(id, { isGhostMode: !current });
      refreshData();
  };

  const handleProvision = (e: React.FormEvent) => {
      e.preventDefault();
      const data = { name: provisionName, planId: provisionPlanId, billingCycle: provisionCycle, subscriptionPrice: provisionPrice };
      if (editingCompany) updateCompany(editingCompany.id, data as any);
      else createCompany(data as any, currentUser!);
      refreshData();
      setIsCompanyModalOpen(false);
      setEditingCompany(null);
  };

  const handleUpdatePlan = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const data = {
          ...editingPlan!,
          name: formData.get('name') as string || editingPlan!.name,
          maxClients: Number(formData.get('maxClients')),
          maxUsers: Number(formData.get('maxUsers')),
          maxBranches: Number(formData.get('maxBranches')),
          monthlyPrice: Number(formData.get('monthlyPrice')),
          yearlyPrice: Number(formData.get('yearlyPrice')) || Number(formData.get('monthlyPrice')) * 10,
      };
      saveSaaSPlan(data);
      refreshData();
      setIsPlanModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 space-y-6 pb-24 animate-fadeIn relative">
      {/* Header Nexus Master */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-900 pb-5 pt-2 px-4 md:px-6 relative z-20 bg-slate-950/70 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_24px_rgba(37,99,235,0.25)] text-white border border-blue-400/20 shrink-0">
                <Crown size={22} className="animate-pulse" />
            </div>
            <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-black text-white tracking-tighter uppercase italic leading-none truncate">Nexus Core <span className="text-blue-500">Master</span></h1>
                <p className="text-blue-500 font-black text-[9px] uppercase tracking-[0.18em] mt-1 flex items-center gap-2">
                    <Activity size={10} className="animate-ping" /> TOTAL SYSTEM AUTHORITY
                </p>
            </div>
        </div>
        
        <div className="w-full xl:w-auto overflow-x-auto no-scrollbar pb-2 xl:pb-0 [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
          <div className="flex xl:grid xl:grid-cols-5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 gap-0.5 shadow-2xl flex-nowrap min-w-max xl:min-w-0 snap-x snap-mandatory">
            {[
              {id: 'NEXUS', label: 'Monitor', icon: Globe},
              {id: 'TENANTS', label: 'Empresas', icon: Building},
              {id: 'PLANS', label: 'Tiers', icon: Package},
              {id: 'SYSTEM', label: 'Kernel', icon: Hammer},
              {id: 'AUDIT', label: 'Auditoría', icon: History},
            ].map(tab => (
              <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id as any)} 
                  className={`flex-1 snap-start flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap 
                        ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              >
                <tab.icon size={14}/> <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MONITOR GLOBAL */}
      {activeTab === 'NEXUS' && (
        <div className="animate-fadeIn space-y-6 px-4 md:px-6 pb-16">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: 'MRR ESTIMADO', val: formatCurrency(metrics.mrr), icon: DollarSign, color: 'text-blue-500' },
                    { label: 'COBROS TOTALES', val: formatCurrency(metrics.totalRevenue), icon: TrendingUp, color: 'text-emerald-500' },
                    { label: 'CAPITAL EN CALLE', val: formatCurrency(metrics.totalPortfolio), icon: Globe, color: 'text-white' },
                    { label: 'INSTANCIAS ACTIVAS', val: metrics.totalTenants, icon: Building, color: 'text-purple-500' },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-slate-900/40 p-4 md:p-5 rounded-[1.5rem] border border-slate-800/40 flex flex-col justify-between group hover:border-blue-500/20 transition-all shadow-xl">
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-2.5 bg-slate-800/50 rounded-lg ${kpi.color}`}><kpi.icon size={18}/></div>
                            <TrendingUp size={14} className="text-slate-700" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                            <h3 className={`text-lg md:text-xl font-black tracking-tighter ${kpi.color}`}>{kpi.val}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                <div className="lg:col-span-8 bg-slate-900/40 p-5 md:p-6 rounded-[1.75rem] border border-slate-900 shadow-inner">
                    <h3 className="text-base font-black text-white uppercase tracking-tighter mb-5 flex items-center gap-2.5">
                        <TrendingUp size={18} className="text-blue-500"/> Tráfico de Operaciones Globales
                    </h3>
                    <div className="h-[240px] md:h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={performanceData}>
                                <defs>
                                    <linearGradient id="nexusGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#475569" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '11px' }} />
                                <Area type="monotone" dataKey="trans" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#nexusGrad)" dot={{r: 4, fill: '#3b82f6'}} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-4 bg-slate-900/60 p-5 md:p-6 rounded-[1.75rem] border border-slate-800">
                    <h3 className="text-base font-black text-white uppercase tracking-tighter mb-5 flex items-center gap-2.5">
                        <MapPin size={18} className="text-purple-500"/> Telemetría de Servidores
                    </h3>
                    <div className="space-y-4 overflow-y-auto max-h-[320px] pr-2 custom-scrollbar">
                        {telemetria.map(node => (
                            <div key={node.id} className="p-4 bg-slate-950/50 rounded-[1.25rem] border border-slate-800 group hover:border-blue-500/30 transition-all">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-tight">{node.id}</h4>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase">{node.region}</p>
                                    </div>
                                    <div className={`h-3 w-3 rounded-full animate-pulse bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]`}></div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[8px] font-black uppercase text-slate-600">
                                        <span>CPU LOAD</span><span>{node.cpu}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{width: `${node.cpu}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* GESTIÓN DE EMPRESAS */}
      {activeTab === 'TENANTS' && (
          <div className="animate-fadeIn space-y-5 px-4 md:px-6 pb-16">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 relative group w-full">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                    <input type="text" placeholder="Buscar instancia..." className="w-full pl-12 pr-5 py-4 bg-slate-900 border border-slate-800 rounded-xl outline-none font-bold text-sm text-white focus:border-blue-500 transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button onClick={() => { setEditingCompany(null); setProvisionName(''); setProvisionPlanId('p2'); setProvisionCycle('MONTHLY'); setProvisionPrice(3500); setIsCompanyModalOpen(true); }} className="w-full md:w-auto bg-blue-600 text-white px-7 py-4 rounded-xl font-black text-[11px] tracking-widest uppercase shadow-lg flex items-center justify-center gap-2.5 active:scale-95 transition-all shrink-0"><Plus size={16}/> Aprovisionar</button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {filteredCompanies.map(comp => {
                      const plan = plans.find(p => p.id === comp.planId);
                      const isGhost = !!comp.isGhostMode;
                      return (
                        <div key={comp.id} className={`p-5 md:p-6 rounded-[1.75rem] border transition-all flex flex-col lg:flex-row justify-between items-center gap-5 ${isGhost ? 'bg-purple-900/10 border-purple-500/30 shadow-2xl' : 'bg-slate-900 border-slate-800 hover:border-blue-500/30 shadow-xl'}`}>
                            <div className="flex items-center gap-4 w-full">
                                <div className={`h-14 w-14 rounded-[1.25rem] flex items-center justify-center font-black text-xl shadow-inner shrink-0 relative ${isGhost ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}`}>
                                    {comp.name[0]}
                                    {isGhost && ( <div className="absolute -top-1 -right-1 bg-purple-500 text-white p-1.5 rounded-full border border-slate-950"><Ghost size={12}/></div> )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                        <h4 className={`text-lg md:text-xl font-black tracking-tighter uppercase truncate leading-none ${isGhost ? 'text-purple-400' : 'text-white'}`}>{comp.name}</h4>
                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${comp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>{comp.status}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 md:gap-6">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Tag size={14} className="text-blue-500"/> {plan?.name}</p>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={14} className="text-blue-500"/> Expira: {formatDate(comp.expiresAt)}</p>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Database size={14} className="text-blue-500"/> UID: {comp.id}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full lg:w-auto shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                                <button onClick={() => handleToggleGhost(comp.id, isGhost)} className={`flex-1 lg:flex-none p-3 rounded-xl transition-all flex items-center justify-center border-2 ${isGhost ? 'bg-purple-600 border-purple-400 text-white shadow-xl' : 'bg-slate-800 border-transparent text-slate-500 hover:text-purple-400 hover:border-purple-400'}`} title="Protocolo Invisible">{isGhost ? <Ghost size={18}/> : <EyeOff size={18}/>}</button>
                                <button onClick={() => { setEditingCompany(comp); setProvisionName(comp.name); setProvisionPlanId(comp.planId); setProvisionCycle(comp.billingCycle); setProvisionPrice(comp.subscriptionPrice || 0); setIsCompanyModalOpen(true); }} className="flex-1 lg:flex-none p-3 bg-slate-800 text-slate-300 rounded-xl hover:text-white transition-all shadow-lg"><Edit3 size={18}/></button>
                                <button onClick={() => handleToggleCompany(comp.id, comp.status)} className={`flex-[2] lg:flex-none px-6 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all shadow-2xl ${comp.status === 'ACTIVE' ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' : 'bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white'}`}>{comp.status === 'ACTIVE' ? 'CORTAR ACCESO' : 'ACTIVAR NODO'}</button>
                            </div>
                        </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* KERNEL CONFIG */}
      {activeTab === 'SYSTEM' && (
        <div className="animate-fadeIn space-y-6 px-4 md:px-6 max-w-4xl mx-auto pb-16">
            <div className="bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-800 space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Hammer size={150}/></div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className={`h-14 w-14 rounded-[1.25rem] flex items-center justify-center border-2 transition-all shadow-inner ${platformConfig.maintenanceMode ? 'bg-red-600/10 text-red-500 border-red-500/30' : 'bg-emerald-600/10 text-emerald-500 border-emerald-500/30'}`}>
                            {platformConfig.maintenanceMode ? <ShieldAlert size={26}/> : <ShieldCheck size={26}/>} 
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1">Protocolo de Bloqueo</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Lockdown Control Authority</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setPlatformConfig({...platformConfig, maintenanceMode: !platformConfig.maintenanceMode})}
                        className={`w-full md:w-auto px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl ${platformConfig.maintenanceMode ? 'bg-red-600 text-white scale-105' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
                    >
                        {platformConfig.maintenanceMode ? 'BLOQUEO ACTIVO' : 'INFRAESTRUCTURA LISTA'}
                    </button>
                </div>

                <div className="space-y-5 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mensaje de Difusión Global</label>
                        <input className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl outline-none font-bold text-sm text-white focus:border-blue-500 shadow-inner" value={platformConfig.broadcastMessage} onChange={e => setPlatformConfig({...platformConfig, broadcastMessage: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de Mantenimiento</label>
                            <input type="date" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl outline-none font-bold text-sm text-white shadow-inner" value={platformConfig.maintenanceDate} onChange={e => setPlatformConfig({...platformConfig, maintenanceDate: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Versión del Kernel</label>
                            <input className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl outline-none font-black text-sm text-blue-500 shadow-inner" value={platformConfig.systemVersion} onChange={e => setPlatformConfig({...platformConfig, systemVersion: e.target.value})} />
                        </div>
                    </div>
                </div>

                <button onClick={handleUpdateConfig} className="w-full bg-blue-600 text-white py-5 rounded-[1.25rem] font-black text-[11px] tracking-[0.28em] uppercase shadow-2xl hover:bg-blue-700 active:scale-95 border-b-4 border-blue-900 transition-all flex items-center justify-center gap-3"><Zap size={18}/> SINCRONIZAR_NUCLEO_NEXUS</button>
            </div>
        </div>
      )}

      {/* AUDITORÍA MASTER */}
      {activeTab === 'AUDIT' && (
        <div className="animate-fadeIn px-4 md:px-6 pb-20 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-5">
                <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none mb-1">Bitácora de Autoridad Master</h3>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.25em] flex items-center gap-2"><History size={12}/> Transacciones Críticas del Kernel Nexus</p>
                </div>
                <button className="w-full md:w-auto p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 shrink-0"><Download size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">EXPORTAR .LOG</span></button>
            </div>
            
            <div className="space-y-3">
                {masterLogs.map(log => (
                    <div key={log.id} className="p-5 bg-slate-900/60 rounded-[1.5rem] border border-slate-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 group hover:bg-slate-900 hover:border-blue-500/20 transition-all shadow-lg relative overflow-hidden">
                        <div className="flex items-start md:items-center gap-5 flex-1 min-w-0">
                            <div className="p-3 bg-slate-800 rounded-xl text-blue-500 border border-slate-700/50 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0 shadow-inner"><Terminal size={20}/></div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-base font-black text-white uppercase tracking-tight mb-2 group-hover:text-blue-400 transition-colors">{log.action}</h4>
                                <p className="text-sm text-slate-500 font-mono italic opacity-90 leading-relaxed break-words bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">{log.detail}</p>
                            </div>
                        </div>
                        <div className="text-left md:text-right shrink-0 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-800/60 flex flex-row md:flex-col justify-between items-center md:items-end">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{formatDate(log.timestamp)}</p>
                            <p className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-2 mt-1.5"><Clock size={12}/> {new Date(log.timestamp).toLocaleTimeString('es-DO')}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* TIERS / PLANS */}
      {activeTab === 'PLANS' && (
          <div className="animate-fadeIn space-y-6 px-4 md:px-6 pb-16">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                 <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-1">Niveles de Suscripción</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pricing Tiers Authority</p>
                 </div>
                 <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 shadow-xl items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 ${!isYearly ? 'text-white' : 'text-slate-500'}`}>Mensual</span>
                    <button 
                        onClick={() => setIsYearly(!isYearly)}
                        className="w-12 h-6 bg-blue-600 rounded-full p-1 transition-colors shadow-inner flex items-center relative"
                    >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${isYearly ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 flex items-center gap-2 ${isYearly ? 'text-emerald-400' : 'text-slate-500'}`}>Anual <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded text-[8px] border border-emerald-500/20">-10%</span></span>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {plans.map(plan => (
                      <div key={plan.id} className="bg-slate-900/40 p-6 md:p-7 rounded-[2rem] border border-slate-800 shadow-2xl flex flex-col group hover:border-blue-500/20 transition-all">
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.25em] mb-3 flex items-center gap-2"><Zap size={12} className="animate-pulse" /> RESOURCE TIER</p>
                          <h3 className="text-2xl font-black text-white tracking-tighter mb-6 uppercase italic leading-none">{plan.name}</h3>
                          <div className="space-y-3 mb-8 flex-1">
                                <div className="flex justify-between items-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/40">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Clientes</span>
                                    <span className="text-xl font-black text-white tracking-tighter">{plan.maxClients}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/40">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Staff</span>
                                    <span className="text-xl font-black text-white tracking-tighter">{plan.maxUsers}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/40">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sucursales</span>
                                    <span className="text-xl font-black text-white tracking-tighter">{plan.maxBranches}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/40">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Precio ({isYearly ? 'Anual' : 'Mensual'})</span>
                                    <span className={`text-xl font-black tracking-tighter ${isYearly ? 'text-emerald-400' : 'text-blue-500'}`}>{formatCurrency(isYearly ? (plan.yearlyPrice || plan.monthlyPrice * 10) : plan.monthlyPrice)}</span>
                                </div>
                          </div>
                          <button onClick={() => { setEditingPlan(plan); setIsPlanModalOpen(true); }} className="w-full py-5 bg-slate-800 text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-slate-950 shadow-xl">
                            <Hammer size={18}/> RECALIBRAR RECURSOS
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* MODALS */}
      {isPlanModalOpen && editingPlan && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-800 animate-scaleIn">
                  <div className="p-6 bg-slate-800/30 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Tier: {editingPlan.name}</h3>
                    <button onClick={() => { setIsPlanModalOpen(false); setEditingPlan(null); }} className="p-2.5 bg-slate-800 rounded-xl text-slate-500 hover:text-red-500 transition-all shadow-inner"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleUpdatePlan} className="p-6 space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">MAX_CLIENTES</label><input name="maxClients" type="number" required className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-lg text-white focus:border-blue-500 shadow-inner" defaultValue={editingPlan.maxClients} /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">MAX_STAFF</label><input name="maxUsers" type="number" required className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-lg text-white focus:border-blue-500 shadow-inner" defaultValue={editingPlan.maxUsers} /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">MAX_SUCURSALES</label><input name="maxBranches" type="number" required className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-lg text-white focus:border-blue-500 shadow-inner" defaultValue={editingPlan.maxBranches || 1} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">PRECIO_MO (DOP)</label><input name="monthlyPrice" type="number" required className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-lg text-blue-500 focus:border-blue-500 shadow-inner" defaultValue={editingPlan.monthlyPrice} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">PRECIO_ANUAL (DOP)</label><input name="yearlyPrice" type="number" required className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-lg text-emerald-500 focus:border-emerald-500 shadow-inner" defaultValue={editingPlan.yearlyPrice || editingPlan.monthlyPrice * 10} /></div>
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all border-b-4 border-blue-800">Sincronizar Recursos</button>
                  </form>
              </div>
          </div>
      )}

      {isCompanyModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-800 animate-scaleIn">
                  <div className="p-6 bg-slate-800/30 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight italic">{editingCompany ? 'Recalibrar Nodo' : 'Provisión Nexus Core'}</h3>
                    <button onClick={() => setIsCompanyModalOpen(false)} className="p-2.5 bg-slate-800 rounded-xl text-slate-500 hover:text-red-500 transition-all shadow-inner"><X size={22}/></button>
                  </div>
                  <form onSubmit={handleProvision} className="p-6 space-y-6">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Comercial (Legal RD)</label>
                          <input required className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-lg text-white shadow-inner focus:border-blue-500" value={provisionName} onChange={e => setProvisionName(e.target.value)} placeholder="Ej: Presta Fácil RD" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">NIVEL_RECURSO</label>
                            <select className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-[10px] uppercase text-white focus:border-blue-500" value={provisionPlanId} onChange={e => {
                                const val = e.target.value;
                                setProvisionPlanId(val);
                                const p = plans.find(x => x.id === val);
                                if(p) setProvisionPrice(provisionCycle === 'YEARLY' ? (p.yearlyPrice || p.monthlyPrice * 10) : p.monthlyPrice);
                            }}>
                              {plans.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CICLO_PAGO</label>
                            <select className="w-full p-4 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-[10px] uppercase text-white focus:border-blue-500" value={provisionCycle} onChange={e => {
                                const val = e.target.value as 'MONTHLY' | 'YEARLY';
                                setProvisionCycle(val);
                                const p = plans.find(x => x.id === provisionPlanId);
                                if(p) setProvisionPrice(val === 'YEARLY' ? (p.yearlyPrice || p.monthlyPrice * 10) : p.monthlyPrice);
                            }}>
                              <option value="MONTHLY">MENSUAL</option><option value="YEARLY">ANUAL</option>
                            </select>
                        </div>
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Precio Final Pactado (RD$)</label>
                          <input type="number" className="w-full p-5 bg-slate-950 border-2 border-slate-800 rounded-xl outline-none font-black text-3xl text-blue-500 focus:border-blue-500 shadow-inner" value={provisionPrice} onChange={e => setProvisionPrice(Number(e.target.value))} />
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[1.25rem] font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all border-b-4 border-blue-800 flex items-center justify-center gap-3"><Zap size={18}/> {editingCompany ? 'RECALIBRAR_NODO' : 'PROVISIONAR_AHORA'}</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
