-- Baseline for the existing development database schema.
-- This migration is marked as applied to avoid resetting local data.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."BreedingOption" AS ENUM ('CASH', 'SHARE_LITTER', 'NEGOTIATE');
CREATE TYPE "public"."DocumentStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED');
CREATE TYPE "public"."DocumentType" AS ENUM ('VACCINE_RECORD', 'PEDIGREE_CERT', 'HEALTH_CHECK');
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "public"."LikeStatus" AS ENUM ('PENDING', 'MATCHED', 'REJECTED');
CREATE TYPE "public"."MatchStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "public"."Species" AS ENUM ('DOG', 'CAT');
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR');
CREATE TYPE "public"."VerificationBadge" AS ENUM ('NONE', 'PENDING', 'VERIFIED');

CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."pets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "species" "public"."Species" NOT NULL,
    "breed" TEXT NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "birthday" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "colorDesc" TEXT,
    "isVaccinated" BOOLEAN NOT NULL DEFAULT false,
    "hasPedigree" BOOLEAN NOT NULL DEFAULT false,
    "pedigreeNumber" TEXT,
    "vaccineVerified" BOOLEAN NOT NULL DEFAULT false,
    "pedigreeVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationBadge" "public"."VerificationBadge" NOT NULL DEFAULT 'NONE',
    "avatarUrl" TEXT,
    "gallery" TEXT[],
    "personality" TEXT,
    "breedingOption" "public"."BreedingOption" NOT NULL DEFAULT 'NEGOTIATE',
    "breedingFee" DOUBLE PRECISION,
    "shareLitterCount" INTEGER,
    "lastBreedingAt" TIMESTAMP(3),
    "totalBreedings" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."breed_rules" (
    "id" TEXT NOT NULL,
    "species" "public"."Species" NOT NULL,
    "breedA" TEXT NOT NULL,
    "breedB" TEXT NOT NULL,
    "isCompatible" BOOLEAN NOT NULL DEFAULT true,
    "offspringName" TEXT,
    "warningNote" TEXT,
    CONSTRAINT "breed_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."likes" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "fromPetId" TEXT NOT NULL,
    "toPetId" TEXT NOT NULL,
    "status" "public"."LikeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."matches" (
    "id" TEXT NOT NULL,
    "pet1Id" TEXT NOT NULL,
    "pet2Id" TEXT NOT NULL,
    "compatibilityScore" INTEGER NOT NULL DEFAULT 0,
    "matchReasons" JSONB,
    "status" "public"."MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "breedingNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."pet_documents" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "type" "public"."DocumentType" NOT NULL,
    "title" TEXT,
    "imageUrls" TEXT[],
    "userNote" TEXT,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pet_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."pet_reports" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE UNIQUE INDEX "users_googleId_key" ON "public"."users"("googleId");
CREATE UNIQUE INDEX "pets_slug_key" ON "public"."pets"("slug");
CREATE INDEX "pets_species_gender_isActive_idx" ON "public"."pets"("species", "gender", "isActive");
CREATE INDEX "pets_ownerId_idx" ON "public"."pets"("ownerId");
CREATE INDEX "pets_breed_idx" ON "public"."pets"("breed");
CREATE INDEX "pets_location_idx" ON "public"."pets"("location");
CREATE UNIQUE INDEX "breed_rules_breedA_breedB_species_key" ON "public"."breed_rules"("breedA", "breedB", "species");
CREATE UNIQUE INDEX "likes_fromPetId_toPetId_key" ON "public"."likes"("fromPetId", "toPetId");
CREATE INDEX "likes_fromUserId_idx" ON "public"."likes"("fromUserId");
CREATE INDEX "likes_toPetId_status_idx" ON "public"."likes"("toPetId", "status");
CREATE UNIQUE INDEX "matches_pet1Id_pet2Id_key" ON "public"."matches"("pet1Id", "pet2Id");
CREATE INDEX "matches_pet1Id_status_idx" ON "public"."matches"("pet1Id", "status");
CREATE INDEX "matches_pet2Id_status_idx" ON "public"."matches"("pet2Id", "status");
CREATE INDEX "messages_matchId_createdAt_idx" ON "public"."messages"("matchId", "createdAt");
CREATE INDEX "messages_senderId_idx" ON "public"."messages"("senderId");
CREATE INDEX "pet_documents_petId_type_idx" ON "public"."pet_documents"("petId", "type");
CREATE INDEX "pet_documents_status_type_idx" ON "public"."pet_documents"("status", "type");

ALTER TABLE "public"."pets" ADD CONSTRAINT "pets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."likes" ADD CONSTRAINT "likes_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."likes" ADD CONSTRAINT "likes_fromPetId_fkey" FOREIGN KEY ("fromPetId") REFERENCES "public"."pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."likes" ADD CONSTRAINT "likes_toPetId_fkey" FOREIGN KEY ("toPetId") REFERENCES "public"."pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."matches" ADD CONSTRAINT "matches_pet1Id_fkey" FOREIGN KEY ("pet1Id") REFERENCES "public"."pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."matches" ADD CONSTRAINT "matches_pet2Id_fkey" FOREIGN KEY ("pet2Id") REFERENCES "public"."pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."pet_documents" ADD CONSTRAINT "pet_documents_petId_fkey" FOREIGN KEY ("petId") REFERENCES "public"."pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
