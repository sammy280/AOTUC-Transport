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
  linkTab?: 'dashboard' | 'validation' | 'enrolment' | 'mapping' | 'badges' | 'licences' | 'ticketing' | 'audit';
  metadata?: Record<string, string>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}
