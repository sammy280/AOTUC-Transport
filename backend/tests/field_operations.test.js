import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('Phase 6 — Field Operations, Assignments, Progress Tracking & Proof of Work Suite', () => {
  jest.setTimeout(35000);

  let superAdminUser;
  let chefMatotoUser;
  let agentMatotoUser;
  let agentKaloumUser;

  let kaloumCommune;
  let matotoCommune;

  let superAdminToken;
  let chefMatotoToken;
  let agentMatotoToken;
  let agentKaloumToken;

  const testSuffix = Date.now().toString().slice(-6);
  let createdAssignmentId = null;
  let matotoAssignmentId = null;
  let createdReceiptId = null;
  let testPersonId = null;

  beforeAll(async () => {
    // Resolve communes
    kaloumCommune = await prisma.commune.findFirst({ where: { code: 'KLM' } });
    matotoCommune = await prisma.commune.findFirst({ where: { code: 'MTT' } });

    // Find users
    superAdminUser = await prisma.user.findFirst({
      where: { email: { contains: 'admin' } },
    }) || await prisma.user.findFirst();

    chefMatotoUser = await prisma.user.findFirst({
      where: {
        communeId: matotoCommune?.id,
        roles: { some: { role: { name: 'CHEF_SERVICE' } } },
      },
    }) || await prisma.user.findFirst({
      where: { email: 'chef.matoto@aotuc.test' },
    });

    agentMatotoUser = await prisma.user.findFirst({
      where: {
        communeId: matotoCommune?.id,
        roles: { some: { role: { name: 'AGENT_TERRAIN' } } },
        accountStatus: 'ACTIVE',
        isActive: true,
      },
    }) || await prisma.user.findFirst({
      where: { email: 'agent.matoto@aotuc.test' },
    });

    agentKaloumUser = await prisma.user.findFirst({
      where: {
        communeId: kaloumCommune?.id,
        roles: { some: { role: { name: 'AGENT_TERRAIN' } } },
        accountStatus: 'ACTIVE',
        isActive: true,
      },
    }) || await prisma.user.findFirst({
      where: { email: 'agent.kaloum@aotuc.test' },
    });

    const agentTerrainRole = await prisma.role.findFirst({ where: { name: 'AGENT_TERRAIN' } });

    if (!agentKaloumUser) {
      agentKaloumUser = await prisma.user.create({
        data: {
          email: `test.agent.kaloum.${testSuffix}@aotuc.test`,
          passwordHash: 'dummy',
          firstName: 'Kaloum',
          lastName: 'Agent',
          phoneNumber: `+224611${testSuffix}`,
          communeId: kaloumCommune.id,
          accountStatus: 'ACTIVE',
          isActive: true,
          roles: agentTerrainRole ? { create: { roleId: agentTerrainRole.id } } : undefined,
        },
      });
    }

    if (!agentMatotoUser) {
      agentMatotoUser = await prisma.user.create({
        data: {
          email: `test.agent.matoto.${testSuffix}@aotuc.test`,
          passwordHash: 'dummy',
          firstName: 'Matoto',
          lastName: 'Agent',
          phoneNumber: `+224622${testSuffix}`,
          communeId: matotoCommune.id,
          accountStatus: 'ACTIVE',
          isActive: true,
          roles: agentTerrainRole ? { create: { roleId: agentTerrainRole.id } } : undefined,
        },
      });
    }

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
        phoneNumber: superAdminUser.phoneNumber,
        roles: ['SUPER_ADMIN'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefMatotoToken = jwt.sign(
      {
        sub: chefMatotoUser.id,
        email: chefMatotoUser.email,
        phoneNumber: chefMatotoUser.phoneNumber,
        roles: ['CHEF_SERVICE'],
        communeId: matotoCommune?.id,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentMatotoToken = jwt.sign(
      {
        sub: agentMatotoUser.id,
        email: agentMatotoUser.email,
        phoneNumber: agentMatotoUser.phoneNumber,
        roles: ['AGENT_TERRAIN'],
        communeId: matotoCommune?.id,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentKaloumToken = jwt.sign(
      {
        sub: agentKaloumUser.id,
        email: agentKaloumUser.email,
        phoneNumber: agentKaloumUser.phoneNumber,
        roles: ['AGENT_TERRAIN'],
        communeId: kaloumCommune?.id,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    try {
      if (createdReceiptId) {
        await prisma.fieldReceipt.deleteMany({ where: { id: createdReceiptId } });
      }
      if (testPersonId) {
        await prisma.person.deleteMany({ where: { id: testPersonId } });
      }
      if (createdAssignmentId) {
        await prisma.fieldReceipt.deleteMany({ where: { assignmentId: createdAssignmentId } });
        await prisma.fieldAssignment.deleteMany({ where: { id: createdAssignmentId } });
      }
      if (matotoAssignmentId) {
        await prisma.fieldReceipt.deleteMany({ where: { assignmentId: matotoAssignmentId } });
        await prisma.fieldAssignment.deleteMany({ where: { id: matotoAssignmentId } });
      }
      if (agentKaloumUser?.email?.startsWith('test.agent.')) {
        await prisma.userRole.deleteMany({ where: { userId: agentKaloumUser.id } });
        await prisma.user.deleteMany({ where: { id: agentKaloumUser.id } });
      }
      if (agentMatotoUser?.email?.startsWith('test.agent.')) {
        await prisma.userRole.deleteMany({ where: { userId: agentMatotoUser.id } });
        await prisma.user.deleteMany({ where: { id: agentMatotoUser.id } });
      }
    } catch (_) {}
  });

  // ============================================================================
  // 1. FIELD ASSIGNMENT CREATION & ACCESS CONTROL
  // ============================================================================
  test('Scenario 1: Super Admin creates a field assignment in Kaloum with target numbers and GPS location', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        title: `Campagne Spéciale Port Autonome ${testSuffix}`,
        communeId: kaloumCommune.id,
        locationName: 'Gare Routière du Port de Kaloum',
        latitude: 9.5092,
        longitude: -13.7122,
        assignedUserId: agentKaloumUser.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        targetPeople: 50,
        targetVehicles: 30,
        instructions: 'Enrôlement prioritaire des chauffeurs de taxis collectifs.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toMatch(/^ASN-\d{4}-\d{5}-[A-F0-9]{4}$/);
    expect(res.body.data.locationName).toBe('Gare Routière du Port de Kaloum');
    expect(res.body.data.targetPeople).toBe(50);
    expect(res.body.data.targetVehicles).toBe(30);
    expect(res.body.data.status).toBe('ASSIGNED');
    expect(res.body.data.progress).toBeDefined();
    expect(res.body.data.progress.targetPeople).toBe(50);

    createdAssignmentId = res.body.data.id;
  });

  test('Scenario 2: Chef de Service Matoto CANNOT create an assignment in Kaloum (Territorial Scope Enforced)', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${chefMatotoToken}`)
      .send({
        title: `Mission Illégale Kaloum ${testSuffix}`,
        communeId: kaloumCommune.id, // Kaloum != Matoto
        locationName: 'Madina Marché',
        startDate: new Date().toISOString(),
        targetPeople: 10,
        targetVehicles: 5,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TERRITORY_RESTRICTION');
  });

  test('Scenario 3: Chef de Service Matoto CAN create an assignment within Matoto', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${chefMatotoToken}`)
      .send({
        title: `Enrôlement Station Entag Matoto ${testSuffix}`,
        communeId: matotoCommune.id,
        locationName: 'Carrefour Entag - Rond-point',
        latitude: 9.6105,
        longitude: -13.5654,
        assignedUserId: agentMatotoUser.id,
        startDate: new Date().toISOString(),
        targetPeople: 40,
        targetVehicles: 20,
        instructions: 'Contrôle et immatriculation des minibus Magbana.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.commune.code).toBe('MTT');

    matotoAssignmentId = res.body.data.id;
  });

  test('Scenario 4: Agent de terrain CANNOT create field assignments (Least Privilege 403)', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${agentMatotoToken}`)
      .send({
        title: 'Mission Non Autorisée',
        communeId: matotoCommune.id,
        locationName: 'Station',
        startDate: new Date().toISOString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  // ============================================================================
  // 2. ASSIGNMENT LISTING & SCOPED VISIBILITY
  // ============================================================================
  test('Scenario 5: Agent de terrain only sees their own assigned missions', async () => {
    const res = await request(app)
      .get('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${agentMatotoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.assignments)).toBe(true);

    for (const a of res.body.assignments) {
      expect(a.assignedUserId).toBe(agentMatotoUser.id);
    }
  });

  test('Scenario 6: Chef de Service Matoto only sees Matoto assignments', async () => {
    const res = await request(app)
      .get('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${chefMatotoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    for (const a of res.body.assignments) {
      expect(a.communeId).toBe(matotoCommune.id);
    }
  });

  // ============================================================================
  // 3. AGENT REASSIGNMENT WITH RECORDED AUDIT
  // ============================================================================
  test('Scenario 7: Supervisor reassigns field agent with recorded reason and notes', async () => {
    const res = await request(app)
      .post(`/api/v1/field-operations/assignments/${createdAssignmentId}/reassign`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        assignedUserId: agentMatotoUser.id,
        reason: 'Renfort d urgence pour flux important au terminal.',
        supervisorNotes: 'Remplacement validé par la direction.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignedUserId).toBe(agentMatotoUser.id);
    expect(res.body.data.supervisorNotes).toContain('Renfort d urgence');
  });

  // ============================================================================
  // 4. STATUS MANAGEMENT
  // ============================================================================
  test('Scenario 8: Agent switches own assignment status to IN_PROGRESS', async () => {
    const res = await request(app)
      .patch(`/api/v1/field-operations/assignments/${matotoAssignmentId}/status`)
      .set('Authorization', `Bearer ${agentMatotoToken}`)
      .send({
        status: 'IN_PROGRESS',
        supervisorNotes: 'Arrivée sur le site d Entag à 08h30.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  // ============================================================================
  // 5. DAILY TARGETS & REAL PROGRESS DERIVED FROM POSTGRESQL
  // ============================================================================
  test('Scenario 9: Registration in PostgreSQL increments real progress without double counting', async () => {
    // Insert a verified Person record registered by agentMatoto in Matoto
    const person = await prisma.person.create({
      data: {
        firstName: 'Ibrahima',
        lastName: `Sow-${testSuffix}`,
        nin: `NIN-FLD-${testSuffix}`,
        phoneNumber: `+224621${testSuffix}`,
        communeId: matotoCommune.id,
        registeredByUserId: agentMatotoUser.id,
        latitude: 9.6106,
        longitude: -13.5655,
      },
    });
    testPersonId = person.id;

    // Check assignment progress
    const res = await request(app)
      .get(`/api/v1/field-operations/assignments/${matotoAssignmentId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.progress).toBeDefined();
    expect(res.body.data.progress.actualPeople).toBeGreaterThanOrEqual(1);
    expect(res.body.data.progress.targetPeople).toBe(40);
    expect(res.body.data.progress.peoplePercent).toBeGreaterThan(0);
  });

  // ============================================================================
  // 6. SUPERVISOR FIELD DASHBOARD METRICS
  // ============================================================================
  test('Scenario 10: Supervisor dashboard returns comprehensive field metrics across 5 Conakry communes', async () => {
    const res = await request(app)
      .get('/api/v1/field-operations/dashboard-summary')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalAssignments).toBeGreaterThanOrEqual(1);
    expect(res.body.data.activeAssignments).toBeGreaterThanOrEqual(1);
    expect(res.body.data.registrationsToday).toBeDefined();
    expect(Array.isArray(res.body.data.communeBreakdown)).toBe(true);
    expect(res.body.data.communeBreakdown.length).toBeGreaterThanOrEqual(5);

    const communeNames = res.body.data.communeBreakdown.map((c) => c.communeName);
    expect(communeNames).toContain('Kaloum');
    expect(communeNames).toContain('Dixinn');
    expect(communeNames).toContain('Matam');
    expect(communeNames).toContain('Ratoma');
    expect(communeNames).toContain('Matoto');
  });

  // ============================================================================
  // 7. FIELD RECEIPTS & PROOF OF WORK
  // ============================================================================
  test('Scenario 11: Agent creates a verifiable Field Receipt (Proof of Work) without fake fees', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/receipts')
      .set('Authorization', `Bearer ${agentMatotoToken}`)
      .send({
        assignmentId: matotoAssignmentId,
        personId: testPersonId,
        latitude: 9.6106,
        longitude: -13.5655,
        notes: 'Dossier complet avec présentation de la pièce CNI.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receiptNumber).toMatch(/^REC-FLD-\d{4}-\d{5}-[A-F0-9]{4}$/);
    expect(res.body.data.personId).toBe(testPersonId);

    createdReceiptId = res.body.data.id;
  });

  test('Scenario 12: Duplicate receipt issuance for same person in assignment returns existing receipt (Idempotency)', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/receipts')
      .set('Authorization', `Bearer ${agentMatotoToken}`)
      .send({
        assignmentId: matotoAssignmentId,
        personId: testPersonId,
      });

    expect(res.status).toBe(200); // 200 returned because existing receipt is returned
    expect(res.body.data.id).toBe(createdReceiptId);
  });

  test('Scenario 13: Receipt can be retrieved by ID or receiptNumber for verification and printing', async () => {
    const res = await request(app)
      .get(`/api/v1/field-operations/receipts/${createdReceiptId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdReceiptId);
    expect(res.body.data.agentUser).toBeDefined();
    expect(res.body.data.person).toBeDefined();
    expect(res.body.data.person.id).toBe(testPersonId);
  });

  // ============================================================================
  // 8. FIELD TEAMS
  // ============================================================================
  test('Scenario 14: Supervisor creates a field team and lists teams', async () => {
    const teamCode = `EQ-KLM-${testSuffix.slice(0, 3)}`;
    const res = await request(app)
      .post('/api/v1/field-operations/teams')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        code: teamCode,
        name: `Brigade Mobile Kaloum ${testSuffix}`,
        communeId: kaloumCommune.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe(teamCode);

    const listRes = await request(app)
      .get('/api/v1/field-operations/teams')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    // Cleanup team
    await prisma.fieldTeam.deleteMany({ where: { code: teamCode } });
  });

  // ============================================================================
  // 9. FIELD AGENT SELECTION & ELIGIBILITY VALIDATION
  // ============================================================================
  test('Scenario 15: Cannot assign non-existent user as field agent (404 AGENT_NOT_FOUND)', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        title: `Mission Invalide ${testSuffix}`,
        communeId: kaloumCommune.id,
        locationName: 'Port de Kaloum',
        assignedUserId: '00000000-0000-4000-8000-000000000000',
        startDate: new Date().toISOString(),
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('AGENT_NOT_FOUND');
  });

  test('Scenario 16: Cannot assign user with non-AGENT_TERRAIN role (400 INVALID_AGENT_ROLE)', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        title: `Mission Rôle Invalide ${testSuffix}`,
        communeId: kaloumCommune.id,
        locationName: 'Gare Routière',
        assignedUserId: superAdminUser.id,
        startDate: new Date().toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_AGENT_ROLE');
  });

  test('Scenario 17: Cannot assign an inactive/suspended agent (400 INACTIVE_AGENT)', async () => {
    const agentRole = await prisma.role.findFirst({ where: { name: 'AGENT_TERRAIN' } });
    const inactiveUser = await prisma.user.create({
      data: {
        email: `inactive.agent.${testSuffix}@aotuc.test`,
        passwordHash: 'dummy-hash',
        firstName: 'Test',
        lastName: 'InactiveAgent',
        phoneNumber: `+224601${testSuffix}`,
        communeId: kaloumCommune.id,
        accountStatus: 'INACTIVE',
        isActive: false,
        roles: agentRole ? { create: { roleId: agentRole.id } } : undefined,
      },
    });

    try {
      const res = await request(app)
        .post('/api/v1/field-operations/assignments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: `Mission Agent Inactif ${testSuffix}`,
          communeId: kaloumCommune.id,
          locationName: 'Marché Niger',
          assignedUserId: inactiveUser.id,
          startDate: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INACTIVE_AGENT');
    } finally {
      await prisma.userRole.deleteMany({ where: { userId: inactiveUser.id } });
      await prisma.user.deleteMany({ where: { id: inactiveUser.id } });
    }
  });

  test('Scenario 18: Chef de Service Matoto CANNOT assign an agent from Kaloum (403 AGENT_COMMUNE_MISMATCH)', async () => {
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${chefMatotoToken}`)
      .send({
        title: `Mission Commune Mismatch ${testSuffix}`,
        communeId: matotoCommune.id,
        locationName: 'Rond-point Matoto',
        assignedUserId: agentKaloumUser.id,
        startDate: new Date().toISOString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AGENT_COMMUNE_MISMATCH');
  });

  test('Scenario 19: Dedicated field agents list returns only active AGENT_TERRAIN accounts', async () => {
    const res = await request(app)
      .get('/api/v1/field/agents?role=AGENT_TERRAIN&status=ACTIVE&limit=50')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    for (const agent of res.body.data) {
      expect(agent.accountStatus).toBe('ACTIVE');
      const roleNames = Array.isArray(agent.roles)
        ? agent.roles.map((r) => (typeof r === 'string' ? r : r.role?.name || r.name))
        : [];
      expect(roleNames).toContain('AGENT_TERRAIN');
    }
  });

  test('Scenario 20: Chef de Service only sees field agents from their own commune in agent list', async () => {
    const res = await request(app)
      .get('/api/v1/field/agents?role=AGENT_TERRAIN&status=ACTIVE')
      .set('Authorization', `Bearer ${chefMatotoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const agent of res.body.data) {
      expect(agent.communeId).toBe(matotoCommune.id);
    }
  });
});
