-- AlterTable: Xóa an toàn các cột mã vận đơn cũ (ahamoveOrderCode, ghnOrderCode) nếu còn tồn tại trong bảng orders
ALTER TABLE "orders" DROP COLUMN IF EXISTS "ahamoveOrderCode";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "ghnOrderCode";
