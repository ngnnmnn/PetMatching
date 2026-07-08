-- CreateEnum
CREATE TYPE "PetStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MatchingRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'PASSED', 'CANCELLED');

-- DropIndex
DROP INDEX "pets_species_gender_isActive_idx";

-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "isAvailableForMatching" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "PetStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "matching_requests" (
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

-- CreateIndex
CREATE INDEX "matching_requests_requesterId_status_idx" ON "matching_requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "matching_requests_femalePetId_malePetId_status_idx" ON "matching_requests"("femalePetId", "malePetId", "status");

-- CreateIndex
CREATE INDEX "matching_requests_malePetId_status_idx" ON "matching_requests"("malePetId", "status");

-- CreateIndex
CREATE INDEX "pets_species_gender_status_isAvailableForMatching_idx" ON "pets"("species", "gender", "status", "isAvailableForMatching");

-- AddForeignKey
ALTER TABLE "matching_requests" ADD CONSTRAINT "matching_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_requests" ADD CONSTRAINT "matching_requests_femalePetId_fkey" FOREIGN KEY ("femalePetId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matching_requests" ADD CONSTRAINT "matching_requests_malePetId_fkey" FOREIGN KEY ("malePetId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
