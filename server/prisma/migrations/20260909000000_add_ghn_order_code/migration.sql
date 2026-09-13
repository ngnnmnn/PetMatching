-- Migration: Thêm cột ghnOrderCode vào bảng orders một cách an toàn
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "ghnOrderCode" TEXT;
