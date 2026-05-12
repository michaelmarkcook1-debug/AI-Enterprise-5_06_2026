# Demo Source-First Runbook

Date: 2026-05-12
Status: shipped

## Rule

> Use live data wherever possible. Fill the rest with seed data. **Do not
> hide the platform just because some modules are still partially seeded.**
> Never present seed data as verified. Never leak secret-bearing URLs in
> debug/admin responses.

## How it's implemented

A new env flag `DEMO_SOURCE_FIRST=1` opts the deployment into louder
status surfacing. The flag does NOT change the underlying truth /
evidence / data-status layer — it reads from it. The existing
`getDataProvenance()`, `ConnectorHealth`, `TruthRecord`, and
`EvidenceRecord` types remain the source of truth.

Three new pieces:

| Piece | Purpose |
|---|---|
| `lib/connectors/url-scrub.ts` | Strips known secret params (api_key / apikey / token / access_token / client_secret / x-api-key / secret / auth_token / key) from any URL. Applied at the connector layer so audit logs, normalised evidence, and debug routes can never carry the key. |
| `lib/demo/source-first.ts` + `lib/demo/runner.ts` | Pure assessor that reads provenance + connector health + evidence counts and returns a per-module `Live` / `Mixed` / `Seed fallback` status with a tooltip-friendly reason. |
| `components/DemoStatusBadge.tsx` | Reusable client badge — emerald (Live) / sky (Mixed) / amber (Seed fallback). |
| `app/api/demo/status/route.ts` | Single JSON endpoint summarising mode + per-module statuses + connector health. URL fields explicitly stripped. |

## What is live-backed now

| Module | State | Why |
|---|---|---|
| **Watchlists** | Live | Operator-curated; doesn't depend on a connector. |
| **Data Sources** (`/admin/data-sources`) | Live ↔ Mixed | Live when ≥1 connector reports `ok`. EIA / FRED / Anthropic-extractor reach `ok` once their env vars are set. |

## What is mixed

| Module | State | Why |
|---|---|---|
| **Assessment** (`/assessment`) | Mixed | Form is fully usable; the per-row evidence grade attached to each vendor reflects whether that vendor's evidence is verified or seed. Quick tier shipped; Guided/Advanced expose Phase-1B depth placeholders. |
| **Capabilities** (`/capabilities`) | Mixed | Every cell carries its own `dataStatus` badge (verified / documented / seed / disputed / etc.) — module is safe to show because the truth layer is per-cell. |
| **Commercial Models** (`/admin/data-sources`) | Mixed | Approved proposals layer over the typed seed inventory. Increases with `vendorDocs` ingestion. |
| **Vendor Intelligence** (`/vendors`) | Mixed | Evidence rows attached when present; financial / valuation metrics stay seed until SEC ingestion writes verified rows. |
| **News Intelligence** (`/news`) | Mixed | GDELT + Federal Register are free, no key required → `ok` out of the box; news cards labelled per source. |
| **Market Tracker** (`/market`) | Live ↔ Mixed | FRED / BEA / EIA / Fiscal Data / BLS — Mixed until all are configured. EIA is now live; FRED + Anthropic are live; BEA / Alpha Vantage / Congress can be added when keys arrive. |
| **Briefings** (`/briefings`) | Mixed | Composite of every other module; status reflects the worst-source caveat in the briefing body. |
| **Investor Tools** (`/investor-tools`) | Mixed (forced) | IPO timing + post-IPO bands are **MODELLED** — labelled `model_estimate_not_fact`. Public AI Stocks goes live only when Alpha Vantage is configured. **Investor Tools NEVER reports as Live** — by design (locked by test). |

## What is still seed-backed

| Module | What stays seed |
|---|---|
| Investor Tools — IPO timing | `model_estimate_not_fact` warning on every forecast row |
| Investor Tools — post-IPO fluctuation bands | Scenario-only seed; not factual price predictions |
| Vendor financial / valuation metrics | Until SEC ingestion writes verified rows into `FINANCIAL_METRICS` / `VALUATION_METRICS` |
| `/vendors/[slug]` EDGAR section | Connector is verified; the consumer wiring is the next-stage work |

Perplexity remains **platform-only**: included in Commercial Models /
Capabilities / Vendor Intelligence / News, **excluded** from every
Investor Tools surface. Locked by 14 boundary tests (`lib/investor-
tools/perplexity-scope-boundaries.test.ts`).

## Safest routes to show

In demo order, with the per-route badge expected:

1. **Home** `/` — hero. Take Assessment is the strong primary CTA.
2. **Assessment** `/assessment` — show the tier picker and the Quick path.
3. **Capabilities** `/capabilities` — per-cell dataStatus is the killer feature.
4. **Vendors** `/vendors` — pick `microsoft` or `nvidia` for the densest evidence.
5. **News** `/news` — GDELT live.
6. **Market** `/market` — show the FRED/EIA chart.
7. **Briefings** `/briefings` — pick the most-evidence-rich vendor.
8. **Watchlists** `/watchlists` — operator-curated, safe.
9. **Admin → Data Sources** `/admin/data-sources` — proves the connector hygiene.
10. **Investor Tools** `/investor-tools` — say "this is modelled, not factual" before opening it. The Mixed badge does that work for you.

Avoid mid-demo:
- `/admin/evidence/batch` (operator workflow, not a story for the audience)
- `/admin/ingestion` (raw plumbing)
- Anything that requires a click into `/admin/evidence/[id]` while reviewing

## Demo-status summary (`/api/demo/status`)

```bash
curl -s http://localhost:3000/api/demo/status | jq '{
  mode,
  globalProvenance,
  counts,
  modules: [.modules[] | {id, status, route, reason}]
}'
```

Returns one row per module with status, reason, and counts. Use this
to confirm the demo's state before the audience sees it.

## Secret-bearing URLs — fixed

Every connector that bakes its key into the URL (`eia`, `fred`,
`bea`, `alphaVantage`, `congress`) now passes its result URL through
`scrubSecretsFromUrl()` BEFORE returning. So:

- The `sourceUrl` on every `FetchResult` is **scrubbed**.
- The `NormalisedEvidenceSource.sourceUrl` is **scrubbed**.
- The sourcing event log entries are **scrubbed**.
- The `/api/data-sources/eia/retail-sales` debug route returns the
  scrubbed URL.
- The `/api/demo/status` endpoint **doesn't include URLs at all** —
  defence-in-depth.

Invariant test: `lib/connectors/url-scrub.test.ts` —
*INVARIANT — connector URL with api_key NEVER leaks through scrub*
asserts the exact production-shaped URL is scrubbed.

`/api/demo/status` runner test: *INVARIANT — no field in the summary
contains a leaked secret* greps the serialised payload for
`api_key=` / `apikey=` / `access_token=` and asserts no match.

## Exact deploy steps

```bash
# 1. Set env vars locally
echo 'DEMO_SOURCE_FIRST=1' >> .env.local
# (EIA_API_KEY, ANTHROPIC_API_KEY, SEC_USER_AGENT, FRED_API_KEY etc.
#  go here too — see prior reports)

# 2. Confirm tests + build still green
set -a && source .env.local && set +a
npm test
npm run build

# 3. Confirm demo status reports honestly
npm run dev
# In another terminal:
curl -s http://localhost:3000/api/demo/status | jq '{
  mode, globalProvenance, counts,
  modules: [.modules[] | {id, status, reason}]
}'
# Expected: mode="on" (because DEMO_SOURCE_FIRST=1), modules array
# with one entry per platform module, each carrying Live / Mixed /
# Seed fallback.

# 4. Spot-check no secrets leak
curl -s http://localhost:3000/api/demo/status | jq -r '.. | strings' \
  | grep -E "api_key=|apikey=|access_token=|client_secret=" || echo "no leaks ✓"

# 5. Deploy
vercel env add DEMO_SOURCE_FIRST              # set "1" for Preview
vercel deploy

# 6. Smoke-check production demo status
curl -s https://<your-deploy>/api/demo/status | jq '.counts'
```

## Operator-safety checklist

| Item | Locked by |
|---|---|
| Live data preferred wherever available | Per-module assessor reads `verifiedEvidenceCount` first |
| Seed fills only where necessary | `assessModuleStatus()` returns `seed_fallback` only when `liveSignalCount === 0` |
| All visible modules have honest status labels | Every module in the registry has a non-empty `reason` string |
| No seed data is shown as verified | Status label set is `{Live, Mixed, Seed fallback}` — "verified" not in the vocabulary |
| No secret-bearing source URLs are exposed | URL-scrub at the connector layer + demo-status runner omits URL fields + invariant test |
| Investor Tools never reports as Live | `runner.test.ts` asserts `it.status !== "live"` |
| Assessment stays first-class hero | Hero CTA + nav placement unchanged (Stage-2 Rev2) |
| Investor Tools stays Level-3 specialist | Nav placement unchanged (Stage-2 Rev2) |

## Tests

- Suite: **450 / 450** across 34 files (was 423 — +27 demo/scrub tests).
- TypeScript clean.

## Files changed

| File | Diff |
|---|---|
| `lib/connectors/url-scrub.ts` (NEW) | Pure scrubber + `urlContainsSecret()` checker |
| `lib/connectors/url-scrub.test.ts` (NEW) | 9 tests including production-fixture invariant |
| `lib/connectors/eia.ts` | `sourceUrl: scrubSecretsFromUrl(url)` |
| `lib/connectors/fred.ts` | same |
| `lib/connectors/bea.ts` | same |
| `lib/connectors/alphaVantage.ts` | same |
| `lib/connectors/congress.ts` | same |
| `lib/demo/source-first.ts` (NEW) | Mode flag + `assessModuleStatus` + `explainStatus` + label map |
| `lib/demo/runner.ts` (NEW) | DB / connector reads → `DemoSummary` |
| `lib/demo/source-first.test.ts` (NEW) | 12 tests |
| `lib/demo/runner.test.ts` (NEW) | 5 tests including no-leak invariant |
| `app/api/demo/status/route.ts` (NEW) | Single JSON endpoint |
| `components/DemoStatusBadge.tsx` (NEW) | Reusable Live/Mixed/Seed badge |
