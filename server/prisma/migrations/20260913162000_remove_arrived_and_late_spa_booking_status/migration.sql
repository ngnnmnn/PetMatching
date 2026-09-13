-- Migration: Loại bỏ trạng thái ARRIVED và LATE khỏi SpaBookingStatus
-- 1. Chuyển đổi các đơn đang có trạng thái ARRIVED sang CHECK_IN
UPDATE "spa_bookings"
SET "status" = 'CHECK_IN'
WHERE "status"::text = 'ARRIVED';

-- 2. Chuyển đổi các đơn đang có trạng thái LATE sang CONFIRMED
UPDATE "spa_bookings"
SET "status" = 'CONFIRMED'
WHERE "status"::text = 'LATE';

-- 3. Cập nhật kiểu enum SpaBookingStatus một cách an toàn
ALTER TABLE "spa_bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "spa_bookings" ALTER COLUMN "status" TYPE text;

DROP TYPE IF EXISTS "SpaBookingStatus" CASCADE;

CREATE TYPE "SpaBookingStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'CHECK_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
);

ALTER TABLE "spa_bookings" ALTER COLUMN "status" TYPE "SpaBookingStatus" USING ("status"::"SpaBookingStatus");
ALTER TABLE "spa_bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING';
