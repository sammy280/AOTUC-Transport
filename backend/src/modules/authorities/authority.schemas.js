import { z } from 'zod';

const phoneRegex = /^(\+224|00224)?\s*[6][12567]\d{7}$/;

export const createAuthoritySchema = z.object({
  fullName: z
    .string({ required_error: 'Le nom complet de l’autorité est obligatoire.' })
    .trim()
    .min(2, 'Le nom doit comporter au moins 2 caractères.')
    .max(150, 'Le nom ne doit pas dépasser 150 caractères.'),
  fonction: z
    .string({ required_error: 'La fonction ou titre officiel est obligatoire.' })
    .trim()
    .min(2, 'La fonction doit comporter au moins 2 caractères.')
    .max(100, 'La fonction ne doit pas dépasser 100 caractères.'),
  institution: z
    .string({ required_error: 'L’institution ou service de rattachement est obligatoire.' })
    .trim()
    .min(2, 'L’institution doit comporter au moins 2 caractères.')
    .max(150, 'L’institution ne doit pas dépasser 150 caractères.'),
  service: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal('')),
  phoneNumber: z
    .string()
    .transform((v) => (v ? v.replace(/[\s\-\.\(\)]/g, '') : v))
    .refine((v) => !v || phoneRegex.test(v), {
      message: 'Format de numéro guinéen invalide (+224 6XX XX XX XX).',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Adresse email invalide.')
    .max(100)
    .optional()
    .nullable()
    .or(z.literal('')),
  cniNumber: z
    .string()
    .trim()
    .max(50, 'Le numéro de CNI ne doit pas dépasser 50 caractères.')
    .optional()
    .nullable()
    .or(z.literal('')),
  badgeNumber: z
    .string()
    .trim()
    .max(50, 'Le numéro de matricule ou badge ne doit pas dépasser 50 caractères.')
    .optional()
    .nullable()
    .or(z.literal('')),
  communeId: z
    .string()
    .uuid('Identifiant de commune invalide.')
    .optional()
    .nullable()
    .or(z.literal('')),
  status: z
    .enum(['ACTIF', 'EN_ATTENTE_VALIDATION', 'SUSPENDU', 'INACTIF'])
    .optional()
    .default('ACTIF'),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .or(z.literal('')),
  photoUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  documents: z
    .array(
      z.object({
        category: z.enum([
          'PHOTO_PORTRAIT',
          'CNI_RECTO',
          'CNI_VERSO',
          'AUTRE',
        ]),
        originalName: z.string().trim().max(255).optional(),
        mimeType: z.string().trim(),
        base64Data: z.string().min(1, 'Données base64 obligatoires.'),
        fileHashSha256: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

export const updateAuthoritySchema = createAuthoritySchema.partial();

export const queryAuthoritiesSchema = z.object({
  search: z.string().trim().optional(),
  communeId: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['ACTIF', 'EN_ATTENTE_VALIDATION', 'SUSPENDU', 'INACTIF', 'ALL']).optional(),
  institution: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
