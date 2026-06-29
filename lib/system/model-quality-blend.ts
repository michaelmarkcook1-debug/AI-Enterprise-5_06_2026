// Broadened model-quality blend — PURE, deterministic, no DB/LLM/writes.
// ─────────────────────────────────────────────────────────────────────────────
// Combines several REAL LMArena capability leaderboards (coding, reasoning/hard
// prompts, overall, vision, instruction-following) into one 0–5 model-quality
// score. Each arena is a SEPARATE Elo scale (a vision Elo of 1300 is not "worse"
// than a text Elo of 1500 — they are computed from different battle pools), so we
// normalise EACH category within its own fixed anchor window BEFORE blending.
//
// Why fixed anchors (not field min/max): min–max lets the weakest tracked model
// define the floor, which compresses everyone else upward and is unstable as the
// field changes. Fixed per-category anchors (a 250-Elo competitive window below a
// frozen frontier reference) keep the score stable and comparable across refreshes
// and solve the cross-arena scale problem. Anchors are a documented 2026-06
// frontier snapshot — refresh them when the leaderboards move materially (same
// maintenance posture as the Arena Elo snapshot).
//
// The blend is capped at 4.0 — the E4 band ceiling: these are community-preference
// benchmarks, not independent audits, so model-quality can never reach the 5.0
// "audit-grade" band (the under-claim rule, identical to the evidence rubric).
// A category a vendor has no ranked model in simply does not contribute (weights
// renormalise over present categories) and lowers confidence — never a default.

export type MqCategory =
  | "coding"
  | "hard_prompts"
  | "overall"
  | "vision"
  | "instruction_following";

export interface MqCategoryDef {
  key: MqCategory;
  label: string;
  weight: number; // sums to 1.0 across all categories
  /** HF dataset config + category the rating comes from (provenance + fetch). */
  config: "text" | "vision";
  sourceCategory: string;
  /** Fixed normalisation anchors on THIS arena's Elo scale: lo→0, hi→1 (clamped).
   *  hi = a frozen frontier reference per arena; lo = hi − 250 (competitive window). */
  anchorLo: number;
  anchorHi: number;
}

// Category weights set by rationale for a frontier-model-API buyer: code-gen and
// reasoning dominate consumption, with overall, vision (multimodal) and
// instruction-following as the other enterprise-relevant capability axes.
// Anchors frozen from the 2026-06-25 (text) / 2026-06-10 (vision) LMArena snapshot.
export const MODEL_QUALITY_CATEGORIES: MqCategoryDef[] = [
  { key: "coding",                label: "Coding",                  weight: 0.35, config: "text",   sourceCategory: "coding",                anchorLo: 1300, anchorHi: 1550 },
  { key: "hard_prompts",          label: "Hard prompts / reasoning", weight: 0.20, config: "text",  sourceCategory: "hard_prompts",          anchorLo: 1275, anchorHi: 1525 },
  { key: "overall",              label: "Overall",                 weight: 0.15, config: "text",   sourceCategory: "overall",               anchorLo: 1250, anchorHi: 1500 },
  { key: "vision",               label: "Vision (multimodal)",     weight: 0.15, config: "vision", sourceCategory: "overall",               anchorLo: 1075, anchorHi: 1325 },
  { key: "instruction_following", label: "Instruction-following",  weight: 0.15, config: "text",   sourceCategory: "instruction_following", anchorLo: 1275, anchorHi: 1525 },
];

export const MQ_CATEGORY_BY_KEY: Record<MqCategory, MqCategoryDef> = Object.fromEntries(
  MODEL_QUALITY_CATEGORIES.map((c) => [c.key, c]),
) as Record<MqCategory, MqCategoryDef>;

/** The E4 community-benchmark cap — model-quality can never reach the 5.0 audit band. */
export const MODEL_QUALITY_CAP = 4.0;

/** One vendor's real rating in one category (the vendor's TOP ranked model there). */
export interface MqCategoryInput {
  category: MqCategory;
  rating: number; // raw Arena Elo on that arena's scale
  modelName?: string;
  sourceUrl?: string;
}

export interface MqContribution {
  category: MqCategory;
  label: string;
  rating: number;        // raw Elo
  normalized: number;    // 0..1 within the category's fixed window
  weight: number;        // the category's nominal weight
  modelName?: string;
  sourceUrl?: string;
}

export interface MqBlendResult {
  score: number;            // 0..MODEL_QUALITY_CAP, 2 decimals
  normalized: number;       // 0..1 blended (renormalised over present categories)
  coverage: number;         // present categories / total categories (0..1)
  presentWeight: number;    // sum of nominal weights for present categories (0..1)
  confidence: number;       // 0..99
  contributions: MqContribution[]; // per present category, in canonical order
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Normalise a raw category Elo to 0..1 within that category's fixed anchor window. */
export function normalizeCategory(category: MqCategory, rating: number): number {
  const def = MQ_CATEGORY_BY_KEY[category];
  return clamp01((rating - def.anchorLo) / (def.anchorHi - def.anchorLo));
}

/**
 * Blend a vendor's per-category ratings into a single 0–5 model-quality score.
 * Returns null when the vendor has NO category data at all (honest absence — the
 * caller renders insufficient evidence, never a default). Deterministic.
 */
export function blendModelQuality(inputs: MqCategoryInput[]): MqBlendResult | null {
  // Keep one (the best) rating per category; ignore unknown categories.
  const byCat = new Map<MqCategory, MqCategoryInput>();
  for (const i of inputs) {
    if (!MQ_CATEGORY_BY_KEY[i.category]) continue;
    const cur = byCat.get(i.category);
    if (!cur || i.rating > cur.rating) byCat.set(i.category, i);
  }
  if (byCat.size === 0) return null;

  let acc = 0;
  let presentWeight = 0;
  const contributions: MqContribution[] = [];
  // Canonical order = MODEL_QUALITY_CATEGORIES order.
  for (const def of MODEL_QUALITY_CATEGORIES) {
    const input = byCat.get(def.key);
    if (!input) continue;
    const normalized = normalizeCategory(def.key, input.rating);
    acc += def.weight * normalized;
    presentWeight += def.weight;
    contributions.push({
      category: def.key,
      label: def.label,
      rating: input.rating,
      normalized,
      weight: def.weight,
      modelName: input.modelName,
      sourceUrl: input.sourceUrl,
    });
  }

  const normalized = presentWeight > 0 ? acc / presentWeight : 0; // renormalised over present
  const score = Math.round(normalized * MODEL_QUALITY_CAP * 100) / 100;
  const coverage = byCat.size / MODEL_QUALITY_CATEGORIES.length;
  // Confidence: an E4 community-benchmark blend with full category coverage is
  // strong (~90); thinner coverage lowers it. Never above 95 (benchmark, not audit).
  const confidence = Math.round(clamp01(0.5 + 0.45 * presentWeight) * 100) - 5;

  return { score, normalized, coverage, presentWeight, confidence, contributions };
}
