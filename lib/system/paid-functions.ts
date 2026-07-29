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
  /** What one manual run is expected to cost, in USD — shown ON the button so
   *  the price is known BEFORE the spend, not after. Null when never measured;
   *  the UI then says so rather than printing a guess. */
  estimatedRunUsd: number | null;
  /** Where estimatedRunUsd came from. Required whenever it is non-null — a
   *  price with no stated provenance is exactly the kind of number this
   *  codebase refuses to ship. */
  estimateBasis: string | null;
}

/**
 * MEASURED, not modelled — the owner's own Anthropic console, 27/07/2026,
 * API key "AI Enterpise Vercel", one scheduled (non-full) pipeline run:
 *
 *   1,387,341 input tok  × $1/M   = $1.387   (claude-haiku-4-5)
 *     201,954 output tok × $5/M   = $1.010
 *         145 web searches × $10/1k = $1.450
 *                                   ─────────
 *                                     $3.847
 *
 * This supersedes the coefficients inside daily-refresh.ts, which recorded
 * $1.88 for a comparable day — they UNDER-report by roughly half. The caps are
 * measured against those coefficients, so they are looser in practice than they
 * look; that is tracked separately and not corrected here.
 *
 * Caveat kept with the number: list-price arithmetic, so prompt-cache discounts
 * (cached reads bill at 0.1×) are not modelled and the true figure may be lower.
 * One observation, not an average.
 */
const MEASURED_STANDARD_RUN_USD = 3.85;
const MEASURED_BASIS =
  "measured from the Anthropic console, 27/07/2026: 1.39M in + 202k out (Haiku 4.5) + 145 web searches = $3.85. One observation, list prices, cache discounts not modelled.";

const OPUS = process.env.ANTHROPIC_COMPOSITE_MODEL ?? "claude-opus-4-8";

export function paidFunctions(): PaidFunction[] {
  return [
    {
      id: "daily-refresh",
      label: "Refresh pipeline — standard run",
      what: "Sources news, extracts and grades evidence, refreshes rankings. The thing that keeps the app's data current.",
      module: "lib/system/daily-refresh.ts",
      // Haiku 4.5 is what the console actually showed for a standard run on
      // 27/07/2026 — no Opus at all. The heavier synthesis steps are weekly or
      // full-run only, so don't describe this as routinely mixed-model.
      model: "claude-haiku-4-5 + web search",
      maxOutputTokens: null,
      trigger: "manual",
      gateEnv: "REFRESH_KILL_SWITCH (inverted)",
      enabled: process.env.REFRESH_KILL_SWITCH !== "1",
      runPath: "/api/cron/daily-refresh",
      recordedBasis:
        "app's own coefficients (searches × $0.01 + vendors × $0.013, etc.) recorded $1.88 for a comparable day — roughly HALF the measured figure. Treat the ledger as a floor.",
      caveat:
        "No longer scheduled. Data is only as fresh as your last run here. Web search is the biggest single line ($1.45 of $3.85) — the lever if you want it cheaper.",
      estimatedRunUsd: MEASURED_STANDARD_RUN_USD,
      estimateBasis: MEASURED_BASIS,
    },
    {
      id: "daily-refresh-full",
      label: "Refresh pipeline — FULL run",
      what: "Forces every step regardless of the weekly cadence: full 43-vendor competitive set, analyst coverage, IPO estimation.",
      module: "lib/system/daily-refresh.ts (force: true)",
      model: "claude-haiku-4-5 + Opus synthesis + web search",
      maxOutputTokens: null,
      trigger: "manual",
      gateEnv: "REFRESH_KILL_SWITCH (inverted)",
      enabled: process.env.REFRESH_KILL_SWITCH !== "1",
      runPath: "/api/cron/daily-refresh?full=1",
      recordedBasis: null,
      caveat:
        "Runs in the background and returns immediately; watch the ledger for the real figure. Costs MORE than a standard run — it forces the web-search-heavy steps that normally wait for Monday.",
      // Deliberately null: no full run has been measured against the console, and
      // scaling the standard run by a guessed multiplier would be inventing a
      // price. Better to say "not measured" on the button than print a fiction.
      estimatedRunUsd: null,
      estimateBasis: null,
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
      // Per-visitor path, not a back-office action — nothing to price a
      // "run" of, because a run is one visitor interaction. The per-call
      // ceiling above is the meaningful figure for these.
      estimatedRunUsd: null,
      estimateBasis: null,
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
      // Per-visitor path, not a back-office action — nothing to price a
      // "run" of, because a run is one visitor interaction. The per-call
      // ceiling above is the meaningful figure for these.
      estimatedRunUsd: null,
      estimateBasis: null,
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
      // Per-visitor path, not a back-office action — nothing to price a
      // "run" of, because a run is one visitor interaction. The per-call
      // ceiling above is the meaningful figure for these.
      estimatedRunUsd: null,
      estimateBasis: null,
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
      // Per-visitor path, not a back-office action — nothing to price a
      // "run" of, because a run is one visitor interaction. The per-call
      // ceiling above is the meaningful figure for these.
      estimatedRunUsd: null,
      estimateBasis: null,
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
