// Schema-drift guard — fail LOUD when the live DB is behind the code.
// ───────────────────────────────────────────────────────────────────
// Why this exists: the Neon-Vercel integration gives preview deploys their own
// auto-migrated branch, so a preview build can show "all migrations applied"
// while the PRODUCTION database (only migrated when the production branch
// deploys) silently falls behind. When that happens, code that queries the new
// tables/columns breaks quietly. This compares the migrations the code ships
// with (lib/db/expected-migrations.ts, frozen at build time) against what's
// actually recorded in the live DB's `_prisma_migrations`, and surfaces drift
// in the daily-refresh run + /admin/pipeline-health instead of letting features
// fail without explanation.

import { getPrisma, hasDatabase } from "../prisma";
import { EXPECTED_MIGRATIONS, LATEST_EXPECTED_MIGRATION } from "./expected-migrations";

export type DriftStatus = "ok" | "behind" | "ahead" | "no_database" | "check_failed";

export interface MigrationDriftResult {
  status: DriftStatus;
  /** True only when no expected migration is missing from the DB. */
  ok: boolean;
  /** Migrations the code expects but the DB has NOT applied (the dangerous case). */
  pending: string[];
  /** Migrations the DB has applied that the code doesn't know about (DB ahead of code). */
  unknown: string[];
  expectedCount: number;
  appliedCount: number;
  latestExpected: string | null;
  latestApplied: string | null;
  /** Human-readable one-liner for logs / the admin panel. */
  message: string;
}

/**
 * Pure comparison — no I/O, fully unit-testable.
 * `pending` = expected ∖ applied (DB is behind → BAD).
 * `unknown` = applied ∖ expected (DB is ahead of the code → usually old code
 *             running against a newer DB; informational, not a failure here).
 */
export function diffMigrations(
  expected: readonly string[],
  applied: readonly string[],
): { status: DriftStatus; ok: boolean; pending: string[]; unknown: string[] } {
  const appliedSet = new Set(applied);
  const expectedSet = new Set(expected);
  const pending = expected.filter((m) => !appliedSet.has(m));
  const unknown = applied.filter((m) => !expectedSet.has(m));
  const ok = pending.length === 0;
  const status: DriftStatus = pending.length > 0 ? "behind" : unknown.length > 0 ? "ahead" : "ok";
  return { status, ok, pending, unknown };
}

/**
 * Check the live DB against the code's expected migrations. Never throws — a
 * failed check is reported as `check_failed` (ok:true so it doesn't, by itself,
 * mark the pipeline red), while genuine drift (`behind`) reports ok:false.
 */
export async function checkMigrationDrift(): Promise<MigrationDriftResult> {
  const expected = [...EXPECTED_MIGRATIONS];
  const base: Omit<MigrationDriftResult, "status" | "ok" | "pending" | "unknown" | "appliedCount" | "latestApplied" | "message"> = {
    expectedCount: expected.length,
    latestExpected: LATEST_EXPECTED_MIGRATION,
  };

  if (!hasDatabase()) {
    return {
      ...base,
      status: "no_database",
      ok: true,
      pending: [],
      unknown: [],
      appliedCount: 0,
      latestApplied: null,
      message: "No database configured — migration drift not checked.",
    };
  }

  try {
    const prisma = getPrisma();
    // Only count migrations that actually finished and weren't rolled back.
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY finished_at ASC
    `;
    const applied = rows.map((r) => r.migration_name);
    const { status, ok, pending, unknown } = diffMigrations(expected, applied);
    const latestApplied = applied.length ? applied[applied.length - 1] : null;

    const message =
      status === "behind"
        ? `DB SCHEMA DRIFT: ${pending.length} migration(s) the code expects are NOT applied to the live database (${pending.join(", ")}). Deploy the production branch (or run \`prisma migrate deploy\`) against this DB — features touching these tables will fail until then.`
        : status === "ahead"
          ? `DB is ahead of this code by ${unknown.length} migration(s) (${unknown.join(", ")}) — likely an older deployment running against a newer database. Not blocking, but redeploy the latest code.`
          : `Schema in sync — all ${expected.length} expected migrations applied.`;

    return {
      ...base,
      status,
      ok,
      pending,
      unknown,
      appliedCount: applied.length,
      latestApplied,
      message,
    };
  } catch (err) {
    return {
      ...base,
      status: "check_failed",
      ok: true, // can't confirm drift → don't, on its own, fail the pipeline
      pending: [],
      unknown: [],
      appliedCount: 0,
      latestApplied: null,
      message: `Migration-drift check could not run: ${(err as Error).message}`,
    };
  }
}
