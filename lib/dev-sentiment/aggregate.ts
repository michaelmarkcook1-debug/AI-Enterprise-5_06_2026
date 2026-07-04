// Developer-sentiment aggregation — pure, deterministic, coverage-gated.
// ─────────────────────────────────────────────────────────────────────────
// Turns the cited per-source signals into ONE labelled reading per vendor,
// with the anti-gaming gates the spec demands (proportional to how heavily
// this may later be weighted in rankings):
//   • VOLUME FLOOR — a source only counts toward diversity if its real volume
//     clears a per-source floor (a thin or brigaded single spike can't pass).
//   • SOURCE DIVERSITY — a confident reading needs ≥2 independent counting
//     sources; one source (even a large one) is "thin", never authoritative.
//   • COVERAGE GATE — below the floor, or with no curated reading, the vendor
//     reads "insufficient developer-sentiment data" — never scored on noise.
// Reads the curated cited dataset only; writes nothing; no score path.

import type { DevSentimentRecord, DevSignalTier, DevSource } from "./types";
import { DEV_SENTIMENT_DATA } from "./data";
import { isDevSentimentVendor } from "./scope";

/** Per-source volume floors. A source below its floor does not count toward
 *  diversity. SO-survey lines are curated presence (nominal weight 100) and
 *  count when present. Tuned conservatively — raise as the weight this signal
 *  carries in rankings grows. */
const SOURCE_FLOOR: Record<DevSource, number> = {
  hackernews: 1500, // total HN points across coding threads
  github: 10000, // stars on the flagship coding repo
  stackoverflow_survey: 50, // present = counts
  // Reddit is the most brigadeable source → a deliberately HIGH floor (net
  // upvotes across dedup'd threads) so an astroturf spike can't clear it.
  reddit: 3000,
};

export type DevSentimentState = "rated" | "insufficient_evidence";

export interface DevSentimentAggregate {
  vendorId: string;
  subject: string;
  state: DevSentimentState;
  /** Sources that CLEARED their floor (count toward diversity). */
  countingSources: DevSource[];
  /** All cited sources shown in the drill-down, floor-clearing or not. */
  record: DevSentimentRecord;
  tier?: DevSignalTier; // present when rated
  /** The analyst-curated reading — present ONLY when rated (gate cleared). */
  reading?: DevSentimentRecord["reading"];
  /** Human note explaining the gate outcome (shown in the UI). */
  coverageNote: string;
}

export function getDevSentimentRecord(vendorId: string): DevSentimentRecord | undefined {
  const bare = vendorId.replace(/^vendor_/, "");
  return DEV_SENTIMENT_DATA.find((r) => r.vendorId === bare);
}

/**
 * Aggregate one vendor's dev-sentiment. Returns null when the vendor is OUT OF
 * SCOPE (not a coding/dev vendor) — callers must not render the signal there.
 * In-scope vendors always return an aggregate; a thin one is honestly
 * "insufficient_evidence", never a fabricated rating.
 */
export function aggregateDevSentiment(vendorId: string): DevSentimentAggregate | null {
  if (!isDevSentimentVendor(vendorId)) return null; // scope is a hard rule
  const record = getDevSentimentRecord(vendorId);
  if (!record) {
    return {
      vendorId: vendorId.replace(/^vendor_/, ""),
      subject: vendorId,
      state: "insufficient_evidence",
      countingSources: [],
      record: { vendorId, subject: vendorId, sources: [] },
      coverageNote: "No developer-community signal compiled yet — insufficient developer-sentiment data.",
    };
  }

  const countingSources = record.sources
    .filter((s) => s.signalWeight >= SOURCE_FLOOR[s.source])
    .map((s) => s.source);
  const diverse = countingSources.length >= 2;
  const hasReading = !!record.reading;

  if (!diverse || !hasReading) {
    const why = !hasReading
      ? "no analyst reading — signal too thin to characterise"
      : `only ${countingSources.length} source cleared the volume floor (need ≥2 independent sources)`;
    return {
      vendorId: record.vendorId,
      subject: record.subject,
      state: "insufficient_evidence",
      countingSources,
      record,
      coverageNote: `Insufficient developer-sentiment data — ${why}. Shown honestly rather than scored on noise.`,
    };
  }

  // Tier by source diversity (3 independent sources = strong, 2 = moderate).
  const tier: DevSignalTier = countingSources.length >= 3 ? "strong" : "moderate";
  return {
    vendorId: record.vendorId,
    subject: record.subject,
    state: "rated",
    countingSources,
    record,
    tier,
    reading: record.reading,
    coverageNote:
      tier === "strong"
        ? "Strong, source-diverse signal — all three independent sources clear the volume floor."
        : "Moderate signal — two independent sources clear the floor; directional, not authoritative.",
  };
}

/** Aggregate for every in-scope coding vendor (dataset order). */
export function aggregateAllDevSentiment(): DevSentimentAggregate[] {
  return DEV_SENTIMENT_DATA.map((r) => aggregateDevSentiment(r.vendorId)).filter(
    (a): a is DevSentimentAggregate => a !== null,
  );
}
