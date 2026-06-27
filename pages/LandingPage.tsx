import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, MapPin, Smartphone, MessageCircle, ArrowRight,
  Target, Globe, CheckCircle2, DollarSign, PlayCircle,
  HelpCircle, ChevronDown, Sparkles, Video,
  BookOpen, Calculator, X, Play, Clock, ShieldAlert,
  SmartphoneNfc, Receipt, BarChart3, HeartHandshake, UserPlus, Menu
} from 'lucide-react';
import { getSaaSPlans } from '../services/dataService';
import { formatCurrency } from '../utils';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const plans = getSaaSPlans();
  
  // States para Modales
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [isAcademyOpen, setIsAcademyOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<any | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleScroll = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStartDemo = async () => {
    // Entra con credenciales demo explicitas para mantener separado el modo produccion.
    const success = await login('admin', 'admin123');
    if (success) navigate('/');
  };

  const faqs = [
    { q: "¿Es legal usar esta app en RD?", a: "Sí. Generamos contratos y pagarés que cumplen con las leyes dominicanas. Tus datos están cifrados y seguros." },
    { q: "¿Cómo mando el recibo por WhatsApp?", a: "Al cobrar, te sale un botón verde. Le das y se le manda el ticket nitidito al cliente sin tú escribir nada." },
    { q: "¿Funciona si no tengo internet?", a: "La app es tan ligera que abre hasta con el internet lento de la calle. Los datos se sincronizan solos." },
    { q: "¿Puedo tener varios cobradores?", a: "Claro. Puedes crearle una cuenta a cada uno y ver en el mapa por dónde andan y cuánto han cobrado." },
    { q: "¿Qué pasa si pierdo mi celular?", a: "Tus datos no están en el teléfono, están en la nube. Entras desde otro aparato, cierras la sesión vieja y todo sigue ahí." },
    { q: "¿Cómo imprimo el pagaré?", a: "El sistema te da un PDF profesional con el calendario de pagos listo para imprimir o enviar por correo." },
    { q: "¿Tengo que pagar por cada préstamo?", a: "No. Pagas una mensualidad fija según tu plan y puedes prestar todo el dinero que quieras." },
    { q: "¿Dan soporte si no sé usarla?", a: "Tenemos un equipo en WhatsApp que te ayuda de una vez. Además, la app es tan simple que se aprende en minutos." }
  ];

  const tutorials = [
    { id: 1, title: "Registrar mi primer cliente", dur: "2:15 min", icon: UserPlus, desc: "Aprenda a crear un expediente con foto de cédula y dirección." },
    { id: 2, title: "Cómo dar un préstamo", dur: "1:45 min", icon: DollarSign, desc: "Entregue el dinero y genere las cuotas automáticamente." },
    { id: 3, title: "Organizar la calle (Rutas)", dur: "3:10 min", icon: MapPin, desc: "Cómo ponerle las paradas del día a sus cobradores en el mapa." },
    { id: 4, title: "Cobrar mora y atrasos", dur: "1:20 min", icon: Clock, desc: "Aprenda cómo el sistema calcula el cargo por atraso solito." },
    { id: 5, title: "Mandar recibos por WhatsApp", dur: "1:55 min", icon: MessageCircle, desc: "El paso a paso para que el cliente reciba su comprobante digital." },
    { id: 6, title: "Cierre de caja y arqueo", dur: "2:05 min", icon: Calculator, desc: "Para que no le falte ni un peso al cerrar su negocio hoy." },
    { id: 7, title: "Bloquear clientes mala paga", dur: "1:30 min", icon: ShieldAlert, desc: "Use el semáforo para que nadie más le preste a quien no paga." },
    { id: 8, title: "Ver mis ganancias reales", dur: "2:45 min", icon: BarChart3, desc: "Cómo leer los reportes de intereses y capital en calle." }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
      {/* Navbar Fixed */}
      <nav className="fixed top-0 w-full z-[100] bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <ShieldCheck size={24} />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic">PrestaFácil <span className="text-blue-600">RD</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => handleScroll('features')} className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">Funciones</button>
            <button onClick={() => handleScroll('tutorials')} className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">Tutoriales</button>
            <button onClick={() => handleScroll('pricing')} className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">Planes</button>
            <button onClick={() => navigate('/auth')} className="text-[11px] font-black uppercase tracking-widest text-blue-600 border border-blue-600 px-6 py-2.5 rounded-xl hover:bg-blue-50 transition-all">Acceder</button>
            <button onClick={handleStartDemo} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Ver Demo</button>
          </div>

          {/* Toggle for Mobile Menu */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600 hover:text-blue-600 transition-colors">
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 shadow-xl absolute w-full left-0 top-20 animate-fadeIn">
            <div className="flex flex-col p-6 gap-4">
              <button onClick={() => { setIsMobileMenuOpen(false); handleScroll('features'); }} className="text-sm font-black uppercase tracking-widest text-slate-700 text-left py-2 hover:text-blue-600 transition-colors">Funciones</button>
              <button onClick={() => { setIsMobileMenuOpen(false); handleScroll('tutorials'); }} className="text-sm font-black uppercase tracking-widest text-slate-700 text-left py-2 hover:text-blue-600 transition-colors">Tutoriales</button>
              <button onClick={() => { setIsMobileMenuOpen(false); handleScroll('pricing'); }} className="text-sm font-black uppercase tracking-widest text-slate-700 text-left py-2 hover:text-blue-600 transition-colors">Planes</button>
              <div className="h-px bg-slate-100 my-2"></div>
              <button onClick={() => { setIsMobileMenuOpen(false); navigate('/auth'); }} className="w-full text-center text-[11px] font-black uppercase tracking-widest text-blue-600 border border-blue-600 px-6 py-3 rounded-xl hover:bg-blue-50 transition-all">Acceder</button>
              <button onClick={() => { setIsMobileMenuOpen(false); handleStartDemo(); }} className="w-full text-center bg-slate-900 text-white px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Ver Demo</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px]"></div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-3 px-5 py-2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 border border-blue-100 shadow-sm animate-fadeIn">
            <Sparkles size={14} className="animate-pulse"/> La mejor app para prestamistas en RD
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase leading-[1.1] mb-8 animate-fadeIn">
            Controle su <span className="text-blue-600 italic">Capital</span> <br /> 
            Cobre con <span className="underline decoration-blue-600/20 underline-offset-8">Precisión</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 font-medium leading-relaxed mb-12 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            Olvídese de los cuadernos. Gestione sus cobradores, clientes y dinero desde su celular.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <button onClick={handleStartDemo} className="group bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3">
              Probar Demo Gratis <PlayCircle size={20}/>
            </button>
            <button onClick={() => navigate('/auth', { state: { mode: 'REGISTER' } })} className="bg-white border-2 border-slate-100 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
              Registrar Mi Empresa <ArrowRight size={20}/>
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid - SIMPLE LANGUAGE */}
      <section id="features" className="py-24 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-3">Sencillo y Rápido</p>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Para el que trabaja en la calle</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Cobradores en el mapa', desc: 'Vea por dónde andan sus cobradores y qué han cobrado hoy mismo desde su celular.', icon: MapPin, color: 'bg-blue-600' },
              { title: 'Cobra el atraso solo', desc: 'El sistema calcula la mora automáticamente si el cliente se pasa de la fecha.', icon: Target, color: 'bg-red-600' },
              { title: 'Recibos por WhatsApp', desc: 'Mande el comprobante profesional al celular del cliente sin tener que escribir nada.', icon: MessageCircle, color: 'bg-emerald-600' },
              { title: 'Cuadre de caja rápido', desc: 'Sepa exactamente cuánto dinero hay en la oficina sin errores ni cuadernos perdidos.', icon: DollarSign, color: 'bg-amber-600' },
              { title: 'Fotos de la cédula', desc: 'Guarde fotos de los documentos y del deudor para que no se le pierda ningún dato.', icon: Smartphone, color: 'bg-purple-600' },
              { title: 'Mira tus ganancias', desc: 'Reportes claritos de cuánto dinero tienes en la calle y cuánto te estás ganando.', icon: BarChart3, color: 'bg-slate-900' },
            ].map((f, i) => (
              <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                <div className={`h-14 w-14 ${f.color} rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg group-hover:scale-110 transition-all`}>
                  <f.icon size={28} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3">{f.title}</h3>
                <p className="text-slate-500 font-medium text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tutoriales Section */}
      <section id="tutorials" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-6 text-center md:text-left">
            <div>
              <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-3">Aprenda a Usarla</p>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Domine su Plataforma</h2>
            </div>
            <button 
              onClick={() => setIsAcademyOpen(true)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-all bg-gray-50 px-8 py-4 rounded-xl shadow-sm"
            >
              <BookOpen size={16}/> Ver todos los videos
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
            {tutorials.slice(0, 3).map((t, i) => (
              <div key={i} className="group cursor-pointer" onClick={() => setPlayingVideo(t)}>
                <div className="aspect-video bg-slate-900 rounded-2xl md:rounded-[2rem] mb-3 md:mb-6 overflow-hidden relative shadow-lg border-2 border-white ring-1 ring-slate-100 transition-all group-hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <PlayCircle size={48} className="text-white drop-shadow-2xl"/>
                  </div>
                  <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 z-20 flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 bg-black/40 backdrop-blur-md rounded-full text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                    <Video size={10}/> {t.dur}
                  </div>
                  <div className="w-full h-full bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center">
                     <t.icon size={32} className="md:w-12 md:h-12 text-white opacity-20" />
                  </div>
                </div>
                <h4 className="text-xs md:text-lg font-black text-slate-900 uppercase tracking-tight mb-1 md:mb-2 group-hover:text-blue-600 transition-colors leading-tight">{t.title}</h4>
                <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 md:line-clamp-none">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - EXPANDED */}
      <section id="faqs" className="py-24 bg-slate-900 text-white relative">
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <HelpCircle size={32}/>
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase mb-4 italic leading-none">¿Tiene Dudas?</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Respuestas rápidas para el prestamista real</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className={`border-2 rounded-2xl transition-all overflow-hidden ${openFaq === i ? 'border-blue-600 bg-blue-600/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6 flex justify-between items-center text-left"
                >
                  <span className="text-base font-black uppercase tracking-tight leading-tight">{faq.q}</span>
                  <ChevronDown size={20} className={`transition-transform duration-500 ${openFaq === i ? 'rotate-180 text-blue-400' : 'text-slate-600'}`} />
                </button>
                <div className={`transition-all duration-500 ease-in-out ${openFaq === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-6 pb-6 text-slate-400 font-medium leading-relaxed text-sm border-t border-white/5 pt-4">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="mb-20">
            <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-3">Planes Económicos</p>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-10">Pague solo lo que necesita</h2>
            
            <div className="flex items-center justify-center gap-4 animate-fadeIn">
              <span className={`text-sm font-black uppercase tracking-widest transition-colors ${!isYearly ? 'text-slate-900' : 'text-slate-400'}`}>Mensual</span>
              <button 
                onClick={() => setIsYearly(!isYearly)}
                className="w-16 h-8 bg-blue-600 rounded-full p-1 transition-colors shadow-inner flex items-center"
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${isYearly ? 'translate-x-8' : 'translate-x-0'}`}></div>
              </button>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black uppercase tracking-widest transition-colors ${isYearly ? 'text-slate-900' : 'text-slate-400'}`}>Anual</span>
                <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest animate-pulse">-10%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            {plans.map((p, i) => (
              <div key={p.id} className={`p-10 rounded-[2.5rem] border-4 transition-all relative group ${p.isOffer ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-105 z-10' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                {p.isOffer && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-xl">
                    {p.offerText}
                  </div>
                )}
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-3">{p.name}</h3>
                <div className="mb-8 flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tighter">{formatCurrency(isYearly ? Math.round(p.monthlyPrice * 0.9) : p.monthlyPrice)}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${p.isOffer ? 'text-slate-400' : 'text-slate-400'}`}> / mes {isYearly && '(anual)'}</span>
                </div>
                <div className="space-y-4 mb-10 text-left">
                  {[`Hasta ${p.maxClients} Clientes`, `${p.maxUsers} Usuarios`, `${p.maxBranches} Sucursales`, 'Soporte por WhatsApp', 'Acceso desde el celular'].map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <CheckCircle2 size={16} className={p.isOffer ? 'text-blue-500' : 'text-blue-600'} />
                      <span className="text-xs font-bold uppercase tracking-tight opacity-80">{feat}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/auth', { state: { planId: p.id, mode: 'REGISTER', isYearly } })} className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all ${p.isOffer ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-900 text-white'}`}>
                  Seleccionar {p.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODAL ACADEMIA COMPLETA */}
      {isAcademyOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-10 animate-fadeIn">
              <div className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-scaleIn overflow-hidden border border-white/20">
                  <div className="p-8 bg-gray-50 border-b flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Academia PrestaFácil</h3>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Aprenda a usar su plataforma paso a paso</p>
                      </div>
                      <button onClick={() => setIsAcademyOpen(false)} className="p-3 bg-white rounded-xl text-gray-400 hover:text-red-500 shadow-sm transition-all"><X size={24}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white custom-scrollbar">
                      {tutorials.map(t => (
                          <div key={t.id} onClick={() => setPlayingVideo(t)} className="flex items-center gap-6 p-6 bg-gray-50 rounded-3xl border-2 border-transparent hover:border-blue-200 hover:bg-white hover:shadow-xl transition-all cursor-pointer group">
                              <div className="h-24 w-40 bg-slate-900 rounded-2xl flex items-center justify-center relative shrink-0 overflow-hidden shadow-md">
                                  <t.icon size={32} className="text-white opacity-20"/>
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play size={24} className="text-white fill-white"/>
                                  </div>
                                  <div className="absolute bottom-2 right-2 bg-black/60 text-[8px] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">{t.dur}</div>
                              </div>
                              <div className="min-w-0">
                                  <h4 className="font-black text-gray-900 text-sm uppercase leading-tight mb-2 group-hover:text-blue-600 transition-colors">{t.title}</h4>
                                  <p className="text-xs text-gray-500 font-medium line-clamp-2 leading-relaxed">{t.desc}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL REPRODUCTOR DE VIDEO */}
      {playingVideo && (
          <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4 animate-fadeIn">
              <div className="w-full max-w-4xl space-y-6">
                  <div className="flex justify-between items-center text-white">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-blue-600 rounded-2xl"><Video size={24}/></div>
                         <div>
                            <h3 className="text-xl font-black uppercase tracking-tighter italic leading-none mb-1">{playingVideo.title}</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tutorial de Academia • {playingVideo.dur}</p>
                         </div>
                      </div>
                      <button onClick={() => setPlayingVideo(null)} className="p-4 bg-white/10 rounded-2xl text-white hover:bg-red-500 transition-all"><X size={28}/></button>
                  </div>
                  
                  <div className="aspect-video bg-slate-900 rounded-[3rem] shadow-2xl border-4 border-white/10 overflow-hidden relative group">
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                          <div className="h-24 w-24 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-blue-600/30 scale-110">
                              <Play size={40} className="ml-2 fill-white"/>
                          </div>
                          <p className="text-white/40 font-black uppercase tracking-[0.4em] text-xs animate-pulse">Cargando Tutorial en HD...</p>
                      </div>
                      <div className="absolute bottom-10 left-10 right-10 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 w-1/4 rounded-full"></div>
                      </div>
                  </div>
                  
                  <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10">
                      <p className="text-white/80 font-medium leading-relaxed italic text-center">"{playingVideo.desc}"</p>
                  </div>
              </div>
          </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
              <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"><ShieldCheck size={24} /></div>
              <span className="text-xl font-black tracking-tighter uppercase italic">PrestaFácil <span className="text-blue-600">RD</span></span>
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Santo Domingo, República Dominicana • v6.5.1</p>
          </div>
          <div className="flex gap-4">
            <a href="#" className="p-4 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all"><Globe size={20}/></a>
            <a href="#" className="p-4 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all"><MessageCircle size={20}/></a>
            <a href="#" className="p-4 bg-white/5 rounded-2xl hover:bg-blue-600 transition-all"><Smartphone size={20}/></a>
          </div>
        </div>
      </footer>
    </div>
  );
};
