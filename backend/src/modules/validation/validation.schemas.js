import { z } from 'zod';

export const createValidationRequestSchema = z.object({
  entityType: z.enum(['DRIVER_ENROLMENT', 'VEHICLE_ENROLMENT', 'OWNER_ENROLMENT'], {
    required_error: 'Le type de dossier à valider est obligatoire.',
  }),
  targetEntityId: z.string().uuid('Identifiant d entité cible invalide.'),
  communeId: z.string().uuid('Commune invalide.').optional().nullable(),
});

export const transitionValidationSchema = z.object({
  action: z.enum([
    'SUBMIT',
    'FORWARD_TO_L3',
    'RETURN_FOR_CORRECTION',
    'APPROVE_FINAL',
    'REJECT',
  ], {
    required_error: 'L action de validation est obligatoire.',
  }),
  comment: z.string().optional().nullable(),
});
