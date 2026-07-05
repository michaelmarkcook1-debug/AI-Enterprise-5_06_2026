// Phase 3 Assessment — category-aware DEFAULT domain weights (deterministic).
// ──────────────────────────────────────────────────────────────────────────
// The framework ships ONE tiered default weighting over the 12 assessment
// domains (DEFAULT_DOMAIN_WEIGHTS). That even-handed default is correct for a
// generic enterprise-AI buyer, but it is NOT correct for every market: a buyer
// choosing a FRONTIER MODEL API weights the model itself (quality, agentic
// capability), its unit economics, and its governance posture far more heavily
// than, say, capital resilience — and a generic-even split buries model quality
// at ~1/12 of the score.
//
// This module lets a category OVERRIDE the framework default with a principled,
// DOCUMENTED profile. Rules:
//   • The framework default (DEFAULT_DOMAIN_WEIGHTS) is the fallback for any
//     category without an explicit profile — nothing changes for them.
//   • A profile may ACTIVATE a category-scoped domain (e.g. model_quality) that
//     is absent from the framework default. Such a domain is scored, weighted,
//     and counted in coverage ONLY for categories whose profile includes it —
//     so coverage stays /12 everywhere except where the category genuinely adds
//     a 13th axis (the composite iterates the active set; see composite.ts).
//   • Weights are RAW (need not sum to 1) — normalizeWeights renormalizes them.
//   • These set CATEGORY weights by rationale, never vendor-targeting: apply the
//     weights and accept the resulting order.
//
// Pure data + pure helpers: no DB, no LLM, no mutation.

import { DEFAULT_DOMAIN_WEIGHTS, ASSESSMENT_COVERAGE_FLOOR, type DomainWeights } from "./composite";
import { DOMAIN_LABEL } from "./domain-labels";
import { ARENA_ELO_SOURCE_URL } from "../system/elo-fetch";
import { DEV_SENTIMENT_IN_RANKING } from "../availability";
import { isDevSentimentCategory } from "../dev-sentiment/scope";

export interface CategoryWeightProfile {
  /** Raw per-domain weights for this category (renormalized on use). May include
   *  category-scoped domains (model_quality) absent from the framework default. */
  weights: Partial<DomainWeights>;
  /** Plain-English WHY this category leans the way it does — surfaced verbatim in
   *  the public methodology note (transparent rubric design, not hidden tuning). */
  rationale: string;
}

// ── Per-category default profiles ────────────────────────────────────────────
// Add a category here to give it a bespoke default weighting. Everything else
// inherits the framework even-tiered default.
export const CATEGORY_DOMAIN_WEIGHTS: Record<string, CategoryWeightProfile> = {
  // FRONTIER MODEL API — the model is the product. Lead on model quality
  // (Arena human-preference Elo) + agentic capability; weight governance and
  // unit economics heavily (the real enterprise-adoption gates for a model API);
  // de-emphasise capital resilience (at the API layer a buyer can switch models,
  // so strategic dependency bites less than for a platform commitment). Sums to
  // 1.00 as written; renormalized on use regardless.
  frontier_model_api: {
    weights: {
      model_quality: 0.13, // NEW capability axis — the defining input for a model category
      governance_compliance: 0.12, // ↑ EU AI Act / auditability = the enterprise adoption gate
      agentic_autonomy: 0.10, // ↑ agentic capability is the live frontier of model differentiation
      data_security_privacy: 0.10, // near baseline (was .11) — data handling still central for APIs
      cost_finops: 0.09, // ↑ token economics / FinOps is decisive in model-API selection
      strategic_value: 0.08, // near baseline (.09)
      model_reliability: 0.07, // factuality/hallucination — distinct from raw quality, still core
      identity_access: 0.06, // near baseline (.09), compressed to fund the model-quality axis
      security_threat: 0.06, // near baseline (.08)
      integration_architecture: 0.06, // near baseline (.08)
      vendor_maturity_lockin: 0.05, // near baseline (.07)
      capital_resilience: 0.04, // ↓ de-emphasised at the API layer (kept non-trivial: frontier-lab
      //                            financial viability is still a real diligence item)
      workforce_adoption: 0.04, // ↓ least relevant to a raw model-API choice (a deployment concern)
    },
    rationale:
      "A frontier model API is judged first on the model itself, so model quality (Arena human-preference Elo) and agentic capability lead, with governance/auditability and unit economics (cost/TCO) weighted heavily as the real enterprise-adoption gates; capital resilience is de-emphasised because at the API layer a buyer can switch models more readily than they can replace a platform.",
  },

  // ── The remaining categories re-weight the SAME 12 framework domains (every
  //    domain key is present, so coverage stays /12 exactly as the framework
  //    default). model_quality stays frontier-only: the other categories are
  //    largely platforms/wrappers over third-party models, so a vendor-owned
  //    Arena score is not the right axis for them. Each profile is set by the
  //    category's job-to-be-done, never to move a vendor. Sums ≈ 1.00 (renormalized).

  // ENTERPRISE ASSISTANT — a people-facing assistant inside the work hub.
  enterprise_assistant: {
    weights: {
      data_security_privacy: 0.13, governance_compliance: 0.13, identity_access: 0.12,
      workforce_adoption: 0.12, integration_architecture: 0.11, security_threat: 0.09,
      strategic_value: 0.08, agentic_autonomy: 0.06, vendor_maturity_lockin: 0.06,
      model_reliability: 0.05, cost_finops: 0.03, capital_resilience: 0.02,
    },
    rationale:
      "An assistant embedded in productivity/work hubs lives or dies on how it handles corporate content — data security, governance/permissions over that content, and identity/access lead — and on whether people actually adopt it (workforce adoption) and how deeply it integrates with the work hub. Raw model quality is less central because these are platforms over (often third-party) models.",
  },

  // DEVELOPER / CODING AGENT — autonomous coding in the dev loop.
  developer_coding_agent: {
    weights: {
      agentic_autonomy: 0.14, integration_architecture: 0.13, model_reliability: 0.12,
      data_security_privacy: 0.12, security_threat: 0.10, governance_compliance: 0.09,
      identity_access: 0.08, strategic_value: 0.07, workforce_adoption: 0.06,
      cost_finops: 0.04, vendor_maturity_lockin: 0.03, capital_resilience: 0.02,
    },
    rationale:
      "A coding agent is judged on autonomous capability and the correctness/reliability of what it produces, on deep IDE/repo/CI integration, and on protecting source code (data security + supply-chain/secret-leakage threat). Broad corporate-platform concerns matter less than fit to the developer loop.",
  },

  // AGENT PLATFORM — build, govern, and operate agents.
  agent_platform: {
    weights: {
      agentic_autonomy: 0.16, governance_compliance: 0.13, integration_architecture: 0.12,
      security_threat: 0.11, identity_access: 0.11, data_security_privacy: 0.10,
      model_reliability: 0.07, strategic_value: 0.07, vendor_maturity_lockin: 0.06,
      cost_finops: 0.04, workforce_adoption: 0.02, capital_resilience: 0.01,
    },
    rationale:
      "An agent platform is judged on agentic capability plus the controls to run agents safely — governance/guardrails, agent identity and permissions, and the agent attack surface (security) — and on the tool/connector ecosystem (integration). The platform's job is safe, capable, well-integrated agents.",
  },

  // RAG / ENTERPRISE SEARCH — permission-aware retrieval over enterprise knowledge.
  rag_enterprise_search: {
    weights: {
      integration_architecture: 0.15, data_security_privacy: 0.15, identity_access: 0.13,
      governance_compliance: 0.11, model_reliability: 0.11, security_threat: 0.09,
      strategic_value: 0.06, agentic_autonomy: 0.06, vendor_maturity_lockin: 0.05,
      cost_finops: 0.04, workforce_adoption: 0.03, capital_resilience: 0.02,
    },
    rationale:
      "Enterprise search is won on the breadth of permission-aware connectors (integration), document-level access control (data security + identity), and grounded, faithful answers (model reliability). Retrieving the right content without leaking it across permission boundaries is the core job.",
  },

  // WORKFLOW AUTOMATION AI — reliable multi-step execution across systems.
  workflow_automation_ai: {
    weights: {
      integration_architecture: 0.15, agentic_autonomy: 0.14, governance_compliance: 0.12,
      data_security_privacy: 0.11, security_threat: 0.10, identity_access: 0.10,
      model_reliability: 0.09, strategic_value: 0.06, vendor_maturity_lockin: 0.05,
      cost_finops: 0.05, workforce_adoption: 0.02, capital_resilience: 0.01,
    },
    rationale:
      "Workflow automation is judged on reliable multi-step execution (agentic) wired into many systems (integration), with strong governance and security/identity over the actions it takes on the business's behalf. Misfires here have real operational blast radius.",
  },

  // CRM / CUSTOMER AI — sales, service, and customer experience.
  crm_customer_ai: {
    weights: {
      integration_architecture: 0.14, workforce_adoption: 0.12, data_security_privacy: 0.12,
      governance_compliance: 0.11, model_reliability: 0.10, agentic_autonomy: 0.09,
      identity_access: 0.09, strategic_value: 0.08, security_threat: 0.07,
      cost_finops: 0.04, vendor_maturity_lockin: 0.03, capital_resilience: 0.01,
    },
    rationale:
      "Customer/CRM AI succeeds on CRM and data integration, on frontline adoption, and on trustworthy customer-facing output (reliability + governance) over customer PII (data security). Fit to the revenue workflow and reliability matter more than raw model quality.",
  },

  // ITSM / HR / SERVICE AI — employee service automation.
  itsm_hr_service_ai: {
    weights: {
      integration_architecture: 0.14, identity_access: 0.12, data_security_privacy: 0.12,
      governance_compliance: 0.12, workforce_adoption: 0.11, security_threat: 0.09,
      model_reliability: 0.09, agentic_autonomy: 0.07, strategic_value: 0.06,
      cost_finops: 0.04, vendor_maturity_lockin: 0.03, capital_resilience: 0.01,
    },
    rationale:
      "Employee-service AI is won on deep ITSM/HR system integration, identity/entitlement awareness, protection and governance of employee data, and actual self-service adoption. It must act correctly inside sensitive employee processes.",
  },

  // CLOUD AI PLATFORM — build/deploy/secure/operate, a deep platform commitment.
  cloud_ai_platform: {
    weights: {
      integration_architecture: 0.13, security_threat: 0.12, governance_compliance: 0.12,
      data_security_privacy: 0.12, identity_access: 0.11, capital_resilience: 0.09,
      vendor_maturity_lockin: 0.09, cost_finops: 0.08, strategic_value: 0.06,
      model_reliability: 0.04, agentic_autonomy: 0.02, workforce_adoption: 0.02,
    },
    rationale:
      "A cloud AI platform is a deep, multi-year commitment, so security, governance, identity and integration lead, with capital resilience and vendor maturity/lock-in weighted up (you are betting on the platform's durability and your ability to exit) and total cost of ownership material.",
  },

  // REGULATED-INDUSTRY AI — legal, financial, healthcare, public sector.
  regulated_industry_ai: {
    weights: {
      governance_compliance: 0.19, data_security_privacy: 0.16, security_threat: 0.12,
      identity_access: 0.11, model_reliability: 0.10, integration_architecture: 0.08,
      strategic_value: 0.06, vendor_maturity_lockin: 0.05, agentic_autonomy: 0.04,
      cost_finops: 0.03, capital_resilience: 0.03, workforce_adoption: 0.03,
    },
    rationale:
      "In regulated verticals, regulatory compliance/governance and data protection (residency, PII/PHI) dominate, with security, identity, and factual reliability close behind because errors are safety- and liability-critical. Cost and adoption are secondary to defensibility.",
  },

  // AI SILICON / ACCELERATORS — a capital- and supply-concentration market.
  ai_silicon: {
    weights: {
      capital_resilience: 0.20, strategic_value: 0.16, vendor_maturity_lockin: 0.14,
      integration_architecture: 0.12, cost_finops: 0.12, security_threat: 0.06,
      governance_compliance: 0.05, model_reliability: 0.04, data_security_privacy: 0.04,
      identity_access: 0.03, agentic_autonomy: 0.02, workforce_adoption: 0.02,
    },
    rationale:
      "Silicon is a capital- and supply-concentration market: capital resilience (fab/capex durability), strategic supply position, ecosystem lock-in (e.g. toolchains), software-ecosystem integration, and performance-per-dollar dominate. The software-centric governance/identity domains apply only thinly here and are weighted down accordingly.",
  },

  // AI CLOUD & COMPUTE — hyperscaler / sovereign capacity.
  ai_cloud_compute: {
    weights: {
      capital_resilience: 0.16, integration_architecture: 0.13, security_threat: 0.12,
      data_security_privacy: 0.12, governance_compliance: 0.11, identity_access: 0.10,
      cost_finops: 0.09, vendor_maturity_lockin: 0.08, strategic_value: 0.05,
      model_reliability: 0.02, agentic_autonomy: 0.01, workforce_adoption: 0.01,
    },
    rationale:
      "Cloud compute is a durability-and-trust commitment: capital resilience (capacity buildout and balance sheet), security, data protection, governance, identity and integration lead, with total cost of ownership and lock-in material. Model/agentic domains barely apply to raw capacity.",
  },

  // NEOCLOUD & INFERENCE — AI-specialist GPU/inference clouds (often young, leveraged).
  neocloud_inference: {
    weights: {
      cost_finops: 0.16, capital_resilience: 0.15, integration_architecture: 0.12,
      vendor_maturity_lockin: 0.11, security_threat: 0.10, data_security_privacy: 0.10,
      identity_access: 0.08, governance_compliance: 0.06, strategic_value: 0.05,
      model_reliability: 0.03, agentic_autonomy: 0.02, workforce_adoption: 0.02,
    },
    rationale:
      "Neoclouds compete on price/performance (cost/TCO) and must prove capital durability (GPU financing is capital-intensive and often leveraged) and vendor maturity, since many are young; cost, capital resilience, integration depth and lock-in lead, with security and data protection close behind.",
  },
};

/**
 * The DEFAULT domain weights for a category: its bespoke profile if one exists,
 * otherwise the framework even-tiered default (the 12 domains). Returned RAW
 * (callers renormalize). This is the single resolver every ranking surface uses
 * so the static order and the interactive re-rank share one category default.
 */
/** The dev-sentiment ranking weight for coding categories — a SIGNIFICANT,
 *  co-leading variable, set by rationale and published, NEVER tuned per vendor
 *  (see the spec's zero-pay-to-play lock). Applied only when
 *  DEV_SENTIMENT_IN_RANKING is on. Owner-set 0.25 (2026-07-05, raised from 0.18):
 *  developer mindshare is a top-tier signal for coding/agent models. Added RAW to
 *  the category profile then renormalized, so its EFFECTIVE share is ~0.25/(1+0.25)
 *  ≈ 20% of the composite — strong but still a minority of the evidence domains. */
export const DEV_SENTIMENT_WEIGHT = 0.25;

export function resolveDomainWeights(categoryId: string): DomainWeights {
  const profile = CATEGORY_DOMAIN_WEIGHTS[categoryId];
  const base = profile ? (profile.weights as DomainWeights) : DEFAULT_DOMAIN_WEIGHTS;
  // Consumer #2 — blend developer sentiment into the CODING categories only,
  // gated behind DEV_SENTIMENT_IN_RANKING (off → the composite is unchanged).
  // Adding the key activates the synthesized dev_sentiment domain in BOTH the
  // static ranking and the interactive re-rank (both read this resolver), so
  // they stay identical by construction. Renormalized downstream.
  if (DEV_SENTIMENT_IN_RANKING && isDevSentimentCategory(categoryId)) {
    return { ...base, dev_sentiment: DEV_SENTIMENT_WEIGHT };
  }
  return base;
}

/** True when the category's profile is a bespoke override (not the framework default). */
export function categoryHasCustomWeights(categoryId: string): boolean {
  return !!CATEGORY_DOMAIN_WEIGHTS[categoryId];
}

/** True when the category activates the (category-scoped) model_quality domain. */
export function categoryActivatesModelQuality(categoryId: string): boolean {
  return (resolveDomainWeights(categoryId).model_quality ?? 0) > 0;
}

/** True when the category activates the (category-scoped) dev_sentiment domain —
 *  i.e. a coding category AND DEV_SENTIMENT_IN_RANKING is on. */
export function categoryActivatesDevSentiment(categoryId: string): boolean {
  return (resolveDomainWeights(categoryId).dev_sentiment ?? 0) > 0;
}

/** The category's documented rationale, or null when it uses the framework default. */
export function getCategoryWeightRationale(categoryId: string): string | null {
  return CATEGORY_DOMAIN_WEIGHTS[categoryId]?.rationale ?? null;
}

// ── Per-category methodology note (transparency) ─────────────────────────────

/** Generic methodology shared by every category (the deterministic mechanics). */
const GENERIC_METHODOLOGY =
  `Vendors are ranked within the category by a weighted composite (0–5) of the framework's ` +
  `evidence-graded assessment domains. Each domain's 0–5 score is capped by the strength of its ` +
  `evidence (you cannot reach the top bands without audit-grade proof), and a domain with ` +
  `insufficient evidence contributes zero while still counting toward coverage — so re-weighting ` +
  `can never conjure a score or hide thin evidence. A vendor must have at least ` +
  `${Math.round(ASSESSMENT_COVERAGE_FLOOR * 100)}% domain coverage to be ranked; below that it is ` +
  `held as "insufficient evidence", never floated on a default. When composites sit within the ` +
  `noise band the order is shown as tiers, not a false-precision 1–N list. Market share is context, ` +
  `not the rank.`;

/**
 * The public methodology note for a category — documents the per-category
 * weighting AND its rationale, then the shared mechanics. Deterministic string.
 */
export function buildMethodologyNote(categoryId: string): string {
  const weights = resolveDomainWeights(categoryId);
  const rationale = getCategoryWeightRationale(categoryId);

  // Sorted, percent-formatted active weighting (raw weights → percentages).
  const entries = Object.entries(weights).filter(([, w]) => (w ?? 0) > 0) as [string, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0) || 1;
  const ranked = [...entries].sort((a, b) => b[1] - a[1]);
  const weightList = ranked
    .map(([d, w]) => `${DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL] ?? d} ${Math.round((w / total) * 100)}%`)
    .join(", ");

  const header = rationale
    ? `Category-specific weighting (${entries.length} domains): ${weightList}. Why this weighting: ${rationale}`
    : `Framework default weighting (${entries.length} domains, evenly tiered): ${weightList}.`;

  const modelQualityNote = categoryActivatesModelQuality(categoryId)
    ? ` Model quality is a real, source-cited signal here: the top-2 average Arena human-preference Elo ` +
      `per vendor (${ARENA_ELO_SOURCE_URL}, LMArena methodology), graded E4 and band-capped — it is a ` +
      `capability proxy, not a factuality audit, and vendors with no Arena-ranked model show insufficient ` +
      `evidence on this domain rather than a default.`
    : "";

  // Public documentation of the dev-sentiment ranking variable (spec lock #1:
  // the weight is fixed by rationale + published — never tuned per vendor).
  const devSentimentNote = categoryActivatesDevSentiment(categoryId)
    ? ` Developer sentiment carries a fixed ${Math.round(DEV_SENTIMENT_WEIGHT * 100)}% weight in this ` +
      `coding category: what developers actually say, from official community sources (Hacker News, ` +
      `GitHub, the Stack Overflow Developer Survey${""}) — mapped to a 0–5 level by a fixed published ` +
      `table, coverage-gated (a model needs ≥2 independent sources over volume floors; a thin signal ` +
      `reads insufficient and is coverage-discounted, never scored on noise), and anti-gaming-floored. ` +
      `The weight is set by category rationale, never tuned to move a specific vendor.`
    : "";

  return `${header}${modelQualityNote}${devSentimentNote} ${GENERIC_METHODOLOGY}`;
}
