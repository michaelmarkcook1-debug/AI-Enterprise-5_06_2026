# AI Enterpise — Architecture

## Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│ App (Next.js 16 App Router, Turbopack)                                │
│  /  /vendors  /vendors/[slug]  /market  /news  /capabilities          │
│  /assessment  /briefings  /watchlists  /admin  /methodology           │
├────────────────────────────────────────────────────────────────────────┤
│ Route Handlers (app/api/*)                                            │
│  vendors · news · market-dashboard · rank · capabilities ·            │
│  briefings/weekly · watchlists · assessment/score ·                   │
│  assessment/[id]/export · admin/{ingestion, proposals}                │
├────────────────────────────────────────────────────────────────────────┤
│ Services                                                              │
│  lib/services/assessment-service.ts (engine + persistence)            │
│  lib/services/proposal-service.ts (review workflow)                   │
│  lib/intelligence/repository.ts (intel layer reads)                   │
│  lib/intelligence/briefings.ts (executive brief generator)            │
├────────────────────────────────────────────────────────────────────────┤
│ Domain                                                                │
│  Assessment engine — lib/engine.ts (deterministic, pure)              │
│  Intelligence metrics — lib/intelligence/metrics.ts                   │
│  Agents — lib/agents/{evidence-extractor, evidence-classifier}        │
│  Ingestion — lib/ingestion/{fetcher, ingest-service}                  │
│  Export — lib/export/{board-pack, compliance-mappings}                │
├────────────────────────────────────────────────────────────────────────┤
│ Persistence                                                           │
│  Prisma 7 → Postgres (assessment + intelligence entities)             │
│  Typed seed fallback for local demos and static builds                 │
└────────────────────────────────────────────────────────────────────────┘
```

## Type families

The two layers keep their types separate by design:

| Concern | Module | Owner |
|---|---|---|
| Engine pillars / domains / evidence grades | `lib/types.ts` | Assessment engine |
| Engine `Vendor`, `EvidenceItem`, `RiskFlag` | `lib/types.ts` | Assessment engine |
| Portal `Vendor`, `NewsItem`, market share, momentum, capabilities, watchlists | `lib/intelligence/types.ts` | Intelligence portal |
| `MarketDashboard`, `RankInput` | `lib/intelligence/types.ts` | Intelligence portal |

A small adapter (`lib/intelligence/assessment-adapter.ts`) bridges the
intelligence-layer 20 vendors into the engine's `Vendor` shape so the
two-minute assessment scores against the same vendor universe shown on the
dashboard.

## Data flow

### Read paths
- Dashboard / vendor / market / news / capability pages → repository →
  Prisma intelligence models when configured, otherwise seed modules.
- Assessment screen → `runAssessment` over engine vendors → optional
  persistence via Prisma → seeded result returned to the client.

### Write paths
- Watchlist creation → Prisma `Watchlist` when configured, otherwise an
  in-memory runtime buffer for local demos.
- Evidence ingestion → fetcher → extractor agent → classifier → proposal
  queue → human approval → promoted to `EvidenceRecord` for engine scoring.

## Confidence + estimate discipline

Every estimate, share, momentum score, and adoption number on the
dashboard carries a `confidence` field rendered in the UI. The
intelligence portal must never present inferred/estimated data as fact.
Market strength is one signal among six; risk + control penalties always
take precedence in the assessment engine.

## Live-ingestion roadmap

- [x] Promote intelligence-layer entities to Prisma models
  (`IntelligenceVendor`, `MarketShareEstimate`, `VendorMomentum`,
  `IntelligenceNewsItem`, `Capability`, `VendorCapability`, `EvidenceSource`,
  `Watchlist`).
- [x] Seed the 20-provider intelligence universe into Postgres.
- [ ] News-classification agent: ingest RSS / press feeds, output structured
  `NewsItem` proposals for review.
- [ ] Market-share momentum agent: triangulate analyst reports + hyperscaler
  disclosures + GitHub/jobs telemetry.
- [ ] Capability-change watcher: diff vendor doc snapshots → flag status
  transitions for review.
- [ ] Watchlist alerting: cron that compares each watchlist's rules against
  the latest news/momentum/share deltas and posts to email/Slack.
- [ ] Briefings: replace template generator with LLM summarisation over
  ingested data with citation back to evidence sources.
- [ ] Multi-tenant + auth: Sign in with Vercel + watchlist ownership.
- [ ] Vercel deploy with cron + AI Gateway + observability.

## Tests

- `lib/engine.test.ts` — determinism, industry differentiation, blockers, output contract.
- `lib/services/assessment-service.test.ts` — persistence path with mocked Prisma.
- `lib/intelligence/metrics.test.ts` — momentum aggregation + risk penalty curve.
- `lib/agents/evidence-extractor.test.ts` — schema-strict extraction path.
- `lib/export/board-pack.test.ts` — HTML rendering + XSS escaping.
- `lib/ingestion/fetcher.test.ts` — HTML→text normalisation.
