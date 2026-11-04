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
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.FINANCIAL_REPORTS_READ,
    PERMISSIONS.TRANSACTIONS_READ_ALL,
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
  ],
  CHEF_SERVICE: [
    PERMISSIONS.APPLICATIONS_REVIEW_L2,
    PERMISSIONS.APPLICATIONS_APPROVE_L2,
    PERMISSIONS.APPLICATIONS_REJECT,
    PERMISSIONS.APPLICATIONS_RETURN,
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.CREDENTIALS_READ,
  ],
  AGENT_TERRAIN: [
    PERMISSIONS.DRIVERS_CREATE,
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.DRIVERS_UPDATE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.APPLICATIONS_SUBMIT,
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
  ],
};

/**
 * Allowed navigation tabs per role
 */
export const ROLE_ALLOWED_TABS: Record<RoleType, string[]> = {
  DIRECTOR: [
    'dashboard',
    'validation',
    'badges',
    'licences',
    'mapping',
    'ticketing',
    'audit',
  ],
  SUPER_ADMIN: [
    'audit',
    'mapping',
  ],
  CHEF_SERVICE: [
    'dashboard',
    'validation',
    'enrolment',
    'badges',
    'licences',
    'mapping',
  ],
  AGENT_TERRAIN: [
    'enrolment',
    'validation',
  ],
  DISTRIBUTEUR: [
    'ticketing',
  ],
  SYNDICAT: [
    'dashboard',
    'mapping',
  ],
};

/**
 * Default starting tab for each role upon login
 */
export const ROLE_DEFAULT_TAB: Record<RoleType, string> = {
  DIRECTOR: 'dashboard',
  SUPER_ADMIN: 'audit',
  CHEF_SERVICE: 'dashboard',
  AGENT_TERRAIN: 'enrolment',
  DISTRIBUTEUR: 'ticketing',
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
