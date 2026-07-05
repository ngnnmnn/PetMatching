-- Ensure the deployed project has exactly one root admin account.
-- Default login:
--   email: admin@gmail.com
--   password: 123456

UPDATE "users"
SET
  "role" = 'USER'::"UserRole",
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'ADMIN'::"UserRole"
  AND "email" <> 'admin@gmail.com';

INSERT INTO "users" (
  "id",
  "email",
  "passwordHash",
  "name",
  "role",
  "accountStatus",
  "isVerified",
  "createdAt",
  "updatedAt"
)
VALUES (
  'root_admin_account',
  'admin@gmail.com',
  '$2b$10$A.QPAIrM7RL31rPBqs63nOLp/AQKF36.UQ4lKDqK4XC3zmh5O9d5q',
  'Admin',
  'ADMIN'::"UserRole",
  'ACTIVE'::"AccountStatus",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET
  "passwordHash" = EXCLUDED."passwordHash",
  "name" = EXCLUDED."name",
  "role" = 'ADMIN'::"UserRole",
  "accountStatus" = 'ACTIVE'::"AccountStatus",
  "isVerified" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "users_single_admin_idx"
ON "users" ("role")
WHERE "role" = 'ADMIN'::"UserRole";
