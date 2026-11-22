export type RoleType = 
  | 'SUPER_ADMIN' 
  | 'DIRECTOR' 
  | 'CHEF_SERVICE' 
  | 'AGENT_TERRAIN' 
  | 'SYNDICAT' 
  | 'DISTRIBUTEUR';

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
  | 'PLANNED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
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
  } | null;
  supervisorId: string;
  supervisor?: {
    id: string;
    firstName: string;
    lastName: string;
  };
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
