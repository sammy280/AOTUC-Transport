import prisma from '../src/utils/prisma.js';

export const OFFICIAL_13_COMMUNES = [
  {
    code: 'KLM',
    name: 'Kaloum',
    administrativeOrigin: 'Ancienne commune',
    description: 'Centre administratif et des affaires',
  },
  {
    code: 'DXN',
    name: 'Dixinn',
    administrativeOrigin: 'Ancienne commune',
    description: 'Commune universitaire et résidentielle',
  },
  {
    code: 'MTM',
    name: 'Matam',
    administrativeOrigin: 'Ancienne commune',
    description: 'Commune commerciale et portuaire',
  },
  {
    code: 'RTM',
    name: 'Ratoma',
    administrativeOrigin: 'Ancienne commune',
    description: 'Grande commune résidentielle et axes routiers',
  },
  {
    code: 'MTT',
    name: 'Matoto',
    administrativeOrigin: 'Ancienne commune',
    description: 'Plus grande commune urbaine de Conakry',
  },
  {
    code: 'KSS',
    name: 'Kassa',
    administrativeOrigin: 'Ancienne commune – Îles de Los',
    description: 'Îles de Loos',
  },
  {
    code: 'GBS',
    name: 'Gbessia',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Aéroport International Ahmed Sékou Touré et carrefours stratégiques',
  },
  {
    code: 'TMB',
    name: 'Tombolia',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Zone résidentielle et axes de transit Matoto-Coyah',
  },
  {
    code: 'LBN',
    name: 'Lambanyi',
    administrativeOrigin: 'Nouvelle – détachée de Ratoma',
    description: 'Zone côtière résidentielle et commerciale nord',
  },
  {
    code: 'SNF',
    name: 'Sonfonia',
    administrativeOrigin: 'Nouvelle – détachée de Ratoma',
    description: 'Pôle universitaire et résidentiel nord-est',
  },
  {
    code: 'KGB',
    name: 'Kagbélen',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Zone industrielle et échangeur autoroutier',
  },
  {
    code: 'SNY',
    name: 'Sanoyah',
    administrativeOrigin: 'Nouvelle – détachée de Matoto',
    description: 'Zone urbaine et périurbaine orientale',
  },
  {
    code: 'MNH',
    name: 'Manéah',
    administrativeOrigin: 'Nouvelle – détachée de Matoto / Coyah',
    description: 'Bordure métropolitaine et carrefour vers Coyah/l’intérieur',
  },
];

async function main() {
  console.log('🔄 Upserting 13 official communes in PostgreSQL...');

  const results = [];
  for (const c of OFFICIAL_13_COMMUNES) {
    const item = await prisma.commune.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        administrativeOrigin: c.administrativeOrigin,
        description: c.description,
      },
      create: {
        code: c.code,
        name: c.name,
        administrativeOrigin: c.administrativeOrigin,
        description: c.description,
      },
    });
    results.push(item);
  }

  console.log(`✅ Upserted ${results.length} communes successfully.`);

  const allInDb = await prisma.commune.findMany({
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      administrativeOrigin: true,
      description: true,
      _count: {
        select: {
          users: true,
          persons: true,
          validationRequests: true,
        },
      },
    },
  });

  console.log('Total Communes in DB:', allInDb.length);
  console.table(
    allInDb.map((c) => ({
      code: c.code,
      name: c.name,
      origin: c.administrativeOrigin,
      users: c._count.users,
      persons: c._count.persons,
      validations: c._count.validationRequests,
    }))
  );
}

main()
  .catch((e) => {
    console.error('❌ Error seeding 13 communes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
