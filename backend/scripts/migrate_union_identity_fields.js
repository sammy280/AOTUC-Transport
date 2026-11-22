import prisma from '../src/utils/prisma.js';
import logger from '../src/utils/logger.js';

async function main() {
  console.log('--- Applying additive migration for TransportUnion identity fields ---');
  
  await prisma.$executeRawUnsafe(`
    ALTER TABLE transport_unions ADD COLUMN IF NOT EXISTS fonction TEXT;
  `);
  console.log('✓ Added column "fonction" to transport_unions');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE transport_unions ADD COLUMN IF NOT EXISTS photo_url TEXT;
  `);
  console.log('✓ Added column "photo_url" to transport_unions');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE transport_unions ADD COLUMN IF NOT EXISTS cni_number TEXT;
  `);
  console.log('✓ Added column "cni_number" to transport_unions');

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'transport_unions' AND column_name IN ('fonction', 'photo_url', 'cni_number');
  `);
  console.log('Verified columns in PostgreSQL:', cols);
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
