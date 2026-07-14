// Hardware & AI-infrastructure capability signal — the cited capability driver
// for the three infrastructure categories (ai_silicon, ai_cloud_compute,
// neocloud_inference).
// ──────────────────────────────────────────────────────────────────────────────
// These markets can't be ranked on the software-assessment domains: the evidence
// is thin and wrong-shaped, so the composite compresses to a noise band and puts
// the obvious leader mid-pack (indefensible). This is the model_quality analogue
// for hardware/infra — the capacity-appropriate capability signal, synthesized
// into the (dormant) `market_position` DomainScore and weighted as each category's
// primary driver in category-weights. The signal it reads differs by market:
//   • ai_silicon — INDEPENDENT PERFORMANCE (MLPerf/MLCommons) + documented
//     data-center accelerator share/revenue.
//   • ai_cloud_compute / neocloud_inference — DOCUMENTED CAPACITY & POSITION:
//     cloud-infrastructure market share, AI capex/buildout, contracted backlog
//     (RPO), GPU-fleet scale, and revenue. NOT MLPerf — a cloud's capability is
//     capacity and deployment, not a chip benchmark.
//
// Each band is an ABSOLUTE capability read (how strong this provider is on the
// world stage), NOT a peer-relative rank — the within-category composite does the
// ranking by comparing composites inside a category. That is why CoreWeave carries
// one score (~3.4) that correctly lands it below the hyperscalers in
// ai_cloud_compute yet ahead of the smaller specialists in neocloud_inference.
//
// Owner-approved bands (silicon 2026-07-13; cloud + neocloud 2026-07-14). Every
// band names its real sources; NO number is invented, and a vendor with no cited
// basis (e.g. TSMC — the fab, not an accelerator competitor) is ABSENT → it stays
// held, never floated. Nascent/announced-only players (humain, nscale) are scored
// LOW with E3 evidence — under-claim, never float on the buzz.
//
// BARE vendor ids (the live DB uses bare ids — see [[vendor-id-format-bare-not-prefixed]]).

import { DOMAIN_BAND_LABEL, type DomainScore, type DomainBand } from "./domain-rubric";
import { DOMAIN_TO_PILLAR, type EvidenceGrade } from "../types";

// ── Silicon sources (verified live 2026-07-13) ──────────────────────────────
const MLPERF_V51 = "https://mlcommons.org/2025/11/training-v5-1-results/";
const NVDA_SWEEP =
  "https://developer.nvidia.com/blog/nvidia-blackwell-architecture-sweeps-mlperf-training-v5-1-benchmarks/";
const AMD_MLPERF = "https://www.amd.com/en/blogs/2025/amd-drives-ai-gains-with-mlperf-training-results.html";
const NVDA_SHARE = "https://siliconanalysts.com/analysis/nvidia-ai-accelerator-market-share-2024-2026";
const NVDA_92 =
  "https://carboncredits.com/nvidia-controls-92-of-the-gpu-market-in-2025-and-reveals-next-gen-ai-supercomputer/";

// ── Cloud & neocloud sources (verified live 2026-07-14) ─────────────────────
// Hyperscaler cloud-infrastructure share + AI capex (Q4 2025).
const OMDIA_CLOUD_Q425 =
  "https://omdia.tech.informa.com/pr/2026/mar/global-cloud-infrastructure-spending-rose-29percent-in-q4-2025-as-hyperscalers-scaled-ai-infrastructure-investment";
const CLOUD_SHARE_2026 =
  "https://businesstats.com/big-three-hold-dominant-lead-in-accelerating-cloud-market/";
// Oracle AI-cloud position — RPO backlog + $300B OpenAI/Stargate capacity.
const ORACLE_STARGATE =
  "https://www.datacenterfrontier.com/machine-learning/article/55316610/openai-and-oracles-300b-stargate-deal-building-ais-national-scale-infrastructure";
const ORACLE_BACKLOG = "https://erp.today/oracle-loads-up-on-ai-infrastructure-as-oci-backlog-data-center-commitments-surge/";
// Sovereign AI clouds — G42 (Microsoft-backed UAE buildout) + HUMAIN (Saudi PIF).
const G42_MSFT_UAE =
  "https://news.microsoft.com/source/emea/2025/11/microsoft-and-g42-accelerate-uaes-digital-future-with-major-data-centre-expansion/";
const SOVEREIGN_AI_2026 = "https://pdpspectra.com/blog/sovereign-ai-initiatives-2026/";
// Neocloud scale — CoreWeave backlog (SEC 8-K), plus funding/revenue for the specialists.
const COREWEAVE_8K =
  "https://www.sec.gov/Archives/edgar/data/1769628/000176962825000010/coreweave1q25earningspress.htm";
const NEOCLOUD_EARNINGS =
  "https://www.datacenterknowledge.com/cloud/earnings-roundup-neoclouds-shift-from-gpu-race-to-power-wars";
const NEOCLOUD_PROFILES = "https://www.abiresearch.com/blog/leading-neocloud-companies";
const TOGETHER_800M = "https://techfundingnews.com/together-ai-raises-800m-at-8-3b-valuation-as-enterprises-ditch-closed-models-for-open-source/";
const FIREWORKS_SACRA = "https://sacra.com/c/fireworks-ai/";
const GROQ_650M = "https://valueaddvc.com/pulse/groq-650m-inference-cloud-2026";

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

  // ── AI CLOUD & COMPUTE — hyperscaler / sovereign capacity ──────────────────
  // Signal: cloud-infrastructure market share + AI capex/buildout + contracted
  // backlog. Absolute reads; the composite ranks within the category.
  aws: {
    score: 4.5,
    confidence: 82,
    bestGrade: "E4",
    rationale:
      "The #1 cloud-infrastructure provider (~28–30% of a market that grew 29% YoY in Q4 2025), with in-house Trainium/Inferentia accelerators and Bedrock — the broadest, most durable AI-capacity base.",
    citations: [
      { url: CLOUD_SHARE_2026, grade: "E4", asOf: "2026-02" },
      { url: OMDIA_CLOUD_Q425, grade: "E4", asOf: "2026-03" },
    ],
  },
  microsoft: {
    score: 4.5,
    confidence: 82,
    bestGrade: "E4",
    rationale:
      "#2 in cloud infrastructure (~21–24%) but a co-leader in AI capacity specifically — the OpenAI partnership plus one of the largest AI-datacenter capex programs of any hyperscaler.",
    citations: [
      { url: CLOUD_SHARE_2026, grade: "E4", asOf: "2026-02" },
      { url: OMDIA_CLOUD_Q425, grade: "E4", asOf: "2026-03" },
    ],
  },
  google: {
    score: 4.2,
    confidence: 80,
    bestGrade: "E4",
    rationale:
      "#3 cloud-infrastructure provider (~13–14%, gaining share) with a decade-deep custom-silicon program (TPU) and Gemini — a genuinely differentiated, self-sufficient AI-capacity stack.",
    citations: [
      { url: CLOUD_SHARE_2026, grade: "E4", asOf: "2026-02" },
      { url: OMDIA_CLOUD_Q425, grade: "E4", asOf: "2026-03" },
    ],
  },
  oracle: {
    score: 3.9,
    confidence: 72,
    bestGrade: "E4",
    rationale:
      "A modest general-cloud share but an outsized AI-capacity position: OCI's remaining performance obligations surged past $450B on the ~$300B/4.5GW OpenAI–Stargate contract, backed by ~$50B of FY26 capex. Backlog-heavy (execution risk), so weighted below the top hyperscalers.",
    citations: [
      { url: ORACLE_STARGATE, grade: "E4", asOf: "2025-09" },
      { url: ORACLE_BACKLOG, grade: "E4", asOf: "2025-12" },
    ],
  },
  alibaba: {
    score: 3.4,
    confidence: 68,
    bestGrade: "E4",
    rationale:
      "The dominant China/APAC cloud (~4% globally, #1 in-region) with its own Qwen models and a large multi-year AI-infrastructure capex commitment — the leading non-US hyperscale AI-capacity provider.",
    citations: [{ url: CLOUD_SHARE_2026, grade: "E4", asOf: "2026-02" }],
  },
  coreweave: {
    score: 3.4,
    confidence: 70,
    bestGrade: "E4",
    rationale:
      "The largest independent AI cloud — >$5B revenue run-rate and a ~$67B contracted backlog, first to deploy successive NVIDIA generations at scale. A specialist below the diversified hyperscalers on breadth, but ahead of the smaller neoclouds it competes with.",
    citations: [
      { url: COREWEAVE_8K, grade: "E5", asOf: "2025-05" },
      { url: NEOCLOUD_EARNINGS, grade: "E4", asOf: "2026-02" },
    ],
  },
  g42: {
    score: 2.4,
    confidence: 52,
    bestGrade: "E3",
    rationale:
      "The UAE sovereign-AI champion — Microsoft-backed buildout (a 200MW expansion within a $15.2B UAE commitment), Cerebras and NVIDIA clusters via Core42/Khazna. Real and growing, but regionally scoped and smaller than the global hyperscalers.",
    citations: [
      { url: G42_MSFT_UAE, grade: "E3", asOf: "2025-11" },
      { url: SOVEREIGN_AI_2026, grade: "E3", asOf: "2026-01" },
    ],
  },
  humain: {
    score: 1.8,
    confidence: 45,
    bestGrade: "E3",
    rationale:
      "Saudi Arabia's PIF-owned national AI champion, launched May 2025 with major chip partnerships — but capacity is largely announced/forward, not yet deployed at scale. Scored low and held at low confidence (under-claim, not floated on the announcements).",
    citations: [{ url: SOVEREIGN_AI_2026, grade: "E3", asOf: "2026-01" }],
  },

  // ── NEOCLOUD & INFERENCE — AI-specialist GPU/inference clouds ──────────────
  // Signal: GPU-fleet scale, revenue/backlog, funding-implied position. (aws/
  // microsoft/google/oracle/alibaba/coreweave bands above also serve the cloud
  // category; the four below are neocloud-only.)
  together: {
    score: 3.3,
    confidence: 66,
    bestGrade: "E4",
    rationale:
      "A leading open-model inference/training cloud — ~$8.3B valuation on an $800M 2026 round, with annual bookings past $1.15B as enterprises shift to open weights. The strongest of the pure-play inference specialists after CoreWeave.",
    citations: [{ url: TOGETHER_800M, grade: "E4", asOf: "2026-07" }],
  },
  fireworks: {
    score: 3.0,
    confidence: 62,
    bestGrade: "E4",
    rationale:
      "Fast-growing inference platform — ~$800M annualized revenue (up from ~$305M end-2025) on strong developer adoption of open models; ~$4B valuation with a much larger round reported in talks.",
    citations: [{ url: FIREWORKS_SACRA, grade: "E4", asOf: "2026-05" }],
  },
  lambda: {
    score: 3.0,
    confidence: 58,
    bestGrade: "E3",
    rationale:
      "An established GPU cloud — a 100MW 'AI Factory' housing 10,000+ NVIDIA Blackwell Ultra GPUs plus a hyperscaler capacity deal, funded by a $480M Series D. Real deployed fleet, a step below CoreWeave on scale.",
    citations: [{ url: NEOCLOUD_EARNINGS, grade: "E3", asOf: "2026-02" }],
  },
  groq: {
    score: 2.9,
    confidence: 56,
    bestGrade: "E3",
    rationale:
      "A differentiated inference-first player on custom LPU silicon (GroqCloud), validated by a ~$20B NVIDIA LPU-technology license and a $650M raise to rebuild as an inference cloud — genuine capability, but mid-transition and narrower than the general GPU clouds.",
    citations: [{ url: GROQ_650M, grade: "E3", asOf: "2026-06" }],
  },
  nscale: {
    score: 2.1,
    confidence: 44,
    bestGrade: "E3",
    rationale:
      "A young European neocloud building forward AI capacity on announced hyperscaler deals — real momentum but limited proven, deployed scale. Scored low and held at low confidence (under-claim).",
    citations: [{ url: NEOCLOUD_PROFILES, grade: "E3", asOf: "2026-01" }],
  },
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
