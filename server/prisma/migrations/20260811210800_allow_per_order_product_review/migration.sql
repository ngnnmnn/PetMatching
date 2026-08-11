-- AlterTable
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "product_reviews_userId_productId_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_reviews_userId_productId_orderId_key" ON "product_reviews"("userId", "productId", "orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_reviews_orderId_idx" ON "product_reviews"("orderId");

-- AddForeignKey
ALTER TABLE "product_reviews" DROP CONSTRAINT IF EXISTS "product_reviews_orderId_fkey";
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
