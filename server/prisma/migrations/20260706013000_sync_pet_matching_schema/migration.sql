-- Sync pet matching fields that exist in Prisma schema but were missing from the local database.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PetStatus') THEN
    CREATE TYPE "PetStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'INACTIVE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MatchingRequestStatus') THEN
    CREATE TYPE "MatchingRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'PASSED', 'CANCELLED');
  END IF;
END $$;

DROP INDEX IF EXISTS "pets_species_gender_isActive_idx";

ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "isAvailableForMatching" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status" "PetStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS "matching_requests" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "femalePetId" TEXT NOT NULL,
  "malePetId" TEXT NOT NULL,
  "status" "MatchingRequestStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "matching_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "matching_requests_requesterId_status_idx" ON "matching_requests"("requesterId", "status");
CREATE INDEX IF NOT EXISTS "matching_requests_femalePetId_malePetId_status_idx" ON "matching_requests"("femalePetId", "malePetId", "status");
CREATE INDEX IF NOT EXISTS "matching_requests_malePetId_status_idx" ON "matching_requests"("malePetId", "status");
CREATE INDEX IF NOT EXISTS "pets_species_gender_status_isAvailableForMatching_idx" ON "pets"("species", "gender", "status", "isAvailableForMatching");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matching_requests_requesterId_fkey') THEN
    ALTER TABLE "matching_requests" ADD CONSTRAINT "matching_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matching_requests_femalePetId_fkey') THEN
    ALTER TABLE "matching_requests" ADD CONSTRAINT "matching_requests_femalePetId_fkey" FOREIGN KEY ("femalePetId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matching_requests_malePetId_fkey') THEN
    ALTER TABLE "matching_requests" ADD CONSTRAINT "matching_requests_malePetId_fkey" FOREIGN KEY ("malePetId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
