import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createSqliteAdapter } from './sqliteAdapter';

const prisma = new PrismaClient({
  adapter: createSqliteAdapter(),
});

async function main() {
  // Seed placeholder: ensure schema is reachable.
  await prisma.user.upsert({
    where: { id: 1 },
    update: { name: 'Seed User' },
    create: { id: 1, email: 'seed@example.com', name: 'Seed User' },
  });
}

main()
  .catch((err) => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
