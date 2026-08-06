import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration for products...');
  
  // Find all products
  const products = await prisma.product.findMany({});
  console.log(`Found ${products.length} products to migrate.`);
  
  let migratedCount = 0;
  for (const product of products) {
    // If sellingPrice is not set, set it from originalPrice
    const price = product.originalPrice ?? 0;
    const sellingPrice = price;
    const importPrice = Math.round(price / 2);
    
    console.log(`Migrating Product [ID: ${product.id} - ${product.name}]: originalPrice=${price} -> sellingPrice=${sellingPrice}, importPrice=${importPrice}`);
    
    await prisma.product.update({
      where: { id: product.id },
      data: {
        sellingPrice: sellingPrice,
        importPrice: importPrice,
      },
    });
    migratedCount++;
  }
  
  console.log(`Successfully migrated ${migratedCount} products.`);
}

main()
  .catch((e) => {
    console.error('Error migrating data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
