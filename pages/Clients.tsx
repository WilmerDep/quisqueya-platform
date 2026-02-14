
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getClients, createClient, getLoans, getUsers } from '../services/dataService';
import { Client, FichaType, Role, LoanStatus, User, ClientStatus } from '../types';
import { Plus, Search, MapPin, Phone, ArrowRight, Lock, Filter, AlertTriangle, ShieldOff, X, UserCheck, Clock, CheckCircle, XCircle, Camera, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Clients: React.FC = () => {
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [collectors, setCollectors] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'BLOCKED'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    cedula: '',
    phone: '',
    address: '',
    assignedUserId: '',
    photo: ''
  });

  useEffect(() => {
    setClients(getClients());
    setCollectors(getUsers());
  }, []);

  const loans = useMemo(() => getLoans(), []);

  const filteredAndSortedClients = useMemo(() => {
    let result = [...clients];
    if (currentUser.role === Role.COBRADOR) {
      result = result.filter(c => c.assignedUserId === currentUser.id);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(c => 
            c.firstName.toLowerCase().includes(lower) ||
            c.lastName.toLowerCase().includes(lower) ||
            (c.nickname && c.nickname.toLowerCase().includes(lower)) ||
            c.cedula.includes(searchTerm)
        );
    }
    if (filter === 'PENDING') result = result.filter(c => c.status === ClientStatus.PENDING);
    else if (filter === 'OVERDUE') {
        const overdueIds = loans.filter(l => l.status === LoanStatus.MORA).map(l => l.clientId);
        result = result.filter(c => overdueIds.includes(c.id));
    } else if (filter === 'BLOCKED') result = result.filter(c => c.isBlocked === true);

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [clients, searchTerm, filter, loans, currentUser]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData({ ...formData, photo: reader.result as string });
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assignedUserId && currentUser.role !== Role.COBRADOR) {
        alert("Debe asignar un oficial");
        return;
    }
    const submissionData = {
        ...formData,
        assignedUserId: currentUser.role === Role.COBRADOR ? currentUser.id : formData.assignedUserId
    };
    createClient(submissionData, currentUser);
    setClients(getClients());
    setIsModalOpen(false);
    setFormData({ firstName: '', lastName: '', nickname: '', cedula: '', phone: '', address: '', assignedUserId: '', photo: '' });
  };

  const getStatusBadge = (client: Client) => {
    if (client.isBlocked) return 'bg-red-600 text-white border-red-700 shadow-lg shadow-red-100';
    if (client.status === ClientStatus.PENDING) return 'bg-orange-100 text-orange-700 border-orange-200';
    switch (client.creditRating) {
        case FichaType.MALA: return 'bg-red-50 text-red-700 border-red-100';
        case FichaType.REGULAR: return 'bg-yellow-50 text-yellow-700 border-yellow-100';
        default: return 'bg-green-50 text-green-700 border-green-100';
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Expedientes</h1>
            <p className="text-sm text-gray-500 font-medium tracking-tight">Gestión integral de la cartera de clientes</p>
        </div>
        {currentUser.role !== Role.COBRADOR && (
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black flex items-center shadow-xl shadow-blue-100 transition-all active:scale-95 text-xs tracking-widest uppercase">
            <Plus className="w-4 h-4 mr-2" /> NUEVO CLIENTE
          </button>
        )}
      </div>

      <div className="space-y-6">
        <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input type="text" className="block w-full pl-14 pr-6 py-5 border-2 border-gray-100 rounded-[1.5rem] bg-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm font-medium" placeholder="Buscar por nombre, cédula o apodo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
            {[
                { id: 'ALL', label: 'Todos', icon: Filter },
                { id: 'PENDING', label: 'Pendientes', icon: Clock },
                { id: 'OVERDUE', label: 'En Mora', icon: AlertTriangle },
                { id: 'BLOCKED', label: 'Bloqueados', icon: ShieldOff },
            ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id as any)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${filter === f.id ? 'bg-gray-900 border-gray-900 text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                    <f.icon size={14} /> {f.label}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedClients.map(client => {
            const collector = collectors.find(u => u.id === client.assignedUserId);
            return (
                <Link key={client.id} to={`/clients/${client.id}`} className="block group">
                    <div className={`bg-white rounded-[2.5rem] shadow-sm border-2 p-8 hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden h-full flex flex-col justify-between ${client.status === ClientStatus.PENDING ? 'border-orange-200 bg-orange-50/10' : client.isBlocked ? 'border-red-200' : 'border-gray-50'}`}>
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                {client.photo ? (
                                    <div className="h-16 w-16 rounded-[1.5rem] overflow-hidden shadow-md border-2 border-white ring-4 ring-gray-50">
                                        <img src={client.photo} alt="Perfil" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className={`h-16 w-16 rounded-[1.5rem] flex items-center justify-center font-black text-2xl ${client.status === ClientStatus.PENDING ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-700'}`}>
                                        {client.firstName[0]}
                                    </div>
                                )}
                                <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border-2 uppercase tracking-widest ${getStatusBadge(client)}`}>
                                    {client.isBlocked ? 'BLOQUEADO' : client.status === ClientStatus.PENDING ? 'REVISIÓN' : (client.creditRating || 'BUENA')}
                                </span>
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 leading-tight mb-1">{client.firstName} {client.lastName}</h3>
                            {client.nickname && <p className="text-xs text-gray-400 font-bold italic">"{client.nickname}"</p>}
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-50 space-y-4">
                             <div className="flex items-center text-sm font-bold text-gray-700">
                                <Phone className="w-4 h-4 mr-3 text-blue-500" /> {client.phone}
                             </div>
                             
                             {/* FOTO DEL EMPLEADO / COBRADOR ASIGNADO */}
                             <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                {collector?.photo ? (
                                    <img src={collector.photo} alt="" className="w-8 h-8 rounded-xl object-cover border border-white shadow-sm" />
                                ) : (
                                    <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center text-[10px] font-black text-gray-500 uppercase">{collector?.avatar}</div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Cobrador</p>
                                    <p className="text-xs font-black text-gray-800 truncate leading-none uppercase">{collector?.name || 'Oficial Libre'}</p>
                                </div>
                             </div>
                        </div>
                    </div>
                </Link>
            );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-scaleIn border border-white/20">
            <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Alta de Cliente</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white shadow-sm rounded-full text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="flex justify-center mb-4">
                  <div className="relative group">
                      <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 shadow-xl ${formData.photo ? 'border-blue-500' : 'border-white bg-gray-100'}`}>
                          {formData.photo ? (<img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />) : (<ImageIcon size={40} className="text-gray-300" />)}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-gray-900 text-white p-3 rounded-2xl cursor-pointer hover:bg-black transition-all shadow-xl active:scale-90">
                          <Camera size={20} />
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input required className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="Nombre" />
                <input required className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="Apellido" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} placeholder="Cédula" />
                <input required className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Teléfono" />
              </div>
              <select required className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-black text-[11px] tracking-widest uppercase outline-none focus:border-blue-500" value={formData.assignedUserId} onChange={e => setFormData({...formData, assignedUserId: e.target.value})}>
                    <option value="">ASIGNAR COBRADOR</option>
                    {collectors.filter(u => u.role !== Role.SUPERVISOR).map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
              </select>
              <textarea className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold h-24" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Dirección Exacta..." />
              <button type="submit" className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black shadow-2xl hover:bg-black transition-all text-xs tracking-[0.2em] uppercase">REGISTRAR EXPEDIENTE</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
