// C6 — Use-case-first front door ("where's my low-hanging fruit").
// ─────────────────────────────────────────────────────────────────
// Methodology: docs/c6-usecase-impact-feasibility.md. Two axes:
//
//   FEASIBILITY — deterministic, computed here from the workflow's REAL taxonomy
//   attributes (lib/use-cases.ts) + the buyer's stated maturity. A documented
//   function of existing data — nothing invented. Shown as a BAND, never a
//   false-precision decimal.
//
//   IMPACT — CURATED, CITED analyst estimates per (use-case × industry), ingested
//   from docs/c6-usecase-library-template.csv rows. THE DATASET IS EMPTY UNTIL AN
//   ANALYST SUPPLIES CITED ROWS. Every uncovered cell renders "impact not yet
//   evidenced" — never a default, never an invented number (FACTUAL-DATA-ONLY).
//
// Routing: each use-case family routes to the market category/ies whose vendors
// serve it — into the evidence-backed assessment. Curated structural taxonomy
// (like C13 role→layer), validated by tests against the real category ids.

import { USE_CASES, type UseCase, type IndustryTag } from "./use-cases";
import {
  USECASE_IMPACT,
  USECASE_EVIDENCE_FLAGS,
  type UseCaseImpact,
  type UseCaseEvidenceFlag,
  type UpliftBand,
} from "./usecase-impact-data";

export { USECASE_IMPACT, USECASE_EVIDENCE_FLAGS } from "./usecase-impact-data";
export type {
  UseCaseImpact,
  UseCaseEvidenceFlag,
  UpliftBand,
  ValueBand,
  EvidenceFlagKind,
  EvidenceGrade,
} from "./usecase-impact-data";

// ── Buyer maturity (guided input, documented mapping) ────────────────────────
export const MATURITY_LEVELS = [
  { id: "early", label: "Early — exploring, little AI in production", fit: 0.25 },
  { id: "developing", label: "Developing — pilots running, data platform forming", fit: 0.5 },
  { id: "established", label: "Established — several AI systems in production", fit: 0.75 },
  { id: "advanced", label: "Advanced — mature data/AI platform + governance", fit: 1.0 },
] as const;
export type MaturityId = (typeof MATURITY_LEVELS)[number]["id"];

// ── Feasibility (deterministic; weights per methodology §3) ───────────────────
const COMPLEXITY_SCORE: Record<string, number> = { simple: 1.0, moderate: 0.6, complex: 0.3 };
const RISK_SCORE: Record<UseCase["riskTier"], number> = { low: 1.0, medium: 0.7, high: 0.4, critical: 0.2 };

export function feasibilityScore(uc: UseCase, maturityFit: number): number {
  const complexity = COMPLEXITY_SCORE[uc.complexity ?? "moderate"] ?? 0.6;
  const reliabilityHeadroom = (6 - uc.reliabilityRequirement) / 5;
  const risk = RISK_SCORE[uc.riskTier];
  const regulatory = 1 - Math.min(uc.regulatoryFlags?.length ?? 0, 5) / 5;
  const fit = Math.min(Math.max(maturityFit, 0), 1);
  return 0.35 * complexity + 0.25 * reliabilityHeadroom + 0.2 * risk + 0.1 * regulatory + 0.1 * fit;
}

// Documented band thresholds — output is the band, never the raw decimal.
export type FeasibilityBand = "high" | "medium" | "low";
export function feasibilityBand(score: number): FeasibilityBand {
  return score >= 0.7 ? "high" : score >= 0.45 ? "medium" : "low";
}

// ── Impact (curated + cited) — data + provenance live in usecase-impact-data.ts ──
// The impact axis is EVIDENCED UPLIFT. A row exists ONLY where a real, named source
// gives one; no row ⇒ "impact not yet evidenced" (never a default). $ value-at-stake
// is an optional, separately-sourced sub-field, never inferred from uplift.

/** Exact-industry row wins over a horizontal ("*") row; null = not evidenced. */
export function impactFor(useCaseId: string, industry: IndustryTag): UseCaseImpact | null {
  const rows = USECASE_IMPACT.filter((r) => r.useCaseId === useCaseId);
  return rows.find((r) => r.industryTag === industry) ?? rows.find((r) => r.industryTag === "*") ?? null;
}

/** Counter-evidence flags for a use-case (AI does NOT cleanly help). Horizontal ("*")
 *  flags apply to every industry. These are honesty signals, never impact chips. */
export function flagsFor(useCaseId: string, industry: IndustryTag): UseCaseEvidenceFlag[] {
  return USECASE_EVIDENCE_FLAGS.filter(
    (f) => f.useCaseId === useCaseId && (f.industryTag === industry || f.industryTag === "*"),
  );
}

// ── Priority quadrant (methodology §5): evidenced Uplift × deterministic Feasibility.
// Only placeable when impact is EVIDENCED (a curated uplift row exists); otherwise null
// and the use-case sits in the honest "impact not yet evidenced" lane, feasibility-only.
export type PriorityQuadrant = "quick_win" | "big_bet" | "easy_fill_in" | "question_mark";

/** High impact = a task uplift of 25% or more (the upper two evidenced bands). */
export function impactIsHigh(band: UpliftBand): boolean {
  return band === "25_50%" || band === "gt_50%";
}

export function priorityQuadrant(
  impact: UseCaseImpact | null,
  feasibility: FeasibilityBand,
): PriorityQuadrant | null {
  if (!impact) return null; // impact axis not evidenced → not placeable (honest)
  const impactHigh = impactIsHigh(impact.upliftBand);
  const feasHigh = feasibility === "high";
  if (impactHigh && feasHigh) return "quick_win";
  if (impactHigh && !feasHigh) return "big_bet";
  if (!impactHigh && feasHigh) return "easy_fill_in";
  return "question_mark";
}

// ── Routing: use-case FAMILY → market category ids (curated taxonomy) ─────────
// Values must be real /category/[id] ids (test-validated against the 13-profile
// list). A family routes to the categories whose vendors actually serve it.
export const MARKET_CATEGORY_IDS = [
  "frontier_model_api",
  "enterprise_assistant",
  "developer_coding_agent",
  "agent_platform",
  "rag_enterprise_search",
  "workflow_automation_ai",
  "crm_customer_ai",
  "itsm_hr_service_ai",
  "cloud_ai_platform",
  "regulated_industry_ai",
  "ai_silicon",
  "ai_cloud_compute",
  "neocloud_inference",
] as const;
export type MarketCategoryId = (typeof MARKET_CATEGORY_IDS)[number];

export const FAMILY_ROUTES: Record<string, MarketCategoryId[]> = {
  Engineering: ["developer_coding_agent", "agent_platform"],
  IT: ["itsm_hr_service_ai", "workflow_automation_ai"],
  Operations: ["workflow_automation_ai", "agent_platform"],
  Service: ["crm_customer_ai", "enterprise_assistant"],
  Customer: ["crm_customer_ai", "enterprise_assistant"],
  Sales: ["crm_customer_ai", "enterprise_assistant"],
  Revenue: ["crm_customer_ai", "workflow_automation_ai"],
  Marketing: ["enterprise_assistant", "crm_customer_ai"],
  Legal: ["regulated_industry_ai", "rag_enterprise_search"],
  Compliance: ["regulated_industry_ai", "rag_enterprise_search"],
  Finance: ["workflow_automation_ai", "rag_enterprise_search"],
  "Financial Services": ["regulated_industry_ai", "rag_enterprise_search"],
  HR: ["itsm_hr_service_ai", "enterprise_assistant"],
  Data: ["cloud_ai_platform", "rag_enterprise_search"],
  Productivity: ["enterprise_assistant", "rag_enterprise_search"],
  Security: ["regulated_industry_ai", "workflow_automation_ai"],
  Health: ["regulated_industry_ai", "rag_enterprise_search"],
  Manufacturing: ["workflow_automation_ai", "agent_platform"],
  "Public Sector": ["regulated_industry_ai", "rag_enterprise_search"],
  "Enterprise Software": ["enterprise_assistant", "workflow_automation_ai"],
  "Critical Infrastructure": ["regulated_industry_ai", "workflow_automation_ai"],
};
// Families not in the map route to the assistant + automation defaults — the two
// broadest categories — rather than dead-ending (documented fallback, not data).
const FALLBACK_ROUTE: MarketCategoryId[] = ["enterprise_assistant", "workflow_automation_ai"];

export function routesForUseCase(uc: UseCase): MarketCategoryId[] {
  return FAMILY_ROUTES[uc.category] ?? FALLBACK_ROUTE;
}

// ── The ranked front-door result ──────────────────────────────────────────────
export interface FrontDoorEntry {
  useCase: UseCase;
  feasibility: FeasibilityBand;
  feasibilityScore: number; // kept for ORDERING only — UI shows the band
  impact: UseCaseImpact | null; // null ⇒ "impact not yet evidenced"
  quadrant: PriorityQuadrant | null; // null ⇒ impact not evidenced → not placeable
  flags: UseCaseEvidenceFlag[]; // counter-evidence (AI may not cleanly help) — honesty
  routes: MarketCategoryId[];
}

/** Industry match: tagged for the industry, or horizontal (no industry tags). */
function matchesIndustry(uc: UseCase, industry: IndustryTag): boolean {
  if (!uc.industries || uc.industries.length === 0) return true;
  return uc.industries.includes(industry);
}

export function frontDoorRank(industry: IndustryTag, maturity: MaturityId): FrontDoorEntry[] {
  const fit = MATURITY_LEVELS.find((m) => m.id === maturity)?.fit ?? 0.5;
  return USE_CASES.filter((uc) => matchesIndustry(uc, industry))
    .map((uc) => {
      const score = feasibilityScore(uc, fit);
      const band = feasibilityBand(score);
      const impact = impactFor(uc.id, industry);
      return {
        useCase: uc,
        feasibility: band,
        feasibilityScore: score,
        impact,
        quadrant: priorityQuadrant(impact, band),
        flags: flagsFor(uc.id, industry),
        routes: routesForUseCase(uc),
      };
    })
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore);
}

/**
 * A small, MATURITY-INDEPENDENT preview for the front door's COLD state (before
 * the buyer has picked industry × maturity) so it's never a bare selector screen.
 *
 * HONEST BY CONSTRUCTION: only HORIZONTAL use-cases (no industry tags → apply to
 * every industry) that score "high" feasibility even at the WORST-CASE maturity
 * (fit = 0). If a workflow is high-feasibility even for the least-mature team,
 * "high feasibility" is true for everyone — so the band holds before any maturity
 * is chosen, without presupposing one. No fabrication: real curated use-cases,
 * real category routes, impact still null ("not yet evidenced"). It is a strict
 * subset of what frontDoorRank returns once the buyer selects, never a different
 * or inflated set — picking industry × maturity only tailors + expands the list.
 */
export function commonFastWins(limit = 6): FrontDoorEntry[] {
  const worstCaseFit = 0;
  return USE_CASES.filter((uc) => !uc.industries || uc.industries.length === 0)
    .map((uc) => {
      const score = feasibilityScore(uc, worstCaseFit);
      return {
        useCase: uc,
        feasibility: feasibilityBand(score),
        feasibilityScore: score,
        impact: null as UseCaseImpact | null, // no industry chosen yet → honestly absent
        quadrant: null, // impact absent → not placeable
        // horizontal ("*") counter-evidence still applies before any industry is chosen
        flags: USECASE_EVIDENCE_FLAGS.filter((f) => f.useCaseId === uc.id && f.industryTag === "*"),
        routes: routesForUseCase(uc),
      };
    })
    .filter((e) => e.feasibility === "high")
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore)
    .slice(0, limit);
}
