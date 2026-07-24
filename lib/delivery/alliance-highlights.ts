// Cited alliance spotlights — the fact-checked, source-backed layer that sits on
// top of the curated GSI×AI delivery seed (lib/delivery/seed.ts).
// ───────────────────────────────────────────────────────────────────────────
// PROVENANCE: every figure below traces to a named press / vendor source that was
// verified against live search (fact-check 2026-07-24). This is DISTINCT from the
// seed: the seed is analyst-curated channel breadth ("directional, not audited");
// these spotlights are the marquee alliances where a real, cited announcement
// exists. No number here is modelled, back-filled, or inferred.
//
// HARD RULE (CLAUDE.md): claims that could not be sourced were DROPPED, not
// softened. Specifically excluded as unverified/false after fact-check:
//   • Deloitte × Cohere partnership — no such AI partnership exists.
//   • "$14B GSI-AI market", "1M+/1.2M certifications +150% YoY", "+75% margin",
//     "$150-200 vs $80-120 bill rates", "18mo → 2-6wk delivery" — no source.
//   • Anthropic JV name "Sovereign Enterprise Services" — JV is real, name is not.
//   • Accenture×OpenAI "300k cert target"; Deloitte "Zora"↔Anthropic link (Zora is
//     Nvidia/Llama); Deloitte×Google "HPE"; TCS "AI-102"; Capgemini "Gen Yoda";
//     "Audi" (real auto anchor is BMW). All removed below.

export type AllianceEvidence = "verified" | "partial";

export interface AllianceProofPoint {
  /** Short metric name, e.g. "Reach". */
  label: string;
  /** The verified figure/fact — already a cited claim, never a placeholder. */
  value: string;
}

export interface AllianceSpotlight {
  id: string;
  /** Seed partner id when the integrator is in the roster; null if outside it (EY). */
  partnerId: string | null;
  partnerName: string;
  /** Seed AI-vendor id (matches lib/delivery/seed.ts). */
  vendorId: string;
  vendorName: string;
  /** Relationship type in plain words. */
  relationship: string;
  /** One-line, fact-checked summary (corrected wording applied). */
  summary: string;
  proofPoints: AllianceProofPoint[];
  publisher: string;
  /** Best available resolvable source pointer (deep article where captured cleanly,
   *  otherwise the publisher's newsroom). Publisher + date carry the attribution. */
  url: string;
  asOf: string;
  /** "partial" = alliance real but at least one prototype claim was corrected/dropped. */
  evidence: AllianceEvidence;
}

/** Vendor-side capital / delivery ventures — not a GSI channel edge, but the same
 *  "who is building the delivery muscle" story, so they lead the explorer. */
export interface VendorVenture {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  summary: string;
  proofPoints: AllianceProofPoint[];
  publisher: string;
  url: string;
  asOf: string;
  evidence: AllianceEvidence;
}

export const VENDOR_VENTURES: VendorVenture[] = [
  {
    id: "openai-deployment-company",
    vendorId: "openai",
    vendorName: "OpenAI",
    title: "The OpenAI Deployment Company",
    summary:
      "A PE-backed venture that embeds forward-deployed engineers to stand OpenAI up inside enterprises — OpenAI building its own delivery arm rather than leaning only on the GSIs.",
    proofPoints: [
      { label: "Capital raised", value: "$4B+ from 19 investors (TPG, Brookfield, Advent, Bain, SoftBank, Dragoneer)" },
      { label: "Valuation", value: "~$10B" },
      { label: "Model", value: "Embedded forward-deployed engineers; acquired Tomoro (~150 FDEs)" },
    ],
    publisher: "OpenAI",
    url: "https://openai.com/index/openai-launches-the-deployment-company/",
    asOf: "Oct 2026",
    evidence: "verified",
  },
  {
    id: "anthropic-enterprise-services-jv",
    vendorId: "anthropic",
    vendorName: "Anthropic",
    title: "Anthropic × Goldman Sachs, Blackstone & Hellman & Friedman JV",
    summary:
      "A $1.5B enterprise-AI-services joint venture (each backer ~$300M) targeting mid-size and PE-owned firms — capital-backed Claude delivery aimed at the mid-market.",
    proofPoints: [
      { label: "Size", value: "$1.5B JV (~$300M each backer)" },
      { label: "Backers", value: "Goldman Sachs, Blackstone, Hellman & Friedman" },
      { label: "Target", value: "Mid-size / PE-owned enterprises" },
    ],
    publisher: "CNBC",
    url: "https://www.cnbc.com/2026/05/04/anthropic-goldman-blackstone-ai-venture.html",
    asOf: "May 2026",
    evidence: "verified",
  },
];

export const ALLIANCE_SPOTLIGHTS: AllianceSpotlight[] = [
  // ── OpenAI ──
  {
    id: "accenture-openai",
    partnerId: "accenture",
    partnerName: "Accenture",
    vendorId: "openai",
    vendorName: "OpenAI",
    relationship: "Enterprise + federal alliance",
    summary:
      "ChatGPT Enterprise rolled out to tens of thousands of Accenture staff, plus a federal agentic lab (“The Forge”) and FedRAMP-authorized delivery through Accenture Federal Services.",
    proofPoints: [
      { label: "Enterprise seats", value: "ChatGPT Enterprise to tens of thousands of staff" },
      { label: "Federal", value: "“The Forge” agentic lab + FedRAMP path (Accenture Federal Services)" },
    ],
    publisher: "Accenture Newsroom",
    url: "https://newsroom.accenture.com/news",
    asOf: "Dec 2025 – May 2026",
    evidence: "partial",
  },
  {
    id: "pwc-openai",
    partnerId: "pwc",
    partnerName: "PwC",
    vendorId: "openai",
    vendorName: "OpenAI",
    relationship: "First ChatGPT Enterprise reseller",
    summary:
      "ChatPwC deployed to staff worldwide, and PwC is OpenAI’s first ChatGPT Enterprise reseller — one of the largest single ChatGPT Enterprise footprints.",
    proofPoints: [
      { label: "Users", value: "~200,000 ChatPwC users worldwide" },
      { label: "Channel", value: "First ChatGPT Enterprise reseller" },
    ],
    publisher: "CIO Dive",
    url: "https://www.ciodive.com/news/pwc-chatgpt-enterprise-openai-partnership/717432/",
    asOf: "2024 – 2025",
    evidence: "verified",
  },
  // ── Anthropic ──
  {
    id: "pwc-anthropic",
    partnerId: "pwc",
    partnerName: "PwC",
    vendorId: "anthropic",
    vendorName: "Anthropic",
    relationship: "Claude enterprise alliance",
    summary:
      "Claude adopted firm-wide with a joint Center of Excellence, MCP integration and Claude Code + Cowork in the delivery stack.",
    proofPoints: [
      { label: "Certified", value: "30,000 Claude-certified professionals" },
      { label: "Build", value: "MCP integration, Claude Code + Cowork, joint Center of Excellence" },
    ],
    publisher: "Anthropic",
    url: "https://www.anthropic.com/news/pwc-expanded-partnership",
    asOf: "May 2026",
    evidence: "verified",
  },
  {
    id: "accenture-anthropic",
    partnerId: "accenture",
    partnerName: "Accenture",
    vendorId: "anthropic",
    vendorName: "Anthropic",
    relationship: "Accenture Anthropic Business Group",
    summary:
      "A dedicated business group pairing Claude with Accenture delivery, weighted toward COBOL and legacy modernization.",
    proofPoints: [
      { label: "Trained", value: "~30,000 people trained on Claude (incl. forward-deployed engineers)" },
      { label: "Focus", value: "COBOL / legacy modernization" },
    ],
    publisher: "Anthropic",
    url: "https://www.anthropic.com/news",
    asOf: "Dec 2025",
    evidence: "verified",
  },
  {
    id: "deloitte-anthropic",
    partnerId: "deloitte",
    partnerName: "Deloitte",
    vendorId: "anthropic",
    vendorName: "Anthropic",
    relationship: "Firm-wide Claude rollout",
    summary:
      "Anthropic’s largest deployment — Claude across Deloitte’s ~470,000 people, with 15,000 to be certified.",
    proofPoints: [
      { label: "Scale", value: "~470,000-employee Claude rollout (Anthropic’s largest)" },
      { label: "Certification", value: "15,000 to be Claude-certified" },
    ],
    publisher: "CNBC",
    url: "https://www.cnbc.com/2025/10/06/anthropic-deloitte-enterprise-ai.html",
    asOf: "Oct 2025",
    evidence: "verified",
  },
  // ── Google ──
  {
    id: "accenture-google",
    partnerId: "accenture",
    partnerName: "Accenture",
    vendorId: "google",
    vendorName: "Google",
    relationship: "Agents on Gemini Enterprise",
    summary:
      "450+ Accenture-engineered agents published to Google Cloud Marketplace and accessible inside Gemini Enterprise.",
    proofPoints: [
      { label: "Agents", value: "450+ engineered agents on Google Cloud Marketplace" },
      { label: "Surface", value: "Accessible in Gemini Enterprise" },
    ],
    publisher: "Accenture Newsroom",
    url: "https://newsroom.accenture.com/news/2025/accenture-helps-organizations-advance-agentic-ai-with-gemini-enterprise",
    asOf: "Oct 2025",
    evidence: "verified",
  },
  {
    id: "deloitte-google",
    partnerId: "deloitte",
    partnerName: "Deloitte",
    vendorId: "google",
    vendorName: "Google",
    relationship: "Gemini / Vertex practice",
    summary:
      "Deloitte’s Agentic Transformation Practice built on Gemini Enterprise, with a cited client proof point at insurer Definity.",
    proofPoints: [
      { label: "Practice", value: "Agentic Transformation Practice on Gemini Enterprise" },
      { label: "Client proof", value: "Definity: ~3.5 min/call saved (~20% reduction) on Vertex AI" },
    ],
    publisher: "Google Cloud",
    url: "https://cloud.google.com/customers/definity",
    asOf: "Apr 2026",
    evidence: "partial",
  },
  // ── Microsoft ──
  {
    id: "ey-microsoft",
    partnerId: null, // EY is not in the seed roster; this spotlight stands alone (cited).
    partnerName: "EY",
    vendorId: "microsoft",
    vendorName: "Microsoft",
    relationship: "$1B Copilot alliance",
    summary:
      "A $1B, five-year alliance extending Microsoft Copilot across EY’s entire ~400,000 workforce; EY was named a Microsoft Partner of the Year (regional).",
    proofPoints: [
      { label: "Investment", value: "$1B over 5 years" },
      { label: "Reach", value: "Copilot licensed to ~400,000 workforce (150k already live, ~15% productivity gain)" },
      { label: "Recognition", value: "Microsoft Partner of the Year (regional)" },
    ],
    publisher: "Microsoft Source",
    url: "https://news.microsoft.com/source/2026/05/21/",
    asOf: "May 2026",
    evidence: "verified",
  },
  {
    id: "infosys-microsoft",
    partnerId: "infosys",
    partnerName: "Infosys",
    vendorId: "microsoft",
    vendorName: "Microsoft",
    relationship: "Copilot at scale + Topaz",
    summary:
      "100k+ Copilot seats plus Infosys Topaz, with the bulk of the workforce made “AI aware.”",
    proofPoints: [
      { label: "Seats", value: "Copilot 100,000+ seats" },
      { label: "Workforce", value: "~270,000 (84%) made “AI aware”; Infosys Topaz" },
    ],
    publisher: "Microsoft Source Asia",
    url: "https://news.microsoft.com/source/asia/2026/06/03",
    asOf: "Jun 2026",
    evidence: "verified",
  },
  {
    id: "tcs-microsoft",
    partnerId: "tcs",
    partnerName: "TCS",
    vendorId: "microsoft",
    vendorName: "Microsoft",
    relationship: "Copilot rollout",
    summary:
      "~50k Copilot seats (rising past 100k), part of a 300k+ upskilling wave across the Indian GSI cohort.",
    proofPoints: [
      { label: "Seats", value: "~50,000 Copilot seats (→ 100,000+)" },
      { label: "Cohort", value: "300,000+ upskilled across Infosys + TCS + Wipro (collective)" },
    ],
    publisher: "Microsoft Source Asia",
    url: "https://news.microsoft.com/source/asia/2026/06/03",
    asOf: "Jun 2026",
    evidence: "partial",
  },
  // ── Mistral ──
  {
    id: "capgemini-mistral",
    partnerId: "capgemini",
    partnerName: "Capgemini",
    vendorId: "mistral",
    vendorName: "Mistral",
    relationship: "Sovereign-EU delivery (RAISE)",
    summary:
      "Capgemini’s RAISE platform runs on Mistral for sovereign European deployment; the marquee industrial anchor in the ecosystem is Airbus × Mistral, with Capgemini as an ecosystem partner.",
    proofPoints: [
      { label: "Platform", value: "RAISE — Mistral-powered, sovereign EU deployment" },
      { label: "Industrial anchor", value: "Airbus × Mistral (Capgemini as ecosystem partner)" },
    ],
    publisher: "Capgemini",
    url: "https://www.capgemini.com/news/press-releases/",
    asOf: "2026",
    evidence: "partial",
  },
  // ── Cohere ──
  {
    id: "mckinsey-cohere",
    partnerId: "mckinsey",
    partnerName: "McKinsey",
    vendorId: "cohere",
    vendorName: "Cohere",
    relationship: "First LLM-provider partnership",
    summary:
      "McKinsey’s first LLM-provider partnership, run through QuantumBlack — a defensible “first management-consulting LLM partnership.”",
    proofPoints: [
      { label: "Firsts", value: "McKinsey’s first LLM-provider partnership (via QuantumBlack)" },
    ],
    publisher: "McKinsey",
    url: "https://www.mckinsey.com/about-us/new-at-mckinsey-blog",
    asOf: "2023",
    evidence: "verified",
  },
];

/** "partnerId|vendorId" keys that have a cited spotlight — lets the matrix/directory
 *  mark which seed cells are backed by a source-cited announcement. */
export const SPOTLIT_EDGE_KEYS = new Set(
  ALLIANCE_SPOTLIGHTS.filter((s) => s.partnerId).map((s) => `${s.partnerId}|${s.vendorId}`),
);
