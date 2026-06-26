// Data provenance — answers "is this dashboard built on real ingested
// evidence, or seed data?" The dashboard badge flips based on this.
//
// Real data is defined as: Postgres reachable AND at least one
// `EvidenceRecord` row with reviewStatus="analyst_verified" exists.
// Anything less is "seed".

import { cache } from "react";
import { getPrisma, hasDatabase } from "../prisma";

export type Provenance = "seed" | "live";

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
    const [evidenceCount, approvedProposalCount, lastJob] = await Promise.all([
      client.evidenceRecord.count({ where: { reviewStatus: "analyst_verified" } }),
      client.evidenceProposal.count({ where: { status: "approved" } }),
      client.ingestionJob.findFirst({
        where: { status: { in: ["completed", "ready_for_review"] } },
        orderBy: { createdAt: "desc" },
        select: { finishedAt: true, createdAt: true },
      }),
    ]);

    if (evidenceCount === 0 && approvedProposalCount === 0) {
      return {
        source: "seed",
        evidenceCount,
        approvedProposalCount,
        reason: "DB connected but no analyst-verified evidence yet. Run admin/ingestion + approve in admin/evidence to flip to live.",
      };
    }

    return {
      source: "live",
      evidenceCount,
      approvedProposalCount,
      lastIngestedAt: lastJob?.finishedAt?.toISOString() ?? lastJob?.createdAt.toISOString(),
      reason: `${evidenceCount} verified evidence rows · ${approvedProposalCount} approved proposals.`,
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
