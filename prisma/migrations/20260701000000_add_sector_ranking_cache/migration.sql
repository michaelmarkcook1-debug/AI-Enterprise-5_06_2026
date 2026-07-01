-- C15 — per-sector materialised ranking cache (additive, idempotent, non-locking).
-- ONE row per market category, written once per refresh cycle and served to every
-- subscriber covering that sector (computed once, not per page load). captured_at
-- is the honest as-of; the cache is NEVER a source of scores (read-through only,
-- with a live compute always available as fallback). New table only — no ALTER.
CREATE TABLE IF NOT EXISTS "sector_ranking_cache" (
  "category_id" TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "is_live"     BOOLEAN NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sector_ranking_cache_pkey" PRIMARY KEY ("category_id")
);
