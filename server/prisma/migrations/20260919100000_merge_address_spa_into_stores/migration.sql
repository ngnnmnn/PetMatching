-- Safe migration: Hợp nhất bảng address_spa vào bảng stores

-- 1. Thêm cột manager_id vào bảng stores nếu chưa có
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "manager_id" TEXT;

-- 2. Đồng bộ managerId từ address_spa sang stores
UPDATE "stores" s
SET "manager_id" = a."managerId"
FROM "address_spa" a
WHERE s."manager_id" IS NULL AND a."managerId" IS NOT NULL;

-- 3. Xóa các khóa ngoại cũ tham chiếu address_spa trước khi cập nhật dữ liệu
ALTER TABLE "spa_bookings" DROP CONSTRAINT IF EXISTS "spa_bookings_addressSpaId_fkey";
ALTER TABLE "spa_staff" DROP CONSTRAINT IF EXISTS "spa_staff_addressSpaId_fkey";
ALTER TABLE "address_spa" DROP CONSTRAINT IF EXISTS "address_spa_managerId_fkey";

-- 4. Chuyển toàn bộ foreign key addressSpaId trong spa_bookings và spa_staff sang store ID hợp nhất
DO $$
DECLARE
    target_store_id TEXT;
BEGIN
    SELECT "id" INTO target_store_id FROM "stores" ORDER BY "createdAt" ASC LIMIT 1;
    
    IF target_store_id IS NOT NULL THEN
        UPDATE "spa_bookings" 
        SET "addressSpaId" = target_store_id 
        WHERE "addressSpaId" IS NOT NULL;

        UPDATE "spa_staff" 
        SET "addressSpaId" = target_store_id 
        WHERE "addressSpaId" IS NOT NULL;
    END IF;
END $$;

-- 5. Tạo khóa ngoại mới tham chiếu stores(id) và users(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spa_bookings_addressSpaId_fkey'
    ) THEN
        ALTER TABLE "spa_bookings" ADD CONSTRAINT "spa_bookings_addressSpaId_fkey" 
            FOREIGN KEY ("addressSpaId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'spa_staff_addressSpaId_fkey'
    ) THEN
        ALTER TABLE "spa_staff" ADD CONSTRAINT "spa_staff_addressSpaId_fkey" 
            FOREIGN KEY ("addressSpaId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stores_manager_id_fkey'
    ) THEN
        ALTER TABLE "stores" ADD CONSTRAINT "stores_manager_id_fkey" 
            FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. Tạo index cho manager_id trên bảng stores
CREATE INDEX IF NOT EXISTS "stores_manager_id_idx" ON "stores"("manager_id");

-- 7. Xóa an toàn bảng address_spa sau khi đã chuyển đổi toàn bộ dữ liệu
DROP TABLE IF EXISTS "address_spa" CASCADE;
