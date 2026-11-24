import prisma from '../src/utils/prisma.js';
import FieldOperationsService from '../src/modules/field-operations/field-operations.service.js';
import InspectionsService from '../src/modules/field-operations/inspections.service.js';
import MissionReportsService from '../src/modules/field-operations/mission-reports.service.js';

async function run() {
  console.log('--- TESTING STAGES 4, 5, 6 (MISSIONS, INSPECTIONS, REPORTS) ---');

  // Load actors
  const chefKaloum = await prisma.user.findFirst({
    where: { email: 'chef.kaloum@aotuc.test' },
    include: { roles: { include: { role: true } } },
  });
  chefKaloum.roles = chefKaloum.roles.map(r => r.role.name);

  const chefMatoto = await prisma.user.findFirst({
    where: { email: 'chef.matoto@aotuc.test' },
    include: { roles: { include: { role: true } } },
  });
  chefMatoto.roles = chefMatoto.roles.map(r => r.role.name);

  // Find two agents in Kaloum or Matoto
  const allAgents = await prisma.user.findMany({
    where: {
      roles: { some: { role: { name: 'AGENT_TERRAIN' } } },
    },
    include: { roles: { include: { role: true } } },
    take: 2,
  });

  const agent1 = allAgents[0];
  agent1.roles = agent1.roles.map(r => r.role.name);
  const agent2 = allAgents[1] || allAgents[0];
  agent2.roles = agent2.roles.map(r => r.role.name);

  console.log(`Supervisor: ${chefKaloum.email} (Commune: ${chefKaloum.communeId})`);
  console.log(`Agent 1 (Lead): ${agent1.email} (${agent1.id})`);
  console.log(`Agent 2 (Contributor): ${agent2.email} (${agent2.id})`);

  // Pre-cleanup leftover test missions
  const leftover = await prisma.fieldAssignment.findMany({
    where: { title: { in: ['Mission Contrôle Flotte Kaloum Test', 'Mission Test Annulation'] } },
    select: { id: true },
  });
  if (leftover.length > 0) {
    const ids = leftover.map(m => m.id);
    await prisma.inspectionDocument.deleteMany({ where: { inspection: { assignmentId: { in: ids } } } });
    await prisma.fieldInspection.deleteMany({ where: { assignmentId: { in: ids } } });
    await prisma.missionReportVersion.deleteMany({ where: { report: { assignmentId: { in: ids } } } });
    await prisma.missionReport.deleteMany({ where: { assignmentId: { in: ids } } });
    await prisma.fieldAssignmentAgent.deleteMany({ where: { assignmentId: { in: ids } } });
    await prisma.fieldAssignment.deleteMany({ where: { id: { in: ids } } });
  }

  // 1. Create Multi-Agent Mission in Kaloum
  const mission = await FieldOperationsService.createAssignment(chefKaloum, {
    title: 'Mission Contrôle Flotte Kaloum Test',
    communeId: chefKaloum.communeId,
    locationName: 'Gare Routière Kaloum Port',
    startDate: new Date().toISOString(),
    assignedAgents: [
      { userId: agent1.id, role: 'LEAD' },
      { userId: agent2.id, role: 'CONTRIBUTOR' },
    ],
    targetVehicles: 10,
    instructions: 'Vérifier la conformité des permis et vignettes municipales.',
  });

  console.log(`1. Mission created: ${mission.reference} (${mission.id}) - Status: ${mission.status}`);
  if (mission.status !== 'ASSIGNED') throw new Error(`Expected ASSIGNED but got ${mission.status}`);

  // 2. Start Mission: ASSIGNED -> IN_PROGRESS
  const started = await FieldOperationsService.updateStatus(agent1, mission.id, {
    status: 'IN_PROGRESS',
    supervisorNotes: 'Début des patrouilles sur le terrain.',
  });
  console.log(`2. Mission started: Status=${started.status}`);
  if (started.status !== 'IN_PROGRESS') throw new Error(`Expected IN_PROGRESS but got ${started.status}`);

  // 3. Record Field Inspection with Three-State Checkpoints
  const inspection1 = await InspectionsService.createInspection(agent1, {
    missionId: mission.id,
    vehiclePlate: 'RC-1234-A',
    driverName: 'Mamadou Diallo',
    driverLicenseNumber: 'PC-2024-9988',
    checkpointDriverLicense: 'CONFORME',
    checkpointVehiclePermit: 'NON_CONFORME',
    checkpointTechnicalVisit: 'NOT_CHECKED',
    checkpointFireExtinguisher: 'CONFORME',
    infractions: ['Vignette municipale expirée ou non apposée'],
    notes: 'Le chauffeur a présenté une ancienne quittance.',
    outcome: 'AVEC_RESERVES',
  });
  console.log(`3. Inspection recorded: ${inspection1.reference} - Outcome: ${inspection1.outcome} (Plate: ${inspection1.plateNumber})`);

  // 4. Contributing Agent adds observation to shared report
  const initialDraft = await MissionReportsService.saveOrSubmitReport(agent1, {
    missionId: mission.id,
    executiveSummary: 'Opération de contrôle menée avec succès à Kaloum Port.',
    objectivesAssessed: 'Contrôle des permis et vignettes',
  }, false);
  console.log(`4. Shared report draft created: ${initialDraft.reference} - Status: ${initialDraft.status}`);

  const contribution = await MissionReportsService.contributeObservation(agent2, initialDraft.id, {
    text: 'Contrôle de 3 minibus supplémentaires à l entrée Est du port sans infraction majeure.',
  });
  console.log(`5. Contributor observation added by Agent 2: "${contribution.contribution.text.slice(0, 40)}..."`);

  // 5. Transition mission to AWAITING_REPORT
  const awaitingReport = await FieldOperationsService.updateStatus(agent1, mission.id, {
    status: 'AWAITING_REPORT',
  });
  console.log(`6. Mission transitioned: Status=${awaitingReport.status}`);

  // 6. Contributor agent tries to formally submit -> MUST FAIL (Lead agent only)
  try {
    await MissionReportsService.saveOrSubmitReport(agent2, {
      missionId: mission.id,
      executiveSummary: 'Soumission par contributeur',
    }, true);
    console.error('FAIL: Contributor agent should not be able to submit report');
  } catch (err) {
    console.log(`7. SUCCESS: Prevented non-lead submission: ${err.message}`);
  }

  // 7. Lead agent formally submits report -> creates version 1 snapshot, mission becomes SUBMITTED
  const submittedReport = await MissionReportsService.saveOrSubmitReport(agent1, {
    missionId: mission.id,
    executiveSummary: 'Rapport complet consolidé : 1 véhicule en infraction, 3 conformes.',
    recommendations: 'Intensifier les contrôles le matin.',
  }, true);
  console.log(`8. Report submitted: Version=${submittedReport.currentVersion}, Status=${submittedReport.status}`);

  const missionAfterSubmit = await prisma.fieldAssignment.findUnique({ where: { id: mission.id } });
  console.log(`   Mission status synchronized to: ${missionAfterSubmit.status}`);

  // 8. Supervisor Review: CHANGES_REQUESTED
  const changesReq = await MissionReportsService.reviewReport(chefKaloum, submittedReport.id, {
    decision: 'CHANGES_REQUESTED',
    reviewNotes: 'Merci de préciser l heure exacte du contrôle du véhicule RC-1234-A.',
  });
  console.log(`9. Supervisor requested changes: Status=${changesReq.status}`);

  // 9. Lead Agent resubmits -> creates version 2 snapshot
  const resubmitted = await MissionReportsService.saveOrSubmitReport(agent1, {
    missionId: mission.id,
    executiveSummary: 'Rapport mis à jour : Contrôle RC-1234-A effectué à 10h15. Amende notifiée.',
  }, true);
  console.log(`10. Report resubmitted: Version=${resubmitted.currentVersion}, Status=${resubmitted.status}`);

  // 10. Supervisor Review: APPROVED
  const approved = await MissionReportsService.reviewReport(chefKaloum, resubmitted.id, {
    decision: 'APPROVED',
    reviewNotes: 'Rapport complet et validé. Félicitations à l équipe.',
  });
  console.log(`11. Report approved: Status=${approved.status}`);

  // 11. Close Mission: APPROVED -> COMPLETED
  const completed = await FieldOperationsService.updateStatus(chefKaloum, mission.id, {
    status: 'COMPLETED',
    supervisorNotes: 'Mission archivée avec succès.',
  });
  console.log(`12. Mission completed: Status=${completed.status}`);

  // 12. Safety Verification: Terminated mission rejects new inspections
  try {
    await InspectionsService.createInspection(agent1, {
      missionId: mission.id,
      vehiclePlate: 'RC-9999-Z',
    });
    console.error('FAIL: Should reject inspection on completed mission');
  } catch (err) {
    console.log(`13. SUCCESS: Rejected inspection on completed mission: ${err.message}`);
  }

  // 13. Cancellation Test: Create another mission and cancel it with mandatory reason
  const missionToCancel = await FieldOperationsService.createAssignment(chefKaloum, {
    title: 'Mission Test Annulation',
    communeId: chefKaloum.communeId,
    locationName: 'Point de contrôle Madina Sud',
    startDate: new Date().toISOString(),
    assignedUserId: agent1.id,
  });

  const cancelled = await FieldOperationsService.cancelAssignment(chefKaloum, missionToCancel.id, {
    reason: 'Conditions météorologiques exceptionnelles et inondation de chaussée.',
  });
  console.log(`14. Mission cancelled: Status=${cancelled.status}, Reason: "${cancelled.cancellationReason}"`);

  // Clean up test data
  console.log('\n--- CLEANING UP TEST RECORDS CREATED IN VERIFICATION ---');
  await prisma.inspectionDocument.deleteMany({ where: { inspection: { assignmentId: { in: [mission.id, missionToCancel.id] } } } });
  await prisma.fieldInspection.deleteMany({ where: { assignmentId: { in: [mission.id, missionToCancel.id] } } });
  await prisma.missionReportVersion.deleteMany({ where: { report: { assignmentId: { in: [mission.id, missionToCancel.id] } } } });
  await prisma.missionReport.deleteMany({ where: { assignmentId: { in: [mission.id, missionToCancel.id] } } });
  await prisma.fieldAssignmentAgent.deleteMany({ where: { assignmentId: { in: [mission.id, missionToCancel.id] } } });
  await prisma.auditLog.deleteMany({ where: { targetRecordId: { in: [mission.id, missionToCancel.id, initialDraft.id, submittedReport.id] } } });
  await prisma.fieldAssignment.deleteMany({ where: { id: { in: [mission.id, missionToCancel.id] } } });
  console.log('Cleanup finished successfully!');
}

run().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
