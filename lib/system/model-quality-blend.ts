// Model-quality scoring — from Artificial Analysis's Intelligence Index.
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the earlier LMArena-based blend. That system combined SEVERAL
// separate LMArena arena leaderboards (coding, hard prompts, overall, vision,
// instruction-following) ourselves, because each arena is an independently
// computed Elo pool with no natural combined number — LMArena never gives you
// "the" score for a model, only per-arena rankings you have to blend yourself.
//
// Artificial Analysis already does that combining for us: the Intelligence
// Index is ITS OWN documented, versioned, weighted composite (Agents 34% /
// Coding 24% / Scientific Reasoning 24% / General 18% as of v4.1 — see
// https://artificialanalysis.ai/methodology/intelligence-benchmarking) built
// from 9 evaluations, mostly independent third-party benchmarks (HLE, GPQA
// Diamond, Terminal-Bench, SciCode) with some of Artificial Analysis's own
// implementations (GDPval-AA, AA-Omniscience, etc.). So model_quality here is
// driven by Intelligence Index ALONE — re-blending their separately published
// Coding Index / Agentic Index on top would double-count dimensions the
// Intelligence Index already weights in. Those two indices are still real,
// cited, and shown (as informational context, zero score-weight), never
// silently dropped.
//
// Kept at the E4 evidence-grade cap (never 5.0/"audit-grade"): the Index mixes
// in Artificial Analysis's own self-run evaluations alongside third-party
// ones, so it is not a fully independent third-party audit — same "under-claim
// rather than over-claim" standard already applied to accredited-cert sources
// elsewhere in this codebase.
//
// ANCHOR WINDOW — calibrated against the FULL live roster (2026-07-08 pull:
// 548 models, 535 with an Intelligence Index; per-vendor flagship IIs across
// the 19 mapped roster vendors span 3–59.9). Same philosophy as the old Elo
// anchors: a fixed competitive window below a frozen frontier reference, so
// the score answers "how close is this vendor's best model to the current
// frontier" and stays stable as the field churns.
//   hi = 62 — just above the observed frontier max (Claude Fable 5 @ 59.9),
//        headroom for drift without instant re-anchoring.
//   lo = 15 — below the competitive pack (every flagship a buyer would
//        shortlist sits ≥ 17.8) and above the clearly-noncompetitive tail
//        (3–8.9: legacy/small models); those floor to ~0, which matches how
//        the old Arena window treated off-frontier vendors.
// Refresh when the frontier moves materially (same maintenance posture as
// the old Arena Elo snapshot); note Intelligence Index is itself versioned
// (v4.1 today) — a major version bump upstream is also a re-anchor trigger.

export type MqCategory = "intelligence" | "coding" | "agentic";

/** The E4 community/self-run-benchmark cap — model-quality can never reach the 5.0 audit band. */
export const MODEL_QUALITY_CAP = 4.0;

/** intelligence, coding, agentic — the maximum possible contributions[] length. */
export const MODEL_QUALITY_CATEGORY_COUNT = 3;

const INTELLIGENCE_ANCHOR_LO = 15;
const INTELLIGENCE_ANCHOR_HI = 62;

// The three indices are on DIFFERENT scales (verified live 2026-07-08:
// coding tops at 76.5, agentic at 52.8, intelligence at 59.9), so each gets
// its own display window — normalising coding inside the intelligence window
// would clamp frontier coding bars to a misleading 100%. Coding/agentic
// windows are DISPLAY-ONLY (weight 0); only intelligence drives the score.
const DISPLAY_ANCHORS: Record<MqCategory, { lo: number; hi: number }> = {
  intelligence: { lo: INTELLIGENCE_ANCHOR_LO, hi: INTELLIGENCE_ANCHOR_HI },
  coding: { lo: 20, hi: 80 },
  agentic: { lo: 10, hi: 55 },
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Normalise a raw Intelligence Index to 0..1 within the fixed anchor window. */
export function normalizeIntelligence(index: number): number {
  return clamp01((index - INTELLIGENCE_ANCHOR_LO) / (INTELLIGENCE_ANCHOR_HI - INTELLIGENCE_ANCHOR_LO));
}

/** Normalise any index to 0..1 within ITS OWN category's window (display bars). */
export function normalizeIndex(category: MqCategory, value: number): number {
  const { lo, hi } = DISPLAY_ANCHORS[category];
  return clamp01((value - lo) / (hi - lo));
}

/** One vendor's flagship model's real Artificial Analysis indices — all three
 *  MUST come from the SAME model (never mix indices across a vendor's
 *  different models, which would misattribute a score). */
export interface MqModelInput {
  intelligenceIndex: number | null;
  codingIndex: number | null;
  agenticIndex: number | null;
  modelName?: string;
  sourceUrl?: string;
}

export interface MqContribution {
  category: MqCategory;
  label: string;
  rating: number; // raw index value
  normalized: number; // 0..1 within the fixed window (informational categories still normalized for display)
  weight: number; // 1 for intelligence (the only score driver), 0 for coding/agentic (informational)
  modelName?: string;
  sourceUrl?: string;
}

export interface MqBlendResult {
  score: number; // 0..MODEL_QUALITY_CAP, 2 decimals — driven ENTIRELY by intelligenceIndex
  normalized: number; // 0..1, same basis as score
  coverage: number; // how many of the 3 indices are present (0..1) — completeness, not score weight
  presentWeight: number; // always 1 when scored (intelligence is the sole driver)
  confidence: number; // 0..99
  contributions: MqContribution[]; // intelligence first, then any present informational categories
}

/**
 * Score a vendor's flagship model from its real Artificial Analysis indices.
 * Returns null when intelligenceIndex itself is absent — the PRIMARY signal
 * this score is built on — even if coding/agentic are present (honest
 * absence; those two alone are not a basis for a score). Deterministic.
 */
export function blendModelQuality(input: MqModelInput): MqBlendResult | null {
  if (input.intelligenceIndex == null) return null;

  const normalized = normalizeIntelligence(input.intelligenceIndex);
  const score = Math.round(normalized * MODEL_QUALITY_CAP * 100) / 100;

  const contributions: MqContribution[] = [
    {
      category: "intelligence",
      label: "Intelligence Index",
      rating: input.intelligenceIndex,
      normalized,
      weight: 1,
      modelName: input.modelName,
      sourceUrl: input.sourceUrl,
    },
  ];
  if (input.codingIndex != null) {
    contributions.push({
      category: "coding",
      label: "Coding Index",
      rating: input.codingIndex,
      normalized: normalizeIndex("coding", input.codingIndex), // own scale; informational only
      weight: 0,
      modelName: input.modelName,
      sourceUrl: input.sourceUrl,
    });
  }
  if (input.agenticIndex != null) {
    contributions.push({
      category: "agentic",
      label: "Agentic Index",
      rating: input.agenticIndex,
      normalized: normalizeIndex("agentic", input.agenticIndex),
      weight: 0,
      modelName: input.modelName,
      sourceUrl: input.sourceUrl,
    });
  }

  const coverage = contributions.length / 3;
  // Confidence: intelligence alone is a real, complete score (not partial),
  // so the floor is higher than the old multi-arena blend's partial-coverage
  // case — full 3-index coverage nudges it up further. Never above 95
  // (benchmark composite, not an independent audit).
  const confidence = Math.round(clamp01(0.62 + 0.1 * (coverage - 1 / 3)) * 100) - 5;

  return { score, normalized, coverage, presentWeight: 1, confidence, contributions };
}
