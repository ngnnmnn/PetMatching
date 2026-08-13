-- DropIndex
DROP INDEX IF EXISTS "public"."pets_slug_key";

-- AlterTable
ALTER TABLE "public"."pets" DROP COLUMN IF EXISTS "slug",
DROP COLUMN IF EXISTS "colorDesc";
