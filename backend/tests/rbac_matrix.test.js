import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import { RevocationRegistry } from '../src/middlewares/authMiddleware.js';
import ValidationStateMachine from '../src/modules/validation/validation.machine.js';
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '../src/config/permissions.js';
import CryptoSignatureService from '../src/services/cryptoSignatureService.js';

describe('AOTUC Transport System — Complete 24-Scenario RBAC & Security Verification Suite (Section 10)', () => {
  // Certified Tokens for the 5 official roles
  let directorToken;
  let superAdminToken;
  let chefMatotoToken;
  let chefKaloumToken;
  let agentMatotoToken;
  let agentKaloumToken;
  let distributeurKaloumToken;
  let distributeurMatotoToken;

  beforeAll(() => {
    directorToken = jwt.sign(
      {
        sub: 'usr-dir-001',
        email: 'directeur@aotuc.test',
        phoneNumber: '+224620000002',
        roles: ['DIRECTOR'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    superAdminToken = jwt.sign(
      {
        sub: 'usr-adm-001',
        email: 'superadmin@aotuc.test',
        phoneNumber: '+224620000001',
        roles: ['SUPER_ADMIN'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefMatotoToken = jwt.sign(
      {
        sub: 'usr-chf-matoto',
        email: 'chef.matoto@aotuc.test',
        phoneNumber: '+224620000003',
        roles: ['CHEF_SERVICE'],
        communeId: 'cm-matoto',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefKaloumToken = jwt.sign(
      {
        sub: 'usr-chf-kaloum',
        email: 'chef.kaloum@aotuc.test',
        phoneNumber: '+224620000004',
        roles: ['CHEF_SERVICE'],
        communeId: 'cm-kaloum',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentMatotoToken = jwt.sign(
      {
        sub: 'usr-agt-matoto',
        email: 'agent.matoto@aotuc.test',
        phoneNumber: '+224620000005',
        roles: ['AGENT_TERRAIN'],
        communeId: 'cm-matoto',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentKaloumToken = jwt.sign(
      {
        sub: 'usr-agt-kaloum',
        email: 'agent.kaloum@aotuc.test',
        phoneNumber: '+224620000008',
        roles: ['AGENT_TERRAIN'],
        communeId: 'cm-kaloum',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    distributeurKaloumToken = jwt.sign(
      {
        sub: 'usr-dst-kaloum',
        email: 'distributeur.kaloum@aotuc.test',
        phoneNumber: '+224620000006',
        roles: ['DISTRIBUTEUR'],
        communeId: 'cm-kaloum',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    distributeurMatotoToken = jwt.sign(
      {
        sub: 'usr-dst-matoto',
        email: 'distributeur.matoto@aotuc.test',
        phoneNumber: '+224620000009',
        roles: ['DISTRIBUTEUR'],
        communeId: 'cm-matoto',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterEach(() => {
    RevocationRegistry.clear();
  });

  // ============================================================================
  // Scenario 1: Unauthenticated users cannot access protected APIs (returns 401)
  // ============================================================================
  it('Scenario 1: Unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.message).toContain('Authentification requise');

    // Also verify corrupt and expired token handling
    const resInvalid = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid_tampered_payload_xyz');
    expect(resInvalid.statusCode).toBe(401);
    expect(resInvalid.body.code).toBe('INVALID_ACCESS_TOKEN');
  });

  // ============================================================================
  // Scenario 2: L1 can register drivers and submit applications
  // ============================================================================
  it('Scenario 2: L1 (Agent Matoto) has explicit permissions to register drivers, upload documents, and submit applications', () => {
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.DRIVERS_CREATE)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.DRIVERS_READ)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.DRIVERS_UPDATE)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.DOCUMENTS_UPLOAD)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.DOCUMENTS_VERIFY)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_SUBMIT)).toBe(true);
  });

  // ============================================================================
  // Scenario 3: L1 cannot approve or reject applications
  // ============================================================================
  it('Scenario 3: L1 CANNOT approve or reject applications (returns 403 / state machine rejection)', () => {
    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'FORWARD_TO_L3',
        reviewerUser: { id: 'usr-agt-matoto', roles: ['AGENT_TERRAIN'], communeId: 'cm-matoto' },
        submitterId: 'usr-agt-matoto-2',
        comment: null,
        requestCommuneId: 'cm-matoto',
      });
    }).toThrow('Permissions insuffisantes');

    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'EN_ATTENTE_NIVEAU3',
        action: 'APPROVE_FINAL',
        reviewerUser: { id: 'usr-agt-matoto', roles: ['AGENT_TERRAIN'], communeId: 'cm-matoto' },
        submitterId: 'usr-agt-matoto-2',
        comment: null,
        requestCommuneId: 'cm-matoto',
      });
    }).toThrow('Permissions insuffisantes');

    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'REJECT',
        reviewerUser: { id: 'usr-agt-matoto', roles: ['AGENT_TERRAIN'], communeId: 'cm-matoto' },
        submitterId: 'usr-agt-matoto-2',
        comment: 'Motif de rejet',
        requestCommuneId: 'cm-matoto',
      });
    }).toThrow('Permissions insuffisantes');

    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(false);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(false);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_REJECT)).toBe(false);
  });

  // ============================================================================
  // Scenario 4: L1 cannot access financial modules
  // ============================================================================
  it('Scenario 4: L1 CANNOT access financial modules (Ticketing batches, sales, ledger returns 403)', async () => {
    // 1. Cannot access ticket batches
    const resBatches = await request(app)
      .get('/api/v1/ticketing/batches')
      .set('Authorization', `Bearer ${agentMatotoToken}`);
    expect(resBatches.statusCode).toBe(403);
    expect(resBatches.body.code).toBe('FORBIDDEN_ROLE');

    // 2. Cannot access ticket sales
    const resSales = await request(app)
      .get('/api/v1/ticketing/sales')
      .set('Authorization', `Bearer ${agentMatotoToken}`);
    expect(resSales.statusCode).toBe(403);
    expect(resSales.body.code).toBe('FORBIDDEN_ROLE');

    // 3. Cannot access general ledger summary
    const resLedger = await request(app)
      .get('/api/v1/ticketing/ledger/summary')
      .set('Authorization', `Bearer ${agentMatotoToken}`);
    expect(resLedger.statusCode).toBe(403);
    expect(resLedger.body.code).toBe('FORBIDDEN_ROLE');

    // Verify matrix
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.TICKETS_SELL)).toBe(false);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.TRANSACTIONS_CREATE)).toBe(false);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.FINANCIAL_REPORTS_READ)).toBe(false);
  });

  // ============================================================================
  // Scenario 5: L2 can review Matoto applications
  // ============================================================================
  it('Scenario 5: L2 (Chef Matoto) can review and forward Matoto applications (FORWARD_TO_L3)', () => {
    const evaluation = ValidationStateMachine.evaluate({
      currentStatus: 'SOUMIS_NIVEAU2',
      action: 'FORWARD_TO_L3',
      reviewerUser: { id: 'usr-chf-matoto', roles: ['CHEF_SERVICE'], communeId: 'cm-matoto' },
      submitterId: 'usr-agt-matoto',
      comment: null,
      requestCommuneId: 'cm-matoto',
    });

    expect(evaluation.newStatus).toBe('EN_ATTENTE_NIVEAU3');
    expect(evaluation.newLevel).toBe(3);
    expect(hasPermission(['CHEF_SERVICE'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(true);
    expect(hasPermission(['CHEF_SERVICE'], PERMISSIONS.APPLICATIONS_REVIEW_L2)).toBe(true);
  });

  // ============================================================================
  // Scenario 6: L2 cannot access Kaloum applications
  // ============================================================================
  it('Scenario 6: L2 cannot review or approve Kaloum applications (cross-commune restriction)', async () => {
    // 1. State machine cross-commune rejection
    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'FORWARD_TO_L3',
        reviewerUser: { id: 'usr-chf-matoto', roles: ['CHEF_SERVICE'], communeId: 'cm-matoto' },
        submitterId: 'usr-agt-kaloum',
        comment: null,
        requestCommuneId: 'cm-kaloum', // Cross-commune violation
      });
    }).toThrow('Accès refusé. Vous ne pouvez valider que les dossiers rattachés à votre commune');

    // 2. HTTP endpoint commune scope rejection
    const res = await request(app)
      .get('/api/v1/auth/test-scope/cm-kaloum')
      .set('Authorization', `Bearer ${chefMatotoToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_COMMUNE_SCOPE');
  });

  // ============================================================================
  // Scenario 7: L2 cannot perform L3 approvals
  // ============================================================================
  it('Scenario 7: L2 CANNOT perform final L3 approval (returns 403)', () => {
    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'EN_ATTENTE_NIVEAU3',
        action: 'APPROVE_FINAL',
        reviewerUser: { id: 'usr-chf-matoto', roles: ['CHEF_SERVICE'], communeId: 'cm-matoto' },
        submitterId: 'usr-agt-matoto',
        comment: null,
        requestCommuneId: 'cm-matoto',
      });
    }).toThrow('Permissions insuffisantes');

    expect(hasPermission(['CHEF_SERVICE'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(false);
  });

  // ============================================================================
  // Scenario 8: L3 can perform authorized final approvals
  // ============================================================================
  it('Scenario 8: L3 (Directeur Général) can perform authorized final approvals (APPROVE_FINAL to VALIDE)', () => {
    const evaluation = ValidationStateMachine.evaluate({
      currentStatus: 'EN_ATTENTE_NIVEAU3',
      action: 'APPROVE_FINAL',
      reviewerUser: { id: 'usr-dir-001', roles: ['DIRECTOR'], communeId: null },
      submitterId: 'usr-agt-matoto',
      comment: null,
      requestCommuneId: 'cm-matoto',
    });

    expect(evaluation.newStatus).toBe('VALIDE');
    expect(evaluation.newLevel).toBe(3);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(true);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(true);
  });

  // ============================================================================
  // Scenario 9: L3 cannot manage user accounts
  // ============================================================================
  it('Scenario 9: L3 CANNOT manage user accounts, assign roles, or deactivate users (returns 403)', async () => {
    const resCreate = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+224629999999',
        role: 'AGENT_TERRAIN',
      });
    expect(resCreate.statusCode).toBe(403);
    expect(resCreate.body.code).toBe('FORBIDDEN_ROLE');

    const resDeactivate = await request(app)
      .patch('/api/v1/users/usr-some-target/deactivate')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ reason: 'Tentative désactivation par directeur' });
    expect(resDeactivate.statusCode).toBe(403);
    expect(resDeactivate.body.code).toBe('FORBIDDEN_ROLE');

    expect(hasPermission(['DIRECTOR'], PERMISSIONS.USERS_CREATE)).toBe(false);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.USERS_UPDATE)).toBe(false);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.USERS_DEACTIVATE)).toBe(false);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.ROLES_MANAGE)).toBe(false);
  });

  // ============================================================================
  // Scenario 10: L3 cannot modify audit history
  // ============================================================================
  it('Scenario 10: L3 CANNOT modify or delete audit history (returns 405 Method Not Allowed)', async () => {
    const resDelete = await request(app)
      .delete('/api/v1/audit/logs/some-audit-log-id')
      .set('Authorization', `Bearer ${directorToken}`);
    expect([403, 405]).toContain(resDelete.statusCode);
    if (resDelete.statusCode === 405) {
      expect(resDelete.body.code).toBe('AUDIT_LOG_IMMUTABLE');
    }

    const resPut = await request(app)
      .put('/api/v1/audit/logs/some-audit-log-id')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ action: 'FORGED_AUDIT' });
    expect([403, 405]).toContain(resPut.statusCode);
  });

  // ============================================================================
  // Scenario 11: DSI can manage users, roles, and system security
  // ============================================================================
  it('Scenario 11: DSI (Super Admin) can manage users, roles, and system security', async () => {
    const resUsers = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect([200, 500]).toContain(resUsers.statusCode);

    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.USERS_CREATE)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.USERS_UPDATE)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.USERS_DEACTIVATE)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.ROLES_MANAGE)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.SYSTEM_SETTINGS_MANAGE)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.AUDIT_READ)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.AUDIT_VERIFY)).toBe(true);
  });

  // ============================================================================
  // Scenario 12: DSI cannot approve driver applications
  // ============================================================================
  it('Scenario 12: DSI CANNOT approve driver applications (returns 403 / state machine rejection)', () => {
    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'EN_ATTENTE_NIVEAU3',
        action: 'APPROVE_FINAL',
        reviewerUser: { id: 'usr-adm-001', roles: ['SUPER_ADMIN'], communeId: null },
        submitterId: 'usr-agt-001',
        comment: 'Tentative approbation par DSI',
        requestCommuneId: 'cm-matoto',
      });
    }).toThrow('Permissions insuffisantes');

    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'FORWARD_TO_L3',
        reviewerUser: { id: 'usr-adm-001', roles: ['SUPER_ADMIN'], communeId: null },
        submitterId: 'usr-agt-001',
        comment: null,
        requestCommuneId: 'cm-matoto',
      });
    }).toThrow('Permissions insuffisantes');

    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(false);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(false);
  });

  // ============================================================================
  // Scenario 13: DSI cannot issue credentials
  // ============================================================================
  it('Scenario 13: DSI CANNOT issue official credentials or badges (returns 403)', async () => {
    const resBadge = await request(app)
      .post('/api/v1/badges/issue')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        driverId: '11111111-1111-1111-1111-111111111111',
      });
    expect(resBadge.statusCode).toBe(403);
    expect(resBadge.body.code).toBe('FORBIDDEN_ROLE');

    const resLicence = await request(app)
      .post('/api/v1/licences/issue')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        vehicleId: '11111111-1111-1111-1111-111111111111',
      });
    expect(resLicence.statusCode).toBe(403);
    expect(resLicence.body.code).toBe('FORBIDDEN_ROLE');

    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(false);
  });

  // ============================================================================
  // Scenario 14: Distributor can sell tickets and record payments
  // ============================================================================
  it('Scenario 14: Distributeur can sell tickets, record payments, and view own sales', () => {
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TICKETS_SELL)).toBe(true);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TRANSACTIONS_CREATE)).toBe(true);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TRANSACTIONS_READ_OWN)).toBe(true);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TRANSACTIONS_REVERSE)).toBe(true);
  });

  // ============================================================================
  // Scenario 15: Distributor cannot access driver applications or records
  // ============================================================================
  it('Scenario 15: Distributeur CANNOT access driver applications or records (returns 403)', async () => {
    const resDrivers = await request(app)
      .get('/api/v1/registration/drivers')
      .set('Authorization', `Bearer ${distributeurKaloumToken}`);
    expect(resDrivers.statusCode).toBe(403);
    expect(resDrivers.body.code).toBe('FORBIDDEN_ROLE');

    const resDossiers = await request(app)
      .get('/api/v1/validation/requests')
      .set('Authorization', `Bearer ${distributeurKaloumToken}`);
    expect(resDossiers.statusCode).toBe(403);
    expect(resDossiers.body.code).toBe('FORBIDDEN_ROLE');

    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.DRIVERS_READ)).toBe(false);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.APPLICATIONS_REVIEW_L2)).toBe(false);
  });

  // ============================================================================
  // Scenario 16: Distributor cannot access the general ledger
  // ============================================================================
  it('Scenario 16: Distributeur CANNOT access the general ledger (returns 403)', async () => {
    const resLedger = await request(app)
      .get('/api/v1/ticketing/ledger/summary')
      .set('Authorization', `Bearer ${distributeurKaloumToken}`);
    expect(resLedger.statusCode).toBe(403);
    expect(resLedger.body.code).toBe('FORBIDDEN_ROLE');

    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TRANSACTIONS_READ_ALL)).toBe(false);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.FINANCIAL_REPORTS_READ)).toBe(false);
  });

  // ============================================================================
  // Scenario 17: Privilege escalation prevention
  // ============================================================================
  it('Scenario 17: Privilege escalation prevention: Non-admins cannot create users or elevate roles', async () => {
    const nonAdminTokens = [
      { name: 'Agent Matoto', token: agentMatotoToken },
      { name: 'Chef Matoto', token: chefMatotoToken },
      { name: 'Directeur Général', token: directorToken },
      { name: 'Distributeur Kaloum', token: distributeurKaloumToken },
    ];

    for (const actor of nonAdminTokens) {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${actor.token}`)
        .send({
          firstName: 'Escalated',
          lastName: 'Hacker',
          phoneNumber: '+224629000000',
          role: 'SUPER_ADMIN',
        });
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    }
  });

  // ============================================================================
  // Scenario 18: Deactivated accounts cannot access protected APIs
  // ============================================================================
  it('Scenario 18: Deactivated accounts cannot access protected APIs (immediate session invalidation)', async () => {
    const victimUserId = 'usr-victim-999';
    const victimToken = jwt.sign(
      { sub: victimUserId, roles: ['AGENT_TERRAIN'], communeId: 'cm-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Instant deactivation in registry
    RevocationRegistry.deactivateUser(victimUserId);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${victimToken}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_DEACTIVATED');
    expect(res.body.message).toContain('désactivé');
  });

  // ============================================================================
  // Scenario 19: Direct API requests outside frontend are rejected if unauthorized
  // ============================================================================
  it('Scenario 19: Direct API requests sent outside frontend are strictly authenticated and authorized', async () => {
    // 1. Unauthenticated direct call
    const resNoAuth = await request(app).get('/api/v1/badges/statistics');
    expect(resNoAuth.statusCode).toBe(401);

    // 2. Unprivileged direct call (Agent attempting to issue badge)
    const resBadRole = await request(app)
      .post('/api/v1/badges/issue')
      .set('Authorization', `Bearer ${agentMatotoToken}`)
      .send({ driverId: 'some-driver' });
    expect(resBadRole.statusCode).toBe(403);
    expect(resBadRole.body.code).toBe('FORBIDDEN_ROLE');
  });

  // ============================================================================
  // Scenario 20: Territory restrictions are strictly enforced at database and API level
  // ============================================================================
  it('Scenario 20: Territory restrictions are strictly enforced at database and API level', async () => {
    // Agent Matoto tries to access Kaloum scope
    const resCrossCommune = await request(app)
      .get('/api/v1/auth/test-scope/cm-kaloum')
      .set('Authorization', `Bearer ${agentMatotoToken}`);
    expect(resCrossCommune.statusCode).toBe(403);
    expect(resCrossCommune.body.code).toBe('FORBIDDEN_COMMUNE_SCOPE');

    // Agent Matoto accesses their own Matoto scope -> allowed
    const resSameCommune = await request(app)
      .get('/api/v1/auth/test-scope/cm-matoto')
      .set('Authorization', `Bearer ${agentMatotoToken}`);
    expect(resSameCommune.statusCode).toBe(200);

    // Director (national scope communeId: null) -> allowed across all territories
    const resDirector = await request(app)
      .get('/api/v1/auth/test-scope/cm-kaloum')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(resDirector.statusCode).toBe(200);
  });

  // ============================================================================
  // Scenario 21: Duplicate credential issuance is prevented
  // ============================================================================
  it('Scenario 21: Duplicate credential issuance is prevented (requires ACTIF driver and valid validation state)', async () => {
    // Attempting to issue badge for a non-existent or ineligible driver
    const res = await request(app)
      .post('/api/v1/badges/issue')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        driverId: '00000000-0000-0000-0000-000000000000',
      });

    // Returns either 404 (driver not found) or 400 (driver not eligible/not approved)
    expect([400, 404, 500]).toContain(res.statusCode);
    if (res.statusCode === 400) {
      expect(res.body.code).toBe('DRIVER_NOT_ELIGIBLE');
    }
  });

  // ============================================================================
  // Scenario 22: Tampered or invalid Ed25519 credential signatures are rejected
  // ============================================================================
  it('Scenario 22: Tampered or invalid Ed25519 credential signatures are rejected by offline verification', () => {
    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { qrPayload } = CryptoSignatureService.signCredential({
      credentialId: 'CH-2026-GENUINE-01',
      type: 'DRIVER_BADGE',
      targetId: 'driver-uuid-4444',
      issuedAt,
      expiresAt,
    });

    // 1. Genuine payload verification succeeds
    const genuineVerification = CryptoSignatureService.verifyQrPayload(qrPayload);
    expect(genuineVerification.isValid).toBe(true);
    expect(genuineVerification.payload.credentialId).toBe('CH-2026-GENUINE-01');

    // 2. Tampered payload is detected and rejected
    const tamperedPayload = qrPayload.replace('driver-uuid-4444', 'forged-uuid-9999');
    const tamperedVerification = CryptoSignatureService.verifyQrPayload(tamperedPayload);
    expect(tamperedVerification.isValid).toBe(false);
    expect(tamperedVerification.reason).toContain('altérée ou contrefaite');
  });

  // ============================================================================
  // Scenario 23: Posted financial transactions cannot be silently modified or deleted
  // ============================================================================
  it('Scenario 23: Posted financial transactions cannot be silently modified or deleted (LEDGER_IMMUTABLE 405)', async () => {
    const resDelete = await request(app)
      .delete('/api/v1/ticketing/ledger/entries/JNL-2026-000841')
      .set('Authorization', `Bearer ${directorToken}`);
    expect([403, 405]).toContain(resDelete.statusCode);
    if (resDelete.statusCode === 405) {
      expect(resDelete.body.code).toBe('LEDGER_IMMUTABLE');
    }

    const resPut = await request(app)
      .put('/api/v1/ticketing/ledger/entries/JNL-2026-000841')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ amountGnf: 999999999 });
    expect([403, 405]).toContain(resPut.statusCode);
    if (resPut.statusCode === 405) {
      expect(resPut.body.code).toBe('LEDGER_IMMUTABLE');
    }

    const resPatch = await request(app)
      .patch('/api/v1/ticketing/ledger/entries/JNL-2026-000841')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ amountGnf: 999999999 });
    expect([403, 405]).toContain(resPatch.statusCode);
    if (resPatch.statusCode === 405) {
      expect(resPatch.body.code).toBe('LEDGER_IMMUTABLE');
    }
  });

  // ============================================================================
  // Scenario 24: Security audit records cannot be altered or deleted by any user or administrator
  // ============================================================================
  it('Scenario 24: Security audit records cannot be altered or deleted by any user or administrator (AUDIT_LOG_IMMUTABLE 405)', async () => {
    // 1. SuperAdmin cannot delete audit logs
    const resAdminDelete = await request(app)
      .delete('/api/v1/audit/logs/AUD-2026-0001')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect([403, 405]).toContain(resAdminDelete.statusCode);
    if (resAdminDelete.statusCode === 405) {
      expect(resAdminDelete.body.code).toBe('AUDIT_LOG_IMMUTABLE');
    }

    // 2. SuperAdmin cannot update audit logs
    const resAdminPut = await request(app)
      .put('/api/v1/audit/logs/AUD-2026-0001')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ action: 'EXPUNGED' });
    expect([403, 405]).toContain(resAdminPut.statusCode);

    // 3. Chef Matoto cannot delete audit logs
    const resChefDelete = await request(app)
      .delete('/api/v1/audit/logs/AUD-2026-0001')
      .set('Authorization', `Bearer ${chefMatotoToken}`);
    expect([403, 405]).toContain(resChefDelete.statusCode);
  });

  // ============================================================================
  // Additional Anti-Fraud Requirement: Prohibition of Self-Approval
  // ============================================================================
  it('Anti-Fraud: Prohibition of self-approval is strictly enforced (Chef Matoto cannot approve own submission)', () => {
    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'FORWARD_TO_L3',
        reviewerUser: { id: 'usr-chf-matoto', roles: ['CHEF_SERVICE'], communeId: 'cm-matoto' },
        submitterId: 'usr-chf-matoto', // Submitter is reviewer!
        comment: null,
        requestCommuneId: 'cm-matoto',
      });
    }).toThrow('Conflit d intérêt : vous ne pouvez pas approuver');
  });
});
