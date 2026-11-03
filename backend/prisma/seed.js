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
