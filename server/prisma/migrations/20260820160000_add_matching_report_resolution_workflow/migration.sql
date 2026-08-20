ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'REVIEWING';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'INSUFFICIENT_EVIDENCE';

ALTER TABLE "pet_reports"
  ADD COLUMN IF NOT EXISTS "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "actionTaken" "ComplaintAction",
  ADD COLUMN IF NOT EXISTS "adminNote" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewStartedAt" TIMESTAMP(3);

UPDATE "pet_reports"
SET "status" = CASE
  WHEN "isResolved" = TRUE THEN 'RESOLVED'::"ComplaintStatus"
  ELSE 'PENDING'::"ComplaintStatus"
END
WHERE "status" = 'PENDING'::"ComplaintStatus";

DROP INDEX IF EXISTS "pet_reports_reportedUserId_isResolved_idx";
DROP INDEX IF EXISTS "pet_reports_isResolved_createdAt_idx";

CREATE INDEX IF NOT EXISTS "pet_reports_reportedUserId_status_idx"
  ON "pet_reports"("reportedUserId", "status");
CREATE INDEX IF NOT EXISTS "pet_reports_status_createdAt_idx"
  ON "pet_reports"("status", "createdAt");

ALTER TABLE "pet_reports" DROP COLUMN IF EXISTS "isResolved";
