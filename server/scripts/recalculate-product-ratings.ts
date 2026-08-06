import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Recalculating real product ratings and review counts from ProductReview table...');

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      rating: true,
      reviewCount: true,
    },
  });

  console.log(`Found ${products.length} total products in database.`);

  let resetCount = 0;
  let updatedCount = 0;

  for (const product of products) {
    const realReviewCount = await prisma.productReview.count({
      where: { productId: product.id },
    });

    const agg = await prisma.productReview.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
    });

    const realRating = realReviewCount > 0 ? (agg._avg.rating ?? 0) : 0;

    // Check if database currently has fake or mismatched numbers
    if (product.rating !== realRating || product.reviewCount !== realReviewCount) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          rating: realRating,
          reviewCount: realReviewCount,
        },
      });

      if (realReviewCount === 0) {
        resetCount++;
        console.log(`[RESET FAKE RATING] Product "${product.name}" (${product.id}): Was rating ${product.rating}, reviews ${product.reviewCount} -> Set to rating 0, reviews 0.`);
      } else {
        updatedCount++;
        console.log(`[UPDATED REAL RATING] Product "${product.name}" (${product.id}): Set to rating ${realRating.toFixed(1)}, reviews ${realReviewCount}.`);
      }
    }
  }

  console.log(`Finished! Reset ${resetCount} products with fake reviews to 0. Updated ${updatedCount} products with actual reviews.`);
}

main()
  .catch((e) => {
    console.error('Error recalculating product ratings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
