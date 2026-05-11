// Safe linkage runner — DB layer.
// ────────────────────────────────
// Loads pending proposals, runs the linkage suggester, and (in --live)
// writes the single safe product scope onto productScopeIds for rows
// where the suggester returns status="ok" and safeToApply=true.
//
// Operator safety:
//   - dry-run by default
//   - never writes to rows whose linkage status is NOT "ok"
//   - never writes to rows whose top suggestion has safeToApply=false
//   - never overwrites an existing non-empty productScopeIds
//   - every decision (dry-run AND live) appended to
//     data/linkage-apply-audit.jsonl

import { hasDatabase, getPrisma } from "../prisma";
import { PRODUCT_SCOPES } from "../investor-tools/product-scope";
import { canonicaliseVendorId } from "./product-linkage-runner";
import {
  planSafeLinkages,
  recordLinkageAuditBatch,
  entryToAudit,
  type SafeLinkagePlan,
} from "./safe-linkage-apply";
import type { LinkageProductScope } from "./product-linkage";

export interface SafeLinkageRunOptions {
  dryRun?: boolean;
  vendorId?: string;
  decidedBy?: string;
  limit?: number;
}

export interface SafeLinkageRunResult {
  dryRun: boolean;
  plan: SafeLinkagePlan;
  appliedCount: number;
  auditWritten: number;
  errors: { proposalId: string; error: string }[];
}

function buildScopeIndex(): Map<string, LinkageProductScope[]> {
  const map = new Map<string, LinkageProductScope[]>();
  for (const s of PRODUCT_SCOPES) {
    const arr = map.get(s.vendorId) ?? [];
    arr.push({
      id: s.id,
      vendorId: s.vendorId,
      productName: s.productName,
      productCategory: String(s.productCategory),
    });
    map.set(s.vendorId, arr);
  }
  return map;
}

export async function runSafeLinkageApply(
  opts: SafeLinkageRunOptions = {},
): Promise<SafeLinkageRunResult> {
  const dryRun = opts.dryRun ?? true;
  const decidedBy = opts.decidedBy ?? "system:safe-linkage-runner";

  if (!hasDatabase()) {
    return {
      dryRun,
      plan: { eligible: [], skipped: [], skippedByStatus: {} },
      appliedCount: 0,
      auditWritten: 0,
      errors: [],
    };
  }

  const prisma = getPrisma();
  const proposals = await prisma.evidenceProposal.findMany({
    where: {
      status: "pending",
      vendorId: opts.vendorId,
      // Belt-and-braces: never overwrite an existing linkage.
      productScopeIds: { equals: [] },
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 5000,
  });

  const scopeIndex = buildScopeIndex();
  const scopesForVendor = (vendorId: string): LinkageProductScope[] =>
    scopeIndex.get(canonicaliseVendorId(vendorId)) ?? [];

  const plan = planSafeLinkages(
    proposals.map((p) => ({
      id: p.id,
      vendorId: p.vendorId,
      domain: p.domain,
      subfactor: p.subfactor,
      excerpt: p.excerpt,
      sourceUrl: p.sourceUrl,
    })),
    scopesForVendor,
  );

  const errors: { proposalId: string; error: string }[] = [];
  let appliedCount = 0;

  if (!dryRun) {
    for (const entry of plan.eligible) {
      try {
        // Re-assert the guard in the WHERE clause to defend against
        // concurrent writes between SELECT and UPDATE.
        const result = await prisma.evidenceProposal.updateMany({
          where: {
            id: entry.proposalId,
            status: "pending",
            productScopeIds: { equals: [] },
          },
          data: {
            productScopeIds: [entry.productScopeId],
          },
        });
        if (result.count > 0) appliedCount += 1;
      } catch (err) {
        errors.push({ proposalId: entry.proposalId, error: (err as Error).message });
      }
    }
  }

  const auditEntries = plan.eligible.map((entry) =>
    entryToAudit({ entry, decidedBy, dryRun }),
  );
  await recordLinkageAuditBatch(auditEntries);

  return {
    dryRun,
    plan,
    appliedCount,
    auditWritten: auditEntries.length,
    errors,
  };
}
