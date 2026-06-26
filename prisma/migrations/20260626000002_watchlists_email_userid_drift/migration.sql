-- Reconcile the watchlists schema↔DB drift.
-- ---------------------------------------------------------------------------
-- The `watchlists` table (created in 20260507003000_initial_backend) was created
-- WITHOUT `email` / `user_id`. The Prisma `Watchlist` model later added
-- `email`, `userId` (-> user_id) and `@@index([userId])` — but NO migration was
-- ever authored, so the live DB drifted from the schema. Every Prisma query that
-- selects these columns failed at runtime with
--   "column watchlists.email does not exist in the current database"
-- which the silent seed fallback then swallowed (rendering seed as if live).
--
-- Additive + fully idempotent (IF NOT EXISTS) so it is safe under
-- `prisma migrate deploy` and safe to re-run. Names match Prisma's expectations
-- (`watchlists_user_id_idx`) so `prisma migrate status` reports no drift.
ALTER TABLE "watchlists" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "watchlists" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE INDEX IF NOT EXISTS "watchlists_user_id_idx" ON "watchlists"("user_id");
