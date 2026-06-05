// Workflow-risk profile.
// ──────────────────────
// Derives a structured risk overlay from the buyer's selected use
// cases. Reads the v2 fields on each UseCase (regulatoryFlags,
// reliabilityRequirement, complexity, autonomyDefault, commonInputs)
// and folds them into a single object the scoring engine consumes.
//
// The point of this module: a buyer can select workflows whose
// combined regulatory + reliability profile is stricter than the
// buyer themselves dialled in on the sliders. Without this overlay,
// the engine scores against the dialled values and silently
// under-penalises vendors that lack the regulatory evidence the
// workflows actually need. The overlay raises the effective values
// the engine uses AND records WHY so the results UI can show the
// reasoning.

import { USE_CASES, type UseCase, type RegulatoryFlag } from "./use-cases";
import { DOMAIN_TO_PILLAR, type DomainId } from "./types";

/* ─── Regulatory regime → evidence-domain map ────────────────────── */

/**
 * Which vendor evidence domains a given regulatory regime requires
 * STRONG (E3+) coverage in. Drives the regulatory-evidence-gap penalty
 * and the missing-evidence narrative.
 *
 * These mappings are deliberately conservative — a regime appears here
 * only when the relevant control language plainly implies the domain.
 * Sources: NIST 800-53 mappings, ISO 27001 Annex A, HIPAA Security
 * Rule §164.308–312, SOX §404, GDPR Art. 5/25/32, EU AI Act §9–15.
 */
export const REGULATORY_REQUIRED_DOMAINS: Record<RegulatoryFlag, DomainId[]> = {
  HIPAA:        ["data_security_privacy", "identity_access", "governance_compliance", "security_threat"],
  GDPR:         ["data_security_privacy", "governance_compliance"],
  CCPA:         ["data_security_privacy", "governance_compliance"],
  SOX:          ["governance_compliance", "identity_access"],
  PCI_DSS:      ["data_security_privacy", "identity_access", "security_threat"],
  FINRA:        ["governance_compliance", "model_reliability"],
  MiFID_II:     ["governance_compliance", "model_reliability"],
  BASEL_III:    ["governance_compliance", "model_reliability"],
  FERPA:        ["data_security_privacy", "governance_compliance"],
  ITAR:         ["data_security_privacy", "identity_access", "governance_compliance"],
  EU_AI_Act:    ["model_reliability", "governance_compliance", "agentic_autonomy"],
  SOC2:         ["data_security_privacy", "identity_access", "security_threat"],
  ISO_27001:    ["data_security_privacy", "identity_access", "security_threat", "governance_compliance"],
  FDA_21CFR11:  ["governance_compliance", "model_reliability", "identity_access"],
};

/* ─── Heuristics ─────────────────────────────────────────────────── */

/** A workflow whose commonInputs contain any of these strings is
 *  treated as touching regulated personal data — boosts effective
 *  data sensitivity even when the buyer didn't tick a regulatory
 *  flag explicitly. Conservative; intentionally short. */
const SENSITIVE_INPUT_KEYWORDS = [
  "ehr", "phi", "patient", "clinical",     // health
  "customer profile", "billing", "credit", // financial / consumer
  "kyc", "transaction", "card",            // payments
  "student", "ferpa",                       // education
  "ssn", "passport", "identity",            // PII
];

/** How much each complexity rung raises the implied reliability
 *  requirement, beyond what the use case itself states. */
const COMPLEXITY_RELIABILITY_BUMP: Record<UseCase["complexity"] & string, number> = {
  simple: 0,
  moderate: 0,
  complex: 1,
};

/** Which buyer autonomy choices conflict with a workflow's safe
 *  autonomy default. A "1" means the buyer is asking for MORE autonomy
 *  than the workflow safely supports. Used to surface a warning
 *  without auto-overriding the buyer's choice. */
const AUTONOMY_ORDER: Record<string, number> = {
  advisory_only: 0,
  human_in_loop: 1,
  supervised_agent: 2,
  autonomous: 3,
};

/* ─── Public types ───────────────────────────────────────────────── */

export interface WorkflowRiskProfile {
  /** The selected UseCase records, resolved by id. Unknown ids dropped. */
  selectedWorkflows: UseCase[];
  /** Unique regulatory regimes touched by the selection. */
  regulatoryRegimes: RegulatoryFlag[];
  /** Vendor evidence domains the selected regimes require E3+ in. */
  requiredEvidenceDomains: DomainId[];
  /**
   * The effective data sensitivity the engine should use. Raised
   * above the buyer's dialled value when (a) the regulatory regimes
   * imply higher, or (b) commonInputs hit a sensitive keyword.
   */
  effectiveDataSensitivity: 1 | 2 | 3 | 4 | 5;
  /**
   * The effective reliability requirement (1..5). Maximum across all
   * selected workflows, plus a small complexity bump.
   */
  effectiveReliabilityRequirement: 1 | 2 | 3 | 4 | 5;
  /**
   * True when the buyer's autonomy choice is higher than the
   * highest-safe autonomy of any selected workflow.
   */
  autonomyConflict: boolean;
  /** The most conservative autonomy default across the selection. */
  safestAutonomyDefault: UseCase["autonomyDefault"];
  /**
   * Distribution of workflow complexity across the selection. Used
   * by the results UI to explain the maturity gap.
   */
  complexityCounts: { simple: number; moderate: number; complex: number };
  /** Plain-English rationale strings the results UI can render. */
  rationale: string[];
}

/* ─── Builder ────────────────────────────────────────────────────── */

function clamp1to5(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return Math.round(n) as 1 | 2 | 3 | 4 | 5;
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

/**
 * Compute the workflow-risk profile from the buyer's input.
 *
 * @param useCaseIds  The buyer's selected use case ids
 * @param dialledDataSensitivity  The slider value 1..5
 * @param dialledRiskTolerance    The slider value 1..5
 * @param dialledAutonomyAppetite One of the buyer's autonomy choices
 */
export function deriveWorkflowRiskProfile(
  useCaseIds: string[],
  dialledDataSensitivity: 1 | 2 | 3 | 4 | 5,
  dialledRiskTolerance: 1 | 2 | 3 | 4 | 5,
  dialledAutonomyAppetite: string,
): WorkflowRiskProfile {
  const byId = new Map(USE_CASES.map((u) => [u.id, u]));
  const selectedWorkflows = useCaseIds
    .map((id) => byId.get(id))
    .filter((u): u is UseCase => Boolean(u));

  if (selectedWorkflows.length === 0) {
    return {
      selectedWorkflows: [],
      regulatoryRegimes: [],
      requiredEvidenceDomains: [],
      effectiveDataSensitivity: dialledDataSensitivity,
      effectiveReliabilityRequirement: 3,
      autonomyConflict: false,
      safestAutonomyDefault: "human_in_loop",
      complexityCounts: { simple: 0, moderate: 0, complex: 0 },
      rationale: ["No workflows selected — workflow-risk overlay is a no-op."],
    };
  }

  // 1. Regulatory regimes touched.
  const regulatoryRegimes = dedupe(
    selectedWorkflows.flatMap((w) => w.regulatoryFlags ?? []),
  );

  // 2. Required evidence domains across all touched regimes.
  const requiredEvidenceDomains = dedupe(
    regulatoryRegimes.flatMap((regime) => REGULATORY_REQUIRED_DOMAINS[regime] ?? []),
  );

  // 3. Effective data sensitivity. Start from the dialled value, then
  //    bump if regulatory regimes imply stricter handling, then bump
  //    again if commonInputs hit a sensitive-keyword.
  const HIGH_REGIMES: RegulatoryFlag[] = ["HIPAA", "FDA_21CFR11", "EU_AI_Act", "ITAR", "PCI_DSS", "FINRA"];
  const touchesHighRegime = regulatoryRegimes.some((r) => HIGH_REGIMES.includes(r));
  const lowerSensitiveRegimes: RegulatoryFlag[] = ["GDPR", "CCPA", "SOX", "SOC2", "ISO_27001", "FERPA"];
  const touchesLowerRegime = regulatoryRegimes.some((r) => lowerSensitiveRegimes.includes(r));
  const allInputs = selectedWorkflows.flatMap((w) => w.commonInputs ?? []).map((s) => s.toLowerCase());
  const hitsSensitiveKeyword = SENSITIVE_INPUT_KEYWORDS.some((kw) => allInputs.some((i) => i.includes(kw)));

  const regimeBump = touchesHighRegime ? 2 : touchesLowerRegime ? 1 : 0;
  const keywordBump = hitsSensitiveKeyword ? 1 : 0;
  const effectiveDataSensitivity = clamp1to5(
    Math.max(dialledDataSensitivity, dialledDataSensitivity + regimeBump, dialledDataSensitivity + keywordBump),
  );

  // 4. Effective reliability requirement: max across selections + complexity bump.
  const workflowMaxReliability = Math.max(...selectedWorkflows.map((w) => w.reliabilityRequirement));
  const complexityBump = selectedWorkflows.some((w) => w.complexity === "complex") ? COMPLEXITY_RELIABILITY_BUMP.complex : 0;
  const effectiveReliabilityRequirement = clamp1to5(workflowMaxReliability + complexityBump);

  // 5. Autonomy conflict — true if buyer dialled higher than safest.
  const buyerAutonomyRank = AUTONOMY_ORDER[dialledAutonomyAppetite] ?? 1;
  const safestDefault = selectedWorkflows.reduce<UseCase["autonomyDefault"]>(
    (acc, w) =>
      AUTONOMY_ORDER[w.autonomyDefault] < AUTONOMY_ORDER[acc] ? w.autonomyDefault : acc,
    "supervised_agent",
  );
  const safestRank = AUTONOMY_ORDER[safestDefault];
  const autonomyConflict = buyerAutonomyRank > safestRank;

  // 6. Complexity distribution.
  const complexityCounts = {
    simple: selectedWorkflows.filter((w) => w.complexity === "simple").length,
    moderate: selectedWorkflows.filter((w) => w.complexity === "moderate").length,
    complex: selectedWorkflows.filter((w) => w.complexity === "complex").length,
  };

  // 7. Plain-English rationale.
  const rationale: string[] = [];
  if (effectiveDataSensitivity > dialledDataSensitivity) {
    rationale.push(
      `Effective data sensitivity raised from ${dialledDataSensitivity} → ${effectiveDataSensitivity} because the selected workflows touch ${
        touchesHighRegime ? "high-sensitivity regulatory regimes" : "regulated personal data"
      }${hitsSensitiveKeyword ? " and ingest sensitive data inputs" : ""}.`,
    );
  }
  if (effectiveReliabilityRequirement > 3) {
    rationale.push(
      `Reliability requirement set to ${effectiveReliabilityRequirement}/5 — driven by the strictest workflow in your selection${complexityBump > 0 ? " (complex execution adds reliability load)" : ""}.`,
    );
  }
  if (autonomyConflict) {
    rationale.push(
      `Autonomy mismatch: you chose ${dialledAutonomyAppetite.replace(/_/g, " ")}, but at least one workflow safely supports only ${safestDefault.replace(/_/g, " ")}. Treat the higher-autonomy assumption as a stretch goal.`,
    );
  }
  if (regulatoryRegimes.length > 0) {
    rationale.push(
      `Regulatory exposure across selection: ${regulatoryRegimes.join(", ")}. Vendors will be penalised when they lack E3+ evidence in ${requiredEvidenceDomains.map((d) => d.replace(/_/g, " ")).join(", ")}.`,
    );
  }
  if (dialledRiskTolerance >= 4 && effectiveReliabilityRequirement >= 4) {
    rationale.push(
      `High risk tolerance combined with high reliability needs is unusual. Confirm whether you actually intend to accept failures in regulated workflows before relying on this result.`,
    );
  }
  if (rationale.length === 0) {
    rationale.push("Workflow profile is consistent with dialled inputs — no overlay adjustments applied.");
  }

  return {
    selectedWorkflows,
    regulatoryRegimes,
    requiredEvidenceDomains,
    effectiveDataSensitivity,
    effectiveReliabilityRequirement,
    autonomyConflict,
    safestAutonomyDefault: safestDefault,
    complexityCounts,
    rationale,
  };
}

/* ─── Engine integration helpers ─────────────────────────────────── */

/**
 * Penalty applied when a vendor lacks E3+ evidence in a domain
 * required by the buyer's regulatory exposure. Per missing domain,
 * scaled by how strict the strictest regime is.
 *
 * The penalty deliberately stops short of being fatal — fatal
 * exclusions are still owned by IndustryProfile.fatalBlockerDomains.
 * This is a softer signal that says "vendor is plausible but you'll
 * carry residual compliance risk".
 */
export function regulatoryEvidenceGapPenalty<E extends { domain: DomainId; grade: string }>(
  evidence: E[],
  profile: WorkflowRiskProfile,
): { penalty: number; missingDomains: DomainId[] } {
  if (profile.requiredEvidenceDomains.length === 0) return { penalty: 0, missingDomains: [] };
  const missingDomains: DomainId[] = [];
  for (const d of profile.requiredEvidenceDomains) {
    const has = evidence.some(
      (e) => e.domain === d && (e.grade === "E3" || e.grade === "E4" || e.grade === "E5"),
    );
    if (!has) missingDomains.push(d);
  }
  // 4 points per missing domain, plus a 50% surcharge when 3+ regimes
  // are in play (compounding regulatory exposure).
  const PER_DOMAIN = 4;
  const compounding = profile.regulatoryRegimes.length >= 3 ? 1.5 : 1;
  return { penalty: missingDomains.length * PER_DOMAIN * compounding, missingDomains };
}

/**
 * Penalty applied when the buyer's autonomy appetite exceeds what the
 * selected workflows safely support. Small (3 pts) so it shows up in
 * the rank order without dominating it — the meaningful effect is the
 * reasoning string in the results UI.
 */
export function autonomyConflictPenalty(profile: WorkflowRiskProfile): number {
  return profile.autonomyConflict ? 3 : 0;
}

/** Convenience accessor — pulls just the domains the engine needs. */
export function workflowRequiredDomains(profile: WorkflowRiskProfile): DomainId[] {
  return profile.requiredEvidenceDomains;
}
