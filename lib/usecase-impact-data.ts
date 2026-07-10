// C6 Use-case Impact library — CURATED v1 (analyst-sourced, cited).
// ──────────────────────────────────────────────────────────────────
// FACTUAL-DATA-ONLY. Every row traces to a real, named, checkable source found via
// disciplined web research (2026-07-09) and reviewed in
// docs/c6-usecase-impact-curated-v1.md. Nothing here is invented; bands (never point
// numbers) reflect the source's real figure, quoted in `*Basis`; gaps are left empty.
//
// The impact axis is EVIDENCED UPLIFT — because independent studies measure task
// uplift well but almost never yield a portable per-enterprise DOLLAR figure. A $
// value is attached ONLY where a named source gives one (`value`), always with its
// OWN provenance (usually a vendor / vendor-commissioned TEI) — a vendor dollar figure
// is NEVER stapled onto an independent uplift row.
//
// Counter-evidence (AI does NOT cleanly help) is carried as USECASE_EVIDENCE_FLAGS —
// honesty signals, never an impact chip.

import type { IndustryTag } from "./use-cases";

export type ValueBand = "lt_250k" | "250k_1m" | "1m_5m" | "5m_25m" | "gt_25m";
export type UpliftBand = "lt_10%" | "10_25%" | "25_50%" | "gt_50%";
export type EvidenceGrade = "E2" | "E3" | "E4" | "E5";

/** A separately-sourced $ value-at-stake — its own provenance, distinct from uplift. */
export interface UseCaseImpactValue {
  band: ValueBand;
  basis: string;
  sourceName: string;
  sourceUrl: string;
  evidenceGrade: EvidenceGrade;
  asOf: string;
}

export interface UseCaseImpact {
  useCaseId: string; // must exist in USE_CASES (test-validated)
  industryTag: IndustryTag | "*"; // "*" = horizontal
  upliftBand: UpliftBand;
  upliftBasis: string; // verbatim figure + metric from the source
  sourceName: string;
  sourceUrl: string;
  evidenceGrade: EvidenceGrade; // grade of the UPLIFT evidence
  confidence: number; // 0-100
  asOf: string; // YYYY-MM
  note: string; // scope / caveat, one line
  value?: UseCaseImpactValue; // optional, separately-cited $ (usually vendor)
}

/** AI does NOT cleanly help here — surfaced as a caveat, never an impact chip. */
export type EvidenceFlagKind = "contested" | "not_a_net_win" | "accuracy_only" | "capability_limited";
export interface UseCaseEvidenceFlag {
  useCaseId: string;
  industryTag: IndustryTag | "*";
  kind: EvidenceFlagKind;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  evidenceGrade: EvidenceGrade;
  asOf: string;
}

// ── The evidenced UPLIFT rows (one primary per use-case × industry) ───────────
// 23 rows; 14 are E4/E5 (independent / major-analyst / government / court-validated).
export const USECASE_IMPACT: UseCaseImpact[] = [
  // Customer & service
  {
    useCaseId: "customer_service_agent", industryTag: "*", upliftBand: "10_25%",
    upliftBasis: "+15% issues resolved per hour on average (task-level); +34% for novices, ~0 for experts",
    sourceName: "Brynjolfsson, Li & Raymond — Generative AI at Work, QJE 2025 (NBER 31161)",
    sourceUrl: "https://www.nber.org/papers/w31161", evidenceGrade: "E5", confidence: 85, asOf: "2023-04",
    note: "Field study, 5,172 agents; setting was a software firm. McKinsey separately models 30–45% function-level.",
  },
  {
    useCaseId: "agent_assist", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "Real-time assist: novice/low-skill agents improved ~34%; disseminates best-worker practice",
    sourceName: "Brynjolfsson, Li & Raymond — Generative AI at Work, QJE 2025 (NBER 31161)",
    sourceUrl: "https://www.nber.org/papers/w31161", evidenceGrade: "E5", confidence: 82, asOf: "2023-04",
    note: "Same study; isolates the live agent-assist mechanism + its skill-heterogeneous effect.",
  },
  {
    useCaseId: "voice_ivr", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "40% of calls resolved by Year 3 (containment); −50% abandonment; CSAT 5.8→7.1",
    sourceName: "Forrester Total Economic Impact of PolyAI (commissioned by PolyAI)",
    sourceUrl: "https://tei.forrester.com/go/polyAI/PolyAITEI/?lang=en-us", evidenceGrade: "E4", confidence: 70, asOf: "2025-06",
    note: "Forrester TEI composite org; vendor-commissioned → mild optimism bias.",
    value: { band: "5m_25m", basis: "3-yr benefits PV $14.2M; NPV $11.3M; ROI 391%", sourceName: "Forrester TEI of PolyAI", sourceUrl: "https://tei.forrester.com/go/polyAI/PolyAITEI/?lang=en-us", evidenceGrade: "E4", asOf: "2025-06" },
  },
  {
    useCaseId: "voice_of_customer", industryTag: "*", upliftBand: "10_25%",
    upliftBasis: "One firm's expected +5–10% conversion, −10–20% cancellations, +10% CX rating from contact analytics",
    sourceName: "McKinsey — Gen AI in customer care: contact analytics to drive revenues",
    sourceUrl: "https://www.mckinsey.com/capabilities/operations/our-insights/operations-blog/gen-ai-in-customer-care-using-contact-analytics-to-drive-revenues", evidenceGrade: "E4", confidence: 55, asOf: "2024-01",
    note: "A single unnamed company's forward-looking EXPECTATION reported by McKinsey — not a realised measurement.",
  },
  {
    useCaseId: "hr_helpdesk", industryTag: "*", upliftBand: "gt_50%",
    upliftBasis: "54% deflection rate on the 'report an issue' form; ~20% case avoidance via search",
    sourceName: "ServiceNow — Now on Now generative AI use cases (internal Now Assist)",
    sourceUrl: "https://www.servicenow.com/workflow/now-on-now/generative-ai-use-cases.html", evidenceGrade: "E3", confidence: 58, asOf: "2024-01",
    note: "Vendor's own internal deployment, self-reported; spans IT + employee desk, not pure HR.",
    value: { band: "5m_25m", basis: "'annualized $5.5M savings through case and incident avoidance' (self-reported)", sourceName: "ServiceNow — Now on Now", sourceUrl: "https://www.servicenow.com/workflow/now-on-now/generative-ai-use-cases.html", evidenceGrade: "E3", asOf: "2024-01" },
  },

  // Engineering
  {
    useCaseId: "code_assistant", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "+26% pull requests completed per week across 3 RCTs (~4,000+ devs)",
    sourceName: "Cui et al. — The Effects of Generative AI on High-Skilled Work (MIT Economics)",
    sourceUrl: "https://economics.mit.edu/sites/default/files/inline-files/draft_copilot_experiments.pdf", evidenceGrade: "E5", confidence: 80, asOf: "2024-05",
    note: "Sustained org output (PRs/week) — defensible vs the one-task lab '55% faster'. See the contested flag (METR).",
  },
  {
    useCaseId: "documentation_generator", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "Code documentation ~45–50% time reduction ('half the time') — highest-uplift dev task",
    sourceName: "McKinsey — Unleashing developer productivity with generative AI",
    sourceUrl: "https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/unleashing-developer-productivity-with-generative-ai", evidenceGrade: "E4", confidence: 74, asOf: "2023-06",
    note: "Task-level time saving (~40 devs), not quality-adjusted.",
  },
  {
    useCaseId: "test_generation", industryTag: "technology_software", upliftBand: "25_50%",
    upliftBasis: "25% of runs raised coverage; 73% of recommendations accepted to production (Meta, industrial scale)",
    sourceName: "Alshahwan et al. (Meta) — Automated Unit Test Improvement using LLMs (TestGen-LLM, FSE'24)",
    sourceUrl: "https://arxiv.org/abs/2402.09171", evidenceGrade: "E4", confidence: 80, asOf: "2024-02",
    note: "Peer-reviewed but Meta-on-Meta → E4. Augments existing tests, not greenfield authoring.",
  },
  {
    useCaseId: "vulnerability_triage", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "SOC alert triage: false-positive rate 24.9%→14.2%; actionable-decision F1 0.66→0.78",
    sourceName: "CORTEX — Collaborative LLM Agents for High-Stakes Alert Triage (arXiv 2510.00311)",
    sourceUrl: "https://arxiv.org/html/2510.00311v1", evidenceGrade: "E5", confidence: 68, asOf: "2025-10",
    note: "Benchmark vs an LLM baseline, NOT vs human analysts; no human time-saved reported.",
  },

  // Knowledge / content / sales
  {
    useCaseId: "marketing_content", industryTag: "*", upliftBand: "gt_50%",
    upliftBasis: "+40% (human-graded) quality, +12% throughput, 25% faster on writing/creative tasks",
    sourceName: "Dell'Acqua et al. — Navigating the Jagged Technological Frontier (HBS/BCG, 758 consultants)",
    sourceUrl: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321", evidenceGrade: "E5", confidence: 82, asOf: "2023-09",
    note: "Task-level RCT. Corroborated by Noy & Zhang (Science 2023): −40% time. Jagged frontier: AI HURTS off-frontier tasks.",
  },
  {
    useCaseId: "rfp_proposal", industryTag: "*", upliftBand: "gt_50%",
    upliftBasis: "+12% tasks, 25% faster, +40% quality on structured business writing/persuasion tasks",
    sourceName: "Dell'Acqua et al. — Navigating the Jagged Technological Frontier (HBS/BCG)",
    sourceUrl: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321", evidenceGrade: "E5", confidence: 68, asOf: "2023-09",
    note: "PROXY: consulting deliverables ≈ RFP drafting, not literally RFP. Jagged-frontier risk on factual/compliance sections.",
  },
  {
    useCaseId: "knowledge_assistant", industryTag: "*", upliftBand: "lt_10%",
    upliftBasis: "~19 minutes saved per user per day (~4% of an 8h day)",
    sourceName: "UK DWP — Evaluation of the Microsoft 365 Copilot trial (GOV.UK, 3,549 staff)",
    sourceUrl: "https://www.gov.uk/government/publications/an-evaluation-of-dwps-microsoft-copilot-365-trial/an-evaluation-of-dwps-microsoft-365-copilot-trial", evidenceGrade: "E4", confidence: 74, asOf: "2026-01",
    note: "Independent government evaluation (quasi-experimental, comparison group). Self-reported time. NB self-report inflates ~7× vs measured.",
  },
  {
    useCaseId: "meeting_assistant", industryTag: "*", upliftBand: "lt_10%",
    upliftBasis: "Estimated 'up to an hour' summarising/drafting/searching (upper bound)",
    sourceName: "Australian Govt DTA — whole-of-government M365 Copilot trial evaluation (5,765 licences)",
    sourceUrl: "https://www.digital.gov.au/initiatives/copilot-trial/microsoft-365-copilot-evaluation-report-full", evidenceGrade: "E4", confidence: 60, asOf: "2024-08",
    note: "Independent gov eval; 'up to an hour' is an upper bound. 61% of managers couldn't identify Copilot output; verification offset some savings.",
  },
  {
    useCaseId: "translation_localisation", industryTag: "financial_services", upliftBand: "25_50%",
    upliftBasis: "+36% translation productivity via neural-MT post-editing, no significant quality loss",
    sourceName: "Läubli et al. — Post-editing Productivity with Neural MT: Banking & Finance (ACL W19-6626)",
    sourceUrl: "https://aclanthology.org/W19-6626.pdf", evidenceGrade: "E5", confidence: 78, asOf: "2019-08",
    note: "Peer-reviewed, professional translators, domain-scoped. Pre-LLM neural MT — modern LLMs likely differ.",
  },

  // Finance / legal / ops
  {
    useCaseId: "ediscovery", industryTag: "legal", upliftBand: "25_50%",
    upliftBasis: "TAR 77% recall / 85% precision / 80% F1 vs manual review 59% / 32% / 36% (TREC 2009)",
    sourceName: "Grossman & Cormack — TAR Can Be More Effective & Efficient Than Manual Review, Rich. J.L. & Tech. (2011)",
    sourceUrl: "https://scholarship.richmond.edu/jolt/vol17/iss3/5/", evidenceGrade: "E5", confidence: 90, asOf: "2011-04",
    note: "Landmark, peer-reviewed, court-cited (Da Silva Moore). Dataset-specific; the robust win is precision/F1. RAND: review = 73% of e-discovery cost.",
  },
  {
    useCaseId: "contract_review", industryTag: "legal", upliftBand: "gt_50%",
    upliftBasis: "AI 94% accuracy surfacing risks vs 20 lawyers' 85%; 26s vs 92-min average (~99% time cut) on 5 NDAs",
    sourceName: "LawGeex — Comparing AI to Human Lawyers in Review of Standard Business Contracts (2018)",
    sourceUrl: "https://images.law.com/contrib/content/uploads/documents/397/5408/lawgeex.pdf", evidenceGrade: "E3", confidence: 74, asOf: "2018-02",
    note: "Vendor-conducted though Stanford/USC-advised; NDAs only; 2018 pre-LLM; risk-detection not full drafting.",
  },
  {
    useCaseId: "ap_invoice_processing", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "Cost per invoice: top-quartile $2.07 vs median $5.83 (1,485 orgs) — a ~64% median→top gap",
    sourceName: "APQC Open Standards Benchmarking — Process Accounts Payable (via CFO.com)",
    sourceUrl: "https://www.cfo.com/news/metric-of-the-month-accounts-payable-cost/659393/", evidenceGrade: "E4", confidence: 78, asOf: "2018-02",
    note: "Realized cost dispersion; the lever is automation/e-invoicing, not AI-specific.",
    value: { band: "1m_5m", basis: "Forrester TEI of Basware AP Automation: 3-yr NPV $1.12M, ROI 158%, +50% clerk productivity", sourceName: "Forrester TEI of Basware (commissioned by Basware)", sourceUrl: "https://tei.forrester.com/go/basware/apautomation/", evidenceGrade: "E3", asOf: "2023-01" },
  },
  {
    useCaseId: "ar_collections", industryTag: "*", upliftBand: "10_25%",
    upliftBasis: "75% of AI-in-AR adopters cut DSO by 6+ days (survey of 500 finance leaders)",
    sourceName: "Wakefield Research (commissioned by Billtrust) — AI in Accounts Receivable Reduces DSO",
    sourceUrl: "https://www.billtrust.com/news/study-finds-ai-in-accounts-receivable-reduces-dso", evidenceGrade: "E3", confidence: 55, asOf: "2025-10",
    note: "Vendor-commissioned survey; respondents are adopters (selection bias). Directional.",
    value: { band: "1m_5m", basis: "HighRadius named-customer cases: Keurig Dr Pepper '$2.5M annual savings'; Ferrero −28% DSO", sourceName: "HighRadius customer case studies", sourceUrl: "https://www.highradius.com/resources/Blog/ai-in-accounts-receivable/", evidenceGrade: "E3", asOf: "2026-01" },
  },
  {
    useCaseId: "month_end_close", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "Digital-world-class finance teams run 35–57% shorter close cycles; 99% journal-entry automation vs 85% peers",
    sourceName: "The Hackett Group — Digital World Class Finance (2025)",
    sourceUrl: "https://www.thehackettgroup.com/the-hackett-group-digital-world-class-finance-teams-operate-at-45-lower-cost-and-deliver-faster-smarter-insights/", evidenceGrade: "E4", confidence: 76, asOf: "2025-06",
    note: "Leaders-vs-peers gap (self-selected pool), NOT a before/after automation delta. APQC: median close 6.4 days.",
    value: { band: "250k_1m", basis: "Nucleus/BlackLine reconciliation case: $481k/yr average benefit, ROI 94%", sourceName: "Nucleus Research ROI Case Study — BlackLine", sourceUrl: "https://pages.blackline.com/rs/blacklinesystems/images/BlackLine-ROI-Case-Study-Steel-Supplier.pdf", evidenceGrade: "E3", asOf: "2012-11" },
  },
  {
    useCaseId: "financial_analysis", industryTag: "*", upliftBand: "25_50%",
    upliftBasis: "Finance professionals spend 20–30% less time crunching data where gen-AI adopted robustly",
    sourceName: "McKinsey — How finance teams are putting AI to work today (2025)",
    sourceUrl: "https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/how-finance-teams-are-putting-ai-to-work-today", evidenceGrade: "E4", confidence: 72, asOf: "2025-11",
    note: "Self-reported across a few functions. A single bank separately cut investment-brief production >90% (9h→30min).",
    value: { band: "5m_25m", basis: "Forrester TEI of Anaplan for Finance: $13.3M FP&A + consolidation gains (3-yr), 152% ROI", sourceName: "Forrester TEI of Anaplan (commissioned by Anaplan)", sourceUrl: "https://www.anaplan.com/resources/research-report/forrester-consulting-tei-anaplan-for-finance/", evidenceGrade: "E3", asOf: "2022-01" },
  },
  {
    useCaseId: "resume_screening", industryTag: "*", upliftBand: "10_25%",
    upliftBasis: "Structured job-test screening → ~15% longer job tenure (quality of hire, NOT screening speed)",
    sourceName: "Hoffman, Kahn & Li — Discretion in Hiring, QJE 133(2) (2018)",
    sourceUrl: "https://www.hbs.edu/ris/Publication%20Files/16-055_32146994-78d3-42f0-bb05-c30329cf4aef.pdf", evidenceGrade: "E5", confidence: 80, asOf: "2018-05",
    note: "Peer-reviewed, 15 firms. Measures structured-assessment screening, not LLM resume parsing; effect is retention. Diversity-collapse risk with naive models.",
  },
  {
    useCaseId: "operations_automation", industryTag: "*", upliftBand: "10_25%",
    upliftBasis: "+14% throughput (issues/hr) among 5,179 support agents; 34% for novices",
    sourceName: "Brynjolfsson, Li & Raymond — Generative AI at Work, QJE 2025 (NBER 31161)",
    sourceUrl: "https://www.nber.org/papers/w31161", evidenceGrade: "E5", confidence: 65, asOf: "2023-04",
    note: "PROXY: the study is customer-support ops; generalises to routine back-office as a directional proxy.",
  },
  {
    useCaseId: "data_analysis", industryTag: "*", upliftBand: "10_25%",
    upliftBasis: "−15.6% task time (38 vs 45 min, p=0.002) in an RCT; task quality NOT significantly different",
    sourceName: "Swiss TPH — Generative AI for Data Analysis: An RCT, Int J Public Health 2025;70:1608572",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12521002/", evidenceGrade: "E5", confidence: 78, asOf: "2025-10",
    note: "Both arms used AI (AI-does-analysis vs conventional-with-AI-support). Small n, single task. Speed real; accuracy not.",
  },
];

// ── Counter-evidence FLAGS (evidenced, but NOT an impact win) ─────────────────
export const USECASE_EVIDENCE_FLAGS: UseCaseEvidenceFlag[] = [
  {
    useCaseId: "code_assistant", industryTag: "*", kind: "contested",
    summary: "An RCT found experienced developers on their own mature repos were 19% SLOWER with AI (while believing they were faster).",
    sourceName: "METR — Measuring the Impact of Early-2025 AI on Experienced OSS Developer Productivity (arXiv 2507.09089)",
    sourceUrl: "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/", evidenceGrade: "E5", asOf: "2025-07",
  },
  {
    useCaseId: "code_review_agent", industryTag: "*", kind: "not_a_net_win",
    summary: "No independent RCT shows a net delivery win; 2024 DORA found AI adoption correlated with −1.5% throughput and −7.2% delivery stability.",
    sourceName: "Google Cloud / DORA — 2024 Accelerate State of DevOps Report",
    sourceUrl: "https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report", evidenceGrade: "E4", asOf: "2024-10",
  },
  {
    useCaseId: "churn_prediction", industryTag: "*", kind: "accuracy_only",
    summary: "Peer-reviewed work evidences model accuracy (~89.6%) on a benchmark dataset, but NOT a realised churn-rate reduction or dollar value in a live deployment.",
    sourceName: "Wagh et al. — ML-driven churn prediction, Scientific Reports (Nature) 2024",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11161656/", evidenceGrade: "E5", asOf: "2024-06",
  },
  {
    useCaseId: "text_to_sql", industryTag: "*", kind: "capability_limited",
    summary: "Frontier models solve only ~10–21% of realistic enterprise text-to-SQL workflows (Spider 2.0) — the ~90% Spider 1.0 figure vastly overstates deployed capability.",
    sourceName: "Lei et al. — Spider 2.0: Evaluating LMs on Real-World Enterprise Text-to-SQL Workflows (ICLR 2025)",
    sourceUrl: "https://spider2-sql.github.io/", evidenceGrade: "E5", asOf: "2026-07",
  },
];
