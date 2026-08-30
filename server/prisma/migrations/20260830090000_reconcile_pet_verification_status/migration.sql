UPDATE "pets" AS pet
SET
  "verificationBadge" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "pet_documents" AS document
      WHERE document."petId" = pet."id"
        AND document."status" = 'APPROVED'::"DocumentStatus"
    ) THEN 'VERIFIED'::"VerificationBadge"
    WHEN EXISTS (
      SELECT 1
      FROM "pet_documents" AS document
      WHERE document."petId" = pet."id"
        AND document."status" IN (
          'PENDING'::"DocumentStatus",
          'REVIEWING'::"DocumentStatus",
          'NEED_MORE_INFO'::"DocumentStatus"
        )
    ) THEN 'PENDING'::"VerificationBadge"
    ELSE 'NONE'::"VerificationBadge"
  END,
  "vaccineVerified" = EXISTS (
    SELECT 1
    FROM "pet_documents" AS document
    WHERE document."petId" = pet."id"
      AND document."type" = 'VACCINE_RECORD'::"DocumentType"
      AND document."status" = 'APPROVED'::"DocumentStatus"
  ),
  "pedigreeVerified" = EXISTS (
    SELECT 1
    FROM "pet_documents" AS document
    WHERE document."petId" = pet."id"
      AND document."type" = 'PEDIGREE_CERT'::"DocumentType"
      AND document."status" = 'APPROVED'::"DocumentStatus"
  );
