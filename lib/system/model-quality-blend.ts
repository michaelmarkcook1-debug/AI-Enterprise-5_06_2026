// Model-quality scoring — from Artificial Analysis's published indices.
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the earlier LMArena-based blend. That system combined SEVERAL
// separate LMArena arena leaderboards ourselves, because each arena is an
// independently computed Elo pool with no natural combined number. Artificial
// Analysis publishes real composite indices directly:
//   • Intelligence Index — a documented, versioned weighted composite of 9
//     evaluations (Agents 34% / Coding 24% / Scientific Reasoning 24% /
//     General 18% as of v4.1 — see
//     https://artificialanalysis.ai/methodology/intelligence-benchmarking),
//     mostly independent third-party benchmarks (HLE, GPQA Diamond,
//     Terminal-Bench, SciCode) plus some of Artificial Analysis's own
//     implementations (GDPval-AA, AA-Omniscience).
//   • Coding Index / Agentic Index — the same suite's capability-scoped
//     composites.
//
// ONE index drives a given score (the `driver`): re-blending the others on
// top would double-count dimensions the Intelligence Index already weights
// in. Which index drives is a CATEGORY decision made by the caller
// (category-weights.ts): frontier model APIs are judged on the Intelligence
// Index; the developer-coding-agent category on the Coding Index — a coding
// buyer is buying coding capability, and Artificial Analysis publishes a
// purpose-built measure of exactly that. Non-driver indices are still real,
// cited, and shown (informational context, zero score-weight).
//
// Kept at the E4 evidence-grade cap (never 5.0/"audit-grade"): the indices
// mix third-party benchmarks with Artificial Analysis's own self-run
// evaluations, so they are not fully independent audits — same "under-claim
// rather than over-claim" standard as the accredited-cert sources.
//
// ANCHOR WINDOWS — calibrated against the FULL live roster (2026-07-08 pull:
// 548 models; 535 with an Intelligence Index; the three indices are on
// DIFFERENT scales — intelligence tops at 59.9, coding at 76.5, agentic at
// 52.8 — so each gets its own window). Same philosophy as the old Elo
// anchors: a fixed competitive window below a frozen frontier reference, so
// a score answers "how close is this vendor's best model to the current
// frontier" and stays stable as the field churns.
//   intelligence lo=15/hi=62 — hi just above the frontier max (59.9);
//     lo below the competitive pack (every shortlistable flagship ≥ 17.8)
//     and above the clearly-noncompetitive tail (3–8.9), which floors to ~0
//     exactly as the old Arena window treated off-frontier vendors.
//   coding lo=20/hi=80 — same construction against the coding distribution
//     (competitive pack 34–76.5; tail ≤ 10.4).
//   agentic lo=10/hi=55 — likewise (pack 19–52.8; tail ≤ 9.2).
// Refresh when the frontier moves materially; the indices are themselves
// versioned upstream (v4.1 today) — a major version bump is a re-anchor
// trigger too.

export type MqCategory = "intelligence" | "coding" | "agentic";

/** The E4 community/self-run-benchmark cap — model-quality can never reach the 5.0 audit band. */
export const MODEL_QUALITY_CAP = 4.0;

/** intelligence, coding, agentic — the maximum possible contributions[] length. */
export const MODEL_QUALITY_CATEGORY_COUNT = 3;

const ANCHORS: Record<MqCategory, { lo: number; hi: number }> = {
  intelligence: { lo: 15, hi: 62 },
  coding: { lo: 20, hi: 80 },
  agentic: { lo: 10, hi: 55 },
};

const CATEGORY_LABEL: Record<MqCategory, string> = {
  intelligence: "Intelligence Index",
  coding: "Coding Index",
  agentic: "Agentic Index",
};

/** Canonical display order — driver or not, contributions always render in this order. */
const CANONICAL_ORDER: MqCategory[] = ["intelligence", "coding", "agentic"];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Normalise an index value to 0..1 within ITS OWN category's fixed window. */
export function normalizeIndex(category: MqCategory, value: number): number {
  const { lo, hi } = ANCHORS[category];
  return clamp01((value - lo) / (hi - lo));
}

/** Back-compat alias for the intelligence window (frontier scoring). */
export function normalizeIntelligence(index: number): number {
  return normalizeIndex("intelligence", index);
}

/** One real, cited index reading. Each row carries ITS OWN model name — a
 *  vendor's best coding model may differ from its best overall model, and a
 *  rating must never be attributed to a model that didn't earn it. */
export interface MqIndexRow {
  category: MqCategory;
  rating: number;
  modelName?: string;
  sourceUrl?: string;
}

export interface MqContribution {
  category: MqCategory;
  label: string;
  rating: number; // raw index value
  normalized: number; // 0..1 within the category's own window
  weight: number; // 1 for the driver (sole score input), 0 for context rows
  modelName?: string;
  sourceUrl?: string;
}

export interface MqBlendResult {
  score: number; // 0..MODEL_QUALITY_CAP, 2 decimals — driven ENTIRELY by the driver index
  normalized: number; // 0..1, same basis as score
  driver: MqCategory; // which index drove the score
  coverage: number; // how many of the 3 indices are present (0..1) — completeness, not score weight
  presentWeight: number; // always 1 when scored (the driver is the sole driver)
  confidence: number; // 0..99
  contributions: MqContribution[]; // canonical order (intelligence, coding, agentic)
}

/**
 * Score a vendor from its real Artificial Analysis index rows, driven by ONE
 * index (default: intelligence). Returns null when the driver index itself is
 * absent — even if other indices are present (honest absence; a coding score
 * cannot be inferred from an intelligence reading, or vice versa).
 * Deterministic; keeps the best rating per category when duplicates appear.
 */
export function blendModelQuality(rows: MqIndexRow[], driver: MqCategory = "intelligence"): MqBlendResult | null {
  const byCat = new Map<MqCategory, MqIndexRow>();
  for (const r of rows) {
    if (!(r.category in ANCHORS)) continue;
    const cur = byCat.get(r.category);
    if (!cur || r.rating > cur.rating) byCat.set(r.category, r);
  }
  const driverRow = byCat.get(driver);
  if (!driverRow) return null;

  const normalized = normalizeIndex(driver, driverRow.rating);
  const score = Math.round(normalized * MODEL_QUALITY_CAP * 100) / 100;

  const contributions: MqContribution[] = [];
  for (const cat of CANONICAL_ORDER) {
    const row = byCat.get(cat);
    if (!row) continue;
    contributions.push({
      category: cat,
      label: CATEGORY_LABEL[cat],
      rating: row.rating,
      normalized: normalizeIndex(cat, row.rating),
      weight: cat === driver ? 1 : 0,
      modelName: row.modelName,
      sourceUrl: row.sourceUrl,
    });
  }

  const coverage = contributions.length / MODEL_QUALITY_CATEGORY_COUNT;
  // Confidence: the driver alone is a real, complete score (not partial), so
  // the floor sits at 57; corroborating context indices nudge it up. Never
  // above 95 (benchmark composite, not an independent audit).
  const confidence = Math.round(clamp01(0.62 + 0.1 * (coverage - 1 / 3)) * 100) - 5;

  return { score, normalized, driver, coverage, presentWeight: 1, confidence, contributions };
}
