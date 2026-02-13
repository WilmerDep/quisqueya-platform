
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    getClientById, getClientLoans, getClientFichas, getClientPayments, 
    updateClient, addFicha, updateClientStatus 
} from '../services/dataService';
import { Client, Loan, Ficha, PaymentReceipt, FichaType, LoanStatus, Role, ClientStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { 
    Phone, MapPin, AlertTriangle, CheckCircle, 
    Clock, ArrowLeft, Edit2, Plus, Download, X, TrendingUp, TrendingDown,
    ShieldOff, ShieldAlert, Wallet, Hash, FileText, Check, XCircle
} from 'lucide-react';

export const ClientProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [fichas, setFichas] = useState<Ficha[]>([]);
    const [payments, setPayments] = useState<PaymentReceipt[]>([]);
    const [activeTab, setActiveTab] = useState<'RESUMEN' | 'HISTORIAL' | 'FICHAS'>('RESUMEN');

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isFichaOpen, setIsFichaOpen] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

    const [editForm, setEditForm] = useState<Partial<Client>>({});
    const [fichaForm, setFichaForm] = useState({ type: FichaType.REGULAR, reason: '', note: '', impact: 'NEUTRAL' });
    const [blockReason, setBlockReason] = useState('');

    useEffect(() => {
        if (id) loadData(id);
    }, [id]);

    const loadData = (clientId: string) => {
        const c = getClientById(clientId);
        if (c) {
            setClient({ ...c }); 
            setEditForm({ ...c });
            setLoans(getClientLoans(clientId));
            setFichas(getClientFichas(clientId));
            setPayments(getClientPayments(clientId));
        }
    };

    const handleApproval = (status: ClientStatus) => {
        if (!client) return;
        
        const confirmMsg = `¿Desea cambiar el estatus de ${client.firstName} a ${status.toUpperCase()}?`;
        
        if (window.confirm(confirmMsg)) {
            try {
                // Actualizamos y capturamos el retorno
                const updated = updateClientStatus(client.id, status, currentUser);
                
                // Actualizamos el estado local INMEDIATAMENTE con el objeto retornado
                setClient({ ...updated });
                
                // Refrescamos otros datos (bitácora, etc)
                loadData(client.id);
                
                alert(`Expediente actualizado a: ${status.toUpperCase()}`);
            } catch (error) {
                console.error("Error en aprobación:", error);
                alert("No se pudo actualizar el estatus.");
            }
        }
    };

    const handleUpdateClient = (e: React.FormEvent) => {
        e.preventDefault();
        if (id && editForm) {
            const updated = updateClient(id, editForm);
            setClient({ ...updated });
            setIsEditOpen(false);
            alert("Información actualizada.");
        }
    };

    const handleUnblock = () => {
        if (!client) return;
        if (window.confirm("¿CONFIRMAR DESBLOQUEO? El cliente volverá a estar habilitado para préstamos.")) {
            const updated = updateClient(client.id, { isBlocked: false, blockReason: '', creditRating: FichaType.BUENA });
            addFicha({ 
                clientId: client.id, 
                type: FichaType.BUENA, 
                reason: 'DESBLOQUEO DE CUENTA', 
                note: `El oficial ${currentUser.name} retiró el bloqueo manual.`, 
                impact: 'UP', 
                createdBy: currentUser.id 
            });
            setClient({ ...updated }); 
            loadData(client.id);
        }
    };

    if (!client) return <div className="p-12 text-center font-black text-gray-400 uppercase tracking-widest animate-pulse">Cargando Expediente...</div>;

    return (
        <div className="space-y-6 pb-20 animate-fadeIn">
            {/* Banner de Estado Pendiente: Visible solo para Admin/Supervisor */}
            {client.status === ClientStatus.PENDING && (
                <div className="bg-orange-500 text-white p-7 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between shadow-2xl gap-6 no-print border-4 border-orange-400/30">
                    <div className="flex items-center gap-5">
                        <div className="bg-white/20 p-4 rounded-3xl">
                            <Clock size={44} />
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-[0.2em] text-[10px] text-orange-100 mb-1">PROSPECTO ESPERANDO REVISIÓN</p>
                            <p className="text-xl font-black leading-tight">Este expediente debe ser validado antes de otorgar crédito.</p>
                        </div>
                    </div>
                    {/* Control de roles para aprobación */}
                    {currentUser.role !== Role.COBRADOR && (
                        <div className="flex gap-3 w-full md:w-auto">
                            <button 
                                onClick={() => handleApproval(ClientStatus.REJECTED)} 
                                className="flex-1 md:flex-none bg-red-600 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-red-700 active:scale-95 transition-all"
                            >
                                RECHAZAR
                            </button>
                            <button 
                                onClick={() => handleApproval(ClientStatus.APPROVED)} 
                                className="flex-1 md:flex-none bg-white text-orange-600 px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-gray-50 active:scale-95 transition-all"
                            >
                                APROBAR CLIENTE
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Banner de Cliente Rechazado */}
            {client.status === ClientStatus.REJECTED && (
                <div className="bg-gray-800 text-white p-7 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between shadow-xl gap-6 no-print border-4 border-gray-700">
                    <div className="flex items-center gap-5">
                        <div className="bg-red-500/20 p-4 rounded-3xl">
                            <XCircle size={44} className="text-red-400" />
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-[0.2em] text-[10px] text-gray-400 mb-1">EXPEDIENTE RECHAZADO</p>
                            <p className="text-xl font-black leading-tight">Este cliente no cumple con las políticas de la empresa.</p>
                        </div>
                    </div>
                    {currentUser.role !== Role.COBRADOR && (
                        <button 
                            onClick={() => handleApproval(ClientStatus.APPROVED)} 
                            className="w-full md:w-auto bg-blue-600 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
                        >
                            RECONSIDERAR / APROBAR
                        </button>
                    )}
                </div>
            )}

            {/* Banner de Bloqueo / Cicla */}
            {client.isBlocked && (
                <div className="bg-red-600 text-white p-7 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between shadow-2xl gap-6 no-print border-4 border-red-500">
                    <div className="flex items-center gap-5">
                        <div className="bg-white/20 p-4 rounded-3xl">
                            <ShieldOff size={44} />
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-[0.2em] text-[10px] text-red-100 mb-1">CLIENTE BLOQUEADO (CICLA)</p>
                            <p className="text-xl font-black leading-tight">{client.blockReason || 'Inhabilitado por comportamiento de pago.'}</p>
                        </div>
                    </div>
                    {currentUser.role !== Role.COBRADOR && (
                        <button onClick={handleUnblock} className="w-full md:w-auto bg-white text-red-600 px-10 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl hover:bg-gray-100 transition-all">RETIRAR BLOQUEO</button>
                    )}
                </div>
            )}

            {/* Header de Perfil */}
            <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/clients')} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 shadow-sm transition-all active:scale-90">
                        <ArrowLeft size={22} className="text-gray-600"/>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">{client.firstName} {client.lastName}</h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">EXPEDIENTE: {client.status.toUpperCase()}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => { setEditForm({...client}); setIsEditOpen(true); }} 
                        className="p-4 bg-white border border-gray-100 rounded-2xl text-gray-500 hover:text-blue-600 shadow-sm transition-all active:scale-90"
                    >
                        <Edit2 size={22} />
                    </button>
                </div>
            </div>

            {/* Resumen y Tarjeta de Estatus */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">Datos de Identidad y Contacto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Cédula del Cliente</p>
                            <p className="font-black text-gray-900 text-lg tracking-tight">{client.cedula || 'NO REGISTRADA'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Teléfono de Contacto</p>
                            <a href={`tel:${client.phone}`} className="font-black text-blue-600 text-xl hover:underline">{client.phone}</a>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Dirección de Cobro</p>
                            <p className="font-bold text-gray-600 text-base leading-relaxed">{client.address}</p>
                        </div>
                    </div>
                </div>

                <div className={`rounded-[2.5rem] p-10 flex flex-col justify-center items-center text-center shadow-sm border-2 transition-all
                    ${client.status === ClientStatus.APPROVED ? 'bg-green-50 border-green-100' : 
                      client.status === ClientStatus.REJECTED ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}
                `}>
                    <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center mb-5 shadow-2xl
                        ${client.status === ClientStatus.APPROVED ? 'bg-green-600 text-white' : 
                          client.status === ClientStatus.REJECTED ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}
                    `}>
                        {client.status === ClientStatus.APPROVED ? <CheckCircle size={40}/> : 
                         client.status === ClientStatus.REJECTED ? <XCircle size={40}/> : <Clock size={40}/>}
                    </div>
                    <h4 className="font-black text-gray-900 uppercase tracking-tight text-2xl mb-1">{client.status}</h4>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estatus de Crédito</p>
                    
                    {/* El botón de nuevo préstamo solo aparece si el cliente está aprobado */}
                    {client.status === ClientStatus.APPROVED && !client.isBlocked && (
                        <button 
                            onClick={() => navigate('/loans/new', { state: { clientId: client.id } })}
                            className="mt-8 w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-gray-400/30 active:scale-95 transition-all"
                        >
                            CREAR PRÉSTAMO
                        </button>
                    )}

                    {client.status === ClientStatus.PENDING && (
                        <p className="mt-6 text-xs font-bold text-orange-700 leading-tight">
                            Esperando aprobación para habilitar cobros y préstamos.
                        </p>
                    )}
                </div>
            </div>

            {/* Tabs de Contenido */}
            <div className="flex bg-white rounded-[1.5rem] p-1 shadow-sm border border-gray-100 no-print">
                {[
                    { id: 'RESUMEN', label: 'PRÉSTAMOS', icon: Wallet }, 
                    { id: 'HISTORIAL', label: 'PAGOS', icon: Clock }, 
                    { id: 'FICHAS', label: 'BITÁCORA', icon: AlertTriangle }
                ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[1.2rem] text-[11px] font-black tracking-widest transition-all ${activeTab === t.id ? 'bg-gray-900 text-white shadow-2xl' : 'text-gray-400 hover:text-gray-700'}`}>
                        <t.icon size={16}/> {t.label}
                    </button>
                ))}
            </div>

            <div className="animate-fadeIn no-print">
                {activeTab === 'RESUMEN' && (
                    <div className="space-y-4">
                        {loans.length === 0 ? (
                            <div className="bg-white p-20 rounded-[3rem] border border-gray-100 text-center">
                                <FileText size={48} className="mx-auto text-gray-100 mb-4" />
                                <p className="font-black text-gray-300 uppercase tracking-[0.3em] text-xs">Sin préstamos activos</p>
                            </div>
                        ) : (
                            loans.map(loan => (
                                <div key={loan.id} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8 group hover:border-blue-200 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="p-5 bg-blue-50 text-blue-600 rounded-[1.5rem]"><Hash size={28}/></div>
                                        <div>
                                            <h4 className="font-black text-gray-900 text-xl leading-none mb-1">#{loan.id.slice(0,6).toUpperCase()}</h4>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{loan.frequency}</p>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Inversión</p>
                                        <p className="font-black text-gray-900 text-lg">{formatCurrency(loan.amount)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Saldo Pendiente</p>
                                        <p className="font-black text-red-600 text-lg">{formatCurrency(loan.balance)}</p>
                                    </div>
                                    <Badge status={loan.status} />
                                </div>
                            ))
                        )}
                    </div>
                )}
                
                {activeTab === 'FICHAS' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Notas Conductuales</h3>
                            <button onClick={() => setIsFichaOpen(true)} className="px-6 py-3 bg-gray-900 text-white text-[10px] font-black rounded-xl shadow-xl active:scale-95 transition-all">AGREGAR NOTA</button>
                        </div>
                        {fichas.length === 0 ? (
                             <div className="bg-white p-20 rounded-[3rem] border border-gray-100 text-center">
                                <p className="font-black text-gray-300 uppercase tracking-[0.2em] text-xs">Bitácora Vacía</p>
                             </div>
                        ) : (
                            fichas.map(ficha => (
                                <div key={ficha.id} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <h5 className="font-black text-gray-900 uppercase text-lg">{ficha.reason}</h5>
                                        <span className="text-[10px] text-gray-400 font-black">{formatDate(ficha.createdAt)}</span>
                                    </div>
                                    <p className="text-base text-gray-600 font-medium leading-relaxed">{ficha.note}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Modal Editar Perfil */}
            {isEditOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-gray-900">Editar Perfil</h3>
                            <button onClick={() => setIsEditOpen(false)} className="p-3 bg-gray-100 rounded-full text-gray-400 hover:text-gray-900"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleUpdateClient} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Nombre</label>
                                    <input required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 outline-none font-bold focus:bg-white focus:border-blue-500 transition-all" value={editForm.firstName || ''} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Apellido</label>
                                    <input required className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 outline-none font-bold focus:bg-white focus:border-blue-500 transition-all" value={editForm.lastName || ''} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Cédula</label>
                                <input className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 outline-none font-bold focus:bg-white focus:border-blue-500 transition-all" value={editForm.cedula || ''} onChange={e => setEditForm({...editForm, cedula: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Teléfono</label>
                                <input className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 outline-none font-bold focus:bg-white focus:border-blue-500 transition-all" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Dirección</label>
                                <textarea className="w-full border-2 border-gray-50 rounded-2xl p-4 bg-gray-50 outline-none font-bold h-24 focus:bg-white focus:border-blue-500 transition-all" value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all">Guardar Cambios</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
