-- Repair environments where migration history says unified payments was applied,
-- but the actual schema was restored or drifted back to the legacy columns.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentSource') THEN
    CREATE TYPE "PaymentSource" AS ENUM ('STORE_ORDER', 'SPA_BOOKING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'QR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM (
      'PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'PAYMENT_ERROR', 'REFUNDED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payments" (
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
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_code_key" ON "payments"("order_code");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_id_key" ON "payments"("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_spa_booking_id_key" ON "payments"("spa_booking_id");
CREATE INDEX IF NOT EXISTS "payments_source_type_status_paid_at_idx"
  ON "payments"("source_type", "status", "paid_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_single_source_check'
  ) THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_single_source_check" CHECK (
      ("source_type" = 'STORE_ORDER' AND "order_id" IS NOT NULL AND "spa_booking_id" IS NULL)
      OR ("source_type" = 'SPA_BOOKING' AND "order_id" IS NULL AND "spa_booking_id" IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey'
  ) THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_spa_booking_id_fkey'
  ) THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_spa_booking_id_fkey"
      FOREIGN KEY ("spa_booking_id") REFERENCES "spa_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill Store payments, preserving legacy PayOS data when those columns exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paymentMethod'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'orderCode'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paymentUrl'
  ) THEN
    EXECUTE $backfill$
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
          WHEN "paymentMethod" = 'QR' AND "status" IN ('PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED') THEN 'PAID'
          WHEN "paymentMethod" <> 'QR' AND "status" = 'DELIVERED' THEN 'PAID'
          WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
          WHEN "status" = 'EXPIRED' THEN 'EXPIRED'
          WHEN "status" = 'PAYMENT_ERROR' THEN 'PAYMENT_ERROR'
          ELSE 'PENDING'
        END::"PaymentStatus",
        "totalAmount", "orderCode", "paymentUrl",
        CASE
          WHEN "paymentMethod" = 'QR' AND "status" IN ('PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED') THEN "updatedAt"
          WHEN "paymentMethod" <> 'QR' AND "status" = 'DELIVERED' THEN "updatedAt"
          ELSE NULL
        END,
        CASE WHEN "refundStatus" = 'REFUNDED' THEN "refundedAt" ELSE NULL END,
        "id", "createdAt", "updatedAt"
      FROM "orders"
      ON CONFLICT ("order_id") DO NOTHING
    $backfill$;
  ELSE
    INSERT INTO "payments" (
      "id", "source_type", "method", "status", "amount", "paid_at",
      "refunded_at", "order_id", "created_at", "updated_at"
    )
    SELECT
      'pay_order_' || "id", 'STORE_ORDER'::"PaymentSource", 'COD'::"PaymentMethod",
      CASE
        WHEN "refundStatus" = 'REFUNDED' THEN 'REFUNDED'
        WHEN "status" = 'DELIVERED' THEN 'PAID'
        WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
        WHEN "status" = 'EXPIRED' THEN 'EXPIRED'
        WHEN "status" = 'PAYMENT_ERROR' THEN 'PAYMENT_ERROR'
        ELSE 'PENDING'
      END::"PaymentStatus",
      "totalAmount",
      CASE WHEN "status" = 'DELIVERED' THEN "updatedAt" ELSE NULL END,
      CASE WHEN "refundStatus" = 'REFUNDED' THEN "refundedAt" ELSE NULL END,
      "id", "createdAt", "updatedAt"
    FROM "orders"
    ON CONFLICT ("order_id") DO NOTHING;
  END IF;
END $$;

-- Backfill Spa payments. Older databases may never have received the temporary
-- isPaid/paymentMethod columns, so COMPLETED remains the compatibility fallback.
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
        'pay_spa_' || "id", 'SPA_BOOKING'::"PaymentSource",
        CASE WHEN "paymentMethod" IN ('TRANSFER', 'QR') THEN 'QR' ELSE 'COD' END::"PaymentMethod",
        CASE
          WHEN "isPaid" = true THEN 'PAID'
          WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
          ELSE 'PENDING'
        END::"PaymentStatus",
        "totalPrice", CASE WHEN "isPaid" = true THEN "updatedAt" ELSE NULL END,
        "id", "createdAt", "updatedAt"
      FROM "spa_bookings"
      ON CONFLICT ("spa_booking_id") DO NOTHING
    $backfill$;
  ELSE
    INSERT INTO "payments" (
      "id", "source_type", "method", "status", "amount", "paid_at",
      "spa_booking_id", "created_at", "updated_at"
    )
    SELECT
      'pay_spa_' || "id", 'SPA_BOOKING'::"PaymentSource", 'COD'::"PaymentMethod",
      CASE
        WHEN "status" = 'COMPLETED' THEN 'PAID'
        WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
        ELSE 'PENDING'
      END::"PaymentStatus",
      "totalPrice", CASE WHEN "status" = 'COMPLETED' THEN "updatedAt" ELSE NULL END,
      "id", "createdAt", "updatedAt"
    FROM "spa_bookings"
    ON CONFLICT ("spa_booking_id") DO NOTHING;
  END IF;
END $$;

ALTER TABLE "orders"
  DROP COLUMN IF EXISTS "paymentMethod",
  DROP COLUMN IF EXISTS "orderCode",
  DROP COLUMN IF EXISTS "paymentUrl";

ALTER TABLE "spa_bookings"
  DROP COLUMN IF EXISTS "isPaid",
  DROP COLUMN IF EXISTS "paymentMethod";
