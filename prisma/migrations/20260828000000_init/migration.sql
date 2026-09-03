CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT,
  "expires" TIMESTAMP(3),
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN NOT NULL DEFAULT false,
  "locale" TEXT,
  "collaborator" BOOLEAN DEFAULT false,
  "emailVerified" BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS "Session_shop_idx" ON "Session"("shop");

CREATE TABLE IF NOT EXISTS "EntrolyticsConfig" (
  "id" TEXT PRIMARY KEY,
  "shop" TEXT NOT NULL UNIQUE,
  "websiteId" TEXT NOT NULL,
  "clientKey" TEXT NOT NULL,
  "host" TEXT NOT NULL DEFAULT 'https://api.entrolytics.click',
  "autoTrack" BOOLEAN NOT NULL DEFAULT true,
  "trackRevenue" BOOLEAN NOT NULL DEFAULT true,
  "respectDnt" BOOLEAN NOT NULL DEFAULT false,
  "scriptTagId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "EntrolyticsConfig_shop_idx" ON "EntrolyticsConfig"("shop");

ALTER TABLE "EntrolyticsConfig" ADD COLUMN IF NOT EXISTS "clientKey" TEXT;
DELETE FROM "EntrolyticsConfig" WHERE "clientKey" IS NULL;
ALTER TABLE "EntrolyticsConfig" ALTER COLUMN "clientKey" SET NOT NULL;
ALTER TABLE "EntrolyticsConfig"
  ALTER COLUMN "host" SET DEFAULT 'https://api.entrolytics.click';
