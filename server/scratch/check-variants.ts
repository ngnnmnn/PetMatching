import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const products = await prisma.product.findMany({
    include: { variants: true }
  });
  for (const p of products) {
    console.log(`Product: "${p.name}" (Active: ${p.isActive}) - Variants count: ${p.variants.length}`);
    if (p.variants.length > 0) {
      console.log(' - Variants:', p.variants.map(v => `${v.name} (Stock: ${v.stock})`));
    }
  }
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
