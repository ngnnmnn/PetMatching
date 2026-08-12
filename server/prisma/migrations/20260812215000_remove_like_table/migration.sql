-- DropForeignKey
ALTER TABLE "public"."likes" DROP CONSTRAINT IF EXISTS "likes_fromUserId_fkey";
ALTER TABLE "public"."likes" DROP CONSTRAINT IF EXISTS "likes_fromPetId_fkey";
ALTER TABLE "public"."likes" DROP CONSTRAINT IF EXISTS "likes_toPetId_fkey";

-- DropTable
DROP TABLE IF EXISTS "public"."likes";

-- DropEnum
DROP TYPE IF EXISTS "public"."LikeStatus";
