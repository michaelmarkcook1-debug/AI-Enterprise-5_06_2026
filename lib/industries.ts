// 8 industry archetypes (spec §10) + adoption profiles (spec §11)

import type { IndustryProfile, PillarId } from "./types";

const w = (
  business: number,
  control: number,
  reliability: number,
  ops: number,
  resilience: number,
  market: number,
): Record<PillarId, number> => ({
  business_fit: business / 100,
  enterprise_control: control / 100,
  reliability_safety: reliability / 100,
  integration_ops: ops / 100,
  vendor_resilience: resilience / 100,
  market_strength: market / 100,
});

export const INDUSTRIES: Record<string, IndustryProfile> = {
  regulated_financial: {
    id: "regulated_financial",
    name: "Regulated Financial Enterprise",
    weights: w(10, 35, 20, 10, 15, 10),
    fatalBlockerDomains: [
      "data_security_privacy",
      "identity_access",
      "governance_compliance",
      "vendor_maturity_lockin",
    ],
    evidenceStrictness: 1.2,
    adoption: { experimentationPct: 78, regularUsePct: 55, productionPct: 32, scaledPct: 14, agenticExperimentationPct: 42, agenticScaledPct: 6 },
  },
  health_life_sciences: {
    id: "health_life_sciences",
    name: "Health & Life Sciences",
    weights: w(10, 30, 25, 10, 15, 10),
    fatalBlockerDomains: ["data_security_privacy", "model_reliability", "governance_compliance"],
    evidenceStrictness: 1.25,
    adoption: { experimentationPct: 70, regularUsePct: 45, productionPct: 24, scaledPct: 9, agenticExperimentationPct: 30, agenticScaledPct: 3 },
  },
  legal_professional: {
    id: "legal_professional",
    name: "Legal & Professional Advisory",
    weights: w(15, 30, 20, 10, 10, 15),
    fatalBlockerDomains: ["model_reliability", "identity_access", "data_security_privacy"],
    evidenceStrictness: 1.15,
    adoption: { experimentationPct: 82, regularUsePct: 58, productionPct: 28, scaledPct: 11, agenticExperimentationPct: 35, agenticScaledPct: 4 },
  },
  public_sector_education: {
    id: "public_sector_education",
    name: "Public Sector & Education",
    weights: w(10, 35, 15, 10, 15, 15),
    fatalBlockerDomains: ["data_security_privacy", "governance_compliance", "vendor_maturity_lockin"],
    evidenceStrictness: 1.2,
    adoption: { experimentationPct: 65, regularUsePct: 38, productionPct: 18, scaledPct: 6, agenticExperimentationPct: 22, agenticScaledPct: 2 },
  },
  critical_infrastructure_defence: {
    id: "critical_infrastructure_defence",
    name: "Critical Infrastructure & Defence",
    weights: w(5, 40, 20, 10, 20, 5),
    fatalBlockerDomains: [
      "data_security_privacy",
      "capital_resilience",
      "vendor_maturity_lockin",
      "security_threat",
    ],
    evidenceStrictness: 1.35,
    adoption: { experimentationPct: 60, regularUsePct: 30, productionPct: 14, scaledPct: 4, agenticExperimentationPct: 18, agenticScaledPct: 1 },
  },
  enterprise_software: {
    id: "enterprise_software",
    name: "Enterprise Software & Digital Product",
    weights: w(20, 15, 15, 20, 10, 20),
    fatalBlockerDomains: ["integration_architecture", "vendor_maturity_lockin"],
    evidenceStrictness: 1.0,
    adoption: { experimentationPct: 92, regularUsePct: 78, productionPct: 55, scaledPct: 32, agenticExperimentationPct: 60, agenticScaledPct: 18 },
  },
  industrial_physical_ops: {
    id: "industrial_physical_ops",
    name: "Industrial & Physical Operations",
    weights: w(15, 25, 20, 20, 15, 5),
    fatalBlockerDomains: ["model_reliability", "integration_architecture"],
    evidenceStrictness: 1.1,
    adoption: { experimentationPct: 68, regularUsePct: 40, productionPct: 20, scaledPct: 7, agenticExperimentationPct: 24, agenticScaledPct: 3 },
  },
  commercial_enterprise: {
    id: "commercial_enterprise",
    name: "Commercial Enterprise",
    weights: w(20, 20, 15, 15, 10, 20),
    fatalBlockerDomains: ["data_security_privacy", "cost_finops"],
    evidenceStrictness: 1.0,
    adoption: { experimentationPct: 85, regularUsePct: 62, productionPct: 38, scaledPct: 18, agenticExperimentationPct: 45, agenticScaledPct: 8 },
  },
};

export function getIndustry(id: string): IndustryProfile {
  const p = INDUSTRIES[id];
  if (!p) throw new Error(`Unknown industry: ${id}`);
  return p;
}

// Spec §11: Industry Maturity Modifier
export function industryMaturityScore(p: IndustryProfile): number {
  const a = p.adoption;
  return 0.25 * a.regularUsePct + 0.35 * a.productionPct + 0.4 * a.scaledPct;
}

export function adoptionMaturityBand(score: number): "nascent" | "emerging" | "developing" | "mainstream" | "advanced" {
  if (score <= 20) return "nascent";
  if (score <= 40) return "emerging";
  if (score <= 60) return "developing";
  if (score <= 80) return "mainstream";
  return "advanced";
}
