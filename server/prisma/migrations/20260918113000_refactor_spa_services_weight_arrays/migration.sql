-- AlterTable: Add new JSONB columns for array weight brackets, duration and price
ALTER TABLE "spa_services"
ADD COLUMN IF NOT EXISTS "pet_min_weight" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "pet_max_weight" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "duration" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Convert existing single values to JSONB arrays if old columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spa_services' AND column_name = 'petWeightMin') THEN
    UPDATE "spa_services"
    SET "pet_min_weight" = CASE 
      WHEN "petWeightMin" IS NOT NULL THEN jsonb_build_array("petWeightMin")
      ELSE '[0]'::jsonb 
    END
    WHERE "pet_min_weight" = '[]'::jsonb OR "pet_min_weight" IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spa_services' AND column_name = 'petWeightMax') THEN
    UPDATE "spa_services"
    SET "pet_max_weight" = CASE 
      WHEN "petWeightMax" IS NOT NULL THEN jsonb_build_array("petWeightMax")
      ELSE '[null]'::jsonb 
    END
    WHERE "pet_max_weight" = '[]'::jsonb OR "pet_max_weight" IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spa_services' AND column_name = 'durationMin') THEN
    UPDATE "spa_services"
    SET "duration" = CASE 
      WHEN "durationMin" IS NOT NULL THEN jsonb_build_array("durationMin")
      ELSE '[60]'::jsonb 
    END
    WHERE "duration" = '[]'::jsonb OR "duration" IS NULL;
  END IF;
END $$;

-- Convert price column to JSONB if it was double precision
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spa_services' AND column_name = 'price' AND data_type != 'jsonb'
  ) THEN
    ALTER TABLE "spa_services" 
    ALTER COLUMN "price" TYPE JSONB USING jsonb_build_array("price");
  END IF;
END $$;

-- Convert species column to TEXT with default 'ALL'
DO $$
BEGIN
  ALTER TABLE "spa_services"
  ALTER COLUMN "species" TYPE TEXT USING COALESCE("species"::text, 'ALL');
  ALTER TABLE "spa_services" ALTER COLUMN "species" SET DEFAULT 'ALL';
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop legacy columns safely if exists
ALTER TABLE "spa_services" DROP COLUMN IF EXISTS "petWeightMin";
ALTER TABLE "spa_services" DROP COLUMN IF EXISTS "petWeightMax";
ALTER TABLE "spa_services" DROP COLUMN IF EXISTS "durationMin";
ALTER TABLE "spa_services" DROP COLUMN IF EXISTS "durationMax";
