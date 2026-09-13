-- AlterTable: Bổ sung cột ahamoveOrderCode an toàn
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ahamoveOrderCode" TEXT;
