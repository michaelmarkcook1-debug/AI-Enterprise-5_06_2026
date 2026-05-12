import { hasDatabase, getPrisma } from "@/lib/prisma";
import { triageProposal } from "@/lib/services/triage";
import { isClassifierFallback } from "@/lib/services/triage-runner";
import { suggestLinkage } from "@/lib/services/product-linkage";
import { canonicaliseVendorId } from "@/lib/services/product-linkage-runner";
import { PRODUCT_SCOPES } from "@/lib/investor-tools/product-scope";
import {
  buildBatchReviewResult,
  isDeferred,
  type BatchReviewRow,
  type BatchReviewFilters,
  DEFAULT_BATCH_LIMIT,
} from "@/lib/services/batch-review";
import BatchReview from "./BatchReview";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    vendor?: string;
    confidence?: string;
    grade?: string;
    linkage?: string;
    source?: string;
    offset?: string;
    includeDeferred?: string;
  }>;
}

export default async function BatchReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters: BatchReviewFilters = {
    vendorId: params.vendor || undefined,
    confidenceBand:
      params.confidence === "high" || params.confidence === "medium" || params.confidence === "low"
        ? params.confidence
        : undefined,
    grade:
      params.grade === "E0" || params.grade === "E1" || params.grade === "E2" ||
      params.grade === "E3" || params.grade === "E4" || params.grade === "E5"
        ? params.grade
        : undefined,
    linkageStatus:
      params.linkage === "ok" || params.linkage === "ok_uncertain" ||
      params.linkage === "multiple_competing" || params.linkage === "no_match" ||
      params.linkage === "no_vendor_products" || params.linkage === "uncertain_top_match" ||
      params.linkage === "linked"
        ? params.linkage
        : undefined,
    sourceUrlContains: params.source || undefined,
    includeDeferred: params.includeDeferred === "1",
  };
  const offset = Math.max(0, Number(params.offset ?? "0") || 0);

  if (!hasDatabase()) {
    return (
      <BatchReview
        result={{
          total: 0,
          totalAfterFilter: 0,
          page: [],
          facets: { byVendor: [], byConfidenceBand: [], byGrade: [], byLinkageStatus: [], deferredCount: 0 },
        }}
        filters={filters}
        paging={{ offset, limit: DEFAULT_BATCH_LIMIT }}
        hasDatabase={false}
      />
    );
  }

  const prisma = getPrisma();
  const proposals = await prisma.evidenceProposal.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  // Build the vendor → product-scopes index once for linkage suggestions.
  const scopesByVendor = new Map<string, { id: string; vendorId: string; productName: string; productCategory: string }[]>();
  for (const s of PRODUCT_SCOPES) {
    const arr = scopesByVendor.get(s.vendorId) ?? [];
    arr.push({ id: s.id, vendorId: s.vendorId, productName: s.productName, productCategory: String(s.productCategory) });
    scopesByVendor.set(s.vendorId, arr);
  }

  // Enrich each proposal → BatchReviewRow, scoped to recommend_approve only
  // (the batch-review workflow is for that cohort).
  const rows: BatchReviewRow[] = [];
  for (const p of proposals) {
    const fallback = isClassifierFallback({
      classifierConfidence: p.classifierConfidence,
      classifierRationale: p.classifierRationale,
      confidenceIsFallback: p.confidenceIsFallback,
      classificationFailed: p.classificationFailed,
    });
    const decision = triageProposal({
      id: p.id,
      vendorId: p.vendorId,
      productId: undefined,
      productMention: undefined,
      productScopeIds: p.productScopeIds ?? [],
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
    if (decision.lane !== "recommend_approve") continue;

    const linkage = suggestLinkage(
      {
        id: p.id,
        vendorId: p.vendorId,
        domain: p.domain,
        subfactor: p.subfactor,
        excerpt: p.excerpt,
        sourceUrl: p.sourceUrl,
      },
      scopesByVendor.get(canonicaliseVendorId(p.vendorId)) ?? [],
    );
    const hasLinkage = (p.productScopeIds?.length ?? 0) > 0;

    rows.push({
      proposalId: p.id,
      vendorId: p.vendorId,
      domain: p.domain,
      subfactor: p.subfactor,
      excerpt: p.excerpt,
      sourceUrl: p.sourceUrl,
      proposedGrade: p.proposedGrade,
      classifierConfidence: p.classifierConfidence,
      dataStatus: isDeferred(p.reviewNotes) ? "deferred" : "pending",
      triageLane: decision.lane,
      triageReasons: decision.reasons,
      linkageStatus: hasLinkage ? "linked" : linkage.status,
      linkedProductIds: p.productScopeIds ?? [],
      isDeferred: isDeferred(p.reviewNotes),
    });
  }

  const result = buildBatchReviewResult(rows, filters, { offset, limit: DEFAULT_BATCH_LIMIT });

  return (
    <BatchReview
      result={result}
      filters={filters}
      paging={{ offset, limit: DEFAULT_BATCH_LIMIT }}
      hasDatabase
    />
  );
}
