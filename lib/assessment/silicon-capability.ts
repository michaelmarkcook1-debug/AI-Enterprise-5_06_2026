// AI-silicon capability signal — the category's cited capability driver.
// ──────────────────────────────────────────────────────────────────────────────
// AI silicon can't be ranked on the software-assessment domains: the evidence is
// thin and wrong-shaped, so the composite compressed to a noise band and put
// NVIDIA at #3 (indefensible). This is silicon's model_quality analogue — the
// hardware-appropriate capability signal, synthesized into the (dormant)
// `market_position` DomainScore and weighted as the category's primary driver in
// category-weights (ai_silicon). It reads the two signals that actually define
// silicon leadership:
//   1. INDEPENDENT PERFORMANCE — MLPerf / MLCommons (the objective benchmark, the
//      hardware equivalent of the Artificial Analysis Index for models);
//   2. DOCUMENTED MARKET POSITION — data-center accelerator share / revenue.
//
// Owner-approved bands (2026-07-13). Every band names its real sources; NO number
// is invented, and a vendor with no cited basis (e.g. TSMC — the fab, not an
// accelerator competitor) is ABSENT here → it stays held, never floated.
//
// BARE vendor ids (the live DB uses bare ids — see [[vendor-id-format-bare-not-prefixed]]).

import { DOMAIN_BAND_LABEL, type DomainScore, type DomainBand } from "./domain-rubric";
import { DOMAIN_TO_PILLAR, type EvidenceGrade } from "../types";

// ── Sources (verified live 2026-07-13) ──────────────────────────────────────
const MLPERF_V51 = "https://mlcommons.org/2025/11/training-v5-1-results/";
const NVDA_SWEEP =
  "https://developer.nvidia.com/blog/nvidia-blackwell-architecture-sweeps-mlperf-training-v5-1-benchmarks/";
const AMD_MLPERF = "https://www.amd.com/en/blogs/2025/amd-drives-ai-gains-with-mlperf-training-results.html";
const NVDA_SHARE = "https://siliconanalysts.com/analysis/nvidia-ai-accelerator-market-share-2024-2026";
const NVDA_92 =
  "https://carboncredits.com/nvidia-controls-92-of-the-gpu-market-in-2025-and-reveals-next-gen-ai-supercomputer/";

interface CapabilityBand {
  score: number; // 0–5 — owner-approved analyst read of the cited sources below
  confidence: number; // 0–100
  bestGrade: EvidenceGrade;
  /** One-line "why" for the methodology / breakdown. */
  rationale: string;
  citations: { url: string; grade: EvidenceGrade; asOf: string }[]; // asOf = YYYY-MM
}

const BANDS: Record<string, CapabilityBand> = {
  nvidia: {
    score: 4.7,
    confidence: 88,
    bestGrade: "E5",
    rationale:
      "Swept all 7 MLPerf Training v5.1 benchmarks (only vendor submitting FP4; Llama 3.1 405B in ~10 min) and holds ~80–92% of the data-center AI-accelerator market, reinforced by the CUDA ecosystem.",
    citations: [
      { url: NVDA_SWEEP, grade: "E5", asOf: "2025-11" },
      { url: MLPERF_V51, grade: "E5", asOf: "2025-11" },
      { url: NVDA_SHARE, grade: "E4", asOf: "2026-01" },
      { url: NVDA_92, grade: "E3", asOf: "2025-12" },
    ],
  },
  amd: {
    score: 3.2,
    confidence: 74,
    bestGrade: "E5",
    rationale:
      "Credible #2: in its MLPerf Training debut the Instinct MI325X beat NVIDIA's H200 by ~8% on Llama-2-70B fine-tuning; ~5–7% accelerator share, with structural OpenAI/Meta commitments.",
    citations: [
      { url: AMD_MLPERF, grade: "E5", asOf: "2025-06" },
      { url: NVDA_SHARE, grade: "E4", asOf: "2026-01" },
    ],
  },
  broadcom: {
    score: 3.0,
    confidence: 70,
    bestGrade: "E4",
    rationale:
      "Custom-ASIC powerhouse — designs hyperscaler accelerators (e.g. Google TPU): AI-ASIC revenue ~$8.4B/quarter with a ~$73B backlog. A different lane from merchant GPUs, so it is not benchmarked in MLPerf.",
    citations: [{ url: NVDA_SHARE, grade: "E4", asOf: "2026-01" }],
  },
  cerebras: {
    score: 1.8,
    confidence: 55,
    bestGrade: "E3",
    rationale:
      "Niche wafer-scale specialist — real technology, but a small share and not competitively benchmarked against merchant accelerators at scale.",
    citations: [{ url: NVDA_SHARE, grade: "E3", asOf: "2026-01" }],
  },
  // TSMC intentionally ABSENT — it is the fabricator (upstream supply), not an
  // accelerator competitor; ranking the fab against NVIDIA is a category error.
};

const clampScore = (n: number): number => Math.max(0, Math.min(5, n));

/**
 * The vendor's silicon capability as a `market_position` DomainScore, or null
 * when there is no cited basis (→ absent, honestly held). Pure — no DB, no LLM.
 */
export function synthesizeSiliconMarketPosition(vendorId: string): DomainScore | null {
  const b = BANDS[vendorId];
  if (!b) return null;
  const score = clampScore(b.score);
  const band = Math.round(score) as DomainBand;
  return {
    domain: "market_position",
    pillar: DOMAIN_TO_PILLAR["market_position"],
    state: "scored",
    score,
    band,
    bandLabel: DOMAIN_BAND_LABEL[band],
    confidence: b.confidence,
    lowConfidence: b.confidence < 60,
    bestGrade: b.bestGrade,
    evidenceCount: b.citations.length,
    citations: b.citations.map((c) => ({
      sourceUrl: c.url,
      evidenceGrade: c.grade,
      capturedAt: `${c.asOf}-01T00:00:00.000Z`,
    })),
  };
}

/** The cited "why" for a silicon vendor's capability band (methodology / UI). */
export function siliconCapabilityRationale(vendorId: string): string | null {
  return BANDS[vendorId]?.rationale ?? null;
}

/** True when the vendor has a cited silicon-capability band (i.e. is not the fab). */
export function hasSiliconCapability(vendorId: string): boolean {
  return vendorId in BANDS;
}
