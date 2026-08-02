-- Migration to sync DB schema with current Prisma schema definitions

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT IF EXISTS "password_reset_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "spa_bookings" DROP CONSTRAINT IF EXISTS "spa_bookings_brandId_fkey";

-- DropForeignKey
ALTER TABLE "spa_brands" DROP CONSTRAINT IF EXISTS "spa_brands_managerId_fkey";

-- DropForeignKey
ALTER TABLE "spa_services" DROP CONSTRAINT IF EXISTS "spa_services_brandId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "spa_bookings_brandId_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "spa_services_brandId_isActive_idx";

-- AlterTable
ALTER TABLE "spa_bookings" DROP COLUMN IF EXISTS "brandId",
ADD COLUMN IF NOT EXISTS "category_id" TEXT;

-- AlterTable
ALTER TABLE "spa_services" DROP COLUMN IF EXISTS "brandId",
ADD COLUMN IF NOT EXISTS "category_id" TEXT;

-- DropTable
DROP TABLE IF EXISTS "password_reset_tokens";

-- DropTable
DROP TABLE IF EXISTS "spa_brands";

-- CreateTable
CREATE TABLE IF NOT EXISTS "spa_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT true,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "managerId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spa_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spa_categories_status_idx" ON "spa_categories"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spa_categories_managerId_idx" ON "spa_categories"("managerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spa_bookings_category_id_status_idx" ON "spa_bookings"("category_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "spa_services_category_id_isActive_idx" ON "spa_services"("category_id", "isActive");

-- AddForeignKey
ALTER TABLE "spa_categories" ADD CONSTRAINT "spa_categories_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_services" ADD CONSTRAINT "spa_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "spa_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "spa_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
