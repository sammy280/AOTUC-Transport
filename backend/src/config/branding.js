/**
 * AOTUC Official System-Wide Branding Configuration (Backend)
 * Source of Truth: Official Institutional Identity & Charter
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

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
  authorityTitle: 'Directeur Général de l AOTUC',

  colors: {
    primaryNavy: '#0B1E36',
    accentYellow: '#FCD116',
    accentRed: '#CE1126',
    accentGreen: '#009460',
    mottoSky: '#38BDF8',
  },

  assets: {
    banner: path.join(ASSETS_DIR, 'aotuc-official-banner.jpg'),
    logo: path.join(ASSETS_DIR, 'aotuc-logo.png'),
    seal: path.join(ASSETS_DIR, 'aotuc-logo.png'),
    officialLogo: path.join(ASSETS_DIR, 'aotuc-logo.png'),
    headerBrand: path.join(ASSETS_DIR, 'aotuc-header-brand.png'),
    nationalCoatOfArms: path.join(ASSETS_DIR, 'aotuc-logo.png'),
  },
};

export default AOTUC_BRANDING;
