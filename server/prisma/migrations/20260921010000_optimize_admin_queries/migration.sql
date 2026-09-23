-- Replace single-column store indexes with compound indexes matching Admin filters and sorting.
DROP INDEX IF EXISTS "products_storeId_idx";
DROP INDEX IF EXISTS "orders_storeId_idx";

-- Admin user, pet and moderation lists.
CREATE INDEX IF NOT EXISTS "users_role_accountStatus_createdAt_idx"
ON "users"("role", "accountStatus", "createdAt");

CREATE INDEX IF NOT EXISTS "pets_status_createdAt_idx"
ON "pets"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "pets_verificationBadge_createdAt_idx"
ON "pets"("verificationBadge", "createdAt");

CREATE INDEX IF NOT EXISTS "pet_documents_status_createdAt_idx"
ON "pet_documents"("status", "createdAt");

-- Store dashboard, product and order lists.
CREATE INDEX IF NOT EXISTS "products_storeId_createdAt_idx"
ON "products"("storeId", "createdAt");

CREATE INDEX IF NOT EXISTS "products_storeId_isActive_idx"
ON "products"("storeId", "isActive");

CREATE INDEX IF NOT EXISTS "products_storeId_stock_idx"
ON "products"("storeId", "stock");

CREATE INDEX IF NOT EXISTS "orders_storeId_createdAt_idx"
ON "orders"("storeId", "createdAt");

CREATE INDEX IF NOT EXISTS "orders_storeId_status_idx"
ON "orders"("storeId", "status");

-- Spa dashboard, service and booking lists.
CREATE INDEX IF NOT EXISTS "spa_services_isActive_updatedAt_idx"
ON "spa_services"("isActive", "updatedAt");

CREATE INDEX IF NOT EXISTS "spa_bookings_addressSpaId_status_idx"
ON "spa_bookings"("addressSpaId", "status");

CREATE INDEX IF NOT EXISTS "spa_bookings_addressSpaId_createdAt_idx"
ON "spa_bookings"("addressSpaId", "createdAt");

CREATE INDEX IF NOT EXISTS "spa_bookings_addressSpaId_scheduledAt_idx"
ON "spa_bookings"("addressSpaId", "scheduledAt");

CREATE INDEX IF NOT EXISTS "spa_staff_addressSpaId_status_idx"
ON "spa_staff"("addressSpaId", "status");
