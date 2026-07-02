import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import {
  MapPin,
  Satellite,
  Gauge,
  Clock,
  Compass,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Phone,
  MessageSquare,
  ArrowLeft,
  Crosshair,
  Battery,
  Sparkles,
  Layers
} from 'lucide-react';
import { formatCurrency } from '../utils';
import { ClientAvatar } from './ui/ClientAvatar';

interface RouteItem {
  id: string;
  clientName: string;
  amountToCollect: number;
  order: number;
  visitStatus: 'PENDING' | 'PAID' | 'FAILED' | 'PROMISED' | 'VISITED';
  address: string;
  photo?: string;
  latitude?: number;
  longitude?: number;
}

interface LiveRouteMapProps {
  items: RouteItem[];
  collectorName?: string;
  collectorPhone?: string;
  onBack: () => void;
  routeCode: string;
  initialSelectedClientId?: string | null;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  items,
  collectorName = 'Mensajero',
  collectorPhone = '809-555-0199',
  onBack,
  routeCode,
  initialSelectedClientId = null,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Real coordinates base for Santo Domingo (Av. Winston Churchill / Av. Sarasota / Av. 27 de Febrero)
  const defaultCoords = useMemo(() => [
    { lat: 18.4742, lng: -69.9415 }, // Sede Principal / Inicio
    { lat: 18.4755, lng: -69.9405 }, // Cliente 1
    { lat: 18.4785, lng: -69.9430 }, // Cliente 2
    { lat: 18.4810, lng: -69.9320 }, // Cliente 3
    { lat: 18.4855, lng: -69.9412 }, // Cliente 4
    { lat: 18.4880, lng: -69.9350 }  // Cliente 5
  ], []);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(38);
  const [gpsAccuracy, setGpsAccuracy] = useState(4);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  
  // Real-time tracking states
  const [isFollowing, setIsFollowing] = useState(true);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Dynamic status map for real-time visit simulation
  const [dynamicStatuses, setDynamicStatuses] = useState<Record<string, 'PENDING' | 'PAID' | 'FAILED' | 'PROMISED'>>({});

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);

  // Project locations to real coordinates
  const mapPoints = useMemo(() => {
    return [
      {
        id: 'START',
        clientName: 'Sede Principal',
        amountToCollect: 0,
        order: 0,
        visitStatus: 'VISITED' as const,
        address: 'Centro de Despacho',
        photo: undefined,
        lat: defaultCoords[0].lat,
        lng: defaultCoords[0].lng
      },
      ...sortedItems.map((item, idx) => {
        const fallback = defaultCoords[(idx + 1) % defaultCoords.length];
        const statusOverride = dynamicStatuses[item.id] ?? item.visitStatus;
        return {
          id: item.id,
          clientName: item.clientName,
          amountToCollect: item.amountToCollect,
          order: item.order,
          visitStatus: statusOverride === 'VISITED' ? 'PENDING' : statusOverride,
          address: item.address,
          photo: item.photo,
          lat: item.latitude && Math.abs(item.latitude) > 1 ? item.latitude : fallback.lat,
          lng: item.longitude && Math.abs(item.longitude) > 1 ? item.longitude : fallback.lng
        };
      })
    ];
  }, [sortedItems, defaultCoords, dynamicStatuses]);

  // Fetch real routes over street networks using OSRM
  useEffect(() => {
    if (mapPoints.length < 2) return;
    const fetchRealRoute = async () => {
      try {
        const coordString = mapPoints.map(p => `${p.lng},${p.lat}`).join(';');
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const coordinates = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          setRouteCoords(coordinates);
        } else {
          setRouteCoords(mapPoints.map(p => [p.lat, p.lng]));
        }
      } catch (err) {
        console.error('OSRM route fetch failed, falling back to straight lines:', err);
        setRouteCoords(mapPoints.map(p => [p.lat, p.lng]));
      }
    };
    fetchRealRoute();
  }, [mapPoints]);

  const totalExpected = useMemo(() => {
    return mapPoints.reduce((sum, item) => sum + item.amountToCollect, 0);
  }, [mapPoints]);

  const totalCollected = useMemo(() => {
    return mapPoints.reduce((sum, item) => sum + (item.visitStatus === 'PAID' ? item.amountToCollect : 0), 0);
  }, [mapPoints]);

  const totalRemaining = useMemo(() => Math.max(totalExpected - totalCollected, 0), [totalExpected, totalCollected]);

  const routeProgress = useMemo(() => {
    const visited = mapPoints.slice(1).filter(item => item.visitStatus !== 'PENDING').length;
    const total = mapPoints.length - 1;
    return total > 0 ? Math.round((visited / total) * 100) : 0;
  }, [mapPoints]);

  const stats = useMemo(() => {
    const clients = mapPoints.length - 1;
    const paid = mapPoints.filter(item => item.visitStatus === 'PAID').length;
    const pending = mapPoints.filter(item => item.visitStatus === 'PENDING').length;
    const failed = mapPoints.filter(item => item.visitStatus === 'FAILED').length;
    const promised = mapPoints.filter(item => item.visitStatus === 'PROMISED').length;
    return { clients, paid, pending, failed, promised };
  }, [mapPoints]);

  const nextTarget = useMemo(
    () => mapPoints.slice(1).find(p => p.visitStatus === 'PENDING') ?? mapPoints[mapPoints.length - 1],
    [mapPoints],
  );

  // Smooth collector position along OSRM street coordinates
  const baseIdx = useMemo(() => {
    if (routeCoords.length === 0) return 0;
    const maxIdx = routeCoords.length - 1;
    const t = currentStep / 100;
    return Math.floor(t * maxIdx);
  }, [routeCoords, currentStep]);

  const messengerPos = useMemo(() => {
    if (routeCoords.length === 0) return { lat: defaultCoords[0].lat, lng: defaultCoords[0].lng, angle: 0 };
    const maxIdx = routeCoords.length - 1;
    const t = currentStep / 100;
    const preciseIdx = t * maxIdx;
    const sn = routeCoords[baseIdx] || routeCoords[0];
    const en = routeCoords[Math.min(baseIdx + 1, maxIdx)] || sn;
    const frac = preciseIdx - baseIdx;

    const lat = sn[0] + (en[0] - sn[0]) * frac;
    const lng = sn[1] + (en[1] - sn[1]) * frac;
    const angle = Math.atan2(en[0] - sn[0], en[1] - sn[1]) * (180 / Math.PI);
    return { lat, lng, angle: 90 - angle };
  }, [routeCoords, currentStep, baseIdx, defaultCoords]);

  // Visit status trigger based on real spatial proximity
  useEffect(() => {
    if (routeCoords.length === 0) return;
    mapPoints.slice(1).forEach(point => {
      const dist = Math.sqrt(Math.pow(messengerPos.lat - point.lat, 2) + Math.pow(messengerPos.lng - point.lng, 2));
      if (dist < 0.00038 && (!dynamicStatuses[point.id] || dynamicStatuses[point.id] === 'PENDING')) {
        const roll = Math.random();
        const nextStatus = roll < 0.7 ? 'PAID' : roll < 0.9 ? 'PROMISED' : 'FAILED';
        setDynamicStatuses(prev => ({ ...prev, [point.id]: nextStatus }));
      }
    });
  }, [messengerPos, mapPoints, dynamicStatuses, routeCoords]);

  // Leaflet map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const initialCenter = defaultCoords[0];
    
    // Create Leaflet Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([initialCenter.lat, initialCenter.lng], 14);

    // OpenStreetMap dark styled tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      minZoom: 11
    }).addTo(map);

    mapRef.current = map;

    // Detect user interactions to pause auto-following
    map.on('dragstart', () => {
      setIsFollowing(false);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      messengerMarkerRef.current = null;
    };
  }, [defaultCoords]);

  // Double Polyline rendering (Traveled = Emerald Green / Remaining = Blue)
  const traveledPolylineRef = useRef<L.Polyline | null>(null);
  const remainingPolylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || routeCoords.length === 0) return;

    const traveledCoords = routeCoords.slice(0, baseIdx + 1);
    const remainingCoords = routeCoords.slice(baseIdx);

    // 1. Traveled polyline (Emerald green with smooth transition)
    if (traveledPolylineRef.current) {
      traveledPolylineRef.current.setLatLngs(traveledCoords);
    } else {
      traveledPolylineRef.current = L.polyline(traveledCoords, {
        color: '#10B981',
        weight: 6,
        opacity: 0.9,
        className: 'traveled-line-path'
      }).addTo(map);
    }

    // 2. Remaining polyline (Blue)
    if (remainingPolylineRef.current) {
      remainingPolylineRef.current.setLatLngs(remainingCoords);
    } else {
      remainingPolylineRef.current = L.polyline(remainingCoords, {
        color: '#3B82F6',
        weight: 5,
        opacity: 0.8
      }).addTo(map);
    }
  }, [routeCoords, baseIdx]);

  // Client Markers Layer
  const markersRef = useRef<Record<string, L.Marker>>({});
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    // Build new paradas markers
    mapPoints.forEach(point => {
      const isStart = point.id === 'START';
      const isSelected = selectedPointId === point.id || hoveredPointId === point.id;
      let colorClass = 'bg-blue-600 border-blue-400';
      if (point.visitStatus === 'PAID') colorClass = 'bg-emerald-600 border-emerald-400';
      if (point.visitStatus === 'FAILED') colorClass = 'bg-red-600 border-red-400';
      if (point.visitStatus === 'PROMISED') colorClass = 'bg-violet-600 border-violet-400';
      if (isStart) colorClass = 'bg-slate-700 border-slate-400';

      const scaleClass = isSelected ? 'scale-125 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'scale-100';

      const customIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: `
          <div class="relative flex items-center justify-center h-8 w-8 rounded-full shadow-lg border-2 text-white font-extrabold text-[11px] transition-all duration-300 ${colorClass} ${scaleClass}">
            ${isStart ? 'H' : point.order}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([point.lat, point.lng], { icon: customIcon }).addTo(map);
      marker.on('click', () => {
        setSelectedPointId(point.id);
        map.flyTo([point.lat, point.lng], 16, { animate: true, duration: 0.8 });
      });
      marker.on('mouseover', () => {
        setHoveredPointId(point.id);
      });
      marker.on('mouseout', () => {
        setHoveredPointId(null);
      });

      markersRef.current[point.id] = marker;
    });
  }, [mapPoints, selectedPointId, hoveredPointId]);

  // Messenger GPS directional arrow marker
  const messengerMarkerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const arrowHtml = `
      <div class="relative h-10 w-10 flex items-center justify-center z-[9000]">
        <!-- Pulse radar glow -->
        <span class="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-40 animate-ping"></span>
        <!-- Outer ring -->
        <div class="absolute h-9 w-9 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform z-[9010]" style="transform: rotate(${messengerPos.angle}deg);">
          <!-- Navigation triangle direction arrow -->
          <svg class="h-4.5 w-4.5 text-white fill-current" viewBox="0 0 24 24">
            <polygon points="12,2 22,22 12,18 2,22" />
          </svg>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'leaflet-messenger-marker',
      html: arrowHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (messengerMarkerRef.current) {
      messengerMarkerRef.current.setLatLng([messengerPos.lat, messengerPos.lng]);
      messengerMarkerRef.current.setIcon(customIcon);
      messengerMarkerRef.current.setZIndexOffset(2000); // stay on top of other markers
    } else {
      messengerMarkerRef.current = L.marker([messengerPos.lat, messengerPos.lng], { icon: customIcon, zIndexOffset: 2000 }).addTo(map);
      messengerMarkerRef.current.on('mouseover', () => setHoveredPointId('MESSENGER'));
      messengerMarkerRef.current.on('mouseout', () => setHoveredPointId(null));
      messengerMarkerRef.current.on('click', () => setIsFollowing(true));
    }

    // Auto-following camera
    if (isFollowing) {
      map.panTo([messengerPos.lat, messengerPos.lng], { animate: true });
    }
  }, [messengerPos, isFollowing]);

  // Simulation timer
  useEffect(() => {
    if (!isPlaying || routeCoords.length === 0) return;
    const interval = setInterval(() => {
      setCurrentStep(s => {
        const next = s + 0.15;
        if (next > 100) {
          setDynamicStatuses({}); // reset simulation
          return 0;
        }
        return next;
      });
      setSpeed(sp => Math.max(15, Math.min(sp + Math.floor(Math.random() * 7) - 3, 50)));
      setGpsAccuracy(ac => Math.max(3, Math.min(ac + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0), 6)));
    }, 180);
    return () => clearInterval(interval);
  }, [isPlaying, routeCoords]);

  // Center on point helper
  const handleCenterOnPoint = (point: typeof mapPoints[0]) => {
    setIsFollowing(false);
    setSelectedPointId(point.id);
    setHoveredPointId(null);
    if (mapRef.current) {
      mapRef.current.flyTo([point.lat, point.lng], 17, { animate: true, duration: 1 });
    }
  };

  // Center on collector
  const handleRecenterCollector = () => {
    setIsFollowing(true);
    if (mapRef.current) {
      mapRef.current.flyTo([messengerPos.lat, messengerPos.lng], 16, { animate: true, duration: 0.8 });
    }
  };

  // View full route boundary
  const handleViewFullRoute = () => {
    setIsFollowing(false);
    const map = mapRef.current;
    if (!map || routeCoords.length === 0) return;
    // Fit all coordinates to viewport boundary
    map.fitBounds(L.polyline(routeCoords).getBounds(), { padding: [55, 55] });
  };

  // Tooltip Portal positioning
  const activePin = useMemo(() => {
    const id = hoveredPointId ?? selectedPointId;
    if (id === 'MESSENGER') {
      return {
        id: 'MESSENGER',
        clientName: collectorName,
        address: `Ruta ${routeCode}`,
        lat: messengerPos.lat,
        lng: messengerPos.lng,
        visitStatus: 'VISITED' as const,
        amountToCollect: 0,
        order: 0,
        photo: undefined,
      };
    }
    return id ? (mapPoints.find(p => p.id === id) ?? null) : null;
  }, [hoveredPointId, selectedPointId, mapPoints, collectorName, routeCode, messengerPos]);

  // Auto-focus on client if passed from parent
  useEffect(() => {
    if (initialSelectedClientId && mapRef.current) {
      const match = mapPoints.find(p => p.id === initialSelectedClientId);
      if (match) {
        setIsFollowing(false);
        setSelectedPointId(match.id);
        setHoveredPointId(null);
        mapRef.current.setView([match.lat, match.lng], 17);
      }
    }
  }, [initialSelectedClientId, mapPoints]);

  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePin) {
      setTooltipPos(null);
      return;
    }

    const updateTooltipPosition = () => {
      const containerPoint = map.latLngToContainerPoint([activePin.lat, activePin.lng]);
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({
          x: rect.left + containerPoint.x,
          y: rect.top + containerPoint.y
        });
      }
    };

    updateTooltipPosition();
    map.on('move', updateTooltipPosition);
    map.on('zoom', updateTooltipPosition);

    return () => {
      map.off('move', updateTooltipPosition);
      map.off('zoom', updateTooltipPosition);
    };
  }, [activePin]);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#F8FAFC] overflow-hidden animate-[platform-fade-in_220ms_ease-out] font-sans select-none text-slate-800">

      {/* ── Header / Top Bar ── */}
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm z-10">
        {/* Left: back + title */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button" onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:-translate-x-0.5 transition-all cursor-pointer shadow-sm"
            title="Volver al detalle de ruta"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-[17px] font-black tracking-tight text-slate-900 truncate">Consola de Rastreo GPS</h1>
              <span className="inline-flex shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600">
                LIVE MONITOR
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
              Ruta {routeCode} · {collectorName} · <span className="font-normal text-slate-400">Última actualización: hace 1 min</span>
            </p>
          </div>
        </div>

        {/* Center: Console control actions */}
        <div className="flex shrink-0 items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-2xl">
          <button
            type="button"
            title="Reubicar cobrador en mapa"
            onClick={handleRecenterCollector}
            className="flex h-8 items-center gap-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition cursor-pointer shadow-sm text-[11px] font-bold"
          >
            <Crosshair size={13} className="text-blue-600 animate-pulse" />
            <span>Reubicar</span>
          </button>
          
          <button
            type="button"
            title="Activar/desactivar seguimiento activo"
            onClick={() => setIsFollowing(f => !f)}
            className={`flex h-8 items-center gap-1.5 px-3 rounded-xl border transition cursor-pointer shadow-sm text-[11px] font-bold ${
              isFollowing
                ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Satellite size={13} className={isFollowing ? 'animate-bounce' : ''} />
            <span>{isFollowing ? 'Siguiendo' : 'Seguir cobrador'}</span>
          </button>

          <button
            type="button"
            title="Ver ruta completa"
            onClick={handleViewFullRoute}
            className="flex h-8 items-center gap-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-sm text-[11px] font-bold"
          >
            <Layers size={13} />
            <span>Ruta Completa</span>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Quick Zoom buttons */}
          <button type="button" title="Acercar (Zoom In)" onClick={() => mapRef.current?.zoomIn()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer shadow-sm">
            <ZoomIn size={14} />
          </button>
          <button type="button" title="Alejar (Zoom Out)" onClick={() => mapRef.current?.zoomOut()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer shadow-sm">
            <ZoomOut size={14} />
          </button>
          
          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            type="button"
            title={isPlaying ? 'Pausar simulación' : 'Iniciar simulación'}
            onClick={() => setIsPlaying(p => !p)}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer shadow-sm ${
              isPlaying
                ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            title="Reiniciar tracking"
            onClick={() => { setCurrentStep(0); setIsPlaying(true); handleViewFullRoute(); }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer shadow-sm"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Right: GPS Status badge */}
        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-slate-200">
          <span className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981]' : 'bg-red-500'}`} />
          <Satellite size={12} className="text-blue-600 animate-pulse" />
          <span>GPS ONLINE</span>
        </div>
      </header>

      {/* ── Body: Sidebar + Map ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-[320px] shrink-0 bg-white border-r border-slate-200 flex flex-col p-4 shadow-sm z-10 h-full overflow-hidden">
          
          {/* Top fixed info */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4 pr-1">
            {/* Block 1: Conductor/Cobrador Status */}
            <section className="bg-slate-50 rounded-2xl p-3 border border-slate-200 shrink-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Estado del Dispositivo</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-bold border border-blue-200">
                  {collectorName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-800 truncate leading-snug">{collectorName}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-slate-500">
                    <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> En Ruta
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-blue-600">
                      <Battery size={10} className="fill-current" /> 88%
                    </span>
                    <span>•</span>
                    <span className="text-slate-400">±{gpsAccuracy}m</span>
                  </div>
                </div>
              </div>

              {/* Status details */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 text-[11px] font-medium text-slate-600">
                <div>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider">Velocidad</p>
                  <p className="font-black text-slate-800 mt-0.5">{isPlaying ? `${speed} km/h` : 'Parado'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider">Conexión</p>
                  <p className="font-bold text-emerald-600 mt-0.5">Señal Fuerte</p>
                </div>
              </div>
            </section>

            {/* Block 2: Acciones Rápidas */}
            <section className="shrink-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Acciones Rápidas</p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-slate-700">
                <button
                  type="button"
                  onClick={handleRecenterCollector}
                  className="flex h-9 items-center gap-1 px-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-55 transition cursor-pointer shadow-sm text-left"
                >
                  <Crosshair size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">Reubicar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFollowing(f => !f)}
                  className={`flex h-9 items-center gap-1 px-2.5 rounded-xl border transition cursor-pointer shadow-sm text-left ${
                    isFollowing
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-slate-200 hover:bg-slate-55'
                  }`}
                >
                  <Satellite size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">{isFollowing ? 'Autoseguir ✓' : 'Seguir cobrador'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleViewFullRoute}
                  className="flex h-9 items-center gap-1 px-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-55 transition cursor-pointer shadow-sm text-left"
                >
                  <Layers size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">Ruta completa</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert('¡Ruta optimizada con éxito!')}
                  className="flex h-9 items-center gap-1 px-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-55 transition cursor-pointer shadow-sm text-left"
                >
                  <Sparkles size={12} className="text-blue-500 shrink-0" />
                  <span className="truncate">Optimizar</span>
                </button>
              </div>
            </section>

            {/* Block 3: Resumen de la Ruta */}
            <section className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2 shrink-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Resumen operativo</p>
              
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                  <span>Progreso de visitas</span>
                  <span className="text-blue-600">{routeProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${routeProgress}%` }} />
                </div>
              </div>

              {/* Financial metrics */}
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 text-[11px] font-medium text-slate-600">
                <div>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider">Esperado</p>
                  <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(totalExpected)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider">Cobrado</p>
                  <p className="font-bold text-emerald-600 mt-0.5">{formatCurrency(totalCollected)}</p>
                </div>
              </div>

              {/* Visit counts */}
              <div className="flex flex-wrap gap-1.5 pt-2 text-[9px] font-bold">
                <span className="bg-emerald-50 border border-emerald-250 text-emerald-700 px-2 py-0.5 rounded-full">
                  Cobrados: {stats.paid}
                </span>
                <span className="bg-blue-50 border border-blue-250 text-blue-700 px-2 py-0.5 rounded-full">
                  Pendientes: {stats.pending}
                </span>
                <span className="bg-red-50 border border-red-255 text-red-700 px-2 py-0.5 rounded-full">
                  No loc: {stats.failed}
                </span>
                <span className="bg-violet-50 border border-violet-250 text-violet-700 px-2 py-0.5 rounded-full">
                  Promesas: {stats.promised}
                </span>
              </div>
            </section>

            {/* Block 4: Leyenda de colores */}
            <section className="bg-slate-50 rounded-2xl p-3 border border-slate-200 shrink-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Leyenda de Estados</p>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 border border-blue-400 shrink-0" />
                  <span className="text-slate-600">Pendiente</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 border border-emerald-400 shrink-0" />
                  <span className="text-slate-600">Cobrado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600 border border-red-400 shrink-0" />
                  <span className="text-slate-600">No localizado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-600 border border-violet-400 shrink-0" />
                  <span className="text-slate-600">Promesa pago</span>
                </div>
              </div>
            </section>

            {/* Block 5: Clientes Asignados List */}
            <section className="space-y-2 flex-1 flex flex-col min-h-[160px]">
              <div className="flex items-center justify-between shrink-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Clientes Asignados</p>
                <span className="text-[9px] font-bold text-slate-400">{stats.clients} paradas</span>
              </div>
              
              <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5 min-h-0">
                {mapPoints.slice(1).map(point => {
                  const isActive = selectedPointId === point.id || hoveredPointId === point.id;
                  return (
                    <button
                      key={`sidebar-cli-${point.id}`}
                      type="button"
                      onClick={() => handleCenterOnPoint(point)}
                      onMouseEnter={() => setHoveredPointId(point.id)}
                      onMouseLeave={() => setHoveredPointId(null)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left border transition shrink-0 ${
                        isActive
                          ? 'bg-blue-50 border-blue-300 shadow-sm'
                          : 'bg-slate-50 border-slate-205 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex shrink-0 h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[8px] font-extrabold text-slate-600">
                            {point.order}
                          </span>
                          <p className="text-[11px] font-bold text-slate-800 truncate leading-snug">{point.clientName}</p>
                        </div>
                        <p className="text-[9px] font-bold text-emerald-600 mt-1">{formatCurrency(point.amountToCollect)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold border ${
                        point.visitStatus === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                        point.visitStatus === 'FAILED' ? 'bg-red-50 border-red-200 text-red-600' :
                        point.visitStatus === 'PROMISED' ? 'bg-violet-50 border-violet-200 text-violet-600' :
                        'bg-blue-50 border-blue-200 text-blue-600'
                      }`}>
                        {point.visitStatus === 'PAID' ? 'Cobrado' :
                         point.visitStatus === 'FAILED' ? 'No loc' :
                         point.visitStatus === 'PROMISED' ? 'Promesa' : 'Pendiente'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Footer actions (Always visible at the bottom) */}
          <div className="mt-4 border-t border-slate-100 pt-4 space-y-2 shrink-0">
            <button
              type="button"
              onClick={() => window.open(`tel:${collectorPhone}`, '_self')}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-55 transition cursor-pointer"
            >
              <Phone size={13} className="text-slate-500" />Llamar Mensajero
            </button>
            <button
              type="button"
              onClick={() => window.open(`https://wa.me/${collectorPhone.replace(/\D/g, '')}`, '_blank')}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-sm"
            >
              <MessageSquare size={13} />WhatsApp Directo
            </button>
          </div>
        </aside>

        {/* ── Map Canvas ── */}
        <main
          ref={mapContainerRef}
          className="flex-1 relative overflow-hidden bg-[#1B2333]"
        >
          {/* Overlay follow state indicator */}
          <div className="absolute top-4 left-4 z-[400] flex items-center gap-2 rounded-xl bg-[#0F172A]/90 border border-slate-750 px-3 py-1.5 text-[10px] font-bold text-slate-300 backdrop-blur-sm">
            <span className={`h-1.5 w-1.5 rounded-full ${isFollowing ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_#3B82F6]' : 'bg-slate-500'}`} />
            <span>{isFollowing ? 'Siguiendo cobrador' : 'Seguimiento pausado'}</span>
          </div>

          {/* ── HTML TOOLTIP via Portal (never clipped by map!) ── */}
          {activePin && tooltipPos && (() => {
            // Protect sidebar (x < 320px) and map boundaries
            const rect = mapContainerRef.current?.getBoundingClientRect() || { left: 320, top: 68, width: 800, right: 1120 };
            
            const xInMap = tooltipPos.x - rect.left; // relative X to the map canvas
            const yInMap = tooltipPos.y - rect.top;  // relative Y to the map canvas
            
            let transform = 'translate(-50%, -100%) translateY(-22px)';
            let arrowClass = 'absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-r border-b border-blue-500/40 bg-[#0B0F19]';
            let clientArrowClass = 'absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-r border-b border-slate-700/60 bg-[#0F172A]';

            // Thresholds to trigger side placements
            const isLeft = xInMap < 170;
            const isRight = (rect.width - xInMap) < 170;
            const isTop = yInMap < 220;

            if (isLeft) {
              // Open to the right of the marker
              transform = 'translate(22px, -50%)';
              arrowClass = 'absolute -left-[7px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-l border-b border-blue-500/40 bg-[#0B0F19]';
              clientArrowClass = 'absolute -left-[7px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-l border-b border-slate-700/60 bg-[#0F172A]';
            } else if (isRight) {
              // Open to the left of the marker
              transform = 'translate(-100%, -50%) translateX(-22px)';
              arrowClass = 'absolute -right-[7px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-r border-t border-blue-500/40 bg-[#0B0F19]';
              clientArrowClass = 'absolute -right-[7px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-r border-t border-slate-700/60 bg-[#0F172A]';
            } else if (isTop) {
              // Open below the marker
              transform = 'translate(-50%, 22px)';
              arrowClass = 'absolute -top-[7px] left-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-l border-t border-blue-500/40 bg-[#0B0F19]';
              clientArrowClass = 'absolute -top-[7px] left-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 rounded-sm border-l border-t border-slate-700/60 bg-[#0F172A]';
            }

            return createPortal(
              <div
                className="pointer-events-none fixed z-[9999] transition-all duration-150 ease-out"
                style={{
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y}px`,
                  transform,
                }}
              >
                {activePin.id === 'MESSENGER' ? (
                  /* ── TOOLTIP DEL COBRADOR / MENSAJERO ── */
                  <div className="relative w-[290px] rounded-[24px] border border-blue-500/40 bg-[#0B0F19]/96 p-4 text-left shadow-[0_24px_64px_rgba(0,0,0,0.85)] backdrop-blur-md">
                    <div className={arrowClass} />
                    
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-505/10 border border-blue-500/30 text-blue-400">
                        <Compass size={20} className="animate-spin" style={{ animationDuration: '6s' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-[14px] text-white truncate">{activePin.clientName}</p>
                        <p className="mt-0.5 text-[11px] font-bold text-blue-400 uppercase tracking-wider">{activePin.address}</p>
                      </div>
                    </div>

                    <div className="mt-3.5 space-y-2 border-t border-slate-800/80 pt-3 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Estado GPS</span>
                        <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Velocidad</span>
                        <span className="font-bold text-slate-200">{isPlaying ? `${speed} km/h` : 'Parado'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Próxima parada</span>
                        <span className="font-bold text-slate-200 truncate max-w-[150px]">{nextTarget.clientName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Último reporte</span>
                        <span className="font-medium text-slate-400">hace 1 min</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Precisión GPS</span>
                        <span className="font-bold text-emerald-500">±{gpsAccuracy}m</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-800/50 pt-2 mt-1">
                        <span className="text-slate-400 font-semibold">Cobro acumulado</span>
                        <span className="font-black text-emerald-400 text-[13px]">{formatCurrency(totalCollected)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold">Pendiente estimado</span>
                        <span className="font-black text-blue-400 text-[13px]">{formatCurrency(totalRemaining)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── TOOLTIP ORDINARIO DEL CLIENTE ── */
                  <div className="relative w-[272px] rounded-[20px] border border-slate-700/60 bg-[#0F172A]/96 p-4 text-left shadow-[0_24px_64px_rgba(0,0,0,0.75)] backdrop-blur-sm">
                    <div className={clientArrowClass} />

                    <div className="flex items-center gap-3">
                      {activePin.id !== 'START' ? (
                        <ClientAvatar
                          client={{ firstName: activePin.clientName, lastName: '', photo: activePin.photo }}
                          className="h-11 w-11 rounded-full border-2 border-slate-700 shrink-0"
                          textClassName="text-[13px] font-black text-blue-400"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700/60 border border-slate-600 text-slate-400">
                          <MapPin size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-[14px] text-slate-100 truncate">{activePin.clientName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400 truncate">{activePin.address}</p>
                      </div>
                    </div>

                    {activePin.id !== 'START' && (
                      <div className="mt-3 flex items-center justify-between border-t border-slate-700/50 pt-3">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-bold">Esperado</p>
                          <p className="text-[16px] font-black text-emerald-400 mt-0.5">{formatCurrency(activePin.amountToCollect)}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          activePin.visitStatus === 'PAID'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : activePin.visitStatus === 'FAILED'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : activePin.visitStatus === 'PROMISED'
                            ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}>
                          {activePin.visitStatus === 'PAID' ? '✓ Cobrado'
                            : activePin.visitStatus === 'FAILED' ? '✗ No localizado'
                            : activePin.visitStatus === 'PROMISED' ? '⟳ Promesa'
                            : '● Pendiente'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>,
              document.body
            );
          })()}
        </main>
      </div>
    </div>
  );
};
