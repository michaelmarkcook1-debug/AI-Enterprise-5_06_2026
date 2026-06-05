// News-driven return tilt for the Investment Simulator.
// ──────────────────────────────────────────────────────
// Converts the LiveNewsItem array attached to each enriched provider
// (see ./live-data.ts) into a small annual-return adjustment that the
// simulator can add on top of its scenario-based baseline return.
//
// Why this is in its own module:
//   - Keeps the simulator's existing scenario math pure and testable.
//   - Lets the news-overlay logic be opted in or out via a flag on
//     SimulationInput.applyNewsOverlay, just like applySignalOverlay.
//   - Makes the per-news-item math explicit so we can audit how each
//     story moved a holding (rendered in the simulator results panel).
//
// Algorithm — short version:
//   tilt = Σ over recent news items of:
//             direction_sign(impact)              // +1 / -1 / 0
//           × min(impactScore, 100) / 100         // normalise impact
//           × min(confidence, 100) / 100          // weight by confidence
//           × age_decay(publishedAt)              // exponential half-life
//           × CATEGORY_WEIGHT[category]           // tilt by category
//           × LIVE_BIAS                           // live > seed
//
// The sum is then clamped to ±MAX_TILT so a single noisy story can't
// blow the simulator up. Default MAX_TILT = ±400 bps (±4% on annual
// return) — large enough to be visible, small enough to defer to the
// scenario math when there's no news to anchor to.

import type { LiveNewsItem } from "./live-data";

const NEWS_HALF_LIFE_DAYS = 14;
const MAX_TILT = 0.04; // ±4.00pp annual return
const LIVE_WEIGHT = 1;
const SEED_WEIGHT = 0.4; // seed news contributes less than verified live news

// Per-category weight on the tilt. Categories that move stock prices
// faster (pricing, launches, regulation) get a higher coefficient than
// general market chatter.
const CATEGORY_WEIGHT: Record<string, number> = {
  "Product launch":       0.9,
  "Pricing":              1.0,
  "Partnership":          0.7,
  "Regulation":           1.1,
  "Risk event":           1.2,
  "Market movement":      0.8,
  "Strategy signal":      0.6,
  "Enterprise control":   0.7,
  "Agentic AI":           0.8,
  "Reliability incident": 1.0,
};

const FALLBACK_CATEGORY_WEIGHT = 0.6;

/**
 * Convert a news item's `suggestedScoreImpact` / sentiment proxy into a
 * directional sign for the tilt sum. Up = +1, Down = -1, Watch = 0.
 *
 * NewsItem.sentiment ("positive" | "negative" | "neutral" | "mixed") is
 * the simplest, most reliable signal — `suggestedScoreImpact` is per-
 * pillar and aimed at the QUAD score, not at investment return. We use
 * sentiment first and fall back to impactScore polarity if the news
 * source didn't classify it.
 */
function directionSign(item: LiveNewsItemForTilt): -1 | 0 | 1 {
  if (item.sentiment === "positive") return 1;
  if (item.sentiment === "negative") return -1;
  if (item.sentiment === "mixed") return 0;
  // No explicit sentiment — use the suggestedScoreImpact direction
  // majority if we have it, otherwise treat as neutral.
  if (item.suggestedScoreImpact && item.suggestedScoreImpact.length > 0) {
    const ups = item.suggestedScoreImpact.filter((s) => s.direction === "up").length;
    const downs = item.suggestedScoreImpact.filter((s) => s.direction === "down").length;
    if (ups > downs) return 1;
    if (downs > ups) return -1;
  }
  return 0;
}

/** Continuous exponential decay so a 14-day-old item is worth ½, a 28-day-old item ¼, etc. */
function ageDecay(publishedAt: string, now: Date): number {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return 0.25;
  const days = Math.max(0, (now.getTime() - t) / 86_400_000);
  return Math.pow(0.5, days / NEWS_HALF_LIFE_DAYS);
}

/**
 * Extended LiveNewsItem shape with the two optional fields the tilt
 * algorithm uses but live-data.ts doesn't yet surface. We accept the
 * superset so callers can pass the raw NewsItem if they prefer to
 * preserve sentiment + suggestedScoreImpact.
 */
export interface LiveNewsItemForTilt extends LiveNewsItem {
  sentiment?: "positive" | "negative" | "neutral" | "mixed";
  suggestedScoreImpact?: { direction: "up" | "down" | "watch"; magnitude: number }[];
}

/* ─── Per-item contribution + total tilt ────────────────────────── */

export interface NewsTiltContribution {
  newsId: string;
  title: string;
  publishedAt: string;
  /** Decimal annual-return delta this item alone contributed (e.g. +0.0042 = +0.42pp). */
  contribution: number;
  direction: "up" | "down" | "neutral";
  weightedImpact: number;
}

export interface NewsTiltResult {
  /** Decimal annual return delta to add to the holding's baseline. Clamped to ±MAX_TILT. */
  tilt: number;
  /** Per-item breakdown — useful for the UI "why did news move this holding" panel. */
  contributions: NewsTiltContribution[];
}

export function computeNewsTilt(
  news: LiveNewsItemForTilt[],
  now: Date = new Date(),
): NewsTiltResult {
  if (news.length === 0) {
    return { tilt: 0, contributions: [] };
  }

  const contributions: NewsTiltContribution[] = [];
  let raw = 0;
  for (const item of news) {
    const sign = directionSign(item);
    if (sign === 0) continue;
    const impactNorm = Math.min(100, Math.max(0, item.impactScore)) / 100;
    const confNorm = Math.min(100, Math.max(0, item.confidence)) / 100;
    const decay = ageDecay(item.publishedAt, now);
    const catWeight = CATEGORY_WEIGHT[item.categories[0] ?? ""] ?? FALLBACK_CATEGORY_WEIGHT;
    const liveBias = item.isLive ? LIVE_WEIGHT : SEED_WEIGHT;
    const weightedImpact = impactNorm * confNorm * decay * catWeight * liveBias;
    // Each item contributes up to ±0.6pp annual return at full weight.
    const contribution = sign * weightedImpact * 0.006;
    raw += contribution;
    contributions.push({
      newsId: item.id,
      title: item.title,
      publishedAt: item.publishedAt,
      contribution,
      direction: sign === 1 ? "up" : "down",
      weightedImpact,
    });
  }

  // Clamp to ±MAX_TILT so a noisy week can't dominate the scenario math.
  const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, raw));
  return { tilt, contributions };
}

/**
 * Convenience: given a per-provider news bundle and an optional global
 * market-regime modifier (-1..+1), return both the tilt and a short
 * human-readable rationale string suitable for the simulator UI.
 */
export function newsTiltWithRationale(
  news: LiveNewsItemForTilt[],
  marketRegimeModifier = 0,
  now: Date = new Date(),
): { tilt: number; rationale: string; contributions: NewsTiltContribution[] } {
  const { tilt, contributions } = computeNewsTilt(news, now);
  const adjustedTilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, tilt + marketRegimeModifier * 0.01));
  const tiltPct = (adjustedTilt * 100).toFixed(2);
  const dir = adjustedTilt > 0.0005 ? "lift" : adjustedTilt < -0.0005 ? "drag" : "no net effect";
  const upCount = contributions.filter((c) => c.direction === "up").length;
  const downCount = contributions.filter((c) => c.direction === "down").length;
  const rationale = contributions.length === 0
    ? "No recent classified news to tilt the return."
    : `${dir} of ${tiltPct}pp from ${contributions.length} recent stor${contributions.length === 1 ? "y" : "ies"} (${upCount} positive · ${downCount} negative); decay half-life ${NEWS_HALF_LIFE_DAYS}d, clamped to ±${(MAX_TILT * 100).toFixed(1)}pp.`;
  return { tilt: adjustedTilt, rationale, contributions };
}

export const NEWS_TILT_MAX = MAX_TILT;
