-- Preserve completed Store/Spa transactions and Match history while allowing
-- the source User/Pet rows to be physically deleted.

-- Store orders keep their financial facts but no longer require a customer.
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_userId_fkey";
ALTER TABLE "orders" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Spa bookings keep their revenue facts but no longer require a customer.
ALTER TABLE "spa_bookings" DROP CONSTRAINT IF EXISTS "spa_bookings_userId_fkey";
ALTER TABLE "spa_bookings" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "spa_bookings"
  ADD CONSTRAINT "spa_bookings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- A Match keeps ownership independently from its Pet rows so a remaining
-- participant can still query ended conversations after the other Pet is gone.
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "pet1OwnerId" TEXT;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "pet2OwnerId" TEXT;

UPDATE "matches" AS match
SET "pet1OwnerId" = pet."ownerId"
FROM "pets" AS pet
WHERE match."pet1Id" = pet."id"
  AND match."pet1OwnerId" IS NULL;

UPDATE "matches" AS match
SET "pet2OwnerId" = pet."ownerId"
FROM "pets" AS pet
WHERE match."pet2Id" = pet."id"
  AND match."pet2OwnerId" IS NULL;

ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_pet1Id_fkey";
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_pet2Id_fkey";
ALTER TABLE "matches" ALTER COLUMN "pet1Id" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "pet2Id" DROP NOT NULL;
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_pet1Id_fkey"
  FOREIGN KEY ("pet1Id") REFERENCES "pets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_pet2Id_fkey"
  FOREIGN KEY ("pet2Id") REFERENCES "pets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_pet1OwnerId_fkey"
  FOREIGN KEY ("pet1OwnerId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_pet2OwnerId_fkey"
  FOREIGN KEY ("pet2OwnerId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "matches_pet1OwnerId_status_idx"
  ON "matches"("pet1OwnerId", "status");
CREATE INDEX IF NOT EXISTS "matches_pet2OwnerId_status_idx"
  ON "matches"("pet2OwnerId", "status");

-- Text chat remains readable; the deleted sender becomes anonymous.
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_senderId_fkey";
ALTER TABLE "messages" ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
