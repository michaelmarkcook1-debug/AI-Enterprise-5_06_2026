// Evidence Queue Triage
// ─────────────────────
// Pure decision function that classifies a pending EvidenceProposal into one
// of four lanes. No DB, no I/O — all rule logic lives here so it can be
// unit-tested exhaustively before a single live record is auto-approved.
//
// Hard rule: a proposal can ONLY be auto-approved when EVERY positive gate
// passes AND the subfactor / domain / excerpt does not match an unsafe
// category. Any single failure pushes the proposal to a recommendation lane
// or to human review. There is no "mostly safe" lane that auto-approves.
//
// See `triage.test.ts` for the safety contract; the rules are locked there.

import type { EvidenceGrade } from "../types";

export type TriageLane =
  | "auto_approve"
  | "recommend_approve"
  | "recommend_reject"
  | "human_review_required";

/** Subset of EvidenceProposal fields the triage actually inspects. */
export interface TriageInput {
  id: string;
  vendorId: string;
  /** Optional product linkage from the proposal/job. Empty when the
   * extractor couldn't resolve which product the claim refers to. */
  productId?: string | null;
  /** Free-text product mention from the excerpt classifier (used when
   * productId is missing — must still match a known vendor product to count). */
  productMention?: string | null;
  domain: string;
  subfactor: string;
  excerpt: string;
  proposedGrade: EvidenceGrade;
  proposedRawScore: number;
  sourceUrl?: string | null;
  /** Source IDs already linked to this proposal (e.g. EvidenceSource rows). */
  sourceIds?: string[];
  capturedAt: Date;
  classifierConfidence: number;
  /** Optional contradiction signal — set by an upstream conflict detector
   * when ≥2 sources disagree on the same claim. Always blocks auto-approve. */
  hasSourceConflict?: boolean;
  /** Set by the extractor when a value was derived (rounded, summed,
   * extrapolated) rather than quoted verbatim from the source. */
  isInferredTransformation?: boolean;
  /** Optional dataStatus passed through from the extractor. */
  dataStatus?: string | null;
  /** Optional explicit freshness label from the connector. */
  freshnessStatus?: "fresh" | "aging" | "stale" | "unknown";
}

export interface TriageDecision {
  proposalId: string;
  lane: TriageLane;
  /** Human-readable reasons, ordered most-significant first. */
  reasons: string[];
  /** Specific unsafe-category match if any. Forces non-auto-approve. */
  unsafeCategory?: UnsafeCategory;
  /** Snapshot of the gate evaluations for the audit log. */
  signals: TriageSignals;
  /** Effective confidence used for the lane decision (0–1). */
  confidence: number;
  /** Source IDs the decision was made against (echoed for audit). */
  sourceIds: string[];
}

export interface TriageSignals {
  gradeOk: boolean;
  confidenceOk: boolean;
  hasSource: boolean;
  hasEntityMatch: boolean;
  hasProductMatch: boolean;
  notStale: boolean;
  notInferred: boolean;
  notDisputed: boolean;
  notUnsafeCategory: boolean;
  notMissingSource: boolean;
}

export type UnsafeCategory =
  | "market_share"
  | "adoption_estimate"
  | "ipo_timing"
  | "valuation"
  | "disputed";

/** Default confidence threshold for auto-approve. Configurable per-run. */
export const DEFAULT_AUTO_APPROVE_CONFIDENCE = 0.85;

/** How fresh the evidence must be (in days) for auto-approve. */
export const AUTO_APPROVE_FRESHNESS_DAYS = 365;

/** Minimum evidence grade rank for auto-approve. E2 = public documentation. */
const GRADE_RANK: Record<EvidenceGrade, number> = {
  E0: 0,
  E1: 1,
  E2: 2,
  E3: 3,
  E4: 4,
  E5: 5,
};
const MIN_AUTO_GRADE_RANK = GRADE_RANK.E2;

// ─── Unsafe category detection ────────────────────────────────────────────
// Rules are intentionally generous on the "block" side. False-positives push
// records to human_review_required (safe). False-negatives would auto-approve
// claims we said we'd never auto-approve — unacceptable. Patterns are
// reviewed in `triage.test.ts`.

const MARKET_SHARE_RX = /\b(market\s+share|share\s+of\s+market|market\s+leader|#\s*1\s+(?:in|for))\b/i;
// Fuzzy stems are matched by prefix (\b...\w*) so "approximately", "estimated",
// "estimates" all hit on "approximat" / "estimat".
const FUZZY_STEM = "(?:estimat\\w*|approximat\\w*|around|roughly|about|circa|~)";
const ADOPTION_NOUN = "(?:adoption|customers?|enterprises?|users?|seats?|deployments?)";
const ADOPTION_ESTIMATE_RX_A = new RegExp(`\\b${ADOPTION_NOUN}\\b.{0,80}\\b${FUZZY_STEM}\\b`, "i");
const ADOPTION_ESTIMATE_RX_B = new RegExp(`\\b${FUZZY_STEM}\\b.{0,80}\\b${ADOPTION_NOUN}\\b`, "i");
const ADOPTION_FUZZY_RX = /\b(?:estimat\w*|approximat\w*|roughly|around|circa|~|may|could|might|believe|expect|forecast)\b/i;
const IPO_TIMING_RX = /\b(ipo|public\s+offering|s-?1\s+filing|going\s+public|direct\s+listing)\b[^.]{0,60}\b(20\d{2}|q[1-4]|h[12]|next\s+(?:year|quarter)|by\s+\d{4})\b/i;
const VALUATION_RX = /\b(valuation|valued\s+at|worth\s+\$|enterprise\s+value|post-?money|pre-?money|\$[\d,.]+\s*(?:b|bn|billion|m|mm|million|trillion|t))\b/i;
const DISPUTED_RX = /\b(disputed|contested|denies|denied|refutes?|allegedly)\b/i;

export function detectUnsafeCategory(input: TriageInput): UnsafeCategory | null {
  const haystack = `${input.subfactor} ${input.excerpt}`;
  // Market share — also gate by the market_position domain to catch the
  // "leading position" / "dominant" wording that doesn't match the regex.
  if (MARKET_SHARE_RX.test(haystack)) return "market_share";
  if (input.domain === "market_position" && /\b(leading|dominant|top|largest)\b/i.test(haystack)) {
    return "market_share";
  }
  // Adoption estimates — number + adoption term + fuzzy quantifier.
  if (ADOPTION_ESTIMATE_RX_A.test(haystack) || ADOPTION_ESTIMATE_RX_B.test(haystack)) return "adoption_estimate";
  // IPO timing — IPO term + a time anchor.
  if (IPO_TIMING_RX.test(haystack)) return "ipo_timing";
  // Valuation claims.
  if (VALUATION_RX.test(haystack)) return "valuation";
  // Disputed.
  if (DISPUTED_RX.test(haystack)) return "disputed";
  if ((input.dataStatus ?? "").toLowerCase() === "disputed") return "disputed";
  return null;
}

// ─── Gate evaluations ─────────────────────────────────────────────────────

function isStale(input: TriageInput, now: Date): boolean {
  if (input.freshnessStatus === "stale") return true;
  if ((input.dataStatus ?? "").toLowerCase() === "stale") return true;
  const ageMs = now.getTime() - input.capturedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > AUTO_APPROVE_FRESHNESS_DAYS;
}

function isInferred(input: TriageInput): boolean {
  if (input.isInferredTransformation) return true;
  // The extractor is the authoritative signal, but as a belt-and-braces
  // check we reject obvious hedging language at auto-approve time.
  return ADOPTION_FUZZY_RX.test(input.excerpt);
}

function hasMissingSource(input: TriageInput): boolean {
  if (input.sourceUrl && input.sourceUrl.trim().length > 0) return false;
  if (input.sourceIds && input.sourceIds.length > 0) return false;
  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface TriageOptions {
  autoApproveConfidence?: number;
  /** Optional list of known vendor product names; product match passes if
   * the proposal carries productId OR the productMention matches this list.
   * When the list is empty, product match falls back to "productId present". */
  knownProductNames?: string[];
  /** Clock injection for tests. Defaults to new Date(). */
  now?: Date;
}

export function triageProposal(
  input: TriageInput,
  options: TriageOptions = {},
): TriageDecision {
  const now = options.now ?? new Date();
  const threshold = options.autoApproveConfidence ?? DEFAULT_AUTO_APPROVE_CONFIDENCE;

  const unsafeCategory = detectUnsafeCategory(input);

  const gradeOk = GRADE_RANK[input.proposedGrade] >= MIN_AUTO_GRADE_RANK;
  const confidenceOk = input.classifierConfidence >= threshold;
  const hasSource = !hasMissingSource(input);
  const hasEntityMatch = !!input.vendorId && input.vendorId.trim().length > 0;
  const hasProductMatch = (() => {
    if (input.productId) return true;
    if (!input.productMention) return false;
    const known = options.knownProductNames ?? [];
    if (known.length === 0) return false;
    const mention = input.productMention.toLowerCase();
    return known.some((p) => mention.includes(p.toLowerCase()));
  })();
  const notStale = !isStale(input, now);
  const notInferred = !isInferred(input);
  const notDisputed = unsafeCategory !== "disputed" && !input.hasSourceConflict;
  const notUnsafeCategory = unsafeCategory === null;
  const notMissingSource = hasSource;

  const signals: TriageSignals = {
    gradeOk,
    confidenceOk,
    hasSource,
    hasEntityMatch,
    hasProductMatch,
    notStale,
    notInferred,
    notDisputed,
    notUnsafeCategory,
    notMissingSource,
  };

  const reasons: string[] = [];

  // Always-block conditions (force human review or recommend_reject regardless
  // of any positive signals).
  if (input.hasSourceConflict) reasons.push("source conflict flagged on this claim");
  if (unsafeCategory) reasons.push(`unsafe category: ${unsafeCategory.replace(/_/g, " ")}`);
  if (!hasSource) reasons.push("missing source URL / sourceIds");
  if (!hasEntityMatch) reasons.push("no vendor entity match");
  if (input.proposedGrade === "E0") reasons.push("E0 evidence cannot be approved");

  // Auto-approve gate: every signal must be true AND no unsafe category.
  const allSignalsGreen =
    gradeOk &&
    confidenceOk &&
    hasSource &&
    hasEntityMatch &&
    hasProductMatch &&
    notStale &&
    notInferred &&
    notDisputed &&
    notUnsafeCategory &&
    notMissingSource;

  let lane: TriageLane;
  if (allSignalsGreen) {
    lane = "auto_approve";
    reasons.unshift(
      `auto_approve: ${input.proposedGrade} · conf ${(input.classifierConfidence * 100).toFixed(0)}% · vendor + product match · fresh · official source`,
    );
  } else if (
    unsafeCategory ||
    input.hasSourceConflict ||
    input.proposedGrade === "E0" ||
    !hasSource ||
    !hasEntityMatch
  ) {
    // Hard-block conditions → human review (NEVER auto-approve, NEVER
    // recommend_approve). We push to human_review unless the record looks
    // outright bogus, in which case recommend_reject.
    if (
      input.proposedGrade === "E0" &&
      (input.classifierConfidence < 0.4 || !hasSource)
    ) {
      lane = "recommend_reject";
      reasons.push("E0 + low confidence or missing source — recommend reject");
    } else {
      lane = "human_review_required";
    }
  } else if (gradeOk && confidenceOk && notStale && notInferred) {
    // Looks promising but not enough for auto-approve (e.g. product not
    // matched, or fuzzy language in the excerpt). Surface as recommend.
    lane = "recommend_approve";
    if (!hasProductMatch) reasons.push("product linkage missing — operator confirm");
  } else if (
    !confidenceOk &&
    input.classifierConfidence < 0.4
  ) {
    lane = "recommend_reject";
    reasons.push(`low classifier confidence ${(input.classifierConfidence * 100).toFixed(0)}%`);
  } else {
    lane = "human_review_required";
    if (!gradeOk) reasons.push(`grade ${input.proposedGrade} below E2 floor`);
    if (!confidenceOk)
      reasons.push(
        `classifier confidence ${(input.classifierConfidence * 100).toFixed(0)}% below ${(threshold * 100).toFixed(0)}% threshold`,
      );
    if (!notStale) reasons.push("captured > 365d ago — stale");
    if (!notInferred) reasons.push("inferred / hedged language detected");
  }

  return {
    proposalId: input.id,
    lane,
    reasons,
    unsafeCategory: unsafeCategory ?? undefined,
    signals,
    confidence: input.classifierConfidence,
    sourceIds: input.sourceIds ?? (input.sourceUrl ? [input.sourceUrl] : []),
  };
}

/** Batch helper. Pure — no side effects. */
export function triageBatch(
  inputs: TriageInput[],
  options: TriageOptions = {},
): TriageDecision[] {
  return inputs.map((i) => triageProposal(i, options));
}

/** Roll-up counts for a triage report. */
export function summariseLanes(decisions: TriageDecision[]): Record<TriageLane, number> {
  const out: Record<TriageLane, number> = {
    auto_approve: 0,
    recommend_approve: 0,
    recommend_reject: 0,
    human_review_required: 0,
  };
  for (const d of decisions) out[d.lane] += 1;
  return out;
}
