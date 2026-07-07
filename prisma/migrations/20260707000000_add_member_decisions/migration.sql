-- Saved decisions: a member's private, named 12-domain weighting profile +
-- shortlist for one category. Additive only — one new table, FK->subscribers;
-- NO ALTER to existing tables. Idempotent (IF NOT EXISTS + guarded FK) so a
-- retried deploy is safe. Sibling to member_watchlists, same firewall: no FK
-- to any score/ranking table.

CREATE TABLE IF NOT EXISTS "member_decisions" (
    "id"            TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "category"      TEXT NOT NULL,
    "weights"       JSONB NOT NULL,
    "shortlist"     JSONB NOT NULL DEFAULT '[]',
    "as_of_date"    TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "member_decisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "member_decisions_subscriber_id_idx" ON "member_decisions"("subscriber_id");

DO $$ BEGIN
  ALTER TABLE "member_decisions" ADD CONSTRAINT "member_decisions_subscriber_id_fkey"
    FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
