import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClients, createClient } from '../services/dataService';
import { Client, FichaType, Role } from '../types';
import { Plus, Search, User, MapPin, Phone, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Clients: React.FC = () => {
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    cedula: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    setClients(getClients());
  }, []);

  const filteredClients = clients.filter(c => 
    c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.nickname && c.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.cedula.includes(searchTerm)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClient(formData);
    setClients(getClients());
    setIsModalOpen(false);
    setFormData({ firstName: '', lastName: '', nickname: '', cedula: '', phone: '', address: '' });
  };

  const getRatingColor = (rating?: FichaType) => {
    switch (rating) {
        case FichaType.MALA: return 'bg-red-100 text-red-800';
        case FichaType.REGULAR: return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-green-100 text-green-800'; // Default Buena
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Directorio de Clientes</h1>
        
        {/* Solo el ADMIN puede ver el botón de crear cliente */}
        {currentUser.role === Role.ADMIN ? (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Cliente
          </button>
        ) : (
           <div className="flex items-center text-gray-400 text-sm bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 cursor-not-allowed" title="Solo administradores pueden crear clientes">
              <Lock className="w-4 h-4 mr-2" />
              Creación Restringida
           </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
          placeholder="Buscar por nombre, apodo o cédula..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <Link key={client.id} to={`/clients/${client.id}`} className="block group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-blue-400 transition-all hover:shadow-md relative">
                <div className="absolute top-5 right-5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${getRatingColor(client.creditRating)}`}>
                        {client.creditRating || 'BUENA'}
                    </span>
                </div>

                <div className="flex items-start justify-between">
                <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {client.firstName[0]}{client.lastName[0]}
                    </div>
                    <div className="ml-3">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-700">{client.firstName} {client.lastName}</h3>
                    {client.nickname && <p className="text-sm text-gray-500 italic">"{client.nickname}"</p>}
                    </div>
                </div>
                </div>
                
                <div className="mt-4 space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{client.cedula}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    {client.phone}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="truncate">{client.address}</span>
                </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end text-sm text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver Perfil Completo <ArrowRight size={16} className="ml-1"/>
                </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Registrar Nuevo Cliente</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                  <input 
                    required 
                    className="mt-1 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Apellido *</label>
                  <input 
                    required 
                    className="mt-1 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Apodo</label>
                <input 
                  className="mt-1 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={formData.nickname}
                  onChange={e => setFormData({...formData, nickname: e.target.value})}
                  placeholder="Ej: El Moreno, La Rubia..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Cédula *</label>
                    <input 
                      required 
                      className="mt-1 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      value={formData.cedula}
                      onChange={e => setFormData({...formData, cedula: e.target.value})}
                      placeholder="001-0000000-0"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Celular *</label>
                    <input 
                      required 
                      className="mt-1 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="809-000-0000"
                    />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Dirección Completa *</label>
                <textarea 
                  required 
                  className="mt-1 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  rows={3}
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Calle, Número, Sector, Referencia"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700">
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};