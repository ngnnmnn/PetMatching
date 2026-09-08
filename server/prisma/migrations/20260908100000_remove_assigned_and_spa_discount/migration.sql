-- Migration: Loại bỏ trạng thái ASSIGNED và xóa discountAmount của SpaBooking
-- 1. Chuyển đổi các đơn đang có trạng thái ASSIGNED sang CONFIRMED
UPDATE "spa_bookings"
SET "status" = 'CONFIRMED'
WHERE "status"::text = 'ASSIGNED';

-- 2. Xóa an toàn cột discountAmount khỏi bảng spa_bookings
ALTER TABLE "spa_bookings" DROP COLUMN IF EXISTS "discountAmount";

-- 3. Cập nhật kiểu enum SpaBookingStatus một cách an toàn
ALTER TABLE "spa_bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "spa_bookings" ALTER COLUMN "status" TYPE text;

DROP TYPE IF EXISTS "SpaBookingStatus" CASCADE;

CREATE TYPE "SpaBookingStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'CHECK_IN',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'LATE'
);

ALTER TABLE "spa_bookings" ALTER COLUMN "status" TYPE "SpaBookingStatus" USING ("status"::"SpaBookingStatus");
ALTER TABLE "spa_bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING';
