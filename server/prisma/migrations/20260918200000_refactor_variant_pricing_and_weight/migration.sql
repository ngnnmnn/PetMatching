-- Safe migration: Bổ sung trường weight_kg và tự động tạo Variant mặc định cho các sản phẩm chưa có phân loại

-- 1. Thêm cột weight_kg cho bảng products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_kg" DOUBLE PRECISION DEFAULT 0.5;

-- 2. Thêm cột weight_kg cho bảng product_variants
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "weight_kg" DOUBLE PRECISION;

-- 3. Tạo biến thể mặc định cho những sản phẩm chưa có biến thể nào
INSERT INTO "product_variants" ("id", "product_id", "name", "selling_price", "sale_price", "import_price", "stock", "weight_kg", "is_active", "created_at", "updated_at")
SELECT 
    'v_default_' || p."id",
    p."id",
    'Mặc định',
    p."sellingPrice",
    p."salePrice",
    p."importPrice",
    COALESCE(p."stock", 0),
    COALESCE(p."weight_kg", 0.5),
    true,
    NOW(),
    NOW()
FROM "products" p
WHERE NOT EXISTS (
    SELECT 1 FROM "product_variants" pv WHERE pv."product_id" = p."id"
);
