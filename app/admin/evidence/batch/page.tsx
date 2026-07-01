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

import { adminPageGuard } from "@/components/admin/AdminPageGuard";

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
    lane?: string;
  }>;
}

export default async function BatchReviewPage({ searchParams }: PageProps) {
  const locked = await adminPageGuard();
  if (locked) return locked;

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
    lane:
      params.lane === "all" || params.lane === "auto_approve" ||
      params.lane === "recommend_approve" || params.lane === "recommend_reject" ||
      params.lane === "human_review_required"
        ? params.lane
        : "recommend_approve",
  };
  const offset = Math.max(0, Number(params.offset ?? "0") || 0);

  if (!hasDatabase()) {
    return (
      <BatchReview
        result={{
          total: 0,
          totalAfterFilter: 0,
          page: [],
          facets: { byVendor: [], byConfidenceBand: [], byGrade: [], byLinkageStatus: [], byLane: [], deferredCount: 0 },
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

  // Enrich every pending proposal → BatchReviewRow. The lane filter
  // narrows the visible set inside buildBatchReviewResult so the facet
  // counts (byLane) still reflect the full pending population.
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
    // Skip auto_approve here — those are handled by the safe-actions cron,
    // not by manual review. Everything else (recommend_approve,
    // recommend_reject, human_review_required) is selectable via the
    // lane filter.
    if (decision.lane === "auto_approve") continue;

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

    const vendorScopes = scopesByVendor.get(canonicaliseVendorId(p.vendorId)) ?? [];
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
      // Picker payload — vendor catalogue + suggestions + current
      // vendor-wide flag. Lets the operator attach products inline.
      availableProducts: vendorScopes.map((s) => ({
        id: s.id,
        name: s.productName,
        category: s.productCategory,
      })),
      linkageSuggestions: linkage.suggestions.slice(0, 3).map((s) => ({
        productScopeId: s.productScopeId,
        productName: s.productName,
        confidence: s.confidence,
        reason: s.reason,
        safeToApply: s.safeToApply,
      })),
      isVendorWide: p.isVendorWide ?? false,
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
      adminToken={process.env.ADMIN_API_TOKEN ?? ""}
    />
  );
}
