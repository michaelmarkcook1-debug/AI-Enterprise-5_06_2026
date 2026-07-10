// Legislative / regulatory tracker — curated, CITED register of enterprise-AI
// instruments. Net-new (net-new pack Prompt 2).
// ─────────────────────────────────────────────────────────────────────────────
// HONESTY CONTRACT (FACTUAL-DATA-ONLY + the prompt's hard guardrail):
//  • REAL instruments only, each with a PRIMARY/OFFICIAL source citation, an
//    accurate status + date, and an "as of" the register last checked it.
//  • NO fabricated obligations and NO invented "impact". Where a status/scope
//    involves interpretation it is flagged `directional`.
//  • This is CURATED ANALYST REFERENCE data (like the C2 crosswalk + the delivery
//    layer): shown WITH its provenance + an "indicative — pending analyst review"
//    posture, NEVER presented as legal advice. See LEGISLATIVE_DISCLAIMER.
//  • Each instrument maps to the assessment DOMAINS it touches, reusing the C2
//    crosswalk's framework anchors (lib/insights/framework-crosswalk.ts), so a CIO
//    sees: this regulation → these domains → the vendors' evidence on them.
//
// Pure reference data — reads nothing, writes nothing, no DB, no LLM.

import type { DomainId } from "../types";
import type { IndustryTag } from "../use-cases";

export type Jurisdiction =
  | "EU"
  | "US" // federal
  | "US-CO"
  | "US-CA"
  | "US-TX"
  | "US-UT"
  | "US-IL"
  | "UK"
  | "Canada"
  | "International";

export const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  EU: "European Union",
  US: "United States (federal)",
  "US-CO": "US — Colorado",
  "US-CA": "US — California",
  "US-TX": "US — Texas",
  "US-UT": "US — Utah",
  "US-IL": "US — Illinois",
  UK: "United Kingdom",
  Canada: "Canada",
  International: "International",
};

/** proposed → not yet law; enacted → passed, not all obligations live; in_force →
 *  obligations operative; framework → non-statutory guidance / white paper. */
export type InstrumentStatus = "proposed" | "enacted" | "in_force" | "framework";

export const STATUS_LABEL: Record<InstrumentStatus, string> = {
  proposed: "Proposed",
  enacted: "Enacted",
  in_force: "In force",
  framework: "Framework / guidance",
};

export interface LegislativeInstrument {
  id: string;
  /** Official name, e.g. "Regulation (EU) 2024/1689 (Artificial Intelligence Act)". */
  name: string;
  shortName: string;
  jurisdiction: Jurisdiction;
  status: InstrumentStatus;
  /** ISO date the core obligations take effect; null for proposed / non-statutory
   *  frameworks / where a single date would mislead (use timelineNote instead). */
  inForceDate: string | null;
  /** Real phasing/milestone note when one date misleads (EU AI Act, etc.). */
  timelineNote?: string;
  /** ONE plain-English, CIO-facing line — the core obligation, not legal detail. */
  whatItRequires: string;
  /** OFFICIAL primary source (register/gazette/agency). Required, must be https. */
  citation: { sourceName: string; url: string };
  /** Assessment domains it touches — real DomainIds (test-validated). */
  domains: DomainId[];
  /** Sector-specific verticals; EMPTY = horizontal (economy-wide). */
  verticals: IndustryTag[];
  /** Any part involves interpretation/uncertainty → the UI labels it directional. */
  directional?: boolean;
  /** ISO date the register last verified this row against its source. */
  asOf: string;
  note?: string;
}

// ⚠️ FACTUAL-DATA-ONLY: every row below is verified against its cited primary
// source before being added. NEVER add a row without a real official citation,
// an accurate status, and an asOf date. Web-verified 2026-07-10 against the
// official sources cited on each row (EUR-Lex, whitehouse.gov, nist.gov, gov.uk,
// ico.org.uk, fca.org.uk, federalregister.gov, fda.gov, consumerfinance.gov,
// US state legislatures). "as of" = the date the register last checked the row.
export const LEGISLATIVE_INSTRUMENTS: LegislativeInstrument[] = [
  // ── European Union ─────────────────────────────────────────────────────────
  {
    id: "eu_ai_act",
    name: "Regulation (EU) 2024/1689 (Artificial Intelligence Act)",
    shortName: "EU AI Act",
    jurisdiction: "EU",
    status: "in_force",
    inForceDate: "2024-08-01",
    timelineNote:
      "Phased application (Art. 113): prohibited practices + AI literacy from 2 Feb 2025; general-purpose-AI (GPAI) model obligations from 2 Aug 2025; most high-risk (Annex III) obligations from 2 Aug 2026; product-safety high-risk (Art. 6(1)) from 2 Aug 2027.",
    whatItRequires:
      "Risk-tiered rules for AI: bans a set of unacceptable-risk uses, imposes risk-management, conformity-assessment and documentation duties on high-risk systems, and transparency + systemic-risk duties on general-purpose models.",
    citation: { sourceName: "EUR-Lex (Official Journal, ELI)", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng" },
    domains: ["governance_compliance", "model_reliability", "security_threat", "agentic_autonomy", "data_security_privacy"],
    verticals: [],
    directional: true,
    asOf: "2026-07-10",
    note: "High-risk classification (Art. 6 / Annex III), the GPAI systemic-risk threshold, and pending secondary acts involve interpretation.",
  },
  {
    id: "eu_gpai_code",
    name: "General-Purpose AI Code of Practice (Article 56, Regulation (EU) 2024/1689)",
    shortName: "GPAI Code of Practice",
    jurisdiction: "EU",
    status: "framework",
    inForceDate: null,
    timelineNote:
      "Published 10 Jul 2025 as a voluntary, Commission-endorsed route to demonstrate compliance with the AI Act's GPAI obligations that began applying 2 Aug 2025.",
    whatItRequires:
      "A voluntary but Commission-endorsed way for general-purpose model providers to show they meet the AI Act's transparency, copyright and (for systemic-risk models) safety-and-security duties.",
    citation: { sourceName: "European Commission — Shaping Europe's Digital Future", url: "https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai" },
    domains: ["governance_compliance", "model_reliability", "security_threat", "data_security_privacy"],
    verticals: [],
    directional: true,
    asOf: "2026-07-10",
    note: "Voluntary soft-law; adherence-as-compliance rests on Commission/AI-Board endorsement, and the signatory roster evolves.",
  },
  {
    id: "gdpr_art22",
    name: "Regulation (EU) 2016/679 (GDPR), Art. 22 — automated individual decision-making",
    shortName: "GDPR (Art. 22)",
    jurisdiction: "EU",
    status: "in_force",
    inForceDate: "2018-05-25",
    whatItRequires:
      "Individuals have the right not to be subject to a decision based solely on automated processing (incl. profiling) with legal or similarly significant effects, absent a lawful basis + safeguards (meaningful information on the logic and a right to human intervention).",
    citation: { sourceName: "EUR-Lex (ELI, consolidated GDPR)", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng" },
    domains: ["data_security_privacy", "governance_compliance", "model_reliability", "identity_access"],
    verticals: [],
    directional: true,
    asOf: "2026-07-10",
    note: "The scope of 'solely automated', 'similarly significant effect' and any 'right to explanation' is actively litigated (e.g. CJEU C-634/21 SCHUFA).",
  },
  {
    id: "eu_dora",
    name: "Regulation (EU) 2022/2554 — Digital Operational Resilience Act (DORA)",
    shortName: "DORA",
    jurisdiction: "EU",
    status: "in_force",
    inForceDate: "2025-01-17",
    whatItRequires:
      "In-scope financial entities must manage ICT risk end-to-end — governance, incident reporting, resilience testing, and third-party (incl. cloud/AI-provider) risk — and keep a register of ICT third-party arrangements.",
    citation: { sourceName: "EUR-Lex (ELI)", url: "https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng" },
    domains: ["security_threat", "vendor_maturity_lockin", "governance_compliance", "data_security_privacy", "model_reliability"],
    verticals: ["financial_services", "insurance"],
    asOf: "2026-07-10",
    note: "Not AI-specific — governs AI/cloud vendors as ICT third parties and the resilience of AI-dependent financial systems.",
  },
  {
    id: "eu_mdr",
    name: "Regulation (EU) 2017/745 on medical devices (MDR)",
    shortName: "EU MDR",
    jurisdiction: "EU",
    status: "in_force",
    inForceDate: "2021-05-26",
    timelineNote: "Transitional deadlines for certain legacy devices run to 2027/2028 (Reg. (EU) 2023/607), class-dependent.",
    whatItRequires:
      "AI-based medical-device software (SaMD) must meet safety, clinical-evidence, classification and conformity-assessment requirements before CE marking; high-risk medical AI is dual-regulated with the AI Act (Annex I route).",
    citation: { sourceName: "EUR-Lex (ELI)", url: "https://eur-lex.europa.eu/eli/reg/2017/745/oj/eng" },
    domains: ["model_reliability", "governance_compliance", "data_security_privacy", "security_threat"],
    verticals: ["healthcare"],
    directional: true,
    asOf: "2026-07-10",
    note: "Software-as-medical-device qualification, Rule 11 classification and the MDR↔AI-Act interplay involve genuine interpretation.",
  },

  // ── United States (federal) ────────────────────────────────────────────────
  {
    id: "nist_ai_rmf",
    name: "NIST AI Risk Management Framework 1.0 (NIST AI 100-1)",
    shortName: "NIST AI RMF 1.0",
    jurisdiction: "US",
    status: "framework",
    inForceDate: null,
    timelineNote: "Issued 26 Jan 2023. Voluntary, non-binding — the de facto US enterprise baseline.",
    whatItRequires:
      "A voluntary framework to Govern / Map / Measure / Manage AI risk and build trustworthiness across the AI lifecycle — no legal obligation, but the reference most US enterprises adopt.",
    citation: { sourceName: "NIST", url: "https://www.nist.gov/itl/ai-risk-management-framework" },
    domains: ["governance_compliance", "model_reliability", "data_security_privacy", "security_threat"],
    verticals: [],
    asOf: "2026-07-10",
  },
  {
    id: "nist_genai_profile",
    name: "NIST AI RMF: Generative AI Profile (NIST-AI-600-1)",
    shortName: "NIST GenAI Profile",
    jurisdiction: "US",
    status: "framework",
    inForceDate: null,
    timelineNote: "Issued 26 Jul 2024. Voluntary companion profile to the AI RMF.",
    whatItRequires:
      "Identifies 12 generative-AI-specific risk categories (e.g. confabulation, data privacy, information integrity/security, IP, value-chain) with suggested actions to manage them.",
    citation: { sourceName: "NIST (primary PDF)", url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf" },
    domains: ["governance_compliance", "model_reliability", "security_threat", "data_security_privacy"],
    verticals: [],
    asOf: "2026-07-10",
  },
  {
    id: "eo_14179",
    name: "Executive Order 14179 — Removing Barriers to American Leadership in Artificial Intelligence",
    shortName: "EO 14179",
    jurisdiction: "US",
    status: "in_force",
    inForceDate: "2025-01-23",
    whatItRequires:
      "Revokes the prior EO 14110 and directs federal agencies toward a deregulatory, innovation-first AI posture — the current federal executive stance a CIO should expect from US-government counterparties.",
    citation: { sourceName: "The White House", url: "https://www.whitehouse.gov/presidential-actions/2025/01/removing-barriers-to-american-leadership-in-artificial-intelligence/" },
    domains: ["governance_compliance"],
    verticals: ["public_sector"],
    asOf: "2026-07-10",
    note: "Binding on federal agencies. It rescinded EO 14110 (the former flagship US AI executive order), which is no longer in effect.",
  },
  {
    id: "omb_m2521",
    name: "OMB M-25-21 — Accelerating Federal Use of AI through Innovation, Governance, and Public Trust",
    shortName: "OMB M-25-21",
    jurisdiction: "US",
    status: "in_force",
    inForceDate: "2025-04-03",
    whatItRequires:
      "The current rulebook for how US federal agencies USE AI: risk management for 'high-impact' AI (impact assessments, testing, human oversight, Chief AI Officer governance). Replaces the Biden-era M-24-10.",
    citation: { sourceName: "The White House / OMB (PDF)", url: "https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf" },
    domains: ["governance_compliance", "model_reliability", "identity_access", "data_security_privacy"],
    verticals: ["public_sector"],
    asOf: "2026-07-10",
  },
  {
    id: "omb_m2522",
    name: "OMB M-25-22 — Driving Efficient Acquisition of Artificial Intelligence in Government",
    shortName: "OMB M-25-22",
    jurisdiction: "US",
    status: "in_force",
    inForceDate: "2025-04-03",
    whatItRequires:
      "Governs how US federal agencies BUY AI — competitive marketplace, performance tracking, risk management, vendor-lock-in avoidance. Relevant to any SI/vendor selling AI to the federal government.",
    citation: { sourceName: "The White House / OMB (PDF)", url: "https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf" },
    domains: ["vendor_maturity_lockin", "governance_compliance"],
    verticals: ["public_sector"],
    asOf: "2026-07-10",
  },
  {
    id: "fda_pccp_final",
    name: "FDA — Marketing Submission Recommendations for a Predetermined Change Control Plan for AI-Enabled Device Software Functions (final guidance)",
    shortName: "FDA PCCP (final)",
    jurisdiction: "US",
    status: "framework",
    inForceDate: null,
    timelineNote: "Finalized 3 Dec 2024. FDA guidance — non-binding but authoritative.",
    whatItRequires:
      "Lets manufacturers pre-authorize planned AI/ML model changes in the initial submission (a PCCP) so devices can be updated post-clearance without a new marketing submission each time.",
    citation: { sourceName: "FDA (primary document PDF)", url: "https://www.fda.gov/media/187905/download" },
    domains: ["model_reliability", "governance_compliance"],
    verticals: ["healthcare"],
    asOf: "2026-07-10",
  },
  {
    id: "fda_aidsf_draft",
    name: "FDA — Artificial Intelligence-Enabled Device Software Functions: Lifecycle Management and Marketing Submission Recommendations (draft guidance, FDA-2024-D-4488)",
    shortName: "FDA AI device lifecycle (draft)",
    jurisdiction: "US",
    status: "proposed",
    inForceDate: null,
    timelineNote: "Draft issued 6 Jan 2025; comment period closed 7 Apr 2025. Not yet finalized.",
    whatItRequires:
      "Draft total-product-lifecycle expectations for AI-enabled medical devices: model description, data lineage, performance vs. claims, bias analysis, human-AI workflow and post-market monitoring.",
    citation: { sourceName: "Federal Register (FDA)", url: "https://www.federalregister.gov/documents/2025/01/07/2024-31543/artificial-intelligence-enabled-device-software-functions-lifecycle-management-and-marketing" },
    domains: ["model_reliability", "governance_compliance", "data_security_privacy"],
    verticals: ["healthcare"],
    directional: true,
    asOf: "2026-07-10",
    note: "Draft — recommendations may change before finalization.",
  },
  {
    id: "cfpb_adverse_action",
    name: "CFPB Circular 2023-03 — adverse-action notices and AI/complex credit models (ECOA)",
    shortName: "CFPB AI adverse-action",
    jurisdiction: "US",
    status: "in_force",
    inForceDate: "2023-09-19",
    whatItRequires:
      "Lenders using AI/complex models for credit decisions must still give specific, accurate adverse-action reasons under ECOA — 'the model did it' or generic checkbox reasons are not compliant.",
    citation: { sourceName: "Consumer Financial Protection Bureau", url: "https://www.consumerfinance.gov/ai/" },
    domains: ["governance_compliance", "model_reliability"],
    verticals: ["financial_services"],
    directional: true,
    asOf: "2026-07-10",
    note: "The legal interpretation stands, but the CFPB's enforcement posture shifted markedly under the 2025 administration — treat operative enforcement as in flux.",
  },

  // ── United States (states) ─────────────────────────────────────────────────
  {
    id: "us_co_ai_act",
    name: "Colorado Consumer Protections for Artificial Intelligence (Senate Bill 24-205)",
    shortName: "Colorado AI Act",
    jurisdiction: "US-CO",
    status: "in_force",
    inForceDate: "2026-06-30",
    timelineNote: "Effective date delayed from 1 Feb 2026 to 30 Jun 2026 by SB25B-004 (signed 28 Aug 2025).",
    whatItRequires:
      "Developers and deployers of high-risk AI systems must use reasonable care to protect consumers from algorithmic discrimination, with disclosure, impact-assessment and attorney-general-notification duties.",
    citation: { sourceName: "Colorado General Assembly (SB25B-004, amending SB 24-205)", url: "https://leg.colorado.gov/bills/sb25b-004" },
    domains: ["governance_compliance", "model_reliability", "data_security_privacy"],
    verticals: [],
    asOf: "2026-07-10",
    note: "The first comprehensive US state high-risk-AI law; its effective date was pushed back once already.",
  },
  {
    id: "us_ca_ab2013",
    name: "California Generative AI: Training Data Transparency (Assembly Bill 2013)",
    shortName: "CA AB 2013",
    jurisdiction: "US-CA",
    status: "in_force",
    inForceDate: "2026-01-01",
    whatItRequires:
      "Developers of generative-AI systems available to Californians must publicly post documentation summarizing the training datasets — sources, size, and whether they contain personal or copyrighted data.",
    citation: { sourceName: "California Legislative Information — AB-2013", url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013" },
    domains: ["governance_compliance", "data_security_privacy"],
    verticals: [],
    asOf: "2026-07-10",
  },
  {
    id: "us_ca_sb53",
    name: "California Transparency in Frontier Artificial Intelligence Act (Senate Bill 53, Ch. 138/2025)",
    shortName: "CA SB 53 (frontier AI)",
    jurisdiction: "US-CA",
    status: "in_force",
    inForceDate: "2026-01-01",
    timelineNote: "Successor to the vetoed SB 1047; some provisions (CalCompute, state assessments) phase in 1 Jan 2027.",
    whatItRequires:
      "Large frontier-AI developers must publish a catastrophic-risk management framework, release transparency reports before deploying new frontier models, report critical safety incidents to the state, and protect whistleblowers.",
    citation: { sourceName: "California Legislative Information — SB-53", url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB53" },
    domains: ["governance_compliance", "model_reliability", "agentic_autonomy"],
    verticals: [],
    asOf: "2026-07-10",
  },
  {
    id: "us_ca_sb942",
    name: "California AI Transparency Act (Senate Bill 942)",
    shortName: "CA AI Transparency Act",
    jurisdiction: "US-CA",
    status: "enacted",
    inForceDate: "2026-08-02",
    timelineNote: "Signed 19 Sep 2024; operative date delayed from 1 Jan 2026 to 2 Aug 2026 by AB 853.",
    whatItRequires:
      "Large generative-AI providers (>1M monthly CA users) must offer a free AI-detection tool and apply latent + manifest provenance disclosures to AI-generated image, video and audio content.",
    citation: { sourceName: "California Legislative Information — SB-942", url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB942" },
    domains: ["governance_compliance", "identity_access", "model_reliability"],
    verticals: [],
    asOf: "2026-07-10",
    note: "Enacted but not yet operative — obligations begin 2 Aug 2026.",
  },
  {
    id: "us_tx_traiga",
    name: "Texas Responsible Artificial Intelligence Governance Act (House Bill 149)",
    shortName: "Texas TRAIGA",
    jurisdiction: "US-TX",
    status: "in_force",
    inForceDate: "2026-01-01",
    whatItRequires:
      "Prohibits AI used to intentionally manipulate/harm, unlawful discrimination, government social scoring and non-consented biometric capture; requires disclosure when consumers interact with AI in government/healthcare; adds a sandbox + AG enforcement.",
    citation: { sourceName: "Texas Legislature Online — HB 149 (89R), Enrolled", url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB149" },
    domains: ["governance_compliance", "identity_access", "agentic_autonomy"],
    verticals: [],
    asOf: "2026-07-10",
    note: "Economy-wide, with extra AI-interaction disclosure in government and healthcare contexts.",
  },
  {
    id: "us_ut_aipa",
    name: "Utah Artificial Intelligence Policy Act (Senate Bill 149, 2024; Utah Code Title 13 Ch. 72)",
    shortName: "Utah AIPA",
    jurisdiction: "US-UT",
    status: "in_force",
    inForceDate: "2024-05-01",
    timelineNote: "Amended in 2025 (SB 226 + SB 332): proactive-disclosure duty narrowed to 'high-risk' interactions, safe harbor added, sunset removed.",
    whatItRequires:
      "Persons using generative AI to interact with consumers must disclose that on request; state-licensed professionals must proactively disclose AI use in high-risk interactions; deployers stay liable for consumer-protection violations via AI.",
    citation: { sourceName: "Utah Legislature — SB 149 (2024)", url: "https://le.utah.gov/Session/2024/bills/static/SB0149.html" },
    domains: ["governance_compliance", "identity_access"],
    verticals: [],
    asOf: "2026-07-10",
  },
  {
    id: "us_il_hb3773",
    name: "Illinois HB 3773 — AI in employment (Human Rights Act amendment, Public Act 103-0804)",
    shortName: "Illinois HB 3773",
    jurisdiction: "US-IL",
    status: "in_force",
    inForceDate: "2026-01-01",
    whatItRequires:
      "Makes it a civil-rights violation for an employer to use AI that has a discriminatory effect on a protected class (or uses ZIP code as a proxy) in employment decisions, and requires notice when AI is used in such decisions.",
    citation: { sourceName: "Illinois General Assembly — Public Act 103-0804 (HB 3773)", url: "https://www.ilga.gov/legislation/PublicActs/View/103-0804" },
    domains: ["governance_compliance", "identity_access"],
    verticals: [],
    asOf: "2026-07-10",
    note: "Employment-focused — applies to all employers, not a single sector.",
  },

  // ── United Kingdom ─────────────────────────────────────────────────────────
  {
    id: "uk_pro_innovation",
    name: "A pro-innovation approach to AI regulation (White Paper + government response, CP 1019)",
    shortName: "UK pro-innovation AI framework",
    jurisdiction: "UK",
    status: "framework",
    inForceDate: null,
    timelineNote: "White Paper Mar 2023; government response Feb 2024. No standalone UK AI statute is in force as of mid-2026.",
    whatItRequires:
      "No new AI statute: five cross-sector principles (safety/robustness; transparency; fairness; accountability; contestability) are applied by existing sector regulators within their remits.",
    citation: { sourceName: "GOV.UK — pro-innovation approach: government response", url: "https://www.gov.uk/government/consultations/ai-regulation-a-pro-innovation-approach-policy-proposals/outcome/a-pro-innovation-approach-to-ai-regulation-government-response" },
    domains: ["governance_compliance", "model_reliability"],
    verticals: [],
    directional: true,
    asOf: "2026-07-10",
    note: "Non-binding policy devolved to regulators; the government has said it will legislate later on the most powerful models.",
  },
  {
    id: "uk_ico_ai",
    name: "ICO — Guidance on AI and data protection (incl. the AI and data protection risk toolkit)",
    shortName: "ICO AI & data-protection guidance",
    jurisdiction: "UK",
    status: "in_force",
    inForceDate: null,
    timelineNote: "Standing regulator guidance (major update 2023); underlying law amended by the Data (Use and Access) Act 2025.",
    whatItRequires:
      "Apply UK GDPR / DPA 2018 to AI — lawful basis, fairness, transparency, DPIAs for high-risk AI, and accountability for automated decisions — using the ICO's four-theme risk toolkit to self-audit.",
    citation: { sourceName: "ICO — Guidance on AI and data protection", url: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/" },
    domains: ["data_security_privacy", "governance_compliance"],
    verticals: [],
    directional: true,
    asOf: "2026-07-10",
    note: "Automated-decision detail is evolving following the Data (Use and Access) Act 2025.",
  },
  {
    id: "uk_fca_ai",
    name: "FCA — AI and the FCA: our approach / AI Update",
    shortName: "FCA AI approach",
    jurisdiction: "UK",
    status: "in_force",
    inForceDate: null,
    timelineNote: "AI Update Apr 2024; AI Lab / live-testing sandboxes from 2024–2025.",
    whatItRequires:
      "No new AI rulebook for finance: firms manage AI under existing frameworks — the Consumer Duty, the Senior Managers & Certification Regime, and operational-resilience rules — with FCA sandboxes rather than prescriptive AI rules.",
    citation: { sourceName: "FCA — AI and the FCA: our approach", url: "https://www.fca.org.uk/firms/innovation/ai-approach" },
    domains: ["governance_compliance", "model_reliability", "agentic_autonomy"],
    verticals: ["financial_services"],
    directional: true,
    asOf: "2026-07-10",
  },
  {
    id: "uk_mhra_samd",
    name: "MHRA — Software and AI as a Medical Device (SaMD/AIaMD) Change Programme + guidance",
    shortName: "MHRA Software & AI as a Medical Device",
    jurisdiction: "UK",
    status: "in_force",
    inForceDate: null,
    timelineNote: "Change Programme roadmap 2022; guidance last updated Feb 2025 (the regime is being reformed).",
    whatItRequires:
      "AI meeting the definition of a medical device is regulated as one: intended purpose, conformity/technical evidence, clinical evidence, transparency, post-market surveillance and predetermined change-control plans.",
    citation: { sourceName: "GOV.UK / MHRA — Software and AI as a medical device", url: "https://www.gov.uk/government/publications/software-and-artificial-intelligence-ai-as-a-medical-device/software-and-artificial-intelligence-ai-as-a-medical-device" },
    domains: ["model_reliability", "governance_compliance", "data_security_privacy"],
    verticals: ["healthcare"],
    directional: true,
    asOf: "2026-07-10",
  },

  // ── International ───────────────────────────────────────────────────────────
  {
    id: "coe_ai_convention",
    name: "Council of Europe Framework Convention on AI and Human Rights, Democracy and the Rule of Law (CETS No. 225)",
    shortName: "CoE AI Framework Convention",
    jurisdiction: "International",
    status: "proposed",
    inForceDate: null,
    timelineNote:
      "Adopted 17 May 2024; opened for signature 5 Sep 2024 (UK signed, not yet ratified; EU ratified 15 May 2026). NOT yet in force as of 10 Jul 2026 (ratification threshold unmet).",
    whatItRequires:
      "First binding international AI treaty: commits signatory STATES to ensure AI respects human rights, democracy and the rule of law; obligations reach organisations only via each state's domestic implementation — not directly enforceable on companies today.",
    citation: { sourceName: "GOV.UK — UK signs first international AI treaty", url: "https://www.gov.uk/government/news/uk-signs-first-international-treaty-addressing-risks-of-artificial-intelligence" },
    domains: ["governance_compliance", "identity_access", "model_reliability"],
    verticals: ["public_sector"],
    directional: true,
    asOf: "2026-07-10",
    note: "Signed but not yet in force; binds governments, not companies directly. (A widely-repeated 'in force since Nov 2025' claim is inaccurate.)",
  },
];

/** Standing, non-negotiable disclaimer — rendered prominently on the surface. */
export const LEGISLATIVE_DISCLAIMER =
  "We track and cite public legislative and regulatory instruments relevant to enterprise AI. This is not legal advice — verify against the primary source and your counsel before acting." as const;

/** Whole-register posture, mirroring the C2 crosswalk: a cited draft register,
 *  surfaced as indicative until an analyst who knows the instruments signs off. */
export const REGISTER_STATUS = "indicative — pending analyst review" as const;
