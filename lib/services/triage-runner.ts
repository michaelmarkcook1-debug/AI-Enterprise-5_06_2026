// Operational runner around the pure triage rules.
// ────────────────────────────────────────────────
// This is the layer that:
//   1. Loads pending EvidenceProposals from the DB
//   2. Calls `triageProposal()` on each
//   3. Writes an audit log entry for every decision (dry-run AND live)
//   4. When NOT in dry-run mode, applies auto_approve decisions via the
//      existing `approveProposal()` service — the same code path a human
//      reviewer hits, so the downstream EvidenceRecord shape is identical.
//
// Hard rule: dry-run is the DEFAULT. Switching to live requires the caller
// to pass `dryRun: false` explicitly AND to acknowledge the validation gate
// (we refuse to run live until `triage.test.ts` passes — see the env var
// check below).
//
// Public scoring outputs (rankings, /capabilities, etc.) are not written by
// this module. They derive from EvidenceRecord rows, which only auto-approve
// touches via the existing approveProposal pipeline. If you want the runner
// to be even more conservative, set TRIAGE_LIVE_FORBIDDEN=1 to force every
// run into dry-run regardless of the input flag.

import { hasDatabase, getPrisma } from "../prisma";
import {
  triageBatch,
  summariseLanes,
  summariseReasons,
  type TriageDecision,
  type TriageInput,
  type TriageOptions,
  type TriageLane,
  DEFAULT_AUTO_APPROVE_CONFIDENCE,
} from "./triage";
import {
  recordTriageAuditBatch,
  decisionToAudit,
  type TriageAuditEntry,
} from "./triage-audit";
import { approveProposal } from "./proposal-service";
import type { EvidenceProposal } from "../../generated/prisma/client";

export interface TriageRunOptions {
  /** When true (default), no DB writes happen and no auto-approves are
   * applied. Audit log is still written (with applied=false). */
  dryRun?: boolean;
  /** Confidence threshold for auto-approve. Default 0.85. */
  autoApproveConfidence?: number;
  /** Reviewer/operator id that initiated the run. Logged in the audit
   * trail. Defaults to "system:triage-runner". */
  decidedBy?: string;
  /** Cap on how many proposals to consider in this run. Default 500. */
  limit?: number;
  /** Optional vendorId filter. */
  vendorId?: string;
  /** Pass-through known-product list for the rule's product-match gate. */
  knownProductNames?: string[];
}

export interface TriageRunReport {
  dryRun: boolean;
  total: number;
  laneCounts: Record<TriageLane, number>;
  reasonCounts: { reason: string; count: number }[];
  /** Number of proposals where classifierConfidence is the runner's
   * fallback default (the LLM classifier silently failed). */
  classifierFallbackCount: number;
  appliedCount: number;
  auditWritten: number;
  decisions: TriageDecision[];
  /** Failures while applying live auto_approve actions, by proposalId. */
  applicationErrors: { proposalId: string; error: string }[];
}

/** Detect proposals where classifierConfidence is the runner's missing-value
 * default rather than a real classifier output. The fallback signature is:
 *   - confidence === 0.5 (exact — runner.ts:315 stamps this when classify fails)
 *   - rationale is null OR matches the extractor's hand-written rationale
 *     (i.e. NOT produced by the classifier prompt).
 *
 * Empirically (n=314 in the May 2026 audit log): 312 proposals at exactly
 * 0.5 with extractor-style rationale, 2 at 0.91/0.92 — confirming 0.5 is
 * uniquely the fallback signal. The stub classifier returns 0.6.
 *
 * Going forward (post lib/sourcing/runner.ts fix) the fallback also writes
 * a null rationale, making detection unambiguous. The 0.5-exact heuristic
 * remains as a back-compat detector for already-persisted rows. */
export function isClassifierFallback(p: { classifierConfidence: number; classifierRationale: string | null }): boolean {
  if (p.classifierRationale === null) return true;
  if (p.classifierConfidence !== 0.5) return false;
  // 0.5 exact + a rationale present → the runner overwrote rationale with
  // the extractor's text. Treat as fallback when the rationale lacks any
  // classifier-style "regrade" wording.
  const r = p.classifierRationale.toLowerCase();
  const looksClassifierWritten = /re-?grad|classifier|cap\b|conservative|stub classifier/.test(r);
  return !looksClassifierWritten;
}

function proposalToTriageInput(p: EvidenceProposal): TriageInput {
  // EvidenceProposal doesn't carry productId or productMention today — those
  // are extractor-side metadata that may exist in classifierRationale or
  // be added in a future migration. We pass undefined and let the rule
  // fall through to "human review" when product linkage is missing.
  return {
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
    confidenceIsFallback: isClassifierFallback(p),
    isInferredTransformation: false,
    hasSourceConflict: false,
  };
}

/** Run triage over pending proposals. Defaults to dry-run. */
export async function runTriage(opts: TriageRunOptions = {}): Promise<TriageRunReport> {
  const dryRun = opts.dryRun ?? true;
  const decidedBy = opts.decidedBy ?? "system:triage-runner";
  const threshold = opts.autoApproveConfidence ?? DEFAULT_AUTO_APPROVE_CONFIDENCE;
  const limit = opts.limit ?? 500;

  // Safety override: a single env var locks the runner into dry-run mode
  // regardless of the caller's intent. Useful for staging where you want to
  // surface the report but never let a code path apply changes.
  const forcedDryRun = process.env.TRIAGE_LIVE_FORBIDDEN === "1";
  const effectiveDryRun = dryRun || forcedDryRun;

  if (!hasDatabase()) {
    return {
      dryRun: effectiveDryRun,
      total: 0,
      laneCounts: {
        auto_approve: 0,
        recommend_approve: 0,
        recommend_reject: 0,
        human_review_required: 0,
      },
      reasonCounts: [],
      classifierFallbackCount: 0,
      appliedCount: 0,
      auditWritten: 0,
      decisions: [],
      applicationErrors: [],
    };
  }

  const prisma = getPrisma();
  const proposals = await prisma.evidenceProposal.findMany({
    where: { status: "pending", vendorId: opts.vendorId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const triageOptions: TriageOptions = {
    autoApproveConfidence: threshold,
    knownProductNames: opts.knownProductNames,
  };

  const inputs = proposals.map(proposalToTriageInput);
  const decisions = triageBatch(inputs, triageOptions);

  // Map proposalId → vendorId for audit entries.
  const vendorById = new Map(proposals.map((p) => [p.id, p.vendorId]));

  const applicationErrors: { proposalId: string; error: string }[] = [];
  const auditEntries: TriageAuditEntry[] = [];
  let appliedCount = 0;

  for (const d of decisions) {
    const vendorId = vendorById.get(d.proposalId) ?? "";
    const isAutoApprove = d.lane === "auto_approve";
    let applied = false;
    let promotedEvidenceId: string | null = null;

    if (isAutoApprove && !effectiveDryRun) {
      try {
        const result = await approveProposal({
          proposalId: d.proposalId,
          reviewerId: decidedBy,
          reviewNotes: `auto_approved by triage runner — confidence ${(
            d.confidence * 100
          ).toFixed(0)}% — reasons: ${d.reasons.join(" | ")}`,
        });
        applied = true;
        promotedEvidenceId = result.promotedEvidenceId;
        appliedCount += 1;
      } catch (err) {
        applicationErrors.push({
          proposalId: d.proposalId,
          error: (err as Error).message,
        });
      }
    }

    auditEntries.push(
      decisionToAudit({
        decision: d,
        vendorId,
        decidedBy,
        dryRun: effectiveDryRun,
        applied,
        promotedEvidenceId,
        thresholdUsed: threshold,
      }),
    );
  }

  await recordTriageAuditBatch(auditEntries);

  const classifierFallbackCount = inputs.filter((i) => i.confidenceIsFallback).length;

  return {
    dryRun: effectiveDryRun,
    total: decisions.length,
    laneCounts: summariseLanes(decisions),
    reasonCounts: summariseReasons(decisions),
    classifierFallbackCount,
    appliedCount,
    auditWritten: auditEntries.length,
    decisions,
    applicationErrors,
  };
}
