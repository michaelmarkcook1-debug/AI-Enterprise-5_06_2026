# AI Enterpise — Data-gap audit

What's mock, what's real, what would replace each. This is the production
data backlog: the smaller it gets, the more of the dashboard is live.

> Status legend
> 🟢 Live (production-grade source)
> 🟡 Mock but architected (replace by running an existing pipeline)
> 🔴 Mock and missing pipeline (needs a new agent / connector)

---

## Vendor identity (names + categories)

| Surface | Status | Replacement |
|---|---|---|
| 20 vendor names + slugs (OpenAI, Microsoft, …) | 🟢 Real | n/a |
| Exposure class taxonomy | 🟢 Real | n/a |
| Public/private/subsidiary ownership flag | 🟢 Real | Verifiable on filings |

---

## Evidence + scoring inputs

| Surface | Status | Replacement |
|---|---|---|
| Per-vendor evidence rows (capabilities, controls, etc.) | 🟡 Curated seed | `npm run ingest` → admin approve at `/admin/evidence`. **51 URLs queued** in `lib/sourcing/manifest.ts`. |
| Evidence grade (E0–E5) per row | 🟡 Seed-set | Auto-graded by the LLM classifier once `ANTHROPIC_API_KEY` is set. |
| Confidence + freshness | 🟡 Seed-set | Auto-derived from source date + grade. |
| Risk flags (fatal/severe/moderate) | 🟡 Seed-set | Surfaced by the classifier's `suggestedRiskFlag` field. |

---

## Market intelligence

| Surface | Status | Replacement |
|---|---|---|
| Market share % per category | 🔴 Mock | **Needs new agent**: analyst-PDF parser + earnings-release crosswalk. Schema ready in `MarketShareEstimate`. |
| Vendor momentum scores | 🔴 Mock | **Needs new agent**: news-velocity + product-velocity + hiring-signal aggregator. Schema ready in `VendorMomentum`. |
| News items + classifications | 🟡 Mock w/ schema | RSS / press-release ingestion agent. `NewsItem` + `suggestedScoreImpact` shape ready; reuse `lib/agents/evidence-extractor.ts` pattern with a news-specific system prompt. |
| Capability matrix (status, maturity) | 🟡 Curated seed | Doc-snapshot diff watcher (compare today's vendor docs to the snapshot in storage; flag changes for review). |
| Industry strength scores | 🟡 Curated seed | Same evidence pipeline, just industry-tagged. |

---

## Investor Tools

| Surface | Status | Replacement |
|---|---|---|
| Public stock financials (EV/Rev, FCF margin, etc.) | 🔴 Mock | Needs SEC / earnings-release ingest. Schema in `ValuationMetric`. |
| IPO rumour quality (R0–R5) | 🟡 Curated seed | Reputable-news classifier (R3 ↑) + S-1 / F-1 detector (R5). |
| IPO timing forecast | 🟡 Modelled, source-required | Stays modelled until verified filing data exists (per addendum spec). |
| Post-IPO fluctuation bands | 🟡 Modelled | Disabled until verified offer price exists. Spec-correct behaviour. |
| Indirect exposure edges | 🟡 Curated seed | Public-disclosure crosswalk: 10-K + investor presentations naming partner labs. |
| Provider Quality + Investment Attractiveness scores | 🟡 Computed from seed | Auto-recompute when underlying evidence flows. |

---

## Market Signals Engine

| Surface | Status | Replacement |
|---|---|---|
| Signal schema (MarketSignal, MarketTalkSignal, RegulatoryEvent, MarketRegime) | 🟢 Real | n/a — see `lib/market-signals/types.ts` |
| Impact scoring + truthfulness gates (E0-blocked, market-talk caps, stale exclusion) | 🟢 Real | `scoreSignal()` deterministic, 19 tests |
| Regime derivation from current signals | 🟢 Real | `deriveCurrentRegime()` |
| Post-IPO band adjustment (centre-shift, width-expansion, event-shock, regime, confidence) | 🟢 Real | `adjustPostIpoBand()` — verified via tests |
| Signal-adjusted simulator overlay (per-holding return delta, volatility uplift) | 🟢 Real | Toggle in simulator UI; engine in `deriveSignalAdjustedDelta()` |
| Source manifest of seed signals (~12 across all categories) | 🟡 Curated seed | Replaced once Stage 1-4 connectors run |
| **Stage 1 connectors** — SEC EDGAR, FRED, BLS, EIA, company press releases | 🔴 Manifest only | **Needs** ingestion adapters writing into `MarketSignal` shape |
| **Stage 2 connectors** — Alpha Vantage / Nasdaq Data Link / Cboe / exchange feeds | 🔴 Mock | **Needs** licensed market-data API keys + adapter |
| **Stage 3 connectors** — GDELT, reputable-news APIs, licensed analyst | 🔴 Mock | **Needs** GDELT DOC/Context wiring + news classifier |
| **Stage 4 connectors** — Reddit, X, search trends, forums (with bot-risk scoring) | 🔴 Mock | **Needs** social/search APIs; outputs constrained to band-widener / watchlist alert per Section 9 |
| Signal audit log (before/after, why score changed) | 🟡 Schema ready | Wire into `lib/sourcing` log writer |

---

## Operator-side

| Surface | Status | Replacement |
|---|---|---|
| Source manifest | 🟢 Real URLs | n/a — operator-editable |
| Ingestion logs | 🟢 Real (NDJSON) | n/a |
| Admin auth | 🟡 Token gate or `ADMIN_API_OPEN=1` | Replace with Sign-in-with-Vercel for SSO. |
| Watchlist + saved portfolios | 🟢 localStorage | Add server-side persistence under DB once multi-tenant. |

---

## Build order to close the gaps

In rough cost order:

1. **(1 day)** Provision Postgres + Anthropic key. Run ingestion against the
   51-URL manifest. Approve evidence. → Most of the **Evidence + scoring**
   block flips to 🟢.
2. **(2–3 days)** Build the news-RSS classifier agent, parameterising the
   existing extractor. → **News intelligence** + News-derived score impacts
   flip to 🟢.
3. **(3–5 days)** Build the market-share triangulation agent against analyst
   reports + earnings releases. → **Market share + Momentum** flip to 🟢.
4. **(2–4 days)** SEC / earnings-release ingestion for public valuations. →
   **Investor Tools financials** flip to 🟢.
5. **(ongoing)** Capability snapshot watcher. → **Capability tracker** stays
   fresh.

Total: ~2 weeks of focused engineering once credentials are in place. The
architecture, schemas, admin UIs, and truthfulness guardrails are already
built — what remains is per-source data wiring.

---

## What never becomes "live"

By design:

- **IPO timing precision** — modelled until S-1 / F-1.
- **Post-IPO bands** — modelled until verified offer price.
- **Recommendations** — never. Output language stays "ranks highest under this
  model" / "watchlist candidate" / "valuation-sensitive" — no buy/sell.

These are spec guardrails (Section 22 of the original product spec, Section 8 of the
truth-engine pack), not implementation gaps.
