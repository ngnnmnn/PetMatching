-- The application has one global Store. Preserve the oldest Store as the
-- canonical record and move all Store-owned data to it before removing the
-- obsolete per-manager ownership column.
DO $$
DECLARE
  canonical_store_id TEXT;
BEGIN
  SELECT "id"
  INTO canonical_store_id
  FROM "stores"
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF canonical_store_id IS NOT NULL THEN
    UPDATE "products"
    SET "storeId" = canonical_store_id
    WHERE "storeId" IS DISTINCT FROM canonical_store_id;

    UPDATE "orders"
    SET "storeId" = canonical_store_id
    WHERE "storeId" IS DISTINCT FROM canonical_store_id;

    DELETE FROM "stores"
    WHERE "id" <> canonical_store_id;
  END IF;
END $$;

ALTER TABLE "stores" DROP CONSTRAINT IF EXISTS "stores_managerId_fkey";
DROP INDEX IF EXISTS "stores_managerId_idx";
ALTER TABLE "stores" DROP COLUMN IF EXISTS "managerId";
