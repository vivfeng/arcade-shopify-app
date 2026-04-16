-- DropColumns: remove stored credentials and duplicated Shopify token from Shop
-- These are no longer needed: Firebase tokens are minted on demand via the
-- Admin SDK, and the Shopify access token lives in the Session table managed
-- by @shopify/shopify-app-session-storage-prisma.

ALTER TABLE "Shop" DROP COLUMN IF EXISTS "accessToken";
ALTER TABLE "Shop" DROP COLUMN IF EXISTS "arcadeRefreshToken";
ALTER TABLE "Shop" DROP COLUMN IF EXISTS "arcadeTokenExpiry";
ALTER TABLE "Shop" DROP COLUMN IF EXISTS "email";
