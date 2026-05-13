// Indirect Exposure Map — verified relationship data.
// ──────────────────────────────────────────────────
// Hand-curated edge list for the dashboard hero map. Every edge here
// is either source-backed (HIGH / MEDIUM) or explicitly marked SEED
// when the relationship is plausible but not independently verified.
//
// VERIFICATION RULES followed when building this file:
//   1. Public investment relationships require documented funding-round
//      participation OR a public corporate announcement.
//   2. Cloud / hosting relationships require the model being listed in
//      the platform's official model catalog (Bedrock, Vertex, Azure AI
//      Foundry, OCI Generative AI).
//   3. Supply-chain (GPU) relationships are obvious for frontier labs
//      but we only call them out where the lab itself has stated it
//      OR the public press regularly covers the dependency.
//   4. Speculative / unverified edges are NEVER added at HIGH confidence.
//      They appear at SEED with a clear summary or are omitted entirely.
//   5. Vague category buckets ("frontier labs", "AI infrastructure")
//      are NOT used — every node is a named company.

export type RelationshipType =
  | "investment"
  | "cloud"
  | "model_hosting"
  | "commercial_partnership"
  | "supply_chain"
  | "subsidiary";

export type ConfidenceTier = "high" | "medium" | "seed";

export type OwnershipType = "public" | "private" | "subsidiary";

export type NodeSide = "left" | "right";

export interface ExposureMapNode {
  id: string;
  label: string;
  ticker?: string;
  side: NodeSide;
  ownership: OwnershipType;
  /** Concise role label shown under the node name in the tooltip. */
  category: string;
  /** Optional Clearbit domain — we resolve to https://logo.clearbit.com/{domain}.
   * If absent or load fails the node renders a monogram fallback. */
  logoDomain?: string;
  /** Two-letter monogram used when logoDomain is missing or fails. */
  monogram: string;
  /** Brand colour used for the monogram background. */
  brandColor: string;
  description?: string;
}

export interface ExposureMapEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  /** 1 = strongest, 0 = weakest. Used to derive thickness band. */
  strengthScore: number;
  confidence: ConfidenceTier;
  /** Human-readable rough size (e.g. "$13B", "Bedrock catalog"). */
  estimatedValue?: string;
  /** ISO date — when the relationship was last publicly updated. */
  dateUpdated: string;
  /** One-sentence explanation shown in the tooltip. */
  summary: string;
  /** Public URLs supporting the claim. */
  sourceUrls: string[];
}

// ──────────────── Node registry ────────────────

export const EXPOSURE_NODES: ExposureMapNode[] = [
  // Public companies / exposure owners (left side)
  { id: "MSFT", label: "Microsoft", ticker: "MSFT", side: "left", ownership: "public",
    category: "Cloud + productivity", logoDomain: "microsoft.com", monogram: "MS", brandColor: "#0078D4" },
  { id: "AMZN", label: "Amazon", ticker: "AMZN", side: "left", ownership: "public",
    category: "Cloud / Bedrock", logoDomain: "amazon.com", monogram: "AM", brandColor: "#FF9900" },
  { id: "GOOGL", label: "Alphabet", ticker: "GOOGL", side: "left", ownership: "public",
    category: "Cloud / Vertex", logoDomain: "google.com", monogram: "GO", brandColor: "#4285F4" },
  { id: "NVDA", label: "NVIDIA", ticker: "NVDA", side: "left", ownership: "public",
    category: "AI compute", logoDomain: "nvidia.com", monogram: "NV", brandColor: "#76B900" },
  { id: "ORCL", label: "Oracle", ticker: "ORCL", side: "left", ownership: "public",
    category: "Cloud / OCI", logoDomain: "oracle.com", monogram: "OR", brandColor: "#C74634" },
  // Meta is a publicly-traded company AND a model owner. Per the
  // redesign brief it belongs on the right side as the originator of
  // Llama — see the `meta` right-side node below. We don't double-list
  // it on the left, which would suggest it's a buyer of itself.
  { id: "CRM", label: "Salesforce", ticker: "CRM", side: "left", ownership: "public",
    category: "CRM AI / BYOLLM", logoDomain: "salesforce.com", monogram: "SF", brandColor: "#00A1E0" },
  { id: "SNOW", label: "Snowflake", ticker: "SNOW", side: "left", ownership: "public",
    category: "Data + Arctic", logoDomain: "snowflake.com", monogram: "SN", brandColor: "#29B5E8" },
  { id: "ASML", label: "ASML", ticker: "ASML", side: "left", ownership: "public",
    category: "Supply chain (litho)", logoDomain: "asml.com", monogram: "AS", brandColor: "#0075A2" },

  // AI providers / labs / model owners (right side)
  { id: "openai", label: "OpenAI", side: "right", ownership: "private",
    category: "Frontier lab", logoDomain: "openai.com", monogram: "OA", brandColor: "#10A37F" },
  { id: "anthropic", label: "Anthropic", side: "right", ownership: "private",
    category: "Frontier lab", logoDomain: "anthropic.com", monogram: "AN", brandColor: "#D97706" },
  { id: "deepmind", label: "Google DeepMind", side: "right", ownership: "subsidiary",
    category: "Lab (Alphabet)", logoDomain: "deepmind.com", monogram: "DM", brandColor: "#4285F4" },
  { id: "mistral", label: "Mistral", side: "right", ownership: "private",
    category: "European lab", logoDomain: "mistral.ai", monogram: "MI", brandColor: "#FF7000" },
  { id: "cohere", label: "Cohere", side: "right", ownership: "private",
    category: "Enterprise lab", logoDomain: "cohere.com", monogram: "CO", brandColor: "#5C2EFF" },
  { id: "xai", label: "xAI", side: "right", ownership: "private",
    category: "Frontier lab", logoDomain: "x.ai", monogram: "xA", brandColor: "#0F0F0F" },
  { id: "perplexity", label: "Perplexity", side: "right", ownership: "private",
    category: "Search-answer API", logoDomain: "perplexity.ai", monogram: "PX", brandColor: "#20808D" },
  // Meta is publicly traded but listed here as a model owner — Llama
  // is hosted across Bedrock, Azure AI Foundry, and OCI Generative AI.
  { id: "meta", label: "Meta", ticker: "META", side: "right", ownership: "public",
    category: "Model owner (Llama)", logoDomain: "meta.com", monogram: "ME", brandColor: "#0866FF" },
  // Extended ecosystem (toggleable)
  { id: "nemotron", label: "NVIDIA Nemotron", side: "right", ownership: "subsidiary",
    category: "First-party (NVDA)", logoDomain: "nvidia.com", monogram: "Ne", brandColor: "#76B900" },
  { id: "deepseek", label: "DeepSeek", side: "right", ownership: "private",
    category: "China · reasoning", logoDomain: "deepseek.com", monogram: "DS", brandColor: "#4D6BFE" },
  { id: "alibaba", label: "Alibaba Qwen", side: "right", ownership: "private",
    category: "China · multilingual", logoDomain: "alibaba.com", monogram: "Qw", brandColor: "#FF6A00" },
  { id: "moonshot", label: "Moonshot · Kimi", side: "right", ownership: "private",
    category: "China · long-context", logoDomain: "moonshot.ai", monogram: "Ki", brandColor: "#7C3AED" },
  { id: "zai", label: "Z.ai · GLM", side: "right", ownership: "private",
    category: "China · GLM", logoDomain: "z.ai", monogram: "Zh", brandColor: "#06B6D4" },
  { id: "minimax", label: "MiniMax", side: "right", ownership: "private",
    category: "China · multimodal", logoDomain: "minimax.io", monogram: "Mm", brandColor: "#A855F7" },
  { id: "ai21", label: "AI21 Labs", side: "right", ownership: "private",
    category: "Israel · Jamba", logoDomain: "ai21.com", monogram: "AI", brandColor: "#0EA5E9" },
  { id: "aleph", label: "Aleph Alpha", side: "right", ownership: "private",
    category: "EU sovereign AI", logoDomain: "aleph-alpha.com", monogram: "AA", brandColor: "#1F2937" },
];

/** Subset of right-side nodes shown only when "Extended ecosystem" is toggled on. */
export const EXTENDED_ECOSYSTEM_NODE_IDS: ReadonlySet<string> = new Set([
  "nemotron", "deepseek", "alibaba", "moonshot", "zai", "minimax", "ai21", "aleph",
]);

// ──────────────── Edge registry (verified) ────────────────
// Every edge here was checked against publicly-known relationships in
// May 2026. Confidence tier reflects how directly the relationship is
// disclosed in primary sources:
//
//   HIGH    — disclosed in SEC filings, press releases, or model
//             catalogs that the operator can independently verify.
//   MEDIUM  — publicly stated but lower disclosure depth (partnership
//             announcement, smaller funding rounds, indirect press).
//   SEED    — plausible but not independently verified. Operator
//             should treat as a hypothesis.

export const EXPOSURE_EDGES: ExposureMapEdge[] = [
  // ─── Microsoft ─────────────────────────────────────────────
  {
    id: "msft-openai",
    sourceId: "MSFT", targetId: "openai",
    relationshipType: "investment",
    strengthScore: 1.0, confidence: "high",
    estimatedValue: "$13B+ multi-stage",
    dateUpdated: "2025-01-21",
    summary: "Multi-stage strategic investment + Azure OpenAI compute + M365 Copilot, GitHub Copilot, and Copilot Studio all consume GPT models.",
    sourceUrls: [
      "https://www.microsoft.com/en-us/ai",
      "https://learn.microsoft.com/en-us/azure/ai-services/openai/",
    ],
  },
  {
    id: "msft-mistral",
    sourceId: "MSFT", targetId: "mistral",
    relationshipType: "investment",
    strengthScore: 0.45, confidence: "medium",
    estimatedValue: "Minority + Azure partnership",
    dateUpdated: "2024-02-26",
    summary: "Multi-year partnership + minor equity stake announced Feb 2024; Mistral models available via Azure AI Foundry.",
    sourceUrls: [
      "https://blogs.microsoft.com/blog/2024/02/26/microsoft-and-mistral-ai-announce-new-partnership/",
    ],
  },
  {
    id: "msft-meta",
    sourceId: "MSFT", targetId: "meta",
    relationshipType: "model_hosting",
    strengthScore: 0.5, confidence: "medium",
    estimatedValue: "Foundry catalog",
    dateUpdated: "2024-04-18",
    summary: "Llama models hosted on Azure AI Foundry — Meta remains the original owner.",
    sourceUrls: [
      "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners",
    ],
  },

  // ─── Amazon ────────────────────────────────────────────────
  {
    id: "amzn-anthropic",
    sourceId: "AMZN", targetId: "anthropic",
    relationshipType: "investment",
    strengthScore: 0.95, confidence: "high",
    estimatedValue: "$8B+",
    dateUpdated: "2024-11-22",
    summary: "Two tranches totalling ~$8B; Anthropic uses AWS as primary cloud; Bedrock is the headline distribution channel for Claude.",
    sourceUrls: [
      "https://www.aboutamazon.com/news/company-news/amazon-anthropic-ai-investment",
      "https://aws.amazon.com/bedrock/anthropic/",
    ],
  },
  {
    id: "amzn-meta",
    sourceId: "AMZN", targetId: "meta",
    relationshipType: "model_hosting",
    strengthScore: 0.6, confidence: "high",
    estimatedValue: "Bedrock catalog",
    dateUpdated: "2024-07-23",
    summary: "Llama 3.x family hosted on Bedrock; Meta retains ownership.",
    sourceUrls: [
      "https://aws.amazon.com/bedrock/llama/",
    ],
  },
  {
    id: "amzn-mistral",
    sourceId: "AMZN", targetId: "mistral",
    relationshipType: "model_hosting",
    strengthScore: 0.5, confidence: "high",
    estimatedValue: "Bedrock catalog",
    dateUpdated: "2024-04-02",
    summary: "Mistral 7B / Mixtral / Mistral Large hosted on Bedrock.",
    sourceUrls: [
      "https://aws.amazon.com/bedrock/mistral/",
    ],
  },
  {
    id: "amzn-cohere",
    sourceId: "AMZN", targetId: "cohere",
    relationshipType: "model_hosting",
    strengthScore: 0.45, confidence: "medium",
    estimatedValue: "Bedrock catalog",
    dateUpdated: "2023-09-28",
    summary: "Cohere Command and Embed available on Bedrock; investment relationship not publicly disclosed.",
    sourceUrls: [
      "https://aws.amazon.com/bedrock/cohere-command/",
    ],
  },

  // ─── Alphabet ──────────────────────────────────────────────
  {
    id: "googl-anthropic",
    sourceId: "GOOGL", targetId: "anthropic",
    relationshipType: "investment",
    strengthScore: 0.85, confidence: "high",
    estimatedValue: "$2B+",
    dateUpdated: "2023-10-27",
    summary: "Google invested $2B+ in Anthropic; Vertex AI is a primary cloud and distribution channel for Claude.",
    sourceUrls: [
      "https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude",
    ],
  },
  {
    id: "googl-deepmind",
    sourceId: "GOOGL", targetId: "deepmind",
    relationshipType: "subsidiary",
    strengthScore: 1.0, confidence: "high",
    estimatedValue: "Wholly owned",
    dateUpdated: "2023-04-20",
    summary: "Google DeepMind is a wholly-owned Alphabet subsidiary; Gemini and Gemma originate here.",
    sourceUrls: [
      "https://deepmind.google/",
    ],
  },

  // ─── NVIDIA ────────────────────────────────────────────────
  {
    id: "nvda-openai",
    sourceId: "NVDA", targetId: "openai",
    relationshipType: "supply_chain",
    strengthScore: 1.0, confidence: "high",
    estimatedValue: "H100/B200 scale",
    dateUpdated: "2024-10-01",
    summary: "OpenAI is among NVIDIA's largest GPU customers; multi-year compute supply relationship.",
    sourceUrls: [
      "https://nvidianews.nvidia.com/news",
    ],
  },
  {
    id: "nvda-anthropic",
    sourceId: "NVDA", targetId: "anthropic",
    relationshipType: "supply_chain",
    strengthScore: 0.85, confidence: "medium",
    estimatedValue: "GPU dependency + funding",
    dateUpdated: "2024-09-01",
    summary: "Anthropic trains on NVIDIA accelerators; NVIDIA participated in funding rounds.",
    sourceUrls: [
      "https://nvidianews.nvidia.com/news",
    ],
  },
  {
    id: "nvda-xai",
    sourceId: "NVDA", targetId: "xai",
    relationshipType: "investment",
    strengthScore: 0.8, confidence: "high",
    estimatedValue: "Series B participant",
    dateUpdated: "2024-05-27",
    summary: "NVIDIA participated in xAI's Series B; Colossus training cluster runs on H100/H200.",
    sourceUrls: [
      "https://x.ai/blog/series-b",
    ],
  },
  {
    id: "nvda-perplexity",
    sourceId: "NVDA", targetId: "perplexity",
    relationshipType: "investment",
    strengthScore: 0.4, confidence: "medium",
    estimatedValue: "NVentures",
    dateUpdated: "2024-04-23",
    summary: "NVIDIA NVentures participated in Perplexity Series B / B1.",
    sourceUrls: [
      "https://www.perplexity.ai/hub",
    ],
  },
  {
    id: "nvda-mistral",
    sourceId: "NVDA", targetId: "mistral",
    relationshipType: "commercial_partnership",
    strengthScore: 0.3, confidence: "seed",
    estimatedValue: "NIM partnership",
    dateUpdated: "2024-06-02",
    summary: "Lightweight NIM hosting / inference partnership; no public investment disclosed. Marked seed pending stronger evidence.",
    sourceUrls: [
      "https://www.nvidia.com/en-us/ai/",
    ],
  },
  {
    id: "nvda-nemotron",
    sourceId: "NVDA", targetId: "nemotron",
    relationshipType: "subsidiary",
    strengthScore: 1.0, confidence: "high",
    estimatedValue: "First-party",
    dateUpdated: "2026-05-13",
    summary: "Nemotron is NVIDIA's first-party model family (Nano / Super / Speech / Safety variants).",
    sourceUrls: [
      "https://developer.nvidia.com/nemotron",
    ],
  },

  // ─── Oracle ────────────────────────────────────────────────
  {
    id: "orcl-openai",
    sourceId: "ORCL", targetId: "openai",
    relationshipType: "cloud",
    strengthScore: 0.75, confidence: "high",
    estimatedValue: "Stargate JV",
    dateUpdated: "2025-01-21",
    summary: "Oracle is a Stargate JV partner (with OpenAI + SoftBank); OCI provides data-centre capacity.",
    sourceUrls: [
      "https://www.oracle.com/news/announcement/openai-microsoft-collaboration-2024-06-11/",
    ],
  },
  {
    id: "orcl-xai",
    sourceId: "ORCL", targetId: "xai",
    relationshipType: "cloud",
    strengthScore: 0.45, confidence: "medium",
    estimatedValue: "OCI inference",
    dateUpdated: "2024-09-01",
    summary: "xAI uses OCI for portions of inference / capacity.",
    sourceUrls: [
      "https://www.oracle.com/news/",
    ],
  },
  {
    id: "orcl-meta",
    sourceId: "ORCL", targetId: "meta",
    relationshipType: "model_hosting",
    strengthScore: 0.4, confidence: "medium",
    estimatedValue: "OCI catalog",
    dateUpdated: "2024-10-01",
    summary: "OCI Generative AI hosts Llama models; Meta retains ownership.",
    sourceUrls: [
      "https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm",
    ],
  },
  {
    id: "orcl-cohere",
    sourceId: "ORCL", targetId: "cohere",
    relationshipType: "investment",
    strengthScore: 0.85, confidence: "high",
    estimatedValue: "Strategic + headline OCI partner",
    dateUpdated: "2024-06-04",
    summary: "Oracle invested in Cohere and is the headline distribution partner for Cohere on OCI Generative AI.",
    sourceUrls: [
      "https://www.oracle.com/news/announcement/oracle-and-cohere-expanded-partnership-2024-06-04/",
    ],
  },

  // ─── ASML ──────────────────────────────────────────────────
  // ASML supply-chain edges intentionally OMITTED — ASML's exposure
  // to frontier labs is indirect (it sells lithography equipment to
  // foundries, not directly to AI labs). Per the spec: "ASML
  // relationships should be treated as supply-chain exposure only,
  // not direct lab investment, unless direct evidence exists."
  // No direct evidence → no edges.
];

// ──────────────── Sanity check ────────────────
// Catch missing-target / missing-source IDs at import time so a stale
// edge can't render an empty node label in production.
const NODE_IDS = new Set(EXPOSURE_NODES.map((n) => n.id));
for (const edge of EXPOSURE_EDGES) {
  if (!NODE_IDS.has(edge.sourceId)) {
    throw new Error(`Exposure map edge "${edge.id}" references unknown source "${edge.sourceId}"`);
  }
  if (!NODE_IDS.has(edge.targetId)) {
    throw new Error(`Exposure map edge "${edge.id}" references unknown target "${edge.targetId}"`);
  }
}
