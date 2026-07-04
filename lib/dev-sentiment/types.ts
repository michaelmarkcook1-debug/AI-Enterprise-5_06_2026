// Developer-sentiment signal — type spine.
// ─────────────────────────────────────────
// A "what developers actually say" signal for CODING / developer models only,
// from ToS-compliant official sources (Hacker News Algolia API, GitHub REST
// API, the Stack Overflow Developer Survey). Same honesty contract as the rest
// of the platform:
//   • every rated signal traces to a real, cited, dated source;
//   • sentiment is an analyst-curated qualitative reading OF those cited signals
//     — labelled as such, NEVER a measured score;
//   • coverage/confidence-gated: a model with thin signal reads
//     "insufficient developer-sentiment data", never scored on noise;
//   • aggregate, never cherry-picked; volume-floored + source-diversity checked
//     (anti-gaming — the heavier this is weighted the bigger the astroturf
//     target, so the gates are deliberately conservative);
//   • SCOPE: valid ONLY for coding / developer-agent models + categories.
//     Applying it to enterprise / RAG / infra vendors is a category error.
// Reads nothing canonical, writes nothing (firewall).

/** ToS-compliant official sources only. `reddit` is wired (lib/connectors/
 *  reddit.ts, official OAuth API) but only populates once REDDIT_CLIENT_ID/
 *  SECRET are set — until then no reddit rows exist (never fabricated). Reddit
 *  is the most gameable source, so it carries the highest volume floor +
 *  brigading dedup (see aggregate.ts). */
export type DevSource = "hackernews" | "github" | "stackoverflow_survey" | "reddit";

/** Qualitative sentiment reading (analyst-curated from the cited signals). */
export type DevSentimentTag = "positive" | "leaning_positive" | "mixed" | "leaning_negative" | "negative";

/** Signal strength tier, driven by real volume + source diversity. */
export type DevSignalTier = "strong" | "moderate" | "thin";

export interface DevCitation {
  title: string;
  url: string; // real https URL — enforced by tests
  publisher: string;
  /** ISO date when stated by the source. */
  date?: string;
}

/** One source's contribution for one vendor — objective metrics + citations. */
export interface DevSourceSignal {
  source: DevSource;
  /** Human metric line, e.g. "44 HN threads ≥50 pts, ~36,075 total points". */
  metric: string;
  /** What this source measures (engagement / adoption / admiration) — so we
   *  never pass off engagement volume as sentiment. */
  measures: "engagement" | "adoption" | "admiration";
  /** Numeric volume for the anti-gaming floor: HN total points, GitHub stars,
   *  or a nominal weight for a present SO-survey line. A source below its floor
   *  (see aggregate.ts) does NOT count toward source-diversity — so a thin or
   *  brigaded single spike can't clear the gate. */
  signalWeight: number;
  /** ≥1 real citation. Absent source = omit the whole DevSourceSignal. */
  citations: DevCitation[];
  /** Top cited items (HN threads) for the drill-down. Optional. */
  topThreads?: { title: string; points: number; comments: number; date: string; url: string }[];
}

export interface DevSentimentRecord {
  vendorId: string; // bare tracked id (openai / anthropic / …)
  /** The coding model/tool this signal is about (e.g. "Claude Code"). */
  subject: string;
  sources: DevSourceSignal[];
  /** Analyst-curated qualitative reading of the sources above. Present only
   *  when coverage clears the floor; otherwise the aggregate reads insufficient. */
  reading?: {
    tag: DevSentimentTag;
    rationale: string;
  };
}
