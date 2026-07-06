// AIE-05 — Per-call inference cost mapping.
// ─────────────────────────────────────────────────────────────────────────────
// Turns an LLMUsage (input/output tokens + model id) into a real USD cost using
// the SAME published per-MTok price table the ingestion estimator uses
// (lib/ingestion/cost-model.ts PRICES) — no second rate table to drift. This is
// the piece that stops the currently-discarded token data from being thrown
// away: every interrogation LLM call's cost is computed here and persisted on
// the turn/finding it belongs to, so cost rolls up per seat → per org.
//
// Fail-loud rule (the no-fabrication guardrail applied to cost): an unrecognised
// model id must NOT silently cost $0 — that would under-report real spend. It
// throws, so a mis-wired model surfaces immediately instead of quietly hiding
// cost of goods sold.

import { PRICES, type ModelPrice } from "../ingestion/cost-model";
import type { LLMUsage } from "../agents/llm-client";

/** Resolve a concrete model id (e.g. "claude-opus-4-8", "claude-sonnet-4-6",
 *  "claude-haiku-4-5") to its published price. Matches by exact id first, then
 *  by tier keyword so minor version bumps still resolve to the right tier. */
export function priceForModel(model: string): ModelPrice {
  const byId = Object.values(PRICES).find((p) => p.id === model);
  if (byId) return byId;
  const m = model.toLowerCase();
  if (m.includes("opus")) return PRICES.opus;
  if (m.includes("sonnet")) return PRICES.sonnet;
  if (m.includes("haiku")) return PRICES.haiku;
  throw new Error(`interrogation/cost: no price for model "${model}" — refusing to record $0 (would under-report spend)`);
}

/** USD cost of one call. A stub result (model "stub", no real API call) is a
 *  true $0 — nothing was spent — and is the ONE model id allowed to cost zero. */
export function costOfUsage(usage: LLMUsage): number {
  if (usage.model === "stub") return 0;
  const p = priceForModel(usage.model);
  const usd = (usage.inputTokens / 1e6) * p.inputPerMTok + (usage.outputTokens / 1e6) * p.outputPerMTok;
  // Round to 6 dp — sub-cent calls must not round to $0 and vanish from rollups.
  return Math.round(usd * 1e6) / 1e6;
}

/** The cost columns persisted on an InterrogationTurn / Finding row. */
export interface CostColumns {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function costColumns(usage: LLMUsage): CostColumns {
  return {
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: costOfUsage(usage),
  };
}
