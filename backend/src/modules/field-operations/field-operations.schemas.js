import { z } from 'zod';

export const FIELD_ASSIGNMENT_STATUSES = [
  'PLANNED',
  'DRAFT',
  'ASSIGNED',
  'IN_PROGRESS',
  'AWAITING_REPORT',
  'SUBMITTED',
  'APPROVED',
  'COMPLETED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'CANCELLED',
];

export const CHECKPOINT_STATES = ['NOT_CHECKED', 'CONFORME', 'NON_CONFORME'];
export const INSPECTION_OUTCOMES = ['NOT_ASSESSED', 'CONFORME', 'AVEC_RESERVES', 'NON_CONFORME', 'IMMOBILISATION'];
export const REPORT_DECISIONS = ['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'];
export const AGENT_MISSION_ROLES = ['LEAD', 'CONTRIBUTOR'];

export const createAssignmentSchema = z.object({
  title: z.string().min(3, 'Le titre de la mission doit comporter au moins 3 caractères.'),
  communeId: z.string().min(1, 'La commune de rattachement est requise.'),
  locationName: z.string().min(2, 'Le lieu de mission, station ou point d arrêt est requis.'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  leadAgentId: z.string().uuid().optional().nullable(),
  assignedAgents: z.array(z.object({
    userId: z.string().uuid(),
    role: z.enum(['LEAD', 'CONTRIBUTOR']).default('CONTRIBUTOR'),
  })).optional(),
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
  leadAgentId: z.string().uuid().optional().nullable(),
  assignedAgents: z.array(z.object({
    userId: z.string().uuid(),
    role: z.enum(['LEAD', 'CONTRIBUTOR']).default('CONTRIBUTOR'),
  })).optional(),
  teamId: z.string().uuid().optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional().nullable(),
  targetPeople: z.number().int().min(0).optional(),
  targetVehicles: z.number().int().min(0).optional(),
  instructions: z.string().optional().nullable(),
  supervisorNotes: z.string().optional().nullable(),
  status: z.enum(FIELD_ASSIGNMENT_STATUSES).optional(),
});

export const cancelMissionSchema = z.object({
  reason: z.string().min(3, 'Le motif d annulation écrit est obligatoire.'),
  supervisorNotes: z.string().optional().nullable(),
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

// --- AGENT MANAGEMENT SCHEMAS ---
export const createAgentSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit comporter au moins 2 caractères.'),
  lastName: z.string().min(2, 'Le nom de famille doit comporter au moins 2 caractères.'),
  phoneNumber: z.string().min(8, 'Numéro de téléphone requis.'),
  email: z.string().email('Adresse email invalide.').optional().nullable(),
  password: z.string().min(6, 'Le mot de passe doit comporter au moins 6 caractères.').optional(),
  jobTitle: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  communeId: z.string().optional().nullable(),
  assignedTeamId: z.string().uuid('Identifiant d équipe invalide.').optional().nullable(),
});

export const updateAgentSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phoneNumber: z.string().min(8).optional(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).optional(),
  jobTitle: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  communeId: z.string().optional().nullable(),
  assignedTeamId: z.string().uuid().optional().nullable(),
});

export const updateAgentStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
    reason: z.string().optional().nullable(),
  })
  .refine((data) => Boolean(data.status || data.accountStatus), {
    message: 'Le statut du compte (status ou accountStatus: ACTIVE, SUSPENDED, INACTIVE) est requis.',
    path: ['status'],
  });

export const queryAgentsSchema = z.object({
  communeId: z.string().optional(),
  teamId: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
  role: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
});

// --- FIELD INSPECTIONS SCHEMAS ---
export const createInspectionSchema = z.object({
  assignmentId: z.string().uuid('Identifiant de mission requis.').optional().nullable(),
  missionId: z.string().uuid('Identifiant de mission requis.').optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable(),
  personId: z.string().uuid().optional().nullable(),
  driverNin: z.string().optional().nullable(),
  driverLicenseNumber: z.string().optional().nullable(),
  vehiclePlate: z.string().optional().nullable(),
  driverName: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  plateNumber: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  vehicleType: z.string().optional().nullable(),
  targetType: z.string().optional().nullable(),

  checkpointVehiclePermit: z.string().optional().default('NOT_CHECKED'),
  checkpointInsurance: z.string().optional().default('NOT_CHECKED'),
  checkpointTechnicalVisit: z.string().optional().default('NOT_CHECKED'),
  checkpointDriverLicense: z.string().optional().default('NOT_CHECKED'),
  checkpointFireExtinguisher: z.string().optional().default('NOT_CHECKED'),
  checkpointFirstAidKit: z.string().optional().default('NOT_CHECKED'),
  checkpointVehicleCondition: z.string().optional().default('NOT_CHECKED'),
  checkpointSeatBelts: z.string().optional().default('NOT_CHECKED'),
  checkpointTires: z.string().optional().default('NOT_CHECKED'),
  checkpointLighting: z.string().optional().default('NOT_CHECKED'),

  hasValidLicense: z.string().optional(),
  hasMunicipalSticker: z.string().optional(),
  hasTechnicalControl: z.string().optional(),
  isAuthorizedRoute: z.string().optional(),
  hasSafetyEquipment: z.string().optional(),

  outcome: z.string().optional().default('NOT_ASSESSED'),
  infractions: z.any().optional().default([]),
  violations: z.any().optional(),
  notes: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().optional().nullable(),
  documents: z.array(z.object({
    documentType: z.string().optional(),
    category: z.string().optional(),
    fileUrl: z.string().min(1),
    mimeType: z.string().default('image/jpeg'),
    fileName: z.string().optional().nullable(),
    fileHash: z.string().optional().nullable(),
  })).optional().default([]),
});

export const queryInspectionsSchema = z.object({
  assignmentId: z.string().optional(),
  missionId: z.string().optional(),
  agentId: z.string().optional(),
  communeId: z.string().optional(),
  outcome: z.string().optional(),
  vehiclePlate: z.string().optional(),
  driverNin: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
});

// --- MISSION REPORTS SCHEMAS ---
export const submitReportSchema = z
  .object({
    assignmentId: z.string().uuid().optional().nullable(),
    missionId: z.string().uuid().optional().nullable(),
    summary: z.string().min(5).optional(),
    executiveSummary: z.string().min(5).optional(),
    objectivesAssessed: z.string().optional().nullable(),
    keyFindings: z.string().optional().nullable(),
    inspectionsTotal: z.number().int().min(0).optional().default(0),
    compliantTotal: z.number().int().min(0).optional().default(0),
    infractionsTotal: z.number().int().min(0).optional().default(0),
    observations: z.any().optional(),
    recommendations: z.string().optional().nullable(),
    conclusions: z.string().optional().nullable(),
    followUpActions: z.string().optional().nullable(),
  })
  .refine((d) => Boolean(d.summary || d.executiveSummary), {
    message: 'Le résumé du rapport (summary ou executiveSummary) doit comporter au moins 5 caractères.',
    path: ['summary'],
  });

export const reviewReportSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'], {
      errorMap: () => ({ message: 'Décision de revue invalide (APPROVED, REJECTED, CHANGES_REQUESTED).' }),
    }),
    reviewNotes: z.string().min(3).optional(),
    notes: z.string().min(3).optional(),
    supervisorComments: z.string().optional(),
  })
  .refine((d) => Boolean(d.reviewNotes || d.notes || d.supervisorComments), {
    message: 'Les observations et motifs de revue sont obligatoires (au moins 3 caractères).',
    path: ['notes'],
  });
