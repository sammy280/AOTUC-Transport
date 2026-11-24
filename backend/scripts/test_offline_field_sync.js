import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import config from '../src/config/index.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

function createTestToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      communeId: user.communeId || null,
      isActive: true,
    },
    config.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
}

async function run() {
  console.log('--- Testing Offline Field Operations Sync (Stage 8) ---');

  // 1. Fetch Kaloum Chef de Service
  const chefKaloum = await prisma.user.findFirst({
    where: { email: 'chef.kaloum@aotuc.test' },
    include: { roles: { include: { role: true } } },
  });
  chefKaloum.roles = chefKaloum.roles.map((r) => r.role.name);
  const chefToken = createTestToken(chefKaloum);

  // 2. Fetch Agent
  const agtUser = await prisma.user.findFirst({
    where: {
      roles: { some: { role: { name: 'AGENT_TERRAIN' } } },
    },
    include: { roles: { include: { role: true } } },
  });
  agtUser.roles = agtUser.roles.map((r) => r.role.name);
  const agtToken = createTestToken(agtUser);

  console.log(`Agent authenticated: ${agtUser.email} (ID: ${agtUser.id})`);

  // 3. Create an active mission in Kaloum
  const missionRes = await request(app)
    .post('/api/v1/field/assignments')
    .set('Authorization', `Bearer ${chefToken}`)
    .send({
      title: 'Mission Sync Offline Test',
      communeId: chefKaloum.communeId,
      locationName: 'Port Autonome de Conakry',
      assignedAgents: [{ userId: agtUser.id, role: 'LEAD' }],
      startDate: new Date().toISOString(),
      targetPeople: 10,
      targetVehicles: 10,
    });

  if (missionRes.status !== 201) {
    throw new Error(`Failed to create mission: ${JSON.stringify(missionRes.body)}`);
  }
  const assignmentId = missionRes.body.data.id;
  console.log(`Assignment created: ${assignmentId}`);

  // Move mission from ASSIGNED to IN_PROGRESS
  await request(app)
    .patch(`/api/v1/field/assignments/${assignmentId}/status`)
    .set('Authorization', `Bearer ${agtToken}`)
    .send({ status: 'IN_PROGRESS' });

  // 4. Test 1: PUSH Offline FIELD_INSPECTION
  const inspectionClientId = crypto.randomUUID();
  const pushRes1 = await request(app)
    .post('/api/v1/sync/push')
    .set('Authorization', `Bearer ${agtToken}`)
    .send({
      deviceId: 'AOTUC-DEV-OFFLINE-01',
      items: [
        {
          clientGeneratedId: inspectionClientId,
          agentUserId: agtUser.id,
          entityType: 'FIELD_INSPECTION',
          createdOfflineAt: new Date().toISOString(),
          payload: {
            assignmentId,
            vehiclePlate: 'RC-9988-OFFLINE',
            driverName: 'Chauffeur Terrain Offline',
            checkpointDriverLicense: 'YES',
            checkpointTechnicalVisit: 'YES',
            checkpointFireExtinguisher: 'NO',
            outcome: 'AVERTISSEMENT',
            notes: 'Contrôlé hors ligne en brigade mobile',
          },
        },
      ],
    });

  if (pushRes1.status !== 200 || pushRes1.body.data.accepted !== 1) {
    console.error('Push inspection failed:', pushRes1.body);
    throw new Error('Push inspection offline failed');
  }
  const inspectionServerId = pushRes1.body.data.results[0].serverRecordId;
  console.log(`✓ Offline inspection synced successfully! Server ID: ${inspectionServerId}`);

  // Verify in DB
  const savedInsp = await prisma.fieldInspection.findUnique({ where: { id: inspectionServerId } });
  if (!savedInsp || savedInsp.plateNumber !== 'RC-9988-OFFLINE') {
    throw new Error('Inspection DB record mismatch');
  }
  console.log(`✓ DB record verified: ${savedInsp.reference}, outcome: ${savedInsp.outcome}`);

  // 5. Test 2: Idempotency (re-push same clientGeneratedId)
  const pushResIdempotent = await request(app)
    .post('/api/v1/sync/push')
    .set('Authorization', `Bearer ${agtToken}`)
    .send({
      deviceId: 'AOTUC-DEV-OFFLINE-01',
      items: [
        {
          clientGeneratedId: inspectionClientId,
          agentUserId: agtUser.id,
          entityType: 'FIELD_INSPECTION',
          createdOfflineAt: new Date().toISOString(),
          payload: {
            assignmentId,
            vehiclePlate: 'RC-9988-OFFLINE',
          },
        },
      ],
    });

  if (pushResIdempotent.body.data.results[0].status !== 'ALREADY_SYNCED') {
    throw new Error(`Expected ALREADY_SYNCED but got: ${JSON.stringify(pushResIdempotent.body)}`);
  }
  console.log('✓ Idempotency verified: duplicate clientGeneratedId safely detected as ALREADY_SYNCED.');

  // 6. Test 3: Attribution Mismatch Protection (attacker tries to push draft under someone else's agentUserId)
  const fakeAgentId = crypto.randomUUID();
  const pushResMismatch = await request(app)
    .post('/api/v1/sync/push')
    .set('Authorization', `Bearer ${agtToken}`)
    .send({
      deviceId: 'AOTUC-DEV-OFFLINE-01',
      items: [
        {
          clientGeneratedId: crypto.randomUUID(),
          agentUserId: fakeAgentId, // Mismatch with agtUser.id!
          entityType: 'FIELD_INSPECTION',
          createdOfflineAt: new Date().toISOString(),
          payload: {
            assignmentId,
            vehiclePlate: 'RC-HACK-01',
          },
        },
      ],
    });

  const mismatchResult = pushResMismatch.body.data.results[0];
  if (mismatchResult.errorCode !== 'ATTRIBUTION_MISMATCH') {
    throw new Error(`Expected ATTRIBUTION_MISMATCH but got: ${JSON.stringify(mismatchResult)}`);
  }
  console.log('✓ Attribution mismatch protection verified: draft with differing agentUserId strictly rejected!');

  // 7. Test 4: Offline MISSION_REPORT push
  const reportClientId = crypto.randomUUID();
  const pushResReport = await request(app)
    .post('/api/v1/sync/push')
    .set('Authorization', `Bearer ${agtToken}`)
    .send({
      deviceId: 'AOTUC-DEV-OFFLINE-01',
      items: [
        {
          clientGeneratedId: reportClientId,
          agentUserId: agtUser.id,
          entityType: 'MISSION_REPORT',
          createdOfflineAt: new Date().toISOString(),
          payload: {
            assignmentId,
            summary: 'Rapport synchronisé depuis la tablette hors-ligne',
            recommendations: 'Maintenir la présence matinale',
            conclusions: 'Mission réussie hors connexion',
          },
        },
      ],
    });

  if (pushResReport.status !== 200 || pushResReport.body.data.accepted !== 1) {
    console.error('Push report failed:', pushResReport.body);
    throw new Error('Push mission report offline failed');
  }
  const reportServerId = pushResReport.body.data.results[0].serverRecordId;
  console.log(`✓ Offline mission report synced successfully! Server ID: ${reportServerId}`);

  const savedRpt = await prisma.missionReport.findUnique({ where: { id: reportServerId } });
  if (!savedRpt || savedRpt.currentVersion !== 1) {
    throw new Error('Mission report DB record mismatch');
  }
  console.log(`✓ DB report record verified: ${savedRpt.reference}, version: ${savedRpt.currentVersion}`);

  // Cleanup test data created
  await prisma.inspectionDocument.deleteMany({ where: { inspectionId: inspectionServerId } });
  await prisma.fieldInspection.deleteMany({ where: { id: inspectionServerId } });
  await prisma.missionReportVersion.deleteMany({ where: { reportId: reportServerId } });
  await prisma.missionReport.deleteMany({ where: { id: reportServerId } });
  await prisma.fieldAssignmentAgent.deleteMany({ where: { assignmentId } });
  await prisma.fieldAssignment.deleteMany({ where: { id: assignmentId } });

  console.log('\n--- ALL STAGE 8 OFFLINE FIELD SYNC TESTS PASSED! ---');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
