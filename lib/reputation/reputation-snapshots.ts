// Forward-only reputation tracking.
// ──────────────────────────────────
// Reputation has no recorded history in the seed, so we CANNOT draw a reputation
// line back across the existing score history without fabricating it. Instead we
// capture today's reputation composite once per day (co-located with the ranking
// snapshot, same date) into this table, so a REAL reputation line accrues from
// the day tracking starts. The line is short at first and grows — honest by
// construction; we never back-fill past values.
//
// Self-migrating (CREATE TABLE IF NOT EXISTS) like the other lib/system stores,
// so it comes online without a separate `prisma migrate deploy`.

import { getPrisma, hasDatabase } from "../prisma";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "vendor_reputation_snapshots" (
  "vendor_id"        TEXT NOT NULL,
  "snapshot_date"    DATE NOT NULL,
  "reputation_score" DOUBLE PRECISION NOT NULL,
  "captured_at"      TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("vendor_id", "snapshot_date")
);
CREATE INDEX IF NOT EXISTS "vendor_reputation_snapshots_vendor_idx"
  ON "vendor_reputation_snapshots" ("vendor_id", "snapshot_date");
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

export interface ReputationSnapshotPoint {
  date: string; // ISO yyyy-mm-dd
  reputationScore: number;
}

/** Upsert one vendor's reputation composite for a given date. Idempotent on
 *  (vendor_id, snapshot_date). No-op without a database. */
export async function recordReputationSnapshot(
  vendorId: string,
  dateLabel: string,
  reputationScore: number,
): Promise<void> {
  if (!hasDatabase()) return;
  await ensureTable();
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO "vendor_reputation_snapshots" ("vendor_id", "snapshot_date", "reputation_score")
     VALUES ($1, $2::date, $3)
     ON CONFLICT ("vendor_id", "snapshot_date")
     DO UPDATE SET "reputation_score" = EXCLUDED."reputation_score", "captured_at" = now()`,
    vendorId,
    dateLabel,
    reputationScore,
  );
}

/** Read a vendor's reputation history (oldest first). Empty until daily capture
 *  has run at least once. Pure read — never runs DDL (that's the write path's
 *  job), so a public page never creates tables. Returns [] on any failure
 *  (incl. the table not existing yet before the first capture). */
export async function getReputationSnapshots(vendorId: string): Promise<ReputationSnapshotPoint[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await getPrisma().$queryRawUnsafe<
      { snapshot_date: Date | string; reputation_score: number }[]
    >(
      `SELECT "snapshot_date", "reputation_score" FROM "vendor_reputation_snapshots"
       WHERE "vendor_id" = $1 ORDER BY "snapshot_date" ASC`,
      vendorId,
    );
    return rows.map((r) => ({
      date:
        r.snapshot_date instanceof Date
          ? r.snapshot_date.toISOString().slice(0, 10)
          : String(r.snapshot_date).slice(0, 10),
      reputationScore: Number(r.reputation_score),
    }));
  } catch {
    return [];
  }
}
