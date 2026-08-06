ALTER TYPE "MatchStatus" ADD VALUE 'MET' BEFORE 'COMPLETED';

ALTER TABLE "matches"
ADD COLUMN "pet1MeetingConfirmedAt" TIMESTAMP(3),
ADD COLUMN "pet2MeetingConfirmedAt" TIMESTAMP(3),
ADD COLUMN "firstMeetingConfirmerId" TEXT,
ADD COLUMN "expectedDueDate" TIMESTAMP(3),
ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "endedById" TEXT,
ADD COLUMN "endReason" TEXT;
