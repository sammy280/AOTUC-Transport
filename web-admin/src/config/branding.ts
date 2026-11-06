/**
 * AOTUC Official System-Wide Branding Configuration
 * Source of Truth: Official Institutional Identity & Charter
 */

export const AOTUC_BRANDING = {
  acronym: 'AOTUC',
  shortName: 'AOTUC',
  fullName: 'AUTORITÉ ORGANISATRICE DES TRANSPORTS URBAINS DE CONAKRY',
  nameFr: 'Autorité Organisatrice des Transports Urbains de Conakry',
  motto: 'Pour une Mobilité Urbaine Participative & Durable',
  mottoQuote: '« Pour une Mobilité Urbaine Participative & Durable »',
  country: 'République de Guinée',
  ministry: 'Ministère des Transports',
  systemVersion: 'Système officiel AOTUC v2.0',
  description:
    'Plateforme Numérique Intégrée d Organisation, d Immatriculation et de Régulation des Transports Urbains de Conakry.',

  // Official Brand Palette extracted directly from master banner
  colors: {
    primaryNavy: '#0B1E36',    // Deep Royal Navy background of master banner
    accentYellow: '#FCD116',   // National Golden Yellow
    accentRed: '#CE1126',      // National Crimson Red
    accentGreen: '#009460',    // National Emerald Green
    mottoSky: '#38BDF8',       // Soft Sky Blue / Cyan of official motto script
    slate900: '#0F172A',
  },

  // High-Resolution Official Assets
  assets: {
    banner: '/aotuc-official-banner.jpg',
    logo: '/aotuc-logo.png',
    seal: '/aotuc-logo.png',
    officialLogo: '/aotuc-logo.png',
    headerBrand: '/aotuc-header-brand.png',
    nationalCoatOfArms: '/aotuc-logo.png',
  },
} as const;

export default AOTUC_BRANDING;
