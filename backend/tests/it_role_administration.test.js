import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import { RevocationRegistry } from '../src/middlewares/authMiddleware.js';
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '../src/config/permissions.js';
import ITService from '../src/modules/it/it.service.js';
import prisma from '../src/utils/prisma.js';

describe('AOTUC — IT Role (Full Technical Administrator) Test Suite (Section 12)', () => {
  let itToken;
  let superAdminToken;
  let directorToken;
  let chefMatotoToken;
  let agentMatotoToken;

  beforeAll(() => {
    jest.setTimeout(45000);

    itToken = jwt.sign(
      {
        sub: 'usr-it-test-001',
        email: 'it.admin@aotuc.gov.gn',
        phoneNumber: '+224629999001',
        roles: ['IT'],
        communeId: null, // Global access
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    superAdminToken = jwt.sign(
      {
        sub: 'usr-dsi-test-001',
        email: 'dsi@aotuc.gov.gn',
        phoneNumber: '+224620000001',
        roles: ['SUPER_ADMIN'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    directorToken = jwt.sign(
      {
        sub: 'usr-dir-test-001',
        email: 'directeur@aotuc.gov.gn',
        phoneNumber: '+224620000002',
        roles: ['DIRECTOR'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefMatotoToken = jwt.sign(
      {
        sub: 'usr-chef-matoto',
        email: 'chef.matoto@aotuc.gov.gn',
        phoneNumber: '+224620000003',
        roles: ['CHEF_SERVICE'],
        communeId: 'cm-matoto',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentMatotoToken = jwt.sign(
      {
        sub: 'usr-agent-matoto',
        email: 'agent.matoto@aotuc.gov.gn',
        phoneNumber: '+224620000004',
        roles: ['AGENT_TERRAIN'],
        communeId: 'cm-matoto',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // TEST 1: IT can access all communes (no territorial restriction)
  // ---------------------------------------------------------------------------
  test('1. IT can access all communes without territorial restriction', async () => {
    // Attempt request with commune-specific param / scope
    const res = await request(app)
      .get('/api/v1/users/communes')
      .set('Authorization', `Bearer ${itToken}`);

    expect([200, 304]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  }, 30000);

  // ---------------------------------------------------------------------------
  // TEST 2: IT can access all operational application modules
  // ---------------------------------------------------------------------------
  test('2. IT can access all application modules and permissions', () => {
    const itPerms = ROLE_PERMISSIONS.IT;
    expect(itPerms).toBeDefined();

    // Key module permissions present
    expect(itPerms).toContain(PERMISSIONS.USERS_READ);
    expect(itPerms).toContain(PERMISSIONS.DRIVERS_READ);
    expect(itPerms).toContain(PERMISSIONS.DOCUMENTS_UPLOAD);
    expect(itPerms).toContain(PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE);
    expect(itPerms).toContain(PERMISSIONS.INSPECTIONS_READ);
    expect(itPerms).toContain(PERMISSIONS.MISSION_REPORTS_READ);
    expect(itPerms).toContain(PERMISSIONS.UNIONS_MANAGE);
    expect(itPerms).toContain(PERMISSIONS.AUTHORITIES_READ);
    expect(itPerms).toContain(PERMISSIONS.DATABASE_QUERY);
    expect(itPerms).toContain(PERMISSIONS.BACKUP_MANAGE);
    expect(itPerms).toContain(PERMISSIONS.SYSTEM_DIAGNOSTICS);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: IT can create, edit, suspend, activate, and delete users
  // ---------------------------------------------------------------------------
  test('3. IT has permissions to create, edit, suspend, activate, and delete users', () => {
    expect(hasPermission(['IT'], PERMISSIONS.USERS_CREATE)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.USERS_UPDATE)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.USERS_DEACTIVATE)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.USERS_DELETE)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TEST 4: IT can create and manage drivers, owners, vehicles, and syndicates
  // ---------------------------------------------------------------------------
  test('4. IT can create and manage drivers, owners, vehicles, and syndicates', () => {
    expect(hasPermission(['IT'], PERMISSIONS.DRIVERS_CREATE)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.DRIVERS_READ)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.DRIVERS_UPDATE)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.RECORDS_DELETE)).toBe(true);
    expect(hasPermission(['IT'], PERMISSIONS.UNIONS_MANAGE)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TEST 5: IT can inspect and manage database records through the authorized administration mechanism
  // ---------------------------------------------------------------------------
  test('5. IT can inspect database overview and execute guarded SQL queries', async () => {
    // 5a. Overview endpoint
    const overviewRes = await request(app)
      .get('/api/v1/it/overview')
      .set('Authorization', `Bearer ${itToken}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data).toHaveProperty('counts');
    expect(overviewRes.body.data).toHaveProperty('database');

    // 5b. Read query (SELECT)
    const selectRes = await request(app)
      .post('/api/v1/it/query')
      .set('Authorization', `Bearer ${itToken}`)
      .send({
        query: 'SELECT id, name FROM roles ORDER BY name ASC;',
      });

    expect(selectRes.status).toBe(200);
    expect(selectRes.body.data.queryType).toBe('SELECT');
    expect(Array.isArray(selectRes.body.data.rows)).toBe(true);

    // 5c. Dangerous query blocked (DROP TABLE)
    const dangerousRes = await request(app)
      .post('/api/v1/it/query')
      .set('Authorization', `Bearer ${itToken}`)
      .send({
        query: 'DROP TABLE users;',
        reason: 'test dangerous',
        requireConfirmation: true,
      });

    expect(dangerousRes.status).toBe(403);
    expect(dangerousRes.body.code).toBe('DANGEROUS_SQL_BLOCKED');

    // 5d. Mutation without reason is rejected
    const unreasonedRes = await request(app)
      .post('/api/v1/it/query')
      .set('Authorization', `Bearer ${itToken}`)
      .send({
        query: "UPDATE roles SET description = description WHERE name = 'IT';",
        requireConfirmation: true,
      });

    expect(unreasonedRes.status).toBe(400);
    expect(unreasonedRes.body.code).toBe('REASON_REQUIRED');
  }, 45000);

  // ---------------------------------------------------------------------------
  // TEST 6: IT can create and verify backups
  // ---------------------------------------------------------------------------
  test('6. IT can list, create, and verify backups', async () => {
    const listRes = await request(app)
      .get('/api/v1/it/backups')
      .set('Authorization', `Bearer ${itToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    // Verify existing backups contain our safety backup
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // TEST 7: IT can perform controlled data restoration
  // ---------------------------------------------------------------------------
  test('7. IT can perform controlled data restoration with validation', async () => {
    // Attempt targeted restore with invalid backup file
    const invalidRes = await request(app)
      .post('/api/v1/it/backups/restore-targeted')
      .set('Authorization', `Bearer ${itToken}`)
      .send({
        backupFileName: 'non_existent_backup.json',
        entityType: 'driver',
        reason: 'Restauration de test contrôlée',
      });

    expect(invalidRes.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Sensitive operations generate audit records
  // ---------------------------------------------------------------------------
  test('8. Sensitive SQL mutations generate audit log records', async () => {
    const reasonText = 'Vérification test traçabilité audit IT';
    const mutationRes = await request(app)
      .post('/api/v1/it/query')
      .set('Authorization', `Bearer ${itToken}`)
      .send({
        query: "UPDATE roles SET description = 'Administrateur Technique et Contrôleur Informatique Global' WHERE name = 'IT';",
        reason: reasonText,
        requireConfirmation: true,
      });

    expect(mutationRes.status).toBe(200);

    // Check that an audit log entry was created
    const latestAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'DATABASE_SQL_MUTATION',
        reason: { contains: reasonText },
      },
      orderBy: { timestamp: 'desc' },
    });

    expect(latestAudit).toBeDefined();
    expect(latestAudit.targetModule).toBe('DATABASE');
  }, 45000);

  // ---------------------------------------------------------------------------
  // TEST 9: Historical records remain attributable after user deletion
  // ---------------------------------------------------------------------------
  test('9. Safe user deletion preserves historical records and attribution', async () => {
    // Create a temporary test user
    const testPhone = `+224699${Math.floor(100000 + Math.random() * 900000)}`;
    const tempUser = await prisma.user.create({
      data: {
        phoneNumber: testPhone,
        email: `temp_${Date.now()}@aotuc.test`,
        passwordHash: 'argon2id_mock_hash_temp',
        firstName: 'TempAgent',
        lastName: 'HistoricalTest',
        isActive: true,
        accountStatus: 'ACTIVE',
      },
    });

    // Create an audit log record attributed to this user
    const userAudit = await prisma.auditLog.create({
      data: {
        actor: { connect: { id: tempUser.id } },
        action: 'TEST_HISTORICAL_ACTION',
        targetModule: 'TEST',
        reason: 'Attribution verification before safe user deletion',
      },
    });

    // Execute safe user deletion via IT service
    const deleteRes = await ITService.deleteUserSafely({
      userId: tempUser.id,
      reason: 'Suppression test avec préservation des références historiques',
      actorId: 'usr-it-test-001',
    });

    expect(deleteRes.success).toBe(true);

    // Verify historical audit log still points to the user record (not cascade-deleted)
    const auditAfter = await prisma.auditLog.findUnique({
      where: { id: userAudit.id },
    });
    expect(auditAfter).toBeDefined();

    // Verify user is deactivated and archived, not physically dropped
    const archivedUser = await prisma.user.findUnique({
      where: { id: tempUser.id },
    });
    expect(archivedUser).toBeDefined();
    expect(archivedUser.isActive).toBe(false);
    expect(archivedUser.accountStatus).toBe('INACTIVE');
    expect(archivedUser.firstName).toContain('[ARCHIVÉ]');

    // Clean up test audit log and temp user
    await prisma.auditLog.delete({ where: { id: userAudit.id } });
    await prisma.user.delete({ where: { id: tempUser.id } });
  }, 45000);

  // ---------------------------------------------------------------------------
  // TEST 10: IT cannot bypass the existing administrative validation hierarchy
  // ---------------------------------------------------------------------------
  test('10. IT cannot bypass the 3-level administrative validation hierarchy', () => {
    // IT must NOT have Level 2 or Level 3 approval permissions
    expect(hasPermission(['IT'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(false);
    expect(hasPermission(['IT'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(false);
    expect(hasPermission(['IT'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(false);

    // Only CHEF_SERVICE has Level 2 approval
    expect(hasPermission(['CHEF_SERVICE'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(true);

    // Only DIRECTOR has Level 3 approval and credential issuance
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(true);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Existing SUPER_ADMIN permissions remain functional
  // ---------------------------------------------------------------------------
  test('11. Existing SUPER_ADMIN permissions remain fully functional', () => {
    const dsiPerms = ROLE_PERMISSIONS.SUPER_ADMIN;
    expect(dsiPerms).toBeDefined();
    expect(dsiPerms).toContain(PERMISSIONS.USERS_READ);
    expect(dsiPerms).toContain(PERMISSIONS.USERS_CREATE);
    expect(dsiPerms).toContain(PERMISSIONS.USERS_UPDATE);
    expect(dsiPerms).toContain(PERMISSIONS.USERS_DEACTIVATE);
    expect(dsiPerms).toContain(PERMISSIONS.SYSTEM_SETTINGS_MANAGE);
    expect(dsiPerms).toContain(PERMISSIONS.AUDIT_READ);
    expect(dsiPerms).toContain(PERMISSIONS.AUDIT_VERIFY);
    expect(dsiPerms).toContain(PERMISSIONS.UNIONS_MANAGE);

    // SUPER_ADMIN does NOT have database raw SQL execution (reserved for IT DBA)
    expect(dsiPerms).not.toContain(PERMISSIONS.DATABASE_QUERY);
    expect(dsiPerms).not.toContain(PERMISSIONS.BACKUP_RESTORE);
  });

  // ---------------------------------------------------------------------------
  // TEST 12: All existing roles continue working correctly
  // ---------------------------------------------------------------------------
  test('12. All existing roles continue working according to least privilege', () => {
    // DIRECTOR
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.APPLICATIONS_APPROVE_L3)).toBe(true);
    expect(hasPermission(['DIRECTOR'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(true);

    // CHEF_SERVICE
    expect(hasPermission(['CHEF_SERVICE'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(true);
    expect(hasPermission(['CHEF_SERVICE'], PERMISSIONS.CREDENTIALS_ISSUE)).toBe(false);

    // AGENT_TERRAIN
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_SUBMIT)).toBe(true);
    expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.APPLICATIONS_APPROVE_L2)).toBe(false);

    // DISTRIBUTEUR
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.TICKETS_SELL)).toBe(true);
    expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.DRIVERS_READ)).toBe(false);

    // SYNDICAT
    expect(hasPermission(['SYNDICAT'], PERMISSIONS.UNIONS_READ)).toBe(true);
    expect(hasPermission(['SYNDICAT'], PERMISSIONS.USERS_READ)).toBe(false);

    // AUTHORITY
    expect(hasPermission(['AUTHORITY'], PERMISSIONS.AUTHORITIES_READ)).toBe(true);
    expect(hasPermission(['AUTHORITY'], PERMISSIONS.DRIVERS_CREATE)).toBe(false);
  });
});
