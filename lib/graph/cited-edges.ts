// Evidence-Depth Job A — the CITED dependency-edge dataset.
// ─────────────────────────────────────────────────────────────────────────────
// Faithful ingestion of rankings-and-graph/GRAPH_Cited-Edge-Dataset.md
// (compiled 1 July 2026): real, publicly-sourced edges with a confidence TIER
// and an as-of date. NOTHING here is invented; each record traces to the
// dataset row named in `datasetRow`.
//
// Tier semantics (from the dataset — rendered honestly, never collapsed):
//   confirmed — officially announced/executed by the parties
//   committed — large multi-year "$X over N years" announced but phased/conditional
//   announced — announced, less definitive than confirmed (dataset rows 10, 18)
//   loi       — letter-of-intent, explicitly NOT definitive (must render as such)
//   derived   — analyst/market-structure inference (never "as measured")
//
// Ingestion notes (honesty log):
// • Dataset row 14 ("(all labs & clouds) → NVIDIA", Derived) is a GROUP claim
//   with no single from-node — NOT ingested as an edge (it would require
//   inventing membership). Its substance is partially covered by row 3/12
//   (OpenAI/xAI→NVIDIA) and the row-26 encroachment set.
// • Dataset row 26 names four specific encroachers (Google TPU, AWS Trainium,
//   Microsoft Maia, Meta MTIA) → ingested as four Derived edges, one per NAMED
//   member — no membership invented.
// • Source URLs: 11 verified live (HTTP 200) at ingest; 3 are the dataset's own
//   exact paths that bot-gate curl (HTTP 403 — openai.com ×2, x.ai ×1: real
//   pages, browsers open them); 6 could not be verified as deep links (404 on
//   best-known slug) → linked to the PUBLISHER ROOT with the article slug kept
//   in `sourceNote`, so we never ship a fabricated deep link.
// • FIREWALL: these edges feed the dependency graph ONLY — no path to any
//   vendor score.

import type { ExposureMapEdge, ExposureMapNode, ConfidenceTier } from "../investing/exposure-map-data";

export const CITED_EDGE_PROVENANCE = "GRAPH_Cited-Edge-Dataset.md · compiled 2026-07-01";

export type CitedTier = "confirmed" | "committed" | "announced" | "loi" | "derived";

/** Tier → the legacy high/medium/seed tier that drives existing dash/grade UI.
 *  loi + derived map to "seed" so they render DASHED (not-yet-solid), exactly
 *  the honest presentation the dataset demands for non-definitive edges. */
export const CITED_TIER_TO_CONFIDENCE: Record<CitedTier, ConfidenceTier> = {
  confirmed: "high",
  committed: "high",
  announced: "medium",
  loi: "seed",
  derived: "seed",
};

const TIER_LABEL: Record<CitedTier, string> = {
  confirmed: "Confirmed",
  committed: "Committed",
  announced: "Announced",
  loi: "LOI — not definitive",
  derived: "Derived (analyst inference)",
};

export interface CitedEdge {
  id: string;
  datasetRow: number;
  sourceId: string;
  targetId: string;
  relationshipType: ExposureMapEdge["relationshipType"];
  tier: CitedTier;
  asOf: string; // ISO date the relationship info is as-of (dataset publication where row gives none)
  detail: string; // the dataset's relationship text, verbatim-adjacent
  estimatedValue?: string;
  sourceUrl: string;
  /** Set when the deep link could not be verified — carries the dataset's slug text. */
  sourceNote?: string;
  strengthScore: number;
}

// ── New nodes required by the dataset (real entities, structural data only) ──
export const CITED_NEW_NODES: ExposureMapNode[] = [
  {
    id: "AVGO", label: "Broadcom", ticker: "AVGO", side: "left", ownership: "public",
    category: "AI silicon & networking", monogram: "BC", brandColor: "#CC0000",
    description: "Custom AI accelerators + networking silicon for hyperscale and frontier-lab buildouts.",
  },
  {
    id: "softbank", label: "SoftBank", ticker: "9984.T", side: "left", ownership: "public",
    category: "AI investor (capital)", monogram: "SB", brandColor: "#B0B0B0",
    description: "Large-cheque AI investor; Stargate lead funder and major OpenAI backer.",
  },
  {
    id: "mgx", label: "MGX", side: "left", ownership: "private",
    category: "Sovereign AI investor", monogram: "MG", brandColor: "#0E7490",
    description: "UAE state-backed AI investment vehicle; Stargate funder.",
  },
];

// ── The cited edges (28 records from 25 ingested dataset rows) ────────────────
export const CITED_EDGES: CitedEdge[] = [
  { id: "cited-1-openai-msft", datasetRow: 1, sourceId: "openai", targetId: "MSFT", relationshipType: "cloud", tier: "confirmed", asOf: "2025-10-01",
    detail: "~$250B incremental Azure contract; Azure stays exclusive for stateless OpenAI APIs; first-party products still Azure-hosted (Oct 2025 restructure).",
    estimatedValue: "$250B", sourceUrl: "https://www.datacenterdynamics.com/", sourceNote: "datacenterdynamics.com — openai-completes-for-profit-move", strengthScore: 1.0 },
  { id: "cited-2-openai-orcl", datasetRow: 2, sourceId: "openai", targetId: "ORCL", relationshipType: "cloud", tier: "committed", asOf: "2025-09-01",
    detail: "~$300B / 4.5 GW Stargate cloud deal (~$60B/yr 2027–31).",
    estimatedValue: "$300B", sourceUrl: "https://openai.com/index/stargate-advances-with-partnership-with-oracle/", strengthScore: 1.0 },
  { id: "cited-3-openai-nvda", datasetRow: 3, sourceId: "openai", targetId: "NVDA", relationshipType: "supply_chain", tier: "confirmed", asOf: "2025-09-01",
    detail: "10 GW of NVIDIA systems; NVIDIA named \"preferred\" supplier.",
    estimatedValue: "10 GW", sourceUrl: "https://nvidianews.nvidia.com/news/openai-and-nvidia-announce-strategic-partnership-to-deploy-10-gigawatts-of-nvidia-systems", strengthScore: 1.0 },
  { id: "cited-4-openai-avgo", datasetRow: 4, sourceId: "openai", targetId: "AVGO", relationshipType: "supply_chain", tier: "committed", asOf: "2025-11-01",
    detail: "~$350B custom-silicon commitment (part of ~$1.15T 2025–35 infra plan).",
    estimatedValue: "$350B", sourceUrl: "https://tomtunguz.com/openai-hardware-spending-2025-2035/", strengthScore: 1.0 },
  { id: "cited-5-openai-amd", datasetRow: 5, sourceId: "openai", targetId: "AMD", relationshipType: "supply_chain", tier: "committed", asOf: "2025-11-01",
    detail: "~$90B commitment.",
    estimatedValue: "$90B", sourceUrl: "https://tomtunguz.com/openai-hardware-spending-2025-2035/", strengthScore: 0.8 },
  { id: "cited-6-openai-amzn", datasetRow: 6, sourceId: "openai", targetId: "AMZN", relationshipType: "cloud", tier: "committed", asOf: "2025-11-01",
    detail: "~$38B AWS commitment.",
    estimatedValue: "$38B", sourceUrl: "https://tomtunguz.com/openai-hardware-spending-2025-2035/", strengthScore: 0.7 },
  { id: "cited-7-openai-crwv", datasetRow: 7, sourceId: "openai", targetId: "CRWV", relationshipType: "cloud", tier: "committed", asOf: "2025-11-01",
    detail: "~$22B commitment.",
    estimatedValue: "$22B", sourceUrl: "https://tomtunguz.com/openai-hardware-spending-2025-2035/", strengthScore: 0.6 },
  { id: "cited-8-anthropic-amzn", datasetRow: 8, sourceId: "anthropic", targetId: "AMZN", relationshipType: "cloud", tier: "confirmed", asOf: "2025-11-01",
    detail: "AWS = primary cloud + training partner; up to 5 GW Trainium; ~$100B AWS over a decade.",
    estimatedValue: "$100B / 5 GW", sourceUrl: "https://www.anthropic.com/news/anthropic-amazon-trainium", strengthScore: 1.0 },
  { id: "cited-9-anthropic-googl", datasetRow: 9, sourceId: "anthropic", targetId: "GOOGL", relationshipType: "cloud", tier: "confirmed", asOf: "2025-10-01",
    detail: "Up to 1M TPUs, >1 GW online in 2026, \"tens of billions\" (Oct 2025).",
    estimatedValue: "1M TPUs", sourceUrl: "https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services", strengthScore: 0.9 },
  { id: "cited-10-anthropic-avgo", datasetRow: 10, sourceId: "anthropic", targetId: "AVGO", relationshipType: "supply_chain", tier: "announced", asOf: "2026-01-01",
    detail: "Multi-GW next-gen TPU (Google + Broadcom) from 2027.",
    sourceUrl: "https://www.anthropic.com/news/google-broadcom-partnership-compute", strengthScore: 0.7 },
  { id: "cited-11-anthropic-xai", datasetRow: 11, sourceId: "anthropic", targetId: "xai", relationshipType: "cloud", tier: "confirmed", asOf: "2026-02-01",
    detail: "Uses all Colossus 1 capacity — 300 MW+, ~220,000 NVIDIA GPUs (renting from a rival = coopetition).",
    estimatedValue: "300 MW+", sourceUrl: "https://x.ai/news/anthropic-compute-partnership", strengthScore: 0.8 },
  { id: "cited-12-xai-nvda", datasetRow: 12, sourceId: "xai", targetId: "NVDA", relationshipType: "supply_chain", tier: "confirmed", asOf: "2026-02-01",
    detail: "Colossus ~555,000 NVIDIA GPUs, ~2 GW (Feb 2026).",
    estimatedValue: "~2 GW", sourceUrl: "https://introl.com/blog/xai-colossus-2-gigawatt-expansion-555k-gpus-january-2026", strengthScore: 1.0 },
  { id: "cited-13-mistral-crwv", datasetRow: 13, sourceId: "mistral", targetId: "CRWV", relationshipType: "cloud", tier: "confirmed", asOf: "2025-09-01",
    detail: "Multi-cloud; CoreWeave for GPUs; own 40 MW France cluster.",
    sourceUrl: "https://www.datacenterdynamics.com/", sourceNote: "datacenterdynamics.com — mistral-ai-raises-17bn", strengthScore: 0.6 },
  // row 14 deliberately NOT ingested — group claim, see header note.
  { id: "cited-15-msft-openai", datasetRow: 15, sourceId: "MSFT", targetId: "openai", relationshipType: "investment", tier: "confirmed", asOf: "2025-10-01",
    detail: "27% stake post-restructure; exclusivity + cloud right-of-first-refusal ended (Oct 2025).",
    estimatedValue: "27% stake", sourceUrl: "https://www.datacenterdynamics.com/", sourceNote: "datacenterdynamics.com — openai-completes-for-profit-move", strengthScore: 1.0 },
  { id: "cited-16-nvda-openai", datasetRow: 16, sourceId: "NVDA", targetId: "openai", relationshipType: "investment", tier: "loi", asOf: "2025-12-02",
    detail: "Up to $100B, deployed progressively — still an LOI; \"no assurance,\" not definitive (NVIDIA CFO, Dec 2025).",
    estimatedValue: "up to $100B (LOI)", sourceUrl: "https://fortune.com/", sourceNote: "fortune.com/2025/12/02/nvidia-openai-deal-not-signed-yet", strengthScore: 0.5 },
  { id: "cited-17-amzn-anthropic", datasetRow: 17, sourceId: "AMZN", targetId: "anthropic", relationshipType: "investment", tier: "committed", asOf: "2025-11-01",
    detail: "Up to ~$33B total ($8B + $5B + up to $20B).",
    estimatedValue: "up to $33B", sourceUrl: "https://www.aboutamazon.com/", sourceNote: "aboutamazon.com — amazon-invests-additional-5-billion-anthropic", strengthScore: 1.0 },
  { id: "cited-18-googl-anthropic", datasetRow: 18, sourceId: "GOOGL", targetId: "anthropic", relationshipType: "investment", tier: "announced", asOf: "2026-04-24",
    detail: "Up to $40B (cash + compute) (Apr 2026).",
    estimatedValue: "up to $40B", sourceUrl: "https://techcrunch.com/", sourceNote: "techcrunch.com/2026/04/24/google-to-invest-up-to-40b-in-anthropic", strengthScore: 1.0 },
  { id: "cited-19-softbank-openai", datasetRow: 19, sourceId: "softbank", targetId: "openai", relationshipType: "investment", tier: "confirmed", asOf: "2025-01-21",
    detail: "Stargate lead funder; major OpenAI investor.",
    sourceUrl: "https://openai.com/index/announcing-the-stargate-project/", strengthScore: 1.0 },
  { id: "cited-20-orcl-openai", datasetRow: 20, sourceId: "ORCL", targetId: "openai", relationshipType: "investment", tier: "confirmed", asOf: "2025-01-21",
    detail: "Stargate equity partner (also $300B customer — dual role).",
    sourceUrl: "https://openai.com/index/announcing-the-stargate-project/", strengthScore: 0.8 },
  { id: "cited-21-mgx-openai", datasetRow: 21, sourceId: "mgx", targetId: "openai", relationshipType: "investment", tier: "confirmed", asOf: "2025-01-21",
    detail: "Stargate funder.",
    sourceUrl: "https://openai.com/index/announcing-the-stargate-project/", strengthScore: 0.7 },
  { id: "cited-22-asml-mistral", datasetRow: 22, sourceId: "ASML", targetId: "mistral", relationshipType: "investment", tier: "confirmed", asOf: "2025-09-09",
    detail: "€1.3B, ~11% stake, lead Series C investor (Sept 2025).",
    estimatedValue: "€1.3B / ~11%", sourceUrl: "https://www.asml.com/en/news/press-releases/2025/asml-mistral-ai-enter-strategic-partnership", strengthScore: 0.9 },
  { id: "cited-23-msft-mistral", datasetRow: 23, sourceId: "MSFT", targetId: "mistral", relationshipType: "investment", tier: "confirmed", asOf: "2024-02-01",
    detail: "$16M + Azure model distribution (2024).",
    estimatedValue: "$16M", sourceUrl: "https://www.cnbc.com/", sourceNote: "cnbc.com/2025/09/09/mistral-asml (context)", strengthScore: 0.4 },
  { id: "cited-24-msft-openai-models", datasetRow: 24, sourceId: "MSFT", targetId: "openai", relationshipType: "model_hosting", tier: "confirmed", asOf: "2025-09-24",
    detail: "M365 Copilot default = OpenAI models.",
    sourceUrl: "https://www.microsoft.com/en-us/microsoft-365/blog/2025/09/24/expanding-model-choice-in-microsoft-365-copilot/", strengthScore: 0.9 },
  { id: "cited-25-msft-anthropic-models", datasetRow: 25, sourceId: "MSFT", targetId: "anthropic", relationshipType: "model_hosting", tier: "confirmed", asOf: "2025-09-24",
    detail: "Claude added to M365 Copilot + Copilot Studio (Sept 2025) — MS diversifying off OpenAI.",
    sourceUrl: "https://www.cnbc.com/2025/09/24/microsoft-adds-anthropic-model-to-microsoft-365-copilot.html", strengthScore: 0.7 },
  // row 26 — four NAMED encroachers, one Derived edge each:
  { id: "cited-26a-googl-nvda", datasetRow: 26, sourceId: "GOOGL", targetId: "NVDA", relationshipType: "supply_chain", tier: "derived", asOf: "2026-07-01",
    detail: "Google TPU: hyperscaler ASICs ~44.6% CAGR, targeting inference — structural threat to NVIDIA's ~80% share.",
    sourceUrl: "https://siliconanalysts.com/research/ai-data-center-value-chain", strengthScore: 0.5 },
  { id: "cited-26b-amzn-nvda", datasetRow: 26, sourceId: "AMZN", targetId: "NVDA", relationshipType: "supply_chain", tier: "derived", asOf: "2026-07-01",
    detail: "AWS Trainium: hyperscaler ASICs ~44.6% CAGR, targeting inference — structural threat to NVIDIA's ~80% share.",
    sourceUrl: "https://siliconanalysts.com/research/ai-data-center-value-chain", strengthScore: 0.5 },
  { id: "cited-26c-msft-nvda", datasetRow: 26, sourceId: "MSFT", targetId: "NVDA", relationshipType: "supply_chain", tier: "derived", asOf: "2026-07-01",
    detail: "Microsoft Maia: hyperscaler ASICs ~44.6% CAGR, targeting inference — structural threat to NVIDIA's ~80% share.",
    sourceUrl: "https://siliconanalysts.com/research/ai-data-center-value-chain", strengthScore: 0.5 },
  { id: "cited-26d-meta-nvda", datasetRow: 26, sourceId: "meta", targetId: "NVDA", relationshipType: "supply_chain", tier: "derived", asOf: "2026-07-01",
    detail: "Meta MTIA: hyperscaler ASICs ~44.6% CAGR, targeting inference — structural threat to NVIDIA's ~80% share.",
    sourceUrl: "https://siliconanalysts.com/research/ai-data-center-value-chain", strengthScore: 0.5 },
];

/** Convert a cited edge into the exposure-map edge shape the whole graph stack
 *  (hero, /dependencies, homepage counts) already consumes. The TIER is carried
 *  in the summary prefix (tooltips show it verbatim) and via the confidence
 *  mapping (loi/derived ⇒ "seed" ⇒ dashed). */
export function citedToExposureEdge(c: CitedEdge): ExposureMapEdge {
  return {
    id: c.id,
    sourceId: c.sourceId,
    targetId: c.targetId,
    relationshipType: c.relationshipType,
    strengthScore: c.strengthScore,
    confidence: CITED_TIER_TO_CONFIDENCE[c.tier],
    estimatedValue: c.estimatedValue,
    dateUpdated: c.asOf,
    summary: `[${TIER_LABEL[c.tier]} · as-of ${c.asOf}] ${c.detail}${c.sourceNote ? ` (source: ${c.sourceNote})` : ""}`,
    sourceUrls: [c.sourceUrl],
  };
}

/** Merge cited edges into the base curated set: a cited edge REPLACES a base
 *  edge with the same (sourceId, targetId, relationshipType) — the dashed
 *  "plausible" seed giving way to the cited row — and new pairs append. Pure. */
export function mergeCitedEdges(base: ExposureMapEdge[], cited: CitedEdge[] = CITED_EDGES): ExposureMapEdge[] {
  const key = (e: { sourceId: string; targetId: string; relationshipType: string }) =>
    `${e.sourceId}→${e.targetId}·${e.relationshipType}`;
  const citedByKey = new Map(cited.map((c) => [key(c), citedToExposureEdge(c)]));
  const out: ExposureMapEdge[] = [];
  const used = new Set<string>();
  for (const e of base) {
    const k = key(e);
    const replacement = citedByKey.get(k);
    if (replacement && !used.has(k)) {
      out.push(replacement);
      used.add(k);
    } else {
      out.push(e);
    }
  }
  for (const [k, e] of citedByKey) {
    if (!used.has(k)) out.push(e);
  }
  return out;
}
