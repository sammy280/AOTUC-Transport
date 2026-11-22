import { z } from 'zod';

// Guinean phone normalization regex: +224 6XX XX XX XX
const phoneRegex = /^(\+224|00224)?[6][0-9]{8}$/;

export function normalizeGuineanPhone(phone) {
  let cleaned = String(phone || '').replace(/[\s\-\.\(\)]/g, '');
  if (cleaned.startsWith('00224')) {
    cleaned = '+' + cleaned.substring(2);
  } else if (!cleaned.startsWith('+224')) {
    cleaned = '+224' + cleaned;
  }
  return cleaned;
}

const gpsFields = {
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  gpsCapturedAt: z.string().optional().nullable(),
};

const inlineDocumentSchema = z.object({
  category: z.string(),
  originalName: z.string().optional(),
  mimeType: z.string().optional(),
  base64Data: z.string(),
  fileHashSha256: z.string().optional().nullable(),
});

export const registerDriverSchema = z
  .object({
    firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères.'),
    lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
    nin: z.string().min(5, 'Le Numéro d Identification National (NIN) est obligatoire.'),
    phoneNumber: z
      .string()
      .transform((v) => v.replace(/[\s\-\.\(\)]/g, ''))
      .refine((v) => phoneRegex.test(v), 'Numéro de téléphone guinéen invalide (ex: +224 620 12 34 56).'),
    emergencyContactPhone: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v && v.trim() ? v.replace(/[\s\-\.\(\)]/g, '') : null))
      .refine((v) => !v || phoneRegex.test(v), "Numéro de téléphone d'urgence guinéen invalide (ex: +224 620 12 34 56).")
      .transform((v) => (v ? normalizeGuineanPhone(v) : null)),
    emergencyContactName: z
      .string()
      .max(120, "Nom du contact d'urgence trop long.")
      .optional()
      .nullable()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    emergencyContactRelation: z
      .string()
      .max(80, 'Lien de parenté trop long.')
      .optional()
      .nullable()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    email: z.string().email('Adresse email invalide.').optional().or(z.literal('')).nullable(),
    dateOfBirth: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    communeId: z.string().optional().nullable(),
    commune: z.string().optional().nullable(),

    drivingLicenseNumber: z.string().min(4, 'Le numéro de permis de conduire est obligatoire.'),
    licenseCategory: z.enum(['A', 'B', 'C', 'C1', 'D', 'E']).default('B'),
    licenseExpirationDate: z.string({
      required_error: 'La date d expiration du permis est obligatoire.',
    }),
    unionId: z.string().uuid('Syndicat invalide.').optional().nullable(),
    documents: z.array(inlineDocumentSchema).optional(),
    ...gpsFields,
  })
  .refine(
    (data) =>
      !data.emergencyContactPhone ||
      normalizeGuineanPhone(data.emergencyContactPhone) !== normalizeGuineanPhone(data.phoneNumber),
    {
      message: "Le numéro d'urgence doit être différent du numéro de téléphone principal du chauffeur.",
      path: ['emergencyContactPhone'],
    }
  );

export const registerOwnerSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères.'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  nin: z.string().min(5, 'Le Numéro d Identification National (NIN) est obligatoire.'),
  phoneNumber: z
    .string()
    .transform((v) => v.replace(/[\s\-\.\(\)]/g, ''))
    .refine((v) => phoneRegex.test(v), 'Numéro de téléphone guinéen invalide.'),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  dateOfBirth: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  communeId: z.string().optional().nullable(),
  commune: z.string().optional().nullable(),

  ownerType: z.enum(['INDIVIDU', 'ENTREPRISE']).default('INDIVIDU'),
  businessName: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  unionId: z.string().uuid('Syndicat invalide.').optional().nullable(),
  documents: z.array(inlineDocumentSchema).optional(),
  ...gpsFields,
});

export const updateDriverSchema = z.object({
  unionId: z.string().uuid('Syndicat invalide.').optional().nullable(),
  licenseCategory: z.string().optional(),
  licenseExpirationDate: z.string().optional(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const updateOwnerSchema = z.object({
  unionId: z.string().uuid('Syndicat invalide.').optional().nullable(),
  ownerType: z.enum(['INDIVIDU', 'ENTREPRISE']).optional(),
  businessName: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const registerVehicleSchema = z.object({
  ownerId: z.string().uuid('Le propriétaire est obligatoire.'),
  plateNumber: z.string().min(4, 'Le numéro d immatriculation est obligatoire.'),
  registrationCardNumber: z.string().min(4, 'Le numéro de carte grise est obligatoire.'),
  chassisVin: z.string().min(6, 'Le numéro de châssis (VIN) est obligatoire.'),
  atrNumber: z.string().max(80, 'Numéro ATR trop long.').optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  aotucLicenseNumber: z.string().max(80, 'Numéro de licence AOTUC trop long.').optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null)),
  vehicleType: z.enum(['TAXI_COLLECTIF', 'MAGBANA_MINIBUS', 'BUS_URBAIN', 'MOTOTAXI', 'AUTRE']),
  make: z.string().min(2, 'La marque du véhicule est obligatoire.'),
  model: z.string().min(1, 'Le modèle du véhicule est obligatoire.'),
  year: z.coerce.number().int().min(1970).max(2030).optional().nullable(),
  seatingCapacity: z.coerce.number().int().min(1).max(120).optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  transportLineId: z.string().uuid().optional().nullable(),
  communeId: z.string().optional().nullable(),
  commune: z.string().optional().nullable(),
  inspectionCertificateNumber: z.string().optional().nullable(),
  inspectionCenter: z.string().optional().nullable(),
  inspectionExpirationDate: z.string().optional().nullable(),
  documents: z.array(inlineDocumentSchema).optional(),
  ...gpsFields,
});
