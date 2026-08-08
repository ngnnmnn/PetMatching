-- Preserve existing conversations while removing the meeting/pregnancy workflow.
UPDATE "matches"
SET "status" = 'ACTIVE'
WHERE "status" IN ('MET', 'COMPLETED');

ALTER TABLE "matches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "MatchStatus" RENAME TO "MatchStatus_old";
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'CANCELLED');
ALTER TABLE "matches"
  ALTER COLUMN "status" TYPE "MatchStatus"
  USING ("status"::text::"MatchStatus");
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "MatchStatus_old";

UPDATE "pets"
SET "status" = 'ACTIVE'
WHERE "status" = 'BREAKDOWN';

ALTER TABLE "pets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "PetStatus" RENAME TO "PetStatus_old";
CREATE TYPE "PetStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'INACTIVE');
ALTER TABLE "pets"
  ALTER COLUMN "status" TYPE "PetStatus"
  USING ("status"::text::"PetStatus");
ALTER TABLE "pets" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "PetStatus_old";

ALTER TABLE "pets" DROP COLUMN "lastBreedingAt";

ALTER TABLE "matches"
  DROP COLUMN "pet1MeetingConfirmedAt",
  DROP COLUMN "pet2MeetingConfirmedAt",
  DROP COLUMN "firstMeetingConfirmerId",
  DROP COLUMN "breedingNote",
  DROP COLUMN "expectedDueDate",
  DROP COLUMN "completedAt";
