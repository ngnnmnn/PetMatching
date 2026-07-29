const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    await p.$executeRawUnsafe('ALTER TABLE IF EXISTS spa_services RENAME COLUMN "brandId" TO category_id;');
    console.log('Renamed spa_services."brandId" column to category_id');
  } catch (e) {
    console.log('spa_services rename note:', e.message);
  }

  try {
    await p.$executeRawUnsafe('ALTER TABLE IF EXISTS spa_bookings RENAME COLUMN "brandId" TO category_id;');
    console.log('Renamed spa_bookings."brandId" column to category_id');
  } catch (e) {
    console.log('spa_bookings rename note:', e.message);
  }
}

main().finally(() => p.$disconnect());
