// AIE-06/07 — Pool persistence (self-migrating raw SQL, same pattern as
// lib/interrogation/session-store.ts / lib/billing/credits.ts).
// ─────────────────────────────────────────────────────────────────────────────
// Two tables, deliberately asymmetric:
//   • ai_contribution_consent — lives on the ORG's own side. Has session_id/
//     seat_id/org_id (an audit trail: who consented, when, to what terms).
//     Never joined into the pool.
//   • ai_pool_contribution — the pool itself. Has NO session_id/seat_id/org_id
//     COLUMN AT ALL. This isn't a masked/nulled field — the column doesn't
//     exist — so there is no query, join, or bug that could ever leak a
//     contribution back to its source at the SQL layer. insertPoolContribution
//     only accepts a PoolContribution value, whose TS type has the same gap.

import { getPrisma, hasDatabase } from "../prisma";
import type { PrismaClient } from "../../generated/prisma/client";
import type { ConsentRecord, PoolContribution } from "./types";
import type { Segment } from "../peer/segments";

/** The subset of the Prisma client needed for raw SQL — satisfied by both
 *  getPrisma() and a $transaction(...) callback's `tx` client, so callers can
 *  pass either and get the same behavior, atomic or not. */
type DbClient = Pick<PrismaClient, "$executeRaw" | "$queryRaw">;

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "ai_contribution_consent" (
  "id"            TEXT PRIMARY KEY,
  "session_id"    TEXT NOT NULL UNIQUE,
  "seat_id"       TEXT NOT NULL,
  "org_id"        TEXT NOT NULL,
  "consented"     BOOLEAN NOT NULL,
  "terms_version" TEXT NOT NULL,
  "decided_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ai_consent_org_idx" ON "ai_contribution_consent" ("org_id");
CREATE TABLE IF NOT EXISTS "ai_pool_contribution" (
  "id"              TEXT PRIMARY KEY,
  "vertical"        TEXT NOT NULL,
  "size_band"       TEXT NOT NULL,
  "region"          TEXT NOT NULL,
  "goal_category"   TEXT NOT NULL,
  "constraint_tags" JSONB NOT NULL,
  "contributed_at"  DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS "ai_pool_segment_idx" ON "ai_pool_contribution" ("vertical", "size_band", "region");
`;

let tablesEnsured = false;
async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tablesEnsured = true;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function requireDb(): void {
  if (!hasDatabase()) throw new Error("pool: no database configured");
}

/** Has this session already recorded a consent decision? Read-only check. */
export async function getConsent(sessionId: string): Promise<{ consented: boolean } | null> {
  requireDb();
  await ensureTables();
  const rows = await getPrisma().$queryRaw<Array<{ consented: boolean }>>`
    SELECT "consented" FROM "ai_contribution_consent" WHERE "session_id" = ${sessionId}`;
  return rows[0] ?? null;
}

export interface ClaimResult {
  /** true = THIS call won the race and must proceed with any consent=true
   *  work; false = another concurrent call already claimed this session — do
   *  NOT redo the pool work, just return the winner's decision. */
  claimed: boolean;
  consented: boolean;
}

/** Atomically claim this session's consent decision, using the table's own
 *  UNIQUE(session_id) constraint as the concurrency gate — a single INSERT,
 *  not a separate read-then-write. Exactly one of any number of concurrent
 *  calls for the same session gets claimed=true; every other one sees the
 *  already-recorded decision instead of racing to insert a second time. */
export async function claimConsentSlot(record: ConsentRecord, db: DbClient = getPrisma()): Promise<ClaimResult> {
  requireDb();
  await ensureTables();
  const won = await db.$queryRaw<Array<{ consented: boolean }>>`
    INSERT INTO "ai_contribution_consent" ("id", "session_id", "seat_id", "org_id", "consented", "terms_version")
    VALUES (${id("consent")}, ${record.sessionId}, ${record.seatId}, ${record.orgId}, ${record.consented}, ${record.termsVersion})
    ON CONFLICT ("session_id") DO NOTHING
    RETURNING "consented"`;
  if (won.length > 0) return { claimed: true, consented: won[0].consented };
  const existing = await getConsent(record.sessionId);
  return { claimed: false, consented: existing?.consented ?? false };
}

/** Insert one contribution. The parameter TYPE (PoolContribution) has no
 *  identity field — there is nothing to accidentally pass through. Accepts an
 *  optional transaction client so it can commit atomically alongside the
 *  consent claim (see app/api/pool/contribute/route.ts). */
export async function insertPoolContribution(c: PoolContribution, db: DbClient = getPrisma()): Promise<void> {
  requireDb();
  await ensureTables();
  await db.$executeRaw`
    INSERT INTO "ai_pool_contribution"
      ("id", "vertical", "size_band", "region", "goal_category", "constraint_tags", "contributed_at")
    VALUES (${id("pool")}, ${c.vertical}, ${c.sizeBand}, ${c.region}, ${c.goalCategory},
      ${JSON.stringify(c.constraintTags)}::jsonb, ${c.contributedAt}::date)`;
}

/** All contributions for a segment — used by aggregate.ts to compute shares.
 *  Returns rows shaped as PoolContribution (still no identity fields, since
 *  the table never had them to select). */
export async function getContributionsForSegment(segment: Segment): Promise<PoolContribution[]> {
  requireDb();
  await ensureTables();
  const rows = await getPrisma().$queryRaw<
    Array<{ vertical: string; size_band: string; region: string; goal_category: string; constraint_tags: unknown; contributed_at: Date }>
  >`
    SELECT "vertical", "size_band", "region", "goal_category", "constraint_tags", "contributed_at"
      FROM "ai_pool_contribution"
      WHERE "vertical" = ${segment.vertical} AND "size_band" = ${segment.sizeBand} AND "region" = ${segment.region}`;
  return rows.map((r) => ({
    vertical: r.vertical as PoolContribution["vertical"],
    sizeBand: r.size_band as PoolContribution["sizeBand"],
    region: r.region as PoolContribution["region"],
    goalCategory: r.goal_category as PoolContribution["goalCategory"],
    constraintTags: (r.constraint_tags as PoolContribution["constraintTags"] | null) ?? [],
    contributedAt: r.contributed_at.toISOString().slice(0, 10),
  }));
}
