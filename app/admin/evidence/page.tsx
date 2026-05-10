import EvidenceReview from "./EvidenceReview";
import { listProposals } from "@/lib/services/proposal-service";
import { hasDatabase } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EvidenceReviewPage() {
  const proposals = hasDatabase() ? await listProposals({ status: "pending" }) : [];
  return (
    <EvidenceReview
      initialProposals={proposals.map((p) => ({
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
      }))}
      hasDatabase={hasDatabase()}
    />
  );
}
