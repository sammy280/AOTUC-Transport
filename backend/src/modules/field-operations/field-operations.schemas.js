import { z } from 'zod';

export const FIELD_ASSIGNMENT_STATUSES = [
  'PLANNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export const createAssignmentSchema = z.object({
  title: z.string().min(3, 'Le titre de la mission doit comporter au moins 3 caractères.'),
  communeId: z.string().min(1, 'La commune de rattachement est requise.'),
  locationName: z.string().min(2, 'Le lieu de mission, station ou point d arrêt est requis.'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Date de début invalide.',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Date de fin invalide.',
  }).optional().nullable(),
  targetPeople: z.number().int().min(0, 'L objectif personnes doit être un entier positif.').default(0),
  targetVehicles: z.number().int().min(0, 'L objectif véhicules doit être un entier positif.').default(0),
  instructions: z.string().optional().nullable(),
  status: z.enum(FIELD_ASSIGNMENT_STATUSES).optional(),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(3).optional(),
  communeId: z.string().optional(),
  locationName: z.string().min(2).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional().nullable(),
  targetPeople: z.number().int().min(0).optional(),
  targetVehicles: z.number().int().min(0).optional(),
  instructions: z.string().optional().nullable(),
  supervisorNotes: z.string().optional().nullable(),
  status: z.enum(FIELD_ASSIGNMENT_STATUSES).optional(),
});

export const reassignAgentSchema = z.object({
  assignedUserId: z.string().uuid('Identifiant de l agent invalide.'),
  reason: z.string().min(2, 'Le motif de réassignation est requis.'),
  supervisorNotes: z.string().optional().nullable(),
});

export const updateStatusSchema = z.object({
  status: z.enum(FIELD_ASSIGNMENT_STATUSES, {
    errorMap: () => ({ message: 'Statut de mission invalide.' }),
  }),
  supervisorNotes: z.string().optional().nullable(),
});

export const createReceiptSchema = z.object({
  assignmentId: z.string().uuid().optional().nullable(),
  personId: z.string().uuid().optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable(),
  communeId: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createTeamSchema = z.object({
  code: z.string().min(2, 'Le code d équipe est requis.'),
  name: z.string().min(3, 'Le nom d équipe est requis.'),
  communeId: z.string().optional().nullable(),
  leaderId: z.string().uuid().optional().nullable(),
});

export const queryAssignmentsSchema = z.object({
  communeId: z.string().optional(),
  status: z.string().optional(),
  assignedUserId: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
});
