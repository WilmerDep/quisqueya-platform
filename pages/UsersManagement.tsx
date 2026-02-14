
import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, getClients } from '../services/dataService';
import { User, Role } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, UserPlus, Shield, ToggleLeft, ToggleRight, 
  Search, X, Edit3, Briefcase, Phone, Mail, UserCheck,
  Camera, Image as ImageIcon
} from 'lucide-react';

export const UsersManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    role: Role.COBRADOR,
    phone: '',
    isActive: true,
    photo: ''
  });

  useEffect(() => {
    setUsers(getUsers());
    setClients(getClients());
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    if (editingUser) {
        updateUser(editingUser.id, formData, currentUser.id);
    } else {
        createUser({
            ...formData,
            avatar: formData.name.split(' ').map(n => n[0]).join('').toUpperCase()
        }, currentUser.id);
    }
    setUsers(getUsers());
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', username: '', role: Role.COBRADOR, phone: '', isActive: true, photo: '' });
    setEditingUser(null);
  };

  const toggleStatus = (user: User) => {
    updateUser(user.id, { isActive: !user.isActive }, currentUser.id);
    setUsers(getUsers());
  };

  const getCollectorStats = (userId: string) => {
    return clients.filter(c => c.assignedUserId === userId).length;
  };

  const getRoleBadge = (role: Role) => {
    switch(role) {
        case Role.ADMIN: return 'bg-purple-100 text-purple-700 border-purple-200';
        case Role.SUPERVISOR: return 'bg-blue-100 text-blue-700 border-blue-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gestión de Equipo</h1>
            <p className="text-sm text-gray-500 font-medium">Control de accesos, roles y rutas de cobro</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black flex items-center shadow-xl shadow-gray-200 active:scale-95 transition-all"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          AGREGAR PERSONAL
        </button>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
            type="text" 
            placeholder="Buscar por nombre o usuario..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none font-medium shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredUsers.map(user => (
            <div key={user.id} className={`bg-white rounded-[2rem] p-6 border-2 transition-all shadow-sm flex flex-col justify-between
                ${!user.isActive ? 'border-red-100 opacity-60 grayscale' : 'border-gray-50 hover:border-blue-100'}
            `}>
                <div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                            {user.photo ? (
                                <img src={user.photo} alt={user.name} className="w-14 h-14 rounded-2xl object-cover border border-gray-200" />
                            ) : (
                                <div className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center font-black text-xl">
                                    {user.avatar}
                                </div>
                            )}
                            <div>
                                <h3 className="font-black text-gray-900 text-lg leading-tight">{user.name}</h3>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">@{user.username}</p>
                            </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full border uppercase tracking-widest ${getRoleBadge(user.role)}`}>
                            {user.role}
                        </span>
                    </div>

                    <div className="space-y-3 my-6">
                        <div className="flex items-center text-sm font-bold text-gray-500">
                            <Phone className="w-4 h-4 mr-3 text-blue-400" />
                            {user.phone || 'Sin teléfono'}
                        </div>
                        <div className="flex items-center text-sm font-bold text-gray-500">
                            <Briefcase className="w-4 h-4 mr-3 text-gray-400" />
                            {getCollectorStats(user.id)} Clientes asignados
                        </div>
                    </div>
                </div>

                <div className="pt-5 border-t border-gray-50 flex justify-between items-center gap-2">
                    <button 
                        onClick={() => { 
                            setEditingUser(user); 
                            setFormData({
                                name: user.name,
                                username: user.username,
                                role: user.role,
                                phone: user.phone || '',
                                isActive: user.isActive,
                                photo: user.photo || ''
                            }); 
                            setIsModalOpen(true); 
                        }}
                        className="flex-1 py-3 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all"
                    >
                        EDITAR
                    </button>
                    <button 
                        onClick={() => toggleStatus(user)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all
                            ${user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}
                        `}
                    >
                        {user.isActive ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                        {user.isActive ? 'SUSPENDER' : 'ACTIVAR'}
                    </button>
                </div>
            </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-scaleIn">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-gray-900">{editingUser ? 'Actualizar Datos' : 'Registrar Nuevo Personal'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-400"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    
                    {/* User Photo Upload */}
                    <div className="flex justify-center mb-4">
                        <div className="relative group cursor-pointer">
                            <div className={`w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden border-4 ${formData.photo ? 'border-blue-600' : 'border-gray-100 bg-gray-50'}`}>
                                {formData.photo ? (
                                    <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon size={32} className="text-gray-300" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 bg-gray-900 text-white p-2 rounded-xl cursor-pointer hover:bg-black transition-colors shadow-lg">
                                <Camera size={14} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Nombre Completo</label>
                        <input required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" 
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Roberto Sánchez" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Usuario (Login)</label>
                            <input required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" 
                                value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="roberto_rd" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Teléfono</label>
                            <input className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-bold" 
                                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="809-000-0000" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Rol del Sistema</label>
                        <select className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none font-black text-xs tracking-widest uppercase"
                            value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})}>
                            <option value={Role.COBRADOR}>COBRADOR (RUTA)</option>
                            <option value={Role.SUPERVISOR}>SUPERVISOR (AUDITORÍA)</option>
                            <option value={Role.ADMIN}>ADMINISTRADOR (TODO)</option>
                        </select>
                    </div>
                    
                    <div className="flex gap-4 pt-6">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 font-black text-gray-400 tracking-widest text-xs uppercase">Cancelar</button>
                        <button type="submit" className="flex-[2] bg-blue-600 text-white py-5 rounded-2xl font-black shadow-2xl shadow-blue-100 tracking-widest text-xs uppercase">
                            {editingUser ? 'GUARDAR CAMBIOS' : 'REGISTRAR MIEMBRO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
