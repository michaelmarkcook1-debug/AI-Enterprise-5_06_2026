// AIE-06/07/08 — Shared pool types.
// ─────────────────────────────────────────────────────────────────────────────
// The anonymization invariant is enforced STRUCTURALLY, not by policy: a
// PoolContribution has no orgId/seatId/sessionId field AT ALL — it is
// impossible to construct one that traces back to its source, the same way
// AIE-05's Finding type makes an ungrounded claim impossible to persist. See
// lib/pool/anonymize.ts for the (IntentProfile, Finding) -> PoolContribution
// transform that is the ONLY place this type gets produced.

import type { IndustryTag } from "../use-cases";
import type { SizeBandId, RegionId } from "../peer/segments";

/** Fixed, coarse goal taxonomy — never the CIO's raw free text (which can
 *  contain identifying detail like a company name). One category per
 *  contribution; "other" is the honest catch-all, never a forced guess. */
export const GOAL_CATEGORIES = [
  { id: "model_selection", label: "Choosing/standardizing on a model" },
  { id: "coding_copilot", label: "Coding copilot rollout" },
  { id: "customer_service_automation", label: "Customer service automation" },
  { id: "cost_reduction", label: "Reducing AI/infra cost" },
  { id: "compliance_evaluation", label: "Compliance/regulatory evaluation" },
  { id: "vendor_comparison", label: "Comparing vendors broadly" },
  { id: "risk_assessment", label: "Safety/security/risk assessment" },
  { id: "other", label: "Other" },
] as const;
export type GoalCategoryId = (typeof GOAL_CATEGORIES)[number]["id"];

/** Fixed, coarse constraint tags — same anonymization rationale as goals. */
export const CONSTRAINT_TAGS = [
  { id: "budget", label: "Budget" },
  { id: "compliance", label: "Compliance (SOC2/HIPAA/etc.)" },
  { id: "data_residency", label: "Data residency" },
  { id: "timeline", label: "Timeline" },
  { id: "vendor_lockin", label: "Vendor lock-in" },
  { id: "existing_infrastructure", label: "Existing infrastructure" },
  { id: "security", label: "Security" },
  { id: "other", label: "Other" },
] as const;
export type ConstraintTagId = (typeof CONSTRAINT_TAGS)[number]["id"];

/** The DRAFT consent terms version. Engineering is not the source of truth for
 *  legal language (AIE-06's ticket explicitly says: get a lawyer, don't have
 *  the team improvise). The UI must show this is a draft; a real version
 *  string replaces this constant once real terms are drafted and reviewed. */
export const DRAFT_TERMS_VERSION = "draft-v0-pending-legal-review";

/** A contribution to the shared pool — the ONLY shape allowed to be written to
 *  ai_pool_contribution. No orgId, seatId, or sessionId: the absence is the
 *  anonymization guarantee, not a hidden/nulled field. No raw free text: goal
 *  and constraints are pre-reduced to the fixed taxonomies above. */
export interface PoolContribution {
  vertical: IndustryTag;
  sizeBand: SizeBandId;
  region: RegionId;
  goalCategory: GoalCategoryId;
  constraintTags: ConstraintTagId[];
  contributedAt: string; // ISO date
}

/** One org's consent decision for one session. Lives on the ORG's own side —
 *  never joined into the pool — so it can record session/seat linkage for
 *  audit ("who consented, when, to what") without that linkage ever reaching
 *  the anonymized pool itself. */
export interface ConsentRecord {
  sessionId: string;
  seatId: string;
  orgId: string;
  consented: boolean;
  termsVersion: string;
  decidedAt: string; // ISO date
}

/** A cited, anonymized pattern derived from the pool — what AIE-07 hands back
 *  to retrieval.ts once a segment has crossed the minimum-count floor. */
export interface PoolAggregate {
  contributors: number;
  segment: { vertical: IndustryTag; sizeBand: SizeBandId; region: RegionId };
  /** goalCategory -> share of contributors (0..1) with that goal. */
  goalShares: { goalCategory: GoalCategoryId; share: number }[];
  /** constraintTag -> share of contributors (0..1) naming that constraint. */
  constraintShares: { constraintTag: ConstraintTagId; share: number }[];
}

export interface PoolProgress {
  contributors: number;
  floor: number;
  remaining: number; // max(0, floor - contributors)
}
