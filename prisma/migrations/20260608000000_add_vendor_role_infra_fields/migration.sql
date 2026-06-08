-- Cross-tab enrichment: fold the Query-v2 entity model into the intelligence_vendors spine.
-- All columns are additive and nullable/defaulted — non-locking on a populated table.
-- Structural/editorial facts only; measured scores stay derived at read-time.

ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "role_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "infra_band" TEXT;
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "infra_band_secondary" TEXT;
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "models_owned" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "hosted_third_party" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "infrastructure_exposure" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "investor_relationships" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "hardware_dependencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "cio_interpretation" TEXT;
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "data_caveats" TEXT;
ALTER TABLE "intelligence_vendors" ADD COLUMN IF NOT EXISTS "evidence_grade" TEXT;

CREATE INDEX IF NOT EXISTS "intelligence_vendors_infra_band_idx" ON "intelligence_vendors"("infra_band");
