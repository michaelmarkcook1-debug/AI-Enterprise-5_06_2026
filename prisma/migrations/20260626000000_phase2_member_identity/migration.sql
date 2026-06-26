-- Phase 2 Wave 1: member identity (magic-link auth + private watchlist).
-- Additive only — three new tables, each FK→subscribers; NO ALTER to existing
-- tables. Idempotent (IF NOT EXISTS + guarded FKs) so a retried deploy is safe.

-- Magic-link tokens: single-use, short-TTL, hashed at rest.
CREATE TABLE IF NOT EXISTS "auth_tokens" (
    "id"            TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "token_hash"    TEXT NOT NULL,
    "purpose"       TEXT NOT NULL DEFAULT 'signin',
    "expires_at"    TIMESTAMP(3) NOT NULL,
    "consumed_at"   TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "auth_tokens_subscriber_id_idx" ON "auth_tokens"("subscriber_id");
CREATE INDEX IF NOT EXISTS "auth_tokens_expires_at_idx" ON "auth_tokens"("expires_at");

-- Member sessions: the httpOnly cookie holds the raw token; we store its hash.
CREATE TABLE IF NOT EXISTS "member_sessions" (
    "id"            TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "token_hash"    TEXT NOT NULL,
    "expires_at"    TIMESTAMP(3) NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "member_sessions_token_hash_key" ON "member_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "member_sessions_subscriber_id_idx" ON "member_sessions"("subscriber_id");
CREATE INDEX IF NOT EXISTS "member_sessions_expires_at_idx" ON "member_sessions"("expires_at");

-- Member watchlist: FIREWALLED — vendor slugs + category ids as plain strings,
-- no FK to any score table, no relation to the anonymous `watchlists`.
CREATE TABLE IF NOT EXISTS "member_watchlists" (
    "id"            TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "vendors"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "categories"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "use_cases"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "current_stack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "member_watchlists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "member_watchlists_subscriber_id_key" ON "member_watchlists"("subscriber_id");

-- Foreign keys (cascade = a GDPR subscriber delete cleans up identity + watchlist).
DO $$ BEGIN
  ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_subscriber_id_fkey"
    FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_subscriber_id_fkey"
    FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "member_watchlists" ADD CONSTRAINT "member_watchlists_subscriber_id_fkey"
    FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
