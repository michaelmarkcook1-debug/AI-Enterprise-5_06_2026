// Back office — what costs money, what it costs, and how to run it by hand.
// ─────────────────────────────────────────────────────────────────────────────
// Owner 2026-07-28: "make all these paid functions clearly priced and manually
// actionable in backoffice."
//
// Everything billable in the app is listed here with its rate, an honest bound
// on what one call can cost, whether it is currently switched on, and — for the
// pipeline — a button to run it deliberately.
//
// PROVENANCE, because this page is about money and a wrong number here is worse
// than no number: rates are Anthropic's published list prices (dated, sourced,
// env-overridable). "Max out" is real arithmetic on the calling module's own
// max-tokens constant. The input half of a call is NOT modelled and the page
// says so rather than printing a guess. Recorded spend comes from the app's own
// ledger. The Anthropic console remains the authority on the actual bill.

import type { Metadata } from "next";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import { paidFunctions, maxOutputUsd, rateLabel } from "@/lib/system/paid-functions";
import { formatUsd, PRICES_AS_OF, PRICES_SOURCE, WEB_SEARCH_PER_1K_USD } from "@/lib/system/llm-pricing";
import { getSpendCaps, getDaySpendUsd } from "@/lib/system/spend-ledger";
import RunPaidAction from "@/components/admin/RunPaidAction";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Costs & paid actions", robots: { index: false } };

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

const TRIGGER_LABEL: Record<string, string> = {
  scheduled: "Runs on a schedule",
  "user-traffic": "Runs when visitors use the page",
  manual: "Runs only when you press the button",
};

export default async function CostsPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;

  const fns = paidFunctions();
  // Real recorded spend + caps. A failed ledger read must not blank the page —
  // the inventory stands on its own — but it must not silently render $0.00
  // either, which would read as "nothing was spent". Null renders as "—".
  const caps = getSpendCaps();
  const today = await getDaySpendUsd().catch(() => null);

  const on = fns.filter((f) => f.enabled);
  const off = fns.filter((f) => !f.enabled);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-[var(--font-display)] text-2xl font-extrabold tracking-tight">
        Costs &amp; paid actions
      </h1>
      <p className={`mt-2 max-w-3xl text-sm leading-6 ${MUTED}`}>
        Every function in this app that spends money, what it costs, and whether it is
        currently live. Anything not listed here is free to run — page rendering, rankings,
        the dependency graph, database reads.
      </p>

      {/* Answer first: what is on, and what has today cost. */}
      <section className={`${CARD} mt-5`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide">Recorded today</div>
            <div className="mt-1 font-mono text-2xl tabular-nums">
              {today === null ? "—" : formatUsd(today)}
            </div>
            <p className={`mt-1 text-[11px] leading-4 ${MUTED}`}>
              {today === null
                ? "Ledger unavailable."
                : "Pipeline steps only — the per-visitor routes never wrote to the ledger."}
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide">Caps</div>
            <div className="mt-1 font-mono text-2xl tabular-nums">
              {caps ? `$${caps.dayUsd}` : "—"}
              <span className={`ml-1 text-xs ${MUTED}`}>/day</span>
            </div>
            <p className={`mt-1 text-[11px] leading-4 ${MUTED}`}>
              {caps ? `$${caps.cycleUsd} per cycle. Enforced on the pipeline only.` : ""}
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide">Paid functions live</div>
            <div className="mt-1 font-mono text-2xl tabular-nums">
              {on.length}<span className={`text-xs ${MUTED}`}> / {fns.length}</span>
            </div>
            <p className={`mt-1 text-[11px] leading-4 ${MUTED}`}>{off.length} switched off.</p>
          </div>
        </div>
      </section>

      {/* The inventory. */}
      <div className="mt-5 space-y-3">
        {fns.map((fn) => {
          const ceiling = maxOutputUsd(fn);
          const rate = rateLabel(fn);
          return (
            <section key={fn.id} className={CARD}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold">{fn.label}</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    fn.enabled
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "border-black/15 text-[#15263c]/60 dark:border-white/20 dark:text-[#eef3f8]/60"
                  }`}
                >
                  {fn.enabled ? "LIVE — billing" : "OFF — not billing"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6">{fn.what}</p>

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className={`text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>Trigger</dt>
                  <dd>{TRIGGER_LABEL[fn.trigger]}</dd>
                </div>
                <div>
                  <dt className={`text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>Rate</dt>
                  <dd className="font-mono text-[12px]">{rate ?? `${fn.model} — unpriced`}</dd>
                </div>
                <div>
                  <dt className={`text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>
                    Most one call can cost
                  </dt>
                  <dd>
                    {ceiling === null ? (
                      <span className={MUTED}>varies — no fixed output limit</span>
                    ) : (
                      <>
                        <span className="font-mono">{formatUsd(ceiling)}</span>{" "}
                        <span className={MUTED}>
                          output ({fn.maxOutputTokens} tok max) + input, which varies
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className={`text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>Switch</dt>
                  <dd className="font-mono text-[12px]">{fn.gateEnv ?? "always on"}</dd>
                </div>
              </dl>

              {fn.recordedBasis && (
                <p className={`mt-2 text-[11px] leading-5 ${MUTED}`}>
                  <span className="font-semibold">Recorded as:</span> {fn.recordedBasis}
                </p>
              )}
              {fn.caveat && (
                <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[12px] leading-5">
                  {fn.caveat}
                </p>
              )}

              {fn.runPath && (
                <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
                  <RunPaidAction
                    label={fn.label}
                    path={fn.runPath}
                    costHint={fn.recordedBasis ?? "cost varies with how much new data is found"}
                    estimatedUsd={fn.estimatedRunUsd}
                    estimateBasis={fn.estimateBasis}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Provenance — what these numbers are and are not. */}
      <section className={`${CARD} mt-6 text-[12px] leading-5`}>
        <h2 className="mb-1 text-sm font-bold">Where these prices come from</h2>
        <p className={MUTED}>
          Rates are Anthropic&apos;s published list prices as of {PRICES_AS_OF} (
          <a href={PRICES_SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            anthropic.com/pricing
          </a>
          ), plus ${WEB_SEARCH_PER_1K_USD} per 1,000 server-side web searches. They are
          env-overridable (<span className="font-mono">ANTHROPIC_RATE_OPUS=&quot;12/60&quot;</span>) for
          negotiated pricing — this file will go stale and the override is the fix.
        </p>
        <p className={`mt-2 ${MUTED}`}>
          &quot;Most one call can cost&quot; is list rate × the calling module&apos;s own max-tokens
          constant. It bounds the OUTPUT half only; input cost varies with prompt size and is
          deliberately not guessed at. Prompt-cache discounts (cache reads bill at 0.1×) are not
          modelled, so these figures tend to <strong>over</strong>-state — the safe direction for a
          spend guard. <strong>None of this is your bill.</strong> The Anthropic console is the
          authority on what was actually charged; this page tells you what is switched on and what
          it can cost.
        </p>
      </section>
    </main>
  );
}
