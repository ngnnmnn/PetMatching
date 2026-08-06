import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Listing columns for table spa_services...');
  try {
    const columns: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'spa_services';
    `;
    console.log('Columns in spa_services:');
    columns.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });
  } catch (error: any) {
    console.error('ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
