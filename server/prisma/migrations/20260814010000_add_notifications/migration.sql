-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('MATCHING', 'ORDER', 'APPOINTMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('MATCH_REQUEST_CREATED', 'MATCH_REQUEST_ACCEPTED', 'MATCH_REQUEST_REJECTED', 'SPA_BOOKING_CREATED', 'SPA_BOOKING_STATUS_CHANGED', 'ORDER_STATUS_CHANGED', 'SYSTEM');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetUrl" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_deletedAt_createdAt_idx" ON "notifications"("userId", "deletedAt", "createdAt");
CREATE INDEX "notifications_userId_deletedAt_isRead_idx" ON "notifications"("userId", "deletedAt", "isRead");
CREATE INDEX "notifications_userId_category_deletedAt_createdAt_idx" ON "notifications"("userId", "category", "deletedAt", "createdAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
