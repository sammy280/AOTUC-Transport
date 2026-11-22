import { CONAKRY_COMMUNES, OFFICIAL_COMMUNES } from '../../config/communes';

export interface TransportStop {
  id: string;
  code: string;
  name: string;
  commune: string;
  latitude: number;
  longitude: number;
  isSheltered: boolean;
  dailyPassengers: number;
}

export interface TransportLine {
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

export const INITIAL_CONAKRY_LINES: TransportLine[] = [
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

export const INITIAL_CONAKRY_STOPS: TransportStop[] = [
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
  { id: 's15', code: 'ARR-LAM-04', name: 'Lambanyi Marché', commune: 'Lambanyi', latitude: 9.6385, longitude: -13.5872, isSheltered: false, dailyPassengers: 3900 },
  { id: 's16', code: 'ARR-GBE-01', name: 'Gbessia Aéroport Rond-Point', commune: 'Gbessia', latitude: 9.5780, longitude: -13.6150, isSheltered: true, dailyPassengers: 6800 },
  { id: 's17', code: 'ARR-TMB-01', name: 'Tombolia Transit Matoto', commune: 'Tombolia', latitude: 9.6150, longitude: -13.5650, isSheltered: false, dailyPassengers: 3200 },
  { id: 's18', code: 'ARR-SNY-01', name: 'Sanoyah Km 36', commune: 'Sanoyah', latitude: 9.6700, longitude: -13.4800, isSheltered: true, dailyPassengers: 4100 },
  { id: 's19', code: 'ARR-MNH-01', name: 'Manéah Carrefour Préfecture', commune: 'Manéah', latitude: 9.6950, longitude: -13.4450, isSheltered: false, dailyPassengers: 2900 },
  { id: 's20', code: 'ARR-KSS-01', name: 'Kassa Port Îles de Los', commune: 'Kassa', latitude: 9.4850, longitude: -13.7500, isSheltered: true, dailyPassengers: 1100 },
];

export { CONAKRY_COMMUNES, OFFICIAL_COMMUNES };
