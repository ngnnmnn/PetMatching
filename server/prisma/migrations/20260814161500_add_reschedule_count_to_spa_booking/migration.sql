-- AlterTable
ALTER TABLE "spa_bookings" ADD COLUMN IF NOT EXISTS "rescheduleCount" INTEGER NOT NULL DEFAULT 0;
