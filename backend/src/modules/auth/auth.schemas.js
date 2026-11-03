import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string({
    required_error: "L'identifiant (téléphone ou email) est obligatoire.",
  }).min(3, "L'identifiant doit contenir au moins 3 caractères."),
  
  password: z.string({
    required_error: 'Le mot de passe est obligatoire.',
  }).min(6, 'Le mot de passe doit contenir au moins 6 caractères.'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string({
    required_error: 'Le jeton de rafraîchissement est obligatoire.',
  }),
});
