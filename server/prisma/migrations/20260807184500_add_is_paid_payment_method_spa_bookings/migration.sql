-- AlterTable
ALTER TABLE "spa_bookings" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "spa_bookings" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
