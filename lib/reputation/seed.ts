// Reputation tracker — seed dataset.
// ──────────────────────────────────
// Three pillars per the May-2026 product brief:
//
//   developer   — github / reddit / forums where DEVELOPERS USING the
//                 vendor's models report on developer experience.
//                 NOT employees of the vendor.
//
//   employee    — glassdoor / forums / linkedin / tribunal filings.
//                 Variables: work-life balance, culture, litigation,
//                 career growth, compensation.
//
//   customer    — average downtime, value for money, customer service,
//                 responsiveness, quality of service. Sourced from
//                 G2 / Capterra / TrustRadius + status-page archives.
//
// Every score below is SEED until real ingestion is wired (Glassbridge
// for Glassdoor, GitHub API for repo signals, Reddit Pushshift for
// sentiment, Statuspage history for uptime). The structure is built
// to swap in verified scores per-cell without UI changes.

export interface DeveloperReputation {
  vendorId: string;
  // 0-100 composite from each source. Sources cited in `sources`.
  githubScore: number;        // stars + activity + issue-response cadence
  redditSentiment: number;    // r/LocalLLaMA, r/MachineLearning, r/OpenAI etc.
  forumScore: number;         // HackerNews, devforum, stackoverflow signal
  apiReliability: number;     // self-reported API issues from devs
  documentationScore: number; // dev-facing docs quality
  overall: number;
  primaryThemes: string[];    // 1-3 short bullets — top devs talk about
  sources: string[];          // attribution URLs / forums
  dataStatus: "seed" | "documented" | "verified";
}

export interface EmployeeReputation {
  vendorId: string;
  workLifeBalance: number;
  culture: number;
  litigationCount: number;    // recent named tribunal / EEOC filings (lower better)
  litigationScore: number;    // 0-100 derived from count + severity
  careerGrowth: number;
  compensation: number;
  overall: number;
  primaryThemes: string[];
  sources: string[];
  dataStatus: "seed" | "documented" | "verified";
}

export interface CustomerReputation {
  vendorId: string;
  averageUptimePct: number;   // service availability over last 12mo
  valueForMoney: number;
  customerService: number;
  responsiveness: number;
  qualityOfService: number;
  overall: number;
  primaryThemes: string[];
  sources: string[];
  dataStatus: "seed" | "documented" | "verified";
}

// ──────────────── Helpers ────────────────

function dev(
  vendorId: string,
  github: number, reddit: number, forum: number, api: number, docs: number,
  themes: string[], sources: string[],
): DeveloperReputation {
  const overall = Math.round((github + reddit + forum + api + docs) / 5);
  return {
    vendorId,
    githubScore: github,
    redditSentiment: reddit,
    forumScore: forum,
    apiReliability: api,
    documentationScore: docs,
    overall,
    primaryThemes: themes,
    sources,
    dataStatus: "seed",
  };
}

function emp(
  vendorId: string,
  wlb: number, culture: number, litCount: number, careerGrowth: number, comp: number,
  themes: string[], sources: string[],
): EmployeeReputation {
  // Litigation score: 100 if zero filings, drops 8 points per filing,
  // floored at 30. Tribunal cases are public-record so this is the
  // cell most likely to flip to "verified" first.
  const litigationScore = Math.max(30, 100 - litCount * 8);
  const overall = Math.round((wlb + culture + litigationScore + careerGrowth + comp) / 5);
  return {
    vendorId,
    workLifeBalance: wlb,
    culture,
    litigationCount: litCount,
    litigationScore,
    careerGrowth,
    compensation: comp,
    overall,
    primaryThemes: themes,
    sources,
    dataStatus: "seed",
  };
}

function cust(
  vendorId: string,
  uptime: number, vfm: number, service: number, resp: number, quality: number,
  themes: string[], sources: string[],
): CustomerReputation {
  // Uptime feeds the overall as a 0-100 score (uptime% already 0-100).
  const overall = Math.round((uptime + vfm + service + resp + quality) / 5);
  return {
    vendorId,
    averageUptimePct: uptime,
    valueForMoney: vfm,
    customerService: service,
    responsiveness: resp,
    qualityOfService: quality,
    overall,
    primaryThemes: themes,
    sources,
    dataStatus: "seed",
  };
}

// ──────────────── Seed scores per vendor ────────────────
// Vendor ids match the INTELLIGENCE_VENDORS spine so the same vendor
// chip / profile link works across surfaces. Themes are short — they
// drive the "What devs talk about" / "What employees say" / "What
// customers like" sub-panels.

export const DEVELOPER_REPUTATION: DeveloperReputation[] = [
  dev("openai", 92, 78, 84, 70, 86,
    ["Strong SDK + community", "Pricing volatility complaints", "Rate-limit frustration during peaks"],
    ["github.com/openai", "reddit.com/r/OpenAI", "news.ycombinator.com"]),
  dev("anthropic", 90, 88, 90, 86, 90,
    ["Claude Code praised as default IDE assistant", "Best-in-class coding benchmarks", "Tool-use stable"],
    ["github.com/anthropics", "reddit.com/r/ClaudeAI", "news.ycombinator.com"]),
  dev("google", 82, 72, 76, 78, 82,
    ["Gemini API quality improving", "Vertex setup friction", "Multimodal lead recognised"],
    ["github.com/google-gemini", "reddit.com/r/Bard", "ai.google.dev"]),
  dev("microsoft", 80, 68, 78, 78, 84,
    ["Azure OpenAI well-documented", "Copilot Studio devex polished", "Foundry partner-model gaps"],
    ["github.com/Azure", "reddit.com/r/AZURE"]),
  dev("aws", 78, 72, 80, 82, 80,
    ["Bedrock model choice praised", "AWS IAM friction common", "Stable, deep tooling"],
    ["github.com/aws", "reddit.com/r/aws"]),
  dev("meta", 88, 86, 80, 70, 78,
    ["Llama open-weights huge community", "Self-hosting wins on cost", "Inference quality variable"],
    ["github.com/meta-llama", "reddit.com/r/LocalLLaMA"]),
  dev("mistral", 84, 82, 78, 76, 78,
    ["Strong Codestral adoption", "European-sovereign positioning", "Some API-stability complaints"],
    ["github.com/mistralai", "reddit.com/r/MistralAI"]),
  dev("cohere", 70, 66, 70, 76, 80,
    ["Enterprise positioning narrows community", "Rerank/Embed quality strong", "Less retail dev mindshare"],
    ["github.com/cohere-ai", "reddit.com/r/cohere"]),
  dev("deepseek", 86, 84, 76, 72, 70,
    ["Cost-per-quality praised loudly", "Reasoning benchmarks strong", "Compliance hesitation in regulated buyers"],
    ["github.com/deepseek-ai", "reddit.com/r/LocalLLaMA"]),
  dev("xai", 70, 68, 64, 60, 62,
    ["Compute scale impressive", "Tooling still maturing", "Devex inconsistent vs frontier set"],
    ["docs.x.ai", "reddit.com/r/grok"]),
  dev("databricks", 80, 72, 78, 80, 84,
    ["Mosaic AI strong for build workflows", "Complex setup for non-data teams"],
    ["github.com/databricks", "community.databricks.com"]),
  dev("snowflake", 74, 68, 74, 80, 78,
    ["Cortex API simple", "Arctic adoption growing", "Locked to data-cloud first"],
    ["github.com/Snowflake-Labs", "community.snowflake.com"]),
];

export const EMPLOYEE_REPUTATION: EmployeeReputation[] = [
  emp("openai", 60, 65, 4, 78, 92,
    ["Mission alignment strong", "High turnover post-2024 governance events", "Top-of-market comp"],
    ["glassdoor.com/Overview/Working-at-OpenAI", "linkedin.com/company/openai"]),
  emp("anthropic", 76, 84, 0, 80, 90,
    ["Smaller team, less turnover", "Safety-first culture cited as a draw", "Strong comp + equity"],
    ["glassdoor.com/Overview/Working-at-Anthropic", "linkedin.com/company/anthropic"]),
  emp("google", 78, 72, 6, 76, 88,
    ["Process-heavy but stable", "Recent layoffs noted in reviews", "Top-tier comp + benefits"],
    ["glassdoor.com/Overview/Working-at-Google", "blind"]),
  emp("microsoft", 82, 78, 5, 78, 86,
    ["Strong work-life balance reputation", "Career mobility good", "Comp competitive"],
    ["glassdoor.com/Overview/Working-at-Microsoft", "blind"]),
  emp("aws", 64, 60, 8, 72, 86,
    ["High-intensity culture flagged", "PIP fear common in reviews", "Comp strong but conditional"],
    ["glassdoor.com/Overview/Working-at-Amazon", "blind"]),
  emp("meta", 70, 68, 7, 76, 90,
    ["Layoff cycles in reviews", "Comp top-of-market", "Performance bar tightened post-2023"],
    ["glassdoor.com/Overview/Working-at-Meta", "blind"]),
  emp("mistral", 80, 82, 0, 74, 78,
    ["European base + remote-friendly", "Growing fast, scope expansion possible", "Comp solid for Paris"],
    ["glassdoor.com/Overview/Working-at-Mistral-AI"]),
  emp("cohere", 78, 80, 0, 72, 76,
    ["Smaller team, broad scope", "Toronto/SF mix", "Comp competitive but below US frontier labs"],
    ["glassdoor.com/Overview/Working-at-Cohere"]),
  emp("databricks", 76, 76, 2, 80, 86,
    ["Pre-IPO equity narrative", "Strong technical bar", "Fast pace, scaling org pains"],
    ["glassdoor.com/Overview/Working-at-Databricks"]),
  emp("snowflake", 78, 74, 2, 76, 84,
    ["Stable post-IPO", "Sales culture intense", "Engineering comp solid"],
    ["glassdoor.com/Overview/Working-at-Snowflake"]),
  emp("oracle", 64, 58, 12, 64, 70,
    ["Process-heavy reputation", "Career mobility limited", "Litigation history above peer average"],
    ["glassdoor.com/Overview/Working-at-Oracle", "courtlistener.com"]),
  emp("salesforce", 72, 70, 6, 74, 82,
    ["Ohana culture marketed but mixed reviews", "Layoff cycles in 2023-24", "Comp solid"],
    ["glassdoor.com/Overview/Working-at-Salesforce"]),
];

export const CUSTOMER_REPUTATION: CustomerReputation[] = [
  cust("openai", 99.3, 74, 72, 78, 90,
    ["Best-in-class model quality (most reviews)", "Pricing variance complaints", "Outages in 2024-25 noted"],
    ["status.openai.com", "g2.com/products/openai", "trustradius.com"]),
  cust("anthropic", 99.6, 80, 84, 86, 92,
    ["Reasoning + coding quality leads reviews", "Fewer outage incidents", "Slower feature shipping cited"],
    ["status.anthropic.com", "g2.com/products/claude"]),
  cust("google", 99.7, 82, 76, 78, 84,
    ["Vertex AI enterprise polish improving", "Workspace integration valued", "Support response variable"],
    ["status.cloud.google.com", "g2.com/products/google-cloud-vertex-ai"]),
  cust("microsoft", 99.8, 78, 80, 82, 84,
    ["Enterprise procurement praised", "Tenant isolation + audit valued", "Cost-control complaints common"],
    ["status.azure.com", "g2.com/products/microsoft-azure-ai"]),
  cust("aws", 99.85, 76, 78, 80, 84,
    ["Bedrock model choice headline strength", "Support tier matters greatly", "Complex billing"],
    ["health.aws.amazon.com", "g2.com/products/amazon-bedrock"]),
  cust("salesforce", 99.6, 70, 78, 78, 80,
    ["CRM workflow fit valued", "Per-seat pricing flagged", "Service quality varies by region"],
    ["status.salesforce.com", "g2.com/products/salesforce"]),
  cust("servicenow", 99.7, 72, 80, 80, 82,
    ["Strong ITSM workflow value", "Implementation complexity flagged", "Reliable platform"],
    ["status.servicenow.com", "g2.com/products/servicenow"]),
  cust("databricks", 99.5, 78, 78, 80, 84,
    ["Data + AI build workflow praised", "Setup learning curve flagged", "Customer success teams strong"],
    ["status.databricks.com", "g2.com/products/databricks"]),
  cust("snowflake", 99.85, 74, 80, 80, 84,
    ["Reliability outstanding", "Compute cost surprises flagged", "Cortex experience improving"],
    ["status.snowflake.com", "g2.com/products/snowflake"]),
  cust("oracle", 99.6, 64, 72, 70, 76,
    ["Database integration valued", "Procurement experience friction", "Premium pricing"],
    ["status.oraclecloud.com", "g2.com/products/oracle-cloud-infrastructure"]),
  cust("mistral", 99.4, 86, 74, 76, 82,
    ["Cost-per-token praised", "Sovereignty positioning valued", "Smaller support footprint"],
    ["status.mistral.ai", "g2.com/products/mistral-ai"]),
  cust("cohere", 99.7, 80, 80, 80, 82,
    ["Enterprise-tuned support", "Embed/Rerank quality strong", "Less mass-market mindshare"],
    ["status.cohere.com", "g2.com/products/cohere"]),
];

// Index by vendorId for fast lookup in the UI.
export const REPUTATION_INDEX = {
  developer: new Map(DEVELOPER_REPUTATION.map((r) => [r.vendorId, r])),
  employee: new Map(EMPLOYEE_REPUTATION.map((r) => [r.vendorId, r])),
  customer: new Map(CUSTOMER_REPUTATION.map((r) => [r.vendorId, r])),
};

// Union of vendor ids that have at least one reputation score in any
// pillar — drives the vendor list on the page.
export const REPUTATION_VENDOR_IDS = Array.from(
  new Set([
    ...DEVELOPER_REPUTATION.map((r) => r.vendorId),
    ...EMPLOYEE_REPUTATION.map((r) => r.vendorId),
    ...CUSTOMER_REPUTATION.map((r) => r.vendorId),
  ]),
);
