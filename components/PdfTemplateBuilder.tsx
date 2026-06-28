import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Briefcase,
  Building,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Layout,
  Maximize2,
  Move,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Camera,
  Layers,
  Settings,
  ZoomIn,
  ZoomOut,
  Maximize,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';
import { ReportTemplate, ReportTemplateConfig } from '../types';
import { apiClient } from '../services/apiClient';
import { emitPlatformToast, setPlatformLoading } from '../services/platformEvents';
import { optimizeImageFile } from '../services/imageOptimizer';
import { formatCurrency } from '../utils';

interface BlockPosition {
  id: string;
  label: string;
  x: number; // Porcentaje del ancho (0-100)
  y: number; // Porcentaje del alto (0-100)
  width: number; // Porcentaje del ancho (0-100)
  height: number; // Porcentaje del alto (0-100)
  visible: boolean;
}

const DEFAULT_BLOCKS: BlockPosition[] = [
  { id: 'logo', label: 'Logotipo de Marca', x: 5, y: 4, width: 22, height: 10, visible: true },
  { id: 'companyInfo', label: 'Datos de la Empresa', x: 60, y: 4, width: 35, height: 10, visible: true },
  { id: 'documentMeta', label: 'Metadatos del Reporte', x: 5, y: 16, width: 90, height: 8, visible: true },
  { id: 'clientBlock', label: 'Información del Cliente', x: 5, y: 26, width: 90, height: 12, visible: true },
  { id: 'mainTable', label: 'Tabla de Detalle / Conceptos', x: 5, y: 40, width: 90, height: 32, visible: true },
  { id: 'totalsBlock', label: 'Resumen de Totales', x: 55, y: 74, width: 40, height: 14, visible: true },
  { id: 'footer', label: 'Pie de Página', x: 5, y: 91, width: 90, height: 5, visible: true },
];

const APPLICATION_OPTIONS = [
  { value: 'CLIENT_STATEMENT', label: 'Clientes (Estado de Cuenta)' },
  { value: 'PAYMENT_RECEIPT', label: 'Caja (Recibos de Pago)' },
  { value: 'ACTIVITY_HISTORY', label: 'Historial de Actividad' },
  { value: 'COLLECTION_ROUTE', label: 'Hojas de Ruta de Cobro' },
  { value: 'FINANCIAL_REPORT', label: 'Reportes Financieros' },
];

// Componente genérico Dropdown con portal consistente con los filtros de la SaaS
const SaaSFilterDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}> = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen]);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-12 w-full items-center gap-3 rounded-xl border px-4 text-left transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'border-blue-500 bg-white shadow-[0_10px_24px_rgba(37,99,235,0.06)]'
            : 'border-slate-200 bg-slate-50 hover:border-slate-350 hover:bg-slate-50/50'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-700">
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[260] w-max rounded-2xl border border-slate-100 bg-white p-1.5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] animate-[platform-fade-in_150ms_ease-out]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: Math.max(menuPosition.width, 240),
          }}
        >
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-4.5 py-3 text-left text-[13.5px] font-bold transition-all duration-200 hover:translate-x-1 ${
                  isSelected ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
};

// Componente Multiselect alineado al diseño de la SaaS y usando ojitos en vez de checks
const MultiselectDropdown: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}> = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const getLabel = () => {
    if (value.length === 0) return placeholder;
    const labels = value.map(val => options.find(o => o.value === val)?.label).filter(Boolean);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} (+${labels.length - 2})`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-12 w-full items-center gap-3 rounded-xl border px-4 text-left transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'border-blue-500 bg-white shadow-[0_10px_24px_rgba(37,99,235,0.06)]'
            : 'border-slate-200 bg-slate-50 hover:border-slate-350 hover:bg-slate-50/50'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-700">
          {getLabel()}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[260] w-max rounded-2xl border border-slate-100 bg-white p-1.5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] animate-[platform-fade-in_150ms_ease-out]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: Math.max(menuPosition.width, 240),
          }}
        >
          {options.map(option => {
            const isSelected = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl px-4.5 py-3 text-left text-[13.5px] font-bold transition-all duration-200 hover:translate-x-1 ${
                  isSelected ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                }`}
              >
                <span>{option.label}</span>
                <div className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                  isSelected
                    ? 'border-blue-300 bg-blue-100 text-blue-600'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}>
                  {isSelected ? <Eye size={13} /> : <EyeOff size={13} />}
                </div>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
};

export const PdfTemplateBuilder: React.FC<{
  companyId: string;
  onBack: () => void;
}> = ({ companyId, onBack }) => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [name, setName] = useState('Mi Plantilla de Reporte');
  const [reportTypes, setReportTypes] = useState<string[]>(['CLIENT_STATEMENT']);
  const [paperSize, setPaperSize] = useState<'A4' | 'Carta'>('Carta');
  const [orientation, setOrientation] = useState<'Vertical' | 'Horizontal'>('Vertical');
  const [marginPreset, setMarginPreset] = useState<'Compacto' | 'Normal' | 'Amplio'>('Normal');
  const [visualPreset, setVisualPreset] = useState<'CORPORATIVA_CLASICA' | 'FISCAL_ELECTRONICA' | 'FACTURA_FINANCIERA'>('FACTURA_FINANCIERA');
  const [documentStyle, setDocumentStyle] = useState<'Reporte premium' | 'Recibo de pago'>('Reporte premium');
  const [showNextInstallment, setShowNextInstallment] = useState(true);
  const [showRemainingBalance, setShowRemainingBalance] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);
  
  const [blocks, setBlocks] = useState<BlockPosition[]>(DEFAULT_BLOCKS);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  
  const [logo, setLogo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; blockX: number; blockY: number } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = (selectId?: string) => {
    setPlatformLoading({ active: true, label: 'Cargando plantillas...' });
    apiClient
      .listReportTemplates()
      .then(response => {
        setTemplates(response.data);
        if (response.data.length > 0) {
          const targetId = selectId || selectedTemplateId;
          const found = response.data.find(t => t.id === targetId);
          selectTemplate(found || response.data[0]);
        }
      })
      .catch(() => {
        emitPlatformToast({
          title: 'Error de conexión',
          message: 'No pudimos cargar las plantillas de reporte del servidor.',
          tone: 'error',
        });
      })
      .finally(() => {
        setPlatformLoading({ active: false });
        setIsDirty(false);
      });
  };

  const selectTemplate = (template: ReportTemplate) => {
    setSelectedTemplateId(template.id);
    setName(template.name);
    setReportTypes(template.reportType ? template.reportType.split(',') : ['CLIENT_STATEMENT']);
    
    if (template.config) {
      setPaperSize(template.config.paperSize === 'Oficio' ? 'Carta' : template.config.paperSize || 'Carta');
      setOrientation(template.config.orientation || 'Vertical');
      setMarginPreset(template.config.marginPreset || 'Normal');
      setVisualPreset(template.config.visualPreset || 'FACTURA_FINANCIERA');
      setDocumentStyle(template.config.documentStyle || 'Reporte premium');
      
      if (template.config.receiptOptions) {
        setShowNextInstallment(template.config.receiptOptions.showNextInstallment);
        setShowRemainingBalance(template.config.receiptOptions.showRemainingBalance);
        setIncludeSignature(template.config.receiptOptions.includeSignature);
      }
      
      if (template.config.layoutPositions) {
        const loaded = DEFAULT_BLOCKS.map(block => {
          const pos = template.config?.layoutPositions?.[block.id];
          return pos ? { ...block, x: pos.x, y: pos.y, visible: pos.visible } : block;
        });
        setBlocks(loaded);
      } else {
        setBlocks(DEFAULT_BLOCKS);
      }
    }
    setIsDirty(false);
  };

  const handleCreateNewTemplate = () => {
    setSelectedTemplateId('');
    setName('Nueva Plantilla Personalizada');
    setBlocks(DEFAULT_BLOCKS);
    setIsDirty(true);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeImageFile(file);
      setLogo(optimized);
      setIsDirty(true);
      emitPlatformToast({ title: 'Imagen cargada', message: 'El logo se cargo correctamente.', tone: 'success' });
    } catch {
      emitPlatformToast({ title: 'Error', message: 'No pudimos procesar la imagen.', tone: 'error' });
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setPlatformLoading({ active: true, label: 'Guardando cambios en la plantilla...' });

    const layoutPositions: Record<string, { x: number; y: number; visible: boolean }> = {};
    blocks.forEach(b => {
      layoutPositions[b.id] = { x: b.x, y: b.y, visible: b.visible };
    });

    const config: ReportTemplateConfig = {
      visualPreset,
      paperSize,
      orientation,
      marginPreset,
      documentStyle,
      receiptOptions: {
        showNextInstallment,
        showRemainingBalance,
        includeSignature,
      },
      layoutPositions,
    };

    const payload = {
      name,
      reportType: reportTypes.join(','),
      status: 'Activa',
      sections: blocks.filter(b => b.visible).map(b => b.id),
      config,
    };

    try {
      let targetId = selectedTemplateId;
      if (selectedTemplateId) {
        await apiClient.updateReportTemplate(selectedTemplateId, payload);
        emitPlatformToast({ title: 'Plantilla guardada', message: 'Se guardaron los cambios de la plantilla PDF.', tone: 'success' });
      } else {
        const response = await apiClient.createReportTemplate(payload);
        targetId = response.data.id;
        setSelectedTemplateId(targetId);
        emitPlatformToast({ title: 'Plantilla creada', message: 'Se registro la nueva plantilla PDF.', tone: 'success' });
      }
      setIsDirty(false);
      loadTemplates(targetId);
    } catch {
      emitPlatformToast({ title: 'Error de guardado', message: 'No pudimos guardar los cambios en el servidor.', tone: 'error' });
    } finally {
      setIsSaving(false);
      setPlatformLoading({ active: false });
    }
  };

  const handleBackAttempt = () => {
    if (isDirty) {
      setShowConfirmModal(true);
    } else {
      onBack();
    }
  };

  const handleMouseDown = (event: React.MouseEvent, blockId: string) => {
    event.preventDefault();
    if (!containerRef.current) return;
    
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    setActiveBlockId(blockId);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      blockX: block.x,
      blockY: block.y,
    };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!activeBlockId || !dragStartRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = (event.clientX - dragStartRef.current.x) / zoom;
    const deltaY = (event.clientY - dragStartRef.current.y) / zoom;

    const percentDeltaX = (deltaX / (rect.width / zoom)) * 100;
    const percentDeltaY = (deltaY / (rect.height / zoom)) * 100;

    setBlocks(current =>
      current.map(b => {
        if (b.id !== activeBlockId) return b;
        
        let newX = Math.round((dragStartRef.current!.blockX + percentDeltaX) * 10) / 10;
        let newY = Math.round((dragStartRef.current!.blockY + percentDeltaY) * 10) / 10;

        newX = Math.max(0, Math.min(newX, 100 - b.width));
        newY = Math.max(0, Math.min(newY, 100 - b.height));

        return { ...b, x: newX, y: newY };
      }),
    );
    setIsDirty(true);
  };

  const handleMouseUp = () => {
    setActiveBlockId(null);
    dragStartRef.current = null;
  };

  const toggleVisibility = (blockId: string) => {
    setBlocks(current =>
      current.map(b => (b.id === blockId ? { ...b, visible: !b.visible } : b)),
    );
    setIsDirty(true);
  };

  const restoreDefaultPositions = () => {
    setBlocks(DEFAULT_BLOCKS);
    setIsDirty(true);
    emitPlatformToast({ title: 'Valores restablecidos', message: 'Las posiciones volvieron al valor estandar.', tone: 'info' });
  };

  const isPaperVertical = orientation === 'Vertical';
  const paperRatio = isPaperVertical ? 1.294 : 0.773; // A4/Letter ratios

  return (
    <div 
      className="fixed inset-0 z-[120] flex flex-col bg-slate-100 overflow-hidden font-sans text-slate-800 select-none animate-[platform-fade-in_220ms_ease-out]"
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp}
    >
      {/* Barra superior de herramientas (Modo Claro) */}
      <header className="h-[76px] shrink-0 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBackAttempt}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:translate-x-1 hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black tracking-tight text-slate-900">{name}</h1>
              <span className="inline-flex rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-blue-600">
                PDF Builder
              </span>
            </div>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">
              Arrastra bloques para maquetar · {paperSize} · {orientation}
            </p>
          </div>
        </div>

        {/* Plantillas en Barra Superior */}
        <div className="hidden lg:flex items-center gap-2 max-w-[40%] bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`inline-flex rounded-xl px-3.5 py-1.5 text-[12px] font-bold transition-all duration-200 hover:translate-x-0.5 cursor-pointer ${
                selectedTemplateId === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
              }`}
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCreateNewTemplate}
            className="inline-flex rounded-xl border border-dashed border-blue-300 px-3 py-1.5 text-[12px] font-bold text-blue-600 hover:bg-blue-50 transition-all duration-200 hover:translate-x-0.5 cursor-pointer"
          >
            + Nueva
          </button>
        </div>

        {/* Controles de Zoom Dinámico (Max 200%) */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
            title="Alejar"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[12px] font-bold text-slate-700 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
            title="Acercar"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-all cursor-pointer border-l border-slate-200"
            title="Restaurar zoom"
          >
            <Maximize size={14} />
          </button>
        </div>

        {/* Botón Guardar con estilo e impacto visual de la SaaS */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            form="pdf-builder-form"
            disabled={isSaving}
            className="inline-flex h-[56px] min-w-[188px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#2563EB] px-6 text-[16px] font-semibold text-white shadow-[0_24px_48px_rgba(37,99,235,0.24)] transition-all duration-200 hover:translate-x-1 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Save size={18} />
            {selectedTemplateId ? 'Guardar Cambios' : 'Crear Plantilla'}
          </button>
        </div>
      </header>

      {/* Area de Trabajo Principal (Modo Claro) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Izquierdo: Configuraciones (Modo Claro) */}
        <aside className="w-[360px] shrink-0 bg-white border-r border-slate-200 overflow-y-auto flex flex-col justify-between p-6">
          <form id="pdf-builder-form" onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-100 pb-3">
              <Settings size={16} className="text-blue-600" />
              <span>Ajustes Generales</span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nombre de la Plantilla</label>
              <input
                required
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-blue-500 transition-all focus:bg-white"
                value={name}
                onChange={event => {
                  setName(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="Ej: Plantilla de Facturas"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Apartado de Aplicación</label>
              <MultiselectDropdown
                value={reportTypes}
                onChange={val => {
                  setReportTypes(val);
                  setIsDirty(true);
                }}
                options={APPLICATION_OPTIONS}
                placeholder="Seleccionar apartados..."
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Papel</label>
                <SaaSFilterDropdown
                  value={paperSize}
                  onChange={val => {
                    setPaperSize(val as any);
                    setIsDirty(true);
                  }}
                  options={[
                    { value: 'Carta', label: 'Carta (Letter)' },
                    { value: 'A4', label: 'A4 estándar' },
                  ]}
                  placeholder="Formato"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Orientación</label>
                <SaaSFilterDropdown
                  value={orientation}
                  onChange={val => {
                    setOrientation(val as any);
                    setIsDirty(true);
                  }}
                  options={[
                    { value: 'Vertical', label: 'Vertical' },
                    { value: 'Horizontal', label: 'Horizontal' },
                  ]}
                  placeholder="Orientación"
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preset Visual</label>
                <SaaSFilterDropdown
                  value={visualPreset}
                  onChange={val => {
                    setVisualPreset(val as any);
                    setIsDirty(true);
                  }}
                  options={[
                    { value: 'FACTURA_FINANCIERA', label: 'Financiera ejecutiva' },
                    { value: 'CORPORATIVA_CLASICA', label: 'Corporativa clásica' },
                    { value: 'FISCAL_ELECTRONICA', label: 'Fiscal electrónica' },
                  ]}
                  placeholder="Estilo Preset"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Márgenes</label>
                <SaaSFilterDropdown
                  value={marginPreset}
                  onChange={val => {
                    setMarginPreset(val as any);
                    setIsDirty(true);
                  }}
                  options={[
                    { value: 'Normal', label: 'Normal' },
                    { value: 'Compacto', label: 'Compacto' },
                    { value: 'Amplio', label: 'Amplio' },
                  ]}
                  placeholder="Márgenes"
                />
              </div>
            </div>

            {/* Capas y Visibilidad */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <Layers size={15} className="text-blue-600" />
                <span>Bloques Disponibles</span>
              </div>
              <div className="divide-y divide-slate-100">
                {blocks.map(b => (
                  <div key={b.id} className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] font-semibold text-slate-650">{b.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleVisibility(b.id)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                        b.visible
                          ? 'border-blue-300 bg-blue-50 text-blue-600 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    >
                      {b.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </form>

          {/* Botón de restablecer lienzo homogeneizado al diseño de otros módulos */}
          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={restoreDefaultPositions}
              className="w-full inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white text-[16px] font-semibold text-[#374151] transition-all duration-200 hover:translate-x-1 hover:border-[#DBEAFE] hover:bg-[#F8FAFC] hover:text-[#2563EB] cursor-pointer shadow-sm"
            >
              <RotateCcw size={16} />
              Reestablecer Lienzo
            </button>
          </div>
        </aside>

        {/* Area del Canvas (Hoja Virtual con zoom) */}
        <main className="flex-1 bg-slate-100 overflow-auto p-12 flex items-start justify-center relative">
          
          <div
            ref={containerRef}
            className="relative bg-white border border-slate-300 shadow-[0_24px_60px_rgba(15,23,42,0.12)] overflow-hidden rounded-[4px] transition-transform duration-100 ease-out origin-top my-8 shrink-0"
            style={{
              width: '100%',
              maxWidth: isPaperVertical ? '540px' : '720px',
              aspectRatio: `${1 / paperRatio}`,
              transform: `scale(${zoom})`,
            }}
          >
            {/* Margen */}
            <div
              className="absolute border border-dashed border-slate-200 pointer-events-none"
              style={{
                top: marginPreset === 'Compacto' ? '4%' : marginPreset === 'Normal' ? '7%' : '10%',
                left: marginPreset === 'Compacto' ? '4%' : marginPreset === 'Normal' ? '7%' : '10%',
                right: marginPreset === 'Compacto' ? '4%' : marginPreset === 'Normal' ? '7%' : '10%',
                bottom: marginPreset === 'Compacto' ? '4%' : marginPreset === 'Normal' ? '7%' : '10%',
              }}
            />

            {/* Componentes Arrastrables */}
            {blocks.filter(b => b.visible).map(b => (
              <div
                key={b.id}
                onMouseDown={event => handleMouseDown(event, b.id)}
                style={{
                  position: 'absolute',
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: `${b.width}%`,
                  height: `${b.height}%`,
                }}
                className={`flex flex-col justify-between p-3 rounded-2xl border-2 transition-all duration-75 cursor-move select-none ${
                  activeBlockId === b.id
                    ? 'border-blue-600 bg-blue-50/95 shadow-[0_20px_50px_rgba(37,99,235,0.18)] z-30 scale-[1.02]'
                    : 'border-slate-200 bg-white/95 text-slate-800 hover:border-blue-500 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate max-w-[80%]">
                    {b.label}
                  </span>
                  <Move size={11} className="text-slate-450" />
                </div>
                
                {/* Contenido Visual Simulado */}
                <div className="flex-1 flex items-center justify-center">
                  {b.id === 'logo' && (
                    <div className="h-full w-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                      {logo ? (
                        <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        <ImageIcon size={18} className="text-slate-355" />
                      )}
                    </div>
                  )}
                  {b.id === 'companyInfo' && (
                    <div className="w-full text-[8px] leading-tight text-slate-500 text-right">
                      <p className="font-bold text-slate-800">PrestaFacil RD</p>
                      <p>Santo Domingo, RD</p>
                      <p>RNC: 101-99887-2</p>
                    </div>
                  )}
                  {b.id === 'documentMeta' && (
                    <div className="w-full flex justify-between gap-2 border border-slate-100 rounded-lg p-1.5 bg-slate-50/50">
                      <div className="text-[8px] text-slate-500">
                        <p className="font-bold text-slate-700">Estado de cuenta</p>
                        <p>Nº: CLI-00293</p>
                      </div>
                      <div className="text-[8px] text-slate-500 text-right">
                        <p>Fecha: 27/06/2026</p>
                        <p>Vence: 27/07/2026</p>
                      </div>
                    </div>
                  )}
                  {b.id === 'clientBlock' && (
                    <div className="w-full text-[8px] leading-normal border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                      <p className="font-bold text-slate-800">Cliente: Juan Pérez</p>
                      <p>Cédula: 001-0000000-0</p>
                      <p>Dir: Av. 27 de Febrero, Santo Domingo</p>
                    </div>
                  )}
                  {b.id === 'mainTable' && (
                    <div className="w-full h-full flex flex-col justify-between border border-slate-100 rounded-lg overflow-hidden bg-slate-50/20 text-[7px] text-slate-500">
                      <div className="grid grid-cols-4 bg-slate-100 p-1 font-bold text-slate-700">
                        <span>Concepto</span>
                        <span className="text-center">Cuota</span>
                        <span className="text-center">Mora</span>
                        <span className="text-right">Total</span>
                      </div>
                      <div className="flex-1 flex flex-col justify-around p-1 border-t border-slate-100">
                        <div className="grid grid-cols-4 border-b border-slate-50 pb-0.5">
                          <span>Préstamo 01</span>
                          <span className="text-center">RD$5,000</span>
                          <span className="text-center">-</span>
                          <span className="text-right">RD$5,000</span>
                        </div>
                        <div className="grid grid-cols-4 border-b border-slate-50 pb-0.5">
                          <span>Préstamo 02</span>
                          <span className="text-center">RD$4,500</span>
                          <span className="text-center">RD$200</span>
                          <span className="text-right">RD$4,700</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {b.id === 'totalsBlock' && (
                    <div className="w-full text-[8px] leading-relaxed text-right border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1">
                        <span>Subtotal:</span>
                        <span>RD$9,500.00</span>
                      </div>
                      <div className="flex justify-between gap-2 font-bold text-slate-800 pt-1">
                        <span>Neto a Pagar:</span>
                        <span>RD$9,700.00</span>
                      </div>
                    </div>
                  )}
                  {b.id === 'footer' && (
                    <div className="w-full text-[7px] text-slate-400 text-center leading-normal">
                      <p>Documento emitido desde PrestaFacil RD</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Modal de Confirmación de salida sin guardar (Estilo SaaS Premium) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[platform-fade-in_150ms_ease-out]">
          <div className="relative w-full max-w-[420px] rounded-[32px] bg-white p-7 shadow-[0_32px_80px_rgba(15,23,42,0.18)] border border-slate-100 animate-[platform-scale-in_200ms_ease-out]">
            {/* Botón de cerrar X en la esquina superior derecha */}
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition-all hover:bg-red-50 hover:text-[#DC2626] hover:border-red-100 cursor-pointer shadow-sm"
            >
              <X size={18} strokeWidth={2.2} />
            </button>

            {/* Icono de Alerta Roja */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-50 text-red-600 border border-red-100 mb-5 transition-transform duration-200">
              <ShieldAlert size={28} strokeWidth={2.2} />
            </div>

            {/* Cabecera del Modal */}
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 text-center">Confirmacion critica</p>
            <h3 className="text-[20px] font-black tracking-tight text-slate-900 text-center mt-2.5">
              ¿Salir sin guardar cambios?
            </h3>
            
            <p className="text-[13.5px] font-semibold text-slate-500 text-center mt-3 max-w-[320px] mx-auto leading-relaxed">
              Has realizado cambios en el diseñador de la plantilla PDF. Si sales ahora, perderás todo el progreso y las posiciones del lienzo modificadas.
            </p>

            {/* Separador */}
            <div className="my-6 border-t border-slate-100" />

            {/* Acciones del Modal */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:translate-x-0.5"
              >
                <X size={14} />
                Seguir revisando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  onBack();
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-5 text-[13px] font-bold text-white shadow-[0_12px_24px_rgba(220,38,38,0.22)] hover:bg-red-700 cursor-pointer transition-all duration-200 hover:translate-x-0.5"
              >
                <Check size={14} />
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
