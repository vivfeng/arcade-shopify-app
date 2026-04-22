-- AlterTable
ALTER TABLE "ArcadeProduct" ADD COLUMN     "commissionRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "arcadeLinkedAt" TIMESTAMP(3);

-- Repoint legacy seed manufacturer id to canonical Esme maker UUID (Arcade maker id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Manufacturer" WHERE "id" = 'mfr-esme-textiles') THEN
    INSERT INTO "Manufacturer" ("id","name","capabilities","fulfillmentCapacity","createdAt","updatedAt")
    SELECT '294facb5-9ff1-4ae6-b1c6-e6e94cf64849', "name", "capabilities", "fulfillmentCapacity", NOW(), NOW()
    FROM "Manufacturer" WHERE "id" = 'mfr-esme-textiles'
    ON CONFLICT ("id") DO NOTHING;

    UPDATE "ProductType" SET "manufacturerId" = '294facb5-9ff1-4ae6-b1c6-e6e94cf64849' WHERE "manufacturerId" = 'mfr-esme-textiles';
    UPDATE "ArcadeOrder" SET "manufacturerId" = '294facb5-9ff1-4ae6-b1c6-e6e94cf64849' WHERE "manufacturerId" = 'mfr-esme-textiles';
    DELETE FROM "Manufacturer" WHERE "id" = 'mfr-esme-textiles';
  END IF;
END $$;

-- Lattice and Loom (Arcade maker id) — available for product types; no FK rows required
INSERT INTO "Manufacturer" ("id","name","capabilities","fulfillmentCapacity","createdAt","updatedAt")
VALUES (
  '5d25f996-396e-4e32-afa6-dd6a5c277281',
  'Lattice and Loom',
  '[]',
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
