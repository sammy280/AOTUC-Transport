import { z } from 'zod';

export const syncPullSchema = z.object({
  lastSyncTimestamp: z.string().datetime().optional(),
  communeId: z.string().optional(),
  appVersion: z.string().default('2.0.0'),
});

export const syncPushItemSchema = z.object({
  clientGeneratedId: z.string().uuid('Identifiant client UUID obligatoire.'),
  entityType: z.enum(['DRIVER', 'VEHICLE', 'OWNER'], {
    errorMap: () => ({ message: 'Type d entité non valide (DRIVER, VEHICLE, OWNER).' }),
  }),
  payload: z.record(z.any()),
  createdOfflineAt: z.string().datetime(),
});

export const syncPushSchema = z.object({
  deviceId: z.string().min(3).max(100),
  items: z.array(syncPushItemSchema).min(1, 'La file de synchronisation doit contenir au moins un élément.'),
});
