// AI/tech news RSS sources — market-intelligence layer.
// These feeds are fetched by market-news-runner.ts and written directly to
// IntelligenceNewsItem (not EvidenceProposal — these are market signals, not
// structured vendor evidence). Haiku batch-scores each item for relevance and
// tags which tracked vendors are mentioned before the upsert.

export type AiNewsCategory =
  | "news"        // AI press / tech-news desks
  | "commentary"  // independent analyst + expert newsletters
  | "testing"     // model evaluation / benchmarking / eval-lab sites
  | "analyst"     // enterprise-AI analyst + VC + market-research
  | "infrastructure"; // GPU/datacenter/inference-capacity trade press + neocloud vendor blogs

export interface AiNewsSource {
  feedUrl: string;
  sourceName: string;
  category: AiNewsCategory;
  tier: "tier1" | "tier2";   // tier1 = flagship/high-signal; tier2 = broader
  notes?: string;
}

// Curated AI/enterprise-tech RSS feeds — all free, no API key required.
// Every URL curl-verified live (HTTP 200 + parseable feed with items) on
// 2026-06-16. arXiv cs.AI/cs.LG firehoses were deliberately EXCLUDED: they emit
// dozens of papers daily, which would crowd out news/commentary under the
// scorer's cap and aren't "testing sites". The market-news runner applies a
// per-feed cap so high-volume desks can't dominate the slower, high-signal
// commentary either.
export const AI_NEWS_SOURCES: AiNewsSource[] = [
  // ── AI press / tech-news desks ────────────────────────────────────────────
  { feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/", sourceName: "TechCrunch AI", category: "news", tier: "tier1" },
  { feedUrl: "https://venturebeat.com/category/ai/feed/", sourceName: "VentureBeat AI", category: "news", tier: "tier1" },
  { feedUrl: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", sourceName: "The Verge — AI", category: "news", tier: "tier1" },
  { feedUrl: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml", sourceName: "ZDNET AI", category: "news", tier: "tier1" },
  // Verified 2026-06-16: /feed/category/science/... 404s; /feed/tag/ai is live.
  { feedUrl: "https://www.wired.com/feed/tag/ai/latest/rss", sourceName: "Wired AI", category: "news", tier: "tier2" },
  // Verified 2026-06-16: emergent_tech path 404s; software/ai_ml is live (Atom).
  { feedUrl: "https://www.theregister.com/software/ai_ml/headlines.atom", sourceName: "The Register — AI", category: "news", tier: "tier2", notes: "Enterprise AI deals + critical analysis" },
  { feedUrl: "https://www.infoworld.com/feed/", sourceName: "InfoWorld", category: "news", tier: "tier2", notes: "Enterprise software / developer-angle AI" },
  { feedUrl: "https://arstechnica.com/ai/feed/", sourceName: "Ars Technica AI", category: "news", tier: "tier2" },

  // ── Independent AI industry commentary / expert newsletters ───────────────
  { feedUrl: "https://stratechery.com/feed/", sourceName: "Stratechery (Ben Thompson)", category: "commentary", tier: "tier1", notes: "Flagship tech-strategy analysis" },
  { feedUrl: "https://importai.substack.com/feed", sourceName: "Import AI (Jack Clark)", category: "commentary", tier: "tier1", notes: "Frontier-research analysis; very high signal" },
  { feedUrl: "https://www.latent.space/feed", sourceName: "Latent Space", category: "commentary", tier: "tier1", notes: "AI engineering + daily AINews" },
  { feedUrl: "https://www.interconnects.ai/feed", sourceName: "Interconnects (Nathan Lambert)", category: "commentary", tier: "tier1", notes: "Frontier-model + RL post-training depth" },
  { feedUrl: "https://www.platformer.news/rss/", sourceName: "Platformer (Casey Newton)", category: "commentary", tier: "tier1", notes: "Tech-platform + AI policy" },
  { feedUrl: "https://www.oneusefulthing.org/feed", sourceName: "One Useful Thing (Ethan Mollick)", category: "commentary", tier: "tier1", notes: "Applied AI for work + education" },
  { feedUrl: "https://www.exponentialview.co/feed", sourceName: "Exponential View (Azeem Azhar)", category: "commentary", tier: "tier1", notes: "Macro tech-and-society lens" },
  { feedUrl: "https://www.understandingai.org/feed", sourceName: "Understanding AI (Timothy B. Lee)", category: "commentary", tier: "tier2", notes: "Explanatory AI reporting" },
  { feedUrl: "https://garymarcus.substack.com/feed", sourceName: "Marcus on AI (Gary Marcus)", category: "commentary", tier: "tier2", notes: "Skeptical counterweight on hype + policy" },
  { feedUrl: "https://lastweekin.ai/feed", sourceName: "Last Week in AI", category: "commentary", tier: "tier2", notes: "Weekly roundup + editorial" },
  { feedUrl: "https://www.technologyreview.com/topic/artificial-intelligence/feed", sourceName: "MIT Tech Review — AI", category: "commentary", tier: "tier1", notes: "The Algorithm coverage" },

  // ── AI testing / evaluation / benchmarking sites ──────────────────────────
  { feedUrl: "https://huggingface.co/blog/feed.xml", sourceName: "Hugging Face Blog", category: "testing", tier: "tier1", notes: "Model eval + training posts" },
  { feedUrl: "https://epochai.substack.com/feed", sourceName: "Epoch AI", category: "testing", tier: "tier1", notes: "AI trends, benchmarks, capability analysis" },
  { feedUrl: "https://mlcommons.org/feed/", sourceName: "MLCommons / MLPerf", category: "testing", tier: "tier1", notes: "MLPerf benchmark releases" },
  { feedUrl: "https://metr.org/feed.xml", sourceName: "METR", category: "testing", tier: "tier1", notes: "Frontier capability + risk evals" },
  { feedUrl: "https://arena.ai/blog/rss/", sourceName: "LMArena (Chatbot Arena)", category: "testing", tier: "tier1", notes: "Leaderboard + eval research" },
  { feedUrl: "https://allenai.org/rss.xml", sourceName: "Allen Institute for AI (Ai2)", category: "testing", tier: "tier2", notes: "OLMo eval + open-model research" },

  // ── Enterprise-AI analyst / VC / market research ──────────────────────────
  { feedUrl: "https://www.sequoiacap.com/feed/", sourceName: "Sequoia Capital", category: "analyst", tier: "tier1", notes: "AI thesis + portfolio strategy" },
  { feedUrl: "https://www.cbinsights.com/research/feed/", sourceName: "CB Insights Research", category: "analyst", tier: "tier1", notes: "Vendor market-map research" },
  { feedUrl: "https://feeds.bloomberg.com/technology/news.rss", sourceName: "Bloomberg Technology", category: "analyst", tier: "tier1", notes: "AI deal + market coverage" },
  { feedUrl: "https://siliconangle.com/feed/", sourceName: "SiliconANGLE", category: "analyst", tier: "tier2", notes: "Enterprise cloud + AI infra, funding" },
  { feedUrl: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss", sourceName: "IEEE Spectrum AI", category: "analyst", tier: "tier2", notes: "Technical-depth AI coverage" },

  // ── GPU / datacenter / inference-capacity ─────────────────────────────────
  // Added 2026-07-30. The Neocloud & inference category (Groq, Together AI,
  // Lambda, CoreWeave) had NO feed that routinely covers it: the desks above
  // report model launches and enterprise deals, not GPU supply, capacity
  // buildout or inference unit economics — which is what actually moves these
  // vendors. Every URL below curl-verified 2026-07-30 (HTTP 200 + parseable
  // feed with items), same bar as the rest of this file.
  //
  // Trade press first — independent, and the only sources here that will report
  // badly on a vendor. The vendor blogs after are primary sources: useful for
  // capacity/product facts, but they are marketing and the scorer should treat
  // them as such, never as independent corroboration.
  { feedUrl: "https://www.nextplatform.com/feed/", sourceName: "The Next Platform", category: "infrastructure", tier: "tier1", notes: "HPC/datacenter + AI silicon economics; deepest independent neocloud coverage" },
  { feedUrl: "https://semianalysis.com/feed/", sourceName: "SemiAnalysis", category: "infrastructure", tier: "tier1", notes: "GPU supply, datacenter cost models, inference unit economics" },
  { feedUrl: "https://www.datacenterdynamics.com/en/rss/", sourceName: "Data Center Dynamics", category: "infrastructure", tier: "tier2", notes: "Capacity buildout, power, site announcements" },
  { feedUrl: "https://blogs.nvidia.com/feed/", sourceName: "NVIDIA Blog", category: "infrastructure", tier: "tier2", notes: "Supply side — every neocloud here depends on NVIDIA silicon" },
  // Vendor primary sources — first-party, treat as claims not evidence.
  { feedUrl: "https://www.together.ai/blog/rss.xml", sourceName: "Together AI Blog", category: "infrastructure", tier: "tier2", notes: "Vendor primary — Together AI" },
  { feedUrl: "https://lambda.ai/blog/rss.xml", sourceName: "Lambda Blog", category: "infrastructure", tier: "tier2", notes: "Vendor primary — Lambda" },
  { feedUrl: "https://www.coreweave.com/blog/rss.xml", sourceName: "CoreWeave Blog", category: "infrastructure", tier: "tier2", notes: "Vendor primary — CoreWeave" },
  // GAP, deliberately not filled: Groq publishes no working feed. groq.com/blog/rss.xml
  // 404s and groq.com/feed returns HTTP 200 with ZERO items — a 200 alone is not a
  // feed, and adding a URL that yields nothing would look like coverage we do not
  // have. Groq is therefore covered only by the trade press above. Re-check
  // periodically; if a real feed appears, add it here.
];

// Tracked vendor names for Haiku mention-matching.
// Key = vendorId as used across the app (BARE ids — INTELLIGENCE_VENDORS,
// COMPETITIVE_TARGETS, and IntelligenceNewsItem.vendors all use bare "openai",
// NOT "vendor_openai"). Value = display name shown to Haiku for matching.
// Keep this aligned with lib/intelligence/seed.ts INTELLIGENCE_VENDORS so a
// tagged item associates with a real vendor on profiles, momentum, and filters.
export const TRACKED_VENDOR_NAMES: Record<string, string> = {
  openai:     "OpenAI",
  microsoft:  "Microsoft",
  google:     "Google",
  anthropic:  "Anthropic",
  aws:        "AWS",
  salesforce: "Salesforce",
  servicenow: "ServiceNow",
  oracle:     "Oracle",
  sap:        "SAP",
  ibm:        "IBM",
  cohere:     "Cohere",
  mistral:    "Mistral",
  glean:      "Glean",
  moveworks:  "Moveworks",
  writer:     "Writer",
  hebbia:     "Hebbia",
  rogo:       "Rogo",
  harvey:     "Harvey",
  databricks: "Databricks",
  snowflake:  "Snowflake",
  meta:       "Meta",
  deepseek:   "DeepSeek",
  alibaba:    "Alibaba",
  moonshot:   "Moonshot",
  minimax:    "MiniMax",
  ai21:       "AI21",
  xai:        "xAI",
  perplexity: "Perplexity",
  nvidia:     "NVIDIA",
  // ── Neocloud & inference ──────────────────────────────────────────────────
  // Added 2026-07-30. These four were ranked in the Neocloud & inference
  // category but were MISSING from this map — which is the real reason the
  // category looked starved. This map is what the Haiku scorer is given as the
  // set of vendors it may tag; a vendor absent from it can never be attributed
  // to a story, however many feeds mention it. Adding feeds without this would
  // have changed nothing.
  // ⚠️ Keys are BARE SPINE vendor ids (COMPETITIVE_TARGETS.vendorId), NOT entity
  // slugs. The two differ for exactly the vendors carrying a product suffix —
  // lib/intelligence/vendor-id.ts maps entity "together-ai" → spine "together",
  // "fireworks-ai" → "fireworks", "zhipu-glm" → "zai", "alibaba-qwen" →
  // "alibaba", "moonshot-kimi" → "moonshot".
  groq:      "Groq",
  together:  "Together AI",
  lambda:    "Lambda",
  coreweave: "CoreWeave",

  // ── Silicon, sovereign AI and the rest of the live roster ─────────────────
  // Added 2026-08-02 after the owner reported "not all vendors are featured in
  // the news ingestion". They were right, and measurably so: 33 of the 41
  // vendors on the live roster were listed here, so 10 could never be attributed
  // to a story no matter what the feeds carried.
  //
  // Names are taken verbatim from COMPETITIVE_TARGETS (lib/intelligence/
  // competitive-targets.ts), which already curates a name + aliases per vendor,
  // rather than being invented here. The two slashed entries are reduced to
  // their primary company name so Haiku echoes something matchable:
  // "Zhipu / Z.ai" → "Zhipu AI", "G42 / Falcon" → "G42".
  //
  // This lets a story be TAGGED. It does not conjure stories — coverage still
  // depends on a feed actually carrying the item, so expect thinner volume for
  // sovereign-AI names than for the frontier labs.
  amd:       "AMD",
  broadcom:  "Broadcom",
  tsmc:      "TSMC",
  cerebras:  "Cerebras",
  fireworks: "Fireworks AI",
  nscale:    "Nscale",
  g42:       "G42",
  humain:    "HUMAIN",
  zai:       "Zhipu AI",
  sakana:    "Sakana AI",
};
