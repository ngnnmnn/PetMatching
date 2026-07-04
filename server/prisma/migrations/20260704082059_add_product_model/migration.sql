-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('DOG_FOOD', 'CAT_FOOD', 'TOY', 'ACCESSORY', 'GROOMING', 'CAGE_BED', 'LEASH_COLLAR', 'MEDICAL');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "category" "ProductCategory" NOT NULL,
    "targetSpecies" TEXT NOT NULL DEFAULT 'ALL',
    "description" TEXT,
    "imageUrl" TEXT,
    "images" TEXT[],
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION,
    "brand" TEXT,
    "unit" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_isActive_idx" ON "products"("category", "isActive");

-- CreateIndex
CREATE INDEX "products_isFeatured_isActive_idx" ON "products"("isFeatured", "isActive");

-- CreateIndex
CREATE INDEX "products_targetSpecies_isActive_idx" ON "products"("targetSpecies", "isActive");
