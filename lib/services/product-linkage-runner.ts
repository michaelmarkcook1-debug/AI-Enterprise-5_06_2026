// Product Linkage Assist — DB layer + report generation.
// ──────────────────────────────────────────────────────
// Wraps the pure suggester with:
//   - vendor-scoped pulls of pending EvidenceProposals from the DB
//   - re-running the triage rule so we only consider rows that landed in
//     `recommend_approve` because of missing product linkage (everything
//     else is out of scope for this assist)
//   - aggregation reports (by vendor / by domain+subfactor / by sourceUrl
//     / by failure-reason status)
//   - batch-review chunking for the CLI
//
// Operator safety: this module NEVER writes to the DB. The auto-apply
// gate exists in the type system but no current call path turns it on
// — the API and CLI surfaces are read-only.

import { hasDatabase, getPrisma } from "../prisma";
import { triageProposal, type TriageInput, type TriageDecision } from "./triage";
import { isClassifierFallback } from "./triage-runner";
import {
  suggestLinkage,
  type LinkageProductScope,
  type ProposalLinkageResult,
} from "./product-linkage";
import { PRODUCT_SCOPES } from "../investor-tools/product-scope";

export interface LinkageReportRow {
  proposalId: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  excerpt: string;
  sourceUrl: string | null;
  proposedGrade: string;
  classifierConfidence: number;
  triageLane: TriageDecision["lane"];
  linkage: ProposalLinkageResult;
}

export interface LinkageReport {
  totalRecommendApprove: number;
  blockedOnLinkage: number;
  byVendor: { vendorId: string; count: number }[];
  byDomainSubfactor: { key: string; count: number }[];
  bySourceUrl: { sourceUrl: string; count: number }[];
  byLinkageStatus: { status: ProposalLinkageResult["status"]; count: number }[];
  rows: LinkageReportRow[];
}

const VENDOR_ID_ALIASES: Record<string, string> = {
  vendor_microsoft: "msft",
  vendor_google: "googl",
  vendor_alphabet: "googl",
  vendor_aws: "amzn",
  vendor_amazon: "amzn",
  vendor_openai: "openai",
  vendor_anthropic: "anthropic",
  vendor_servicenow: "now",
  vendor_salesforce: "crm",
  vendor_oracle: "orcl",
  vendor_sap: "sap",
  vendor_ibm: "ibm",
  vendor_snowflake: "snow",
  vendor_databricks: "databricks",
  vendor_writer: "writer",
  vendor_harvey: "harvey",
  vendor_hebbia: "hebbia",
  vendor_rogo: "rogo",
};

function canonicaliseVendorId(id: string): string {
  return VENDOR_ID_ALIASES[id] ?? id;
}

/** Group product scopes by canonical vendor id. Memoised across calls. */
let _scopesByVendor: Map<string, LinkageProductScope[]> | null = null;
function scopesByVendor(): Map<string, LinkageProductScope[]> {
  if (_scopesByVendor) return _scopesByVendor;
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
  _scopesByVendor = map;
  return map;
}

export interface LinkageReportOptions {
  vendorId?: string;
  limit?: number;
}

export async function buildLinkageReport(
  opts: LinkageReportOptions = {},
): Promise<LinkageReport> {
  if (!hasDatabase()) return emptyReport();
  const prisma = getPrisma();

  const proposals = await prisma.evidenceProposal.findMany({
    where: { status: "pending", vendorId: opts.vendorId },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 5000,
  });

  const rows: LinkageReportRow[] = [];
  let totalRecommendApprove = 0;

  for (const p of proposals) {
    const triageInput: TriageInput = {
      id: p.id,
      vendorId: p.vendorId,
      productId: undefined,
      productMention: undefined,
      domain: p.domain,
      subfactor: p.subfactor,
      excerpt: p.excerpt,
      proposedGrade: p.proposedGrade,
      proposedRawScore: p.proposedRawScore,
      sourceUrl: p.sourceUrl,
      sourceIds: p.sourceUrl ? [p.sourceUrl] : [],
      capturedAt: p.capturedAt,
      classifierConfidence: p.classifierConfidence,
      confidenceIsFallback: isClassifierFallback({
        classifierConfidence: p.classifierConfidence,
        classifierRationale: p.classifierRationale,
        confidenceIsFallback: p.confidenceIsFallback,
        classificationFailed: p.classificationFailed,
      }),
      isInferredTransformation: false,
      hasSourceConflict: false,
    };
    const decision = triageProposal(triageInput);
    if (decision.lane !== "recommend_approve") continue;
    totalRecommendApprove += 1;

    const canonVendor = canonicaliseVendorId(p.vendorId);
    const vendorScopes = scopesByVendor().get(canonVendor) ?? [];
    const linkage = suggestLinkage(
      { id: p.id, vendorId: p.vendorId, domain: p.domain, subfactor: p.subfactor, excerpt: p.excerpt },
      vendorScopes,
    );

    rows.push({
      proposalId: p.id,
      vendorId: p.vendorId,
      domain: p.domain,
      subfactor: p.subfactor,
      excerpt: p.excerpt,
      sourceUrl: p.sourceUrl,
      proposedGrade: p.proposedGrade,
      classifierConfidence: p.classifierConfidence,
      triageLane: decision.lane,
      linkage,
    });
  }

  // Aggregations
  const byVendor = countBy(rows, (r) => r.vendorId).map(([k, n]) => ({ vendorId: k, count: n }));
  const byDomainSubfactor = countBy(rows, (r) => `${r.domain}/${r.subfactor}`).map(([k, n]) => ({ key: k, count: n }));
  const bySourceUrl = countBy(rows, (r) => r.sourceUrl ?? "(no source)").map(([k, n]) => ({ sourceUrl: k, count: n }));
  const byLinkageStatus = countBy(rows, (r) => r.linkage.status).map(([k, n]) => ({
    status: k as ProposalLinkageResult["status"],
    count: n,
  }));

  return {
    totalRecommendApprove,
    blockedOnLinkage: rows.length, // every recommend_approve has linkage to consider
    byVendor,
    byDomainSubfactor,
    bySourceUrl,
    byLinkageStatus,
    rows,
  };
}

function countBy<T>(arr: T[], keyFn: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const x of arr) {
    const k = keyFn(x);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function emptyReport(): LinkageReport {
  return {
    totalRecommendApprove: 0,
    blockedOnLinkage: 0,
    byVendor: [],
    byDomainSubfactor: [],
    bySourceUrl: [],
    byLinkageStatus: [],
    rows: [],
  };
}
