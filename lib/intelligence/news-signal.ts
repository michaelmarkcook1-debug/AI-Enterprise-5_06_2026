// News → QUAD pillar-adjustment signal (v1.4).
//
// Converts fresh news into a BOUNDED, time-decayed nudge on each vendor's
// pillar scores, so the evidence-graded assessment tracks recent market events
// without letting a single press release move an evaluation. Design rules:
//
//   • Only recent (≤ WINDOW_DAYS), high-impact (≥ MIN_IMPACT) items count.
//   • Direction comes from sentiment (positive/negative), with suggestedScoreImpact
//     as a fallback tiebreaker. Neutral + no directional signal → ignored.
//   • Magnitude = impact × confidence × recency-decay, per item, small.
//   • Pillars: use the item's affectedPillars when they are valid PillarIds;
//     otherwise fall back to a deterministic category→pillar map so EVERY item
//     contributes (most ingested items carry categories but no affectedPillars).
//   • Per-pillar total is CAPPED at ±PER_PILLAR_CAP points. Across 6 pillars
//     (weights sum to 1) the max effect on the final 0-100 score is ≈ ±3 pts —
//     a tilt, never a veto.
//
// The engine consumes the returned Map; this module owns all the news semantics.

import type { NewsItem } from "./types";
import type { NewsAdjustment, PillarId } from "../types";

const WINDOW_DAYS = 45;
const MIN_IMPACT = 50;
const HALF_LIFE_DAYS = 21;
const PER_PILLAR_CAP = 3;        // max |net delta| per pillar (points)
const PER_ITEM_PILLAR_MAX = 1.2; // max a single item contributes to one pillar

const PILLAR_IDS: ReadonlySet<string> = new Set<PillarId>([
  "business_fit", "enterprise_control", "reliability_safety",
  "integration_ops", "vendor_resilience", "market_strength",
]);

// News category → engine pillars. Used when an item has no explicit
// affectedPillars (the common case for web-sourced and RSS news). Keys MUST be
// the canonical NewsCategory values (lib/intelligence/types.ts) — these are what
// the monitor + market-news runner actually write; snake_case keys would never
// match and the nudge would silently fall through to the default.
const CATEGORY_PILLARS: Record<string, PillarId[]> = {
  "Product launch":     ["market_strength", "business_fit"],
  "Pricing":            ["business_fit"],
  "Partnership":        ["integration_ops", "market_strength"],
  "Strategy signal":    ["vendor_resilience", "market_strength"],
  "Market movement":    ["market_strength"],
  "Regulation":         ["enterprise_control", "reliability_safety"],
  "Enterprise control": ["enterprise_control"],
  "Agentic AI":         ["market_strength", "integration_ops"],
  "Infrastructure":     ["integration_ops", "vendor_resilience"],
  "Risk event":         ["reliability_safety", "vendor_resilience"],
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function sentimentDirection(s: NewsItem["sentiment"]): number {
  switch (s) {
    case "positive": return 1;
    case "negative": return -1;
    case "mixed":    return 0.2;   // slight net-positive lean, very small
    default:         return 0;     // neutral
  }
}

/** Fallback direction from suggestedScoreImpact when sentiment is neutral. */
function suggestedDirection(item: NewsItem): number {
  if (!item.suggestedScoreImpact?.length) return 0;
  let up = 0;
  let down = 0;
  for (const s of item.suggestedScoreImpact) {
    if (s.direction === "up") up += 1;
    else if (s.direction === "down") down += 1;
  }
  if (up === down) return 0;
  return up > down ? 0.6 : -0.6;
}

function pillarsFor(item: NewsItem): PillarId[] {
  const explicit = item.affectedPillars?.filter((p): p is PillarId => PILLAR_IDS.has(p)) ?? [];
  if (explicit.length > 0) return Array.from(new Set(explicit));
  const fromCats = item.categories.flatMap((c) => CATEGORY_PILLARS[c] ?? []);
  if (fromCats.length > 0) return Array.from(new Set(fromCats));
  return ["market_strength"]; // last-resort: generic mindshare signal
}

/**
 * Build per-vendor pillar adjustments from a list of news items.
 * Returns a Map keyed by vendorId; vendors with no qualifying news are absent.
 */
export function computeNewsAdjustments(
  items: NewsItem[],
  asOf: Date = new Date(),
): Map<string, NewsAdjustment> {
  // vendorId → pillar → accumulated (uncapped) delta
  const acc = new Map<string, Map<PillarId, number>>();
  const drivers = new Map<string, NewsAdjustment["drivers"]>();

  for (const item of items) {
    if (!item.vendors?.length) continue;
    const impact = item.impactScore ?? 0;
    if (impact < MIN_IMPACT) continue;

    const ageDays = (asOf.getTime() - new Date(item.publishedAt).getTime()) / 86_400_000;
    if (ageDays < 0 || ageDays > WINDOW_DAYS) continue;

    let dir = sentimentDirection(item.sentiment);
    if (dir === 0) dir = suggestedDirection(item);
    if (dir === 0) continue; // no directional read → skip

    const decay = Math.exp(-ageDays / HALF_LIFE_DAYS);
    const conf = clamp((item.confidenceScore ?? 60) / 100, 0.3, 1);
    const magnitude = clamp((impact / 100) * conf * decay * PER_ITEM_PILLAR_MAX, 0, PER_ITEM_PILLAR_MAX);
    const signed = magnitude * dir;
    if (signed === 0) continue;

    const pillars = pillarsFor(item);
    for (const vendorId of item.vendors) {
      let perPillar = acc.get(vendorId);
      if (!perPillar) { perPillar = new Map(); acc.set(vendorId, perPillar); }
      for (const p of pillars) {
        perPillar.set(p, (perPillar.get(p) ?? 0) + signed);
      }
      const list = drivers.get(vendorId) ?? [];
      list.push({ title: item.title, pillars, delta: Math.round(signed * 100) / 100, publishedAt: item.publishedAt });
      drivers.set(vendorId, list);
    }
  }

  // Cap per pillar and assemble the result.
  const out = new Map<string, NewsAdjustment>();
  for (const [vendorId, perPillar] of acc) {
    const capped: Partial<Record<PillarId, number>> = {};
    let totalAbs = 0;
    for (const [pillar, raw] of perPillar) {
      const v = clamp(raw, -PER_PILLAR_CAP, PER_PILLAR_CAP);
      const rounded = Math.round(v * 100) / 100;
      if (Math.abs(rounded) < 0.01) continue;
      capped[pillar] = rounded;
      totalAbs += Math.abs(rounded);
    }
    if (Object.keys(capped).length === 0) continue;
    // Keep the strongest few drivers, newest first, for transparent output.
    const driverList = (drivers.get(vendorId) ?? [])
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 4);
    out.set(vendorId, { perPillar: capped, drivers: driverList, totalAbs: Math.round(totalAbs * 100) / 100 });
  }

  return out;
}
