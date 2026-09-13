-- Đồng bộ schema Store với trạng thái hiện tại: sản phẩm không còn thuộc tính đơn vị tính.
-- IF EXISTS giúp migration an toàn với DB đã được xóa cột/bảng bởi migration thất lạc trước đó.
ALTER TABLE "products" DROP COLUMN IF EXISTS "unit";

DROP TABLE IF EXISTS "product_units" CASCADE;
