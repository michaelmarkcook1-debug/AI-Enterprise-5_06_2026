# AI Enterpise

> Executive market intelligence portal for enterprise AI: vendor rankings, market share, agentic momentum, news, capabilities, and platform-fit assessment.
>
> **Note:** the product name is intentionally `AI Enterpise` (no second "r" yet).

## What's in here

The app has two layers:

1. **Assessment engine** (`lib/engine.ts`, `lib/types.ts`) — deterministic, evidence-weighted ranking based on the v2.0 12-domain framework. Persists vendor profiles, evidence, assessment runs and scoring results through Prisma.
2. **Intelligence portal** (`lib/intelligence/*`) — the executive dashboard, vendor profiles, news intelligence, market tracker, capability tracker, briefings and watchlists. Reads from Prisma/Postgres when configured and falls back to typed seed data for local demos.

## Local setup

```bash
npm install
DATABASE_URL=postgres://placeholder npx prisma generate   # generates ./generated/prisma client
npm test                                                   # 25/25 tests
ADMIN_API_OPEN=1 npm run dev                              # http://localhost:3000
```

The app runs **without a database**. The assessment engine + intelligence portal both fall back to seed data when `DATABASE_URL` is unset, so the executive dashboard, vendor pages, news, market tracker, capability matrix, briefings and watchlist forms all work end-to-end on a fresh checkout.

For full persistence:

```bash
DATABASE_URL=postgres://… npx prisma migrate deploy
DATABASE_URL=postgres://… npm run db:seed
ADMIN_API_OPEN=1 ANTHROPIC_API_KEY=… npm run dev
```

## Pages

| Route | Description |
|---|---|
| `/` | Executive market dashboard — top vendors, winners/losers, weekly movers, agentic momentum, risk alerts, sector leaders, recent news. |
| `/vendors` | Vendor universe with filters; cards link to deep profiles. |
| `/vendors/[slug]` | Provider intelligence page — overview, strategy, controls, agentic posture, industry strength, capability matrix, news timeline, evidence/confidence, AnalystGenius interpretation. |
| `/market` | Category-specific market share + momentum tracker (10 categories, never one generic share). |
| `/news` | Classified news feed: vendor / category / date / source / impact / confidence / affected pillars / suggested score impact. |
| `/capabilities` | Capability matrix across the 10 capability families × selected vendors with status + evidence grade. |
| `/assessment` | The two-minute platform-fit assessment (formerly `/assess`, now redirected). Returns ranked vendors with full drill-down + export. |
| `/briefings` | Executive briefings: weekly market, vendor, industry, board, competitive landscape, watchlist. |
| `/watchlists` | Create + manage watchlists for vendors / categories / industries / news / risk / regulation. |
| `/investor-tools` | Investor Tools cockpit: investment intelligence, public AI stocks, IPO Watch, indirect exposure, simulator, briefings, and watchlist. |
| `/investor-tools/ipo-watch` | Modelled IPO forecast monitor with evidence quality, disabled states, missing-data checklist, and percentage-only post-IPO bands. |
| `/investor-tools/ipo-watch/[providerSlug]` | Provider IPO forecast detail page. No dollar price path is rendered unless a verified offer price exists. |
| `/methodology` | Public methodology page. |
| `/admin` | Admin console (ingestion + evidence review). |

## API surface

| Method | Path | Description |
|---|---|---|
| GET  | `/api/vendors` | List intelligence vendors. |
| GET  | `/api/vendors/[id]` | Vendor profile. |
| GET  | `/api/news` | News feed. |
| GET  | `/api/market-dashboard` | Composed dashboard payload. |
| POST | `/api/rank` | Lightweight ranking using intelligence-layer scores. |
| GET  | `/api/capabilities` | Capability matrix. |
| GET  | `/api/briefings/weekly` | Generated weekly market brief. |
| GET  | `/api/watchlists` | List watchlists. |
| POST | `/api/watchlists` | Create a watchlist. |
| GET  | `/api/investor-tools/nav` | Investor Tools dropdown model. |
| GET  | `/api/investor-tools/intelligence` | Investor Tools dashboard payload. |
| GET  | `/api/investor-tools/ipo-watch` | IPO forecast monitor with evidence quality and bands. |
| GET  | `/api/investor-tools/ipo-watch/[providerSlug]` | Provider IPO forecast, evidence panel, bands and missing-data checklist. |
| GET  | `/api/investor-tools/product-scope` | Product Scope Registry seed records. |
| POST | `/api/investor-tools/simulator/filter-universe` | Universe filtering for simulator inputs. |
| POST | `/api/investor-tools/simulator/apply-shock` | Shock application and recalculated simulator state. |
| POST | `/api/investor-tools/simulator/validate-cross-feed` | Cross-feed integrity validation. |
| GET  | `/api/truth/claims` | Truth Engine claims and TruthRecords. |
| POST | `/api/truth/validate` | Claim support validation. |
| POST | `/api/assessment/score` | Run the deterministic assessment engine. |
| POST | `/api/assessment/[id]/export` | Export board pack / compliance pack / JSON. |
| POST | `/api/admin/ingestion/run` | Trigger evidence ingestion (LLM extractor). |
| GET  | `/api/admin/ingestion/jobs` | Recent ingestion jobs. |
| GET  | `/api/admin/proposals` | Pending evidence proposals. |
| PATCH | `/api/admin/proposals/[id]` | Approve / reject a proposal. |

## Data model summary

Two type families:

- **Assessment-engine types** (`lib/types.ts`): `PillarId`, `DomainId`, `EvidenceGrade`, `AssessmentInput`, `AssessmentResult`, `Vendor` (engine-internal). Persisted via Prisma (`prisma/schema.prisma`).
- **Intelligence types** (`lib/intelligence/types.ts`): `Vendor` (portal-facing), `VendorPillarScore`, `MarketCategory`, `MarketShareEstimate`, `VendorMomentum`, `NewsItem`, `Capability`, `VendorCapability`, `Watchlist`, `EvidenceSource`, `MarketDashboard`. Seeded into Prisma by `prisma/seed.ts` and exposed through `lib/intelligence/repository.ts`.

## Scoring

```
Final Vendor Score =
  Σ(Pillar Score × Dynamic Context Weight × Evidence Confidence)
  + Strategic Fit Bonus
  + Sector Adoption Fit Bonus
  − Risk Penalties
  − Missing Evidence Penalty
  − Adoption Friction Penalty
```

Evidence grading:

| Grade | Modifier | Meaning |
|---|---|---|
| E0 | 0.0 | No evidence |
| E1 | 0.4 | Vendor claim only |
| E2 | 0.6 | Public documentation |
| E3 | 0.75 | Public test / API verification |
| E4 | 0.9 | Production customer evidence |
| E5 | 1.0 | Independent audit / verified benchmark |

## Tests (25/25)

- Engine determinism, industry differentiation, evidence integrity, fatal blockers, output contract.
- Intelligence metrics: momentum aggregation, risk-penalty curve, news-classification helpers.
- Evidence extractor schema (stub fallback path).
- Board pack rendering + XSS escaping.
- HTML→text fetcher normalisation.

```bash
npm test
```

## Scripts

```bash
npm run dev          # local dev (port 3000)
npm run build        # production build
npm test             # vitest
npm run lint         # eslint
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:deploy    # prisma migrate deploy
npm run db:seed      # seed assessment + intelligence portal tables
```

## Documentation

- `ARCHITECTURE.md` — system architecture, intelligence-layer data flow, live-ingestion roadmap.
- `app/methodology/page.tsx` — public methodology page mirroring the v2.0 framework.
- `enterprise_ai_platform_ranking_engine_product_spec.docx` (parent dir) — full spec.

## Critical guardrails

The dashboard and vendor profiles surface estimates and momentum signals — every estimate carries a confidence indicator. Market strength **does not** override enterprise-control, security, permissioning or governance risks. The first-screen UX stays simple; deep regulatory mapping, automatic fail conditions, full evidence packs, gold-set testing, and due-diligence questionnaires remain available via the assessment engine and admin console.

## Investor Tools truth rules

Investor Tools is a market-intelligence and hypothetical scenario module, not financial advice. IPO forecast windows and post-IPO bands are modelled estimates only. The app must not show unsupported IPO dates, valuations, offer prices, share prices, filing status, lock-up terms, or return guarantees as fact.

Current IPO forecast seed data is deliberately labelled `estimated`, `seed`, `unknown`, or disabled. Post-IPO bands are percentages relative to the IPO offer price; they are not dollar share-price predictions. Disabled providers such as Hebbia, Rogo, and xAI standalone show “no reliable forecast” states until credible standalone filing/process evidence is available.

Live ingestion TODO:

- Replace seed IPO forecasts with source-backed records from S-1/F-1 filings, official filing notices, reputable reporting, underwriter/roadshow evidence, price ranges, float, lock-up terms, audited financials, and first earnings dates.
- Refresh IPO rumour data weekly while active.
- Keep unsupported claims hidden or labelled “Unknown” / “Requires validation.”
