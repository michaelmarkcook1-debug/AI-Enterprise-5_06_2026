-- Broadened model-quality benchmark inputs (additive, idempotent, non-locking).
-- One cited row per (vendor, source, category) — the real LMArena capability
-- leaderboards (coding, hard_prompts, overall, vision, instruction_following)
-- that lib/system/model-quality-blend.ts blends into the 0–5 model_quality score.
-- New table only — NO ALTER on populated tables. vendor_id is an identity FK to
-- intelligence_vendors. Absence of a row = honest absence (no default).

CREATE TABLE IF NOT EXISTS "model_quality_benchmarks" (
  "id"           TEXT NOT NULL,
  "vendor_id"    TEXT NOT NULL,
  "source"       TEXT NOT NULL DEFAULT 'lmarena',
  "category"     TEXT NOT NULL,
  "rating"       DOUBLE PRECISION NOT NULL,
  "model_name"   TEXT NOT NULL,
  "vote_count"   INTEGER,
  "publish_date" TEXT,
  "source_url"   TEXT NOT NULL,
  "captured_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_quality_benchmarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "model_quality_benchmarks_vendor_id_source_category_key"
  ON "model_quality_benchmarks"("vendor_id", "source", "category");
CREATE INDEX IF NOT EXISTS "model_quality_benchmarks_source_category_idx"
  ON "model_quality_benchmarks"("source", "category");

-- FK to intelligence_vendors (cascade), added only if not already present.
DO $$ BEGIN
  ALTER TABLE "model_quality_benchmarks"
    ADD CONSTRAINT "model_quality_benchmarks_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "intelligence_vendors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
