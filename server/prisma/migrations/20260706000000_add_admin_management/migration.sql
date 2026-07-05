ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STORE_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SPA_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SPA_STAFF';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'NEED_MORE_INFO';

DO $$ BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_MANAGER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComplaintType" AS ENUM ('USER', 'PET', 'MATCHING', 'STORE', 'SPA', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED', 'ESCALATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComplaintAction" AS ENUM ('DISMISS', 'WARNING', 'HIDE_CONTENT', 'SUSPEND_ACCOUNT', 'RESOLVE', 'ESCALATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SpaBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS "stores" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "managerId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "spa_branches" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "managerId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "spa_branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "spa_services" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "durationMin" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "spa_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "spa_bookings" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "serviceId" TEXT,
  "userId" TEXT NOT NULL,
  "staffId" TEXT,
  "petName" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "SpaBookingStatus" NOT NULL DEFAULT 'PENDING',
  "priceSnapshot" DOUBLE PRECISION,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "spa_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "complaints" (
  "id" TEXT NOT NULL,
  "type" "ComplaintType" NOT NULL,
  "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "reporterId" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "actionTaken" "ComplaintAction",
  "adminNote" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

CREATE INDEX IF NOT EXISTS "stores_status_idx" ON "stores"("status");
CREATE INDEX IF NOT EXISTS "stores_managerId_idx" ON "stores"("managerId");
CREATE INDEX IF NOT EXISTS "products_storeId_idx" ON "products"("storeId");
CREATE INDEX IF NOT EXISTS "orders_storeId_idx" ON "orders"("storeId");
CREATE INDEX IF NOT EXISTS "spa_branches_status_idx" ON "spa_branches"("status");
CREATE INDEX IF NOT EXISTS "spa_branches_managerId_idx" ON "spa_branches"("managerId");
CREATE INDEX IF NOT EXISTS "spa_services_branchId_isActive_idx" ON "spa_services"("branchId", "isActive");
CREATE INDEX IF NOT EXISTS "spa_bookings_branchId_status_idx" ON "spa_bookings"("branchId", "status");
CREATE INDEX IF NOT EXISTS "spa_bookings_userId_idx" ON "spa_bookings"("userId");
CREATE INDEX IF NOT EXISTS "spa_bookings_staffId_idx" ON "spa_bookings"("staffId");
CREATE INDEX IF NOT EXISTS "complaints_type_status_idx" ON "complaints"("type", "status");
CREATE INDEX IF NOT EXISTS "complaints_reporterId_idx" ON "complaints"("reporterId");
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");
CREATE INDEX IF NOT EXISTS "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX IF NOT EXISTS "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

DO $$ BEGIN
  ALTER TABLE "pet_documents" ADD CONSTRAINT "pet_documents_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stores" ADD CONSTRAINT "stores_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spa_branches" ADD CONSTRAINT "spa_branches_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spa_services" ADD CONSTRAINT "spa_services_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "spa_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "spa_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "spa_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
