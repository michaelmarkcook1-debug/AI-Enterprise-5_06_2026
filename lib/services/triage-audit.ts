// Append-only JSONL audit log for evidence triage decisions.
// ──────────────────────────────────────────────────────────
// Every decision (dry-run AND live) is written here. The file is the source
// of truth for "who/what approved what, with what evidence, in which lane,
// at what confidence" — the questions a regulator (or your future self)
// will ask after a bad auto-approve gets through.
//
// Why JSONL not Postgres:
// - Dry-run must work before any DB migration is deployed.
// - Append-only file is forensically simple — no DELETE / UPDATE risk.
// - One line per event; greppable; easy to ship to S3 or external SIEM later.
//
// File location: <repo>/data/triage-audit.jsonl (gitignored).
// Format: one JSON object per line, terminated with `\n`.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { TriageDecision, TriageLane } from "./triage";

export interface TriageAuditEntry {
  /** ISO timestamp the decision was recorded. */
  timestamp: string;
  /** Whether this was a dry-run (no side effects) or live application. */
  dryRun: boolean;
  /** Identifier for the actor that made the call. "system" for the
   * automated runner; reviewer email/id for manual approvals. */
  decidedBy: string;
  /** Proposal that was triaged. */
  proposalId: string;
  /** Vendor scope of the proposal (so the log is filterable per-vendor). */
  vendorId: string;
  /** Lane the triage assigned. */
  lane: TriageLane;
  /** Whether an action was taken (only true when dryRun=false AND lane=auto_approve). */
  applied: boolean;
  /** EvidenceRecord ID created if applied, else null. */
  promotedEvidenceId: string | null;
  /** Effective classifier confidence used for the decision (0–1). */
  confidence: number;
  /** Source IDs the decision was made against. */
  sourceIds: string[];
  /** Reasons returned by the triage rule (most-significant first). */
  reasons: string[];
  /** Unsafe-category hit, if any. */
  unsafeCategory: string | null;
  /** Threshold used at decision time (so re-tuning the threshold doesn't
   * make old log lines look wrong in retrospect). */
  thresholdUsed: number;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const AUDIT_FILE = path.join(DATA_DIR, "triage-audit.jsonl");

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function recordTriageAudit(entry: TriageAuditEntry): Promise<void> {
  await ensureDataDir();
  const line = JSON.stringify(entry) + "\n";
  await fs.appendFile(AUDIT_FILE, line, "utf8");
}

export async function recordTriageAuditBatch(entries: TriageAuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await ensureDataDir();
  const blob = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.appendFile(AUDIT_FILE, blob, "utf8");
}

/** Build an audit entry from a TriageDecision. Pure helper. */
export function decisionToAudit(args: {
  decision: TriageDecision;
  vendorId: string;
  decidedBy: string;
  dryRun: boolean;
  applied: boolean;
  promotedEvidenceId: string | null;
  thresholdUsed: number;
}): TriageAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    dryRun: args.dryRun,
    decidedBy: args.decidedBy,
    proposalId: args.decision.proposalId,
    vendorId: args.vendorId,
    lane: args.decision.lane,
    applied: args.applied,
    promotedEvidenceId: args.promotedEvidenceId,
    confidence: args.decision.confidence,
    sourceIds: args.decision.sourceIds,
    reasons: args.decision.reasons,
    unsafeCategory: args.decision.unsafeCategory ?? null,
    thresholdUsed: args.thresholdUsed,
  };
}

export const TRIAGE_AUDIT_FILE = AUDIT_FILE;
