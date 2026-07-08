// AIE-01 — Frontier model face-off (the daily-hook anchor).
// ─────────────────────────────────────────────────────────────────────────────
// A side-by-side comparison of the four tracked frontier vendors' flagship
// models, built ENTIRELY from the live, cited Artificial Analysis benchmark
// evidence (lib/model-inventory/live.ts → model_quality_benchmarks). Nothing
// is invented:
//   • the four vendors are an owner-set constant (FRONTIER_VENDOR_IDS);
//   • each vendor's column is its single highest-Intelligence-Index model — a
//     deterministic pick, not analyst choice — and every category rating shown
//     is THAT model's own cited rating (categories are never mixed across a
//     vendor's models, which would misattribute a score);
//   • a vendor with no benchmark row renders an honest "not on the tracked
//     leaderboard yet" column — never a fabricated or defaulted number;
//   • every number traces to the same Artificial Analysis source_url + real
//     per-model release date the /models page already cites (the
//     AnalystGenius traceability rule).
// Read-time, deterministic, no writes, no LLM call → "pre-computed platform
// data" per the ticket.

import { getLiveModelInventory, type LiveModel, type LiveModelInventory } from "./live";
import { TRACKED_VENDOR_NAMES } from "../sourcing/ai-news-manifest";

/** The tracked frontier four (owner decision, 2026-07-06). Bare vendor ids. */
export const FRONTIER_VENDOR_IDS = ["openai", "anthropic", "google", "xai"] as const;

// Fail loud, not silent, if this list is ever edited without updating the
// display-name manifest — a missing entry would otherwise render a raw bare
// id (e.g. "meta") as the vendor's honest-absence column label.
for (const id of FRONTIER_VENDOR_IDS) {
  if (!(id in TRACKED_VENDOR_NAMES)) {
    throw new Error(`frontier.ts: FRONTIER_VENDOR_IDS has "${id}" with no TRACKED_VENDOR_NAMES entry`);
  }
}

/** Canonical comparison categories + display labels + display order. Keys match
 *  the Artificial Analysis category strings stored in model_quality_benchmarks
 *  (intelligence/coding/agentic — see lib/system/model-quality-blend.ts). */
export const COMPARE_CATEGORIES: { key: string; label: string }[] = [
  { key: "intelligence", label: "Intelligence" },
  { key: "coding", label: "Coding" },
  { key: "agentic", label: "Agentic" },
];

export interface FrontierColumn {
  vendorId: string;
  vendorName: string;
  /** false → no cited benchmark row for this vendor; render honest absence. */
  present: boolean;
  modelName?: string;
  /** category key → this model's cited index value (undefined = that category absent). */
  ratings: Record<string, number | undefined>;
  /** Category keys the flagship model itself has no rating for, but where a
   *  DIFFERENT model from the same vendor does. We never blend that other
   *  model's number into this column — that would misattribute a score to a
   *  model that didn't earn it — but we also must not let a real, cited
   *  rating read as if the vendor has none at all. UI should render these
   *  cells distinctly from a genuine absence. */
  uncoveredWithOtherModel?: string[];
  /** The flagship's Intelligence Index (ratings.intelligence) — kept as a
   *  distinctly-named field since it drives ranking/sort throughout. */
  overall?: number;
  /** 1-based rank on the Intelligence Index leaderboard among the PRESENT columns. */
  overallRank?: number;
  /** The category (key) where this model leads all present columns, if any —
   *  the honest "where it's strongest" claim (a #1 among the four, not a
   *  self-referential best). null when it tops nothing. */
  leadsCategory?: string;
  publishDate?: string | null;
  sourceUrl?: string;
}

export interface FrontierComparison {
  columns: FrontierColumn[]; // in FRONTIER_VENDOR_IDS order
  /** category key → vendorId that leads it (max cited index among present cols). */
  categoryLeaders: Record<string, string | undefined>;
  /** Freshest real per-model release date across the shown models. */
  asOf: string | null;
  /** The cited Artificial Analysis source URL (from the shown rows). */
  sourceUrl: string | null;
  source: string; // "artificial_analysis"
  /** How many of the four have live cited data (honest coverage headline). */
  presentCount: number;
}

/** Pick a vendor's flagship model: the one with the highest Intelligence Index.
 *  Falls back to the highest-headline model only if none of the vendor's
 *  models carry an intelligence rating (still that model's own ratings —
 *  never a blend). */
function flagshipFor(models: LiveModel[]): LiveModel | null {
  if (models.length === 0) return null;
  const withIntelligence = models
    .map((m) => ({ m, intelligence: m.categories.find((c) => c.category === "intelligence")?.rating }))
    .filter((x): x is { m: LiveModel; intelligence: number } => typeof x.intelligence === "number");
  if (withIntelligence.length > 0) {
    return withIntelligence.sort((a, b) => b.intelligence - a.intelligence)[0].m;
  }
  return [...models].sort((a, b) => b.headlineRating - a.headlineRating)[0];
}

export async function getFrontierComparison(now: Date = new Date()): Promise<FrontierComparison> {
  return buildFrontierComparison(await getLiveModelInventory(now));
}

/** Pure builder — the testable core, no DB. Given a live inventory, assemble the
 *  four-column comparison. Kept separate so the ranking/leader/absence logic is
 *  unit-tested against synthetic inventories (incl. a missing vendor + ties). */
export function buildFrontierComparison(inv: LiveModelInventory): FrontierComparison {
  const columns: FrontierColumn[] = FRONTIER_VENDOR_IDS.map((vendorId) => {
    const models = inv.models.filter((m) => m.vendorId === vendorId);
    const flagship = flagshipFor(models);
    const vendorName = flagship?.vendorName ?? TRACKED_VENDOR_NAMES[vendorId] ?? vendorId;
    if (!flagship) {
      return { vendorId, vendorName, present: false, ratings: {} };
    }
    const ratings: Record<string, number | undefined> = {};
    const uncoveredWithOtherModel: string[] = [];
    for (const c of COMPARE_CATEGORIES) {
      const own = flagship.categories.find((x) => x.category === c.key)?.rating;
      ratings[c.key] = own;
      if (own === undefined) {
        // A DIFFERENT model of this vendor may still carry a real, cited
        // rating for this category. Never shown as this column's number —
        // only flagged, so absence is never ambiguous between "no data
        // anywhere" and "not this model's data."
        const elsewhere = models.some(
          (m) => m.modelName !== flagship.modelName && m.categories.some((x) => x.category === c.key),
        );
        if (elsewhere) uncoveredWithOtherModel.push(c.key);
      }
    }
    return {
      vendorId,
      vendorName,
      present: true,
      modelName: flagship.modelName,
      ratings,
      uncoveredWithOtherModel: uncoveredWithOtherModel.length ? uncoveredWithOtherModel : undefined,
      overall: ratings.intelligence,
      publishDate: flagship.publishDate,
      sourceUrl: flagship.sourceUrl,
    };
  });

  const present = columns.filter((c) => c.present);

  // Overall rank among present columns (1 = highest overall Elo).
  const overallOrdered = present
    .filter((c) => typeof c.overall === "number")
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  overallOrdered.forEach((c, i) => {
    c.overallRank = i + 1;
  });

  // Per-category leader (the present column with the max cited Elo).
  const categoryLeaders: Record<string, string | undefined> = {};
  for (const c of COMPARE_CATEGORIES) {
    let best: FrontierColumn | undefined;
    for (const col of present) {
      const r = col.ratings[c.key];
      if (typeof r === "number" && (!best || r > (best.ratings[c.key] as number))) best = col;
    }
    categoryLeaders[c.key] = best?.vendorId;
  }
  // "Where it's strongest" = the category this column leads (a true #1 of four).
  for (const col of present) {
    const led = COMPARE_CATEGORIES.find((c) => categoryLeaders[c.key] === col.vendorId);
    col.leadsCategory = led?.key;
  }

  const dates = present.map((c) => c.publishDate).filter((d): d is string => !!d);
  const asOf = dates.length ? dates.sort().at(-1)! : null;
  const sourceUrl = present.find((c) => c.sourceUrl)?.sourceUrl ?? null;

  return {
    columns,
    categoryLeaders,
    asOf,
    sourceUrl,
    source: inv.sources[0] ?? "artificial_analysis",
    presentCount: present.length,
  };
}

/** A short, fully-derived comparative sentence — every number and name in it
 *  already lives on `c` (real cited index figures), so this restates the data
 *  rather than synthesising anything new. No LLM call: this is "platform
 *  work" computed the same way for every viewer, so it can be produced at
 *  read-time for free. (A future mid-tier LLM rewrite for tone would need its
 *  own cache keyed off the data's freshness — not built here.) Returns null
 *  when fewer than two vendors have cited data (nothing to compare). */
export function summarizeFrontierComparison(c: FrontierComparison): string | null {
  const ranked = c.columns
    .filter((col) => typeof col.overallRank === "number")
    .sort((a, b) => (a.overallRank ?? 0) - (b.overallRank ?? 0));
  if (ranked.length < 2) return null;

  const leader = ranked[0];
  const runnerUp = ranked[1];
  const margin =
    typeof leader.overall === "number" && typeof runnerUp.overall === "number"
      ? Math.round((leader.overall - runnerUp.overall) * 10) / 10
      : null;
  const leaderCategories = COMPARE_CATEGORIES.filter(
    (cat) => cat.key !== "intelligence" && c.categoryLeaders[cat.key] === leader.vendorId,
  ).map((cat) => cat.label);

  let sentence = `${leader.vendorName}'s ${leader.modelName} leads on Intelligence Index (${leader.overall?.toFixed(1) ?? 0})`;
  if (margin !== null) sentence += `, ${margin} point${margin === 1 ? "" : "s"} ahead of ${runnerUp.vendorName}'s ${runnerUp.modelName} (${runnerUp.overall?.toFixed(1) ?? 0})`;
  if (leaderCategories.length > 0) sentence += ` and also leads in ${leaderCategories.join(", ")}`;
  sentence += ".";

  const missing = c.columns.filter((col) => !col.present).map((col) => col.vendorName);
  if (missing.length > 0) {
    sentence += ` ${missing.join(" and ")} ${missing.length === 1 ? "has" : "have"} no cited benchmark on the tracked leaderboard yet.`;
  }

  return sentence;
}
