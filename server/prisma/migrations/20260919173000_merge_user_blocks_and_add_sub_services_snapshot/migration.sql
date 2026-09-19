-- Safe migration: Gộp bảng user_blocks vào users và bổ sung sub_services_snapshot cho spa_bookings

-- 1. Bổ sung trường blocked_user_ids cho bảng users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "blocked_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Bổ sung trường sub_services_snapshot cho bảng spa_bookings để lưu snapshot giá dịch vụ lẻ
ALTER TABLE "spa_bookings" ADD COLUMN IF NOT EXISTS "sub_services_snapshot" JSONB;

-- 3. Di chuyển dữ liệu chặn từ bảng user_blocks sang mảng blocked_user_ids của users
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'user_blocks'
    ) THEN
        UPDATE "users" u
        SET "blocked_user_ids" = sub.blocked_list
        FROM (
            SELECT "blockerId", array_agg("blockedId") AS blocked_list
            FROM "user_blocks"
            GROUP BY "blockerId"
        ) sub
        WHERE u."id" = sub."blockerId";
    END IF;
END $$;

-- 4. Xóa an toàn bảng user_blocks
DROP TABLE IF EXISTS "user_blocks" CASCADE;
