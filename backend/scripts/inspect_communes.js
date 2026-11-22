import prisma from '../src/utils/prisma.js';

async function main() {
  const communes = await prisma.commune.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: {
          users: true,
          persons: true,
          unions: true,
          validationRequests: true,
          fieldAssignments: true,
          fieldTeams: true,
          fieldReceipts: true,
        },
      },
    },
  });
  console.log('COMMUNES_COUNT:', communes.length);
  console.log(JSON.stringify(communes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
