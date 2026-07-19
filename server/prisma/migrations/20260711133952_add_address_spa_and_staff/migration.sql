-- AlterTable
ALTER TABLE "spa_bookings" ADD COLUMN     "addressSpaId" TEXT,
ADD COLUMN     "issueReported" TEXT,
ADD COLUMN     "petConditionAfter" TEXT,
ADD COLUMN     "petId" TEXT,
ADD COLUMN     "photoAfter" TEXT;

-- CreateTable
CREATE TABLE "address_spa" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_spa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spa_staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressSpaId" TEXT,

    CONSTRAINT "spa_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "address_spa_status_idx" ON "address_spa"("status");

-- CreateIndex
CREATE INDEX "address_spa_managerId_idx" ON "address_spa"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "spa_staff_userId_key" ON "spa_staff"("userId");

-- AddForeignKey
ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_addressSpaId_fkey" FOREIGN KEY ("addressSpaId") REFERENCES "address_spa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_spa" ADD CONSTRAINT "address_spa_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_staff" ADD CONSTRAINT "spa_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_staff" ADD CONSTRAINT "spa_staff_addressSpaId_fkey" FOREIGN KEY ("addressSpaId") REFERENCES "address_spa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
