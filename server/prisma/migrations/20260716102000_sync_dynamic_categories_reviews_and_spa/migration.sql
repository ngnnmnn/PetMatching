-- Extend the booking lifecycle used by the application.
ALTER TYPE "SpaBookingStatus" ADD VALUE 'LATE';

-- Preserve all existing category values while replacing the PostgreSQL enum
-- with the String type declared in schema.prisma.
ALTER TABLE "products"
ALTER COLUMN "category" TYPE TEXT
USING "category"::text;

DROP TYPE "ProductCategory";

-- Make a spa booking independent from a brand when necessary.
ALTER TABLE "spa_bookings"
DROP CONSTRAINT "spa_bookings_brandId_fkey";

ALTER TABLE "spa_bookings"
ALTER COLUMN "brandId" DROP NOT NULL;

ALTER TABLE "spa_bookings"
ADD CONSTRAINT "spa_bookings_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "spa_brands"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- These legacy columns are no longer present in the current SpaBrand model.
ALTER TABLE "spa_brands"
DROP COLUMN "address",
DROP COLUMN "phone";

-- Dynamic product categories.
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- Product reviews.
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_reviews_userId_idx" ON "product_reviews"("userId");
CREATE INDEX "product_reviews_productId_idx" ON "product_reviews"("productId");
CREATE UNIQUE INDEX "product_reviews_userId_productId_key"
ON "product_reviews"("userId", "productId");

ALTER TABLE "product_reviews"
ADD CONSTRAINT "product_reviews_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_reviews"
ADD CONSTRAINT "product_reviews_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
