// Score methodology definitions — Pack 03.
// ──────────────────────────────────────────
// Every score in the platform has a formal methodology definition
// so it can be audited, explained, and included in board packs.

export interface ScoreMethodology {
  id: string;
  name: string;
  description: string;
  formula: string;
  inputs: { variable: string; weight: number; source: string }[];
  evidenceRequirements: string;
  freshnessRequirements: string;
  confidenceCalculation: string;
  missingDataBehaviour: string;
  penaltyRules: string[];
  version: string;
}

export const SCORE_METHODOLOGIES: ScoreMethodology[] = [
  {
    id: "vendor_overall",
    name: "Vendor Overall Score",
    description: "Composite score across six pillars weighted by industry context, evidence confidence, and risk penalties.",
    formula: "Σ(Pillar Score × Dynamic Weight × Evidence Confidence) + Strategic Fit + Sector Adoption − Risk Penalties − Missing Evidence − Adoption Friction",
    inputs: [
      { variable: "Business Fit", weight: 0.15, source: "Pillar evidence" },
      { variable: "Enterprise Control", weight: 0.25, source: "Pillar evidence" },
      { variable: "Reliability & Safety", weight: 0.15, source: "Pillar evidence" },
      { variable: "Integration & Ops", weight: 0.15, source: "Pillar evidence" },
      { variable: "Vendor Resilience", weight: 0.15, source: "Pillar evidence" },
      { variable: "Market Strength", weight: 0.15, source: "Pillar evidence" },
    ],
    evidenceRequirements: "Each pillar requires at least E2 evidence for documented status. E3+ for verified.",
    freshnessRequirements: "Evidence older than 180 days receives a 0.5× staleness penalty.",
    confidenceCalculation: "Blend of evidence grade multiplier × freshness multiplier × source reliability.",
    missingDataBehaviour: "Missing pillars contribute zero score with proportional penalty applied.",
    penaltyRules: ["Fatal blockers exclude vendors", "Severe risks apply scaled penalties", "Missing E3+ in industry-critical domains triggers severe risk"],
    version: "v1.2.0",
  },
  {
    id: "strategic_sustainability",
    name: "Strategic Sustainability Score",
    description: "Likelihood the vendor's current advantage remains defensible over 6–24 months.",
    formula: "Moat × 25% + Encroachment Defence × 25% + Dependency Resilience × 20% + Proprietary Data × 15% + Switching Cost × 10% + Ecosystem × 5%",
    inputs: [
      { variable: "Moat Strength", weight: 0.25, source: "Overall score + market position" },
      { variable: "Platform Encroachment Defence", weight: 0.25, source: "Category analysis" },
      { variable: "Dependency Resilience", weight: 0.20, source: "Ecosystem navigator" },
      { variable: "Proprietary Data Advantage", weight: 0.15, source: "Capability evidence" },
      { variable: "Switching Cost", weight: 0.10, source: "Integration depth" },
      { variable: "Ecosystem Strength", weight: 0.05, source: "Partnership data" },
    ],
    evidenceRequirements: "E2+ for documented; most inputs are currently estimated from seed data.",
    freshnessRequirements: "Vendor category and market position data within 90 days.",
    confidenceCalculation: "Average of input confidences, penalised for seed-only sources.",
    missingDataBehaviour: "Missing inputs treated as 'unknown' with explicit flag, not silently zeroed.",
    penaltyRules: ["Single-model dependency subtracts 15pts", "Low evidence confidence subtracts 10pts", "Thin workflow differentiation subtracts 8pts"],
    version: "v1.0.0",
  },
  {
    id: "cio_confidence",
    name: "CIO Confidence Score",
    description: "Composite showing whether a CIO can reasonably defend the decision.",
    formula: "Business Case × 20% + Urgency × 10% + Architecture × 10% + Vendor Selection × 15% + Risk Exposure × 15% + Risk Mitigation × 10% + Value Realisation × 10% + Strategic Sustainability × 10%",
    inputs: [
      { variable: "Business Case", weight: 0.20, source: "Assessment outputs" },
      { variable: "Urgency / Cost of Inaction", weight: 0.10, source: "Market signals" },
      { variable: "Architecture Rationale", weight: 0.10, source: "Assessment" },
      { variable: "Vendor Selection", weight: 0.15, source: "Pillar scores" },
      { variable: "Risk Exposure", weight: 0.15, source: "Risk register" },
      { variable: "Risk Mitigation", weight: 0.10, source: "Control mapping" },
      { variable: "Value Realisation", weight: 0.10, source: "KPI targets" },
      { variable: "Strategic Sustainability", weight: 0.10, source: "Sustainability score" },
    ],
    evidenceRequirements: "Minimum E2 across vendor selection and risk. Business case can be E1 (claim).",
    freshnessRequirements: "All inputs within 90 days for board-grade output.",
    confidenceCalculation: "Weighted average of input scores × vendor quality × evidence confidence × momentum.",
    missingDataBehaviour: "Incomplete dimensions reduce the overall score rather than hiding the gap.",
    penaltyRules: ["Missing risk register reduces score by 15%", "No competitor benchmark reduces by 10%"],
    version: "v1.0.0",
  },
  {
    id: "board_defence",
    name: "Board Defence Score",
    description: "Measures how complete and defensible the board case is.",
    formula: "Business Case × 20% + Risk Register × 15% + Vendor Evidence × 15% + Competitor Benchmark × 10% + Reputation Evidence × 10% + Cost Model × 10% + Assumption Monitoring × 10% + KPI Quality × 10%",
    inputs: [
      { variable: "Business Case Completeness", weight: 0.20, source: "Demonstrate" },
      { variable: "Risk Register Completeness", weight: 0.15, source: "Demonstrate" },
      { variable: "Vendor Evidence Depth", weight: 0.15, source: "Pillar scores" },
      { variable: "Competitor Benchmark Availability", weight: 0.10, source: "Uptake data" },
      { variable: "Reputation Evidence", weight: 0.10, source: "Reputation tracker" },
      { variable: "Cost Model Completeness", weight: 0.10, source: "Pricing data" },
      { variable: "Assumption Monitoring Coverage", weight: 0.10, source: "Monitor" },
      { variable: "KPI Quality", weight: 0.10, source: "Value realisation" },
    ],
    evidenceRequirements: "Each dimension is binary (present/absent) for the MVP; depth scoring in v2.",
    freshnessRequirements: "All inputs should be refreshed before board presentation.",
    confidenceCalculation: "Count of dimensions present ÷ total dimensions × 100.",
    missingDataBehaviour: "Missing dimensions visibly reduce the score and are listed as gaps.",
    penaltyRules: ["No shortlist = 0", "No risk register = -15%", "No reputation evidence = -10%"],
    version: "v1.0.0",
  },
];

/** Look up a methodology by score ID. */
export function getMethodology(id: string): ScoreMethodology | undefined {
  return SCORE_METHODOLOGIES.find((m) => m.id === id);
}
