/*
  Warnings:

  - Made the column `stock` on table `products` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill existing products before enforcing the required column.
UPDATE "products"
SET "stock" = 5
WHERE "stock" IS NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "stock" SET NOT NULL,
ALTER COLUMN "stock" SET DEFAULT 5;
