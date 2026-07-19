-- Replace legacy CUID product primary keys with unique six-digit numeric codes.
-- All product foreign keys use ON UPDATE CASCADE, so related carts, wishlists,
-- order items and reviews keep their references automatically.
DO $$
DECLARE
  product_record RECORD;
  next_id TEXT;
BEGIN
  FOR product_record IN
    SELECT "id" FROM "products" WHERE "id" !~ '^[0-9]{6}$' ORDER BY "createdAt", "id"
  LOOP
    LOOP
      next_id := (FLOOR(RANDOM() * 900000) + 100000)::INTEGER::TEXT;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "products" WHERE "id" = next_id);
    END LOOP;

    UPDATE "products" SET "id" = next_id WHERE "id" = product_record."id";
  END LOOP;
END $$;
