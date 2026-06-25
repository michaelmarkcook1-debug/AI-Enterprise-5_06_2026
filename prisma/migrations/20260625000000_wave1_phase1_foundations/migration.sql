-- Phase 1 (v2 new shape) — public rankings + insight site foundations.
-- Purely ADDITIVE: five brand-new tables. No ALTER on existing tables, no data
-- touched. IF NOT EXISTS keeps it non-destructive + re-runnable. Reuses the
-- existing "EvidenceGrade" enum; defines no new enums.
--
-- Independence firewall: "vendor_commercial" holds commercial / vendor-supplied
-- facts and carries only a SOFT vendor_id reference (no FK into a score table),
-- so a commercial write can never reach a vendor score. See schema.prisma.

-- ── Commercial firewall table (empty in Wave 1) ─────────────────────────────
CREATE TABLE IF NOT EXISTS "vendor_commercial" (
    "id"                TEXT NOT NULL,
    "vendor_id"         TEXT NOT NULL,
    "claimed"           BOOLEAN NOT NULL DEFAULT false,
    "claimed_by_email"  TEXT,
    "tier"              TEXT NOT NULL DEFAULT 'none',
    "sponsor_placement" BOOLEAN NOT NULL DEFAULT false,
    "paid_plan_name"    TEXT,
    "notes"             TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_commercial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_commercial_vendor_id_key" ON "vendor_commercial"("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_commercial_vendor_id_idx" ON "vendor_commercial"("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_commercial_tier_idx" ON "vendor_commercial"("tier");

-- ── Dependency / encroachment graph edges (hero signal) ─────────────────────
CREATE TABLE IF NOT EXISTS "dependency_signals" (
    "id"             TEXT NOT NULL,
    "from_vendor_id" TEXT NOT NULL,
    "to_vendor_id"   TEXT NOT NULL,
    "kind"           TEXT NOT NULL,
    "direction"      TEXT NOT NULL DEFAULT 'depends_on',
    "strength"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rationale"      TEXT NOT NULL,
    "evidence_ids"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "source_urls"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence_grade" "EvidenceGrade",
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependency_signals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dependency_signals_from_to_kind_direction_key"
    ON "dependency_signals"("from_vendor_id", "to_vendor_id", "kind", "direction");
CREATE INDEX IF NOT EXISTS "dependency_signals_from_vendor_id_idx" ON "dependency_signals"("from_vendor_id");
CREATE INDEX IF NOT EXISTS "dependency_signals_to_vendor_id_idx" ON "dependency_signals"("to_vendor_id");
CREATE INDEX IF NOT EXISTS "dependency_signals_kind_idx" ON "dependency_signals"("kind");

-- ── Insight / education articles (CMS-lite) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "articles" (
    "id"           TEXT NOT NULL,
    "slug"         TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "summary"      TEXT,
    "body"         TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "tags"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "vendor_ids"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "author_name"  TEXT,
    "published_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "articles_slug_key" ON "articles"("slug");
CREATE INDEX IF NOT EXISTS "articles_status_published_at_idx" ON "articles"("status", "published_at");
CREATE INDEX IF NOT EXISTS "articles_slug_idx" ON "articles"("slug");

-- ── Anonymous buyer-intent event stream (the data asset) ────────────────────
CREATE TABLE IF NOT EXISTS "intent_events" (
    "id"           TEXT NOT NULL,
    "event_type"   TEXT NOT NULL,
    "target_id"    TEXT,
    "target_type"  TEXT,
    "industry"     TEXT,
    "size_band"    TEXT,
    "session_hash" TEXT NOT NULL,
    "referrer"     TEXT,
    "path"         TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "intent_events_event_type_created_at_idx" ON "intent_events"("event_type", "created_at");
CREATE INDEX IF NOT EXISTS "intent_events_target_type_target_id_idx" ON "intent_events"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "intent_events_created_at_idx" ON "intent_events"("created_at");

-- ── Email capture / newsletter (double opt-in) ──────────────────────────────
CREATE TABLE IF NOT EXISTS "subscribers" (
    "id"              TEXT NOT NULL,
    "email"           TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "source"          TEXT,
    "confirm_token"   TEXT,
    "confirmed_at"    TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "industry"        TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_email_key" ON "subscribers"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_confirm_token_key" ON "subscribers"("confirm_token");
CREATE INDEX IF NOT EXISTS "subscribers_status_idx" ON "subscribers"("status");
CREATE INDEX IF NOT EXISTS "subscribers_email_idx" ON "subscribers"("email");
