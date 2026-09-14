-- Cập nhật tất cả các đơn hàng cũ có trạng thái PACKED sang CONFIRMED
UPDATE "orders" SET "status" = 'CONFIRMED' WHERE "status"::text = 'PACKED';

-- Xóa an toàn cột unit trong bảng products nếu tồn tại
ALTER TABLE "products" DROP COLUMN IF EXISTS "unit";

-- Xóa an toàn bảng product_units nếu tồn tại
DROP TABLE IF EXISTS "product_units" CASCADE;
