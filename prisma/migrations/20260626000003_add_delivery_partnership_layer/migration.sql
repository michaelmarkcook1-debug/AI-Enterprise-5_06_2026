-- IT-services / GSI delivery-partnership layer (additive, idempotent, non-locking).
-- New tables + enums only — NO ALTER on populated tables. Curated analyst source
-- (AnalystGenius 2026-06-26). aiVendorId is an identity FK to intelligence_vendors
-- only; there is NO path from a partnership to a vendor SCORE column (firewall).

DO $$ BEGIN CREATE TYPE "PartnershipTier" AS ENUM ('direct_named','cloud_certified','observed_implementer'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EvidenceTierPartnership" AS ENUM ('strong','moderate','plausible_unverified'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PartnershipProvenance" AS ENUM ('analyst_curated_seed','news_confirmed'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "delivery_partners" (
  "delivery_partner_id" TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "slug"                TEXT NOT NULL,
  "kind"                TEXT NOT NULL DEFAULT 'global_si',
  "platform_hybrid"     BOOLEAN NOT NULL DEFAULT false,
  "hq"                  TEXT,
  "regions"             TEXT[] DEFAULT ARRAY[]::TEXT[],
  "source"              TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("delivery_partner_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_partners_slug_key" ON "delivery_partners"("slug");
CREATE INDEX IF NOT EXISTS "delivery_partners_slug_idx" ON "delivery_partners"("slug");

CREATE TABLE IF NOT EXISTS "delivery_partnerships" (
  "id"                   TEXT NOT NULL,
  "delivery_partner_id"  TEXT NOT NULL,
  "ai_vendor_id"         TEXT NOT NULL,
  "partnership_tier"     "PartnershipTier" NOT NULL,
  "evidence_tier"        "EvidenceTierPartnership" NOT NULL,
  "provenance"           "PartnershipProvenance" NOT NULL DEFAULT 'analyst_curated_seed',
  "source"               TEXT,
  "implementation_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "industries"           TEXT[] DEFAULT ARRAY[]::TEXT[],
  "regions"              TEXT[] DEFAULT ARRAY[]::TEXT[],
  "evidence_ids"         TEXT[] DEFAULT ARRAY[]::TEXT[],
  "source_urls"          TEXT[] DEFAULT ARRAY[]::TEXT[],
  "confidence"           DOUBLE PRECISION,
  "last_verified"        TIMESTAMP(3),
  "ended_at"             TIMESTAMP(3),
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_partnerships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_partnerships_partner_vendor_tier_key" ON "delivery_partnerships"("delivery_partner_id","ai_vendor_id","partnership_tier");
CREATE INDEX IF NOT EXISTS "delivery_partnerships_ai_vendor_id_partnership_tier_idx" ON "delivery_partnerships"("ai_vendor_id","partnership_tier");
CREATE INDEX IF NOT EXISTS "delivery_partnerships_provenance_partnership_tier_idx" ON "delivery_partnerships"("provenance","partnership_tier");

DO $$ BEGIN
  ALTER TABLE "delivery_partnerships" ADD CONSTRAINT "delivery_partnerships_partner_fk"
    FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("delivery_partner_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_partnerships" ADD CONSTRAINT "delivery_partnerships_vendor_fk"
    FOREIGN KEY ("ai_vendor_id") REFERENCES "intelligence_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
