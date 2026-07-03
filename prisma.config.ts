import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * The connection `prisma migrate deploy` / `migrate status` use — a DIRECT
 * (non-pooled) endpoint.
 *
 * WHY (2026-07-03): `DATABASE_URL` points at Neon's `-pooler` (PgBouncer)
 * endpoint, which is right for the RUNTIME client (lib/prisma.ts reads
 * DATABASE_URL directly and is unaffected by this file). But `prisma migrate`
 * takes a SESSION-level advisory lock (pg_advisory_lock 72707369); through
 * PgBouncer the physical connection is recycled into the pool while still
 * holding that lock, stranding it and failing the NEXT deploy with P1002
 * ("Timed out trying to acquire a postgres advisory lock"). Prisma's documented
 * fix is a direct connection for migrations.
 *
 * Neon's direct host is the pooled host minus "-pooler", so we derive it with
 * zero new secrets — no DIRECT_URL env var to manage (though one, if set, wins).
 */
function migrateUrl(): string {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const pooled = process.env.DATABASE_URL ?? "";
  return pooled.replace("-pooler.", ".");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read directly from process.env rather than prisma/config's `env()` helper,
    // which THROWS when the var is unset. `prisma generate` doesn't connect to
    // the DB, so it must succeed even without DATABASE_URL (e.g. a Vercel build
    // step before the runtime env is applied) — migrateUrl() returns "" then.
    // Migrate/deploy read the real DIRECT URL from process.env when present.
    url: migrateUrl(),
  },
});
