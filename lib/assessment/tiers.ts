// Assessment tier model — Phase 1A scaffold.
// ─────────────────────────────────────────
// Three progressive-disclosure entry paths. Existing 4-step wizard
// behaviour maps to the Quick tier and remains the default. Guided
// and Advanced are accessible from the tier picker; their additional
// depth slots are placeholders for Phase 1B (adaptive logic + new
// input dimensions per ASSESSMENT_GRANULARITY_UPGRADE_PLAN.md).

export type AssessmentTier = "quick" | "guided" | "advanced";

export const DEFAULT_TIER: AssessmentTier = "quick";

export interface TierMeta {
  id: AssessmentTier;
  label: string;
  estTime: string;
  description: string;
}

export const TIERS: TierMeta[] = [
  {
    id: "quick",
    label: "Quick Assessment",
    estTime: "~2–4 min",
    description:
      "The existing 4-step fit assessment. Best for fast triage and a first read.",
  },
  {
    id: "guided",
    label: "Guided Assessment",
    estTime: "~5–8 min",
    description:
      "Adds decision-shaping depth — governance, integration depth, and human-review model. Adaptive follow-ups arrive in Phase 1B.",
  },
  {
    id: "advanced",
    label: "Advanced Assessment",
    estTime: "~10–15 min",
    description:
      "Procurement-grade depth for regulated deployment, RFP, and board scrutiny. Stack-based output + four output modes arrive in Phase 1B.",
  },
];

export function isAssessmentTier(value: unknown): value is AssessmentTier {
  return value === "quick" || value === "guided" || value === "advanced";
}

export function parseTier(input: string | null | undefined): AssessmentTier {
  if (isAssessmentTier(input)) return input;
  return DEFAULT_TIER;
}

/** Stable key for sessionStorage form-state persistence. Shared across
 * tiers so a user who progresses from Quick → Guided keeps their
 * answers. */
export const ASSESSMENT_FORM_STATE_KEY = "ai-enterpise.assessment.form-state.v1";
