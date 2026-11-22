import { z } from 'zod';

const phoneRegex = /^(\+224|00224)?\s*[6][12567]\d{7}$/;

export const createUnionSchema = z.object({
  name: z
    .string({ required_error: 'Le nom officiel du syndicat est obligatoire.' })
    .trim()
    .min(2, 'Le nom doit comporter au moins 2 caractères.')
    .max(150, 'Le nom ne doit pas dépasser 150 caractères.'),
  code: z
    .string({ required_error: "Le sigle / acronyme de l'organisation est obligatoire." })
    .trim()
    .min(2, 'Le sigle doit comporter au moins 2 caractères.')
    .max(20, 'Le sigle ne doit pas dépasser 20 caractères.')
    .transform((val) => val.toUpperCase()),
  registrationNumber: z
    .string()
    .trim()
    .min(2, "Le numéro d'agrément doit comporter au moins 2 caractères.")
    .max(100)
    .optional()
    .nullable()
    .or(z.literal('')),
  presidentName: z
    .string()
    .trim()
    .min(2, 'Le nom du responsable doit comporter au moins 2 caractères.')
    .max(150)
    .optional()
    .nullable()
    .or(z.literal('')),
  contactPhone: z
    .string()
    .transform((v) => (v ? v.replace(/[\s\-\.\(\)]/g, '') : v))
    .refine((v) => !v || phoneRegex.test(v), {
      message: 'Numéro de téléphone guinéen invalide (+224 6XX XX XX XX).',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  contactEmail: z
    .string()
    .trim()
    .email('Adresse email invalide.')
    .optional()
    .nullable()
    .or(z.literal('')),
  headquartersAddress: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  communeId: z
    .string()
    .uuid('Commune de rattachement invalide.')
    .optional()
    .nullable()
    .or(z.literal('')),
  logoUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  status: z
    .enum(['ACTIF', 'SUSPENDU', 'EN_ATTENTE_VALIDATION', 'REJETE'], {
      invalid_type_error: 'Statut de syndicat invalide.',
    })
    .default('ACTIF'),
});

export const updateUnionSchema = createUnionSchema.partial();

export const updateUnionStatusSchema = z.object({
  status: z.enum(['ACTIF', 'SUSPENDU', 'EN_ATTENTE_VALIDATION', 'REJETE'], {
    required_error: 'Le statut est obligatoire.',
    invalid_type_error: 'Statut de syndicat invalide.',
  }),
  reason: z
    .string()
    .trim()
    .max(500, 'Le motif ne doit pas dépasser 500 caractères.')
    .optional()
    .nullable(),
});

export const queryUnionsSchema = z.object({
  search: z.string().optional().default(''),
  status: z
    .enum(['ACTIF', 'SUSPENDU', 'EN_ATTENTE_VALIDATION', 'REJETE'])
    .optional(),
  communeId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
