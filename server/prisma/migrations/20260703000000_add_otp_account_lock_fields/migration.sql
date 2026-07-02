ALTER TABLE "public"."users"
ADD COLUMN "failed_otp_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP(3);
