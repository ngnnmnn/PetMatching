-- CreateEnum: Tạo enum BreedType an toàn nếu chưa có
DO $$ BEGIN
    CREATE TYPE "BreedType" AS ENUM ('PUREBRED', 'HYBRID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Thêm cột breedType và allowPedigree vào bảng breeds
ALTER TABLE "breeds"
ADD COLUMN IF NOT EXISTS "breedType" "BreedType" NOT NULL DEFAULT 'PUREBRED',
ADD COLUMN IF NOT EXISTS "allowPedigree" BOOLEAN NOT NULL DEFAULT true;

-- Tạo index cho species và breedType nếu chưa có
CREATE INDEX IF NOT EXISTS "breeds_species_breedType_idx" ON "breeds"("species", "breedType");

-- AlterTable: Thêm cột isBlocked vào bảng breed_rules
ALTER TABLE "breed_rules"
ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- Tạo index cho species và isBlocked nếu chưa có
CREATE INDEX IF NOT EXISTS "breed_rules_species_isBlocked_idx" ON "breed_rules"("species", "isBlocked");
