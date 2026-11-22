import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Route as RouteIcon,
  ArrowUpRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { UserContext } from '../../types';
import {
  TransportLine,
  TransportStop,
  INITIAL_CONAKRY_LINES,
  INITIAL_CONAKRY_STOPS,
  CONAKRY_COMMUNES,
} from './gisData';

export interface ConakryMapWidgetProps {
  currentUser: UserContext;
  height?: string;
  initialCommune?: string;
  onOpenFullMap?: () => void;
  title?: string;
  subtitle?: string;
  variant?: 'dashboard' | 'full';
}

export const ConakryMapWidget: React.FC<ConakryMapWidgetProps> = ({
  currentUser,
  height = '380px',
  initialCommune = 'TOUTES',
  onOpenFullMap,
  title,
  subtitle,
  variant = 'dashboard',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const polylinesLayerGroup = useRef<L.LayerGroup | null>(null);
  const markersLayerGroup = useRef<L.LayerGroup | null>(null);

  // Default commune filter: if user has a specific assigned commune (e.g. CHEF_SERVICE), scope to it if available
  const defaultFilter =
    currentUser.communeName && CONAKRY_COMMUNES.includes(currentUser.communeName)
      ? currentUser.communeName
      : initialCommune;

  const [lines] = useState<TransportLine[]>(INITIAL_CONAKRY_LINES);
  const [stops] = useState<TransportStop[]>(INITIAL_CONAKRY_STOPS);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [filterCommune, setFilterCommune] = useState<string>(defaultFilter);

  const isDistributor = currentUser.role === 'DISTRIBUTEUR';
  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'DIRECTOR';
  const isChefService = currentUser.role === 'CHEF_SERVICE';

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (leafletMap.current) return;

    // Centered on Conakry (Kaloum - Matoto - Ratoma corridor axis)
    const map = L.map(mapContainerRef.current, {
      center: [9.565, -13.64],
      zoom: 12,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false, // We provide accessible custom zoom controls
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap AOTUC-SIG',
    }).addTo(map);

    polylinesLayerGroup.current = L.layerGroup().addTo(map);
    markersLayerGroup.current = L.layerGroup().addTo(map);
    leafletMap.current = map;

    // Invalidate size to guarantee no partial grey tiles on dashboard load
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // 2. Render Polylines and Stop Markers
  useEffect(() => {
    if (!leafletMap.current || !polylinesLayerGroup.current || !markersLayerGroup.current) return;

    polylinesLayerGroup.current.clearLayers();
    markersLayerGroup.current.clearLayers();

    // Draw Lines
    lines.forEach((line) => {
      const isSelected = selectedLineId === line.id;
      const polyline = L.polyline(line.coordinates, {
        color: line.colorHex,
        weight: isSelected ? 6 : 3.5,
        opacity: isSelected ? 0.95 : 0.7,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.bindTooltip(
        `<b>${line.code}</b> : ${line.name}<br/>${line.distanceKm} km • ~${line.estimatedMinutes} min`,
        { sticky: true }
      );

      polyline.on('click', () => {
        setSelectedLineId((prev) => (prev === line.id ? null : line.id));
      });

      polylinesLayerGroup.current?.addLayer(polyline);
    });

    // Draw Stops
    const visibleStops = stops.filter(
      (s) => filterCommune === 'TOUTES' || s.commune === filterCommune
    );

    const activeLine = lines.find((l) => l.id === selectedLineId);

    visibleStops.forEach((stop) => {
      const isPartOfSelected = activeLine?.stops.includes(stop.code);

      const marker = L.circleMarker([stop.latitude, stop.longitude], {
        radius: isPartOfSelected ? 7 : 5,
        fillColor: isPartOfSelected ? '#FCD116' : isDistributor ? '#F97316' : '#2563EB',
        color: '#FFFFFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });

      const roleBadgeHtml = isDistributor
        ? `<div style="display:inline-block; margin-top:3px; padding:2px 6px; background:#fff7ed; color:#c2410c; border:1px solid #ffedd5; border-radius:4px; font-size:10px; font-weight:bold;">Point Réseau de Vente POS</div>`
        : `<div style="display:inline-block; margin-top:3px; padding:2px 6px; background:#eff6ff; color:#1e40af; border:1px solid #dbeafe; border-radius:4px; font-size:10px; font-weight:bold;">Arrêt Régulé AOTUC</div>`;

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; min-width: 170px;">
          <div style="font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            ${stop.name} (${stop.code})
          </div>
          <div>Commune : <b>${stop.commune}</b></div>
          <div>Équipement : <b>${stop.isSheltered ? 'Abribus AOTUC' : 'Potelet simple'}</b></div>
          <div>Fréquentation : <b>~${stop.dailyPassengers.toLocaleString()} voy./jour</b></div>
          ${roleBadgeHtml}
          <div style="color: #64748b; font-size: 10px; margin-top: 4px;">GPS : ${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}</div>
        </div>
      `);

      markersLayerGroup.current?.addLayer(marker);
    });
  }, [lines, stops, selectedLineId, filterCommune, isDistributor]);

  // Controls Handlers
  const handleZoomIn = () => {
    if (leafletMap.current) leafletMap.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (leafletMap.current) leafletMap.current.zoomOut();
  };

  const handleRecenter = () => {
    if (!leafletMap.current) return;
    setSelectedLineId(null);
    setFilterCommune(defaultFilter);
    leafletMap.current.setView([9.565, -13.64], 12);
  };

  const handleSelectLine = (lineId: string) => {
    setSelectedLineId((prev) => (prev === lineId ? null : lineId));
    const targetLine = lines.find((l) => l.id === lineId);
    if (targetLine && leafletMap.current) {
      const bounds = L.latLngBounds(targetLine.coordinates);
      leafletMap.current.fitBounds(bounds, { padding: [30, 30] });
    }
  };

  // Header Title and Subtitle defaults based on user role
  const resolvedTitle =
    title ||
    (isDistributor
      ? 'Cartographie Réseau & Points de Vente — Conakry'
      : isChefService
      ? `Système d Information Géographique — Commune de ${currentUser.communeName || 'Matoto'}`
      : 'Système d Information Géographique (SIG) — Réseau Conakry');

  const resolvedSubtitle =
    subtitle ||
    (isDistributor
      ? 'Vue temps réel des couloirs de transport, arrêts régulés et points de transit pour la billetterie urbaine.'
      : 'Couloirs de transport urbain, stations régulées et couverture territoriale des 13 communes de Conakry.');

  const visibleStopsCount = stops.filter(
    (s) => filterCommune === 'TOUTES' || s.commune === filterCommune
  ).length;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col transition-colors duration-200 ${
        variant === 'dashboard' ? 'shadow-sm' : 'shadow-none'
      }`}
    >
      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div
            className={`p-2.5 rounded-xl flex-shrink-0 ${
              isDistributor
                ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
            }`}
          >
            {isDistributor ? <Ticket className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {resolvedTitle}
              </h2>
              {isAdmin && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Supervision SIG
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {resolvedSubtitle}
            </p>
          </div>
        </div>

        {/* Action Buttons & Navigation to Full Map */}
        <div className="flex items-center space-x-2 self-end md:self-center flex-wrap gap-y-2">
          {onOpenFullMap && (
            <button
              onClick={onOpenFullMap}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
              title="Ouvrir la vue cartographique plein écran"
            >
              <span>Carte Complète</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Corridor Selector Toolbar */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Commune Filter */}
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Commune :</span>
          </span>
          <select
            value={filterCommune}
            onChange={(e) => setFilterCommune(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[190px] sm:max-w-none"
          >
            <option value="TOUTES">Toutes les 13 Communes ({stops.length} arrêts)</option>
            {CONAKRY_COMMUNES.map((comm) => (
              <option key={comm} value={comm}>
                {comm}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            ({visibleStopsCount} station{visibleStopsCount > 1 ? 's' : ''} visible{visibleStopsCount > 1 ? 's' : ''})
          </span>
        </div>

        {/* Quick Corridor Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 max-w-full">
          {lines.map((l) => {
            const isSelected = selectedLineId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => handleSelectLine(l.id)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer border shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900'
                    : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
                title={l.name}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block mr-1"
                  style={{ backgroundColor: l.colorHex }}
                />
                {l.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Body & Controls */}
      <div className="relative w-full overflow-hidden" style={{ height }}>
        {/* DOM Leaflet Container */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating In-Map Zoom & Recenter Controls */}
        <div className="absolute top-3 right-3 z-[400] flex flex-col space-y-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md">
          <button
            onClick={handleZoomIn}
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg transition"
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg transition"
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleRecenter}
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg transition"
            title="Recentrer sur Conakry"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Quick Legend (Bottom Left) */}
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-[10px] text-slate-600 dark:text-slate-400 hidden sm:flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-1 bg-[#2563EB] rounded-full inline-block" />
            <span>Fidel Castro</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-1 bg-[#DC2626] rounded-full inline-block" />
            <span>Axe Le Prince</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#F97316] inline-block border border-white" />
            <span>Arrêts Réseau</span>
          </div>
        </div>
      </div>

      {/* Footer Info & Verification Notice */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>
            <b>Données Vérifiées AOTUC :</b> 4 couloirs structurants, 20 arrêts homologués. Délimitations polygonales réservées au cadastre officiel MATD.
          </span>
        </div>
        <div className="flex items-center space-x-3 font-semibold text-slate-600 dark:text-slate-300">
          <span className="flex items-center space-x-1">
            <RouteIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>{lines.length} Lignes</span>
          </span>
          <span>•</span>
          <span className="flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            <span>{stops.length} Stations (13 Communes)</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConakryMapWidget;
