import 'dotenv/config';
import { PrismaClient, RoleType } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding with FICTIONAL development test data...');

  // 1. Seed Communes of Conakry
  const communesData = [
    { code: 'KLM', name: 'Kaloum', description: 'Centre administratif et des affaires' },
    { code: 'DXN', name: 'Dixinn', description: 'Commune universitaire et résidentielle' },
    { code: 'MTM', name: 'Matam', description: 'Commune commerciale et portuaire' },
    { code: 'RTM', name: 'Ratoma', description: 'Grande commune résidentielle et axes routiers' },
    { code: 'MTT', name: 'Matoto', description: 'Plus grande commune urbaine de Conakry' },
    { code: 'KSS', name: 'Kassa', description: 'Îles de Loos' },
  ];

  const communes = {};
  for (const c of communesData) {
    const commune = await prisma.commune.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    communes[c.code] = commune;
  }
  console.log('✅ Communes seeded successfully.');

  // 2. Seed Primary Roles
  const rolesData = [
    { name: RoleType.SUPER_ADMIN, labelFr: 'Super Administrateur DSI', description: 'Accès complet au paramétrage et audit' },
    { name: RoleType.DIRECTOR, labelFr: 'Directeur Général AOTUC', description: 'Validation finale Niveau 3 et gouvernance' },
    { name: RoleType.CHEF_SERVICE, labelFr: 'Chef de Service Territorial', description: 'Examen de Niveau 2 par commune ou division' },
    { name: RoleType.AGENT_TERRAIN, labelFr: 'Agent d Enrôlement Terrain', description: 'Saisie et soumission Niveau 1 des dossiers' },
    { name: RoleType.SYNDICAT, labelFr: 'Représentant Syndical', description: 'Consultation des membres syndiqués' },
    { name: RoleType.DISTRIBUTEUR, labelFr: 'Distributeur Agréé Billetterie', description: 'Gestion des carnets et ventes de tickets' },
  ];

  const roles = {};
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { labelFr: r.labelFr, description: r.description },
      create: r,
    });
    roles[r.name] = role;
  }
  console.log('✅ Primary Roles seeded successfully.');

  // 3. Seed Development Accounts (FICTIONAL TEST CREDENTIALS)
  // Password for all dev accounts: "DevAotuc2026!"
  const defaultPasswordHash = await argon2.hash('DevAotuc2026!', {
    type: argon2.argon2id,
  });

  const testUsers = [
    {
      email: 'superadmin@aotuc.test',
      phoneNumber: '+224620000001',
      firstName: 'Ibrahima',
      lastName: 'Diallo',
      role: RoleType.SUPER_ADMIN,
      communeId: null,
    },
    {
      email: 'directeur@aotuc.test',
      phoneNumber: '+224620000002',
      firstName: 'Mamadou',
      lastName: 'Camara',
      role: RoleType.DIRECTOR,
      communeId: null,
    },
    {
      email: 'chef.matoto@aotuc.test',
      phoneNumber: '+224620000003',
      firstName: 'Fanta',
      lastName: 'Soumah',
      role: RoleType.CHEF_SERVICE,
      communeId: communes['MTT'].id,
    },
    {
      email: 'chef.kaloum@aotuc.test',
      phoneNumber: '+224620000004',
      firstName: 'Alpha',
      lastName: 'Barry',
      role: RoleType.CHEF_SERVICE,
      communeId: communes['KLM'].id,
    },
    {
      email: 'agent.matoto@aotuc.test',
      phoneNumber: '+224620000005',
      firstName: 'Sekou',
      lastName: 'Conte',
      role: RoleType.AGENT_TERRAIN,
      communeId: communes['MTT'].id,
    },
    {
      email: 'distributeur.kaloum@aotuc.test',
      phoneNumber: '+224620000006',
      firstName: 'Ousmane',
      lastName: 'Sylla',
      role: RoleType.DISTRIBUTEUR,
      communeId: communes['KLM'].id,
    },
  ];

  for (const u of testUsers) {
    const user = await prisma.user.upsert({
      where: { phoneNumber: u.phoneNumber },
      update: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        communeId: u.communeId,
      },
      create: {
        email: u.email,
        phoneNumber: u.phoneNumber,
        passwordHash: defaultPasswordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        communeId: u.communeId,
      },
    });

    // Assign Role
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: roles[u.role].id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: roles[u.role].id,
      },
    });
  }
  console.log('✅ Fictional development test users seeded successfully.');

  // 4. Seed Chart of Financial Accounts (Double-Entry Ledger in GNF)
  const financialAccounts = [
    { accountCode: '512100', name: 'Banque Centrale BCRG - Compte Général AOTUC', type: 'ACTIF', balanceGnf: 2500000000n },
    { accountCode: '531100', name: 'Caisse Principale AOTUC Conakry', type: 'ACTIF', balanceGnf: 45000000n },
    { accountCode: '411100', name: 'Créances Distributeurs & Points de Vente', type: 'ACTIF', balanceGnf: 12000000n },
    { accountCode: '706100', name: 'Produits des Ventes Titres de Transport', type: 'PRODUIT', balanceGnf: 0n },
  ];

  for (const fa of financialAccounts) {
    await prisma.financialAccount.upsert({
      where: { accountCode: fa.accountCode },
      update: { name: fa.name, type: fa.type },
      create: fa,
    });
  }
  console.log('✅ Chart of Financial Accounts seeded successfully.');

  // 5. Seed Ticket Tariffs
  const tariffsData = [
    { code: 'T-2000', name: 'Ticket Urbain Standard (2 000 GNF)', priceGnf: 2000, vehicleCategory: 'MINIBUS_URBAIN' },
    { code: 'T-5000', name: 'Ticket Express Conakry Direct (5 000 GNF)', priceGnf: 5000, vehicleCategory: 'AUTOBUS_GRAND_GABARIT' },
    { code: 'T-10000', name: 'Pass Journalier Toutes Lignes (10 000 GNF)', priceGnf: 10000, vehicleCategory: 'TOUS_VEHICULES' },
  ];

  const tariffs = {};
  for (const t of tariffsData) {
    const tariff = await prisma.ticketTariff.upsert({
      where: { code: t.code },
      update: { name: t.name, priceGnf: t.priceGnf, vehicleCategory: t.vehicleCategory },
      create: t,
    });
    tariffs[t.code] = tariff;
  }
  console.log('✅ Ticket Tariffs seeded successfully.');

  // 6. Seed Initial Ticket Carnet Batch (EN_STOCK_CENTRAL)
  await prisma.ticketBatch.upsert({
    where: { batchNumber: 'LOT-2026-0001' },
    update: {},
    create: {
      batchNumber: 'LOT-2026-0001',
      tariffId: tariffs['T-2000'].id,
      startSerial: 1000001n,
      endSerial: 1001000n,
      totalCount: 1000,
      remainingCount: 1000,
      status: 'EN_STOCK_CENTRAL',
    },
  });
  console.log('✅ Ticket Batch LOT-2026-0001 seeded successfully.');

  // 7. Seed Official Transport Stops of Conakry
  const stopsData = [
    { code: 'ARR-KLM-01', name: 'Palais du Peuple', communeId: communes['KLM'].id, latitude: 9.5241, longitude: -13.6892, isSheltered: true },
    { code: 'ARR-DXN-01', name: 'Université Gamal Abdel Nasser', communeId: communes['DXN'].id, latitude: 9.5375, longitude: -13.6765, isSheltered: true },
    { code: 'ARR-MTM-01', name: 'Grand Marché de Madina', communeId: communes['MTM'].id, latitude: 9.5482, longitude: -13.6558, isSheltered: true },
    { code: 'ARR-MTT-01', name: 'Aéroport Int. Ahmed Sékou Touré', communeId: communes['MTT'].id, latitude: 9.5768, longitude: -13.6121, isSheltered: true },
    { code: 'ARR-MTT-02', name: 'Gare Routière Entag', communeId: communes['MTT'].id, latitude: 9.6105, longitude: -13.5654, isSheltered: true },
    { code: 'ARR-RTM-01', name: 'Carrefour Bambéto', communeId: communes['RTM'].id, latitude: 9.5932, longitude: -13.6378, isSheltered: true },
    { code: 'ARR-RTM-02', name: 'Rond-Point Cosa', communeId: communes['RTM'].id, latitude: 9.6201, longitude: -13.6102, isSheltered: true },
  ];

  const stops = {};
  for (const s of stopsData) {
    const stop = await prisma.transportStop.upsert({
      where: { code: s.code },
      update: { name: s.name, latitude: s.latitude, longitude: s.longitude, isSheltered: s.isSheltered },
      create: s,
    });
    stops[s.code] = stop;
  }
  console.log('✅ Transport Stops seeded successfully.');

  // 8. Seed Transport Lines (Conakry Corridors)
  const linesData = [
    {
      code: 'L-01',
      name: 'Axe Autoroute Fidel Castro (Kaloum ↔ Entag)',
      colorHex: '#CE1126',
      originName: 'Palais du Peuple (Kaloum)',
      destinationName: 'Gare Routière Entag',
      distanceKm: 22.4,
      estimatedMinutes: 45,
      pathCoordinates: [
        [-13.6892, 9.5241],
        [-13.6765, 9.5375],
        [-13.6558, 9.5482],
        [-13.6121, 9.5768],
        [-13.5654, 9.6105],
      ],
    },
    {
      code: 'L-02',
      name: 'Axe Route Le Prince (Kaloum ↔ Cosa)',
      colorHex: '#FCD116',
      originName: 'Kaloum Port',
      destinationName: 'Cosa Marché',
      distanceKm: 19.8,
      estimatedMinutes: 50,
      pathCoordinates: [
        [-13.6892, 9.5241],
        [-13.6650, 9.5520],
        [-13.6378, 9.5932],
        [-13.6102, 9.6201],
      ],
    },
    {
      code: 'L-03',
      name: 'Corniche Nord (Dixinn ↔ Lambanyi)',
      colorHex: '#009460',
      originName: 'Dixinn Belle-Vue',
      destinationName: 'Lambanyi Carrefour',
      distanceKm: 16.5,
      estimatedMinutes: 40,
      pathCoordinates: [
        [-13.6765, 9.5375],
        [-13.6500, 9.5700],
        [-13.6200, 9.6050],
      ],
    },
    {
      code: 'L-04',
      name: 'Corniche Sud (Madina ↔ Dabompa)',
      colorHex: '#1E3A8A',
      originName: 'Madina Marché',
      destinationName: 'Dabompa Plateau',
      distanceKm: 21.0,
      estimatedMinutes: 48,
      pathCoordinates: [
        [-13.6558, 9.5482],
        [-13.6100, 9.5700],
        [-13.5500, 9.6100],
      ],
    },
  ];

  for (const l of linesData) {
    const line = await prisma.transportLine.upsert({
      where: { code: l.code },
      update: {
        name: l.name,
        colorHex: l.colorHex,
        originName: l.originName,
        destinationName: l.destinationName,
        distanceKm: l.distanceKm,
        estimatedMinutes: l.estimatedMinutes,
        pathCoordinates: l.pathCoordinates,
      },
      create: l,
    });

    // Link stops for Line 1
    if (l.code === 'L-01') {
      const lineStops = [
        { stopId: stops['ARR-KLM-01'].id, order: 1, dist: 0.0 },
        { stopId: stops['ARR-DXN-01'].id, order: 2, dist: 3.2 },
        { stopId: stops['ARR-MTM-01'].id, order: 3, dist: 6.5 },
        { stopId: stops['ARR-MTT-01'].id, order: 4, dist: 14.8 },
        { stopId: stops['ARR-MTT-02'].id, order: 5, dist: 22.4 },
      ];

      for (const ls of lineStops) {
        await prisma.lineStop.upsert({
          where: {
            lineId_stopId_direction: {
              lineId: line.id,
              stopId: ls.stopId,
              direction: 'ALLER',
            },
          },
          update: { stopOrder: ls.order, distanceFromStartKm: ls.dist },
          create: {
            lineId: line.id,
            stopId: ls.stopId,
            stopOrder: ls.order,
            direction: 'ALLER',
            distanceFromStartKm: ls.dist,
          },
        });
      }
    }
  }
  console.log('✅ Transport Lines and Corridors seeded successfully.');
  console.log('📌 NOTE: All test users share password: "DevAotuc2026!"');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
