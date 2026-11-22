import { RoleType } from '../types';

/**
 * Granular Permissions matching backend matrix
 */
export const PERMISSIONS = {
  // Users & Administration
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DEACTIVATE: 'users.deactivate',
  ROLES_MANAGE: 'roles.manage',
  SYSTEM_SETTINGS_MANAGE: 'system.settings.manage',

  // Audit & Security
  AUDIT_READ: 'audit.read',
  AUDIT_VERIFY: 'audit.verify',

  // Drivers & Enrolment
  DRIVERS_CREATE: 'drivers.create',
  DRIVERS_READ: 'drivers.read',
  DRIVERS_UPDATE: 'drivers.update',
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_VERIFY: 'documents.verify',

  // Applications & Validation
  APPLICATIONS_SUBMIT: 'applications.submit',
  APPLICATIONS_REVIEW_L2: 'applications.review_l2',
  APPLICATIONS_APPROVE_L2: 'applications.approve_l2',
  APPLICATIONS_APPROVE_L3: 'applications.approve_l3',
  APPLICATIONS_REJECT: 'applications.reject',
  APPLICATIONS_RETURN: 'applications.return',

  // Official Credentials
  CREDENTIALS_ISSUE: 'credentials.issue',
  CREDENTIALS_VERIFY: 'credentials.verify',
  CREDENTIALS_READ: 'credentials.read',

  // Ticketing & Finance
  TICKETS_SELL: 'tickets.sell',
  TRANSACTIONS_READ_OWN: 'transactions.read_own',
  TRANSACTIONS_READ_ALL: 'transactions.read_all',
  TRANSACTIONS_CREATE: 'transactions.create',
  TRANSACTIONS_REVERSE: 'transactions.reverse',
  FINANCIAL_REPORTS_READ: 'financial_reports.read',

  // Field Operations & Missions (Phase 6)
  FIELD_ASSIGNMENTS_MANAGE: 'field_assignments.manage',
  FIELD_ASSIGNMENTS_READ: 'field_assignments.read',
  FIELD_PROGRESS_READ: 'field_progress.read',
  FIELD_RECEIPTS_CREATE: 'field_receipts.create',
  FIELD_RECEIPTS_READ: 'field_receipts.read',

  // Transport Unions / Syndicats Management
  UNIONS_MANAGE: 'unions.manage',
  UNIONS_READ: 'unions.read',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Role permissions mapping in frontend
 */
export const ROLE_PERMISSIONS: Record<RoleType, PermissionKey[]> = {
  DIRECTOR: [
    PERMISSIONS.APPLICATIONS_APPROVE_L3,
    PERMISSIONS.APPLICATIONS_REJECT,
    PERMISSIONS.APPLICATIONS_RETURN,
    PERMISSIONS.CREDENTIALS_ISSUE,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.CREDENTIALS_READ,
    PERMISSIONS.DRIVERS_CREATE,
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.DRIVERS_UPDATE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.FINANCIAL_REPORTS_READ,
    PERMISSIONS.TRANSACTIONS_READ_ALL,
    PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE,
    PERMISSIONS.FIELD_ASSIGNMENTS_READ,
    PERMISSIONS.FIELD_PROGRESS_READ,
    PERMISSIONS.FIELD_RECEIPTS_READ,
    PERMISSIONS.UNIONS_READ,
  ],
  SUPER_ADMIN: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DEACTIVATE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_VERIFY,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.DRIVERS_CREATE,
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.DRIVERS_UPDATE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE,
    PERMISSIONS.FIELD_ASSIGNMENTS_READ,
    PERMISSIONS.FIELD_PROGRESS_READ,
    PERMISSIONS.FIELD_RECEIPTS_READ,
    PERMISSIONS.UNIONS_MANAGE,
    PERMISSIONS.UNIONS_READ,
  ],
  CHEF_SERVICE: [
    PERMISSIONS.APPLICATIONS_REVIEW_L2,
    PERMISSIONS.APPLICATIONS_APPROVE_L2,
    PERMISSIONS.APPLICATIONS_REJECT,
    PERMISSIONS.APPLICATIONS_RETURN,
    PERMISSIONS.DRIVERS_CREATE,
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.DRIVERS_UPDATE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.CREDENTIALS_READ,
    PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE,
    PERMISSIONS.FIELD_ASSIGNMENTS_READ,
    PERMISSIONS.FIELD_PROGRESS_READ,
    PERMISSIONS.FIELD_RECEIPTS_READ,
    PERMISSIONS.UNIONS_READ,
  ],
  AGENT_TERRAIN: [
    PERMISSIONS.DRIVERS_CREATE,
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.DRIVERS_UPDATE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.APPLICATIONS_SUBMIT,
    PERMISSIONS.FIELD_ASSIGNMENTS_READ,
    PERMISSIONS.FIELD_RECEIPTS_CREATE,
    PERMISSIONS.FIELD_RECEIPTS_READ,
    PERMISSIONS.UNIONS_READ,
  ],
  DISTRIBUTEUR: [
    PERMISSIONS.TICKETS_SELL,
    PERMISSIONS.TRANSACTIONS_READ_OWN,
    PERMISSIONS.TRANSACTIONS_CREATE,
    PERMISSIONS.TRANSACTIONS_REVERSE,
  ],
  SYNDICAT: [
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.UNIONS_READ,
  ],
};

/**
 * Allowed navigation tabs per role
 */
export const ROLE_ALLOWED_TABS: Record<RoleType, string[]> = {
  DIRECTOR: [
    'dashboard',
    'field',
    'enrolment',
    'unions',
    'validation',
    'badges',
    'licences',
    'mapping',
    'ticketing',
    'audit',
  ],
  SUPER_ADMIN: [
    'dashboard',
    'field',
    'enrolment',
    'unions',
    'users',
    'audit',
    'mapping',
  ],
  CHEF_SERVICE: [
    'dashboard',
    'field',
    'validation',
    'enrolment',
    'unions',
    'badges',
    'licences',
    'mapping',
  ],
  AGENT_TERRAIN: [
    'dashboard',
    'field',
    'enrolment',
    'unions',
    'validation',
  ],
  DISTRIBUTEUR: [
    'dashboard',
    'ticketing',
  ],
  SYNDICAT: [
    'dashboard',
    'unions',
    'mapping',
  ],
};

/**
 * Default starting tab for each role upon login
 */
export const ROLE_DEFAULT_TAB: Record<RoleType, string> = {
  DIRECTOR: 'dashboard',
  SUPER_ADMIN: 'dashboard',
  CHEF_SERVICE: 'dashboard',
  AGENT_TERRAIN: 'dashboard',
  DISTRIBUTEUR: 'dashboard',
  SYNDICAT: 'dashboard',
};

export function hasRolePermission(role: RoleType, permission: PermissionKey): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export function isTabAllowed(role: RoleType, tabId: string): boolean {
  const allowed = ROLE_ALLOWED_TABS[role] || [];
  return allowed.includes(tabId);
}

export function getDefaultTab(role: RoleType): string {
  return ROLE_DEFAULT_TAB[role] || 'dashboard';
}
