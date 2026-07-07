-- Read-only share links for a saved decision: signed (256-bit CSPRNG, sha256
-- hashed at rest), expiring, revocable. Additive only — one new table, FKs to
-- member_decisions + subscribers; NO ALTER to existing tables. Idempotent
-- (IF NOT EXISTS + guarded FKs) so a retried deploy is safe.

CREATE TABLE IF NOT EXISTS "member_decision_shares" (
    "id"               TEXT NOT NULL,
    "decision_id"      TEXT NOT NULL,
    "subscriber_id"    TEXT NOT NULL,
    "token_hash"       TEXT NOT NULL,
    "display_name"     TEXT,
    "expires_at"       TIMESTAMP(3) NOT NULL,
    "revoked_at"       TIMESTAMP(3),
    "view_count"       INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_decision_shares_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "member_decision_shares_token_hash_key" ON "member_decision_shares"("token_hash");
CREATE INDEX IF NOT EXISTS "member_decision_shares_subscriber_id_idx" ON "member_decision_shares"("subscriber_id");
CREATE INDEX IF NOT EXISTS "member_decision_shares_decision_id_idx" ON "member_decision_shares"("decision_id");
CREATE INDEX IF NOT EXISTS "member_decision_shares_expires_at_idx" ON "member_decision_shares"("expires_at");

DO $$ BEGIN
  ALTER TABLE "member_decision_shares" ADD CONSTRAINT "member_decision_shares_decision_id_fkey"
    FOREIGN KEY ("decision_id") REFERENCES "member_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "member_decision_shares" ADD CONSTRAINT "member_decision_shares_subscriber_id_fkey"
    FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
