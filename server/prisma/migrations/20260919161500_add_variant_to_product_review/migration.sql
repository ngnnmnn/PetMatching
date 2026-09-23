-- AlterTable
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "variant_id" TEXT;
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "variant_name" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_reviews_variant_id_idx" ON "product_reviews"("variant_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_variant_id_fkey'
  ) THEN
    ALTER TABLE "product_reviews"
    ADD CONSTRAINT "product_reviews_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
