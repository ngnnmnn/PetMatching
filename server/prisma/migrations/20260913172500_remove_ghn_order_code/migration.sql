-- Safe migration to remove ghnOrderCode column from orders table if exists
ALTER TABLE "orders" DROP COLUMN IF EXISTS "ghnOrderCode";
