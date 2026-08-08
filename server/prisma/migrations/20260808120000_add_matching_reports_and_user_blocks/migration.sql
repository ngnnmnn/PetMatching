-- Extend matching reports with the conversation and moderation context.
ALTER TABLE "pet_reports"
ADD COLUMN "matchId" TEXT,
ADD COLUMN "reportedUserId" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolvedById" TEXT;

-- Store directional user blocks. Either direction is treated as blocked by matching.
CREATE TABLE "user_blocks" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pet_reports_matchId_userId_key" ON "pet_reports"("matchId", "userId");
CREATE INDEX "pet_reports_reportedUserId_isResolved_idx" ON "pet_reports"("reportedUserId", "isResolved");
CREATE INDEX "pet_reports_isResolved_createdAt_idx" ON "pet_reports"("isResolved", "createdAt");
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");
CREATE INDEX "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

ALTER TABLE "pet_reports" ADD CONSTRAINT "pet_reports_petId_fkey"
FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pet_reports" ADD CONSTRAINT "pet_reports_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pet_reports" ADD CONSTRAINT "pet_reports_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pet_reports" ADD CONSTRAINT "pet_reports_reportedUserId_fkey"
FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pet_reports" ADD CONSTRAINT "pet_reports_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey"
FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey"
FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
