-- One payment model for Store orders and Spa bookings.
CREATE TYPE "PaymentSource" AS ENUM ('STORE_ORDER', 'SPA_BOOKING');
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'QR');
CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'CANCELLED',
  'EXPIRED',
  'PAYMENT_ERROR',
  'REFUNDED'
);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "source_type" "PaymentSource" NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DOUBLE PRECISION NOT NULL,
  "order_code" INTEGER,
  "payment_url" TEXT,
  "paid_at" TIMESTAMP(3),
  "refunded_at" TIMESTAMP(3),
  "order_id" TEXT,
  "spa_booking_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_single_source_check" CHECK (
    ("source_type" = 'STORE_ORDER' AND "order_id" IS NOT NULL AND "spa_booking_id" IS NULL)
    OR ("source_type" = 'SPA_BOOKING' AND "order_id" IS NULL AND "spa_booking_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "payments_order_code_key" ON "payments"("order_code");
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");
CREATE UNIQUE INDEX "payments_spa_booking_id_key" ON "payments"("spa_booking_id");
CREATE INDEX "payments_source_type_status_paid_at_idx"
  ON "payments"("source_type", "status", "paid_at");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_spa_booking_id_fkey"
  FOREIGN KEY ("spa_booking_id") REFERENCES "spa_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve all existing Store payment data.
INSERT INTO "payments" (
  "id", "source_type", "method", "status", "amount", "order_code",
  "payment_url", "paid_at", "refunded_at", "order_id", "created_at", "updated_at"
)
SELECT
  'pay_order_' || "id",
  'STORE_ORDER'::"PaymentSource",
  CASE WHEN "paymentMethod" = 'QR' THEN 'QR' ELSE 'COD' END::"PaymentMethod",
  CASE
    WHEN "refundStatus" = 'REFUNDED' THEN 'REFUNDED'
    WHEN "paymentMethod" = 'QR'
      AND "status" IN ('PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED')
      THEN 'PAID'
    WHEN "paymentMethod" <> 'QR' AND "status" = 'DELIVERED'
      THEN 'PAID'
    WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
    WHEN "status" = 'EXPIRED' THEN 'EXPIRED'
    WHEN "status" = 'PAYMENT_ERROR' THEN 'PAYMENT_ERROR'
    ELSE 'PENDING'
  END::"PaymentStatus",
  "totalAmount",
  "orderCode",
  "paymentUrl",
  CASE
    WHEN "paymentMethod" = 'QR'
      AND "status" IN ('PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED')
      THEN "updatedAt"
    WHEN "paymentMethod" <> 'QR' AND "status" = 'DELIVERED'
      THEN "updatedAt"
    ELSE NULL
  END,
  CASE WHEN "refundStatus" = 'REFUNDED' THEN "refundedAt" ELSE NULL END,
  "id",
  "createdAt",
  "updatedAt"
FROM "orders";

-- Preserve Spa payments. Some existing databases missed the legacy columns even
-- though their migration was recorded, so defer legacy-column parsing dynamically.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spa_bookings' AND column_name = 'isPaid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spa_bookings' AND column_name = 'paymentMethod'
  ) THEN
    EXECUTE $backfill$
      INSERT INTO "payments" (
        "id", "source_type", "method", "status", "amount", "paid_at",
        "spa_booking_id", "created_at", "updated_at"
      )
      SELECT
        'pay_spa_' || "id",
        'SPA_BOOKING'::"PaymentSource",
        CASE WHEN "paymentMethod" IN ('TRANSFER', 'QR') THEN 'QR' ELSE 'COD' END::"PaymentMethod",
        CASE
          WHEN "isPaid" = true THEN 'PAID'
          WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
          ELSE 'PENDING'
        END::"PaymentStatus",
        "totalPrice",
        CASE WHEN "isPaid" = true THEN "updatedAt" ELSE NULL END,
        "id", "createdAt", "updatedAt"
      FROM "spa_bookings"
    $backfill$;
  ELSE
    INSERT INTO "payments" (
      "id", "source_type", "method", "status", "amount", "paid_at",
      "spa_booking_id", "created_at", "updated_at"
    )
    SELECT
      'pay_spa_' || "id",
      'SPA_BOOKING'::"PaymentSource",
      'COD'::"PaymentMethod",
      CASE
        WHEN "status" = 'COMPLETED' THEN 'PAID'
        WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
        ELSE 'PENDING'
      END::"PaymentStatus",
      "totalPrice",
      CASE WHEN "status" = 'COMPLETED' THEN "updatedAt" ELSE NULL END,
      "id", "createdAt", "updatedAt"
    FROM "spa_bookings";
  END IF;
END $$;

ALTER TABLE "orders"
  DROP COLUMN "paymentMethod",
  DROP COLUMN "orderCode",
  DROP COLUMN "paymentUrl";

ALTER TABLE "spa_bookings"
  DROP COLUMN IF EXISTS "isPaid",
  DROP COLUMN IF EXISTS "paymentMethod";
