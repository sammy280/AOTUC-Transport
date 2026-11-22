export interface CommuneConfig {
  code: string;
  name: string;
  administrativeOrigin: string;
  description: string;
}

export const OFFICIAL_COMMUNES: CommuneConfig[] = [
  {
    code: 'KLM',
    name: 'Kaloum',
    administrativeOrigin: 'Ancienne commune',
    description: 'Centre administratif et des affaires',
  },
  {
    code: 'DXN',
    name: 'Dixinn',
    administrativeOrigin: 'Ancienne commune',
    description: 'Commune universitaire et résidentielle',
  },
  {
    code: 'MTM',
    name: 'Matam',
    administrativeOrigin: 'Ancienne commune',
    description: 'Commune commerciale et portuaire',
  },
  {
    code: 'RTM',
    name: 'Ratoma',
    administrativeOrigin: 'Ancienne commune',
    description: 'Grande commune résidentielle et axes routiers',
  },
  {
    code: 'MTT',
    name: 'Matoto',
    administrativeOrigin: 'Ancienne commune',
    description: 'Plus grande commune urbaine de Conakry',
  },
  {
    code: 'KSS',
    name: 'Kassa',
    administrativeOrigin: 'Ancienne commune – Îles de Los',
    description: 'Îles de Loos',
  },
  {
    code: 'GBS',
    name: 'Gbessia',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Aéroport International Ahmed Sékou Touré et carrefours stratégiques',
  },
  {
    code: 'TMB',
    name: 'Tombolia',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Zone résidentielle et axes de transit Matoto-Coyah',
  },
  {
    code: 'LBN',
    name: 'Lambanyi',
    administrativeOrigin: 'Nouvelle – détachée de Ratoma',
    description: 'Zone côtière résidentielle et commerciale nord',
  },
  {
    code: 'SNF',
    name: 'Sonfonia',
    administrativeOrigin: 'Nouvelle – détachée de Ratoma',
    description: 'Pôle universitaire et résidentiel nord-est',
  },
  {
    code: 'KGB',
    name: 'Kagbélen',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Zone industrielle et échangeur autoroutier',
  },
  {
    code: 'SNY',
    name: 'Sanoyah',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Zone urbaine et périurbaine orientale',
  },
  {
    code: 'MNH',
    name: 'Manéah',
    administrativeOrigin: 'Nouvelle – détachée de Matoto / Coyah',
    description: 'Bordure métropolitaine et carrefour vers Coyah/l’intérieur',
  },
];

export const CONAKRY_COMMUNES = OFFICIAL_COMMUNES.map((c) => c.name);
