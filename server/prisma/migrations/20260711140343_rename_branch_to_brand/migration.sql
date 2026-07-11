/*
  Warnings:

  - You are about to drop the column `branchId` on the `spa_bookings` table. All the data in the column will be lost.
  - You are about to drop the column `branchId` on the `spa_services` table. All the data in the column will be lost.
  - You are about to drop the `spa_branches` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `brandId` to the `spa_services` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "spa_bookings" DROP CONSTRAINT "spa_bookings_branchId_fkey";

-- DropForeignKey
ALTER TABLE "spa_branches" DROP CONSTRAINT "spa_branches_managerId_fkey";

-- DropForeignKey
ALTER TABLE "spa_services" DROP CONSTRAINT "spa_services_branchId_fkey";

-- DropIndex
DROP INDEX "spa_bookings_branchId_status_idx";

-- DropIndex
DROP INDEX "spa_services_branchId_isActive_idx";

-- AlterTable
ALTER TABLE "spa_bookings" DROP COLUMN "branchId",
ADD COLUMN     "brandId" TEXT;

-- AlterTable
ALTER TABLE "spa_services" DROP COLUMN "branchId",
ADD COLUMN     "brandId" TEXT NOT NULL;

-- DropTable
DROP TABLE "spa_branches";

-- CreateTable
CREATE TABLE "spa_brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "managerId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spa_brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spa_brands_status_idx" ON "spa_brands"("status");

-- CreateIndex
CREATE INDEX "spa_brands_managerId_idx" ON "spa_brands"("managerId");

-- CreateIndex
CREATE INDEX "spa_bookings_brandId_status_idx" ON "spa_bookings"("brandId", "status");

-- CreateIndex
CREATE INDEX "spa_services_brandId_isActive_idx" ON "spa_services"("brandId", "isActive");

-- AddForeignKey
ALTER TABLE "spa_brands" ADD CONSTRAINT "spa_brands_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_services" ADD CONSTRAINT "spa_services_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "spa_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "spa_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
