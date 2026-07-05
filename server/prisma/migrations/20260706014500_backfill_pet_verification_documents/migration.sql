-- Backfill verification requests for pets that were created before PetDocument creation was wired.

INSERT INTO "pet_documents" (
  "id",
  "petId",
  "type",
  "title",
  "imageUrls",
  "userNote",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_vaccine_' || "pets"."id",
  "pets"."id",
  'VACCINE_RECORD'::"DocumentType",
  'Sổ tiêm phòng',
  ARRAY[]::TEXT[],
  'Người dùng khai báo đã tiêm đủ 3 mũi cơ bản. Hồ sơ này được bổ sung từ dữ liệu cũ, chưa có ảnh giấy tờ.',
  'PENDING'::"DocumentStatus",
  "pets"."createdAt",
  CURRENT_TIMESTAMP
FROM "pets"
WHERE "pets"."isVaccinated" = true
  AND NOT EXISTS (
    SELECT 1 FROM "pet_documents"
    WHERE "pet_documents"."petId" = "pets"."id"
      AND "pet_documents"."type" = 'VACCINE_RECORD'::"DocumentType"
  );

INSERT INTO "pet_documents" (
  "id",
  "petId",
  "type",
  "title",
  "imageUrls",
  "userNote",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_pedigree_' || "pets"."id",
  "pets"."id",
  'PEDIGREE_CERT'::"DocumentType",
  'Giấy chứng nhận phả hệ',
  ARRAY[]::TEXT[],
  COALESCE("pets"."pedigreeNumber", 'Người dùng khai báo có giấy tờ phả hệ. Hồ sơ này được bổ sung từ dữ liệu cũ, chưa có ảnh giấy tờ.'),
  'PENDING'::"DocumentStatus",
  "pets"."createdAt",
  CURRENT_TIMESTAMP
FROM "pets"
WHERE "pets"."hasPedigree" = true
  AND NOT EXISTS (
    SELECT 1 FROM "pet_documents"
    WHERE "pet_documents"."petId" = "pets"."id"
      AND "pet_documents"."type" = 'PEDIGREE_CERT'::"DocumentType"
  );

UPDATE "pets"
SET "verificationBadge" = 'PENDING'::"VerificationBadge"
WHERE ("isVaccinated" = true OR "hasPedigree" = true)
  AND "verificationBadge" = 'NONE'::"VerificationBadge";
