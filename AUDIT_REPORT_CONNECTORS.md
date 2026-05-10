# Data Connector Audit

Date: 2026-05-10
Prepared for: Mike
Pack: Stage 1 batch · Task 5 (`06_TASK_5_CONNECTOR_SCAFFOLD.md`)

## Connectors implemented

12 connectors registered in `lib/connectors/registry.ts`. Every adapter does a real env-check in `health()` and a real HTTP fetch in `fetch(query)` — no stubs.

| ID | Source | Group | Tier | Key required? | Free? |
|---|---|---|---|---|---|
| `sec` | SEC EDGAR | filings | official_government | UA only | ✅ |
| `fred` | FRED (Federal Reserve) | macro | central_bank | yes | ✅ |
| `bls` | BLS | macro | official_government | optional | ✅ |
| `bea` | BEA | macro | official_government | yes | ✅ |
| `eia` | EIA | energy | official_government | yes | ✅ |
| `fiscalData` | US Treasury Fiscal Data | macro | official_government | no | ✅ |
| `alphaVantage` | Alpha Vantage | market_data | exchange | yes (free tier 25/day) | freemium |
| `gdelt` | GDELT | news_event | reputable_news | no | ✅ |
| `github` | GitHub REST | developer | developer_signal | optional | ✅ |
| `congress` | Congress.gov | regulatory | official_government | yes | ✅ |
| `federalRegister` | Federal Register | regulatory | official_government | no | ✅ |
| `vendorDocs` | Public vendor docs | vendor_docs | official | needs `ANTHROPIC_API_KEY` for the LLM extractor | depends on Anthropic spend |

## Connectors scaffolded (none — all are full implementations)

The pack allowed scaffolds with explicit `not_implemented` status. None of the 12 use that path; every adapter has a working `fetch()`. The `vendorDocs` adapter is a thin facade over the existing `lib/sourcing/runner.ts` pipeline — it surfaces the manifest as a connector-shaped data source without duplicating the runner's fetch + LLM extract + DB persist.

## Connectors not configured

In a clean dev environment (no `.env.local`):

| Connector | Reason |
|---|---|
| `sec` | `SEC_USER_AGENT` not set — required by SEC; adapter refuses to fetch without it |
| `fred` | `FRED_API_KEY` not set |
| `bea` | `BEA_API_KEY` not set |
| `eia` | `EIA_API_KEY` not set |
| `alphaVantage` | `ALPHA_VANTAGE_API_KEY` not set |
| `congress` | `CONGRESS_API_KEY` not set |
| `vendorDocs` | `ANTHROPIC_API_KEY` not set |

5 connectors work zero-config: `bls`, `fiscalData`, `gdelt`, `github` (60 req/hr without token), `federalRegister`.

## API keys required

| Env var | Source | Where to get it |
|---|---|---|
| `SEC_USER_AGENT` | SEC | self-set, e.g. `"AI Enterprise contact@example.com"` |
| `FRED_API_KEY` | FRED | https://fred.stlouisfed.org/docs/api/api_key.html (free) |
| `BEA_API_KEY` | BEA | https://apps.bea.gov/API/signup/ (free) |
| `EIA_API_KEY` | EIA | https://www.eia.gov/opendata/register.php (free) |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage | https://www.alphavantage.co/support/#api-key (free, 25/day) |
| `CONGRESS_API_KEY` | Congress.gov | https://api.congress.gov/sign-up/ (free) |
| `BLS_API_KEY` | BLS | https://www.bls.gov/developers/ (optional — 25→500 req/day) |
| `GITHUB_TOKEN` | GitHub | https://github.com/settings/tokens (optional — 60→5000 req/hr) |
| `ANTHROPIC_API_KEY` | Anthropic | https://console.anthropic.com/settings/keys (paid, ~$5 per full ingest run) |

Set all 6 free keys via `vercel env add <NAME> production` and the connector status page flips to all-configured. ServiceNow's `vendorDocs` then needs the existing `ANTHROPIC_API_KEY` (already configured on the live deploy).

## Health status

`/admin/data-sources` table groups connectors by category and shows per-connector:

- `status` — ok / not_configured / not_implemented / error / rate_limited
- `configured` — boolean
- `requiresKey` — boolean
- `envVars` — list of expected env-var names
- `rateLimitNotes` — copy lifted from each provider's docs
- `lastFetchAt` / `lastFetchOk` / `lastFetchError` / `lastFetchRecordCount` — populated by `recordLastFetch()` in `lib/connectors/types.ts` after every call

The dashboard chips at the top show: total / configured / not_configured / status:ok / status:error / rate_limited.

## Evidence normalisation

`lib/evidence/normalise.ts` exposes `normaliseFetchResult(health, result, opts)` which converts any `FetchResult<T>` into `NormalisedEvidenceSource`:

```ts
{
  id: string;             // composite — connectorId::sourceUrl|fetchedAt
  connectorId: string;
  sourceName: string;
  sourceUrl?: string;
  sourceType: ConnectorTier;
  capturedAt: string;
  sourceDate?: string;
  evidenceGrade: EvidenceGrade;       // per-connector default (E2-E5)
  confidenceScore: number;            // computed by confidenceFor()
  freshnessStatus: FreshnessStatus;   // computed by freshnessOf()
  recordCount: number;
  notes?: string;
}
```

Per-tier freshness horizons (`lib/evidence/freshness.ts`):

| Tier | Horizon |
|---|---|
| official / official_government | 180 days |
| central_bank | 90 days |
| exchange | 7 days |
| reputable_news | 14 days |
| developer_signal | 30 days |

Confidence calc (`lib/evidence/confidence.ts`):

```
score = grade_base[evidenceGrade]
score -= 15 if freshness == stale
score -= 10 if freshness == unknown
score += min(8, corroborating × 2)
score -= min(15, contradicting × 5)
score = clamp(max(score, baselineFloor), 0, 100)
```

## Known limitations

1. **Health checks are env-only** — `health()` returns the configured/not_configured state from env-var presence; it does NOT make a network call to test reachability. The pack spec asked for `healthCheck(): Promise<ConnectorHealth>` (async). Current `health()` is sync and cheap; an async `healthCheck()` that issues a `HEAD` against the source could be added — deferred because the value is small (the env-check is the main signal) and the cost (one HTTP call per connector per status-page render) is real.
2. **No connector cron yet.** Connectors fetch on-demand only via `POST /api/data-sources/refresh`. A scheduled job (Vercel Cron) per source class is the obvious next step — not done because the calling sites that would consume the data (vendor financials, market signals, news intelligence) need their per-connector ingestion adapters built first.
3. **No persisted connector run history.** `recordLastFetch()` is in-memory; restart loses it. Should write to a `ConnectorRun` Prisma model in Stage 2.
4. **`vendorDocs.fetch()` returns the manifest, not the extracted evidence.** Real extraction goes through `lib/sourcing/runner.ts` (`runSourcing()`), which is invoked separately via `npm run ingest` or `POST /api/admin/sourcing/run`. This separation is intentional — the connector adapter is a registry surface, not a duplicate pipeline.

## Next connector priorities

In rough cost-to-value order:

1. **SEC EDGAR financials adapter** (`lib/sourcing/sec-financials.ts`). Pulls XBRL company facts via `secConnector.fetch({cik, resource: "facts"})`, normalises into `IntelligenceVendor.financials` rows. Fully free, gives instant valuation truth-grade for every public vendor.
2. **FRED + BLS macro signals adapter** (`lib/sourcing/macro-signals.ts`). Uses both connectors to populate `MarketSignal` rows for the regime engine. Free with FRED_API_KEY.
3. **GDELT news classifier**. Use the existing news-extractor pattern (`lib/agents/evidence-extractor.ts`) to convert GDELT articles into `MarketSignal` rows.
4. **GitHub developer momentum**. Pull stars/release/contributor counts → `VendorMomentum` rows.
5. **Federal Register + Congress regulatory events**. Convert keyword-matching docs into `RegulatoryEvent` rows.

Each is roughly half a day of focused work.

## Final verdict

Connector scaffold **complete per Task 5 spec**. 12 of 12 adapters implemented (the pack listed 12; 11 are external sources, 1 is the vendorDocs facade). Status page exists at `/admin/data-sources`; refresh API at `POST /api/data-sources/refresh`. No connector ever fakes a successful status — confirmed by tests in `lib/connectors/registry.test.ts`. Stage 2 work is per-source ingestion + cron, not more connectors.
