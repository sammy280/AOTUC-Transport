const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING SAFE TEST DATA CLEANUP FOR PRODUCTION LAUNCH ---');

  // Verify users and master data before proceeding
  const userCount = await prisma.user.count();
  const communeCount = await prisma.commune.count();
  const roleCount = await prisma.role.count();
  const unionCount = await prisma.transportUnion.count();

  console.log(`Pre-check:`);
  console.log(`- Users: ${userCount} (Target: preserved)`);
  console.log(`- Communes: ${communeCount} (Target: preserved)`);
  console.log(`- Roles: ${roleCount} (Target: preserved)`);
  console.log(`- Unions: ${unionCount} (Target: preserved)`);

  if (userCount === 0 || communeCount === 0 || roleCount === 0) {
    throw new Error('Safety abort: Master data or users appear empty!');
  }

  // Execute cleanup in dependency order
  const results = await prisma.$transaction(async (tx) => {
    const deleted = {};

    // 1. Operational & Inspection child records
    deleted.inspectionDocuments = (await tx.inspectionDocument.deleteMany({})).count;
    deleted.fieldInspections = (await tx.fieldInspection.deleteMany({})).count;
    deleted.missionReportVersions = (await tx.missionReportVersion.deleteMany({})).count;
    deleted.missionReports = (await tx.missionReport.deleteMany({})).count;
    deleted.fieldAssignmentAgents = (await tx.fieldAssignmentAgent.deleteMany({})).count;
    deleted.fieldAssignments = (await tx.fieldAssignment.deleteMany({})).count;
    deleted.fieldReceipts = (await tx.fieldReceipt.deleteMany({})).count;
    deleted.fieldTeams = (await tx.fieldTeam.deleteMany({})).count;

    // 2. Ticketing & Financial test entries
    deleted.ticketSales = (await tx.ticketSale.deleteMany({})).count;
    deleted.ticketBatches = (await tx.ticketBatch.deleteMany({})).count;
    deleted.financialLedgerEntries = (await tx.financialLedgerEntry.deleteMany({})).count;

    // 3. Credentials & Validation
    deleted.credentialRevocations = (await tx.credentialRevocation.deleteMany({})).count;
    deleted.driverBadges = (await tx.driverBadge.deleteMany({})).count;
    deleted.transportLicences = (await tx.transportLicence.deleteMany({})).count;
    deleted.validationSteps = (await tx.validationStep.deleteMany({})).count;
    deleted.validationRequests = (await tx.validationRequest.deleteMany({})).count;

    // 4. Vehicles & Driver operations
    deleted.vehicleInspections = (await tx.vehicleInspection.deleteMany({})).count;
    deleted.vehicleAssignments = (await tx.vehicleAssignment.deleteMany({})).count;
    deleted.documents = (await tx.document.deleteMany({})).count;
    deleted.vehicles = (await tx.vehicle.deleteMany({})).count;
    deleted.drivers = (await tx.driver.deleteMany({})).count;
    deleted.owners = (await tx.owner.deleteMany({})).count;
    deleted.persons = (await tx.person.deleteMany({})).count;

    // 5. Test Audit Logs
    deleted.auditLogs = (await tx.auditLog.deleteMany({})).count;

    return deleted;
  }, {
    timeout: 60000,
    maxWait: 15000
  });

  console.log('\n--- CLEANUP REPORT ---');
  for (const [table, count] of Object.entries(results)) {
    console.log(`Deleted from ${table}: ${count}`);
  }

  // Post-check master data
  const postUsers = await prisma.user.count();
  const postCommunes = await prisma.commune.count();
  const postRoles = await prisma.role.count();
  const postUnions = await prisma.transportUnion.count();
  const postLines = await prisma.transportLine.count();
  const postStops = await prisma.transportStop.count();

  console.log('\n--- POST-CLEANUP VERIFICATION (MASTER DATA PRESERVED) ---');
  console.log(`- Users: ${postUsers} (Must be ${userCount})`);
  console.log(`- Communes: ${postCommunes} (Must be ${communeCount})`);
  console.log(`- Roles: ${postRoles} (Must be ${roleCount})`);
  console.log(`- Unions: ${postUnions} (Must be ${unionCount})`);
  console.log(`- Transport Lines: ${postLines} (Must be 4)`);
  console.log(`- Transport Stops: ${postStops} (Must be 7)`);

  if (postUsers !== userCount || postCommunes !== communeCount || postRoles !== roleCount) {
    throw new Error('Fatal error: Master data discrepancy detected!');
  }

  console.log('\n>>> Database successfully prepared for official launch! <<<');
}

main().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
