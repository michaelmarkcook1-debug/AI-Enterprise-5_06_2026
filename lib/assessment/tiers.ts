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
    label: "AI Opportunity Assessment",
    estTime: "5–10 min",
    description:
      "Where should we start? Identifies top AI opportunity areas, risk, and readiness for CIOs, COOs, and innovation leaders.",
  },
  {
    id: "guided",
    label: "AI Strategy Assessment",
    estTime: "20–30 min",
    description:
      "What should we deploy? Recommended architecture, vendor shortlist, sustainability view, and implementation roadmap for CIOs, CTOs, and enterprise architects.",
  },
  {
    id: "advanced",
    label: "AI Procurement Assessment",
    estTime: "60–120 min",
    description:
      "Should we buy this? Procurement-grade scoring across business value, risk, security, governance, integration, cost, sovereignty, and strategic sustainability for CIOs, procurement, legal, security, and CFOs.",
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
