// Registry of every function in this app that spends money.
// ─────────────────────────────────────────────────────────────────────────────
// Owner 2026-07-28: "make all these paid functions clearly priced and manually
// actionable in backoffice." This is the priced inventory behind /admin/costs.
//
// WHAT THE NUMBERS ARE, EXACTLY — the distinction matters, because a made-up
// "typical cost" is a fabricated number and this codebase does not ship those:
//
//   • `maxOutputTokens` is REAL — read from the calling module's own constant.
//   • `maxOutputUsd` is REAL ARITHMETIC on that constant × the published output
//     rate. It is a genuine CEILING on the output half of one call.
//   • The INPUT half is NOT modelled. It varies with prompt size, retrieved
//     evidence and conversation length, none of which are known before the call.
//     Showing a guessed input cost would be inventing a measurement, so the UI
//     says "input varies" rather than printing a number nobody can check.
//   • `recordedBasis` quotes the app's OWN existing estimate for pipeline steps
//     (the coefficients in daily-refresh.ts), so the back office and the spend
//     ledger tell the same story rather than two different ones.
//
// Net: these are honest bounds and stated bases, not a bill. The Anthropic
// console remains the authority on what was actually charged.

import { estimateCallUsd, rateFor } from "./llm-pricing";
import {
  TAB_CHAT_ENABLED,
  INTERROGATE_ENABLED,
  PREP_KIT_ENABLED,
  ENCROACHMENT_REVIEW_ENABLED,
} from "../availability";

export type TriggerKind =
  /** Fires on a schedule with no human in the loop. */
  | "scheduled"
  /** Fires when a visitor interacts with a page. */
  | "user-traffic"
  /** Only ever fires when someone presses a button in the back office. */
  | "manual";

export interface PaidFunction {
  id: string;
  label: string;
  /** What it does, in the owner's terms — not the module's. */
  what: string;
  /** Where the call lives. */
  module: string;
  /** Model id as the calling module resolves it. */
  model: string;
  /** From the module's own max-tokens constant. Null when it varies per step. */
  maxOutputTokens: number | null;
  trigger: TriggerKind;
  /** Env var that switches it on, null when always on. */
  gateEnv: string | null;
  /** Live state, read from lib/availability. */
  enabled: boolean;
  /** Admin route that runs it on demand, null when not manually runnable. */
  runPath: string | null;
  /** The app's own recorded cost basis, quoted verbatim where one exists. */
  recordedBasis: string | null;
  /** Anything the reader needs in order not to be misled. */
  caveat: string | null;
}

const OPUS = process.env.ANTHROPIC_COMPOSITE_MODEL ?? "claude-opus-4-8";

export function paidFunctions(): PaidFunction[] {
  return [
    {
      id: "daily-refresh",
      label: "Daily refresh pipeline",
      what: "Sources news, extracts and grades evidence, refreshes rankings. The thing that keeps the app's data current.",
      module: "lib/system/daily-refresh.ts",
      model: "mixed (Haiku extract → Opus synthesis) + web search",
      maxOutputTokens: null,
      trigger: "scheduled",
      gateEnv: "REFRESH_KILL_SWITCH (inverted)",
      enabled: process.env.REFRESH_KILL_SWITCH !== "1",
      runPath: "/api/cron/daily-refresh?full=1",
      recordedBasis:
        "searches × $0.01 + vendors × $0.013; scored items ÷ 10 × $0.0065; articles × $0.014 — daily-refresh.ts, written to refresh_spend_ledger",
      caveat:
        "The only path with real caps ($5/cycle, $25/day) and per-step cost recording. Expensive web-search steps run Mondays UTC only.",
    },
    {
      id: "tab-chat",
      label: "Ask AI (per-tab chat)",
      what: "The grounded chat box on the dependency graph, rankings and other tabs.",
      module: "lib/agents/tab-chat.ts",
      model: OPUS,
      maxOutputTokens: 1024,
      trigger: "user-traffic",
      gateEnv: "BILLED_LLM_ROUTES",
      enabled: TAB_CHAT_ENABLED,
      runPath: null,
      recordedBasis: null,
      caveat:
        "Was anonymous-reachable and wrote nothing to the ledger — invisible spend. Fix auth before re-enabling.",
    },
    {
      id: "interrogate",
      label: "Interrogate (adaptive Q&A)",
      what: "Multi-turn questioning that re-runs an assessment through a buyer's context.",
      module: "lib/interrogation/questioner.ts + synthesis.ts",
      model: OPUS,
      maxOutputTokens: null,
      trigger: "user-traffic",
      gateEnv: "BILLED_LLM_ROUTES",
      enabled: INTERROGATE_ENABLED,
      runPath: null,
      recordedBasis: null,
      caveat:
        "Costs MULTIPLE calls per session — one per question turn, plus a synthesis call. The priciest per-user path here.",
    },
    {
      id: "prep-kit",
      label: "Vendor prep kit",
      what: "Generates the meeting prep pack for a vendor conversation.",
      module: "lib/agents/prep-kit.ts",
      model: OPUS,
      maxOutputTokens: 2048,
      trigger: "user-traffic",
      gateEnv: "BILLED_LLM_ROUTES",
      enabled: PREP_KIT_ENABLED,
      runPath: null,
      recordedBasis: null,
      caveat: "Also covered by REFRESH_KILL_SWITCH.",
    },
    {
      id: "encroachment-review",
      label: "Encroachment analyst review",
      what: "Opus read of one encroachment signal, on hover on the public graph pages.",
      module: "lib/agents/encroachment-review.ts",
      model: process.env.ANTHROPIC_ENCROACHMENT_MODEL ?? "claude-opus-4-8",
      maxOutputTokens: 1400,
      trigger: "user-traffic",
      gateEnv: "ANTHROPIC_ENCROACHMENT_REVIEW",
      enabled: ENCROACHMENT_REVIEW_ENABLED,
      runPath: null,
      recordedBasis: null,
      caveat:
        "Public page, no rate limit. 6h cache bounds repeat hits only — 7 pairs × first hits is unbounded. Falls back to a deterministic read when off.",
    },
  ];
}

/** Ceiling on the OUTPUT half of one call. Null when the module has no fixed
 *  max-tokens, or the model has no published rate. Never a guess. */
export function maxOutputUsd(fn: PaidFunction): number | null {
  if (fn.maxOutputTokens === null) return null;
  return estimateCallUsd(fn.model, 0, fn.maxOutputTokens);
}

/** Display rate for one function's model, or null when unpriced. */
export function rateLabel(fn: PaidFunction): string | null {
  const r = rateFor(fn.model);
  return r ? `${r.label} — $${r.inputPerMTok}/$${r.outputPerMTok} per Mtok in/out` : null;
}
