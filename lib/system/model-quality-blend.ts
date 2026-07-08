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
// PROVISIONAL ANCHOR WINDOW: normalizeIntelligence()'s anchorLo/anchorHi below
// are a first-pass estimate from the ~8 highest-scoring models visible from
// artificialanalysis.ai's public page (frontier currently ~44-60) — NOT yet
// calibrated against the full ~100+ model roster (that requires a live API
// pull, which requires a real API key). Recalibrate anchorLo especially once
// the full distribution is visible — an uninformed floor risks compressing or
// stretching the field incorrectly. Do not treat this window as final.

export type MqCategory = "intelligence" | "coding" | "agentic";

/** The E4 community/self-run-benchmark cap — model-quality can never reach the 5.0 audit band. */
export const MODEL_QUALITY_CAP = 4.0;

/** intelligence, coding, agentic — the maximum possible contributions[] length. */
export const MODEL_QUALITY_CATEGORY_COUNT = 3;

// PROVISIONAL — see module header. hi = just above the observed 2026-07 frontier
// (Claude Fable 5 @ 60); lo is a wide, deliberately conservative guess pending
// real full-roster data, to avoid clipping unknown mid/lower-tier models to 0.
const INTELLIGENCE_ANCHOR_LO = 15;
const INTELLIGENCE_ANCHOR_HI = 62;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Normalise a raw Intelligence Index to 0..1 within the fixed anchor window. */
export function normalizeIntelligence(index: number): number {
  return clamp01((index - INTELLIGENCE_ANCHOR_LO) / (INTELLIGENCE_ANCHOR_HI - INTELLIGENCE_ANCHOR_LO));
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
      normalized: normalizeIntelligence(input.codingIndex), // same window; informational only
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
      normalized: normalizeIntelligence(input.agenticIndex),
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
