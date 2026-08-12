-- AlterTable
ALTER TABLE "public"."spa_categories" DROP COLUMN IF EXISTS "approvedAt",
DROP COLUMN IF EXISTS "suspendedAt";

-- AlterTable
ALTER TABLE "public"."stores" DROP COLUMN IF EXISTS "approvedAt",
DROP COLUMN IF EXISTS "suspendedAt";
