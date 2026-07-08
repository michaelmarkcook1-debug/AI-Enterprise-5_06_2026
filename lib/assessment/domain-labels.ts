// Human-readable names for the 12 framework assessment domains. Kept out of
// lib/types.ts so the core type module stays dependency-free. Names follow the
// Enterprise AI Assessment Framework v2 domain titles.
import type { DomainId } from "../types";

export const DOMAIN_LABEL: Record<DomainId, string> = {
  strategic_value: "Strategic Value & Use-Case Fit",
  data_security_privacy: "Data Security, Privacy & Retention",
  identity_access: "Identity, Permissioning & Access Control",
  model_reliability: "Model Reliability, Factuality & Hallucination",
  model_quality: "Model Quality (Artificial Analysis)",
  governance_compliance: "Governance, Compliance & Auditability",
  security_threat: "Security Architecture & Threat Resilience",
  integration_architecture: "Integration & Architecture Fit",
  agentic_autonomy: "Agentic Capability & Autonomy Controls",
  cost_finops: "Cost, TCO & FinOps",
  workforce_adoption: "Workforce Adoption & Change Management",
  vendor_maturity_lockin: "Vendor Maturity, Lock-In & Exit",
  capital_resilience: "Capital Resilience & Strategic Dependency",
  market_position: "Market Position",
  dev_sentiment: "Developer Sentiment (HN · GitHub · SO survey)",
};
