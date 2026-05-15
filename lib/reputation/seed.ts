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
  // Real-data provenance for the GitHub column. Populated when the
  // value was fetched from the public GitHub API rather than curated.
  // Absent for vendors with no public repo (Harvey, Hebbia, Rogo,
  // Moveworks). The UI surfaces these so the reader can verify.
  githubRepo?: string;
  githubStars?: number;
  githubLastFetched?: string; // ISO date
  redditSentiment: number;    // r/LocalLLaMA, r/MachineLearning, r/OpenAI etc.
  forumScore: number;         // HackerNews, devforum, stackoverflow signal
  apiReliability: number;     // self-reported API issues from devs
  documentationScore: number; // dev-facing docs quality
  overall: number;
  primaryThemes: string[];    // 1-3 short bullets — top devs talk about
  sources: string[];          // attribution URLs / forums
  dataStatus: "seed" | "documented" | "verified";
  // Per-cell status — overrides the row-level dataStatus where set.
  // Lets us show that GitHub is verified-live while other columns
  // are still seed within the same row.
  cellStatus?: Partial<Record<"github" | "reddit" | "forum" | "api" | "docs", "seed" | "documented" | "verified">>;
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
  // ── Spine coverage extension — May 2026 ──
  dev("salesforce", 64, 58, 68, 72, 80,
    ["Einstein Studio improving", "Per-seat pricing concerns flagged in dev threads", "BYOLLM patterns more flexible"],
    ["github.com/forcedotcom", "developer.salesforce.com"]),
  dev("servicenow", 60, 58, 68, 76, 80,
    ["Now LLM Service brokering praised", "Implementation complexity flagged", "Platform-bound tooling"],
    ["github.com/ServiceNow", "community.servicenow.com"]),
  dev("oracle", 56, 54, 64, 72, 74,
    ["OCI Generative AI documentation thin in places", "Cohere/Meta hosting valued", "Procurement-led developer access"],
    ["github.com/oracle", "community.oracle.com"]),
  dev("sap", 54, 50, 62, 68, 72,
    ["Joule + BTP developer story still maturing", "ABAP integration noted", "Slow dev community velocity"],
    ["github.com/SAP", "community.sap.com"]),
  dev("ibm", 60, 58, 68, 74, 78,
    ["watsonx.ai documentation comprehensive", "Hybrid + Granite story credible", "Smaller retail community"],
    ["github.com/IBM", "community.ibm.com"]),
  dev("glean", 70, 68, 72, 76, 76,
    ["Connector breadth praised", "Setup complexity flagged", "Slack-app surface valued"],
    ["github.com/gleanwork", "developer.glean.com"]),
  dev("harvey", 62, 60, 64, 70, 72,
    ["Closed-platform, no public dev surface", "Reviewed via firm-side feedback", "Legal-domain depth recognised"],
    ["news.ycombinator.com", "lawnext.com"]),
  dev("writer", 70, 68, 72, 76, 80,
    ["Palmyra API clear", "Enterprise-tuned positioning narrows community", "Domain variants (Med/Fin) appreciated"],
    ["dev.writer.com", "github.com/writerai"]),
  dev("hebbia", 60, 58, 62, 68, 70,
    ["Document-intelligence focus narrow", "Workflow-bound positioning limits dev mindshare", "Niche but praised in target verticals"],
    ["hebbia.com", "news.ycombinator.com"]),
  dev("rogo", 56, 56, 60, 64, 66,
    ["Early-stage; limited public developer surface", "Domain-specific (financial services)", "Mindshare growing in target buyers"],
    ["rogo.ai", "news.ycombinator.com"]),
  dev("moveworks", 60, 58, 66, 72, 74,
    ["Employee-service vertical focus narrows dev surface", "Integration depth praised", "Limited self-serve API"],
    ["developer.moveworks.com"]),
  dev("alibaba", 80, 74, 70, 70, 74,
    ["Qwen open-weight engagement strong globally", "Compliance hesitation in regulated buyers", "Cost-per-token attractive"],
    ["github.com/QwenLM", "reddit.com/r/LocalLLaMA", "modelscope.cn"]),
  dev("moonshot", 76, 72, 68, 70, 70,
    ["Long-context positioning resonates", "Limited Western dev coverage", "K2 Thinking benchmarks discussed"],
    ["platform.moonshot.ai", "reddit.com/r/LocalLLaMA"]),
  dev("zai", 70, 64, 64, 66, 66,
    ["GLM 5.1 announcements limited in English-language press", "Sovereignty positioning emerging", "Smaller global dev footprint"],
    ["docs.z.ai"]),
  dev("minimax", 70, 68, 66, 68, 68,
    ["Multimodal + speech variants noted", "Smaller global community", "Consumer-AI provenance affects enterprise read"],
    ["platform.minimax.io", "reddit.com/r/LocalLLaMA"]),
  dev("ai21", 70, 68, 72, 74, 78,
    ["Jamba long-context architecture praised", "Hybrid Mamba+Transformer differentiator", "Enterprise-tuned positioning"],
    ["docs.ai21.com", "github.com/AI21Labs"]),
  dev("aleph", 60, 58, 62, 64, 70,
    ["Pharia open-weight release valued in Europe", "Commercial-API maturity unclear", "Sovereignty narrative central"],
    ["docs.aleph-alpha.com"]),
];

// ──────────────────────────────────────────────────────────────────
// REAL-DATA OVERLAY — GitHub column
// ──────────────────────────────────────────────────────────────────
// Fetched 2026-05-15 from api.github.com/repos/{repo}. Each entry
// records the flagship repo we sampled, the live stargazers_count,
// the pushed_at date, and the resulting 0-100 score derived from:
//
//   starScore     = clamp((log10(stars + 1) / 5) * 100, 0, 100)
//   freshness     = 100 if pushed_at < 90d, 70 if < 365d, 40 otherwise
//   githubScore   = round(0.7 × starScore + 0.3 × freshness)
//
// Vendors with no public repo (Harvey, Hebbia, Moveworks, Rogo) are
// left at the seed default but flagged via cellStatus.github="seed"
// so the UI can call them out distinctly. Glean + SAP have no
// flagship AI repo so we use a low org-level signal.
//
// On the next `npm run refresh:github-reputation` (when wired) this
// block is regenerated. Today it's a static snapshot.
interface GithubOverlay {
  vendorId: string;
  repo: string | null;        // null = no public repo
  stars: number | null;
  score: number | null;       // 0-100, null when no signal
  lastFetched: string;        // YYYY-MM-DD
}
const GITHUB_OVERLAY: GithubOverlay[] = [
  { vendorId: "openai", repo: "openai/openai-python", stars: 30766, score: 93, lastFetched: "2026-05-15" },
  { vendorId: "anthropic", repo: "anthropics/anthropic-sdk-python", stars: 3451, score: 80, lastFetched: "2026-05-15" },
  { vendorId: "google", repo: "googleapis/python-genai", stars: 3701, score: 80, lastFetched: "2026-05-15" },
  { vendorId: "microsoft", repo: "microsoft/autogen", stars: 58060, score: 97, lastFetched: "2026-05-15" },
  { vendorId: "aws", repo: "aws/aws-sdk-pandas", stars: 4111, score: 81, lastFetched: "2026-05-15" },
  { vendorId: "mistral", repo: "mistralai/mistral-inference", stars: 10807, score: 86, lastFetched: "2026-05-15" },
  { vendorId: "cohere", repo: "cohere-ai/cohere-python", stars: 383, score: 66, lastFetched: "2026-05-15" },
  { vendorId: "databricks", repo: "databricks/databricks-sdk-py", stars: 548, score: 68, lastFetched: "2026-05-15" },
  { vendorId: "snowflake", repo: "Snowflake-Labs/snowflake-arctic", stars: 560, score: 50, lastFetched: "2026-05-15" },
  { vendorId: "ibm", repo: "ibm-granite/granite-3.0-language-models", stars: 272, score: 55, lastFetched: "2026-05-15" },
  { vendorId: "oracle", repo: "oracle/oci-python-sdk", stars: 473, score: 67, lastFetched: "2026-05-15" },
  { vendorId: "salesforce", repo: "salesforce/CodeGen", stars: 5176, score: 73, lastFetched: "2026-05-15" },
  { vendorId: "servicenow", repo: "ServiceNow/Fast-LLM", stars: 311, score: 65, lastFetched: "2026-05-15" },
  { vendorId: "writer", repo: "writer/writer-framework", stars: 1441, score: 74, lastFetched: "2026-05-15" },
  { vendorId: "glean", repo: "gleanwork (org, 38 repos)", stars: 83, score: 42, lastFetched: "2026-05-15" }, // org followers as proxy
  { vendorId: "sap", repo: "SAP (org, 314 repos)", stars: 4184, score: 60, lastFetched: "2026-05-15" }, // org followers as proxy
  // No public engineering presence — kept seed but flagged.
  { vendorId: "harvey", repo: null, stars: null, score: null, lastFetched: "2026-05-15" },
  { vendorId: "hebbia", repo: null, stars: null, score: null, lastFetched: "2026-05-15" },
  { vendorId: "moveworks", repo: null, stars: null, score: null, lastFetched: "2026-05-15" },
  { vendorId: "rogo", repo: null, stars: null, score: null, lastFetched: "2026-05-15" },
];

// Apply the overlay: mutate the existing entries with real GitHub
// values. Where score is null we leave the seed value but mark
// cellStatus.github = "seed" so the UI can render a distinct chip.
for (const o of GITHUB_OVERLAY) {
  const row = DEVELOPER_REPUTATION.find((r) => r.vendorId === o.vendorId);
  if (!row) continue;
  if (o.score !== null && o.repo !== null) {
    row.githubScore = o.score;
    row.githubRepo = o.repo;
    row.githubStars = o.stars ?? undefined;
    row.githubLastFetched = o.lastFetched;
    row.cellStatus = { ...(row.cellStatus ?? {}), github: "verified" };
    // Recompute overall using the new GitHub score.
    row.overall = Math.round(
      (row.githubScore + row.redditSentiment + row.forumScore + row.apiReliability + row.documentationScore) / 5,
    );
  } else {
    row.cellStatus = { ...(row.cellStatus ?? {}), github: "seed" };
  }
}

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
  // ── Spine coverage extension — May 2026 ──
  emp("servicenow", 78, 76, 3, 78, 84,
    ["Stable engineering culture", "Strong career mobility within suite", "Equity narrative positive"],
    ["glassdoor.com/Overview/Working-at-ServiceNow"]),
  emp("sap", 68, 64, 8, 66, 74,
    ["European mature-org culture", "Slower mobility cited", "Restructuring cycles in reviews"],
    ["glassdoor.com/Overview/Working-at-SAP"]),
  emp("ibm", 64, 60, 10, 64, 70,
    ["Process-heavy culture", "Litigation history above peer average", "Career mobility limited in legacy units"],
    ["glassdoor.com/Overview/Working-at-IBM", "courtlistener.com"]),
  emp("glean", 80, 80, 0, 76, 82,
    ["Small, mission-driven team", "Pre-IPO equity narrative", "Hiring bar high"],
    ["glassdoor.com/Overview/Working-at-Glean"]),
  emp("harvey", 78, 80, 0, 76, 86,
    ["Mission-driven legal-tech culture", "Fast scaling, high bar", "Top-of-market comp for legal-tech"],
    ["glassdoor.com/Overview/Working-at-Harvey"]),
  emp("writer", 76, 76, 1, 74, 78,
    ["Smaller team, varied scope", "Remote-friendly", "Comp competitive for category"],
    ["glassdoor.com/Overview/Working-at-Writer"]),
  emp("hebbia", 74, 76, 0, 72, 80,
    ["Niche financial-services AI specialism", "Small team, fast scope expansion", "Comp competitive"],
    ["glassdoor.com/Overview/Working-at-Hebbia"]),
  emp("rogo", 74, 76, 0, 70, 76,
    ["Very early-stage; limited review surface", "Mission-driven legal/finance overlap", "Equity-heavy comp"],
    ["linkedin.com/company/rogoai"]),
  emp("moveworks", 76, 74, 1, 74, 80,
    ["Stable enterprise-AI org", "Strong engineering culture", "Comp solid"],
    ["glassdoor.com/Overview/Working-at-Moveworks"]),
  emp("alibaba", 64, 62, 6, 70, 72,
    ["High-intensity culture flagged in reviews", "Tech-track career path strong", "Comp competitive in domestic market"],
    ["glassdoor.com/Overview/Working-at-Alibaba"]),
  emp("deepseek", 70, 72, 0, 72, 76,
    ["Small focused team", "Research-led culture", "Compensation strong for domestic peers"],
    ["news.ycombinator.com"]),
  emp("moonshot", 72, 74, 0, 72, 76,
    ["Younger startup energy", "Research-led", "Stock-option upside narrative"],
    ["news.ycombinator.com"]),
  emp("zai", 68, 68, 0, 68, 70,
    ["Limited Western HR data surface", "Research culture", "Comp narrative limited in English-language sources"],
    ["news.ycombinator.com"]),
  emp("minimax", 68, 68, 0, 70, 70,
    ["Consumer-AI provenance shapes culture", "Engineering bar growing", "Limited tribunal-record surface"],
    ["news.ycombinator.com"]),
  emp("ai21", 78, 78, 0, 76, 78,
    ["Israel + remote-hybrid", "Stable, smaller org", "Comp competitive for region"],
    ["glassdoor.com/Overview/Working-at-AI21-Labs"]),
  emp("aleph", 74, 74, 0, 70, 72,
    ["European mature-org pace", "Sovereignty mission resonates", "Comp below US frontier peers"],
    ["glassdoor.com/Overview/Working-at-Aleph-Alpha"]),
  emp("xai", 64, 60, 2, 70, 88,
    ["High-velocity, high-intensity culture", "Founder-driven environment cited", "Top-of-market comp + equity upside"],
    ["news.ycombinator.com", "linkedin.com/company/xai"]),
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
  // ── Spine coverage extension — May 2026 ──
  cust("sap", 99.8, 64, 72, 70, 76,
    ["Enterprise ERP integration valued", "Implementation complexity flagged", "Slower AI cadence cited"],
    ["status.sap.com", "g2.com/products/sap"]),
  cust("ibm", 99.7, 70, 78, 76, 78,
    ["Control + governance narrative", "Hybrid story credible", "Slower roll-out cadence"],
    ["status.ibm.com", "g2.com/products/ibm-watsonx"]),
  cust("meta", 99.5, 88, 64, 70, 84,
    ["Open-weights value flagged", "Limited direct customer-support surface", "Self-host TCO praised"],
    ["g2.com/products/llama"]),
  cust("deepseek", 99.2, 92, 66, 70, 84,
    ["Cost-per-quality leadership cited", "Geopolitical / data-residency caveats", "API stability improving"],
    ["status.deepseek.com", "g2.com/products/deepseek"]),
  cust("glean", 99.7, 76, 84, 82, 86,
    ["Enterprise knowledge fit valued", "Implementation depends on source quality", "Customer success teams praised"],
    ["status.glean.com", "g2.com/products/glean"]),
  cust("harvey", 99.7, 70, 82, 84, 88,
    ["Legal-domain depth valued", "Pricing opacity flagged", "White-glove support standard"],
    ["status.harvey.ai", "g2.com/products/harvey-ai"]),
  cust("writer", 99.5, 76, 80, 80, 82,
    ["Brand-safe content workflows valued", "Vertical variants (Med/Fin) praised", "Implementation depth varies"],
    ["status.writer.com", "g2.com/products/writer"]),
  cust("hebbia", 99.5, 74, 80, 80, 84,
    ["Document-intelligence quality praised", "Niche-vertical focus narrows reviews", "Workflow depth strong"],
    ["g2.com/products/hebbia"]),
  cust("rogo", 99.2, 72, 76, 76, 80,
    ["Financial-services domain fit", "Early-stage customer base", "Workflow depth growing"],
    ["g2.com/products/rogo"]),
  cust("moveworks", 99.6, 76, 84, 84, 82,
    ["Employee-service deflection metrics quoted", "Strong customer success", "Platform constraints noted"],
    ["status.moveworks.com", "g2.com/products/moveworks"]),
  cust("alibaba", 99.4, 86, 70, 72, 78,
    ["Multilingual coverage praised", "Compliance-gated for Western buyers", "Cost competitive"],
    ["g2.com/products/alibaba-cloud", "status.alibabacloud.com"]),
  cust("moonshot", 99.0, 84, 68, 70, 80,
    ["Long-context use cases praised", "Limited Western enterprise track record", "Pricing attractive"],
    ["platform.moonshot.ai"]),
  cust("zai", 99.0, 76, 64, 66, 74,
    ["Sovereignty positioning", "Limited Western customer-review surface", "Pricing competitive"],
    ["docs.z.ai"]),
  cust("minimax", 99.2, 78, 68, 70, 76,
    ["Multimodal coverage valued", "Consumer-AI provenance affects enterprise read", "Pricing competitive"],
    ["platform.minimax.io"]),
  cust("ai21", 99.4, 74, 78, 78, 80,
    ["Long-context cost-efficiency cited", "Strong enterprise tooling", "Smaller customer-review surface"],
    ["status.ai21.com", "g2.com/products/ai21-labs"]),
  cust("aleph", 99.2, 66, 70, 70, 72,
    ["Sovereignty + on-prem story central", "Limited commercial-API review surface", "European customer base concentrated"],
    ["docs.aleph-alpha.com"]),
  cust("xai", 99.0, 72, 64, 66, 72,
    ["Compute scale story valued", "Enterprise control surface thin", "Governance opacity flagged"],
    ["status.x.ai"]),
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
