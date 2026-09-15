-- Lưu tọa độ điểm lấy hàng được Admin chọn từ OpenStreetMap.
ALTER TABLE "stores"
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
