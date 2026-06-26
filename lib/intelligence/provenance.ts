// Data provenance — answers "is this dashboard built on real ingested
// evidence, or seed data?" Every quantitative surface gates on this.
//
// "live" requires BOTH:
//   (a) Postgres reachable AND ≥1 analyst-verified EvidenceRecord (or approved
//       EvidenceProposal), AND
//   (b) ≥1 market-share estimate that is NOT seed-signed.
//
// (b) is load-bearing: the live DB was at some point loaded with the typed seed,
// INCLUDING "analyst_verified" evidence rows — so (a) alone is a FALSE POSITIVE
// on a seed-populated database. Every seed market-share row carries a fixed
// source string (see lib/intelligence/seed.ts), so its absence-of-a-real-row is
// a reliable "this DB is still all seed" signal. Until real ingestion writes a
// real-sourced estimate, the portal stays "seed" → surfaces show honest
// "insufficient evidence" rather than seed dressed as live.

import { cache } from "react";
import { getPrisma, hasDatabase } from "../prisma";

export type Provenance = "seed" | "live";

/** Fixed source string stamped on every seeded market-share row
 *  (lib/intelligence/seed.ts). Real, evidence-derived estimates never use it,
 *  so it is a reliable seed marker for both provenance and reader filtering. */
export const SEED_MARKET_SHARE_SOURCE_PREFIX = "AI Enterprise analyst triangulation";

/** True when an estimate's source is the seed signature (i.e. fabricated/seed). */
export function isSeedSignedSource(source: string | null | undefined): boolean {
  return typeof source === "string" && source.startsWith(SEED_MARKET_SHARE_SOURCE_PREFIX);
}

export interface ProvenanceSummary {
  source: Provenance;
  evidenceCount: number;
  approvedProposalCount: number;
  lastIngestedAt?: string;
  reason: string;
}

/** Request-deduped provenance read — safe to call from several surfaces in one
 *  render without re-querying. Use this in pages/components; the raw
 *  `getDataProvenance` stays exported for callers that need a fresh read. */
export const getCachedProvenance = cache(getDataProvenance);

/** True only when the portal is backed by analyst-verified evidence. Quantitative
 *  surfaces (rankings, market-share, momentum, scores) render their numbers ONLY
 *  when this is true — otherwise they show an honest "insufficient evidence"
 *  state rather than seed/estimate figures dressed as live. Never throws. */
export async function isLiveData(): Promise<boolean> {
  try {
    return (await getCachedProvenance()).source === "live";
  } catch {
    return false;
  }
}

export async function getDataProvenance(): Promise<ProvenanceSummary> {
  if (!hasDatabase()) {
    return {
      source: "seed",
      evidenceCount: 0,
      approvedProposalCount: 0,
      reason: "DATABASE_URL is not set; portal is reading from typed seed modules.",
    };
  }

  try {
    const client = getPrisma();
    const [evidenceCount, approvedProposalCount, realEstimateCount, lastJob] = await Promise.all([
      client.evidenceRecord.count({ where: { reviewStatus: "analyst_verified" } }),
      client.evidenceProposal.count({ where: { status: "approved" } }),
      // Real = NOT carrying the seed source signature. If zero, the DB's
      // market-share is still entirely seed → portal is NOT live (even if seed
      // "verified evidence" rows exist), so we never show seed dressed as live.
      client.marketShareEstimate.count({
        where: { NOT: { source: { startsWith: SEED_MARKET_SHARE_SOURCE_PREFIX } } },
      }),
      client.ingestionJob.findFirst({
        where: { status: { in: ["completed", "ready_for_review"] } },
        orderBy: { createdAt: "desc" },
        select: { finishedAt: true, createdAt: true },
      }),
    ]);

    const hasVerifiedEvidence = evidenceCount > 0 || approvedProposalCount > 0;

    if (!hasVerifiedEvidence || realEstimateCount === 0) {
      return {
        source: "seed",
        evidenceCount,
        approvedProposalCount,
        reason: realEstimateCount === 0
          ? "DB market-share is still entirely seed-loaded (no real-sourced estimates). Run real ingestion or purge the seed rows to go live."
          : "DB connected but no analyst-verified evidence yet. Run admin/ingestion + approve in admin/evidence to flip to live.",
      };
    }

    return {
      source: "live",
      evidenceCount,
      approvedProposalCount,
      lastIngestedAt: lastJob?.finishedAt?.toISOString() ?? lastJob?.createdAt.toISOString(),
      reason: `${evidenceCount} verified evidence rows · ${approvedProposalCount} approved proposals · ${realEstimateCount} real-sourced estimates.`,
    };
  } catch (error) {
    return {
      source: "seed",
      evidenceCount: 0,
      approvedProposalCount: 0,
      reason: `DB query failed (${error instanceof Error ? error.message : "unknown"}); falling back to seed.`,
    };
  }
}
