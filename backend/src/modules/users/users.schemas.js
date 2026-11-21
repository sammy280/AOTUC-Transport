import { z } from 'zod';
import { RoleType } from '@prisma/client';

const avatarUrlSchema = z
  .string()
  .trim()
  .max(4 * 1024 * 1024, 'La photo de profil est trop volumineuse.')
  .refine(
    (val) =>
      !val ||
      /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(val) ||
      /^https?:\/\/.+/i.test(val) ||
      /^\/.+/i.test(val),
    {
      message: 'Format de photo de profil invalide (JPEG, PNG ou WebP requis).',
    }
  )
  .optional()
  .nullable();

export const createUserSchema = z.object({
  firstName: z.string({
    required_error: 'Le prénom est obligatoire.',
  }).trim().min(2, 'Le prénom doit contenir au moins 2 caractères.'),

  lastName: z.string({
    required_error: 'Le nom est obligatoire.',
  }).trim().min(2, 'Le nom doit contenir au moins 2 caractères.'),

  email: z.string({
    required_error: "L'adresse email professionnelle est obligatoire.",
  }).trim().email("Format d'adresse email invalide (ex: agent.diallo@aotuc.gov.gn)."),

  phoneNumber: z.string({
    required_error: 'Le numéro de téléphone mobile est obligatoire.',
  }).trim().min(8, 'Le numéro de téléphone doit contenir au moins 8 chiffres.'),

  jobTitle: z.string().trim().max(120, 'La fonction ne doit pas dépasser 120 caractères.').optional().nullable(),

  avatarUrl: avatarUrlSchema,

  role: z.nativeEnum(RoleType, {
    errorMap: () => ({ message: 'Rôle RBAC invalide.' }),
  }),

  communeId: z.string().trim().optional().nullable(),
  communeCode: z.string().trim().max(30).optional().nullable(),

  password: z.string()
    .min(8, 'Le mot de passe doit comporter au moins 8 caractères.')
    .optional()
    .nullable(),

  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  email: z.string().trim().email("Format d'adresse email invalide.").optional().nullable(),
  phoneNumber: z.string().trim().min(8).optional(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  avatarUrl: avatarUrlSchema,
  role: z.nativeEnum(RoleType).optional(),
  communeId: z.string().trim().optional().nullable(),
  communeCode: z.string().trim().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string({
    required_error: 'Le nouveau mot de passe est obligatoire.',
  })
    .min(8, 'Le mot de passe doit comporter au moins 8 caractères.')
    .optional()
    .nullable(),
});
