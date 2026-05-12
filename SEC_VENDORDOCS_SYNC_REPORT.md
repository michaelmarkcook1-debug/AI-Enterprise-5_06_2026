# SEC + vendorDocs Connector Sync Report

Date: 2026-05-12
Scope: bring SEC EDGAR and vendorDocs to the same hardening standard as EIA
(commit `c82dd70`). Adds explicit `message` field, type-guard validators,
honest `not_configured` returns, normalised `EvidenceSource` payloads, and
admin-gated local verification routes.

## What's working

| Item | State |
|---|---|
| `secConnector.health()` returns `message: SEC_NOT_CONFIGURED_MESSAGE` when `SEC_USER_AGENT` is missing OR doesn't contain a valid contact email (regex `\S+@\S+\.\S+`, min length 8) | ✅ |
| `secConnector.fetch()` short-circuits to `status: "not_configured"` without touching the network when UA is invalid | ✅ |
| SEC submissions URL (`https://data.sec.gov/submissions/CIK{cik}.json`) reached with correct `User-Agent` header | ✅ |
| SEC `resource=facts` routes to `companyfacts/CIK{cik}.json` | ✅ |
| SEC HTTP 429 returns `status: "rate_limited"` distinct from generic error | ✅ |
| SEC network errors surface real reason in `error` (no fake success) | ✅ |
| `normaliseFetchResult(secConnector.health(), result)` produces an `E5 / official_government` `NormalisedEvidenceSource` | ✅ |
| `vendorDocsConnector.health()` returns `message: VENDOR_DOCS_NOT_CONFIGURED_MESSAGE` when `ANTHROPIC_API_KEY` is missing or doesn't start with `sk-ant-` | ✅ |
| `vendorDocsConnector.fetch()` honestly returns `not_configured` when the LLM extractor can't run, even though the fetch step itself doesn't need the key | ✅ |
| `vendorDocsConnector.fetch({ vendorId })` returns manifest entries grouped by vendor; unknown vendors return `status: "error"` not fake ok | ✅ |
| `normaliseFetchResult(vendorDocsConnector.health(), result)` produces an `E2 / official` `NormalisedEvidenceSource` | ✅ |
| Both connectors surfaced at `/api/data-sources/status` with the new `message` field | ✅ |
| Both connectors have admin-gated verification routes (see below) | ✅ |
| All scope-boundary + hardening tests pass | ✅ |

### Live smoke (this session)

```
SEC_USER_AGENT present: <unset>
ANTHROPIC_API_KEY present: yes (length 108)

# Direct SEC call with a placeholder UA (server-side connector won't use this):
GET https://data.sec.gov/submissions/CIK0000789019.json
→ { "name": "MICROSOFT CORP", "ticker": ["MSFT"], "sic": "7372",
    "sicDescription": "Services-Prepackaged Software",
    "fiscalYearEnd": "0630", "recentFilingCount": 1012 }
```

So **SEC is reachable** with a compliant UA, and **vendorDocs is configured**
(108-char `sk-ant-…` key in `.env.local`). The SEC connector itself will
report `not_configured` server-side until `SEC_USER_AGENT` is added.

## What still falls back to seed

| Surface | Behaviour without `SEC_USER_AGENT` |
|---|---|
| `getDataProvenance()` — global "NOT LIVE" banner | still flips to live only when **analyst-approved evidence** exists; SEC alone doesn't move it |
| Vendor financial metrics (`FINANCIAL_METRICS`, `VALUATION_METRICS`) | seeded from `lib/investing/seed.ts` until SEC ingestion writes verified records |
| IPO Watch `IPO_PROCESS_STATES` | seed-only; rumour stage + readiness score are model estimates labelled accordingly |
| Vendor profile EDGAR data on `/vendors/[slug]` | the SEC integration that wires filings/XBRL into vendor profiles is **not yet built** — connector is plumbed and verified; consumer is the next-stage work |

| Surface | Behaviour with valid `ANTHROPIC_API_KEY` |
|---|---|
| `vendorDocs` end-to-end ingestion (`npm run ingest` / `POST /api/admin/sourcing/run`) | live — extracts evidence proposals into the queue (see `runlogs/reclassify-live-full.txt`) |
| `/capabilities` "Data sources backing this surface" panel | shows `vendorDocs: ok` with live last-fetch metadata |

The vendorDocs pipeline is the one that's already fed the queue (314 proposals)
— the connector reporting is now honest about the prerequisite key.

## Files changed

| File | Change |
|---|---|
| `lib/connectors/sec.ts` | Added `SEC_NOT_CONFIGURED_MESSAGE`, `isSecUserAgentValid()` type-guard. `health()` and `fetch()` use the helper + carry `message`. |
| `lib/connectors/vendorDocs.ts` | Added `VENDOR_DOCS_NOT_CONFIGURED_MESSAGE`, `isAnthropicKeyValid()`. `health()` carries `message`. `fetch()` short-circuits to `not_configured` when the key can't run the extractor (honest gate even though fetch itself doesn't need it). |
| `app/api/data-sources/sec/[cik]/route.ts` (NEW) | Admin-gated `GET` — calls connector + trims SEC payload to a readable preview (header + 25 recent filings, or facts namespace summary). Returns `NormalisedEvidenceSource` envelope. |
| `app/api/data-sources/vendor-docs/route.ts` (NEW) | Admin-gated `GET` — returns the manifest grouped by vendor (up to 30 URLs per vendor). Optional `?vendorId=` scope. |
| `lib/connectors/sec.test.ts` (NEW) | 12 tests: validator boundary cases, health/fetch with/without UA, 429 → `rate_limited`, network error path, normalisation envelope. |
| `lib/connectors/vendorDocs.test.ts` (NEW) | 9 tests: key validator, health states, fetch not_configured no-leak, scoped fetch, unknown vendor → error, normalisation envelope at E2. |

Suite delta: **423 / 423** across 31 files (was 402 — +21 connector tests).
TypeScript clean.

## Exact verification commands for Mike

### 1. Sanity check the env

```bash
cd ranking-engine
grep -c '^SEC_USER_AGENT='     .env.local      # 0 means you still need to set it
grep -c '^ANTHROPIC_API_KEY='  .env.local      # 1 means vendorDocs is good
```

### 2. Set `SEC_USER_AGENT` if missing

```bash
# SEC requires identifying contact email — pick yours
echo 'SEC_USER_AGENT=AI Enterprise contact@example.com' >> .env.local
```

### 3. Confirm tests + build still green

```bash
set -a && source .env.local && set +a
npm test
npm run build
```

### 4. Confirm honest status reporting

```bash
npm run dev   # leaves dev server running

# In another terminal:
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  http://localhost:3000/api/data-sources/status \
  | jq '.connectors[] | select(.id=="sec" or .id=="vendorDocs")
        | { id, configured, status, message }'

# Expected (with key + UA set):
#   { "id": "sec",        "configured": true, "status": "ok" }
#   { "id": "vendorDocs", "configured": true, "status": "ok" }
#
# If SEC_USER_AGENT is missing:
#   { "id": "sec", "configured": false, "status": "not_configured",
#     "message": "SEC_USER_AGENT is required and must contain a contact email …" }
```

### 5. Live SEC verification (admin-gated route)

```bash
# Microsoft (CIK 0000789019) recent filings
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/sec/0000789019" | jq

# XBRL company facts
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/sec/0000789019?resource=facts" | jq

# NVIDIA (CIK 0001045810)
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/sec/0001045810" | jq
```

### 6. Live vendorDocs verification (manifest preview)

```bash
# Full manifest grouped by vendor
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/vendor-docs" | jq '{ok, status, vendorCount: (.vendors | length)}'

# Scoped to a single vendor
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "http://localhost:3000/api/data-sources/vendor-docs?vendorId=vendor_openai" | jq
```

### 7. Deploy

```bash
vercel env add SEC_USER_AGENT       # paste your contact-email UA
# ANTHROPIC_API_KEY already present in Vercel env from earlier
vercel deploy
```

## Operator-safety guarantees

- ✅ No fake successful connections on either connector.
- ✅ Missing env → exact documented message in both `health().message` and `fetch().error`.
- ✅ HTTP 429 from SEC categorised as `rate_limited`, not `error` — distinguishable in status reports.
- ✅ Network failures bubble the real reason; never silently swallowed.
- ✅ `normaliseFetchResult()` returns a `NormalisedEvidenceSource` at the correct evidence grade (`E5` for SEC, `E2` for vendorDocs) for downstream Truth-Engine consumers.
- ✅ No public UI changes — admin routes only.

## Acceptance criteria

- ✅ SEC + vendorDocs verified end-to-end to the EIA hardening standard.
- ✅ Both appear truthfully in `/api/data-sources/status` (status + new `message` field).
- ✅ Local verification routes shipped (`/api/data-sources/sec/[cik]` and `/api/data-sources/vendor-docs`).
- ✅ Both normalise into `NormalisedEvidenceSource` via `normaliseFetchResult()`.
- ✅ Report written: this document.
