# EIA Connector — Hardening + Example Usage Report

Date: 2026-05-12
Scope: `lib/connectors/eia.ts` (hardened), new service helper for
electricity retail sales, admin-gated example route, 30 unit/smoke tests.

## What shipped

The EIA connector already existed at `lib/connectors/eia.ts`. This pass
hardens it with:

1. **Strict "no fake success" semantics.** When `EIA_API_KEY` is missing,
   both `health()` and `fetch()` return
   `{ configured: false, status: "not_configured", message:
   "EIA_API_KEY is required" }` and `fetch()` returns `ok: false`
   without touching the network.
2. **Safe value normalisation.** EIA returns numeric series values as
   strings (e.g. `"13245.6"`, `"."` as the missing-value sentinel,
   `"NA"`). The new `safeNumber()` helper converts safely to
   `number | null` and never throws. `normaliseEiaRows()` attaches a
   parsed `valueNumber` alongside the raw `value` so downstream code
   can choose whichever form it needs.
3. **Health-check `message` field.** `ConnectorHealth.message` is a
   new optional field surfaced by `/api/data-sources/status` and the
   `/admin/data-sources` page. EIA uses it to carry the exact
   "EIA_API_KEY is required" string per the spec.
4. **Example service** (`lib/services/eia-retail-sales.ts`) for the
   electricity retail-sales metadata + data endpoints, returning
   already-normalised `RetailSalesPoint[]` (numeric price/sales/
   revenue/customers) and a `NormalisedEvidenceSource` payload for
   Truth Engine consumers.
5. **Admin-gated debug route** `GET /api/data-sources/eia/retail-sales`
   accepting `mode=data|metadata` + standard EIA facet params
   (`frequency`, `stateId`, `sectorId`, `start`, `end`, `length`).
6. **30 tests** covering safeNumber boundary cases (incl. `.` / `NA` /
   `Infinity` rejection), row normalisation, health-check key
   detection, fetch-not-configured no-network guarantee, HTTP-error
   no-fake-success, network-error no-fake-success, mocked successful
   call assertion on URL shape + `api_key=` placement.

## Files changed

| File | Diff |
|---|---|
| `lib/connectors/eia.ts` | Rewritten — explicit `message` on health, `safeNumber` + `normaliseEiaRows` exports, `EiaRow.valueNumber`, JSDoc on EIA returning strings |
| `lib/connectors/types.ts` | `ConnectorHealth.message?: string` added |
| `lib/services/eia-retail-sales.ts` | NEW — `getRetailSalesMetadata()`, `getRetailSalesData(opts)`, `RetailSalesPoint` type |
| `app/api/data-sources/eia/retail-sales/route.ts` | NEW — admin-gated GET |
| `lib/connectors/eia.test.ts` | NEW — 30 tests covering connector + service |

Registry membership (`lib/connectors/registry.ts`) was already in place
(`eia: eiaConnector`); `/api/data-sources/status` already reports EIA
health and now picks up the new `message` field automatically.

## Endpoints used

| EIA v2 route | Used for |
|---|---|
| `/v2/electricity/retail-sales` | Metadata — describes columns, facets, frequencies the route supports. Caller uses this to build filter UI without guessing field names. |
| `/v2/electricity/retail-sales/data` | Actual values — `price`, `sales`, `revenue`, `customers` per `period` × `stateid` × `sectorid`. Faceted; defaults to `frequency=monthly`, sorted by period desc. |

Both go through the same connector — `api_key` is appended to the URL
per EIA docs (not a header).

## Modules that should consume EIA data

| Module | Why |
|---|---|
| **Investment Intelligence — AI infrastructure exposure** | NVIDIA / AMD / AVGO / ASML / Cerebras exposure is gated on data-centre power availability. Regional retail-sales trends (industrial sector especially) flag where AI data-centre demand is bumping into supply. |
| **Capabilities — `cost_finops` domain** | Per-region electricity price (price column, cents/kWh) feeds the cost-of-AI-deployment signal in cost-of-ownership analysis. |
| **Capabilities — `vendor_maturity_lockin` (deployment options)** | Sovereign-AI / regional-hosting subfactors weight against jurisdictions with constrained or volatile retail power. |
| **Market Signals Engine** | Industrial-sector electricity sales growth is a leading indicator for data-centre buildout; surfaces as a macro signal alongside the existing FRED/BEA inputs. |
| **News Intelligence** | Cross-check news claims about regional data-centre energy constraints against the official EIA numbers — turns "rumoured" into "documented" when the EIA series corroborates. |

**Perplexity scope note:** EIA data feeds platform/capability surfaces.
It does NOT promote any vendor into Investor Tools — the
`INVESTOR_EXCLUDED_VENDOR_IDS` set still governs that boundary.

## Tests

- Suite: **402 / 402** across 29 files (was 372 — +30 new tests).
- TypeScript clean.

Key invariants locked:

| Invariant | Test |
|---|---|
| EIA returns strings → safeNumber handles every documented form | `safeNumber — string→number coercion` (14 cases) |
| Missing key never produces a network request | `returns not_configured WITHOUT touching the network` |
| Missing key returns the exact documented message | `returns configured=false, status=not_configured with the documented message` |
| HTTP error does NOT fake success | `does NOT fake success on HTTP error` |
| Network error does NOT fake success | `does NOT fake success on network error` |
| URL contains `api_key=` in the query string (EIA convention) | `calls EIA v2 with api_key in the URL and normalises rows` |
| Default evidence grade is E5 (official-government tier) | `declares the v2 base, government tier, and E5 default grade` |
| Service smoke: not_configured propagates from connector to service | `smoke: not_configured propagates from connector to service` |

## Exact commands Mike should run to verify locally

```bash
# 1. Set the key (gitignored)
echo 'EIA_API_KEY=<your-eia-key>' >> .env.local

# 2. Confirm tests still pass
npm test

# 3. Connector health visible at /api/data-sources/status
#    (run a local dev server first)
npm run dev
# In another terminal:
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  http://localhost:3000/api/data-sources/status \
  | jq '.connectors[] | select(.id=="eia")'
# Expected when key is set:
#   { "id": "eia", "configured": true, "status": "ok", ... }
# Expected when key is missing:
#   { "id": "eia", "configured": false, "status": "not_configured",
#     "message": "EIA_API_KEY is required", ... }

# 4. Live retail-sales metadata fetch
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/eia/retail-sales?mode=metadata" | jq

# 5. Live retail-sales data fetch (5 most recent monthly rows)
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/eia/retail-sales?length=5" | jq

# 6. Scoped: California residential, last 12 months
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/eia/retail-sales?stateId=CA&sectorId=RES&length=12" | jq

# 7. Deploy to Vercel
vercel env add EIA_API_KEY    # set for Preview + Production
vercel deploy
```

## Operator-safety guarantees

- ✅ No fake successful connections — every failure path returns
  `ok: false` with a real reason.
- ✅ Missing key returns `{ configured: false, status: "not_configured",
  message: "EIA_API_KEY is required" }` verbatim.
- ✅ Network-level errors propagate as `status: "error"` with the
  underlying message in `error`, not silently swallowed.
- ✅ EIA string-vs-number trap documented in module JSDoc and locked
  by tests so future contributors can't accidentally do `value * 1.05`
  on an unparsed string.
- ✅ No public UI changes beyond the admin-gated debug route.

## Acceptance criteria

- ✅ Connector support at `lib/connectors/eia.ts`
- ✅ EIA API v2
- ✅ `EIA_API_KEY` required from env
- ✅ Key in URL as `api_key=...` per EIA docs
- ✅ Health check via `health()`
- ✅ Fetch + normalisation into `EvidenceSource`-compatible shape via
  `normaliseFetchResult(eiaConnector.health(), result)` and the
  example service's `evidence` field
- ✅ Status visible at `/api/data-sources/status` and the
  `/admin/data-sources` page (registry membership pre-existing)
- ✅ Does not fake successful connections
- ✅ Missing-key payload exactly matches the spec
- ✅ Smoke test against mocked EIA responses (8 fetch-level + 2
  service-level scenarios)
- ✅ Example usage for both metadata and data on
  `electricity/retail-sales`
- ✅ String→number normalisation documented and locked by tests
- ✅ Report written
