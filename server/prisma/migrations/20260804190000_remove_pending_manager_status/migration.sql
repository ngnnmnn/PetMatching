UPDATE "users"
SET "accountStatus" = 'ACTIVE'
WHERE "accountStatus" = 'PENDING_MANAGER';
