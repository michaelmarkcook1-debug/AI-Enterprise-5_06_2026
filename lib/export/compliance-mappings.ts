// Spec §20: clause-level EU/ISO/NIST mappings retained for export mode.
// These are deliberately conservative public-domain crosswalks per backend domain.

import type { DomainId } from "../types";

interface DomainCrosswalk {
  domain: DomainId;
  euAiAct: string[];
  iso27001: string[];
  nistAiRmf: string[];
  iso42001: string[];
}

export const DOMAIN_CROSSWALK: Record<DomainId, DomainCrosswalk> = {
  strategic_value: {
    domain: "strategic_value",
    euAiAct: [],
    iso27001: [],
    nistAiRmf: ["GOVERN 1.1", "MAP 1.1"],
    iso42001: ["6.1.2"],
  },
  data_security_privacy: {
    domain: "data_security_privacy",
    euAiAct: ["Art 10 (data and data governance)"],
    iso27001: ["A.5.34", "A.8.10", "A.8.11", "A.8.12"],
    nistAiRmf: ["MAP 2.3", "MEASURE 2.10"],
    iso42001: ["7.4", "8.3"],
  },
  identity_access: {
    domain: "identity_access",
    euAiAct: ["Art 14 (human oversight)"],
    iso27001: ["A.5.15", "A.5.16", "A.5.17", "A.5.18", "A.8.2", "A.8.3"],
    nistAiRmf: ["MANAGE 2.3"],
    iso42001: ["8.4"],
  },
  model_reliability: {
    domain: "model_reliability",
    euAiAct: ["Art 15 (accuracy, robustness, cybersecurity)"],
    iso27001: ["A.8.29"],
    nistAiRmf: ["MEASURE 2.3", "MEASURE 2.6", "MEASURE 2.9"],
    iso42001: ["8.2", "9.1"],
  },
  model_quality: {
    // Capability/benchmark performance (Arena human-preference Elo). Maps to the
    // accuracy/performance-measurement clauses, not the governance clauses.
    domain: "model_quality",
    euAiAct: ["Art 15 (accuracy)"],
    iso27001: [],
    nistAiRmf: ["MEASURE 2.3"],
    iso42001: ["8.2", "9.1"],
  },
  governance_compliance: {
    domain: "governance_compliance",
    euAiAct: ["Art 9 (risk management)", "Art 11 (technical documentation)", "Art 12 (record-keeping)", "Art 13 (transparency)"],
    iso27001: ["A.5.1", "A.5.31", "A.5.36"],
    nistAiRmf: ["GOVERN 1", "GOVERN 4", "MANAGE 4"],
    iso42001: ["5.2", "6.1", "9.3"],
  },
  security_threat: {
    domain: "security_threat",
    euAiAct: ["Art 15 (cybersecurity)"],
    iso27001: ["A.5.7", "A.5.30", "A.8.7", "A.8.16", "A.8.23"],
    nistAiRmf: ["MEASURE 2.7"],
    iso42001: ["8.4"],
  },
  integration_architecture: {
    domain: "integration_architecture",
    euAiAct: [],
    iso27001: ["A.8.25", "A.8.27"],
    nistAiRmf: ["MAP 4.1", "MANAGE 1"],
    iso42001: ["7.5"],
  },
  agentic_autonomy: {
    domain: "agentic_autonomy",
    euAiAct: ["Art 14 (human oversight)"],
    iso27001: ["A.5.31"],
    nistAiRmf: ["GOVERN 6.1", "MANAGE 2.1", "MANAGE 4.1"],
    iso42001: ["8.5"],
  },
  cost_finops: {
    domain: "cost_finops",
    euAiAct: [],
    iso27001: [],
    nistAiRmf: ["GOVERN 1.4"],
    iso42001: ["7.1"],
  },
  workforce_adoption: {
    domain: "workforce_adoption",
    euAiAct: ["Art 4 (AI literacy)"],
    iso27001: ["A.6.3"],
    nistAiRmf: ["GOVERN 3.2"],
    iso42001: ["7.2", "7.3"],
  },
  vendor_maturity_lockin: {
    domain: "vendor_maturity_lockin",
    euAiAct: ["Art 25 (responsibilities along the value chain)"],
    iso27001: ["A.5.19", "A.5.20", "A.5.21", "A.5.22"],
    nistAiRmf: ["MAP 4.1"],
    iso42001: ["8.6"],
  },
  capital_resilience: {
    domain: "capital_resilience",
    euAiAct: [],
    iso27001: ["A.5.29"],
    nistAiRmf: ["GOVERN 6.1"],
    iso42001: ["8.6"],
  },
  market_position: {
    domain: "market_position",
    euAiAct: [],
    iso27001: [],
    nistAiRmf: [],
    iso42001: [],
  },
  dev_sentiment: {
    domain: "dev_sentiment",
    euAiAct: [],
    iso27001: [],
    nistAiRmf: [],
    iso42001: [],
  },
};
