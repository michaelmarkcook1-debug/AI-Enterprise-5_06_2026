// Freshness legibility for cited dates on /models.
// ─────────────────────────────────────────────────────────────────────────────
// The page already cites a real publish date for every rating (never
// invented), but a raw "2026-07-02" string makes the reader do their own date
// math against today to notice it's aging. This makes that math visible.
//
// Thresholds are tuned to LMArena's OWN observed cadence: the text/vision
// arena leaderboard snapshot our benchmarks read republishes roughly weekly,
// not daily — confirmed by the ingestion pipeline running successfully every
// day while the cited publish date holds steady for several days at a time.
// So a few days old is normal, not a defect; "stale" is set past that normal
// band, where it's worth flagging that no newer snapshot has appeared yet.

const DAY_MS = 24 * 60 * 60 * 1000;

export type FreshnessLevel = "fresh" | "aging" | "stale";

export interface FreshnessBadge {
  daysOld: number;
  label: string; // "today" | "1 day ago" | "6 days ago"
  level: FreshnessLevel;
}

const AGING_AT_DAYS = 2;
const STALE_AT_DAYS = 7;

/** dateStr must be YYYY-MM-DD (the format every publishDate/asOf in this
 *  module already uses). Returns null for missing/unparseable input — never
 *  a guessed freshness for data we can't actually date. */
export function freshnessBadge(dateStr: string | null | undefined, now: Date): FreshnessBadge | null {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysOld = Math.max(0, Math.round((today.getTime() - then.getTime()) / DAY_MS));
  const label = daysOld === 0 ? "today" : daysOld === 1 ? "1 day ago" : `${daysOld} days ago`;
  const level: FreshnessLevel = daysOld >= STALE_AT_DAYS ? "stale" : daysOld >= AGING_AT_DAYS ? "aging" : "fresh";
  return { daysOld, label, level };
}
