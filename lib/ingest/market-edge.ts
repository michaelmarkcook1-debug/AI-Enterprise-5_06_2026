// Market-edge mentions — what the market is doing OUTSIDE our roster.
// ───────────────────────────────────────────────────────────────────────────
// WHY: validateFinding/validateProposal reject any vendorId that isn't in the
// live roster ("vendors are never invented"). That guard is right — but the
// rejected item was then discarded entirely, so a new investor, neocloud or
// provider showing up in the market left no trace at all. The universe could
// only grow by someone manually noticing and editing the roster.
//
// This keeps the guard and removes the blind spot: rejected-for-unknown-entity
// items are recorded here, with their citation, as a COVERAGE SIGNAL. Repeat
// mentions increment a counter, so "who keeps showing up that we don't track"
// becomes answerable.
//
// WHAT THIS IS NOT: not a vendor, not a score, not evidence. Nothing here joins
// to a ranking, a pillar, or an assessment. A row is an unverified CLAIM that
// some entity was named in a cited article — promotion into the real roster
// stays a deliberate human act. The UI must label these as untracked mentions,
// never as market entities we cover.
//
// Self-migrating raw-SQL table (no Prisma migration) — same pattern as
// lib/news-bridge/corrections.ts.

import { getPrisma, hasDatabase } from "../prisma";

export interface MarketEdgeMention {
  /** Normalised key (lowercased id/name as claimed by the source). */
  entityKey: string;
  /** The entity as the source named it. */
  entityName: string;
  mentionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastTitle: string | null;
  lastSourceName: string | null;
  lastSourceUrl: string | null;
  status: "unreviewed" | "dismissed" | "promoted";
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "market_edge_mention" (
  "entityKey" TEXT PRIMARY KEY,
  "entityName" TEXT NOT NULL,
  "mentionCount" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastTitle" TEXT,
  "lastSourceName" TEXT,
  "lastSourceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'unreviewed'
);
CREATE INDEX IF NOT EXISTS "market_edge_rank_idx" ON "market_edge_mention" ("status", "mentionCount" DESC);
`;

let tablesEnsured = false;
async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tablesEnsured = true;
}

const MAX_NAME = 120;
const MAX_TITLE = 300;
const MAX_URL = 600;

/** Normalise the claimed id/name into a stable key. */
export function marketEdgeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/^vendor_/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, MAX_NAME);
}

export interface MarketEdgeInput {
  /** The vendorId/name the source claimed but that we don't track. */
  entity: string;
  title?: string;
  sourceName?: string;
  /** Must be a real https URL — an uncited mention is not worth recording. */
  sourceUrl?: string;
}

/**
 * Record one sighting of an untracked entity. Idempotent per entity: repeat
 * mentions bump the counter and refresh the latest citation.
 *
 * Returns false (never throws) when there's no DB or the input is unusable —
 * capture is a side-benefit of ingest and must never fail the ingest itself.
 */
export async function recordMarketEdgeMention(input: MarketEdgeInput): Promise<boolean> {
  if (!hasDatabase()) return false;
  const key = marketEdgeKey(input.entity ?? "");
  if (!key) return false;
  // Only record CITED sightings — an uncited claim about an untracked entity is
  // exactly the kind of unverifiable input this codebase refuses to store.
  const url = (input.sourceUrl ?? "").trim();
  if (!url.startsWith("https://")) return false;

  try {
    await ensureTables();
    await getPrisma().$executeRawUnsafe(
      `INSERT INTO "market_edge_mention"
         ("entityKey","entityName","lastTitle","lastSourceName","lastSourceUrl")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("entityKey") DO UPDATE SET
         "mentionCount" = "market_edge_mention"."mentionCount" + 1,
         "lastSeenAt"   = now(),
         "lastTitle"    = EXCLUDED."lastTitle",
         "lastSourceName" = EXCLUDED."lastSourceName",
         "lastSourceUrl"  = EXCLUDED."lastSourceUrl"`,
      key,
      (input.entity ?? "").trim().slice(0, MAX_NAME),
      (input.title ?? "").trim().slice(0, MAX_TITLE) || null,
      (input.sourceName ?? "").trim().slice(0, MAX_NAME) || null,
      url.slice(0, MAX_URL),
    );
    return true;
  } catch (err) {
    console.error(`[market-edge] capture failed for "${key}": ${(err as Error).message}`);
    return false;
  }
}

/** Most-mentioned untracked entities — the coverage-gap queue. */
export async function listMarketEdge(limit = 50): Promise<MarketEdgeMention[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTables();
    const rows = await getPrisma().$queryRawUnsafe<
      {
        entityKey: string;
        entityName: string;
        mentionCount: number;
        firstSeenAt: Date;
        lastSeenAt: Date;
        lastTitle: string | null;
        lastSourceName: string | null;
        lastSourceUrl: string | null;
        status: string;
      }[]
    >(
      `SELECT * FROM "market_edge_mention"
       WHERE "status" = 'unreviewed'
       ORDER BY "mentionCount" DESC, "lastSeenAt" DESC
       LIMIT $1`,
      Math.min(200, Math.max(1, limit)),
    );
    return rows.map((r) => ({
      entityKey: r.entityKey,
      entityName: r.entityName,
      mentionCount: Number(r.mentionCount),
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      lastTitle: r.lastTitle,
      lastSourceName: r.lastSourceName,
      lastSourceUrl: r.lastSourceUrl,
      status: (r.status as MarketEdgeMention["status"]) ?? "unreviewed",
    }));
  } catch (err) {
    console.error(`[market-edge] list failed: ${(err as Error).message}`);
    return [];
  }
}
