import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/utils/prisma.js';

async function backupDatabase() {
  const backupDir = path.resolve('./prisma/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-phase1-${timestamp}.json`);

  console.log('📦 Creating full database backup before Phase 1 migration...');

  const [
    communes,
    roles,
    users,
    userRoles,
    persons,
    drivers,
    owners,
    vehicles,
    vehicleInspections,
    vehicleAssignments,
    transportUnions,
    documents,
    validationRequests,
    validationSteps,
    driverBadges,
    transportLicences,
    credentialRevocations,
    transportLines,
    transportStops,
    lineStops,
    ticketTariffs,
    ticketBatches,
    ticketSales,
    financialAccounts,
    financialLedgerEntries,
    auditLogs,
  ] = await Promise.all([
    prisma.commune.findMany(),
    prisma.role.findMany(),
    prisma.user.findMany(),
    prisma.userRole.findMany(),
    prisma.person.findMany(),
    prisma.driver.findMany(),
    prisma.owner.findMany(),
    prisma.vehicle.findMany(),
    prisma.vehicleInspection.findMany(),
    prisma.vehicleAssignment.findMany(),
    prisma.transportUnion.findMany(),
    prisma.document.findMany(),
    prisma.validationRequest.findMany(),
    prisma.validationStep.findMany(),
    prisma.driverBadge.findMany(),
    prisma.transportLicence.findMany(),
    prisma.credentialRevocation.findMany(),
    prisma.transportLine.findMany(),
    prisma.transportStop.findMany(),
    prisma.lineStop.findMany(),
    prisma.ticketTariff.findMany(),
    prisma.ticketBatch.findMany(),
    prisma.ticketSale.findMany(),
    prisma.financialAccount.findMany(),
    prisma.financialLedgerEntry.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const payload = {
    createdAt: new Date().toISOString(),
    counts: {
      communes: communes.length,
      roles: roles.length,
      users: users.length,
      persons: persons.length,
      drivers: drivers.length,
      owners: owners.length,
      vehicles: vehicles.length,
      transportLines: transportLines.length,
      transportStops: transportStops.length,
      auditLogs: auditLogs.length,
    },
    data: {
      communes,
      roles,
      users,
      userRoles,
      persons,
      drivers,
      owners,
      vehicles,
      vehicleInspections,
      vehicleAssignments,
      transportUnions,
      documents,
      validationRequests,
      validationSteps,
      driverBadges,
      transportLicences,
      credentialRevocations,
      transportLines,
      transportStops,
      lineStops,
      ticketTariffs,
      ticketBatches,
      ticketSales,
      financialAccounts,
      financialLedgerEntries,
      auditLogs,
    },
  };

  // Serialize BigInt values safely
  const jsonString = JSON.stringify(
    payload,
    (_, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );

  fs.writeFileSync(backupFile, jsonString, 'utf-8');
  console.log(`✅ Backup saved to: ${backupFile}`);
  console.log('📊 Record counts:', payload.counts);
}

backupDatabase()
  .catch((err) => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
