
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getClients, createClient, getLoans, getUsers } from '../services/dataService';
import { Client, FichaType, Role, LoanStatus, User, ClientStatus } from '../types';
import { Plus, Search, MapPin, Phone, ArrowRight, Lock, Filter, AlertTriangle, ShieldOff, X, UserCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
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
    assignedUserId: ''
  });

  useEffect(() => {
    setClients(getClients());
    setCollectors(getUsers().filter(u => u.role === Role.COBRADOR || u.role === Role.ADMIN));
  }, []);

  const loans = useMemo(() => getLoans(), []);

  const filteredAndSortedClients = useMemo(() => {
    let result = [...clients];

    // RBAC: Cobradores ven su ruta (incluyendo pendientes)
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

    if (filter === 'PENDING') {
        result = result.filter(c => c.status === ClientStatus.PENDING);
    } else if (filter === 'OVERDUE') {
        const clientsWithOverdue = loans
            .filter(l => l.status === LoanStatus.MORA)
            .map(l => l.clientId);
        result = result.filter(c => clientsWithOverdue.includes(c.id));
    } else if (filter === 'BLOCKED') {
        result = result.filter(c => c.isBlocked === true);
    }

    return result.sort((a, b) => {
        // Prioridad: Bloqueados > Pendientes > Rating
        if (a.isBlocked && !b.isBlocked) return -1;
        if (a.status === ClientStatus.PENDING && b.status !== ClientStatus.PENDING) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [clients, searchTerm, filter, loans, currentUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assignedUserId && currentUser.role !== Role.COBRADOR) {
        alert("Debe asignar un oficial");
        return;
    }
    
    // Si es cobrador, se asigna el mismo
    const submissionData = {
        ...formData,
        assignedUserId: currentUser.role === Role.COBRADOR ? currentUser.id : formData.assignedUserId
    };

    createClient(submissionData, currentUser);
    setClients(getClients());
    setIsModalOpen(false);
    setFormData({ firstName: '', lastName: '', nickname: '', cedula: '', phone: '', address: '', assignedUserId: '' });
    
    if (currentUser.role === Role.COBRADOR) {
        alert("Prospecto guardado. Un administrador debe aprobarlo antes de crear préstamos.");
    } else {
        alert("Cliente registrado y aprobado exitosamente.");
    }
  };

  const getStatusBadge = (client: Client) => {
    if (client.isBlocked) return 'bg-red-600 text-white border-red-700';
    if (client.status === ClientStatus.PENDING) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (client.status === ClientStatus.REJECTED) return 'bg-red-50 text-red-700 border-red-100';
    
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
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Expedientes</h1>
            <p className="text-sm text-gray-500 font-medium">Gestión de prospectos y clientes activos</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black flex items-center shadow-xl shadow-blue-100 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          {currentUser.role === Role.COBRADOR ? 'REGISTRAR PROSPECTO' : 'NUEVO CLIENTE'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
                type="text"
                className="block w-full pl-12 pr-4 py-4 border-2 border-gray-100 rounded-2xl bg-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm font-medium"
                placeholder="Nombre, apodo o cédula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
            {[
                { id: 'ALL', label: 'Todos', icon: Filter },
                { id: 'PENDING', label: 'Por Aprobar', icon: Clock },
                { id: 'OVERDUE', label: 'En Mora', icon: AlertTriangle },
                { id: 'BLOCKED', label: 'Cicla / Bloqueados', icon: ShieldOff },
            ].map(f => (
                <button
                    key={f.id}
                    onClick={() => setFilter(f.id as any)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black whitespace-nowrap border-2 transition-all
                        ${filter === f.id ? 'bg-gray-900 border-gray-900 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}
                    `}
                >
                    <f.icon size={14} />
                    {f.label.toUpperCase()}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAndSortedClients.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-100">
                <Search size={48} className="mx-auto text-gray-100 mb-4" />
                <p className="text-gray-400 font-bold">No se encontraron registros.</p>
            </div>
        ) : (
            filteredAndSortedClients.map(client => (
                <Link key={client.id} to={`/clients/${client.id}`} className="block group">
                    <div className={`bg-white rounded-[2rem] shadow-sm border-2 p-6 hover:shadow-xl transition-all relative overflow-hidden h-full flex flex-col justify-between
                        ${client.status === ClientStatus.PENDING ? 'border-orange-200 bg-orange-50/20' : client.isBlocked ? 'border-red-600' : 'border-gray-50'}
                    `}>
                        {client.status === ClientStatus.PENDING && (
                            <div className="absolute top-0 right-0 bg-orange-500 text-white px-3 py-1 rounded-bl-xl flex items-center gap-1">
                                <Clock size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest">PENDIENTE</span>
                            </div>
                        )}
                        
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all
                                    ${client.status === ClientStatus.PENDING ? 'bg-orange-100 text-orange-600' : client.isBlocked ? 'bg-red-600 text-white' : 'bg-blue-50 text-blue-700'}
                                `}>
                                    {client.firstName[0]}
                                </div>
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full border-2 uppercase tracking-widest ${getStatusBadge(client)}`}>
                                    {client.isBlocked ? 'BLOQUEADO' : client.status === ClientStatus.PENDING ? 'EN REVISIÓN' : (client.creditRating || 'BUENA')}
                                </span>
                            </div>

                            <h3 className={`text-xl font-black leading-tight ${client.isBlocked ? 'text-red-700' : 'text-gray-900'}`}>
                                {client.firstName} {client.lastName}
                            </h3>
                            {client.nickname && (
                                <p className="text-xs text-gray-400 font-bold italic mt-1">"{client.nickname}"</p>
                            )}
                        </div>

                        <div className="mt-6 pt-5 border-t border-gray-50">
                             <div className="flex items-center text-sm font-bold text-gray-600 mb-2">
                                <Phone className="w-4 h-4 mr-3 text-blue-400" />
                                {client.phone}
                             </div>
                             <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 p-2 rounded-xl border border-gray-100">
                                <UserCheck className="w-3.5 h-3.5 mr-2 text-blue-500" />
                                OFICIAL: {collectors.find(c => c.id === client.assignedUserId)?.name || 'Sin asignar'}
                             </div>
                        </div>
                    </div>
                </Link>
            ))
        )}
      </div>

      {/* Modal: Nuevo Cliente / Prospecto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-8 py-6 bg-white border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-900">
                {currentUser.role === Role.COBRADOR ? 'Nuevo Prospecto' : 'Registrar Cliente'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Nombre</label>
                  <input required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" 
                    value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Apellido</label>
                  <input required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" 
                    value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Cédula</label>
                  <input className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" 
                    value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} placeholder="001-0000000-0" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Teléfono</label>
                  <input required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" 
                    value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              
              {currentUser.role !== Role.COBRADOR && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Cobrador Asignado</label>
                  <select required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 outline-none font-black text-xs tracking-widest uppercase"
                      value={formData.assignedUserId} onChange={e => setFormData({...formData, assignedUserId: e.target.value})}>
                      <option value="">-- SELECCIONE OFICIAL --</option>
                      {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Dirección Exacta</label>
                <textarea className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold h-24" 
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-gray-400 tracking-widest text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 tracking-widest text-xs uppercase hover:bg-blue-700">
                    {currentUser.role === Role.COBRADOR ? 'ENVIAR A REVISIÓN' : 'REGISTRAR Y APROBAR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
