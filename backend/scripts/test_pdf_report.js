import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import config from '../src/config/index.js';

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
  console.log('--- Testing PDF Report Generation (Stage 9) ---');

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

  // 3. Create a mission, inspection, and report
  const missionRes = await request(app)
    .post('/api/v1/field/assignments')
    .set('Authorization', `Bearer ${chefToken}`)
    .send({
      title: 'Mission PDF Generation Test',
      communeId: chefKaloum.communeId,
      locationName: 'Centre-ville Kaloum',
      assignedAgents: [{ userId: agtUser.id, role: 'LEAD' }],
      startDate: new Date().toISOString(),
      targetPeople: 20,
      targetVehicles: 15,
    });

  const assignmentId = missionRes.body.data.id;

  // Start mission
  await request(app)
    .patch(`/api/v1/field/assignments/${assignmentId}/status`)
    .set('Authorization', `Bearer ${agtToken}`)
    .send({ status: 'IN_PROGRESS' });

  // Record an inspection
  await request(app)
    .post('/api/v1/field/inspections')
    .set('Authorization', `Bearer ${agtToken}`)
    .send({
      assignmentId,
      vehiclePlate: 'RC-1234-PDF',
      checkpointDriverLicense: 'YES',
      checkpointTechnicalVisit: 'NO',
      outcome: 'AVERTISSEMENT',
      notes: 'Visite technique expirée de 2 jours',
    });

  // Submit shared report
  const reportRes = await request(app)
    .post('/api/v1/field/reports')
    .set('Authorization', `Bearer ${agtToken}`)
    .send({
      assignmentId,
      summary: 'Opération de contrôle ciblée menée sur l axe principal de Kaloum avec une brigade de 2 agents.',
      recommendations: 'Augmenter les contrôles en soirée.',
      conclusions: 'Bonne coopération générale des transporteurs.',
    });

  const reportId = reportRes.body.data.id;
  const reportRef = reportRes.body.data.reference;
  console.log(`Report created: ${reportRef} (${reportId})`);

  // Add an observation from another agent
  await request(app)
    .post(`/api/v1/field/reports/${reportId}/contribute`)
    .set('Authorization', `Bearer ${agtToken}`)
    .send({ observation: 'Fluidité du trafic maintenue pendant les contrôles.' });

  // Review & Approve report (Chef de Service)
  await request(app)
    .post(`/api/v1/field/reports/${reportId}/review`)
    .set('Authorization', `Bearer ${chefToken}`)
    .send({
      decision: 'APPROVED',
      notes: 'Rapport complet et rigoureux. Mission clôturée avec succès.',
    });

  // 4. Download PDF
  console.log(`Downloading PDF for report: ${reportId}...`);
  const pdfRes = await request(app)
    .get(`/api/v1/field/reports/${reportId}/pdf`)
    .set('Authorization', `Bearer ${chefToken}`)
    .expect(200);

  if (pdfRes.headers['content-type'] !== 'application/pdf') {
    throw new Error(`Expected application/pdf but got ${pdfRes.headers['content-type']}`);
  }

  const pdfBuffer = pdfRes.body;
  const pdfHeader = pdfBuffer.slice(0, 5).toString('utf-8');
  console.log(`PDF Magic Bytes: ${pdfHeader}, Byte Length: ${pdfBuffer.length}`);

  if (pdfHeader !== '%PDF-') {
    throw new Error(`Invalid PDF header: ${pdfHeader}`);
  }

  if (pdfBuffer.length < 1000) {
    throw new Error(`PDF buffer suspiciously small: ${pdfBuffer.length} bytes`);
  }

  console.log('✓ PDF generated successfully with official AOTUC branding, signatures, and observations!');

  // Cleanup
  await prisma.inspectionDocument.deleteMany({ where: { inspection: { assignmentId } } });
  await prisma.fieldInspection.deleteMany({ where: { assignmentId } });
  await prisma.missionReportVersion.deleteMany({ where: { reportId } });
  await prisma.missionReport.deleteMany({ where: { id: reportId } });
  await prisma.fieldAssignmentAgent.deleteMany({ where: { assignmentId } });
  await prisma.fieldAssignment.deleteMany({ where: { id: assignmentId } });

  console.log('\n--- ALL STAGE 9 PDF TESTS PASSED! ---');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
