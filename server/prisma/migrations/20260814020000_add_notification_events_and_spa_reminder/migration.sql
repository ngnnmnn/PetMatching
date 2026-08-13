ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'PET_DOCUMENT_REVIEWED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'MATCHING_REPORT_RESOLVED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'COMPLAINT_STATUS_CHANGED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'SPA_BOOKING_REMINDER';

ALTER TABLE "spa_bookings" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

CREATE INDEX "spa_bookings_reminderSentAt_scheduledAt_status_idx"
ON "spa_bookings"("reminderSentAt", "scheduledAt", "status");
