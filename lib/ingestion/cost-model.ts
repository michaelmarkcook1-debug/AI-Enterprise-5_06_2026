// Ingestion cost model — real, deterministic, assumption-transparent.
// ────────────────────────────────────────────────────────────────────
// Computes the estimated Anthropic API cost of an ingestion run from
// (a) verified published per-MTok prices and (b) explicit, editable
// workload assumptions. No hidden numbers: every input is visible in the
// UI and every line of the estimate is reproducible.
//
// Prices verified 10 Jun 2026 against Anthropic's published rates
// (standard API, USD per million tokens). Batch API is 50% off; prompt
// cache reads are 0.1× input price. Update PRICES if Anthropic changes
// list pricing.
//
// Staged model strategy (product decision, 10 Jun 2026):
//   T1 claude-haiku-4-5   $1/$5    bulk collection: classification,
//                                  dedupe, evidence extraction
//   T2 claude-sonnet-4-6  $3/$15   context work: URL discovery, evidence
//                                  enrichment, summarisation
//   T3 opus-class         $5/$25   analyst-grade synthesis: insight
//                                  narratives, board-pack prose —
//                                  ALWAYS via Batch API (−50%)
// These align with the existing env hooks: ANTHROPIC_EXTRACT_MODEL
// (default haiku) and ANTHROPIC_MODEL (default sonnet).

export interface ModelPrice {
  id: string;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

export const PRICES: Record<"haiku" | "sonnet" | "opus", ModelPrice> = {
  haiku: { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPerMTok: 1, outputPerMTok: 5 },
  sonnet: { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", inputPerMTok: 3, outputPerMTok: 15 },
  opus: { id: "claude-opus-4-8", label: "Claude Opus 4.8", inputPerMTok: 5, outputPerMTok: 25 },
};

export const BATCH_DISCOUNT = 0.5; // Batch API: 50% off input and output

/** Editable workload assumptions for one full ingestion run. */
export interface IngestionAssumptions {
  vendorCount: number;
  /** T2 — URL discovery per vendor (Sonnet) */
  urlFinder: { inputTokens: number; outputTokens: number };
  /** T1 — evidence extraction per document (Haiku) */
  docsPerVendor: number;
  extraction: { inputTokensPerDoc: number; outputTokensPerDoc: number };
  /** T2 — context enrichment per vendor (Sonnet) */
  enrichment: { inputTokens: number; outputTokens: number };
  /** T3 — analyst narrative per vendor (Opus, Batch API) */
  narrative: { inputTokens: number; outputTokens: number; useBatch: boolean };
}

export const DEFAULT_ASSUMPTIONS: IngestionAssumptions = {
  vendorCount: 42,
  urlFinder: { inputTokens: 2000, outputTokens: 300 },
  docsPerVendor: 6,
  extraction: { inputTokensPerDoc: 8000, outputTokensPerDoc: 1200 },
  enrichment: { inputTokens: 6000, outputTokens: 1500 },
  narrative: { inputTokens: 12000, outputTokens: 2500, useBatch: true },
};

export interface StageCost {
  stage: string;
  model: string;
  tier: "T1" | "T2" | "T3";
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  note?: string;
}

export interface IngestionEstimate {
  stages: StageCost[];
  totalUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

const cost = (inTok: number, outTok: number, p: ModelPrice, discount = 1) =>
  ((inTok / 1e6) * p.inputPerMTok + (outTok / 1e6) * p.outputPerMTok) * discount;

export function estimateIngestionCost(a: IngestionAssumptions = DEFAULT_ASSUMPTIONS): IngestionEstimate {
  const v = Math.max(0, a.vendorCount);
  const stages: StageCost[] = [];

  const urlIn = v * a.urlFinder.inputTokens;
  const urlOut = v * a.urlFinder.outputTokens;
  stages.push({
    stage: "Source discovery (URL finding)", model: PRICES.sonnet.label, tier: "T2",
    calls: v, inputTokens: urlIn, outputTokens: urlOut,
    costUsd: cost(urlIn, urlOut, PRICES.sonnet),
  });

  const docs = v * a.docsPerVendor;
  const exIn = docs * a.extraction.inputTokensPerDoc;
  const exOut = docs * a.extraction.outputTokensPerDoc;
  stages.push({
    stage: "Evidence extraction", model: PRICES.haiku.label, tier: "T1",
    calls: docs, inputTokens: exIn, outputTokens: exOut,
    costUsd: cost(exIn, exOut, PRICES.haiku),
  });

  const enIn = v * a.enrichment.inputTokens;
  const enOut = v * a.enrichment.outputTokens;
  stages.push({
    stage: "Context enrichment & summarisation", model: PRICES.sonnet.label, tier: "T2",
    calls: v, inputTokens: enIn, outputTokens: enOut,
    costUsd: cost(enIn, enOut, PRICES.sonnet),
  });

  const naIn = v * a.narrative.inputTokens;
  const naOut = v * a.narrative.outputTokens;
  const discount = a.narrative.useBatch ? BATCH_DISCOUNT : 1;
  stages.push({
    stage: "Analyst narrative synthesis", model: PRICES.opus.label, tier: "T3",
    calls: v, inputTokens: naIn, outputTokens: naOut,
    costUsd: cost(naIn, naOut, PRICES.opus, discount),
    note: a.narrative.useBatch ? "Batch API (−50%)" : "Standard rate",
  });

  const totalUsd = stages.reduce((s, x) => s + x.costUsd, 0);
  return {
    stages,
    totalUsd: Math.round(totalUsd * 100) / 100,
    totalInputTokens: stages.reduce((s, x) => s + x.inputTokens, 0),
    totalOutputTokens: stages.reduce((s, x) => s + x.outputTokens, 0),
  };
}
