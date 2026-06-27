// Admin-gated id-resolver for bulk operations on the batch-review queue.
// Returns just the proposal ids matching the filter set, so the client
// can drive a bulk approve/reject/defer without re-rendering the full
// batch page. Reuses the same filter logic as the batch page.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { triageProposal } from "@/lib/services/triage";
import { isClassifierFallback } from "@/lib/services/triage-runner";
import { suggestLinkage } from "@/lib/services/product-linkage";
import { canonicaliseVendorId } from "@/lib/services/product-linkage-runner";
import { PRODUCT_SCOPES } from "@/lib/investor-tools/product-scope";
import {
  isDeferred,
  matchesFilters,
  type BatchReviewRow,
  type BatchReviewFilters,
} from "@/lib/services/batch-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// E0–E5 ordinal ranks for the "cited + E3+" bulk-approval check.
const GRADE_RANK = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 } as const;

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) return Response.json({ ids: [] });

  const url = new URL(request.url);
  // Which triage lane the operator is bulk-acting on. Defaults to the safe
  // recommend_approve cohort; other lanes are honoured so "Auto-process all N"
  // actually targets the rows the UI shows (the previous hard-coded
  // recommend_approve filter made the button a silent no-op on other lanes).
  const requestedLane = url.searchParams.get("lane");
  const lane =
    requestedLane === "human_review_required" || requestedLane === "recommend_reject"
      ? requestedLane
      : "recommend_approve";
  const filters: BatchReviewFilters = {
    vendorId: url.searchParams.get("vendor") || undefined,
    confidenceBand:
      url.searchParams.get("confidence") === "high" || url.searchParams.get("confidence") === "medium" || url.searchParams.get("confidence") === "low"
        ? (url.searchParams.get("confidence") as "high" | "medium" | "low")
        : undefined,
    grade: matchGrade(url.searchParams.get("grade")),
    linkageStatus: matchLinkage(url.searchParams.get("linkage")),
    sourceUrlContains: url.searchParams.get("source") || undefined,
    includeDeferred: url.searchParams.get("includeDeferred") === "1",
  };

  try {
    const prisma = getPrisma();
    const proposals = await prisma.evidenceProposal.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    // Same scope-index pattern as the batch page.
    const scopesByVendor = new Map<string, { id: string; vendorId: string; productName: string; productCategory: string }[]>();
    for (const s of PRODUCT_SCOPES) {
      const arr = scopesByVendor.get(s.vendorId) ?? [];
      arr.push({ id: s.id, vendorId: s.vendorId, productName: s.productName, productCategory: String(s.productCategory) });
      scopesByVendor.set(s.vendorId, arr);
    }

    const matchedIds: string[] = [];
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
      if (decision.lane !== lane) continue;

      // Factual-integrity floor for operator bulk-approval of the human_review
      // lane. ALWAYS blocked from bulk (must be resolved per-row): missing source,
      // E0 evidence, a flagged source conflict, or a DISPUTED claim — these are
      // genuinely unreliable. The other "unsafe categories" (valuation, market
      // share, adoption estimate, IPO timing) are speculative-by-default and
      // normally need a human glance — but a CITED reported fact (has a source
      // URL AND grade ≥ E3) is allowed through bulk, because the operator
      // explicitly approving the review lane IS the human in the loop. Per the
      // approval-policy decision: "allow bulk-approve if cited + E3+".
      if (lane !== "recommend_approve") {
        const gradeRank = GRADE_RANK[p.proposedGrade as keyof typeof GRADE_RANK] ?? 0;
        const cited = !!p.sourceUrl && gradeRank >= GRADE_RANK.E3;
        const alwaysBlocked = !p.sourceUrl
          || p.proposedGrade === "E0"
          || decision.reasons.some((r) => /source conflict|unsafe category: disputed/i.test(r));
        const speculativeUncited = decision.reasons.some((r) => /unsafe category:/i.test(r)) && !cited;
        if (alwaysBlocked || speculativeUncited) continue;
      }

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

      const row: BatchReviewRow = {
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
      };
      if (matchesFilters(row, filters)) matchedIds.push(p.id);
    }

    return Response.json({ ids: matchedIds, count: matchedIds.length });
  } catch (err) {
    console.error("[api/admin/evidence/batch-action/ids] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

function matchGrade(v: string | null): BatchReviewFilters["grade"] {
  if (v === "E0" || v === "E1" || v === "E2" || v === "E3" || v === "E4" || v === "E5") return v;
  return undefined;
}

function matchLinkage(v: string | null): BatchReviewFilters["linkageStatus"] {
  if (
    v === "ok" || v === "ok_uncertain" || v === "multiple_competing" ||
    v === "no_match" || v === "no_vendor_products" || v === "uncertain_top_match" ||
    v === "linked"
  ) return v;
  return undefined;
}
