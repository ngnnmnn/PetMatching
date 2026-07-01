-- OTP is now stored hashed in email_otps. Remove legacy plain OTP columns.
ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "otpCode";
ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "otpExpiresAt";
