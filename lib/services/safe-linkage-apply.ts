// Safe linkage apply — pure planner + audit.
// ──────────────────────────────────────────
// Plans which pending EvidenceProposal rows are safe to auto-link to a
// single ProductScope based on the linkage suggester's `safeToApply`
// invariant (status === "ok" + confidence ≥ 0.95 + no competing match
// at ≥ 0.95). Anything below that — ok_uncertain, multiple_competing,
// no_match, no_vendor_products — is excluded.
//
// Audit fields written to data/linkage-apply-audit.jsonl:
//   proposalId, appliedProductScopeId, linkageConfidence,
//   linkageReason, decidedBy, appliedAt, dryRun
//
// This module is pure (no Prisma); the script and API layer feed it
// already-loaded proposals + scopes.

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  suggestLinkage,
  type LinkageProductScope,
  type LinkageProposalInput,
} from "./product-linkage";

export interface SafeLinkagePlanEntry {
  proposalId: string;
  vendorId: string;
  productScopeId: string;
  productName: string;
  confidence: number;
  reason: string;
}

export interface SafeLinkageSkippedEntry {
  proposalId: string;
  vendorId: string;
  reason: "ok_uncertain" | "multiple_competing" | "no_match" | "no_vendor_products" | "uncertain_top_match";
}

export interface SafeLinkagePlan {
  eligible: SafeLinkagePlanEntry[];
  skipped: SafeLinkageSkippedEntry[];
  /** Roll-up of skipped statuses for the report. */
  skippedByStatus: Record<string, number>;
}

export interface SafeLinkageAuditEntry {
  timestamp: string;
  dryRun: boolean;
  decidedBy: string;
  proposalId: string;
  vendorId: string;
  appliedProductScopeId: string;
  productName: string;
  linkageConfidence: number;
  linkageReason: string;
}

/** Build the plan. Pure — no I/O. */
export function planSafeLinkages(
  proposals: (LinkageProposalInput & { vendorId: string })[],
  scopesForVendor: (vendorId: string) => LinkageProductScope[],
): SafeLinkagePlan {
  const eligible: SafeLinkagePlanEntry[] = [];
  const skipped: SafeLinkageSkippedEntry[] = [];
  const skippedByStatus: Record<string, number> = {};

  for (const p of proposals) {
    const vendorScopes = scopesForVendor(p.vendorId);
    const result = suggestLinkage(p, vendorScopes);
    if (result.status === "ok" && result.suggestions[0]?.safeToApply) {
      const top = result.suggestions[0];
      eligible.push({
        proposalId: p.id,
        vendorId: p.vendorId,
        productScopeId: top.productScopeId,
        productName: top.productName,
        confidence: top.confidence,
        reason: top.reason,
      });
    } else {
      const reason = result.status as SafeLinkageSkippedEntry["reason"];
      skipped.push({ proposalId: p.id, vendorId: p.vendorId, reason });
      skippedByStatus[reason] = (skippedByStatus[reason] ?? 0) + 1;
    }
  }
  return { eligible, skipped, skippedByStatus };
}

// ─── Audit log ────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(process.cwd(), "data");
const AUDIT_FILE = path.join(DATA_DIR, "linkage-apply-audit.jsonl");

export const LINKAGE_AUDIT_FILE = AUDIT_FILE;

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function recordLinkageAuditBatch(entries: SafeLinkageAuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await ensureDataDir();
  const blob = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.appendFile(AUDIT_FILE, blob, "utf8");
}

export function entryToAudit(args: {
  entry: SafeLinkagePlanEntry;
  decidedBy: string;
  dryRun: boolean;
}): SafeLinkageAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    dryRun: args.dryRun,
    decidedBy: args.decidedBy,
    proposalId: args.entry.proposalId,
    vendorId: args.entry.vendorId,
    appliedProductScopeId: args.entry.productScopeId,
    productName: args.entry.productName,
    linkageConfidence: args.entry.confidence,
    linkageReason: args.entry.reason,
  };
}
