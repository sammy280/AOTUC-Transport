/**
 * Centralized Permission Matrix & Role Mapping
 * Official Guinea AOTUC Transport System v2.0
 * 
 * Defines all granular permission keys and enforces strict separation of duties:
 * - Super Administrateur (DSI): User management, security audit, system settings. NO business approvals, NO credential issuance.
 * - Directeur Général (L3): Executive reports, Level 3 final approval, badge & licence issuance. NO audit tampering, NO user management.
 * - Chef de Service (L2): Territorial L2 review, forward to L3, return with comment, SMS. Strictly scoped to assigned commune.
 * - Agent de Terrain (L1): Driver & vehicle enrolment, document upload & magic-byte check, submit to L2. Strictly scoped to commune.
 * - Distributeur Agréé: Ticket sales, GNF cash/momo payment recording, view own sales. NO driver records, NO ledger edits.
 */

export const PERMISSIONS = {
  // 1. User & Account Administration (DSI only)
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DEACTIVATE: 'users.deactivate',
  ROLES_MANAGE: 'roles.manage',
  SYSTEM_SETTINGS_MANAGE: 'system.settings.manage',
  SYSTEM_HEALTH_READ: 'system.health.read',

  // 2. Audit & Cryptographic Monitoring
  AUDIT_READ: 'audit.read',
  AUDIT_VERIFY: 'audit.verify',

  // 3. Enrolment & Document Verification
  DRIVERS_CREATE: 'drivers.create',
  DRIVERS_READ: 'drivers.read',
  DRIVERS_UPDATE: 'drivers.update',
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_VERIFY: 'documents.verify',

  // 4. Dossier Validation & Approval Workflow
  APPLICATIONS_SUBMIT: 'applications.submit',
  APPLICATIONS_REVIEW_L2: 'applications.review_l2',
  APPLICATIONS_APPROVE_L2: 'applications.approve_l2',
  APPLICATIONS_APPROVE_L3: 'applications.approve_l3',
  APPLICATIONS_REJECT: 'applications.reject',
  APPLICATIONS_RETURN: 'applications.return',

  // 5. Official Credentials & Securing
  CREDENTIALS_ISSUE: 'credentials.issue',
  CREDENTIALS_VERIFY: 'credentials.verify',
  CREDENTIALS_READ: 'credentials.read',

  // 6. Ticketing & Financial Operations
  TICKETS_SELL: 'tickets.sell',
  TRANSACTIONS_READ_OWN: 'transactions.read_own',
  TRANSACTIONS_READ_ALL: 'transactions.read_all',
  TRANSACTIONS_CREATE: 'transactions.create',
  TRANSACTIONS_REVERSE: 'transactions.reverse',
  FINANCIAL_REPORTS_READ: 'financial_reports.read',
};

/**
 * Strict Role-to-Permissions Mapping
 * Enforces least-privilege access and absolute separation of duties.
 */
export const ROLE_PERMISSIONS = {
  // Directeur Général (L3)
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
    PERMISSIONS.SYSTEM_HEALTH_READ,
  ],

  // Super Administrateur (DSI)
  SUPER_ADMIN: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DEACTIVATE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
    PERMISSIONS.SYSTEM_HEALTH_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_VERIFY,
    PERMISSIONS.CREDENTIALS_VERIFY,
    // EXCLUDED: APPLICATIONS_APPROVE_*, CREDENTIALS_ISSUE, TICKETS_SELL, DRIVERS_CREATE
  ],

  // Chef de Service Territorial (L2) — Scoped to Commune
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

  // Agent de Terrain (L1) — Scoped to Commune & Own Submissions
  AGENT_TERRAIN: [
    PERMISSIONS.DRIVERS_CREATE,
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.DRIVERS_UPDATE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.APPLICATIONS_SUBMIT,
  ],

  // Distributeur Agréé (Billetterie & Caisse POS)
  DISTRIBUTEUR: [
    PERMISSIONS.TICKETS_SELL,
    PERMISSIONS.TRANSACTIONS_READ_OWN,
    PERMISSIONS.TRANSACTIONS_CREATE,
    PERMISSIONS.TRANSACTIONS_REVERSE,
  ],

  // Délégué Syndical (Consultation des chauffeurs immatriculés)
  SYNDICAT: [
    PERMISSIONS.DRIVERS_READ,
    PERMISSIONS.CREDENTIALS_VERIFY,
  ],
};

/**
 * Returns list of unique permissions for a set of role names.
 * @param {string[]} roles Array of role names
 * @returns {string[]} Unique permission strings
 */
export function getPermissionsForRoles(roles = []) {
  const permSet = new Set();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role] || [];
    for (const p of perms) {
      permSet.add(p);
    }
  }
  return Array.from(permSet);
}

/**
 * Checks if a given role array has a specific permission.
 * @param {string[]} roles Array of role names
 * @param {string} permission Permission key to check
 * @returns {boolean}
 */
export function hasPermission(roles = [], permission) {
  const perms = getPermissionsForRoles(roles);
  return perms.includes(permission);
}

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRoles,
  hasPermission,
};
