-- Lưu tọa độ địa chỉ khách hàng và snapshot điểm giao trên từng đơn hàng.
ALTER TABLE "addresses"
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "shippingLatitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "shippingLongitude" DOUBLE PRECISION;
