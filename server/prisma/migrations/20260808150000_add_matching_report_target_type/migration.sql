ALTER TABLE "pet_reports"
ADD COLUMN "targetType" TEXT NOT NULL DEFAULT 'USER';

DROP INDEX "pet_reports_matchId_userId_key";

CREATE UNIQUE INDEX "pet_reports_matchId_userId_targetType_key"
ON "pet_reports"("matchId", "userId", "targetType");
