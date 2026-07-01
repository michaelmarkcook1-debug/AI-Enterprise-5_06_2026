// Phase 3 Assessment — Wave 4 (C9): vendor-meeting prep kit (pure assembler).
// ─────────────────────────────────────────────────────────────────────────────
// Turns a vendor's real scorecard (optionally the W3 context-adjusted SessionLens)
// into a take-into-the-meeting kit: 8–12 tailored questions grounded in that
// vendor's weak / low-confidence / insufficient domains, plus deterministic,
// framework-grounded template sections (RFP requirements, POC success + exit
// criteria, reference-check bank, pilot-to-production readiness).
//
// FIREWALL / HONESTY: PURE — no LLM, no DB, no mutation. It reads DomainScore[]
// (canonical scores) and never alters them; it produces QUESTIONS and generic
// procurement scaffolding, never a vendor fact or a score. Where a domain is
// insufficient-evidence it becomes an honest "ask them to demonstrate X", never a
// fabricated claim. The static sections are framework-derived best practice, the
// SAME for every vendor (no vendor-specific claims to get wrong). The tailored
// questions come from lib/agents/prep-kit.ts (the LLM step), grounded in the real
// weak/thin domains this module derives. The score-writer firewall test pins this
// module read-only.

import { type DomainScore } from "./domain-rubric";
import { DOMAIN_LABEL } from "./domain-labels";
import { THIN_SCORE } from "./session-lens";
import type { VendorScorecard } from "./domain-scores";
import type { DomainId } from "../types";

/** One meeting question — the LLM tailored part, grounded in a real domain. */
export interface KitQuestion {
  /** The domain this question probes (null for a general/cross-cutting question). */
  domain: DomainId | null;
  /** Why it matters — ties to the real scorecard state (weak / thin / insufficient). */
  rationale: string;
  question: string;
  /** True when the domain is insufficient-evidence → framed as "ask them to demonstrate". */
  askTheVendor: boolean;
}

export interface KitSection {
  title: string;
  blurb: string;
  items: string[];
}

/** Which domains a vendor is weak / thin / insufficient on — the real gaps the kit targets. */
export interface KitTargets {
  /** Scored but weak: score ≤ thin band OR low-confidence. */
  weak: DomainId[];
  /** No reviewed evidence — the honest "ask them" set. */
  insufficient: DomainId[];
  /** True when derived from a W3 context-adjusted SessionLens (buyer's lens), not the base scorecard. */
  contextAdjusted: boolean;
}

export interface PrepKit {
  vendorId: string;
  vendorName: string;
  targets: KitTargets;
  scoredCount: number;
  insufficientCount: number;
  /** 8–12 tailored questions grounded in the vendor's real weak/thin domains. */
  questions: KitQuestion[];
  rfp: KitSection;
  poc: KitSection;
  referenceBank: KitSection;
  readiness: KitSection;
  /** Draft framing (C4) — a kit to pressure-test in the meeting, not a verdict. */
  draftNote: string;
  /** "stub" when the LLM was unavailable (deterministic fallback questions used). */
  source: "anthropic" | "stub";
}

/**
 * Derive the vendor's real weak / thin / insufficient domains. Prefers the W3
 * context-adjusted decisive-and-thin set when a SessionLens vendor entry is
 * supplied; otherwise reads the base scorecard directly. Pure; reads only.
 */
export function deriveKitTargets(
  scorecard: VendorScorecard,
  contextWeakDomains?: DomainId[],
): KitTargets {
  const insufficient = scorecard.domains
    .filter((d) => d.state === "insufficient_evidence")
    .map((d) => d.domain);

  if (contextWeakDomains && contextWeakDomains.length > 0) {
    // W3 already computed decisive-and-thin domains under the buyer's lens.
    const insufficientSet = new Set(insufficient);
    return {
      weak: contextWeakDomains.filter((d) => !insufficientSet.has(d)),
      insufficient: contextWeakDomains.filter((d) => insufficientSet.has(d)),
      contextAdjusted: true,
    };
  }

  const weak = scorecard.domains
    .filter((d): d is Extract<DomainScore, { state: "scored" }> => d.state === "scored")
    .filter((d) => d.score <= THIN_SCORE || d.lowConfidence)
    .map((d) => d.domain);

  return { weak, insufficient, contextAdjusted: false };
}

/** A compact, read-only view of a domain the LLM cites when writing questions. */
export interface DomainDigest {
  domain: DomainId;
  label: string;
  state: "scored" | "insufficient_evidence";
  score: number | null;
  lowConfidence: boolean;
  weak: boolean;
}

/** Build the per-domain digest the question generator grounds its questions in. */
export function buildDomainDigest(scorecard: VendorScorecard, targets: KitTargets): DomainDigest[] {
  const weakSet = new Set<DomainId>([...targets.weak, ...targets.insufficient]);
  return scorecard.domains.map((d) => ({
    domain: d.domain,
    label: DOMAIN_LABEL[d.domain],
    state: d.state,
    score: d.state === "scored" ? d.score : null,
    lowConfidence: d.state === "scored" ? d.lowConfidence : false,
    weak: weakSet.has(d.domain),
  }));
}

// ── Deterministic, framework-grounded template sections ──────────────────────
// The SAME for every vendor (generic procurement scaffolding derived from the
// 12-domain framework) — no vendor-specific claims, so nothing to fabricate.

const RFP: KitSection = {
  title: "RFP / requirements template",
  blurb: "Drop these into your RFP. Each line is a requirement the framework's evidence test maps to — make the vendor evidence it, don't take the claim.",
  items: [
    "Data security: contractually-provable exclusion of our data from training; data-residency options for required jurisdictions; configurable retention with verifiable deletion; a complete subprocessor list with data roles.",
    "Identity & access: SSO/SAML + SCIM provisioning; retrieval that respects source-system permissions (M365 / Google / Slack / CRM); per-user audit trail of prompts and outputs.",
    "Model reliability: answers grounded in approved sources with citations; the model can say \"I don't know\"; model-version pinning; a repeatable gold-set accuracy test.",
    "Governance & audit: immutable, exportable log of prompts, outputs and actions; policy controls; support for our compliance regime (name it).",
    "Security: prompt-injection / model-theft defenses; a recent third-party pen-test; SOC 2 Type II and/or ISO 27001.",
    "Integration & exit: native connectors for our stack; deployment model (SaaS / VPC / on-prem); documented data-portability and exit path.",
    "Agentic controls: kill-switch, action-logging, human-approval workflows, and reversibility for any autonomous action.",
    "Cost & FinOps: transparent unit economics, usage caps and alerts, and a TCO model at our expected volume.",
    "Workforce & change: onboarding, admin tooling, and adoption support for non-technical users.",
    "Vendor & commercial: viability (funding / profitability), roadmap commitments in writing, and contractual portability / exit terms.",
  ],
};

const POC: KitSection = {
  title: "POC success + exit criteria",
  blurb: "Agree these BEFORE the pilot so \"success\" isn't decided after the fact. Two-thirds of AI initiatives die in pilot-purgatory — measurable gates are the antidote.",
  items: [
    "Workflow value: run 5 real workflows (meeting prep, internal knowledge retrieval, account briefing, document analysis, action prep) — at least 3 must show a measurable time or quality gain.",
    "Accuracy: build a 100–300 question gold set from internal docs; score accuracy, citation quality, and refusal rate on unanswerable questions. Agree a pass threshold up front.",
    "Permissions: create 3 test users (junior / manager / exec) and ask the same restricted questions — nobody may receive content they can't access in the source system.",
    "Reliability: measure the hallucination / unsupported-answer rate in material workflows; agree the ceiling.",
    "Integration: validate the connectors and auth (SSO/SCIM) that production will depend on — not a demo tenant.",
    "Exit criteria (kill the pilot if): a permission leak; unsupported answers above the agreed ceiling; a blocking integration or data-residency gap; or no credible ROI path within 90 days.",
  ],
};

const REFERENCE_BANK: KitSection = {
  title: "Reference-check question bank",
  blurb: "Ask 2–3 references at similar scale and, ideally, in your industry. Push past the happy-path demo.",
  items: [
    "What was the actual time-to-value — first real production use, not the pilot?",
    "What surprised you most after signature that you couldn't see in the sales process?",
    "What broke or underperformed in production, and how fast did the vendor respond?",
    "How real is the permission / data-isolation story once you connected your live systems?",
    "What did rollout cost in internal effort (integration, change management) beyond the license?",
    "Knowing what you know now, would you buy again — and what would you do differently?",
  ],
};

const READINESS: KitSection = {
  title: "Pilot-to-production readiness checklist",
  blurb: "The work POCs skip. Walk this before you scale — integration, security, and governance are where pilots that \"worked\" fall over in production.",
  items: [
    "Integration: production connectors validated; SSO + SCIM live; data flows mapped end-to-end (input → processing → storage → deletion).",
    "Security: third-party pen-test reviewed; DLP / redaction in place; encryption in transit + at rest verified; an incident-response path.",
    "Governance: audit logging on and exportable; retention configured and deletion verified; model versions pinned; human-oversight and approval workflows defined for any autonomous action.",
    "Reliability: a standing gold-set eval that runs on model/version changes; a regression alert.",
    "Operations: cost monitoring + usage caps; a rollback plan; support SLA and escalation path in the contract.",
    "People: admin owners named; end-user onboarding and a feedback loop; a named internal owner for the assessment's weak domains.",
  ],
};

export function buildStaticSections(): { rfp: KitSection; poc: KitSection; referenceBank: KitSection; readiness: KitSection } {
  return { rfp: RFP, poc: POC, referenceBank: REFERENCE_BANK, readiness: READINESS };
}

/** Assemble the full kit from the derived targets + the (LLM or stub) questions. Pure. */
export function assemblePrepKit(args: {
  vendorId: string;
  vendorName: string;
  scorecard: VendorScorecard;
  targets: KitTargets;
  questions: KitQuestion[];
  source: "anthropic" | "stub";
}): PrepKit {
  const { rfp, poc, referenceBank, readiness } = buildStaticSections();
  return {
    vendorId: args.vendorId,
    vendorName: args.vendorName,
    targets: args.targets,
    scoredCount: args.scorecard.scoredCount,
    insufficientCount: args.scorecard.insufficientCount,
    questions: args.questions,
    rfp,
    poc,
    referenceBank,
    readiness,
    draftNote:
      "Draft kit to take into the meeting — questions and templates grounded in this vendor's reviewed evidence and the 12-domain framework. It probes gaps; it does not assert vendor facts. Pressure-test it against what they show you.",
    source: args.source,
  };
}

/**
 * Deterministic fallback questions when the LLM is unavailable — one honest
 * question per weak/insufficient domain, grounded in the real state (never a
 * fabricated claim). Guarantees the kit is useful offline / on key failure.
 */
export function fallbackQuestions(targets: KitTargets): KitQuestion[] {
  const q: KitQuestion[] = [];
  for (const domain of targets.insufficient) {
    q.push({
      domain,
      rationale: `No reviewed evidence for ${DOMAIN_LABEL[domain]} — a gap to close directly with the vendor.`,
      question: `We couldn't independently evidence your ${DOMAIN_LABEL[domain]} — can you demonstrate it and share proof (docs, a live test, or references)?`,
      askTheVendor: true,
    });
  }
  for (const domain of targets.weak) {
    q.push({
      domain,
      rationale: `${DOMAIN_LABEL[domain]} scored weak or low-confidence in the assessment.`,
      question: `${DOMAIN_LABEL[domain]} looks like a relative weak point — what evidence can you show that it meets our bar at production scale?`,
      askTheVendor: false,
    });
  }
  // Pad toward 8 with framework-critical domains (enterprise-priority order,
  // all 12 available) if the vendor is thin on gaps — guarantees ≥8 where the
  // 12 domains allow.
  if (q.length < 8) {
    const priority: DomainId[] = [
      "data_security_privacy", "identity_access", "governance_compliance", "model_reliability",
      "security_threat", "integration_architecture", "agentic_autonomy", "cost_finops",
      "vendor_maturity_lockin", "workforce_adoption", "strategic_value", "capital_resilience",
    ];
    for (const domain of priority) {
      if (q.length >= 8) break;
      if (q.some((x) => x.domain === domain)) continue;
      q.push({
        domain,
        rationale: `Framework-critical domain worth confirming for any enterprise deployment.`,
        question: `On ${DOMAIN_LABEL[domain]}: what independently-verifiable evidence can you provide, and where are the limits at our scale?`,
        askTheVendor: false,
      });
    }
  }
  return q.slice(0, 12);
}
