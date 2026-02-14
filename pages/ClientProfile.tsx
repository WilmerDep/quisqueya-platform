
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    getClientById, getClientLoans, getClientFichas, getClientPayments, 
    updateClient, addFicha, updateClientStatus, getUsers 
} from '../services/dataService';
import { Client, Loan, Ficha, PaymentReceipt, FichaType, Role, ClientStatus, User } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { 
    Phone, MapPin, AlertTriangle, CheckCircle, 
    Clock, ArrowLeft, Edit2, Plus, X, ShieldAlert, Wallet, Hash, FileText, Camera, Image as ImageIcon,
    Shield, AlertCircle, ShieldCheck
} from 'lucide-react';

export const ClientProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [fichas, setFichas] = useState<Ficha[]>([]);
    const [payments, setPayments] = useState<PaymentReceipt[]>([]);
    const [activeTab, setActiveTab] = useState<'RESUMEN' | 'HISTORIAL' | 'FICHAS'>('RESUMEN');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Client>>({});
    
    // Estados para el Modal de Aprobación/Rechazo
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [statusToSet, setStatusToSet] = useState<ClientStatus | null>(null);

    useEffect(() => {
        setUsers(getUsers());
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

    const triggerApprovalModal = (status: ClientStatus) => {
        setStatusToSet(status);
        setIsApprovalModalOpen(true);
    };

    const handleConfirmStatus = () => {
        if (!client || !statusToSet) return;
        
        const updated = updateClientStatus(client.id, statusToSet, currentUser);
        if (updated) {
            setClient({ ...updated });
            setIsApprovalModalOpen(false);
            setStatusToSet(null);
            loadData(client.id);
        }
    };

    const handleUpdateClient = (e: React.FormEvent) => {
        e.preventDefault();
        if (id && editForm) {
            const updated = updateClient(id, editForm);
            setClient({ ...updated });
            setIsEditOpen(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setEditForm({ ...editForm, photo: reader.result as string });
            reader.readAsDataURL(file);
        }
    };

    if (!client) return <div className="p-12 text-center font-black text-gray-400 uppercase tracking-widest animate-pulse">Cargando Expediente...</div>;

    const assignedOfficial = users.find(u => u.id === client.assignedUserId);

    return (
        <div className="space-y-8 pb-24 animate-fadeIn">
            {/* Banner de Estado Pendiente */}
            {client.status === ClientStatus.PENDING && (
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-8 rounded-[3rem] flex flex-col md:flex-row items-center justify-between shadow-2xl gap-8 border-4 border-white/20">
                    <div className="flex items-center gap-6">
                        <div className="bg-white/20 p-5 rounded-[2rem] backdrop-blur-md shadow-inner"><Clock size={40} /></div>
                        <div>
                            <p className="font-black uppercase tracking-[0.2em] text-[10px] text-orange-100 mb-1">PROSPECTO EN ESPERA</p>
                            <p className="text-xl font-black leading-tight">Este expediente debe ser validado antes de prestar.</p>
                        </div>
                    </div>
                    {currentUser.role !== Role.COBRADOR && (
                        <div className="flex gap-3 w-full md:w-auto">
                            <button 
                                onClick={() => triggerApprovalModal(ClientStatus.REJECTED)} 
                                className="flex-1 md:flex-none bg-red-600 px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-red-700 transition-all active:scale-95 border-b-4 border-red-800"
                            >
                                RECHAZAR
                            </button>
                            <button 
                                onClick={() => triggerApprovalModal(ClientStatus.APPROVED)} 
                                className="flex-1 md:flex-none bg-white text-orange-600 px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-orange-50 transition-all active:scale-95 border-b-4 border-gray-200"
                            >
                                APROBAR
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Header de Perfil con Navegación */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-8 w-full md:w-auto">
                    <button onClick={() => navigate('/clients')} className="p-4 bg-white border border-gray-100 rounded-[1.5rem] hover:bg-gray-50 shadow-sm transition-all active:scale-90">
                        <ArrowLeft size={24} className="text-gray-600"/>
                    </button>
                    <div className="flex items-center gap-6">
                        {client.photo ? (
                            <div className="h-24 w-24 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white ring-2 ring-gray-100">
                                <img src={client.photo} alt={client.firstName} className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="h-24 w-24 rounded-[2.5rem] bg-blue-50 text-blue-600 flex items-center justify-center font-black text-4xl shadow-inner border-2 border-white ring-2 ring-gray-100">
                                {client.firstName[0]}
                            </div>
                        )}
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tighter leading-none mb-2">{client.firstName} {client.lastName}</h1>
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border-2 uppercase tracking-[0.15em] shadow-sm ${client.isBlocked ? 'bg-red-600 text-white border-red-700' : client.status === ClientStatus.APPROVED ? 'bg-green-600 text-white border-green-700' : 'bg-gray-900 text-white border-gray-800'}`}>
                                    {client.isBlocked ? 'BLOQUEADO EN CICLA' : client.status.toUpperCase()}
                                </span>
                                {client.nickname && <p className="text-xs text-gray-400 font-bold italic">"{client.nickname}"</p>}
                            </div>
                        </div>
                    </div>
                </div>
                <button onClick={() => setIsEditOpen(true)} className="p-4 bg-white border-2 border-gray-100 rounded-[1.5rem] text-gray-500 hover:text-blue-600 shadow-sm transition-all active:scale-90 w-full md:w-auto flex justify-center">
                    <Edit2 size={24} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm space-y-12">
                    <div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 border-b border-gray-50 pb-4">Detalle de Identidad y Localización</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Cédula Dominicana</p>
                                <p className="font-black text-gray-900 text-xl tracking-tight">{client.cedula || 'SIN REGISTRO'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Contacto Directo</p>
                                <a href={`tel:${client.phone}`} className="font-black text-blue-600 text-2xl hover:underline tracking-tight">{client.phone}</a>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-3 flex items-center gap-2">
                                    <MapPin size={12}/> DIRECCIÓN DE COBRO REGISTRADA
                                </p>
                                <p className="font-bold text-gray-600 text-lg leading-relaxed bg-gray-50 p-6 rounded-[2rem] border border-gray-100 italic">
                                    "{client.address}"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* TARJETA DEL OFICIAL ASIGNADO */}
                    <div className="bg-gray-900 rounded-[3rem] p-10 text-white shadow-2xl border border-white/5 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl"></div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2 relative z-10">
                            <Shield size={12} className="text-blue-400"/> Oficial de Cartera
                        </h3>
                        <div className="flex items-center gap-5 mb-8 relative z-10">
                            <div className="shrink-0">
                                {assignedOfficial?.photo ? (
                                    <img src={assignedOfficial.photo} alt="" className="h-14 w-14 rounded-2xl object-cover border-2 border-white/20 shadow-xl" />
                                ) : (
                                    <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-xl uppercase text-white shadow-xl">{assignedOfficial?.avatar}</div>
                                )}
                            </div>
                            <div>
                                <p className="font-black text-xl leading-none mb-1">{assignedOfficial?.name || 'Oficial Libre'}</p>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Responsable</p>
                            </div>
                        </div>
                        <button onClick={() => navigate('/loans/new', { state: { clientId: client.id } })} disabled={client.status !== ClientStatus.APPROVED || client.isBlocked} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-30 relative z-10 border-b-4 border-blue-800">
                            NUEVO PRÉSTAMO
                        </button>
                    </div>

                    <div className={`p-10 rounded-[3rem] border-2 flex flex-col items-center text-center shadow-lg transition-all ${client.creditRating === FichaType.MALA ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                        <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center mb-5 shadow-2xl ${client.creditRating === FichaType.MALA ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                            {client.creditRating === FichaType.MALA ? <AlertTriangle size={36}/> : <CheckCircle size={36}/>}
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Puntualidad Global</p>
                        <h4 className="font-black text-gray-900 uppercase text-3xl tracking-tighter">{client.creditRating || 'BUENA'}</h4>
                    </div>
                </div>
            </div>

            {/* Navegación por Tabs */}
            <div className="flex bg-white rounded-[2rem] p-1.5 shadow-sm border border-gray-100 no-print overflow-x-auto gap-1">
                {[
                    { id: 'RESUMEN', label: 'Créditos', icon: Wallet }, 
                    { id: 'HISTORIAL', label: 'Cobros', icon: Clock }, 
                    { id: 'FICHAS', label: 'Conducta', icon: AlertTriangle }
                ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 flex items-center justify-center gap-3 py-5 px-6 rounded-[1.5rem] text-[11px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-gray-900 text-white shadow-2xl' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
                        <t.icon size={16}/> {t.label}
                    </button>
                ))}
            </div>

            {/* MODAL DE APROBACIÓN / RECHAZO MEJORADO */}
            {isApprovalModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-[3.5rem] w-full max-w-md p-12 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] border border-gray-100 animate-scaleIn text-center">
                        <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl ${statusToSet === ClientStatus.APPROVED ? 'bg-green-600 text-white shadow-green-200' : 'bg-red-600 text-white shadow-red-200'}`}>
                            {statusToSet === ClientStatus.APPROVED ? <ShieldCheck size={56} /> : <ShieldAlert size={56} />}
                        </div>
                        
                        <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tighter uppercase">
                            {statusToSet === ClientStatus.APPROVED ? 'Aprobar Crédito' : 'Rechazar Expediente'}
                        </h3>
                        
                        <p className="text-gray-500 font-bold mb-10 leading-relaxed px-4">
                            {statusToSet === ClientStatus.APPROVED 
                                ? `¿Certifica que los datos de ${client.firstName} son reales y el domicilio ha sido verificado?` 
                                : `¿Desea denegar el acceso al sistema de préstamos para ${client.firstName}?`}
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleConfirmStatus}
                                className={`w-full py-6 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 border-b-4 ${statusToSet === ClientStatus.APPROVED ? 'bg-green-600 text-white border-green-800 hover:bg-green-700' : 'bg-red-600 text-white border-red-800 hover:bg-red-700'}`}
                            >
                                SÍ, CONFIRMAR ACCIÓN
                            </button>
                            
                            <button 
                                onClick={() => setIsApprovalModalOpen(false)}
                                className="w-full py-5 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-gray-600 transition-colors"
                            >
                                CANCELAR Y SALIR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="animate-fadeIn">
                {activeTab === 'RESUMEN' && (
                    <div className="space-y-4">
                        {loans.length === 0 ? (
                            <div className="bg-white p-24 rounded-[3.5rem] border-2 border-dashed border-gray-100 text-center">
                                <FileText size={56} className="mx-auto text-gray-100 mb-6" />
                                <p className="font-black text-gray-300 uppercase tracking-[0.4em] text-[10px]">Sin préstamos otorgados</p>
                            </div>
                        ) : (
                            loans.map(loan => (
                                <div key={loan.id} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-10 hover:border-blue-200 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className="p-6 bg-blue-50 text-blue-600 rounded-[2rem] group-hover:bg-blue-600 group-hover:text-white transition-all"><Hash size={32}/></div>
                                        <div>
                                            <h4 className="font-black text-gray-900 text-2xl tracking-tighter">#{loan.id.slice(0,8).toUpperCase()}</h4>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{loan.frequency} • {formatDate(loan.startDate)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-16">
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Desembolsado</p>
                                            <p className="font-black text-gray-900 text-xl">{formatCurrency(loan.amount)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Deuda Actual</p>
                                            <p className="font-black text-red-600 text-xl">{formatCurrency(loan.balance)}</p>
                                        </div>
                                    </div>
                                    <Badge status={loan.status} />
                                </div>
                            ))
                        )}
                    </div>
                )}
                
                {activeTab === 'HISTORIAL' && (
                    <div className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm">
                         {payments.length === 0 ? (
                            <div className="py-20 text-center">
                                <AlertCircle size={48} className="mx-auto text-gray-100 mb-4" />
                                <p className="font-black text-gray-300 uppercase tracking-widest text-[10px]">Sin pagos registrados</p>
                            </div>
                         ) : (
                            <div className="space-y-6">
                                {payments.map(p => (
                                    <div key={p.id} className="flex justify-between items-center p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white transition-colors">
                                        <div>
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{formatDate(p.date)}</p>
                                            <p className="font-black text-gray-900 uppercase">Recibo #{p.id.slice(0,6)}</p>
                                        </div>
                                        <p className="text-xl font-black text-green-600">{formatCurrency(p.amount)}</p>
                                    </div>
                                ))}
                            </div>
                         )}
                    </div>
                )}

                {activeTab === 'FICHAS' && (
                    <div className="space-y-6">
                         <div className="flex justify-between items-center px-4">
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Registro de Conducta</h3>
                            <button className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                                <Plus size={14} /> Nueva Nota
                            </button>
                         </div>
                         {fichas.length === 0 ? (
                            <div className="bg-white p-24 rounded-[3.5rem] border border-gray-100 text-center shadow-inner">
                                <AlertCircle size={56} className="mx-auto text-gray-100 mb-6" />
                                <p className="font-black text-gray-300 uppercase tracking-widest text-[10px]">Sin incidentes registrados</p>
                            </div>
                         ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 {fichas.map(f => (
                                     <div key={f.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                                         <div className={`absolute top-0 right-0 w-2 h-full ${f.type === FichaType.MALA ? 'bg-red-500' : f.type === FichaType.REGULAR ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{formatDate(f.createdAt)}</p>
                                         <h4 className="font-black text-gray-900 text-lg mb-2 uppercase">{f.reason}</h4>
                                         <p className="text-gray-500 text-sm font-medium leading-relaxed">{f.note}</p>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                )}
            </div>

            {isEditOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4 no-print">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl p-12 shadow-2xl animate-scaleIn border border-white/20">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-3xl font-black text-gray-900 tracking-tighter">Editar Perfil</h3>
                            <button onClick={() => setIsEditOpen(false)} className="p-3 bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-all"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleUpdateClient} className="space-y-8">
                            <div className="flex justify-center mb-6">
                                <div className="relative group">
                                    <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 shadow-xl ${editForm.photo ? 'border-blue-500' : 'border-white bg-gray-100'}`}>
                                        {editForm.photo ? (<img src={editForm.photo} alt="Preview" className="w-full h-full object-cover" />) : (<ImageIcon size={40} className="text-gray-300" />)}
                                    </div>
                                    <label className="absolute bottom-0 right-0 bg-gray-900 text-white p-3 rounded-2xl cursor-pointer hover:bg-black transition-all shadow-xl active:scale-90">
                                        <Camera size={20} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                                    <input required className="w-full border-2 border-gray-100 rounded-2xl p-5 bg-gray-50 font-bold focus:bg-white focus:border-blue-500 transition-all outline-none" value={editForm.firstName || ''} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellido</label>
                                    <input required className="w-full border-2 border-gray-100 rounded-2xl p-5 bg-gray-50 font-bold focus:bg-white focus:border-blue-500 transition-all outline-none" value={editForm.lastName || ''} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teléfono</label>
                                <input className="w-full border-2 border-gray-100 rounded-2xl p-5 bg-gray-50 font-bold focus:bg-white focus:border-blue-500 transition-all outline-none" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dirección de Cobro</label>
                                <textarea className="w-full border-2 border-gray-100 rounded-2xl p-5 bg-gray-50 font-bold h-28 focus:bg-white focus:border-blue-500 transition-all outline-none" value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                            </div>
                            <button type="submit" className="w-full bg-gray-900 text-white py-6 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-black transition-all border-b-4 border-gray-950">GUARDAR CAMBIOS</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
