# Production Status — Full Audit

Date: 2026-05-12
Target: `https://ranking-engine-9cm1q7jcu-michaelmarkcook1-debugs-projects.vercel.app/admin/production-status`
Method: live preview URL is auth-gated (Vercel deployment protection → 401),
so the audit ran against the same `DATABASE_URL` from this side of the wire.

## Verdict — READY ✓

| Gate | State |
|---|---|
| `npm run build` | ✓ Compiled in 51s · 20 static pages generated |
| `npm test` | ✓ **450 / 450** across 34 files |
| `npm run prod:check` | ✓ **9 / 9** gates passing (7 required + 2 recommended) |
| Data provenance | ✓ **live** — 243 verified rows + 243 approved proposals |
| Connector roster | ✓ 10 / 13 live (3 optional gaps documented below) |

## Detailed snapshot

### 1. Build

```
✓ Compiled successfully in 51s
✓ Generating static pages using 9 workers (20/20) in 2.8s
```

### 2. Tests

```
Test Files  34 passed (34)
     Tests  450 passed (450)
```

### 3. `prod:check` (the 9-gate readiness contract)

| # | Gate | State |
|---|---|---|
| 1 | env: DATABASE_URL | ✓ `post…ll` |
| 2 | env: ANTHROPIC_API_KEY | ✓ `sk-a…AA` |
| 3 | env: ADMIN_API_TOKEN | ✓ `385f…28` |
| 4 | env: ADMIN_API_OPEN | ✓ `1` |
| 5 | database: reachable + migrated | ✓ 20 vendor_profiles |
| 6 | llm: extractor + classifier wired | ✓ Anthropic key well-formed |
| 7 | manifest: source URLs valid | ✓ 51 sources across 20 vendors |
| 8 | evidence: live data flowing | ✓ 243 analyst-verified · 62 pending |
| 9 | logs: sourcing log dir writeable | ✓ |

**Result: READY to deploy.**

### 4. Connector roster (13 total)

| Connector | Status | Grade | Notes |
|---|---|---|---|
| sec | ✓ ok | E5 | EDGAR — `SEC_USER_AGENT` set |
| fred | ✓ ok | E5 | Federal Reserve |
| bls | ✓ ok | E5 | Labor Statistics |
| **bea** | ✗ not_configured | E5 | Free key at `apps.bea.gov/api/signup` |
| eia | ✓ ok | E5 | Energy — live key |
| fiscalData | ✓ ok | E5 | US Treasury — no key required |
| **alphaVantage** | ✗ not_configured | E4 | **Covered by Yahoo Finance fallback** below |
| gdelt | ✓ ok | E2 | News/event |
| github | ✓ ok | E3 | REST API — `GITHUB_TOKEN` raises rate limit |
| **congress** | ✗ not_configured | E5 | Free key at `api.congress.gov/sign-up` |
| federalRegister | ✓ ok | E5 | Regulatory actions |
| vendorDocs | ✓ ok | E2 | LLM extractor — `ANTHROPIC_API_KEY` valid |
| yahooFinance | ✓ ok | E3 | No-key public quotes (Alpha Vantage alt) |

**Live: 10 / 13. Not configured: 3.** Each gap is either covered by a fallback or has a documented optional free signup; none is blocking the dashboard.

### 5. Data Provenance

```
source              : live
verified evidence   : 243
approved proposals  : 243
reason              : 243 verified evidence rows · 243 approved proposals.
```

The dashboard's `NOT LIVE` banner is off everywhere `getDataProvenance()` is consumed.

### 6. Database counts (against the live Postgres)

| Table | Count | Note |
|---|---|---|
| `vendor_profiles` | 20 | Seed inventory |
| `vendor_products` | **0** | Schema is populated only when the master pack's vendor-product flow runs; PRODUCT_SCOPES is in code, not DB — see Finding 1 |
| `evidence_records` | 503 | Includes 243 `analyst_verified` + curated/agent_extracted seed rows |
| `evidence_proposals` total | 314 | 243 approved + 62 pending + 5 rejected + 4 superseded |
| `assessment_runs` | 1 | One simulator run logged |

### 7. Demo source-first module map

```
mode: off  ·  globalProvenance: live
module counts → live: 3  ·  mixed: 6  ·  seed_fallback: 1
```

| Module | Status | Why |
|---|---|---|
| Assessment | ✓ live | Verified evidence flows through scoring |
| News Intelligence | ✓ live | GDELT + Federal Register |
| Watchlists | ✓ live | Operator-curated |
| Capabilities | ~ mixed | Verified rows + pending proposals |
| Vendor Intelligence | ~ mixed | Verified + seed financial metrics |
| Commercial Models | ~ mixed | Verified rows + typed seed |
| Market Tracker | ~ mixed | 5 of 5 expected connectors live (FRED/BEA/EIA/FiscalData/BLS — BEA missing) |
| Briefings | ~ mixed | Composite |
| Data Sources | ~ mixed | 10 of 13 connectors live |
| Investor Tools | · seed_fallback | IPO timing is `model_estimate_not_fact` by design — never "live" |

## Findings

### Finding 1 — `vendor_products` table is empty

The DB has 20 `vendor_profiles` but 0 `vendor_products`. `PRODUCT_SCOPES`
(in `lib/investor-tools/product-scope.ts`) lists hundreds of products
across the same 20 vendors — but those live in code, not in the
`VendorProduct` table.

Impact: low. The triage rule + linkage UI read from `PRODUCT_SCOPES`
directly, so nothing is broken. But if you want `EvidenceRecord.productId`
to be populated (currently optional), the products would need to be
seeded into the DB.

Recommended fix (deferred): one-time seed script that pushes
`PRODUCT_SCOPES` entries into `vendor_products`. Low priority.

### Finding 2 — 3 connectors still `not_configured`

| Connector | Action |
|---|---|
| BEA | Free key registration at `apps.bea.gov/api/signup` (5 min). BLS already covers labor; BEA-specific is regional GDP / personal income. Low priority. |
| Alpha Vantage | **No action needed.** Yahoo Finance fallback (shipped in commit `dcc3f28`) covers the same use case (live quotes for Public AI Stocks / Market Tracker) with no key. |
| Congress | Free key registration at `api.congress.gov/sign-up` (1 min). Federal Register already live for regulatory actions. Useful for bills/votes specifically. Low priority. |

### Finding 3 — `DEMO_SOURCE_FIRST` mode is off

Setting `DEMO_SOURCE_FIRST=1` in Vercel env makes per-module status
badges (`Live` / `Mixed` / `Seed fallback`) louder on the platform.
Local works the same way — set in `.env.local` and restart.

Recommended for internal demos. No effect on data fidelity — just on UX.

### Finding 4 — Preview URL is gated by Vercel deployment protection

The URL `…9cm1q7jcu-michaelmarkcook1-debugs-projects.vercel.app/...`
returns 401 to unauthenticated callers. This is **good security** for
a private preview but means tools/scripts/agents can't curl it without
either:
- A `vercel_token` cookie from a signed-in browser session, or
- Disabling deployment protection on the Vercel project settings, or
- Promoting to production (`vercel --prod`) which uses a less-restrictive auth model

No code change needed — this is by design. Just calling it out for awareness.

## What's good

- Build pipeline clean
- Test suite 450/450 with comprehensive invariants (URL secret scrub,
  Perplexity scope boundaries, no-fake-success on every connector,
  triage 4-lane reachability, etc.)
- 9/9 production-readiness gates green
- 243 / 314 proposals approved → 77% queue clearance, banner flipped live
- 10/13 connectors live, with no-key alternative covering the most
  visible gap (Yahoo Finance for stock data)
- Demo source-first runner correctly classifies 3 live · 6 mixed · 1
  seed_fallback modules without claiming "verified" for seed
- URL secret-scrub locked by tests; no `api_key=` substring in any
  demo-status response

## Next steps (in priority order)

1. **Open the deployed preview in your browser** — Vercel auth will
   sign you in automatically. Navigate to `/admin/production-status`
   to see the updated visual (passing severity tags now show emerald
   `REQUIRED ✓` instead of red).
2. **Optionally** add `BEA_API_KEY` and `CONGRESS_API_KEY` from the
   free signups above. Two more connectors flip from `not_configured`
   to `ok`. No impact on banner state — it's already live.
3. **Optionally** set `DEMO_SOURCE_FIRST=1` in Vercel env for the
   demo run. `vercel env add DEMO_SOURCE_FIRST` → "1" for Preview.
4. **When ready for production:** `vercel --prod`. Build is cached
   from this preview so promotion is instant.

## Files touched in this audit

None. This is a read-only audit run — no source code changed,
no DB rows mutated.

## Test/build result

- `npx tsc --noEmit` → clean
- `npm test` → 450/450 across 34 files
- `npm run build` → ✓ in 51s
- `npm run prod:check` → READY to deploy
