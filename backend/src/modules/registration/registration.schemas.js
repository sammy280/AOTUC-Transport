import { z } from 'zod';

// Guinean phone normalization regex: +224 6XX XX XX XX
const phoneRegex = /^(\+224|00224)?[6][0-9]{8}$/;

export function normalizeGuineanPhone(phone) {
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  if (cleaned.startsWith('00224')) {
    cleaned = '+' + cleaned.substring(2);
  } else if (!cleaned.startsWith('+224')) {
    cleaned = '+224' + cleaned;
  }
  return cleaned;
}

export const registerDriverSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères.'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  nin: z.string().min(5, 'Le Numéro d Identification National (NIN) est obligatoire.'),
  phoneNumber: z.string().regex(phoneRegex, 'Numéro de téléphone guinéen invalide (ex: +224 620 12 34 56).'),
  email: z.string().email('Adresse email invalide.').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  communeId: z.string().uuid('Commune invalide.').optional(),
  
  drivingLicenseNumber: z.string().min(4, 'Le numéro de permis de conduire est obligatoire.'),
  licenseCategory: z.enum(['A', 'B', 'C', 'D', 'E']).default('B'),
  licenseExpirationDate: z.string({
    required_error: 'La date d expiration du permis est obligatoire.',
  }),
  unionId: z.string().uuid('Syndicat invalide.').optional().nullable(),
});

export const registerOwnerSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères.'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  nin: z.string().min(5, 'Le Numéro d Identification National (NIN) est obligatoire.'),
  phoneNumber: z.string().regex(phoneRegex, 'Numéro de téléphone guinéen invalide.'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  communeId: z.string().uuid().optional(),
  
  ownerType: z.enum(['INDIVIDU', 'ENTREPRISE']).default('INDIVIDU'),
  businessName: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
});

export const registerVehicleSchema = z.object({
  ownerId: z.string().uuid('Le propriétaire est obligatoire.'),
  plateNumber: z.string().min(4, 'Le numéro d immatriculation est obligatoire.'),
  registrationCardNumber: z.string().min(4, 'Le numéro de carte grise est obligatoire.'),
  chassisVin: z.string().min(6, 'Le numéro de châssis (VIN) est obligatoire.'),
  vehicleType: z.enum(['TAXI_COLLECTIF', 'MAGBANA_MINIBUS', 'BUS_URBAIN', 'MOTOTAXI', 'AUTRE']),
  make: z.string().min(2, 'La marque du véhicule est obligatoire.'),
  model: z.string().min(1, 'Le modèle du véhicule est obligatoire.'),
  year: z.coerce.number().int().min(1970).max(2030).optional(),
  seatingCapacity: z.coerce.number().int().min(1).max(120).optional(),
});
