# AI Enterprise — Data Connections Audit Report

Date: 2026-05-10
Phase: Master fix prompt pack v1, Phase 6 + Phase 12
Status: 11 free-source connectors implemented

## Connectors

| ID | Source | Group | Tier | Requires key? | Env vars | Status (this build) |
|---|---|---|---|---|---|---|
| `sec` | SEC EDGAR | filings | official_government | No (UA required) | `SEC_USER_AGENT` | not_configured (UA not set) |
| `fred` | FRED (Federal Reserve) | macro | central_bank | Yes (free) | `FRED_API_KEY` | not_configured |
| `bls` | BLS | macro | official_government | Optional | `BLS_API_KEY` | ok (lower limits without key) |
| `bea` | BEA | macro | official_government | Yes (free) | `BEA_API_KEY` | not_configured |
| `eia` | EIA | energy | official_government | Yes (free) | `EIA_API_KEY` | not_configured |
| `fiscalData` | US Treasury | macro | official_government | No | — | ok |
| `alphaVantage` | Alpha Vantage | market_data | exchange | Yes (free, 25/day) | `ALPHA_VANTAGE_API_KEY` | not_configured |
| `gdelt` | GDELT | news_event | reputable_news | No | — | ok |
| `github` | GitHub REST API | developer | developer_signal | Optional | `GITHUB_TOKEN` | ok (60 req/hr without token) |
| `congress` | Congress.gov | regulatory | official_government | Yes (free) | `CONGRESS_API_KEY` | not_configured |
| `federalRegister` | Federal Register | regulatory | official_government | No | — | ok |

5 connectors are usable with **zero configuration today**: `bls`, `fiscalData`, `gdelt`, `github`, `federalRegister`.

## Implemented vs stub

All 11 connectors are **fully implemented**, not stubs. Each:

- Performs a real env-check in `health()` (no network, cheap)
- Issues a real HTTP fetch in `fetch(query)` against the source
- Surfaces the result via the `Connector` contract: `{ ok, status, records, recordCount, fetchedAt, error?, sourceUrl?, rateLimitRemaining? }`
- Records last-fetch outcome via `recordLastFetch()` so the admin page shows freshness
- Returns `not_configured` instead of fake-success when env vars are missing — confirmed by 6 tests in `lib/connectors/registry.test.ts`

## Evidence normalisation

`lib/evidence/normalise.ts` converts any `FetchResult` into `NormalisedEvidenceSource` with:

- `id` (composite key)
- `connectorId`, `sourceName`, `sourceUrl`, `sourceType` (tier)
- `capturedAt`, `sourceDate`
- `evidenceGrade` (per-connector default)
- `confidenceScore` (computed by `confidenceFor()` — grade × freshness × corroboration)
- `freshnessStatus` (computed by `freshnessOf()` — per-tier horizon)

Per-tier freshness horizons:
- official / official_government: **180 days**
- central_bank: **90 days**
- exchange: **7 days**
- reputable_news: **14 days**
- developer_signal: **30 days**

## API surface

| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/api/data-sources/status` | Per-connector health + dashboard summary |
| `GET` | `/api/data-sources/[connectorId]` | One connector's health snapshot |
| `POST` | `/api/data-sources/refresh` | Trigger one connector with body `{connectorId, query?}` |

Refresh endpoint **rejects** without explicit `connectorId` (no full fan-out — too easy to burn quotas accidentally).

## Admin page

`/admin/data-sources` — read-only table grouped by category (macro / filings / energy / regulatory / developer / news_event / market_data) with 6 summary chips at top and a "How to enable" guide at the bottom. Linked from `/admin`.

## Data gaps (still seed)

| Surface | Why still seed | What unblocks it |
|---|---|---|
| Vendor financials (EV/Rev, FCF margin etc.) | SEC EDGAR connector built, but XBRL parsing not yet plumbed into `IntelligenceVendor` | Add `lib/sourcing/sec-financials.ts` that calls `secConnector.fetch({cik, resource: "facts"})` and updates `IntelligenceVendor.financials` |
| Macro signals | FRED, BLS, BEA, EIA connectors built; no scheduled job to populate `MarketSignal` rows | `npm run ingest:macro` script + Vercel Cron |
| News / event signals | GDELT connector built; same scheduling gap | `npm run ingest:news` + cron |
| Equity prices, market sentiment | Alpha Vantage connector built; needs key + scheduled job | Set `ALPHA_VANTAGE_API_KEY`, build `lib/sourcing/equity-prices.ts` |
| Developer momentum | GitHub connector built; no aggregation into `VendorMomentum` | Build `lib/sourcing/dev-signals.ts` |
| Regulatory events | Federal Register + Congress.gov connectors built; no normalisation into `RegulatoryEvent` | Build `lib/sourcing/reg-events.ts` |

## Operator setup checklist

1. **Free, easy wins** (5 minutes total):
   ```bash
   vercel env add SEC_USER_AGENT production         # paste: "AI Enterprise contact@example.com"
   vercel env add FRED_API_KEY production           # https://fred.stlouisfed.org/docs/api/api_key.html
   vercel env add BEA_API_KEY production            # https://apps.bea.gov/API/signup/
   vercel env add EIA_API_KEY production            # https://www.eia.gov/opendata/register.php
   vercel env add CONGRESS_API_KEY production       # https://api.congress.gov/sign-up/
   vercel env add ALPHA_VANTAGE_API_KEY production  # https://www.alphavantage.co/support/#api-key
   vercel env add GITHUB_TOKEN production           # https://github.com/settings/tokens (read-only public)
   # repeat for `preview` and `development` environments
   ```

2. **Verify**: GET `/admin/data-sources` — all 11 should be `configured: ✓ yes`, `status: ok`.

3. **Smoke test**:
   ```bash
   curl -X POST $URL/api/data-sources/refresh \
     -H 'content-type: application/json' \
     -d '{"connectorId":"fred","query":{"seriesId":"FEDFUNDS","limit":5}}'
   ```
   Should return real Fed funds observations + a normalised `evidence` block.

4. **Schedule** (next milestone): wire Vercel Cron entries to call refresh nightly per source class.
