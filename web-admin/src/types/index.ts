export type RoleType = 
  | 'SUPER_ADMIN' 
  | 'DIRECTOR' 
  | 'CHEF_SERVICE' 
  | 'AGENT_TERRAIN' 
  | 'SYNDICAT' 
  | 'DISTRIBUTEUR'
  | 'AUTHORITY'
  | 'IT';

export type ValidationStatus = 
  | 'BROUILLON' 
  | 'SOUMIS_NIVEAU2' 
  | 'EN_ATTENTE_NIVEAU3' 
  | 'RETOURNE_POUR_CORRECTION' 
  | 'VALIDE' 
  | 'REJETE';

export type ValidationAction = 
  | 'SUBMIT' 
  | 'FORWARD_TO_L3' 
  | 'RETURN_FOR_CORRECTION' 
  | 'APPROVE_FINAL' 
  | 'REJECT';

export interface UserContext {
  id: string;
  name: string;
  role: RoleType;
  roleLabel: string;
  communeName: string;
  communeId: string | null;
  email?: string;
  phoneNumber?: string;
  jobTitle?: string;
  avatarUrl?: string | null;
}

export interface MetricSummary {
  totalDrivers: number;
  totalVehicles: number;
  activeBadges: number;
  pendingValidation: number;
  communeBreakdown: { name: string; drivers: number; vehicles: number }[];
}

export interface ValidationItem {
  id: string;
  requestNumber: string;
  entityType: 'DRIVER_ENROLMENT' | 'VEHICLE_ENROLMENT' | 'OWNER_ENROLMENT';
  applicantName: string;
  applicantPhone: string;
  targetDetails: string;
  communeName: string;
  currentLevel: 1 | 2 | 3;
  status: ValidationStatus;
  currentStatus?: ValidationStatus;
  communeId?: string | null;
  submitterId?: string;
  targetEntityId?: string;
  submittedAt: string;
  submitterName: string;
  documents: { category: string; label: string; url: string }[];
  history: {
    reviewerName: string;
    role: string;
    action: ValidationAction;
    comment: string | null;
    timestamp: string;
  }[];
  latestComment?: string | null;
  latestReviewerName?: string | null;
  latestAction?: ValidationAction | null;
  targetEntity?: any;
}

export type NotificationCategory = 'VALIDATION' | 'SECURITY' | 'TICKETING' | 'SMS' | 'SYSTEM';
export type NotificationPriority = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  linkTab?: 'dashboard' | 'field' | 'validation' | 'enrolment' | 'unions' | 'mapping' | 'badges' | 'licences' | 'ticketing' | 'audit';
  metadata?: Record<string, string>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

// ==============================================================================
// FIELD OPERATIONS & MISSIONS (PHASE 6)
// ==============================================================================

export type FieldAssignmentStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_REPORT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface FieldAssignmentProgress {
  targetPeople: number;
  actualPeople: number;
  peoplePercent: number;
  targetVehicles: number;
  actualVehicles: number;
  vehiclesPercent: number;
  overallPercent: number;
}

export type AgentAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface AgentItem {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  employeeNumber?: string | null;
  address?: string | null;
  accountStatus: AgentAccountStatus;
  isActive: boolean;
  communeId?: string | null;
  commune?: { id: string; code: string; name: string } | null;
  assignedTeamId?: string | null;
  assignedTeam?: { id: string; code: string; name: string } | null;
  roles?: string[];
  missionsCount?: number;
  inspectionsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type CheckpointStatus = 'NOT_CHECKED' | 'YES' | 'NO' | 'CONFORME' | 'NON_CONFORME';
export type InspectionOutcome = 'NOT_ASSESSED' | 'CONFORME' | 'NON_CONFORME' | 'AVERTISSEMENT' | 'INFRACTION' | 'AVEC_RESERVES' | 'IMMOBILISATION';

export interface FieldInspectionItem {
  id: string;
  reference: string;
  assignmentId: string;
  assignment?: {
    id: string;
    reference: string;
    title: string;
    status: FieldAssignmentStatus;
    locationName?: string;
  };
  agentUserId: string;
  agentUser?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string | null;
    phoneNumber?: string;
    avatarUrl?: string | null;
  };
  communeId: string;
  commune?: { id: string; code: string; name: string };
  targetType: string;
  plateNumber?: string | null;
  licenseNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  vehicleType?: string | null;
  hasValidLicense: CheckpointStatus;
  hasMunicipalSticker: CheckpointStatus;
  hasTechnicalControl: CheckpointStatus;
  isAuthorizedRoute: CheckpointStatus;
  hasSafetyEquipment: CheckpointStatus;
  outcome: InspectionOutcome;
  violations?: any;
  observations?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  inspectedAt: string;
  createdAt: string;
  documents?: Array<{
    id: string;
    category: string;
    fileUrl: string;
    mimeType: string;
  }>;
}

export type MissionReportStatus = 'DRAFT' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';

export interface MissionReportObservation {
  id: string;
  authorId: string;
  authorName: string;
  employeeNumber?: string | null;
  text: string;
  photos?: string[];
  timestamp: string;
}

export interface MissionReportVersionItem {
  id: string;
  reportId: string;
  versionNumber: number;
  summary: string;
  objectivesAssessed?: string | null;
  inspectionsCount: number;
  violationsCount: number;
  observations?: string | null;
  recommendations?: string | null;
  conclusions?: string | null;
  contributors?: any;
  evidencePhotos?: any;
  submittedByUserId: string;
  submittedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string | null;
  };
  submittedAt: string;
  reviewedByUserId?: string | null;
  reviewedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  decision?: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | null;
  supervisorComments?: string | null;
  decisionAt?: string | null;
}

export interface MissionReportItem {
  id: string;
  reference: string;
  assignmentId: string;
  assignment?: {
    id: string;
    reference: string;
    title: string;
    status: FieldAssignmentStatus;
    commune?: { id: string; code: string; name: string };
  };
  leadAuthorId: string;
  leadAuthor?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string | null;
    phoneNumber?: string;
  };
  currentVersion: number;
  status: MissionReportStatus;
  summary: string;
  objectivesAssessed?: string | null;
  inspectionsCount: number;
  violationsCount: number;
  observations?: string | null;
  recommendations?: string | null;
  conclusions?: string | null;
  contributors?: any;
  evidencePhotos?: any;
  supervisorNotes?: string | null;
  reviewedByUserId?: string | null;
  reviewedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: MissionReportVersionItem[];
}

export interface FieldAssignmentItem {
  id: string;
  reference: string;
  title: string;
  communeId: string;
  commune?: { id: string; code: string; name: string };
  locationName: string;
  latitude?: number | null;
  longitude?: number | null;
  assignedUserId?: string | null;
  assignedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    avatarUrl?: string | null;
    employeeNumber?: string | null;
    jobTitle?: string | null;
  } | null;
  assignedAgents?: Array<{
    id: string;
    assignmentId?: string;
    agentUserId: string;
    roleInMission: string;
    assignedAt?: string;
    agentUser?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phoneNumber?: string;
      employeeNumber?: string | null;
      avatarUrl?: string | null;
      jobTitle?: string | null;
    };
  }>;
  cancelledByUserId?: string | null;
  cancelledByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  supervisorId: string;
  supervisor?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  teamId?: string | null;
  team?: {
    id: string;
    code: string;
    name: string;
  } | null;
  startDate: string;
  endDate?: string | null;
  targetPeople: number;
  targetVehicles: number;
  instructions?: string | null;
  supervisorNotes?: string | null;
  status: FieldAssignmentStatus;
  createdAt: string;
  updatedAt: string;
  progress?: FieldAssignmentProgress;
  inspections?: FieldInspectionItem[];
  missionReport?: MissionReportItem | null;
}

export interface FieldReceiptItem {
  id: string;
  receiptNumber: string;
  assignmentId?: string | null;
  assignment?: {
    id: string;
    reference: string;
    title: string;
    locationName: string;
    startDate?: string;
  } | null;
  agentUserId: string;
  agentUser?: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    email?: string;
  };
  personId?: string | null;
  person?: {
    id: string;
    firstName: string;
    lastName: string;
    nin: string;
    phoneNumber: string;
    address?: string | null;
  } | null;
  vehicleId?: string | null;
  vehicle?: {
    id: string;
    plateNumber: string;
    registrationCardNumber?: string;
    make?: string;
    model?: string;
    vehicleType?: string;
  } | null;
  communeId?: string | null;
  commune?: { id: string; code: string; name: string } | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  issuedAt: string;
  createdAt: string;
}

export interface FieldDashboardSummary {
  totalAssignments: number;
  activeAssignments: number;
  completedAssignments: number;
  assignedAgentsCount: number;
  registrationsToday: number;
  todayBreakdown: {
    peopleToday: number;
    vehiclesToday: number;
  };
  targetsSummary: {
    targetPeople: number;
    actualPeople: number;
    peoplePercent: number;
    targetVehicles: number;
    actualVehicles: number;
    vehiclesPercent: number;
    overallPercent: number;
  };
  totalReceiptsIssued: number;
  communeBreakdown: {
    communeId: string;
    communeCode: string;
    communeName: string;
    activeAssignments: number;
    totalAssignments: number;
    targetPeople: number;
    actualPeople: number;
    targetVehicles: number;
    actualVehicles: number;
    completionRate: number;
  }[];
  timestamp: string;
}

// ==============================================================================
// TRANSPORT UNIONS / SYNDICATS MANAGEMENT
// ==============================================================================

export type UnionStatus =
  | 'ACTIF'
  | 'SUSPENDU'
  | 'EN_ATTENTE_VALIDATION'
  | 'REJETE';

export interface TransportUnionRecord {
  id: string;
  code: string;
  name: string;
  registrationNumber?: string | null;
  presidentName?: string | null;
  fonction?: string | null;
  photoUrl?: string | null;
  cniNumber?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  headquartersAddress?: string | null;
  logoUrl?: string | null;
  status: UnionStatus;
  communeId?: string | null;
  commune?: { id: string; code: string; name: string } | null;
  latitude?: number | null;
  longitude?: number | null;
  registeredByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: Array<{
    id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    category: string;
    createdAt: string;
    fileSizeBytes?: number;
  }>;
  _count?: {
    members: number;
    owners: number;
    users: number;
    documents?: number;
  };
  members?: Array<{
    id: string;
    drivingLicenseNumber: string;
    person?: {
      firstName: string;
      lastName: string;
      nin: string;
      phoneNumber: string;
      photoUrl?: string | null;
      commune?: { name: string };
    };
  }>;
  owners?: Array<{
    id: string;
    ownerType: string;
    businessName?: string | null;
    person?: {
      firstName: string;
      lastName: string;
      nin: string;
      phoneNumber: string;
      commune?: { name: string };
    };
  }>;
}
