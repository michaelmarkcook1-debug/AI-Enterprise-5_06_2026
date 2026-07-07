// C2 — Framework-mapping / credibility layer (public Methodology crosswalk).
// ─────────────────────────────────────────────────────────────────────────────
// Maps each of the 12 assessment domains to the recognised external governance
// frameworks a CIO's risk / audit function knows: NIST AI RMF 1.0, ISO/IEC
// 42001:2023, and (where it CLEANLY applies) the EU AI Act. This is a POSITIONING
// artifact (C14): "aligned to / informed by" — NEVER certification, endorsement,
// or accreditation.
//
// ACCURACY DISCIPLINE (C2 hard guardrail — "accurate or absent"): every framework
// reference below is at the level verified against the primary source (NIST: the
// four functions + their categories; ISO: Annex A control objectives A.2–A.10;
// EU AI Act: the high-risk Article numbers). Finer precision (e.g. a specific
// subcategory or sub-control) is deliberately NOT asserted. The WHOLE crosswalk is
// surfaced as "indicative — pending analyst review" until an analyst who knows the
// frameworks signs off. Where a domain has no clean external mapping, we say so.
// Reads nothing, writes nothing — pure reference data.

import { ASSESSMENT_DOMAINS } from "@/lib/assessment/domain-rubric";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import type { DomainId } from "@/lib/types";

/** Primary sources — every mapping links back to one of these. */
export const FRAMEWORK_SOURCES = {
  nist: {
    name: "NIST AI RMF 1.0",
    full: "NIST AI 100-1 — Artificial Intelligence Risk Management Framework 1.0",
    // Functions verified against the NIST AI Resource Center Core page.
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    primaryUrl: "https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf",
  },
  iso: {
    name: "ISO/IEC 42001:2023",
    full: "ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system",
    url: "https://www.iso.org/standard/81230.html",
    primaryUrl: "https://www.iso.org/standard/81230.html",
  },
  euAiAct: {
    name: "EU AI Act",
    full: "Regulation (EU) 2024/1689 (Artificial Intelligence Act)",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    primaryUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
  },
} as const;

/** How clean the external mapping is — drives the honest label in the UI. */
export type MappingStrength = "solid" | "partial" | "gap";

export interface DomainCrosswalk {
  domain: DomainId;
  label: string;
  /** NIST AI RMF function/category references (verified to the category level). */
  nist: string[];
  /** ISO/IEC 42001 Annex A control-objective areas (A.2–A.10). */
  iso: string[];
  /** EU AI Act articles ONLY where they cleanly apply; empty otherwise. */
  euAiAct: string[];
  /** Plain-English "what this means for a CIO". */
  cioLine: string;
  /** Honest note — especially for partial mappings and gaps. */
  note: string;
  strength: MappingStrength;
}

// The crosswalk. Keyed by DomainId; ordered to match ASSESSMENT_DOMAINS below.
const CROSSWALK: Record<DomainId, Omit<DomainCrosswalk, "domain" | "label">> = {
  strategic_value: {
    nist: ["MAP 1 (context)", "MAP 3 (capabilities, benefits & costs vs benchmarks)"],
    iso: ["A.5 (AI system impact assessment)", "A.6 (AI system life cycle)"],
    euAiAct: [],
    cioLine: "Ties the purchase to defined outcomes and a benchmarked use-case portfolio before vendors are compared.",
    note: "Maps cleanly to the NIST MAP function; no specific EU AI Act obligation (use-case fit is a strategy question, not a regulatory one).",
    strength: "solid",
  },
  data_security_privacy: {
    nist: ["GOVERN 1 (policies)", "GOVERN 6 (third-party data)", "MANAGE 2 (impact mitigation)"],
    iso: ["A.7 (Data for AI systems)", "A.4 (Resources)"],
    euAiAct: ["Art. 10 (Data and data governance)"],
    cioLine: "Evidence that enterprise data is isolated, resident, retained and deletable — verifiable end-to-end, not asserted.",
    note: "Strong alignment across all three frameworks; EU AI Act Art. 10 governs data quality/governance for high-risk systems.",
    strength: "solid",
  },
  identity_access: {
    nist: ["GOVERN 2 (accountability)", "MANAGE 1 (prioritise & respond)"],
    iso: ["A.9 (Responsible use)", "A.3 (Internal organisation)"],
    euAiAct: [],
    cioLine: "Does retrieval respect source-system permissions? Prevents 'permission laundering' through a natural-language interface.",
    note: "Partial — fine-grained access control is governed by ISO/IEC 27001 (which ISO/IEC 42001 references), not 42001 itself; shown here as the nearest AIMS anchor.",
    strength: "partial",
  },
  model_reliability: {
    nist: ["MEASURE 1 (methods & metrics)", "MEASURE 2 (trustworthy characteristics)", "MEASURE 3 (tracking over time)"],
    iso: ["A.6 (AI system life cycle — verification & validation)"],
    euAiAct: ["Art. 15 (Accuracy, robustness and cybersecurity)"],
    cioLine: "Grounding, citations, uncertainty and gold-set accuracy testing — the controls that catch a confident wrong answer.",
    note: "Strong alignment; NIST MEASURE and EU AI Act Art. 15 both target accuracy/robustness of the system.",
    strength: "solid",
  },
  governance_compliance: {
    nist: ["GOVERN 1 (policies)", "GOVERN 4 (risk culture)", "MANAGE 4 (documentation & monitoring)"],
    iso: ["A.2 (AI policy)", "A.3 (Internal organisation)", "A.8 (Information for interested parties)"],
    euAiAct: ["Art. 9 (Risk management)", "Art. 12 (Record-keeping)", "Art. 17 (Quality management system)"],
    cioLine: "Can you reconstruct what the AI said, why, and who acted on it? The auditability an unauditable oracle can't provide.",
    note: "The core AI-management-system domain — the strongest, cleanest mapping across all three frameworks.",
    strength: "solid",
  },
  security_threat: {
    nist: ["MEASURE 2 (secure & resilient)", "MANAGE 1 (prioritise & respond)"],
    iso: ["A.6 (AI system life cycle)", "A.4 (Resources)"],
    euAiAct: ["Art. 15 (Cybersecurity)"],
    cioLine: "Prompt-injection, model-theft and supply-chain resilience — the AI-specific threat surface on top of standard security.",
    note: "Aligns to the security dimension of NIST MEASURE and EU AI Act Art. 15; deep infrastructure security also sits in ISO/IEC 27001.",
    strength: "solid",
  },
  integration_architecture: {
    nist: ["MAP 4 (components incl. third-party software & data)"],
    iso: ["A.6 (AI system life cycle)", "A.10 (Third-party relationships)"],
    euAiAct: [],
    cioLine: "Will AI embed into existing work and systems, or sit as another tab? Connectors, deployment model and exit paths.",
    note: "Partial — primarily an engineering-fit domain; only loosely governed externally (NIST MAP 4 covers mapping system components).",
    strength: "partial",
  },
  agentic_autonomy: {
    nist: ["MAP 2 (categorisation, incl. autonomy)", "MEASURE 2 (trustworthy)", "MANAGE 1 (respond)"],
    iso: ["A.6 (AI system life cycle)", "A.9 (Responsible use)"],
    euAiAct: ["Art. 14 (Human oversight)"],
    cioLine: "Kill-switch, action-logging, reversibility and approval workflows — the controls that scale autonomy safely.",
    note: "Clean alignment; EU AI Act Art. 14 (human oversight) is the direct regulatory anchor for autonomy controls.",
    strength: "solid",
  },
  cost_finops: {
    nist: ["MAP 3 (expected benefits and costs vs benchmarks)"],
    iso: ["A.4 (Resources)"],
    euAiAct: [],
    cioLine: "TCO, unit economics and FinOps controls — whether value is measurable and the bill is predictable at scale.",
    note: "Partial — largely a commercial domain; only NIST MAP 3 (costs vs benchmarks) touches it. No direct EU AI Act obligation.",
    strength: "partial",
  },
  workforce_adoption: {
    nist: ["GOVERN 2 (trained & accountable teams)", "GOVERN 4 (risk culture)"],
    iso: ["A.3 (Internal organisation)", "A.4 (Resources / competence)"],
    euAiAct: [],
    cioLine: "Change management and adoption — the org gaps (not tech limits) that kill two-thirds of AI initiatives.",
    note: "Aligns to the people/culture side of NIST GOVERN and ISO resourcing; no specific EU AI Act obligation.",
    strength: "solid",
  },
  vendor_maturity_lockin: {
    nist: ["GOVERN 6 (third-party & supply chain)", "MANAGE 3 (third-party risk)"],
    iso: ["A.10 (Third-party & customer relationships)"],
    euAiAct: ["Art. 53 (GPAI provider obligations)"],
    cioLine: "Vendor viability, portability and a real exit path — how hard is it to leave, and what happens if they don't last?",
    note: "Clean third-party/supply-chain alignment; EU AI Act Art. 53 applies to general-purpose-model provider obligations.",
    strength: "solid",
  },
  capital_resilience: {
    nist: [],
    iso: [],
    euAiAct: [],
    cioLine: "Runway, funding concentration and strategic dependency — will the vendor still be standing in three years?",
    note: "Honest gap — no clean NIST AI RMF or ISO/IEC 42001 equivalent. This is a commercial-viability domain we add; it loosely relates to third-party/supply-chain concerns (NIST GOVERN 6 / ISO A.10) but is not itself a governance-framework control.",
    strength: "gap",
  },
  // Category-scoped domains — not part of the 13 framework domains, so no crosswalk row.
  model_quality: { nist: [], iso: [], euAiAct: [], cioLine: "", note: "", strength: "gap" },
  market_position: { nist: [], iso: [], euAiAct: [], cioLine: "", note: "", strength: "gap" },
  dev_sentiment: { nist: [], iso: [], euAiAct: [], cioLine: "", note: "", strength: "gap" },
  // sovereignty_residency IS a full framework domain (2026-07-08), but honestly
  // has no clean mapping into NIST/ISO/EU-AI-Act specifically — the frameworks
  // that actually govern cross-border data transfer and compelled-disclosure
  // exposure (GDPR Ch. V, sector export-control regimes) sit outside this
  // three-framework crosswalk. Accurate-or-absent: left a gap rather than
  // stretching an EU AI Act/ISO/NIST clause to cover it.
  sovereignty_residency: {
    nist: [],
    iso: [],
    euAiAct: [],
    cioLine: "Evidence of jurisdiction, compelled-disclosure exposure and sovereign-hosting options — not covered by NIST/ISO/EU AI Act; see GDPR Ch. V and export-control regimes separately.",
    note: "Real, cited domain (see the assessment scorecard) — this crosswalk's three frameworks don't cleanly cover it.",
    strength: "gap",
  },
};

/** The full crosswalk over the 12 framework domains, in canonical order. */
export function getFrameworkCrosswalk(): DomainCrosswalk[] {
  return ASSESSMENT_DOMAINS.map((domain) => ({
    domain,
    label: DOMAIN_LABEL[domain],
    ...CROSSWALK[domain],
  }));
}

/**
 * Whole-crosswalk posture: this is a positioning draft, surfaced as indicative
 * until an analyst signs off. The UI must render this prominently.
 */
export const CROSSWALK_STATUS =
  "indicative — pending analyst review" as const;
