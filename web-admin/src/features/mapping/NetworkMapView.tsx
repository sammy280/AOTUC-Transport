import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Route as RouteIcon,
  Plus,
  Compass,
  Bus,
  Layers,
  Download,
  AlertCircle,
  Clock,
  Navigation,
} from 'lucide-react';

interface TransportStop {
  id: string;
  code: string;
  name: string;
  commune: string;
  latitude: number;
  longitude: number;
  isSheltered: boolean;
  dailyPassengers: number;
}

interface TransportLine {
  id: string;
  code: string;
  name: string;
  colorHex: string;
  originName: string;
  destinationName: string;
  distanceKm: number;
  estimatedMinutes: number;
  activeVehicles: number;
  coordinates: [number, number][]; // [lat, lng]
  stops: string[]; // stop codes
}

const INITIAL_CONAKRY_LINES: TransportLine[] = [
  {
    id: 'l-01',
    code: 'L-01',
    name: 'Kaloum Port — Matoto Rond-point',
    colorHex: '#2563EB',
    originName: 'Kaloum Port Autonome',
    destinationName: 'Matoto Marché',
    distanceKm: 16.2,
    estimatedMinutes: 45,
    activeVehicles: 38,
    coordinates: [
      [9.5092, -13.7122], // Kaloum
      [9.5245, -13.6934], // Madina Entrée
      [9.5441, -13.6651], // Madina Marché
      [9.5712, -13.6341], // Dabondi
      [9.5984, -13.6052], // Matoto Rond-point
    ],
    stops: ['ARR-KAL-01', 'ARR-MAD-02', 'ARR-DAB-03', 'ARR-MAT-04'],
  },
  {
    id: 'l-02',
    code: 'L-02',
    name: 'Dixinn Terrasse — Bambéto — Cosa — Enco5',
    colorHex: '#DC2626',
    originName: 'Dixinn Terrasse',
    destinationName: 'Enco 5 Rond-point',
    distanceKm: 14.8,
    estimatedMinutes: 40,
    activeVehicles: 26,
    coordinates: [
      [9.5381, -13.6821], // Dixinn
      [9.5612, -13.6511], // Belle-vue
      [9.5855, -13.6288], // Bambéto
      [9.6041, -13.6121], // Cosa
      [9.6215, -13.5954], // Enco 5
    ],
    stops: ['ARR-DIX-01', 'ARR-BAM-02', 'ARR-COS-03', 'ARR-ENC-04'],
  },
  {
    id: 'l-03',
    code: 'L-03',
    name: 'Sonfonia Université — Kagbélen ZI',
    colorHex: '#16A34A',
    originName: 'Université Général Lansana Conté (Sonfonia)',
    destinationName: 'Kagbélen Zone Industrielle',
    distanceKm: 12.4,
    estimatedMinutes: 32,
    activeVehicles: 19,
    coordinates: [
      [9.6421, -13.5781], // Sonfonia
      [9.6634, -13.5512], // Cimenterie
      [9.6891, -13.5218], // Kagbélen
    ],
    stops: ['ARR-SON-01', 'ARR-CIM-02', 'ARR-KAG-03'],
  },
  {
    id: 'l-04',
    code: 'L-04',
    name: 'Kaloum Almamya — Kipé — Lambanyi Plage',
    colorHex: '#D97706',
    originName: 'Kaloum Almamya',
    destinationName: 'Lambanyi Carrefour',
    distanceKm: 18.5,
    estimatedMinutes: 52,
    activeVehicles: 24,
    coordinates: [
      [9.5125, -13.7088], // Kaloum
      [9.5412, -13.6745], // Donka
      [9.5812, -13.6423], // Hamdallaye
      [9.6089, -13.6189], // Kipé Centre
      [9.6385, -13.5872], // Lambanyi
    ],
    stops: ['ARR-ALM-01', 'ARR-DON-02', 'ARR-KIP-03', 'ARR-LAM-04'],
  },
];

const INITIAL_CONAKRY_STOPS: TransportStop[] = [
  { id: 's1', code: 'ARR-KAL-01', name: 'Gare Portuaire Kaloum', commune: 'Kaloum', latitude: 9.5092, longitude: -13.7122, isSheltered: true, dailyPassengers: 4200 },
  { id: 's2', code: 'ARR-MAD-02', name: 'Madina Grand Marché', commune: 'Matam', latitude: 9.5441, longitude: -13.6651, isSheltered: true, dailyPassengers: 11500 },
  { id: 's3', code: 'ARR-DAB-03', name: 'Dabondy Échangeur', commune: 'Matoto', latitude: 9.5712, longitude: -13.6341, isSheltered: false, dailyPassengers: 3100 },
  { id: 's4', code: 'ARR-MAT-04', name: 'Matoto Rond-point Central', commune: 'Matoto', latitude: 9.5984, longitude: -13.6052, isSheltered: true, dailyPassengers: 8900 },
  { id: 's5', code: 'ARR-DIX-01', name: 'Dixinn Terrasse Stade', commune: 'Dixinn', latitude: 9.5381, longitude: -13.6821, isSheltered: true, dailyPassengers: 2800 },
  { id: 's6', code: 'ARR-BAM-02', name: 'Rond-point Bambéto', commune: 'Ratoma', latitude: 9.5855, longitude: -13.6288, isSheltered: true, dailyPassengers: 7400 },
  { id: 's7', code: 'ARR-COS-03', name: 'Carrefour Cosa', commune: 'Ratoma', latitude: 9.6041, longitude: -13.6121, isSheltered: false, dailyPassengers: 6300 },
  { id: 's8', code: 'ARR-ENC-04', name: 'Enco 5 Rond-point', commune: 'Ratoma', latitude: 9.6215, longitude: -13.5954, isSheltered: true, dailyPassengers: 5100 },
  { id: 's9', code: 'ARR-SON-01', name: 'Sonfonia Campus Université', commune: 'Sonfonia', latitude: 9.6421, longitude: -13.5781, isSheltered: true, dailyPassengers: 9200 },
  { id: 's10', code: 'ARR-CIM-02', name: 'Cimenterie Poste de Péage', commune: 'Dubréka-Frontière', latitude: 9.6634, longitude: -13.5512, isSheltered: false, dailyPassengers: 3400 },
  { id: 's11', code: 'ARR-KAG-03', name: 'Kagbélen Terminal Logistique', commune: 'Kagbélen', latitude: 9.6891, longitude: -13.5218, isSheltered: true, dailyPassengers: 4600 },
  { id: 's12', code: 'ARR-ALM-01', name: 'Kaloum Almamya Banques', commune: 'Kaloum', latitude: 9.5125, longitude: -13.7088, isSheltered: true, dailyPassengers: 3800 },
  { id: 's13', code: 'ARR-DON-02', name: 'Donka Hôpital National', commune: 'Dixinn', latitude: 9.5412, longitude: -13.6745, isSheltered: true, dailyPassengers: 5400 },
  { id: 's14', code: 'ARR-KIP-03', name: 'Kipé Centre Commercial', commune: 'Ratoma', latitude: 9.6089, longitude: -13.6189, isSheltered: true, dailyPassengers: 4700 },
  { id: 's15', code: 'ARR-LAM-04', name: 'Lambanyi Marché', commune: 'Ratoma', latitude: 9.6385, longitude: -13.5872, isSheltered: false, dailyPassengers: 3900 },
];

export const NetworkMapView: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const polylinesLayerGroup = useRef<L.LayerGroup | null>(null);
  const markersLayerGroup = useRef<L.LayerGroup | null>(null);

  const [lines] = useState<TransportLine[]>(INITIAL_CONAKRY_LINES);
  const [stops, setStops] = useState<TransportStop[]>(INITIAL_CONAKRY_STOPS);
  const [selectedLine, setSelectedLine] = useState<TransportLine | null>(INITIAL_CONAKRY_LINES[0]);
  const [filterCommune, setFilterCommune] = useState<string>('TOUTES');
  const [showStopsModal, setShowStopsModal] = useState<boolean>(false);

  // New Stop Form State
  const [newStopCode, setNewStopCode] = useState('');
  const [newStopName, setNewStopName] = useState('');
  const [newStopCommune, setNewStopCommune] = useState('Matam');
  const [newStopLat, setNewStopLat] = useState('9.5500');
  const [newStopLng, setNewStopLng] = useState('-13.6600');
  const [newStopSheltered, setNewStopSheltered] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (leafletMap.current) return;

    // Centered on Conakry (Presqu'île de Kaloum -> Grand Conakry)
    const map = L.map(mapContainerRef.current, {
      center: [9.565, -13.64],
      zoom: 12,
      minZoom: 10,
      maxZoom: 18,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap AOTUC-SIG',
    }).addTo(map);

    polylinesLayerGroup.current = L.layerGroup().addTo(map);
    markersLayerGroup.current = L.layerGroup().addTo(map);
    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Update Layers when lines, stops, or selectedLine change
  useEffect(() => {
    if (!leafletMap.current || !polylinesLayerGroup.current || !markersLayerGroup.current) return;

    polylinesLayerGroup.current.clearLayers();
    markersLayerGroup.current.clearLayers();

    // 1. Draw Lines
    lines.forEach((line) => {
      const isSelected = selectedLine?.id === line.id;
      const polyline = L.polyline(line.coordinates, {
        color: line.colorHex,
        weight: isSelected ? 6 : 3.5,
        opacity: isSelected ? 0.95 : 0.65,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.bindTooltip(
        `<b>${line.code}</b>: ${line.name}<br/>Longueur: ${line.distanceKm} km • Durée: ~${line.estimatedMinutes} min`,
        { sticky: true }
      );

      polyline.on('click', () => {
        setSelectedLine(line);
      });

      polylinesLayerGroup.current?.addLayer(polyline);
    });

    // 2. Draw Stops
    const visibleStops = stops.filter(
      (s) => filterCommune === 'TOUTES' || s.commune === filterCommune
    );

    visibleStops.forEach((stop) => {
      const isPartOfSelected = selectedLine?.stops.includes(stop.code);

      const circle = L.circleMarker([stop.latitude, stop.longitude], {
        radius: isPartOfSelected ? 7 : 5,
        fillColor: isPartOfSelected ? '#FCD116' : '#FFFFFF',
        color: isPartOfSelected ? '#1E293B' : '#0284C7',
        weight: isPartOfSelected ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.9,
      });

      circle.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <div style="font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
            Arrêt ${stop.code} — ${stop.name}
          </div>
          <div>Commune: <b>${stop.commune}</b></div>
          <div>Équipement: <b>${stop.isSheltered ? 'Abribus AOTUC' : 'Potelet simple'}</b></div>
          <div>Affluence: <b>~${stop.dailyPassengers.toLocaleString()} voyageurs/j</b></div>
          <div style="color: #64748b; font-size: 10px; margin-top: 4px;">GPS: ${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}</div>
        </div>
      `);

      markersLayerGroup.current?.addLayer(circle);
    });
  }, [lines, stops, selectedLine, filterCommune]);

  const handleZoomToLine = (line: TransportLine) => {
    setSelectedLine(line);
    if (!leafletMap.current) return;
    const bounds = L.latLngBounds(line.coordinates);
    leafletMap.current.fitBounds(bounds, { padding: [50, 50] });
  };

  const handleCreateStop = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(newStopLat);
    const lng = parseFloat(newStopLng);

    if (isNaN(lat) || isNaN(lng)) return;

    const newStop: TransportStop = {
      id: `s-${Date.now()}`,
      code: newStopCode.toUpperCase().trim(),
      name: newStopName.trim(),
      commune: newStopCommune,
      latitude: lat,
      longitude: lng,
      isSheltered: newStopSheltered,
      dailyPassengers: 1200,
    };

    setStops((prev) => [...prev, newStop]);
    setShowStopsModal(false);
    setNewStopCode('');
    setNewStopName('');

    if (leafletMap.current) {
      leafletMap.current.setView([lat, lng], 15);
    }
  };

  const handleExportGeoJson = () => {
    const geojson = {
      type: 'FeatureCollection',
      name: 'AOTUC_Reseau_Transport_Conakry',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features: [
        ...lines.map((l) => ({
          type: 'Feature',
          properties: {
            code: l.code,
            name: l.name,
            origin: l.originName,
            destination: l.destinationName,
            distanceKm: l.distanceKm,
            estimatedMinutes: l.estimatedMinutes,
            colorHex: l.colorHex,
          },
          geometry: {
            type: 'LineString',
            coordinates: l.coordinates.map(([lat, lng]) => [lng, lat]),
          },
        })),
        ...stops.map((s) => ({
          type: 'Feature',
          properties: {
            code: s.code,
            name: s.name,
            commune: s.commune,
            isSheltered: s.isSheltered,
            dailyPassengers: s.dailyPassengers,
          },
          geometry: {
            type: 'Point',
            coordinates: [s.longitude, s.latitude],
          },
        })),
      ],
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AOTUC_Reseau_Conakry_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalKm = lines.reduce((acc, l) => acc + l.distanceKm, 0).toFixed(1);
  const totalVehicles = lines.reduce((acc, l) => acc + l.activeVehicles, 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
            <h1 className="text-xl font-bold text-slate-900">
              Système d Information Géographique (SIG) — Réseau Conakry
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cartographie temps réel des couloirs de circulation, arrêts officiels et dessertes inter-communes AOTUC.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportGeoJson}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition flex items-center space-x-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter GeoJSON</span>
          </button>
          <button
            onClick={() => setShowStopsModal(true)}
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvel Arrêt</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <RouteIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Lignes Officielles</div>
            <div className="text-lg font-bold text-slate-900">{lines.length} Couloirs</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Arrêts Référencés</div>
            <div className="text-lg font-bold text-slate-900">{stops.length} Stations</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Linéaire Total</div>
            <div className="text-lg font-bold text-slate-900">{totalKm} km</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Véhicules Actifs</div>
            <div className="text-lg font-bold text-slate-900">{totalVehicles} Unités</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Map & Route Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Container (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Map Toolbar */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-slate-500" />
                <span>Filtre Commune :</span>
              </span>
              <select
                value={filterCommune}
                onChange={(e) => setFilterCommune(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="TOUTES">Toutes les Communes</option>
                <option value="Kaloum">Kaloum</option>
                <option value="Dixinn">Dixinn</option>
                <option value="Matam">Matam</option>
                <option value="Ratoma">Ratoma</option>
                <option value="Matoto">Matoto</option>
                <option value="Sonfonia">Sonfonia</option>
              </select>
            </div>

            <div className="flex items-center space-x-4 text-[11px] text-slate-500">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                <span>Autoroute Fidel Castro</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
                <span>Axe Le Prince</span>
              </div>
            </div>
          </div>

          {/* Leaflet Map DOM Node */}
          <div ref={mapContainerRef} className="w-full h-[520px] z-0" />
        </div>

        {/* Route Details & Stop Sequence (1 Column) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span>Sélection de la Ligne</span>
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {lines.length} Dispos
              </span>
            </div>

            {/* Line Selection Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {lines.map((l) => {
                const isSelected = selectedLine?.id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => handleZoomToLine(l)}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: l.colorHex }}
                      >
                        {l.code}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {l.distanceKm} km
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-800 mt-1 truncate">
                      {l.name}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Line Inspector */}
            {selectedLine && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900">
                    Fiche Technique : {selectedLine.code}
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Exploitation Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center space-x-1">
                      <Compass className="w-3 h-3 text-slate-400" />
                      <span>Longueur</span>
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">{selectedLine.distanceKm} km</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Temps Moyen</span>
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">~{selectedLine.estimatedMinutes} min</div>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <div className="text-slate-500 text-[11px]">
                    <b className="text-slate-700">Origine :</b> {selectedLine.originName}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    <b className="text-slate-700">Destination :</b> {selectedLine.destinationName}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    <b className="text-slate-700">Parc affecté :</b> {selectedLine.activeVehicles} minibus/taxis autorisés
                  </div>
                </div>

                {/* Stop Sequence */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[11px] font-bold text-slate-700 mb-2">
                    Arrêts Clés Desservis ({selectedLine.stops.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedLine.stops.map((stopCode, idx) => {
                      const stopDetail = stops.find((s) => s.code === stopCode);
                      return (
                        <div
                          key={stopCode}
                          className="flex items-center space-x-2 text-xs bg-white p-2 rounded border border-slate-200"
                        >
                          <div className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </div>
                          <div className="flex-1 truncate">
                            <span className="font-semibold text-slate-800">
                              {stopDetail?.name || stopCode}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              ({stopDetail?.commune || 'Conakry'})
                            </span>
                          </div>
                          {stopDetail?.isSheltered && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 font-semibold px-1 rounded">
                              Abri
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span>Données géospatiales certifiées par la Direction Technique AOTUC.</span>
          </div>
        </div>
      </div>

      {/* Modal: Create Stop */}
      {showStopsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Référencer un Nouvel Arrêt Officiel</span>
              </h3>
              <button
                onClick={() => setShowStopsModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStop} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Code Arrêt (Identifiant unique)</label>
                <input
                  type="text"
                  required
                  placeholder="ex: ARR-MAT-05"
                  value={newStopCode}
                  onChange={(e) => setNewStopCode(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom de la Station / Carrefour</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Rond-point Dabompa"
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Commune</label>
                  <select
                    value={newStopCommune}
                    onChange={(e) => setNewStopCommune(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="Kaloum">Kaloum</option>
                    <option value="Dixinn">Dixinn</option>
                    <option value="Matam">Matam</option>
                    <option value="Ratoma">Ratoma</option>
                    <option value="Matoto">Matoto</option>
                    <option value="Sonfonia">Sonfonia</option>
                    <option value="Dubréka-Frontière">Dubréka-Frontière</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStopSheltered}
                      onChange={(e) => setNewStopSheltered(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold text-slate-700">Abribus Aménagé</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Latitude WGS84</label>
                  <input
                    type="text"
                    required
                    value={newStopLat}
                    onChange={(e) => setNewStopLat(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Longitude WGS84</label>
                  <input
                    type="text"
                    required
                    value={newStopLng}
                    onChange={(e) => setNewStopLng(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowStopsModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700"
                >
                  Enregistrer l Arrêt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkMapView;