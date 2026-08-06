import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tables: any = await prisma.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
  );
  console.log('Existing tables in DB:', tables.map((t: any) => t.table_name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
