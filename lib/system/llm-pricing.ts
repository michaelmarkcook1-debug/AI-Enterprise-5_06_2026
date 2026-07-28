// LLM price list — the single source of truth for what a paid action costs.
// ─────────────────────────────────────────────────────────────────────────────
// Before this module, per-run costs were magic numbers scattered through
// daily-refresh.ts (`totalSearches * 0.01`, `itemsScored / 10 * 0.0065`) with no
// stated basis and no way to check them against a bill. This centralises the
// rates, states where they came from, and makes every figure in the back office
// traceable to a rate × a token count.
//
// HONESTY RULES (this is a product whose promise is that every number traces to
// a real source — a fabricated price would breach it as surely as a fabricated
// score):
//   • RATES here are Anthropic's PUBLISHED LIST PRICES, stamped with the date
//     they were entered and the page they came from. They are facts about a
//     price list, not measurements of your bill.
//   • Every rate is env-overridable. Prices change and this file will go stale;
//     when it does, the override is the fix, not a silent edit to a constant.
//   • A cost computed here is an ESTIMATE — list rate × token count. It excludes
//     prompt caching discounts (cache reads bill at 0.1×, which this does not
//     model), batch discounts, and negotiated pricing. It will therefore tend to
//     OVER-state. That direction is deliberate: for a spend guard, over-stating
//     is safe and under-stating is not.
//   • The authority on what you actually paid is the Anthropic console. Nothing
//     computed here should ever be presented as your real bill.

/** Published rate for one model, in USD per MILLION tokens. */
export interface ModelRate {
  /** Model id prefix this rate applies to (longest match wins). */
  prefix: string;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

/** Anthropic list prices, entered 2026-07-28 from anthropic.com/pricing.
 *  Matched by PREFIX so a dated model id (claude-opus-4-8-20260115) resolves to
 *  its family without needing a new entry every release. */
export const MODEL_RATES: ModelRate[] = [
  { prefix: "claude-opus-4", label: "Opus 4.x", inputPerMTok: 15, outputPerMTok: 75 },
  { prefix: "claude-opus", label: "Opus", inputPerMTok: 15, outputPerMTok: 75 },
  { prefix: "claude-sonnet", label: "Sonnet", inputPerMTok: 3, outputPerMTok: 15 },
  { prefix: "claude-haiku", label: "Haiku", inputPerMTok: 1, outputPerMTok: 5 },
];

/** Server-side web search, billed per 1,000 searches (list, 2026-07-28). */
export const WEB_SEARCH_PER_1K_USD = 10;

export const PRICES_AS_OF = "2026-07-28";
export const PRICES_SOURCE = "https://www.anthropic.com/pricing";

/** Env override: ANTHROPIC_RATE_<FAMILY>=<input>/<output> per Mtok.
 *  e.g. ANTHROPIC_RATE_OPUS="12/60" for negotiated pricing. */
function overrideFor(label: string): { inputPerMTok: number; outputPerMTok: number } | null {
  const key = `ANTHROPIC_RATE_${label.split(" ")[0].toUpperCase()}`;
  const raw = process.env[key];
  if (!raw) return null;
  const [i, o] = raw.split("/").map(Number);
  if (!Number.isFinite(i) || !Number.isFinite(o) || i < 0 || o < 0) return null;
  return { inputPerMTok: i, outputPerMTok: o };
}

export function rateFor(model: string): ModelRate | null {
  // Longest prefix wins, so "claude-opus-4" beats "claude-opus".
  const hit = [...MODEL_RATES]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((r) => model.startsWith(r.prefix));
  if (!hit) return null;
  const ov = overrideFor(hit.label);
  return ov ? { ...hit, ...ov } : hit;
}

/**
 * Estimated USD for one call. Returns null for an unknown model rather than
 * guessing — an unpriced model must show as "unpriced" in the UI, never as $0,
 * which would read as free.
 */
export function estimateCallUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const rate = rateFor(model);
  if (!rate) return null;
  return (inputTokens / 1_000_000) * rate.inputPerMTok
    + (outputTokens / 1_000_000) * rate.outputPerMTok;
}

/** Estimated USD for N server-side web searches. */
export function estimateSearchUsd(searches: number): number {
  return (searches / 1000) * WEB_SEARCH_PER_1K_USD;
}

/** Format for display. Sub-cent costs are the norm here, so a plain 2dp
 *  currency format would render most real figures as "$0.00" — which reads as
 *  free and is the opposite of the point. */
export function formatUsd(usd: number | null): string {
  if (usd === null) return "unpriced";
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `<$0.01`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
