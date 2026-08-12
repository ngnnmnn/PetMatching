-- DropForeignKey
ALTER TABLE "public"."wishlist_items" DROP CONSTRAINT IF EXISTS "wishlist_items_productId_fkey";
ALTER TABLE "public"."wishlist_items" DROP CONSTRAINT IF EXISTS "wishlist_items_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "public"."wishlist_items";
