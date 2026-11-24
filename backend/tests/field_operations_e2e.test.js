import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import crypto from 'crypto';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('AOTUC Field Operations — Consolidated End-to-End Test Suite', () => {
  jest.setTimeout(60000);

  let superAdminUser;
  let chefKaloumUser;
  let chefMatotoUser;
  let agentKaloumLead;
  let agentKaloumMember;

  let superAdminToken;
  let chefKaloumToken;
  let chefMatotoToken;
  let agentLeadToken;
  let agentMemberToken;

  let kaloumCommune;
  let matotoCommune;

  let testAgentId = null;
  let testMissionId = null;
  let testInspectionId = null;
  let testReportId = null;

  function createToken(user, roles = null) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: roles || user.roles?.map(r => r.role?.name || r) || [],
        communeId: user.communeId || null,
        isActive: true,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  }

  beforeAll(async () => {
    kaloumCommune = await prisma.commune.findFirst({ where: { code: 'KLM' } });
    matotoCommune = await prisma.commune.findFirst({ where: { code: 'MTT' } });

    superAdminUser = await prisma.user.findFirst({
      where: { email: 'superadmin@aotuc.test' },
      include: { roles: { include: { role: true } } },
    });

    chefKaloumUser = await prisma.user.findFirst({
      where: { email: 'chef.kaloum@aotuc.test' },
      include: { roles: { include: { role: true } } },
    });

    chefMatotoUser = await prisma.user.findFirst({
      where: { email: 'chef.matoto@aotuc.test' },
      include: { roles: { include: { role: true } } },
    });

    const agents = await prisma.user.findMany({
      where: {
        roles: { some: { role: { name: 'AGENT_TERRAIN' } } },
      },
      include: { roles: { include: { role: true } } },
      take: 2,
    });

    agentKaloumLead = agents[0];
    agentKaloumMember = agents[1] || agents[0];

    superAdminToken = createToken(superAdminUser, ['SUPER_ADMIN']);
    chefKaloumToken = createToken(chefKaloumUser, ['CHEF_SERVICE']);
    chefMatotoToken = createToken(chefMatotoUser, ['CHEF_SERVICE']);
    agentLeadToken = createToken(agentKaloumLead, ['AGENT_TERRAIN']);
    agentMemberToken = createToken(agentKaloumMember, ['AGENT_TERRAIN']);
  });

  afterAll(async () => {
    // Cleanup any records created by this suite
    if (testInspectionId) {
      await prisma.inspectionDocument.deleteMany({ where: { inspectionId: testInspectionId } });
      await prisma.fieldInspection.deleteMany({ where: { id: testInspectionId } });
    }
    if (testReportId) {
      await prisma.missionReportVersion.deleteMany({ where: { reportId: testReportId } });
      await prisma.missionReport.deleteMany({ where: { id: testReportId } });
    }
    if (testMissionId) {
      await prisma.fieldInspection.deleteMany({ where: { assignmentId: testMissionId } });
      await prisma.missionReport.deleteMany({ where: { assignmentId: testMissionId } });
      await prisma.fieldAssignmentAgent.deleteMany({ where: { assignmentId: testMissionId } });
      await prisma.fieldAssignment.deleteMany({ where: { id: testMissionId } });
    }
    if (testAgentId) {
      await prisma.userRole.deleteMany({ where: { userId: testAgentId } });
      await prisma.user.deleteMany({ where: { id: testAgentId } });
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. AGENT MANAGEMENT & TERRITORIAL SCOPING
  // =========================================================================
  describe('1. Agent Management & Territorial Scoping', () => {
    it('Chef de Service CANNOT create an agent in another commune', async () => {
      const res = await request(app)
        .post('/api/v1/field/agents')
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          firstName: 'Illegal',
          lastName: 'CrossCommune',
          phoneNumber: '+224629990111',
          communeId: matotoCommune.id, // Kaloum chef trying to create in Matoto!
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Chef de Service CANNOT create a SUPER_ADMIN or DIRECTOR account', async () => {
      const uniquePhone1 = `+224629${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await request(app)
        .post('/api/v1/field/agents')
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          firstName: 'Elevated',
          lastName: 'Attempt',
          phoneNumber: uniquePhone1,
          communeId: kaloumCommune.id,
          role: 'SUPER_ADMIN',
        });

      // Role defaults strictly to AGENT_TERRAIN or is rejected
      if (res.status === 201) {
        const roleVal = res.body.data?.roles?.[0]?.name || res.body.data?.roles?.[0] || res.body.agent?.roles?.[0]?.name || res.body.agent?.roles?.[0];
        expect(roleVal).toBe('AGENT_TERRAIN');
      } else {
        expect(res.status).toBe(403);
      }
    });

    it('Chef de Service creates an AGENT_TERRAIN in their own commune', async () => {
      const uniquePhone2 = `+224629${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await request(app)
        .post('/api/v1/field/agents')
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          firstName: 'Ibrahima',
          lastName: 'Diallo',
          phoneNumber: uniquePhone2,
          communeId: kaloumCommune.id,
          jobTitle: 'Contrôleur Brigade Maritime',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const agentData = res.body.data || res.body.agent;
      expect(agentData.employeeNumber).toMatch(/^AGT-KLM-/);
      expect(agentData.accountStatus).toBe('ACTIVE');

      testAgentId = agentData.id;
    });

    it('Immediate deactivation/suspension: suspended agent cannot authenticate', async () => {
      const statusRes = await request(app)
        .patch(`/api/v1/field/agents/${testAgentId}/status`)
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          accountStatus: 'SUSPENDED',
          reason: 'Mesure conservatoire disciplinaire',
        });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.accountStatus).toBe('SUSPENDED');
      expect(statusRes.body.data.isActive).toBe(false);

      // Verify that token for this user is rejected
      const suspendedToken = createToken({ id: testAgentId, email: 'temp@test.gn' }, ['AGENT_TERRAIN']);
      const accessRes = await request(app)
        .get('/api/v1/field/assignments')
        .set('Authorization', `Bearer ${suspendedToken}`);

      expect(accessRes.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. MULTI-AGENT MISSION LIFECYCLE & SUPERVISOR CANCELLATION
  // =========================================================================
  describe('2. Multi-Agent Mission Management', () => {
    it('Creates a multi-agent mission with designated LEAD and CONTRIBUTOR', async () => {
      const res = await request(app)
        .post('/api/v1/field/assignments')
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          title: 'Mission Contrôle Port Autonome E2E',
          communeId: kaloumCommune.id,
          locationName: 'Rond-point Port de Conakry',
          startDate: new Date().toISOString(),
          assignedAgents: [
            { userId: agentKaloumLead.id, role: 'LEAD' },
            { userId: agentKaloumMember.id, role: 'CONTRIBUTOR' },
          ],
          targetPeople: 30,
          targetVehicles: 25,
          instructions: 'Contrôle des vignettes et licences de transport urbain.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('ASSIGNED');
      expect(res.body.data.assignedAgents.length).toBe(2);

      testMissionId = res.body.data.id;
    });

    it('Transitions mission status: ASSIGNED -> IN_PROGRESS', async () => {
      const res = await request(app)
        .patch(`/api/v1/field/assignments/${testMissionId}/status`)
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('Mission cancellation requires supervisor role and mandatory written reason', async () => {
      // 1. Agent cannot cancel
      const agentCancel = await request(app)
        .post(`/api/v1/field/assignments/${testMissionId}/cancel`)
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({ reason: 'Tentative agent' });

      expect(agentCancel.status).toBe(403);

      // 2. Supervisor without reason is rejected
      const noReason = await request(app)
        .post(`/api/v1/field/assignments/${testMissionId}/cancel`)
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({ reason: '' });

      expect(noReason.status).toBe(400);

      // 3. Supervisor cancels with valid reason
      const cancelRes = await request(app)
        .post(`/api/v1/field/assignments/${testMissionId}/cancel`)
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({ reason: 'Conditions météo extrêmes et alerte inondations' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      // 4. Cancelled mission rejects subsequent inspections
      const rejectInsp = await request(app)
        .post('/api/v1/field/inspections')
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({
          assignmentId: testMissionId,
          vehiclePlate: 'RC-9999-FAIL',
        });

      expect(rejectInsp.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. FIELD INSPECTIONS & THREE-STATE CHECKPOINTS
  // =========================================================================
  describe('3. Field Inspections & Three-State Checkpoints', () => {
    let activeMissionId;

    beforeAll(async () => {
      // Create an active mission for inspection tests
      const m = await request(app)
        .post('/api/v1/field/assignments')
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          title: 'Mission Contrôle Inspection E2E',
          communeId: kaloumCommune.id,
          locationName: 'Avenue de la République',
          startDate: new Date().toISOString(),
          assignedAgents: [{ userId: agentKaloumLead.id, role: 'LEAD' }],
        });
      activeMissionId = m.body.data.id;

      await request(app)
        .patch(`/api/v1/field/assignments/${activeMissionId}/status`)
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({ status: 'IN_PROGRESS' });
    });

    afterAll(async () => {
      if (activeMissionId) {
        await prisma.fieldInspection.deleteMany({ where: { assignmentId: activeMissionId } });
        await prisma.fieldAssignmentAgent.deleteMany({ where: { assignmentId: activeMissionId } });
        await prisma.fieldAssignment.deleteMany({ where: { id: activeMissionId } });
      }
    });

    it('Enforces 3-state checkpoints and defaults outcome to NOT_ASSESSED when unassessed', async () => {
      const res = await request(app)
        .post('/api/v1/field/inspections')
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({
          assignmentId: activeMissionId,
          vehiclePlate: 'RC-1010-E2E',
          driverName: 'Sékou Traoré',
          checkpointDriverLicense: 'YES',
          checkpointTechnicalVisit: 'NO',
          checkpointFireExtinguisher: 'NOT_CHECKED',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.outcome).toBe('NOT_ASSESSED');
      expect(res.body.data.hasValidLicense).toBe('YES');
      expect(res.body.data.hasTechnicalControl).toBe('NO');
      expect(res.body.data.hasSafetyEquipment).toBe('NOT_CHECKED');

      testInspectionId = res.body.data.id;
    });

    it('Separation of concerns: field inspection outcome does NOT modify ValidationRequest dossiers', async () => {
      const initialDossiers = await prisma.validationRequest.count();

      // Submit an infraction inspection
      await request(app)
        .post('/api/v1/field/inspections')
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({
          assignmentId: activeMissionId,
          vehiclePlate: 'RC-2020-INFRACTION',
          driverName: 'Mamadou Diallo',
          outcome: 'INFRACTION',
        });

      const afterDossiers = await prisma.validationRequest.count();
      expect(afterDossiers).toBe(initialDossiers); // Exact count preserved, no administrative dossier touched!
    });
  });

  // =========================================================================
  // 4. SHARED MISSION REPORT & HIERARCHICAL REVIEW LIFECYCLE
  // =========================================================================
  describe('4. Shared Mission Report & Review Workflow', () => {
    let reportMissionId;
    let createdReportId;

    beforeAll(async () => {
      const m = await request(app)
        .post('/api/v1/field/assignments')
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          title: 'Mission Rapport E2E',
          communeId: kaloumCommune.id,
          locationName: 'Gare Tombo',
          startDate: new Date().toISOString(),
          assignedAgents: [
            { userId: agentKaloumLead.id, role: 'LEAD' },
            { userId: agentKaloumMember.id, role: 'CONTRIBUTOR' },
          ],
        });
      reportMissionId = m.body.data.id;

      await request(app)
        .patch(`/api/v1/field/assignments/${reportMissionId}/status`)
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({ status: 'IN_PROGRESS' });
    });

    afterAll(async () => {
      if (reportMissionId) {
        await prisma.missionReportVersion.deleteMany({ where: { report: { assignmentId: reportMissionId } } });
        await prisma.missionReport.deleteMany({ where: { assignmentId: reportMissionId } });
        await prisma.fieldInspection.deleteMany({ where: { assignmentId: reportMissionId } });
        await prisma.fieldAssignmentAgent.deleteMany({ where: { assignmentId: reportMissionId } });
        await prisma.fieldAssignment.deleteMany({ where: { id: reportMissionId } });
      }
    });

    it('Contributing agent adds observation preserving identity and timestamp', async () => {
      // First save report draft
      const draftRes = await request(app)
        .post('/api/v1/field/reports/draft')
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({
          assignmentId: reportMissionId,
          summary: 'Brouillon initial du rapport',
        });

      expect(draftRes.status).toBe(200);
      createdReportId = draftRes.body.data.id;

      // Member agent contributes observation
      const obsRes = await request(app)
        .post(`/api/v1/field/reports/${createdReportId}/contribute`)
        .set('Authorization', `Bearer ${agentMemberToken}`)
        .send({
          observation: 'Embouteillage résolu au carrefour Tombo.',
        });

      expect(obsRes.status).toBe(200);
      const contributors = obsRes.body.data?.contributors || obsRes.body.report?.contributors;
      expect(contributors.length).toBeGreaterThan(0);
      const lastObs = contributors[contributors.length - 1];
      expect(lastObs.authorId).toBe(agentKaloumMember.id);
      expect(lastObs.timestamp).toBeDefined();
    });

    it('Lead agent submits report -> status SUBMITTED, version 1 snapshot', async () => {
      const res = await request(app)
        .post('/api/v1/field/reports')
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({
          assignmentId: reportMissionId,
          summary: 'Rapport consolidé v1 soumis pour approbation.',
          recommendations: 'Poursuivre les contrôles inopinés.',
          conclusions: 'Mission réussie.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.currentVersion).toBe(1);
    });

    it('Supervisor requests changes -> status CHANGES_REQUESTED with mandatory notes', async () => {
      const res = await request(app)
        .post(`/api/v1/field/reports/${createdReportId}/review`)
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          decision: 'CHANGES_REQUESTED',
          notes: 'Veuillez préciser le nombre de taxis collectifs contrôlés.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CHANGES_REQUESTED');
    });

    it('Lead agent resubmits report -> status SUBMITTED, version 2 snapshot', async () => {
      const res = await request(app)
        .post('/api/v1/field/reports')
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({
          assignmentId: reportMissionId,
          summary: 'Rapport consolidé v2 : 18 taxis collectifs et 12 minibus contrôlés.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.currentVersion).toBe(2);
    });

    it('Supervisor approves report -> status APPROVED and mission automatically COMPLETED', async () => {
      const res = await request(app)
        .post(`/api/v1/field/reports/${createdReportId}/review`)
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .send({
          decision: 'APPROVED',
          notes: 'Rapport validé. Félicitations à la brigade.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');

      // Verify mission is COMPLETED
      const mission = await prisma.fieldAssignment.findUnique({ where: { id: reportMissionId } });
      expect(mission.status).toBe('COMPLETED');
    });

    it('Downloads official stamped PDF document with %PDF- header', async () => {
      const res = await request(app)
        .get(`/api/v1/field/reports/${createdReportId}/pdf`)
        .set('Authorization', `Bearer ${chefKaloumToken}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      const header = res.body.slice(0, 5).toString('utf-8');
      expect(header).toBe('%PDF-');
      expect(res.body.length).toBeGreaterThan(1000);
    });
  });

  // =========================================================================
  // 5. OFFLINE SYNC ATTRIBUTION INTEGRITY
  // =========================================================================
  describe('5. Offline Sync Attribution Integrity', () => {
    it('Strictly rejects offline drafts whose agentUserId does not match authenticated user', async () => {
      const foreignId = crypto.randomUUID();
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentLeadToken}`)
        .send({
          deviceId: 'DEVICE-SEC-TEST',
          items: [
            {
              clientGeneratedId: crypto.randomUUID(),
              agentUserId: foreignId, // Spoofed creator ID!
              entityType: 'FIELD_INSPECTION',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                vehiclePlate: 'RC-SPOOFED',
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.failed).toBe(1);
      expect(res.body.data.results[0].errorCode).toBe('ATTRIBUTION_MISMATCH');
    });
  });
});
