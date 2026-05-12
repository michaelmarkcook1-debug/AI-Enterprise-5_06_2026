// Safe-actions cron.
// ──────────────────
// Runs the safe-by-design write paths against the current pending
// queue. NEVER auto-approves rows the triage rule deems risky.
//
// Order:
//   1. apply-vendor-wide-evidence — fills productScopeIds on rows
//      whose source URL is trust/security/pricing/etc. and the
//      excerpt doesn't name a specific product. Bulk-links to every
//      product in the vendor's catalogue.
//      (Same as scripts/apply-vendor-wide-evidence.ts --live)
//   2. safe-linkage-apply — for rows where the linkage suggester
//      returns status="ok" with confidence ≥ 0.95 AND no competing
//      match. Writes that single product to productScopeIds.
//   3. triage --live — auto-approves rows that pass the strict
//      gate (E2+ · ≥0.85 confidence · vendor + product match ·
//      fresh · no fallback · no unsafe category · no conflict).
//
// Every step is idempotent and dry-runs first if needed. Failure in
// one step does not block the next. Returns per-step counts so the
// Vercel logs explain what happened.

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { runTriage } from "@/lib/services/triage-runner";
import { runSafeLinkageApply } from "@/lib/services/safe-linkage-runner";
import { PRODUCT_SCOPES } from "@/lib/investor-tools/product-scope";
import { canonicaliseVendorId } from "@/lib/services/product-linkage-runner";
import { suggestLinkage } from "@/lib/services/product-linkage";
import { isVendorWideUrl } from "@/lib/services/vendor-wide-detector";
import { projectEvidenceToIntelligence } from "@/lib/services/intelligence-projector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function applyVendorWideEvidence(): Promise<{
  candidates: number;
  applied: number;
}> {
  const prisma = getPrisma();
  const proposals = await prisma.evidenceProposal.findMany({
    where: { status: "pending", productScopeIds: { equals: [] } },
    orderBy: { createdAt: "desc" },
  });

  let applied = 0;
  let candidates = 0;
  for (const p of proposals) {
    const urlCheck = isVendorWideUrl(p.sourceUrl);
    if (!urlCheck.match) continue;
    const canon = canonicaliseVendorId(p.vendorId);
    const vendorScopes = PRODUCT_SCOPES.filter((s) => s.vendorId === canon).map((s) => ({
      id: s.id,
      vendorId: s.vendorId,
      productName: s.productName,
      productCategory: String(s.productCategory),
    }));
    if (vendorScopes.length === 0) continue;
    // Skip rows where the linkage suggester DID find a specific
    // product — those should not be vendor-wide.
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
    if (linkage.status !== "no_match" && linkage.status !== "no_vendor_products") continue;
    candidates += 1;

    try {
      await prisma.evidenceProposal.update({
        where: { id: p.id },
        data: {
          productScopeIds: vendorScopes.map((s) => s.id),
          isVendorWide: true,
        },
      });
      applied += 1;
    } catch (err) {
      console.error(`[cron/safe-actions] vendor-wide fail ${p.id}:`, (err as Error).message);
    }
  }
  return { candidates, applied };
}

async function handle(request: Request) {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  if (!hasDatabase()) {
    return Response.json({ skipped: "no_database" }, { status: 200 });
  }

  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  // Step 1: vendor-wide bulk linkage
  let vendorWide = { candidates: 0, applied: 0 };
  try {
    vendorWide = await applyVendorWideEvidence();
  } catch (err) {
    errors.push(`vendor_wide: ${(err as Error).message}`);
  }

  // Step 2: safe single-product linkage (only status=ok + conf≥0.95)
  let safeLinkage = { eligible: 0, applied: 0 };
  try {
    const r = await runSafeLinkageApply({
      dryRun: false,
      decidedBy: "cron:safe-actions",
    });
    safeLinkage = { eligible: r.plan.eligible.length, applied: r.appliedCount };
  } catch (err) {
    errors.push(`safe_linkage: ${(err as Error).message}`);
  }

  // Step 3: triage auto-approve (only the strict ok lane)
  let triage = { scanned: 0, autoApprove: 0, applied: 0 };
  try {
    const r = await runTriage({
      dryRun: false,
      decidedBy: "cron:safe-actions",
    });
    triage = {
      scanned: r.total,
      autoApprove: r.laneCounts.auto_approve,
      applied: r.appliedCount,
    };
  } catch (err) {
    errors.push(`triage: ${(err as Error).message}`);
  }

  // Step 4: project verified EvidenceRecord rows into the
  // IntelligenceVendor read-tables (VendorCapability, IntelligenceNewsItem)
  // so /capabilities and /news reflect live data instead of seed.
  let projection = { scanned: 0, capabilitiesUpserted: 0, newsUpserted: 0, vendorsSkipped: 0 };
  try {
    const r = await projectEvidenceToIntelligence(getPrisma());
    projection = {
      scanned: r.scannedEvidenceRows,
      capabilitiesUpserted: r.capabilitiesUpserted,
      newsUpserted: r.newsUpserted,
      vendorsSkipped: r.vendorsSkipped.length,
    };
  } catch (err) {
    errors.push(`projection: ${(err as Error).message}`);
  }

  return Response.json({
    ok: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    vendorWide,
    safeLinkage,
    triage,
    projection,
    errors,
  });
}

export const GET = handle;
export const POST = handle;
