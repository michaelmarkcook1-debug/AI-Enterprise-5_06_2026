import EvidenceReview from "./EvidenceReview";
import { listProposals } from "@/lib/services/proposal-service";
import { hasDatabase } from "@/lib/prisma";
import { triageProposal } from "@/lib/services/triage";

export const dynamic = "force-dynamic";

export default async function EvidenceReviewPage() {
  const proposals = hasDatabase() ? await listProposals({ status: "pending" }) : [];
  const enriched = proposals.map((p) => {
    const decision = triageProposal({
      id: p.id,
      vendorId: p.vendorId,
      domain: p.domain,
      subfactor: p.subfactor,
      excerpt: p.excerpt,
      proposedGrade: p.proposedGrade,
      proposedRawScore: p.proposedRawScore,
      sourceUrl: p.sourceUrl,
      sourceIds: p.sourceUrl ? [p.sourceUrl] : [],
      capturedAt: p.capturedAt,
      classifierConfidence: p.classifierConfidence,
    });
    return {
      id: p.id,
      vendorId: p.vendorId,
      domain: p.domain,
      subfactor: p.subfactor,
      excerpt: p.excerpt,
      proposedGrade: p.proposedGrade,
      proposedRawScore: p.proposedRawScore,
      sourceUrl: p.sourceUrl ?? undefined,
      capturedAt: p.capturedAt.toISOString(),
      classifierConfidence: p.classifierConfidence,
      classifierRationale: p.classifierRationale ?? undefined,
      triageLane: decision.lane,
      triageReasons: decision.reasons,
      triageUnsafeCategory: decision.unsafeCategory,
    };
  });
  return <EvidenceReview initialProposals={enriched} hasDatabase={hasDatabase()} />;
}
