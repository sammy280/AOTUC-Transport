import argon2 from 'argon2';
import prisma from '../src/utils/prisma.js';

async function main() {
  const email = 'it.admin@aotuc.gov.gn';
  const phoneNumber = '+224629000000';
  const password = 'DevAotuc2026!';

  console.log('Generating argon2id hash for IT account...');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // 1. Fetch IT role
  const itRole = await prisma.role.findUnique({ where: { name: 'IT' } });
  if (!itRole) {
    throw new Error('Role IT does not exist in roles table!');
  }

  // 2. Upsert user
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phoneNumber }],
    },
  });

  if (user) {
    console.log(`User already exists (ID: ${user.id}), updating password and ensuring IT role...`);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        accountStatus: 'ACTIVE',
        communeId: null, // Global access
      },
    });
  } else {
    console.log('Creating official IT administrator account...');
    user = await prisma.user.create({
      data: {
        email,
        phoneNumber,
        passwordHash,
        firstName: 'Mamadou',
        lastName: 'Diallo (IT)',
        jobTitle: 'Contrôleur Informatique & DBA',
        communeId: null, // Global national access
        isActive: true,
        accountStatus: 'ACTIVE',
      },
    });
  }

  // 3. Ensure role link exists
  const existingUserRole = await prisma.userRole.findUnique({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: itRole.id,
      },
    },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: itRole.id,
      },
    });
    console.log('Successfully assigned IT role to user.');
  }

  console.log('\n=========================================');
  console.log('✅ IT ADMINISTRATOR ACCOUNT READY');
  console.log('=========================================');
  console.log('ID:         ', user.id);
  console.log('Email:      ', email);
  console.log('Phone:      ', phoneNumber);
  console.log('Password:   ', password);
  console.log('Role:       ', 'IT — Contrôle Informatique');
  console.log('Commune:    ', 'Toutes Communes (Global)');
  console.log('Status:     ', 'ACTIVE');
  console.log('=========================================\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
