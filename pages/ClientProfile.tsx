import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    getClientById, getClientLoans, getClientFichas, getClientPayments, 
    updateClient, addFicha 
} from '../services/dataService';
import { Client, Loan, Ficha, PaymentReceipt, FichaType, LoanStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { 
    Phone, MapPin, User, FileText, AlertTriangle, CheckCircle, 
    Clock, Printer, ArrowLeft, Edit2, Plus, Download, X 
} from 'lucide-react';

// Sub-components
const RatingBadge = ({ type }: { type?: FichaType }) => {
    const colors = {
        [FichaType.BUENA]: 'bg-green-100 text-green-800 border-green-200',
        [FichaType.REGULAR]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        [FichaType.MALA]: 'bg-red-100 text-red-800 border-red-200',
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[type || FichaType.BUENA]}`}>
            {type || 'SIN CALIFICAR'}
        </span>
    );
};

export const ClientProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // Data State
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [fichas, setFichas] = useState<Ficha[]>([]);
    const [payments, setPayments] = useState<PaymentReceipt[]>([]);
    const [activeTab, setActiveTab] = useState<'RESUMEN' | 'HISTORIAL' | 'FICHAS'>('RESUMEN');

    // Modals State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isFichaOpen, setIsFichaOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);

    // Form States
    const [editForm, setEditForm] = useState<Partial<Client>>({});
    const [fichaForm, setFichaForm] = useState({ type: FichaType.REGULAR, reason: '', note: '' });

    useEffect(() => {
        if (id) {
            loadData(id);
        }
    }, [id]);

    const loadData = (clientId: string) => {
        setClient(getClientById(clientId));
        setLoans(getClientLoans(clientId));
        setFichas(getClientFichas(clientId));
        setPayments(getClientPayments(clientId));
    };

    const handleUpdateClient = (e: React.FormEvent) => {
        e.preventDefault();
        if (client) {
            updateClient(client.id, editForm);
            loadData(client.id);
            setIsEditOpen(false);
        }
    };

    const handleAddFicha = (e: React.FormEvent) => {
        e.preventDefault();
        if (client) {
            addFicha({
                clientId: client.id,
                type: fichaForm.type as FichaType,
                reason: fichaForm.reason,
                note: fichaForm.note,
                createdBy: currentUser.id
            });
            loadData(client.id);
            setIsFichaOpen(false);
            setFichaForm({ type: FichaType.REGULAR, reason: '', note: '' });
        }
    };

    const handlePrint = () => {
        window.print();
        setIsExportOpen(false);
    };

    if (!client) return <div className="p-8">Cargando perfil...</div>;

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    @page { margin: 1cm; size: portrait; }
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Header & Nav */}
            <div className="flex items-center gap-4 mb-4 no-print">
                <button onClick={() => navigate('/clients')} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ArrowLeft size={20} className="text-gray-600"/>
                </button>
                <h1 className="text-xl font-bold text-gray-800">Perfil del Cliente</h1>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden no-print">
                <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-6">
                    {/* Info */}
                    <div className="flex gap-5">
                        <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-3xl">
                            {client.firstName[0]}{client.lastName[0]}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold text-gray-900">{client.firstName} {client.lastName}</h2>
                                <RatingBadge type={client.creditRating} />
                            </div>
                            <p className="text-gray-500 italic">"{client.nickname || 'Sin apodo'}"</p>
                            
                            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                    <span className="font-mono font-medium bg-gray-100 px-1 rounded">{client.cedula}</span>
                                </span>
                                <span className="flex items-center gap-1 hover:text-blue-600 cursor-pointer">
                                    <Phone size={14} /> {client.phone}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin size={14} /> {client.address}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 min-w-[160px]">
                        <button 
                            onClick={() => { setEditForm(client); setIsEditOpen(true); }}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                        >
                            <Edit2 size={16} /> Editar Datos
                        </button>
                        <button 
                            onClick={() => setIsExportOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
                        >
                            <Download size={16} /> Exportar Ficha
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50 px-6">
                    {[
                        { id: 'RESUMEN', label: 'Resumen Financiero', icon: FileText },
                        { id: 'HISTORIAL', label: 'Historial de Pagos', icon: Clock },
                        { id: 'FICHAS', label: 'Comportamiento (Fichas)', icon: AlertTriangle }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                                ${activeTab === tab.id 
                                    ? 'border-blue-600 text-blue-600 bg-white' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700'}
                            `}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {tab.id === 'FICHAS' && fichas.length > 0 && (
                                <span className="ml-1 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">{fichas.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 md:p-8 min-h-[400px]">
                    
                    {/* TAB: RESUMEN */}
                    {activeTab === 'RESUMEN' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-5 bg-blue-50 border border-blue-100 rounded-xl">
                                    <p className="text-sm text-blue-600 font-medium uppercase">Total Prestado</p>
                                    <p className="text-2xl font-bold text-blue-900">
                                        {formatCurrency(loans.reduce((acc, l) => acc + l.amount, 0))}
                                    </p>
                                </div>
                                <div className="p-5 bg-orange-50 border border-orange-100 rounded-xl">
                                    <p className="text-sm text-orange-600 font-medium uppercase">Deuda Actual</p>
                                    <p className="text-2xl font-bold text-orange-900">
                                        {formatCurrency(loans.reduce((acc, l) => acc + l.balance, 0))}
                                    </p>
                                </div>
                                <div className="p-5 bg-green-50 border border-green-100 rounded-xl">
                                    <p className="text-sm text-green-600 font-medium uppercase">Préstamos Activos</p>
                                    <p className="text-2xl font-bold text-green-900">
                                        {loans.filter(l => l.status === LoanStatus.ACTIVO || l.status === LoanStatus.MORA).length}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Préstamos Asociados</h3>
                                <div className="overflow-hidden border border-gray-200 rounded-xl">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Fecha Inicio</th>
                                                <th className="px-4 py-3">Monto</th>
                                                <th className="px-4 py-3">Frecuencia</th>
                                                <th className="px-4 py-3">Balance</th>
                                                <th className="px-4 py-3 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loans.map(loan => (
                                                <tr key={loan.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">{formatDate(loan.startDate)}</td>
                                                    <td className="px-4 py-3 font-medium">{formatCurrency(loan.amount)}</td>
                                                    <td className="px-4 py-3">{loan.frequency} ({loan.duration} cuotas)</td>
                                                    <td className="px-4 py-3 font-bold text-gray-700">{formatCurrency(loan.balance)}</td>
                                                    <td className="px-4 py-3 text-center"><Badge status={loan.status} /></td>
                                                </tr>
                                            ))}
                                            {loans.length === 0 && (
                                                <tr><td colSpan={5} className="p-4 text-center text-gray-400">Sin préstamos registrados</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: HISTORIAL PAGOS */}
                    {activeTab === 'HISTORIAL' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800">Historial de Pagos Recibidos</h3>
                                <span className="text-sm text-gray-500">Total: {payments.length} recibos</span>
                            </div>
                            <div className="overflow-hidden border border-gray-200 rounded-xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                                        <tr>
                                            <th className="px-4 py-3">Fecha</th>
                                            <th className="px-4 py-3">Monto</th>
                                            <th className="px-4 py-3">Préstamo</th>
                                            <th className="px-4 py-3">Recibo ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {payments.map(pay => (
                                            <tr key={pay.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">{formatDate(pay.date)}</td>
                                                <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(pay.amount)}</td>
                                                <td className="px-4 py-3 text-gray-600 font-mono">...{pay.loanId.slice(-6)}</td>
                                                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{pay.id.slice(0,12)}</td>
                                            </tr>
                                        ))}
                                        {payments.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">No hay pagos registrados para este cliente.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB: FICHAS */}
                    {activeTab === 'FICHAS' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <p className="text-sm text-gray-500 max-w-lg">
                                    Las fichas registran eventos positivos o negativos que afectan la calificación crediticia del cliente. No se pueden eliminar, solo archivar.
                                </p>
                                <button 
                                    onClick={() => setIsFichaOpen(true)}
                                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
                                >
                                    <Plus size={16}/> Nueva Ficha
                                </button>
                            </div>

                            <div className="space-y-4">
                                {fichas.map(ficha => (
                                    <div key={ficha.id} className="flex gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50">
                                        <div className={`
                                            w-12 h-12 rounded-full flex items-center justify-center shrink-0
                                            ${ficha.type === FichaType.BUENA ? 'bg-green-100 text-green-600' : ''}
                                            ${ficha.type === FichaType.REGULAR ? 'bg-yellow-100 text-yellow-600' : ''}
                                            ${ficha.type === FichaType.MALA ? 'bg-red-100 text-red-600' : ''}
                                        `}>
                                            {ficha.type === FichaType.BUENA && <CheckCircle size={20} />}
                                            {ficha.type === FichaType.REGULAR && <Clock size={20} />}
                                            {ficha.type === FichaType.MALA && <AlertTriangle size={20} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-900">{ficha.reason}</h4>
                                                <span className="text-xs text-gray-500">{formatDate(ficha.createdAt)}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">{ficha.note}</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded border 
                                                    ${ficha.type === 'BUENA' ? 'border-green-200 text-green-700 bg-white' : ''}
                                                    ${ficha.type === 'MALA' ? 'border-red-200 text-red-700 bg-white' : ''}
                                                    ${ficha.type === 'REGULAR' ? 'border-yellow-200 text-yellow-700 bg-white' : ''}
                                                `}>
                                                    {ficha.type}
                                                </span>
                                                <span className="text-xs text-gray-400">Autor: Staff</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {fichas.length === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <FileText className="text-gray-400" />
                                        </div>
                                        <p className="text-gray-500">Este cliente no tiene historial de comportamiento registrado.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* EDIT MODAL */}
            {isEditOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Editar Cliente</h3>
                            <button onClick={() => setIsEditOpen(false)}><X className="text-gray-400"/></button>
                        </div>
                        <form onSubmit={handleUpdateClient} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                                <input className="w-full border rounded-lg p-2 bg-white" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                                <input className="w-full border rounded-lg p-2 bg-white" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Apodo</label>
                                <input className="w-full border rounded-lg p-2 bg-white" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold mt-2">Guardar Cambios</button>
                        </form>
                    </div>
                </div>
            )}

            {/* FICHA MODAL */}
            {isFichaOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Nueva Ficha de Comportamiento</h3>
                            <button onClick={() => setIsFichaOpen(false)}><X className="text-gray-400"/></button>
                        </div>
                        <form onSubmit={handleAddFicha} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tipo de Evento</label>
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                    {[FichaType.BUENA, FichaType.REGULAR, FichaType.MALA].map(t => (
                                        <button 
                                            key={t}
                                            type="button"
                                            onClick={() => setFichaForm({...fichaForm, type: t})}
                                            className={`py-2 text-sm font-bold rounded-lg border ${fichaForm.type === t ? 'ring-2 ring-offset-1 ring-blue-500' : 'opacity-60'}
                                                ${t === 'BUENA' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                                                ${t === 'REGULAR' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : ''}
                                                ${t === 'MALA' ? 'bg-red-100 text-red-700 border-red-200' : ''}
                                            `}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Motivo (Título)</label>
                                <input 
                                    required
                                    placeholder="Ej: Promesa Incumplida"
                                    className="w-full border rounded-lg p-2 mt-1 bg-white" 
                                    value={fichaForm.reason} 
                                    onChange={e => setFichaForm({...fichaForm, reason: e.target.value})} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nota detallada</label>
                                <textarea 
                                    className="w-full border rounded-lg p-2 mt-1 bg-white" 
                                    rows={3}
                                    value={fichaForm.note} 
                                    onChange={e => setFichaForm({...fichaForm, note: e.target.value})} 
                                />
                            </div>
                            <button type="submit" className="w-full bg-gray-900 text-white py-2 rounded-lg font-bold mt-2">Registrar Ficha</button>
                        </form>
                    </div>
                </div>
            )}

            {/* EXPORT MODAL */}
            {isExportOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm p-6 text-center">
                        <Printer size={48} className="mx-auto text-blue-600 mb-4 bg-blue-50 p-3 rounded-full"/>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Exportar Ficha de Cliente</h3>
                        <p className="text-gray-500 text-sm mb-6">Se generará un documento PDF listo para imprimir con el historial completo.</p>
                        
                        <div className="space-y-3">
                            <button onClick={handlePrint} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">
                                Imprimir / Guardar PDF
                            </button>
                            <button onClick={() => setIsExportOpen(false)} className="w-full text-gray-500 py-2 font-medium">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT TEMPLATE (Hidden unless printing) */}
            <div id="print-area" className="hidden p-8 font-sans bg-white">
                <div className="text-center border-b pb-4 mb-6">
                    <h1 className="text-2xl font-bold uppercase tracking-wide">PrestaFácil RD</h1>
                    <p className="text-gray-500">Reporte de Estado de Cliente</p>
                    <p className="text-sm mt-1">{new Date().toLocaleDateString()}</p>
                </div>

                <div className="flex justify-between mb-8">
                    <div>
                        <h2 className="text-xl font-bold">{client.firstName} {client.lastName}</h2>
                        <p>Cédula: {client.cedula}</p>
                        <p>Tel: {client.phone}</p>
                        <p>{client.address}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold">Calificación Actual</p>
                        <div className="text-lg uppercase mt-1">{client.creditRating}</div>
                    </div>
                </div>

                <h3 className="font-bold border-b pb-1 mb-3 mt-6">Préstamos Activos</h3>
                <table className="w-full text-sm mb-6">
                    <thead>
                        <tr className="text-left border-b">
                            <th className="py-1">Fecha</th>
                            <th className="py-1">Monto</th>
                            <th className="py-1">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loans.map(l => (
                            <tr key={l.id} className="border-b border-gray-100">
                                <td className="py-1">{formatDate(l.startDate)}</td>
                                <td>{formatCurrency(l.amount)}</td>
                                <td>{formatCurrency(l.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <h3 className="font-bold border-b pb-1 mb-3 mt-6">Historial de Comportamiento</h3>
                {fichas.map(f => (
                    <div key={f.id} className="mb-2 pb-2 border-b border-gray-100">
                        <div className="flex justify-between">
                            <span className="font-bold text-sm">{f.reason} ({f.type})</span>
                            <span className="text-xs">{formatDate(f.createdAt)}</span>
                        </div>
                        <p className="text-xs text-gray-600">{f.note}</p>
                    </div>
                ))}

                <div className="mt-12 pt-8 border-t border-black flex justify-between text-xs">
                    <span>Firma Responsable</span>
                    <span>Firma Cliente</span>
                </div>
            </div>
        </div>
    );
};