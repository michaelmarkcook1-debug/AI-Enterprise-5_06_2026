// Ranking-history reconstruction for the dashboard "Who's winning / losing"
// hover-over trend graphs.
//
// The MVP intelligence layer does not persist a per-day snapshot of vendor
// ranking metrics — the seed data is a single current-state cut. Until a
// real daily snapshot table exists, this module reconstructs a deterministic,
// stable day-by-day series for each vendor so the dashboard can show "how the
// ranking metric moved since we started tracking this vendor".
//
// Determinism matters: the same vendor must produce the same curve on every
// render (server + client) so the hover graph never flickers or disagrees
// with itself. All randomness is seeded from the vendor id.
//
// When a real IntelligenceVendorSnapshot table lands, replace
// `buildRankingHistories` with a DB read — the `VendorRankingHistory` shape
// is the stable contract the UI depends on.

import type { Vendor, VendorMomentum } from "./types";

export interface RankingHistoryPoint {
  /** Calendar date, yyyy-mm-dd. */
  date: string;
  /** Composite overall ranking score that day, 0-100. */
  score: number;
  /** Momentum score that day, 0-100. */
  momentum: number;
  /** Position in the tracked universe that day (1 = top). */
  rank: number;
}

export interface VendorRankingHistory {
  vendorId: string;
  /** First day this vendor entered tracking (yyyy-mm-dd). */
  trackingStart: string;
  /** Daily points, oldest first, last point = today. */
  points: RankingHistoryPoint[];
  /** Net change in score across the tracked window. */
  scoreDelta: number;
  /** Net change in rank across the window (positive = climbed). */
  rankDelta: number;
}

// ─── deterministic PRNG ────────────────────────────────────────────────────

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── single-vendor series ──────────────────────────────────────────────────

interface RawSeries {
  vendorId: string;
  trackingStart: string;
  dates: string[];
  score: number[];
  momentum: number[];
}

/**
 * Reconstruct one vendor's daily score + momentum series.
 *
 * The series ends exactly at the vendor's current `overallScore` /
 * momentum so the hover graph agrees with the rest of the dashboard.
 * The drift direction is derived from current momentum: a high-momentum
 * vendor is shown having climbed into its current score; a low-momentum
 * vendor is shown having slid into it.
 */
function buildRawSeries(vendor: Vendor, momentumScore: number, today: Date): RawSeries {
  const rng = mulberry32(hashString(vendor.id));

  // Each vendor entered tracking on a slightly different day (70-109 days
  // ago) — matches "from the time we started tracking each vendor".
  const windowDays = 70 + Math.floor(rng() * 40);
  const pointCount = windowDays + 1;

  const endScore = vendor.overallScore;
  // Drift over the whole window, derived from momentum. Momentum 55 is
  // treated as neutral; above that the vendor climbed, below it slid.
  const scoreDrift = clamp((momentumScore - 55) * 0.32, -16, 16);
  const startScore = clamp(endScore - scoreDrift, 18, 96);

  const endMomentum = momentumScore;
  const startMomentum = clamp(endMomentum - clamp((momentumScore - 50) * 0.4, -20, 20), 12, 96);

  // AR(1) bounded wander, tapered to zero at both endpoints via a sine
  // window so the first point is a clean baseline and the last point lands
  // exactly on the current value.
  const score: number[] = [];
  const momentum: number[] = [];
  let scoreWander = 0;
  let momentumWander = 0;

  for (let i = 0; i < pointCount; i += 1) {
    const t = pointCount === 1 ? 1 : i / (pointCount - 1);
    const taper = Math.sin(Math.PI * t);

    scoreWander = scoreWander * 0.72 + (rng() - 0.5) * 3.4;
    momentumWander = momentumWander * 0.7 + (rng() - 0.5) * 4.6;

    const scoreBase = startScore + (endScore - startScore) * t;
    const momentumBase = startMomentum + (endMomentum - startMomentum) * t;

    const scoreVal = i === pointCount - 1
      ? endScore
      : clamp(scoreBase + scoreWander * taper, 0, 100);
    const momentumVal = i === pointCount - 1
      ? endMomentum
      : clamp(momentumBase + momentumWander * taper, 0, 100);

    score.push(Math.round(scoreVal * 10) / 10);
    momentum.push(Math.round(momentumVal * 10) / 10);
  }

  const dates: string[] = [];
  for (let i = 0; i < pointCount; i += 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (pointCount - 1 - i));
    dates.push(isoDate(d));
  }

  return {
    vendorId: vendor.id,
    trackingStart: dates[0],
    dates,
    score,
    momentum,
  };
}

// ─── universe-wide history with daily rank ─────────────────────────────────

/**
 * Build a deterministic day-by-day ranking history for every vendor.
 *
 * Rank is computed per calendar day across all vendors tracked on that
 * day, so a vendor's rank line reflects movement relative to the field —
 * not just its own score drift.
 */
export function buildRankingHistories(
  vendors: Vendor[],
  momentum: VendorMomentum[],
  now: Date = new Date(),
): Map<string, VendorRankingHistory> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const momentumByVendor = new Map(momentum.map((m) => [m.vendorId, m.momentumScore]));

  const raw = vendors.map((vendor) =>
    buildRawSeries(vendor, momentumByVendor.get(vendor.id) ?? 50, today),
  );

  // date -> [{ vendorId, score }] for rank assignment.
  const byDate = new Map<string, { vendorId: string; score: number }[]>();
  for (const series of raw) {
    series.dates.forEach((date, i) => {
      const bucket = byDate.get(date) ?? [];
      bucket.push({ vendorId: series.vendorId, score: series.score[i] });
      byDate.set(date, bucket);
    });
  }

  // date -> Map<vendorId, rank>
  const rankByDate = new Map<string, Map<string, number>>();
  for (const [date, bucket] of byDate) {
    bucket.sort((a, b) => b.score - a.score);
    const ranks = new Map<string, number>();
    bucket.forEach((entry, i) => ranks.set(entry.vendorId, i + 1));
    rankByDate.set(date, ranks);
  }

  const result = new Map<string, VendorRankingHistory>();
  for (const series of raw) {
    const points: RankingHistoryPoint[] = series.dates.map((date, i) => ({
      date,
      score: series.score[i],
      momentum: series.momentum[i],
      rank: rankByDate.get(date)?.get(series.vendorId) ?? 0,
    }));
    result.set(series.vendorId, {
      vendorId: series.vendorId,
      trackingStart: series.trackingStart,
      points,
      scoreDelta: Math.round((points[points.length - 1].score - points[0].score) * 10) / 10,
      // Rank delta: positive means the vendor climbed (rank number fell).
      rankDelta: points[0].rank - points[points.length - 1].rank,
    });
  }

  return result;
}
