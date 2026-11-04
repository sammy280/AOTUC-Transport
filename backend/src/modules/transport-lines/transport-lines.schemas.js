import { z } from 'zod';

export const createTransportLineSchema = z.object({
  code: z.string().min(2, 'Le code de ligne est obligatoire (ex: L-01).').max(10),
  name: z.string().min(3, 'Le nom de la ligne est obligatoire.'),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hexadécimale invalide (ex: #2563EB).').default('#2563EB'),
  description: z.string().optional().nullable(),
  originName: z.string().min(2, 'Le point de départ est obligatoire.'),
  destinationName: z.string().min(2, 'Le terminus est obligatoire.'),
  pathCoordinates: z.array(z.tuple([z.number(), z.number()])).min(2, 'Le tracé doit contenir au moins 2 coordonnées GPS.'),
});

export const createTransportStopSchema = z.object({
  code: z.string().min(2, 'Le code d arrêt est obligatoire (ex: ARR-KLM-01).').max(20),
  name: z.string().min(2, 'Le nom de l arrêt est obligatoire.'),
  communeId: z.string().uuid('Commune invalide.').optional().nullable(),
  latitude: z.number().min(9.0).max(10.2, 'La latitude doit se situer dans la région de Conakry (~9.5°N).'),
  longitude: z.number().min(-14.0).max(-13.0, 'La longitude doit se situer dans la région de Conakry (~ -13.6°W).'),
  isSheltered: z.boolean().default(false),
});

export const assignStopsToLineSchema = z.object({
  lineId: z.string().uuid(),
  stops: z.array(z.object({
    stopId: z.string().uuid(),
    stopOrder: z.number().int().min(1),
    direction: z.enum(['ALLER', 'RETOUR', 'CIRCULAIRE']).default('ALLER'),
  })).min(1, 'Au moins un arrêt doit être assigné à la ligne.'),
});
