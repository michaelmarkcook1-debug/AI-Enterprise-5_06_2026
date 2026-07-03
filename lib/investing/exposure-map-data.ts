// Indirect Exposure Map — verified relationship data.
// ──────────────────────────────────────────────────
// Hand-curated edge list for the dashboard hero map. Every edge here
// is either source-backed (HIGH / MEDIUM) or explicitly marked SEED
// when the relationship is plausible but not independently verified.
// Since Evidence-Depth Job A the exported EXPOSURE_EDGES are the base list
// MERGED with the cited-edge dataset (lib/graph/cited-edges.ts — imports only
// TYPES from this file, so there is no runtime cycle).
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

import { CITED_NEW_NODES, mergeCitedEdges } from "../graph/cited-edges";

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
  /** Which node is the DEPENDENT in this relationship (who relies on whom).
   *  The map's authoring convention is LAYOUT-driven (left column → right
   *  column), NOT semantic — so the dependent varies by relationship type:
   *  capital flows source→target (target depends), base cloud/supply edges are
   *  authored provider→consumer (target depends), model_hosting is consumer→
   *  model-owner (source depends). When absent, the projection resolves it via
   *  the per-type default (see dependency-projection.ts); set it explicitly to
   *  override (the cited-edge dataset always sets it). 2026-07 encroachment
   *  audit: the old blanket "source depends on target" assumption produced
   *  backwards rationales like "NVIDIA relies on xAI for capital". */
  dependentId?: string;
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
  // ─ Semiconductors / compute infra (public) ─────────────────────────────
  { id: "AMD", label: "AMD", ticker: "AMD", side: "left", ownership: "public",
    category: "GPU challenger · MI300/MI350", logoDomain: "amd.com", monogram: "AM", brandColor: "#ED1C24" },
  { id: "TSM", label: "TSMC", ticker: "TSM", side: "left", ownership: "public",
    category: "Foundry · systemic bottleneck", logoDomain: "tsmc.com", monogram: "TS", brandColor: "#CC0000" },
  { id: "CRWV", label: "CoreWeave", ticker: "CRWV", side: "left", ownership: "public",
    category: "GPU cloud / frontier compute", logoDomain: "coreweave.com", monogram: "CW", brandColor: "#1F1F1F" },
  { id: "HPE", label: "HPE", ticker: "HPE", side: "left", ownership: "public",
    category: "Enterprise / sovereign hosting", logoDomain: "hpe.com", monogram: "HP", brandColor: "#01A982" },
  { id: "DELL", label: "Dell", ticker: "DELL", side: "left", ownership: "public",
    category: "GPU servers · Colossus", logoDomain: "dell.com", monogram: "De", brandColor: "#007DB8" },
  { id: "SMCI", label: "Super Micro", ticker: "SMCI", side: "left", ownership: "public",
    category: "GPU servers", logoDomain: "supermicro.com", monogram: "SM", brandColor: "#003366" },
  { id: "OVH", label: "OVHcloud", ticker: "OVH.PA", side: "left", ownership: "public",
    category: "EU sovereign cloud", logoDomain: "ovhcloud.com", monogram: "OV", brandColor: "#123F6D" },
  { id: "TCEHY", label: "Tencent", ticker: "TCEHY", side: "left", ownership: "public",
    category: "China · Tencent Cloud", logoDomain: "tencent.com", monogram: "Tc", brandColor: "#1B73E8" },
  { id: "BIDU", label: "Baidu", ticker: "BIDU", side: "left", ownership: "public",
    category: "China · AI Cloud + Kunlun", logoDomain: "baidu.com", monogram: "Bd", brandColor: "#2932E1" },

  // ─ Infrastructure / inference middleware (private) ─────────────────────
  { id: "cerebras", label: "Cerebras", side: "left", ownership: "private",
    category: "Wafer-scale inference", logoDomain: "cerebras.net", monogram: "Ce", brandColor: "#EF4444" },
  { id: "groq", label: "Groq", side: "left", ownership: "private",
    category: "Ultra-low-latency inference", logoDomain: "groq.com", monogram: "Gq", brandColor: "#F55036" },
  { id: "togetherai", label: "Together AI", side: "left", ownership: "private",
    category: "Open-model inference cloud", logoDomain: "together.ai", monogram: "To", brandColor: "#0F6FFF" },
  { id: "fireworks", label: "Fireworks AI", side: "left", ownership: "private",
    category: "Open-model inference cloud", logoDomain: "fireworks.ai", monogram: "Fw", brandColor: "#7C3AED" },
  { id: "nscale", label: "Nscale", side: "left", ownership: "private",
    category: "UK sovereign GPU cloud", logoDomain: "nscale.com", monogram: "Ns", brandColor: "#0EA5E9" },
  { id: "g42", label: "G42", side: "left", ownership: "private",
    category: "UAE sovereign compute", logoDomain: "g42.ai", monogram: "G4", brandColor: "#0B5394" },
  { id: "huawei", label: "Huawei", side: "left", ownership: "private",
    category: "China · Ascend silicon", logoDomain: "huawei.com", monogram: "Hw", brandColor: "#D81E06" },

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
  // ─ Additional sovereign / distributed labs ─────────────────────────────
  { id: "lighton", label: "LightOn", side: "right", ownership: "private",
    category: "EU · enterprise LLM", logoDomain: "lighton.ai", monogram: "Lt", brandColor: "#F472B6" },
  { id: "falcon", label: "Falcon · TII", side: "right", ownership: "private",
    category: "UAE sovereign · TII", logoDomain: "tii.ae", monogram: "Fa", brandColor: "#0B5394" },
  { id: "ernie", label: "Baidu ERNIE", side: "right", ownership: "subsidiary",
    category: "China · vertically integrated", logoDomain: "baidu.com", monogram: "Er", brandColor: "#2932E1" },
  { id: "hunyuan", label: "Tencent Hunyuan", side: "right", ownership: "subsidiary",
    category: "China · consumer + cloud", logoDomain: "tencent.com", monogram: "Hy", brandColor: "#1B73E8" },
  // Evidence-Depth Job A — nodes required by the cited-edge dataset (real
  // entities; structural identity only). Defined in lib/graph/cited-edges.ts.
  ...CITED_NEW_NODES,
];

/** Subset of right-side nodes shown only when "Extended ecosystem" is toggled on. */
/**
 * Previously a curated subset shown only when the operator clicked the
 * "Extended ecosystem →" toggle. Now empty — the full ecosystem renders
 * by default on the dedicated /investor-tools/exposure-map page. The
 * export is preserved as a stable contract; renderer code falls through
 * to "all nodes always" when this set is empty.
 */
export const EXTENDED_ECOSYSTEM_NODE_IDS: ReadonlySet<string> = new Set([]);

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

const BASE_EXPOSURE_EDGES: ExposureMapEdge[] = [
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

  // ─── TSMC ──────────────────────────────────────────────────
  // Bipartite-renderer note: TSMC's true counterparties (NVDA, AMD,
  // Cerebras) sit on the left side, so direct TSM→NVDA edges can't
  // render. We route TSMC's edges through the frontier labs whose
  // compute stack ultimately bottlenecks through TSMC fabrication —
  // each summary names the intermediate silicon. Confidence is
  // MEDIUM (indirect but well-documented systemic exposure).
  { id: "tsm-openai",   sourceId: "TSM", targetId: "openai",   relationshipType: "supply_chain", strengthScore: 0.95, confidence: "medium", estimatedValue: "H100/B200 fab",   dateUpdated: "2025-03-01", summary: "OpenAI's GPU fleet (NVIDIA H100/B200) is fabricated by TSMC — the AI-compute bottleneck for OpenAI runs through TSMC's leading-edge N4/N3 process nodes.",      sourceUrls: ["https://www.tsmc.com/english/aboutTSMC/CSR_Report"] },
  { id: "tsm-anthropic", sourceId: "TSM", targetId: "anthropic", relationshipType: "supply_chain", strengthScore: 0.85, confidence: "medium", estimatedValue: "Trainium + H100 fab", dateUpdated: "2025-03-01", summary: "Anthropic's training (AWS Trainium) and inference (NVIDIA H100) silicon are both TSMC-fabricated.", sourceUrls: ["https://www.tsmc.com/"] },
  { id: "tsm-meta",      sourceId: "TSM", targetId: "meta",      relationshipType: "supply_chain", strengthScore: 0.9,  confidence: "medium", estimatedValue: "H100 cluster fab",    dateUpdated: "2025-03-01", summary: "Meta's 350K+ H100 fleet for Llama training is fabricated by TSMC; MTIA accelerators are also on TSMC N5.", sourceUrls: ["https://www.tsmc.com/"] },
  { id: "tsm-deepmind",  sourceId: "TSM", targetId: "deepmind",  relationshipType: "supply_chain", strengthScore: 0.85, confidence: "medium", estimatedValue: "TPU fab",            dateUpdated: "2025-03-01", summary: "Google's TPU v5/v6 silicon (used by DeepMind for Gemini training) is fabricated by TSMC.", sourceUrls: ["https://www.tsmc.com/"] },
  { id: "tsm-xai",       sourceId: "TSM", targetId: "xai",       relationshipType: "supply_chain", strengthScore: 0.9,  confidence: "medium", estimatedValue: "Colossus H100 fab",  dateUpdated: "2025-03-01", summary: "xAI Colossus (100K+ H100 cluster) is built on TSMC-fabricated NVIDIA silicon.", sourceUrls: ["https://www.tsmc.com/"] },
  { id: "tsm-falcon",    sourceId: "TSM", targetId: "falcon",    relationshipType: "supply_chain", strengthScore: 0.75, confidence: "seed",   estimatedValue: "Cerebras WSE fab",    dateUpdated: "2025-03-01", summary: "Falcon training on G42/Cerebras Condor Galaxy uses TSMC-fabricated WSE-3 wafer-scale chips.", sourceUrls: ["https://www.cerebras.net/"] },

  // ─── AMD ───────────────────────────────────────────────────
  { id: "amd-mistral", sourceId: "AMD", targetId: "mistral", relationshipType: "supply_chain",         strengthScore: 0.55, confidence: "medium", estimatedValue: "MI300 partnership", dateUpdated: "2024-12-01", summary: "Mistral named in AMD's Instinct MI300X / MI325X enterprise reference customers; partial MI300-based inference workloads.", sourceUrls: ["https://www.amd.com/en/products/accelerators/instinct/mi300.html"] },
  { id: "amd-cohere",  sourceId: "AMD", targetId: "cohere",  relationshipType: "supply_chain",         strengthScore: 0.5,  confidence: "seed",   estimatedValue: "MI300 evaluation",  dateUpdated: "2025-01-15", summary: "Cohere has publicly evaluated AMD MI300X as part of enterprise/government compute diversification.", sourceUrls: ["https://cohere.com/"] },
  { id: "amd-meta",    sourceId: "AMD", targetId: "meta",    relationshipType: "supply_chain",         strengthScore: 0.7,  confidence: "high",   estimatedValue: "MI300X deployment", dateUpdated: "2024-10-10", summary: "Meta is a flagship AMD Instinct MI300X customer — announced large-scale Llama inference deployment on MI300.", sourceUrls: ["https://www.amd.com/en/newsroom/press-releases/2023-12-6-amd-launches-instinct-mi300-series.html"] },
  { id: "amd-aleph",   sourceId: "AMD", targetId: "aleph",   relationshipType: "commercial_partnership", strengthScore: 0.45, confidence: "medium", estimatedValue: "Sovereign compute", dateUpdated: "2024-11-01", summary: "Aleph Alpha's sovereign compute pivot includes AMD silicon alongside HPE-hosted infrastructure.", sourceUrls: ["https://aleph-alpha.com/"] },

  // ─── CoreWeave ─────────────────────────────────────────────
  { id: "crwv-openai",   sourceId: "CRWV", targetId: "openai",   relationshipType: "cloud", strengthScore: 0.9,  confidence: "high",   estimatedValue: "$11.9B 5-yr",      dateUpdated: "2025-03-10", summary: "CoreWeave signed an $11.9B multi-year compute agreement with OpenAI in March 2025 — one of the largest GPU-cloud deals on record.", sourceUrls: ["https://www.coreweave.com/"] },
  { id: "crwv-mistral",  sourceId: "CRWV", targetId: "mistral",  relationshipType: "cloud", strengthScore: 0.55, confidence: "medium", estimatedValue: "Frontier compute",  dateUpdated: "2024-11-01", summary: "CoreWeave lists Mistral among its frontier-AI compute customers for H100-class training capacity.", sourceUrls: ["https://www.coreweave.com/"] },
  { id: "crwv-meta",     sourceId: "CRWV", targetId: "meta",     relationshipType: "cloud", strengthScore: 0.5,  confidence: "seed",   estimatedValue: "Burst capacity",    dateUpdated: "2024-09-01", summary: "Meta has used CoreWeave for burst GPU capacity beyond its in-house clusters; relationship not formally disclosed.", sourceUrls: ["https://www.coreweave.com/"] },

  // ─── HPE ───────────────────────────────────────────────────
  { id: "hpe-aleph", sourceId: "HPE", targetId: "aleph", relationshipType: "commercial_partnership", strengthScore: 0.65, confidence: "medium", estimatedValue: "Sovereign hosting", dateUpdated: "2024-06-01", summary: "Aleph Alpha + HPE strategic partnership for sovereign European AI compute — HPE GreenLake delivers on-prem and hybrid hosting for Aleph models.", sourceUrls: ["https://www.hpe.com/", "https://aleph-alpha.com/"] },

  // ─── Dell / Supermicro ─────────────────────────────────────
  { id: "dell-xai",  sourceId: "DELL", targetId: "xai",  relationshipType: "supply_chain", strengthScore: 0.7, confidence: "high", estimatedValue: "$5B Colossus servers", dateUpdated: "2024-07-22", summary: "Dell publicly named as a key server supplier for xAI's Memphis Colossus cluster — multi-billion-dollar GPU-server contract.", sourceUrls: ["https://www.dell.com/en-us/lp/dt/ai-solutions"] },
  { id: "smci-xai",  sourceId: "SMCI", targetId: "xai",  relationshipType: "supply_chain", strengthScore: 0.7, confidence: "high", estimatedValue: "Colossus servers",     dateUpdated: "2024-07-22", summary: "Super Micro publicly named as the other primary server supplier alongside Dell for xAI Colossus.", sourceUrls: ["https://www.supermicro.com/"] },

  // ─── OVHcloud ──────────────────────────────────────────────
  { id: "ovh-lighton", sourceId: "OVH", targetId: "lighton", relationshipType: "cloud", strengthScore: 0.6, confidence: "medium", estimatedValue: "Sovereign hosting", dateUpdated: "2024-04-01", summary: "LightOn's enterprise LLMs hosted on OVHcloud sovereign GPU infrastructure — French-French sovereign AI stack.", sourceUrls: ["https://www.ovhcloud.com/"] },
  { id: "ovh-mistral", sourceId: "OVH", targetId: "mistral", relationshipType: "cloud", strengthScore: 0.45, confidence: "seed",   estimatedValue: "Sovereign option",  dateUpdated: "2024-09-01", summary: "Mistral models available on OVHcloud AI Endpoints as a French-sovereign hosting option alongside Azure/AWS.", sourceUrls: ["https://www.ovhcloud.com/"] },

  // ─── Tencent / Baidu (China subsidiaries) ──────────────────
  { id: "tcehy-hunyuan", sourceId: "TCEHY", targetId: "hunyuan", relationshipType: "subsidiary", strengthScore: 1.0, confidence: "high", estimatedValue: "Wholly owned", dateUpdated: "2024-05-17", summary: "Hunyuan is Tencent's in-house multimodal foundation-model family, served via Tencent Cloud and consumer apps (WeChat).", sourceUrls: ["https://cloud.tencent.com/product/hunyuan"] },
  { id: "bidu-ernie",    sourceId: "BIDU",  targetId: "ernie",   relationshipType: "subsidiary", strengthScore: 1.0, confidence: "high", estimatedValue: "Wholly owned", dateUpdated: "2024-06-28", summary: "ERNIE is Baidu's foundation-model family — vertically integrated with Baidu AI Cloud and Baidu Kunlun AI chips.", sourceUrls: ["https://yiyan.baidu.com/"] },

  // ─── Cerebras ──────────────────────────────────────────────
  { id: "cerebras-openai",  sourceId: "cerebras", targetId: "openai",  relationshipType: "commercial_partnership", strengthScore: 0.4,  confidence: "seed",   estimatedValue: "Inference eval",      dateUpdated: "2025-02-01", summary: "OpenAI has been publicly named in Cerebras' aspirational customer list; relationship not formally confirmed.", sourceUrls: ["https://www.cerebras.net/"] },
  { id: "cerebras-mistral", sourceId: "cerebras", targetId: "mistral", relationshipType: "commercial_partnership", strengthScore: 0.7,  confidence: "high",   estimatedValue: "Inference partner",   dateUpdated: "2024-08-27", summary: "Mistral Le Chat runs Mistral Large on Cerebras WSE-3 — landmark wafer-scale inference partnership.", sourceUrls: ["https://www.cerebras.net/press-release/mistral-cerebras/"] },
  { id: "cerebras-falcon",  sourceId: "cerebras", targetId: "falcon",  relationshipType: "commercial_partnership", strengthScore: 0.85, confidence: "high",   estimatedValue: "Condor Galaxy training", dateUpdated: "2023-07-20", summary: "Falcon models trained on G42 + Cerebras' Condor Galaxy supercomputer network — flagship sovereign + WSE-3 training partnership.", sourceUrls: ["https://www.cerebras.net/press-release/g42-cerebras-condor-galaxy/"] },
  { id: "cerebras-meta",    sourceId: "cerebras", targetId: "meta",    relationshipType: "commercial_partnership", strengthScore: 0.55, confidence: "medium", estimatedValue: "Llama inference",     dateUpdated: "2024-08-27", summary: "Llama 3.x served via Cerebras Inference cloud at industry-leading tokens/sec — open-model inference channel.", sourceUrls: ["https://inference.cerebras.ai/"] },

  // ─── Groq ──────────────────────────────────────────────────
  { id: "groq-meta",     sourceId: "groq", targetId: "meta",     relationshipType: "commercial_partnership", strengthScore: 0.8, confidence: "high",   estimatedValue: "Llama LPU inference", dateUpdated: "2024-09-24", summary: "Llama 3.x hosted on Groq LPU inference — flagship open-model partnership announced at Meta Connect.", sourceUrls: ["https://groq.com/"] },
  { id: "groq-mistral",  sourceId: "groq", targetId: "mistral",  relationshipType: "commercial_partnership", strengthScore: 0.6, confidence: "high",   estimatedValue: "Mixtral inference",   dateUpdated: "2024-04-01", summary: "Mistral / Mixtral models hosted on GroqCloud for ultra-low-latency inference.", sourceUrls: ["https://groq.com/"] },
  { id: "groq-deepseek", sourceId: "groq", targetId: "deepseek", relationshipType: "commercial_partnership", strengthScore: 0.5, confidence: "medium", estimatedValue: "R1 inference",        dateUpdated: "2025-02-05", summary: "DeepSeek R1 / R1-distill served via GroqCloud as part of open-reasoning model lineup.", sourceUrls: ["https://groq.com/"] },

  // ─── Together AI ───────────────────────────────────────────
  { id: "together-meta",     sourceId: "togetherai", targetId: "meta",     relationshipType: "commercial_partnership", strengthScore: 0.8, confidence: "high",   estimatedValue: "Llama hosting",  dateUpdated: "2024-08-01", summary: "Together AI is a flagship Llama inference + fine-tuning host — full Llama 3.x family available.", sourceUrls: ["https://www.together.ai/"] },
  { id: "together-deepseek", sourceId: "togetherai", targetId: "deepseek", relationshipType: "commercial_partnership", strengthScore: 0.7, confidence: "high",   estimatedValue: "R1 hosting",     dateUpdated: "2025-01-25", summary: "DeepSeek V3 + R1 hosted on Together AI as one of the first non-Chinese inference endpoints.", sourceUrls: ["https://www.together.ai/"] },
  { id: "together-alibaba",  sourceId: "togetherai", targetId: "alibaba",  relationshipType: "commercial_partnership", strengthScore: 0.6, confidence: "high",   estimatedValue: "Qwen hosting",   dateUpdated: "2024-10-01", summary: "Qwen 2.5 / Qwen 3 served via Together AI — open-weight multilingual lineup.", sourceUrls: ["https://www.together.ai/"] },
  { id: "together-mistral",  sourceId: "togetherai", targetId: "mistral",  relationshipType: "commercial_partnership", strengthScore: 0.55, confidence: "medium", estimatedValue: "Mixtral hosting", dateUpdated: "2024-04-01", summary: "Mistral 7B / Mixtral hosted on Together AI inference cloud.", sourceUrls: ["https://www.together.ai/"] },

  // ─── Fireworks AI ──────────────────────────────────────────
  { id: "fireworks-meta",     sourceId: "fireworks", targetId: "meta",     relationshipType: "commercial_partnership", strengthScore: 0.75, confidence: "high",   estimatedValue: "Llama hosting",  dateUpdated: "2024-08-01", summary: "Fireworks AI is a Meta launch partner for Llama enterprise inference + fine-tuning.", sourceUrls: ["https://fireworks.ai/"] },
  { id: "fireworks-mistral",  sourceId: "fireworks", targetId: "mistral",  relationshipType: "commercial_partnership", strengthScore: 0.5,  confidence: "medium", estimatedValue: "Mixtral hosting", dateUpdated: "2024-04-01", summary: "Mistral / Mixtral models served via Fireworks for production inference.", sourceUrls: ["https://fireworks.ai/"] },
  { id: "fireworks-deepseek", sourceId: "fireworks", targetId: "deepseek", relationshipType: "commercial_partnership", strengthScore: 0.55, confidence: "medium", estimatedValue: "R1 hosting",     dateUpdated: "2025-01-28", summary: "DeepSeek V3 + R1 available via Fireworks inference cloud.", sourceUrls: ["https://fireworks.ai/"] },

  // ─── Nscale ────────────────────────────────────────────────
  { id: "nscale-mistral", sourceId: "nscale", targetId: "mistral", relationshipType: "cloud", strengthScore: 0.5, confidence: "seed", estimatedValue: "UK sovereign GPU", dateUpdated: "2025-02-01", summary: "Nscale's UK sovereign GPU cloud has been named as a sovereign-Europe option for Mistral hosting.", sourceUrls: ["https://www.nscale.com/"] },

  // ─── G42 (UAE sovereign) ───────────────────────────────────
  { id: "g42-falcon", sourceId: "g42", targetId: "falcon", relationshipType: "investment", strengthScore: 0.85, confidence: "high", estimatedValue: "UAE state compute", dateUpdated: "2023-09-01", summary: "G42 provides the sovereign compute (Condor Galaxy supercomputers, AI cloud) underpinning Falcon's TII training programme.", sourceUrls: ["https://www.g42.ai/"] },

  // ─── Huawei (China sovereign silicon) ──────────────────────
  { id: "huawei-deepseek", sourceId: "huawei", targetId: "deepseek", relationshipType: "supply_chain", strengthScore: 0.6, confidence: "medium", estimatedValue: "Ascend 910B inference", dateUpdated: "2025-02-10", summary: "DeepSeek has publicly demonstrated R1 inference on Huawei Ascend 910B — strategic China-sovereign silicon hedge against US chip restrictions.", sourceUrls: ["https://www.huawei.com/"] },

  // ─── NVIDIA — additional frontier exposure ─────────────────
  { id: "nvda-meta",     sourceId: "NVDA", targetId: "meta",     relationshipType: "supply_chain", strengthScore: 1.0,  confidence: "high",   estimatedValue: "350K+ H100 fleet",  dateUpdated: "2024-01-18", summary: "Meta is one of NVIDIA's largest customers — public guidance of 350K+ H100 GPUs by end of 2024 for Llama training and Reality Labs.", sourceUrls: ["https://about.fb.com/news/2024/01/metas-ai-roadmap/"] },
  { id: "nvda-deepseek", sourceId: "NVDA", targetId: "deepseek", relationshipType: "supply_chain", strengthScore: 0.7,  confidence: "medium", estimatedValue: "H800/H20 exposure", dateUpdated: "2025-01-27", summary: "DeepSeek trained V3 / R1 on NVIDIA H800 + H20 GPUs (the China-export-compliant variants) — exposure is real but subject to ongoing US export-control tightening.", sourceUrls: ["https://www.deepseek.com/"] },
  { id: "nvda-alibaba",  sourceId: "NVDA", targetId: "alibaba",  relationshipType: "supply_chain", strengthScore: 0.7,  confidence: "medium", estimatedValue: "H800/H20 fleet",    dateUpdated: "2024-09-01", summary: "Alibaba Cloud's Qwen training fleet relies on NVIDIA H800 / H20 silicon alongside Alibaba's own T-Head accelerators.", sourceUrls: ["https://www.alibabacloud.com/"] },
  { id: "nvda-falcon",   sourceId: "NVDA", targetId: "falcon",   relationshipType: "supply_chain", strengthScore: 0.65, confidence: "medium", estimatedValue: "DGX/H100 capacity",  dateUpdated: "2024-04-01", summary: "TII's Falcon training capacity spans NVIDIA DGX H100 (UAE installations) alongside the Cerebras Condor Galaxy partnership.", sourceUrls: ["https://falconllm.tii.ae/"] },
  { id: "nvda-zai",      sourceId: "NVDA", targetId: "zai",      relationshipType: "supply_chain", strengthScore: 0.55, confidence: "seed",   estimatedValue: "H800 training",     dateUpdated: "2024-09-01", summary: "Z.ai's GLM family trained on NVIDIA H800 capacity inside China; sovereign-silicon transition underway.", sourceUrls: ["https://z.ai/"] },
  { id: "nvda-ernie",    sourceId: "NVDA", targetId: "ernie",    relationshipType: "supply_chain", strengthScore: 0.5,  confidence: "seed",   estimatedValue: "H800 + Kunlun mix", dateUpdated: "2024-09-01", summary: "Baidu ERNIE trained on a mix of NVIDIA H800 and Baidu's own Kunlun P800 chips — vertically integrated stack with sovereign hedge.", sourceUrls: ["https://yiyan.baidu.com/"] },
  { id: "nvda-hunyuan",  sourceId: "NVDA", targetId: "hunyuan",  relationshipType: "supply_chain", strengthScore: 0.55, confidence: "seed",   estimatedValue: "H800 fleet",        dateUpdated: "2024-09-01", summary: "Tencent Hunyuan training relies on NVIDIA H800 capacity inside Tencent Cloud.", sourceUrls: ["https://cloud.tencent.com/"] },
  { id: "nvda-lighton",  sourceId: "NVDA", targetId: "lighton",  relationshipType: "supply_chain", strengthScore: 0.4,  confidence: "seed",   estimatedValue: "Sovereign GPU",     dateUpdated: "2024-04-01", summary: "LightOn enterprise LLMs trained on NVIDIA GPUs hosted in OVHcloud sovereign-EU infrastructure.", sourceUrls: ["https://www.lighton.ai/"] },
  { id: "nvda-aleph",    sourceId: "NVDA", targetId: "aleph",    relationshipType: "supply_chain", strengthScore: 0.5,  confidence: "medium", estimatedValue: "H100 alongside AMD", dateUpdated: "2024-11-01", summary: "Aleph Alpha's training stack uses NVIDIA H100 alongside its AMD MI300 sovereign-compute pivot.", sourceUrls: ["https://aleph-alpha.com/"] },

  // ─── Microsoft — Falcon (Azure sovereign catalog) ──────────
  { id: "msft-falcon", sourceId: "MSFT", targetId: "falcon", relationshipType: "model_hosting", strengthScore: 0.45, confidence: "medium", estimatedValue: "Azure catalog", dateUpdated: "2024-05-22", summary: "Falcon family available in the Azure AI Foundry model catalog — sovereign + Microsoft distribution channel.", sourceUrls: ["https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/"] },
];

// Evidence-Depth Job A — the graph every consumer reads is the curated base
// MERGED with the cited-edge dataset (lib/graph/cited-edges.ts): a cited edge
// replaces its matching curated edge (dashed "plausible" → cited row with an
// honest tier prefix), and new cited pairs append. LOI/Derived map to the
// "seed" tier so they render dashed — never as done deals.
export const EXPOSURE_EDGES: ExposureMapEdge[] = mergeCitedEdges(BASE_EXPOSURE_EDGES);

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
