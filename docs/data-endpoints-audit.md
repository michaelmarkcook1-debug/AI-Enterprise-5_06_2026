# Data Endpoints Audit — AI Enterprise

**Date:** 10 June 2026 · **Branch:** `stage-1-truth-data-stabilisation`
**Purpose:** Establish every data domain's current source and the endpoint it must converge to. Stage-1 principle applies throughout: Prisma/Postgres is the single source of truth; static seeds are transitional and must be explicitly labelled until replaced.

## Status key
- ✅ **Live** — served from Prisma/Postgres via an API route or server component
- 🟡 **DB-backed, seed-confidence** — in the database but originally seeded; needs live refresh
- 🔴 **Static** — hardcoded TypeScript dataset; no endpoint exists yet
- ⛔ **Blocked** — pipeline exists but cannot run (Anthropic API spend cap)

## Domain inventory

| Domain | Current source | Existing endpoint | Target | Status |
|---|---|---|---|---|
| Vendors, pillars, categories | Prisma/Postgres | `/api/vendors`, `/api/vendor`, repository | as-is | ✅ |
| Market dashboard (composite) | Prisma/Postgres | `/api/market-dashboard` | as-is | ✅ |
| Market share estimates | Prisma `MarketShareEstimate` (seeded) | repository `listMarketShareEstimates()` — no public route | `/api/market-share` route + quarterly refresh job sourcing analyst/usage data | 🟡 |
| **Vendor uptake (industry × region × size)** | **Static** `lib/intelligence/vendor-uptake-seed.ts` (585 rows from May 2026 xlsx model) | none | Migrate to Prisma table `VendorUptakeSegment` + `/api/uptake?industry=&region=`; refresh via evidence pipeline | 🔴 |
| Reputation (customer/dev/employee/uptime) | Static seed constants | none | Prisma table + `/api/reputation`; collectors: review platforms, GitHub, status pages | 🔴 |
| Token pricing | `lib/pricing` static list | none | `/api/pricing` + scheduled scrape of published vendor price pages ("Unverified" preserved where no clean source) | 🔴 |
| News items | Prisma (seeded, `[MOCK]`-prefixed) | `/api/news` | Live ingestion via evidence pipeline | ⛔ spend cap |
| Momentum scores | Prisma (seeded) | repository | Recompute from live news/evidence flow | ⛔ spend cap |
| Evidence extraction | `lib/agents/evidence-extractor` (built, tested) | `/api/evidence` | Unblock by raising Anthropic API spend cap | ⛔ |
| Watchlists & alerts | Prisma | `/api/watchlist(s)`, `/api/cron` | as-is | ✅ |
| Assessment runs & shortlists | Prisma + URL params + sessionStorage | `/api/assessment` | Persist shortlist server-side per user (removes sessionStorage dependency for Monitor) | 🟡 |
| Business case / risks / KPIs / assumptions / competitors | Static `lib/decision-intelligence/seed.ts` (illustrative templates, labelled) | none | Intentionally template — becomes user-editable input, not a live feed | 🔴 by design |
| Strategic scores (Understand) | Computed (`lib/intelligence/strategic-scores.ts`) | server-rendered | Optionally expose `/api/strategic-scores` for Query-v2 | ✅ computed |
| Board Defence Score | Computed (`lib/decision-intelligence/board-defence-score.ts`) | server-rendered | as-is | ✅ computed |

## Recommended build order (for Claude Code)
1. **Market share + uptake → Prisma.** Create `VendorUptakeSegment` and confirm `MarketShareEstimate` coverage; one migration, one seed import from the existing static files (non-destructive — additive tables only). Expose `/api/uptake` and `/api/market-share`.
2. **Reputation → Prisma** with the same pattern; wire `/api/reputation`.
3. **Pricing route** reading the current static list first (endpoint shape stabilises before the data source changes — frontend repoints once).
4. **Unblock the evidence pipeline** (spend cap) — this converts news, momentum, and seed-confidence rows to live without further schema work.
5. **Server-side shortlist persistence** so Monitor stops depending on sessionStorage.

**Standing rules:** no destructive `prisma/seed.ts` against production; every seeded/modelled row keeps its provenance flag until live data replaces it.
