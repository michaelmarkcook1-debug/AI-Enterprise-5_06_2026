// AIE-07 — Pool aggregation + the minimum-count (k-anonymity) floor.
// ─────────────────────────────────────────────────────────────────────────────
// "Never show an aggregated insight unless enough distinct contributors
// underpin it" — the architectural safety catch against reverse-engineering a
// single company's private data from an aggregate. computeAggregate is the
// pure, unit-tested enforcement: below the floor, it returns null, full stop —
// no partial aggregate, no "close enough."
//
// Batched, not live — and this is a SAFETY requirement, not just a cost one.
// The ticket says AIE-07 "runs on a schedule as shared work, not per user
// request." A naive live-per-request read defeats the floor's own purpose: an
// actor who is themselves 1-of-N (they know their own exact contribution) can
// repeatedly query a segment while it sits just under the floor, submit their
// own contribution at a moment of their choosing, and immediately re-query to
// observe the exact flip — then subtract their own known value from the
// revealed share to back out the other N-1 contributors' data. A TTL cache
// (getPoolAggregateCached) breaks that tight temporal correlation: the
// aggregate only refreshes periodically, so an attacker can no longer force
// an on-demand before/after comparison at a self-chosen instant, and by the
// next refresh other contributors may have joined too, diluting the signal.
// computeAggregate itself stays a pure, deterministic grouped-count — cheap
// enough to scale from 20 contributors to 2,000 regardless.

import { getPrisma, hasDatabase } from "../prisma";
import { getContributionsForSegment } from "./consent-store";
import { segmentId } from "../peer/segments";
import { GOAL_CATEGORIES, CONSTRAINT_TAGS, type GoalCategoryId, type ConstraintTagId, type PoolContribution, type PoolAggregate, type PoolProgress } from "./types";
import type { EvidenceItem } from "../interrogation/types";
import type { Segment } from "../peer/segments";

/** Minimum distinct contributors required before ANY aggregate is shown for a
 *  segment (owner decision, 2026-07-06 — explicitly NOT a default picked by
 *  engineering; the ticket calls this out as a policy call). Err high while
 *  the pool is small: showing fewer insights beats risking one company's
 *  data point standing out. */
export const POOL_MIN_COUNT_FLOOR = 5;

/** Non-navigable — this is OUR OWN aggregated pool, not a third-party
 *  citation. The UI must render this distinctly from a real external source
 *  link (see components/interrogate/InterrogationFlow.tsx's Sources list). */
export const POOL_SOURCE_URL = "pool:internal";
export const POOL_SOURCE_PUBLISHER = "AI Enterprise contributor pool";

/** Pure aggregation + floor enforcement. No DB, no LLM — fully unit-tested. */
export function computeAggregate(contributions: PoolContribution[], floor: number, segment: Segment): PoolAggregate | null {
  if (contributions.length < floor) return null; // the floor — never a partial aggregate
  const n = contributions.length;

  const goalCounts = new Map<GoalCategoryId, number>();
  for (const c of contributions) goalCounts.set(c.goalCategory, (goalCounts.get(c.goalCategory) ?? 0) + 1);
  const goalShares = [...goalCounts.entries()]
    .map(([goalCategory, count]) => ({ goalCategory, share: count / n }))
    .sort((a, b) => b.share - a.share);

  const constraintCounts = new Map<ConstraintTagId, number>();
  for (const c of contributions) for (const tag of c.constraintTags) constraintCounts.set(tag, (constraintCounts.get(tag) ?? 0) + 1);
  const constraintShares = [...constraintCounts.entries()]
    .map(([constraintTag, count]) => ({ constraintTag, share: count / n }))
    .sort((a, b) => b.share - a.share);

  return { contributors: n, segment, goalShares, constraintShares };
}

/** Turn a (floor-cleared) aggregate into cited evidence items for retrieval.ts.
 *  Only the single leading goal + leading constraint are surfaced — the same
 *  "don't over-claim" discipline as the rest of the evidence bundle. */
export function poolAggregateToEvidence(agg: PoolAggregate): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const topGoal = agg.goalShares[0];
  if (topGoal) {
    const label = GOAL_CATEGORIES.find((g) => g.id === topGoal.goalCategory)?.label ?? topGoal.goalCategory;
    items.push({
      layer: "peer_pool",
      scopeLabel: "Your exact segment — anonymized pool",
      headline: `${Math.round(topGoal.share * 100)}% of ${agg.contributors} anonymized contributors in your segment share the goal: ${label}.`,
      sourceUrl: POOL_SOURCE_URL,
      sourcePublisher: POOL_SOURCE_PUBLISHER,
    });
  }
  const topConstraint = agg.constraintShares[0];
  if (topConstraint) {
    const label = CONSTRAINT_TAGS.find((c) => c.id === topConstraint.constraintTag)?.label ?? topConstraint.constraintTag;
    items.push({
      layer: "peer_pool",
      scopeLabel: "Your exact segment — anonymized pool",
      headline: `${Math.round(topConstraint.share * 100)}% of ${agg.contributors} anonymized contributors named "${label}" as a constraint.`,
      sourceUrl: POOL_SOURCE_URL,
      sourcePublisher: POOL_SOURCE_PUBLISHER,
    });
  }
  return items;
}

const CACHE_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "ai_pool_aggregate_cache" (
  "segment_key" TEXT PRIMARY KEY,
  "floor"       INTEGER NOT NULL,
  "aggregate"   JSONB,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
let cacheTableEnsured = false;
async function ensureCacheTable(): Promise<void> {
  if (cacheTableEnsured) return;
  await getPrisma().$executeRawUnsafe(CACHE_CREATE_SQL);
  cacheTableEnsured = true;
}

/** How long a segment's aggregate is served from cache before recomputing —
 *  the actual anti-differencing protection (see the module header). Longer is
 *  safer; shorter feels fresher. Env-tunable, owner can adjust without a
 *  redeploy. Default 6h: long enough that an attacker's own contribution
 *  can't be isolated to a self-chosen instant, short enough that a genuinely
 *  growing pool still reads as current. */
export function cacheTtlHours(): number {
  const raw = process.env.POOL_AGGREGATE_CACHE_HOURS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 6;
}

/** Recompute live (the pure path) and persist the result to the TTL cache,
 *  keyed by segment. Exported for tests; NOT the function retrieval.ts calls
 *  directly — getPoolAggregate below is. */
export async function refreshPoolAggregateCache(segment: Segment, floor: number): Promise<PoolAggregate | null> {
  const contributions = await getContributionsForSegment(segment);
  const agg = computeAggregate(contributions, floor, segment);
  await ensureCacheTable();
  await getPrisma().$executeRaw`
    INSERT INTO "ai_pool_aggregate_cache" ("segment_key", "floor", "aggregate", "computed_at")
    VALUES (${segmentId(segment)}, ${floor}, ${agg ? JSON.stringify(agg) : null}::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT ("segment_key") DO UPDATE SET
      "floor" = EXCLUDED."floor", "aggregate" = EXCLUDED."aggregate", "computed_at" = EXCLUDED."computed_at"`;
  return agg;
}

/** Async wrapper: serve the segment's aggregate from the TTL cache, refreshing
 *  only when stale or missing. This is the anti-differencing protection, not
 *  just a cost optimization — see the module header. */
export async function getPoolAggregate(segment: Segment, floor: number = POOL_MIN_COUNT_FLOOR): Promise<PoolAggregate | null> {
  if (!hasDatabase()) return null;
  await ensureCacheTable();
  const rows = await getPrisma().$queryRaw<Array<{ floor: number; aggregate: unknown; computed_at: Date }>>`
    SELECT "floor", "aggregate", "computed_at" FROM "ai_pool_aggregate_cache" WHERE "segment_key" = ${segmentId(segment)}`;
  const cached = rows[0];
  const ttlMs = cacheTtlHours() * 60 * 60 * 1000;
  const fresh = cached && cached.floor === floor && Date.now() - cached.computed_at.getTime() < ttlMs;
  if (fresh) return (cached!.aggregate as PoolAggregate | null) ?? null;
  return refreshPoolAggregateCache(segment, floor);
}

/** Trackable progress toward the floor — AIE-08's "the team knows when the
 *  pool is ready" requirement. */
export async function getPoolProgress(segment: Segment, floor: number = POOL_MIN_COUNT_FLOOR): Promise<PoolProgress> {
  const contributions = await getContributionsForSegment(segment);
  return { contributors: contributions.length, floor, remaining: Math.max(0, floor - contributions.length) };
}
