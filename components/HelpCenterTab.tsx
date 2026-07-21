import React, { useState } from 'react';
import { 
  LifeBuoy, Headphones, FileClock, Sparkles, AlertCircle, 
  ArrowLeft, CheckCircle2, FileText, Send, Image as ImageIcon,
  PlayCircle, ChevronDown
} from 'lucide-react';
import gsap from 'gsap';
import { 
  platformShellCardClass, platformSoftCardClass, 
  platformInputClass, platformMotionButtonClass 
} from './ui/platformStyles';

const urgencyOptions = [
  { value: 'BAJA', label: 'Baja', subLabel: 'Consulta General', color: 'bg-blue-500' },
  { value: 'MEDIA', label: 'Media', subLabel: 'Error no bloqueante', color: 'bg-amber-500' },
  { value: 'ALTA', label: 'Alta', subLabel: 'Funcionalidad rota', color: 'bg-orange-500' },
  { value: 'CRITICA', label: 'Crítica', subLabel: 'Sistema Caído (Bloqueante)', color: 'bg-red-500' },
];

interface ActionListItemProps {
  icon: React.ElementType;
  title: string;
  detail: string;
  onClick?: () => void;
}

function ActionListItem({ icon: Icon, title, detail, onClick }: ActionListItemProps) {
  return (
    <div 
      onClick={onClick}
      className={`group flex items-center gap-4 rounded-2xl border border-transparent p-3 transition-all hover:bg-slate-50 hover:border-slate-100 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{title}</p>
        <p className="text-[12px] font-medium text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

const helpRows = [
  { title: 'Ticket de soporte #3842', detail: 'Problema con facturacion recurrente', tag: 'Soporte', view: 'TICKETS' },
  { title: 'Galeria de video tutoriales', detail: 'Paso a paso de nuevas funcionalidades.', tag: 'Tutoriales', view: 'TUTORIALS' },
  { title: 'Guías de onboarding', detail: 'Documentación para alta de empresas, usuarios globales y activación inicial.', tag: 'Base de conocimiento', view: 'ONBOARDING' },
];

const onboardingSteps = [
  { id: 'G01', title: 'Bienvenida', desc: 'Primer acceso y progreso de configuración.', img: 'Bienvenida.png' },
  { id: 'G02', title: 'Configurar empresa', desc: 'Datos básicos, moneda, zona horaria y logo.', img: 'Configurar empresa.png' },
  { id: 'G03', title: 'Crear sucursal', desc: 'Sucursal principal y responsable.', img: 'Crear sucursal.png' },
  { id: 'G04', title: 'Crear usuario/cobrador', desc: 'Usuario operativo inicial.', img: 'Primer usuario.png' },
  { id: 'G05', title: 'Reglas de préstamo', desc: 'Frecuencia, interés, mora y bloqueo.', img: 'Reglas de prestamos.png' },
  { id: 'G06', title: 'Configurar recibo', desc: 'Campos, logo y preview.', img: 'Resibos.png' },
  { id: 'G07', title: 'Crear primer cliente', desc: 'Registro simplificado.', img: 'Cliente.png' },
  { id: 'G08', title: 'Crear primer préstamo', desc: 'Mini wizard guiado.', img: 'Prestamo.png' },
  { id: 'G09', title: 'Primer cobro', desc: 'Guía de Cobrar Hoy.', img: 'Revisar detalles.png' },
  { id: 'G10', title: 'Completado', desc: 'Checklist completo y acceso al dashboard.', img: 'Finalizacion.png' },
];

export const HelpCenterTab: React.FC = () => {
  const [activeHelpView, setActiveHelpView] = useState<'MAIN' | 'ONBOARDING' | 'TICKETS' | 'TUTORIALS'>('MAIN');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Soporte form states
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [urgency, setUrgency] = useState('MEDIA');
  const [urgencyDropdownOpen, setUrgencyDropdownOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Chat states
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [chatMessages, setChatMessages] = useState<Record<string, Array<{
    id: number;
    sender: 'user' | 'agent';
    senderName: string;
    text: string;
    time: string;
  }>>>({
    '3842': [
      { id: 1, sender: 'user', senderName: 'Tú', text: 'Hola, tengo un cobro duplicado en mi plan mensual de este mes.', time: 'Ayer, 4:15 PM' },
      { id: 2, sender: 'agent', senderName: 'Soporte PrestaFácil', text: 'Hola, buenas tardes. Estamos revisando tu caso con la pasarela de pagos. Por favor, danos unos minutos.', time: 'Ayer, 4:30 PM' },
      { id: 3, sender: 'user', senderName: 'Tú', text: 'De acuerdo, quedo a la espera. Gracias.', time: 'Ayer, 4:32 PM' },
      { id: 4, sender: 'agent', senderName: 'Soporte PrestaFácil', text: 'Hemos identificado la transacción duplicada. Estamos procesando el reembolso, de modo que debería verse reflejado en tu cuenta en 3-5 días hábiles.', time: 'Hace 2 horas' },
    ],
    '3810': [
      { id: 1, sender: 'user', senderName: 'Tú', text: '¿Cómo puedo exportar el desglose de cierre de caja diaria a Excel?', time: 'Hace 3 días' },
      { id: 2, sender: 'agent', senderName: 'Soporte PrestaFácil', text: 'Hola. Puedes hacerlo desde Reportes > Caja Diaria, y haciendo clic en el botón de Exportar en la esquina superior derecha.', time: 'Hace 3 días' },
      { id: 3, sender: 'user', senderName: 'Tú', text: '¡Excelente! Ya pude descargarlo. Muchas gracias por la ayuda.', time: 'Hace 3 días' },
    ]
  });

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUrgencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      gsap.fromTo('[data-help-hero]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo('[data-help-panel]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.12 });
      gsap.fromTo(
        '[data-help-card]',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.05, delay: 0.18 }
      );
    }, 20);

    return () => clearTimeout(timer);
  }, [activeHelpView, selectedTicketId, currentStepIndex]);

  const handleSendComment = () => {
    if (!newComment.trim() || !selectedTicketId) return;
    const newMessage = {
      id: Date.now(),
      sender: 'user' as const,
      senderName: 'Tú',
      text: newComment,
      time: 'Ahora mismo',
    };
    setChatMessages(prev => ({
      ...prev,
      [selectedTicketId]: [...(prev[selectedTicketId] || []), newMessage]
    }));
    setNewComment('');
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setAttachments(prev => [...prev, { name: file.name || `Imagen pegada ${prev.length + 1}`, url }]);
        }
      }
    }
  };

  const renderMain = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr]">
      <div data-help-panel className={`${platformShellCardClass} p-6`}>
        <div data-help-hero className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <LifeBuoy size={20} className="text-blue-600" />
          <h2 className="text-[20px] font-black tracking-tight text-slate-900">Cola de Ayuda & Tickets Activos</h2>
        </div>
        <div className="space-y-4">
          {helpRows.map(row => (
            <div 
              key={row.title} 
              data-help-card
              onClick={() => setActiveHelpView(row.view as any)}
              className="group rounded-[22px] border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[16px] font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{row.title}</p>
                  <p className="text-[13.5px] font-semibold leading-relaxed text-slate-500">{row.detail}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${
                  row.tag === 'Soporte' ?
                      'bg-amber-50 text-amber-600 border border-amber-200' 
                    : row.tag === 'Tutoriales' ?
                        'bg-blue-50 text-blue-600 border border-blue-200' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}>
                  {row.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className={`${platformSoftCardClass} p-5`}>
          <div className="flex items-center gap-3 mb-4 text-slate-900">
            <Headphones size={18} />
            <h3 className="text-[15px] font-bold">Atajos de soporte</h3>
          </div>
          <div className="space-y-1">
            <ActionListItem icon={FileClock} title="Tickets recientes" detail="Seguimiento a casos abiertos." onClick={() => setActiveHelpView('TICKETS')} />
            <ActionListItem icon={Sparkles} title="Tutoriales" detail="Guias visuales para adopcion." onClick={() => setActiveHelpView('TUTORIALS')} />
            <ActionListItem icon={FileText} title="Guía de Onboarding" detail="Flujo completo de activación." onClick={() => setActiveHelpView('ONBOARDING')} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderOnboarding = () => {
    const step = onboardingSteps[currentStepIndex];
    return (
      <div data-help-panel className={`${platformShellCardClass} p-0 overflow-hidden flex flex-col min-h-[600px]`}>
        <div data-help-hero className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 p-5">
          <button onClick={() => { setActiveHelpView('MAIN'); setCurrentStepIndex(0); }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-[18px] font-black tracking-tight text-slate-900">Guía de Onboarding (Modo Wizard)</h2>
            <p className="text-[13px] font-semibold text-slate-500">Paso {currentStepIndex + 1} de {onboardingSteps.length}: {step.title}</p>
          </div>
        </div>
        
        <div className="p-8 bg-white flex flex-col md:flex-row gap-10 flex-1">
          <div className="flex-1 flex flex-col">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-black uppercase tracking-wider text-blue-600 mb-6">
                <span>Paso {step.id}</span>
              </div>
              <h3 className="text-[32px] font-black tracking-tight text-slate-900 leading-tight mb-4">{step.title}</h3>
              <p className="text-[16px] font-medium leading-relaxed text-slate-600 max-w-lg">{step.desc}</p>
              
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                  <p className="text-[14px] font-medium text-slate-700">Explora la funcionalidad en el panel lateral.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                  <p className="text-[14px] font-medium text-slate-700">Sigue la interfaz resaltada en azul.</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 pt-8 mt-auto border-t border-slate-100">
              <button 
                onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                disabled={currentStepIndex === 0}
                className={`flex-1 h-14 rounded-2xl font-bold text-[15px] transition-all border border-slate-200 ${currentStepIndex === 0 ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:border-blue-200 hover:text-blue-600 hover:-translate-y-0.5 shadow-sm'}`}
              >
                Anterior
              </button>
              <button 
                onClick={() => setCurrentStepIndex(Math.min(onboardingSteps.length - 1, currentStepIndex + 1))}
                disabled={currentStepIndex === onboardingSteps.length - 1}
                className={`flex-1 h-14 rounded-2xl font-bold text-[15px] transition-all ${currentStepIndex === onboardingSteps.length - 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 shadow-md'}`}
              >
                {currentStepIndex === onboardingSteps.length - 1 ? 'Finalizado' : 'Siguiente Paso'}
              </button>
            </div>
          </div>
          
          <div className="flex-[1.2]">
            <div className="rounded-[24px] border-2 border-slate-100 bg-slate-50 overflow-hidden cursor-pointer hover:border-blue-300 transition-all shadow-sm hover:shadow-lg group" onClick={() => setSelectedImage(`/onboarding/${step.img}`)}>
              <div className="aspect-[4/3] relative p-1">
                <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#111827_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <img 
                  src={`/onboarding/${step.img}`} 
                  alt={step.title} 
                  className="absolute inset-0 w-full h-full object-cover rounded-[20px] transition-transform duration-500 group-hover:scale-[1.02]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMThmMjkiLz48L3N2Zz4='; 
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center rounded-[20px]">
                  <div className="bg-white/90 backdrop-blur-sm text-slate-900 font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 shadow-xl">
                    <ImageIcon size={16} /> Ampliar Imagen
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderChat = () => {
    if (!selectedTicketId) return null;
    const messages = chatMessages[selectedTicketId] || [];
    const isResolved = selectedTicketId === '3810';

    return (
      <div data-help-panel className={`${platformShellCardClass} p-0 overflow-hidden flex flex-col h-[600px]`}>
        {/* Cabecera del chat al estilo sub-vista / builder */}
        <div data-help-hero className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedTicketId(null)} 
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Conversación / Ticket #{selectedTicketId}</span>
              <span className="text-[15px] font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[450px]">
                {selectedTicketId === '3842' ? 'Problema con facturacion recurrente' : 'Duda sobre reportes de caja'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
              isResolved 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              {isResolved ? 'Resuelto' : 'En revisión'}
            </span>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {messages.map(msg => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-slate-500">{msg.senderName}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{msg.time}</span>
                </div>
                <div className={`max-w-[75%] rounded-[20px] px-4.5 py-3 text-[14.5px] font-semibold leading-relaxed shadow-sm ${
                  isUser 
                    ? 'bg-[#2563EB] text-white rounded-tr-none' 
                    : 'bg-white text-[#111827] border border-[#E5E7EB] rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Campo de envío */}
        <div className="bg-white border-t border-slate-200 p-4 flex gap-3 items-center">
          <input 
            type="text" 
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSendComment(); }}
            placeholder={isResolved ? "Este ticket está resuelto. Puedes reabrirlo enviando un mensaje..." : "Escribe un mensaje de respuesta para soporte..."} 
            className="flex-1 h-12 rounded-xl border border-[#E5E7EB] bg-slate-50 px-4 text-[14.5px] font-semibold text-slate-700 outline-none focus:border-[#93C5FD] focus:bg-white transition-all"
          />
          <button 
            onClick={handleSendComment}
            className="h-12 w-12 rounded-xl bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] transition-colors shadow-[0_12px_24px_rgba(37,99,235,0.2)]"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <div className="p-8 bg-white">
      <form className="space-y-7" onSubmit={e => e.preventDefault()}>
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div>
            <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-slate-500">Asunto del ticket</label>
            <input type="text" className={platformInputClass} placeholder="Ej. Error al procesar pago recurrente" />
          </div>
          <div>
            <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-slate-500">Nivel de Urgencia</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUrgencyDropdownOpen(o => !o)}
                className={`flex h-[56px] w-full items-center justify-between rounded-2xl border bg-white px-4 text-left transition-all duration-200 cursor-pointer ${
                  urgencyDropdownOpen ? 'border-[#93C5FD] shadow-[0_10px_24px_rgba(37,99,235,0.10)]' : 'border-[#E5E7EB] hover:border-[#DBEAFE]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${urgencyOptions.find(o => o.value === urgency)?.color || 'bg-slate-400'}`} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-[14px] font-bold text-[#111827]">
                      {urgencyOptions.find(o => o.value === urgency)?.label}
                    </span>
                    <span className="text-[11px] font-medium text-[#64748B]">
                      {urgencyOptions.find(o => o.value === urgency)?.subLabel}
                    </span>
                  </div>
                </div>
                <ChevronDown size={18} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${urgencyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {urgencyDropdownOpen && (
                <div className="absolute left-0 top-[calc(100%+10px)] z-[80] w-full min-w-[260px] rounded-3xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.12)] animate-[platform-fade-in_150ms_ease-out]">
                  {urgencyOptions.map(option => {
                    const isSelected = option.value === urgency;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setUrgency(option.value);
                          setUrgencyDropdownOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-2.5 text-left transition-all duration-200 hover:translate-x-1 ${
                          isSelected ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#111827] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`h-2 w-2 rounded-full ${option.color}`} />
                          <div className="flex flex-col leading-tight">
                            <span className="text-[14px] font-bold">{option.label}</span>
                            <span className="text-[11.5px] font-semibold text-slate-400">{option.subLabel}</span>
                          </div>
                        </div>
                        {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div>
          <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-slate-500">Descripción detallada</label>
          <div className="rounded-2xl border border-slate-200 overflow-hidden focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
            <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-2">
              <div className="h-8 w-8 rounded-lg hover:bg-slate-200 cursor-pointer flex items-center justify-center text-slate-500"><b className="font-serif">B</b></div>
              <div className="h-8 w-8 rounded-lg hover:bg-slate-200 cursor-pointer flex items-center justify-center text-slate-500"><i className="font-serif">I</i></div>
              <div className="h-8 w-8 rounded-lg hover:bg-slate-200 cursor-pointer flex items-center justify-center text-slate-500"><u className="font-serif">U</u></div>
            </div>
            <textarea 
              onPaste={handlePaste}
              className="w-full min-h-[180px] p-4 text-[15px] font-medium text-slate-700 outline-none resize-y" 
              placeholder="Describe paso a paso cómo ocurrió el problema. Puedes pegar capturas directamente con Ctrl+V..."
            />
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2">
            <label className="block text-[12px] font-black uppercase tracking-[0.08em] text-slate-500">Capturas adjuntas ({attachments.length})</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {attachments.map((file, idx) => (
                <div key={idx} className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 group aspect-[4/3] shadow-sm hover:border-red-200 transition-colors">
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center font-bold text-[14px] opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                  >
                    Eliminar captura
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            multiple 
            onChange={(e) => {
              if (e.target.files) {
                const files = Array.from(e.target.files);
                const newAttachments = files.map(file => ({
                  name: file.name,
                  url: URL.createObjectURL(file)
                }));
                setAttachments(prev => [...prev, ...newAttachments]);
              }
            }}
          />
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-[14px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 h-11 rounded-xl transition-colors"
            >
              <ImageIcon size={18} /> Adjuntar captura
            </button>
            <span className="text-[12.5px] font-semibold text-slate-400">
              (O pega directamente con <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-[11px] rounded-md font-mono text-slate-600 shadow-sm">Ctrl+V</kbd>)
            </span>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-8 h-12 text-[14.5px] font-bold text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] hover:shadow-[0_22px_44px_rgba(37,99,235,0.34)]">
            <Send size={18} /> Enviar Ticket
          </button>
        </div>
      </form>
    </div>
  );

  const renderTickets = () => {
    if (selectedTicketId) {
      return renderChat();
    }

    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_350px]">
        <div data-help-panel className={`${platformShellCardClass} p-0 overflow-hidden flex flex-col`}>
          <div data-help-hero className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 p-5">
            <button onClick={() => { setActiveHelpView('MAIN'); setSelectedTicketId(null); }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-[18px] font-black tracking-tight text-slate-900">Soporte y Tickets</h2>
              <p className="text-[13px] font-semibold text-slate-500">Apertura de nuevos casos operativos.</p>
            </div>
          </div>
          
          {renderForm()}
        </div>
        
        <div className="space-y-5">
          <div data-help-panel className={`${platformSoftCardClass} p-5`}>
            <div data-help-hero className="flex items-center gap-3 mb-4 border-b border-slate-200 pb-3 text-slate-900">
              <FileClock size={18} />
              <h3 className="text-[15px] font-bold">Mis Tickets</h3>
            </div>
            <div className="space-y-3">
              <div 
                data-help-card
                onClick={() => setSelectedTicketId('3842')}
                className="rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:border-blue-300 transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-black text-slate-500">#3842</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">En revisión</span>
                </div>
                <p className="text-[13px] font-bold text-slate-900 leading-tight mb-1.5">Problema con facturacion recurrente</p>
                <p className="text-[11px] font-medium text-slate-500">Actualizado hace 2 horas</p>
              </div>
              
              <div 
                data-help-card
                onClick={() => setSelectedTicketId('3810')}
                className="rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:border-blue-300 transition-all hover:-translate-y-0.5 hover:shadow-sm opacity-75 hover:opacity-100"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-black text-slate-500">#3810</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Resuelto</span>
                </div>
                <p className="text-[13px] font-bold text-slate-900 leading-tight mb-1.5">Duda sobre reportes de caja</p>
                <p className="text-[11px] font-medium text-slate-500">Cerrado hace 3 días</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderTutorials = () => (
    <div data-help-panel className={`${platformShellCardClass} p-0 overflow-hidden flex flex-col`}>
      <div data-help-hero className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 p-5">
        <button onClick={() => setActiveHelpView('MAIN')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-[18px] font-black tracking-tight text-slate-900">Galería de Tutoriales</h2>
          <p className="text-[13px] font-semibold text-slate-500">Explora las pantallas principales del sistema y su uso.</p>
        </div>
      </div>
      
      <div className="p-6 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {onboardingSteps.map(step => (
            <div key={step.id} data-help-card className="group rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer" onClick={() => setSelectedImage(`/onboarding/${step.img}`)}>
              <div className="aspect-video bg-slate-200 relative overflow-hidden">
                {/* Fallback pattern si la imagen falla en cargar inmediatamente */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#111827_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                <img 
                  src={`/onboarding/${step.img}`} 
                  alt={step.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMThmMjkiLz48L3N2Zz4='; // gray placeholder
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center">
                  <PlayCircle className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md scale-75 group-hover:scale-100 duration-300" size={48} strokeWidth={1.5} />
                </div>
              </div>
              <div className="p-4 bg-white">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 mb-1 block">{step.id}</span>
                <h4 className="text-[14px] font-bold text-slate-900 leading-tight mb-1">{step.title}</h4>
                <p className="text-[12px] font-medium text-slate-500 line-clamp-2">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef}>
      {activeHelpView === 'MAIN' && renderMain()}
      {activeHelpView === 'ONBOARDING' && renderOnboarding()}
      {activeHelpView === 'TICKETS' && renderTickets()}
      {activeHelpView === 'TUTORIALS' && renderTutorials()}
      
      {/* Modal para ver imagen */}
      {selectedImage && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-8 animate-[platform-fade-in_150ms_ease-out]" onClick={() => setSelectedImage(null)}>
          <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-[platform-scale-in_200ms_ease-out]" onClick={e => e.stopPropagation()}>
            <img src={selectedImage} alt="Preview" className="w-full max-h-[85vh] object-contain bg-slate-100" />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/50 backdrop-blur-md text-white hover:bg-red-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
