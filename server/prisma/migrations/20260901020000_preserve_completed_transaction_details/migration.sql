-- Keep the account and pet deletions hard while preserving the customer
-- details that belong to completed Store and Spa transactions.
ALTER TABLE "orders"
  ADD COLUMN "customerNameSnapshot" TEXT,
  ADD COLUMN "customerEmailSnapshot" TEXT,
  ADD COLUMN "customerPhoneSnapshot" TEXT;

ALTER TABLE "spa_bookings"
  ADD COLUMN "customerNameSnapshot" TEXT,
  ADD COLUMN "customerEmailSnapshot" TEXT,
  ADD COLUMN "customerPhoneSnapshot" TEXT;

-- Backfill existing transactions before their User relation can be removed.
UPDATE "orders" AS order_record
SET
  "customerNameSnapshot" = users."name",
  "customerEmailSnapshot" = users."email",
  "customerPhoneSnapshot" = users."phone"
FROM "users" AS users
WHERE order_record."userId" = users."id";

UPDATE "spa_bookings" AS booking
SET
  "customerNameSnapshot" = users."name",
  "customerEmailSnapshot" = users."email",
  "customerPhoneSnapshot" = users."phone"
FROM "users" AS users
WHERE booking."userId" = users."id";

-- Feedback is part of a completed Spa transaction. Detach it from the deleted
-- account instead of cascading the feedback row away.
ALTER TABLE "spa_feedbacks"
  DROP CONSTRAINT IF EXISTS "spa_feedbacks_user_id_fkey";
ALTER TABLE "spa_feedbacks"
  ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "spa_feedbacks"
  ADD CONSTRAINT "spa_feedbacks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
