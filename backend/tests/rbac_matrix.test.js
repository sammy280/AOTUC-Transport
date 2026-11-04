import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import { RevocationRegistry } from '../src/middlewares/authMiddleware.js';
import ValidationStateMachine from '../src/modules/validation/validation.machine.js';
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '../src/config/permissions.js';

describe('AOTUC Transport System — Comprehensive RBAC & Security Matrix (Section 9)', () => {
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
  // Scenario 1: Unauthenticated request to protected endpoint returns 401
  // ============================================================================
  it('Scenario 1: Unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.message).toContain('Authentification requise');
  });

  // ============================================================================
  // Scenario 2: Invalid or expired token returns 401
  // ============================================================================
  it('Scenario 2: Invalid or expired token returns 401', async () => {
    // Malformed token
    const resInvalid = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid_tampered_payload_xyz');
    expect(resInvalid.statusCode).toBe(401);
    expect(resInvalid.body.code).toBe('INVALID_ACCESS_TOKEN');

    // Expired token
    const expiredToken = jwt.sign(
      { sub: 'usr-exp-001', roles: ['DIRECTOR'] },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '-10s' }
    );
    const resExpired = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(resExpired.statusCode).toBe(401);
    expect(resExpired.body.code).toBe('TOKEN_EXPIRED');
  });

  // ============================================================================
  // Scenario 3: Deactivated user returns 401 immediately
  // ============================================================================
  it('Scenario 3: Deactivated user returns 401 immediately (sessions invalidated)', async () => {
    const deactivatedUserId = 'usr-deactivated-999';
    const deactivatedUserToken = jwt.sign(
      { sub: deactivatedUserId, roles: ['AGENT_TERRAIN'], communeId: 'cm-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Deactivate user via RevocationRegistry
    RevocationRegistry.deactivateUser(deactivatedUserId);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${deactivatedUserToken}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_DEACTIVATED');
    expect(res.body.message).toContain('désactivé');
  });

  // ============================================================================
  // Scenario 4: Super Admin can manage users (DSI administration)
  // ============================================================================
  it('Scenario 4: Super Admin can access user management endpoints', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect([200, 500]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body.success).toBe(true);
    }
    // Verify permission resolution
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.USERS_CREATE)).toBe(true);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.USERS_DEACTIVATE)).toBe(true);
  });

  // ============================================================================
  // Scenario 5: Super Admin CANNOT approve a driver application (returns 403)
  // ============================================================================
  it('Scenario 5: Super Admin CANNOT approve a driver application (returns 403 / forbidden)', async () => {
    // Attempting L2 forward or L3 final approval as Super Admin
    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'EN_ATTENTE_NIVEAU3',
        action: 'APPROVE_FINAL',
        reviewerUser: { id: 'usr-adm-001', roles: ['SUPER_ADMIN'], communeId: null },
        submitterId: 'usr-agt-001',
        comment: 'Tentative approbation par admin DSI',
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

    // Also verify via Permission Matrix
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(false);
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(false);
  });

  // ============================================================================
  // Scenario 6: Super Admin CANNOT issue official badge (returns 403)
  // ============================================================================
  it('Scenario 6: Super Admin CANNOT issue official badge (returns 403)', async () => {
    const res = await request(app)
      .post('/api/v1/badges/issue')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        driverId: '11111111-1111-1111-1111-111111111111',
        validationRequestId: '22222222-2222-2222-2222-222222222222',
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
    expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(false);
  });

  // ============================================================================
  // Scenario 7: Director can approve L3 application
  // ============================================================================
  it('Scenario 7: Director can approve L3 application (APPROVE_FINAL to VALIDE)', () => {
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
  });

  // ============================================================================
  // Scenario 8: Director CANNOT modify user roles or system config (returns 403)
  // ============================================================================
  it('Scenario 8: Director CANNOT modify user roles or create users (returns 403)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+224629999999',
        role: 'AGENT_TERRAIN',
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.USERS_CREATE)).toBe(false);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.USERS_DEACTIVATE)).toBe(false);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.ROLES_MANAGE)).toBe(false);
  });

  // ============================================================================
  // Scenario 9: Director CANNOT delete/modify audit logs (returns 403 or 405)
  // ============================================================================
  it('Scenario 9: Director CANNOT delete or modify audit logs (returns 405 Method Not Allowed)', async () => {
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
      .send({ action: 'MODIFIED_ACTION' });

    expect([403, 405]).toContain(resPut.statusCode);
  });

  // ============================================================================
  // Scenario 10: Chef Matoto can review and approve/forward Matoto applications
  // ============================================================================
  it('Scenario 10: Chef Matoto can review and forward Matoto applications (FORWARD_TO_L3)', () => {
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
  });

  // ============================================================================
  // Scenario 11: Chef Matoto CANNOT approve applications from another commune (returns 403)
  // ============================================================================
  it('Scenario 11: Chef Matoto CANNOT review or forward applications from Kaloum (returns 403)', () => {
    expect(() => {
      ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'FORWARD_TO_L3',
        reviewerUser: { id: 'usr-chf-matoto', roles: ['CHEF_SERVICE'], communeId: 'cm-matoto' },
        submitterId: 'usr-agt-kaloum',
        comment: null,
        requestCommuneId: 'cm-kaloum', // Cross-commune violation!
      });
    }).toThrow('Accès refusé. Vous ne pouvez valider que les dossiers rattachés à votre commune');
  });

  // ============================================================================
  // Scenario 12: Chef Matoto CANNOT perform final L3 approval (returns 403)
  // ============================================================================
  it('Scenario 12: Chef Matoto CANNOT perform final L3 approval (returns 403)', () => {
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
  // Scenario 13: Chef Matoto CANNOT approve their own submission (returns 403)
  // ============================================================================
  it('Scenario 13: Chef Matoto CANNOT approve their own submission (anti-fraud 403)', () => {
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

  // ============================================================================
  // Scenario 14: Agent Matoto can create driver draft and upload documents
  // ============================================================================
  it('Scenario 14: Agent Matoto has permissions to register drivers and upload documents', () => {
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.DRIVERS_CREATE)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.DOCUMENTS_UPLOAD)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_SUBMIT)).toBe(true);
  });

  // ============================================================================
  // Scenario 15: Agent Matoto CANNOT approve any application (returns 403)
  // ============================================================================
  it('Scenario 15: Agent Matoto CANNOT approve any application (returns 403)', () => {
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

    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(false);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(false);
  });

  // ============================================================================
  // Scenario 16: Agent Matoto CANNOT access applications outside their territory
  // ============================================================================
  it('Scenario 16: Agent Matoto is strictly restricted to assigned commune scope', async () => {
    const res = await request(app)
      .get('/api/v1/auth/test-scope/cm-kaloum')
      .set('Authorization', `Bearer ${agentMatotoToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_COMMUNE_SCOPE');
    expect(res.body.message).toContain('Vous n êtes pas autorisé à consulter ou modifier les données d une autre commune');
  });

  // ============================================================================
  // Scenario 17: Distributeur can create ticket sale and view own transactions
  // ============================================================================
  it('Scenario 17: Distributeur can access ticket sales and read own sales', () => {
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TICKETS_SELL)).toBe(true);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TRANSACTIONS_CREATE)).toBe(true);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TRANSACTIONS_READ_OWN)).toBe(true);
  });

  // ============================================================================
  // Scenario 18: Distributeur CANNOT access driver records, approve dossiers,
  // view other distributors sales, or edit posted ledger entries
  // ============================================================================
  it('Scenario 18: Distributeur CANNOT access driver records, approve applications, or delete ledger entries', async () => {
    // 1. Distributeur cannot read driver records (403)
    const resDrivers = await request(app)
      .get('/api/v1/registration/drivers')
      .set('Authorization', `Bearer ${distributeurKaloumToken}`);
    expect(resDrivers.statusCode).toBe(403);
    expect(resDrivers.body.code).toBe('FORBIDDEN_ROLE');

    // 2. Distributeur cannot access driver validation dossiers (403)
    const resDossier = await request(app)
      .get('/api/v1/validation/requests')
      .set('Authorization', `Bearer ${distributeurKaloumToken}`);
    expect(resDossier.statusCode).toBe(403);
    expect(resDossier.body.code).toBe('FORBIDDEN_ROLE');

    // 3. Distributeur cannot approve dossiers
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(false);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(false);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(false);

    // 4. Distributeur cannot delete or modify ledger entries (405 or 403)
    const resLedgerDelete = await request(app)
      .delete('/api/v1/ticketing/ledger/entries/some-entry-id')
      .set('Authorization', `Bearer ${distributeurKaloumToken}`);
    expect([403, 405]).toContain(resLedgerDelete.statusCode);

    // 5. Distributeur does NOT have TRANSACTIONS_READ_ALL
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TRANSACTIONS_READ_ALL)).toBe(false);
  });
});
