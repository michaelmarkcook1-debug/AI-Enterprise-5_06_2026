import EvidenceReview from "./EvidenceReview";
import { listProposals } from "@/lib/services/proposal-service";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { triageProposal } from "@/lib/services/triage";
import { isClassifierFallback } from "@/lib/services/triage-runner";
import { suggestLinkage } from "@/lib/services/product-linkage";
import { canonicaliseVendorId } from "@/lib/services/product-linkage-runner";
import { PRODUCT_SCOPES } from "@/lib/investor-tools/product-scope";
import { getQueueHealthSummary, EMPTY_QUEUE_HEALTH, STALE_PENDING_THRESHOLD_DAYS } from "@/lib/services/queue-health";

export const dynamic = "force-dynamic";

export default async function EvidenceReviewPage() {
  const proposals = hasDatabase() ? await listProposals({ status: "pending" }) : [];
  const queueHealth = hasDatabase()
    ? await getQueueHealthSummary(getPrisma())
    : EMPTY_QUEUE_HEALTH;

  // Build vendorId → product-scopes index once per request.
  const scopesByVendor = new Map<string, { id: string; vendorId: string; productName: string; productCategory: string }[]>();
  for (const s of PRODUCT_SCOPES) {
    const arr = scopesByVendor.get(s.vendorId) ?? [];
    arr.push({ id: s.id, vendorId: s.vendorId, productName: s.productName, productCategory: String(s.productCategory) });
    scopesByVendor.set(s.vendorId, arr);
  }

  const enriched = proposals.map((p) => {
    const fallback = isClassifierFallback({
      classifierConfidence: p.classifierConfidence,
      classifierRationale: p.classifierRationale,
      confidenceIsFallback: p.confidenceIsFallback,
      classificationFailed: p.classificationFailed,
    });
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
      confidenceIsFallback: fallback,
    });

    // Linkage suggestion (read-only — operator sees the option but
    // confirmation still goes through the existing approve endpoint).
    const canonVendor = canonicaliseVendorId(p.vendorId);
    const vendorScopes = scopesByVendor.get(canonVendor) ?? [];
    const linkage = suggestLinkage(
      {
        id: p.id,
        vendorId: p.vendorId,
        domain: p.domain,
        subfactor: p.subfactor,
        excerpt: p.excerpt,
        sourceUrl: p.sourceUrl,
      },
      vendorScopes,
    );

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
      classificationFailed: p.classificationFailed,
      classificationFailureCode: p.classificationFailureCode ?? undefined,
      confidenceIsFallback: fallback,
      triageLane: decision.lane,
      triageReasons: decision.reasons,
      triageUnsafeCategory: decision.unsafeCategory,
      linkageStatus: linkage.status,
      linkageSuggestions: linkage.suggestions.slice(0, 3).map((s) => ({
        productScopeId: s.productScopeId,
        productName: s.productName,
        confidence: s.confidence,
        reason: s.reason,
        safeToApply: s.safeToApply,
      })),
    };
  });
  return (
    <EvidenceReview
      initialProposals={enriched}
      hasDatabase={hasDatabase()}
      queueHealth={queueHealth}
      staleThresholdDays={STALE_PENDING_THRESHOLD_DAYS}
    />
  );
}
