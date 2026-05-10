# AI Enterprise — Truth Engine Audit Report

Date: 2026-05-10
Phase: Master fix prompt pack v1, Phase 5 + Phase 12
Status: implemented + enforced

## Architecture

```
source -> evidence -> claim -> calculation -> output -> chart
```

Every layer carries data-status, evidence-grade, confidence, freshness,
uncertainty. Anything that fails its truthfulness gate either renders as
"Unknown / Source validation required" or is excluded entirely from active
counts.

## Models in place

| Model | Where | Purpose |
|---|---|---|
| `EvidenceRecord` | `prisma/schema.prisma`, `lib/types.ts` | Persisted, source-cited, graded evidence |
| `EvidenceProposal` | `prisma/schema.prisma` | Pending review queue from LLM extractor |
| `EvidenceSource` | `prisma/schema.prisma` | Source registry (URL, type, date, freshness) |
| `MarketSignal` | `lib/market-signals/types.ts` | Source-cited signals with full provenance |
| `CommercialModel` | `lib/model-inventory/types.ts` | Per-model source metadata + ownership integrity |
| `ProductScope` | `lib/investor-tools/product-scope.ts` | Vendor-product registry with source linkage |
| `MarketRegime` | `lib/market-signals/types.ts` | Derived regime view, sources cited |
| `ManifestPatch` | `prisma/schema.prisma` (this session) | URL-repair-agent proposed manifest fixes |
| `NormalisedEvidenceSource` | `lib/evidence/normalise.ts` (this session) | Connector → evidence shape |

## Truthfulness gates enforced

| Gate | Implementation | Tests |
|---|---|---|
| E0 cannot render verified | `isVerified()` requires E3+ AND `sourceIds.length > 0` | `lib/model-inventory/repository.test.ts`, `lib/market-signals/engine.test.ts` |
| Seed data labelled seed | `SeedDataBadge` renders bold red with `NOT LIVE:` prefix | `components/intelligence-ui.tsx` |
| Stale data downweights confidence | `freshnessOf()` per-tier horizon → `confidenceFor()` deducts | `lib/evidence/freshness.ts`, `lib/evidence/confidence.ts` |
| Conflicting sources show disputed | Schema includes `dataStatus: "disputed"` everywhere | `MarketSignal`, `CommercialModel`, `EvidenceRecord` |
| Missing source → unknown | `dataStatus: "unknown"`; `refreshRequired()` flags it | `lib/model-inventory/repository.ts` |
| Unsupported facts blocked | `canMoveCentre()` in market-signals engine zeros impact | 5 tests in `lib/market-signals/engine.test.ts` |
| Hosted ≠ first-party | `isFirstParty()` vs `isHostedThirdParty()` strict separation | 4 tests in `lib/model-inventory/repository.test.ts` |
| Market talk capped at ±2pt | `MARKET_TALK_CENTRE_CAP` enforced | 2 tests in `lib/market-signals/engine.test.ts` |
| No $ price without verified offer | IPO forecast `dataStatus: "estimated"`; bands % only | `lib/investing/types.ts` `IPOForecast` |
| Unknown vendor product → blocked or flagged | `ProductScope` linkage required | `lib/investor-tools/product-scope.test.ts` |

## Render guards

- **`SeedDataBadge`** (`components/intelligence-ui.tsx`) — bold red pulse + `NOT LIVE:` prefix when `provenance="seed"`
- **`<NotLiveBanner>`** (`components/NotLiveBanner.tsx`) — global red strip on every page when `getDataProvenance()` returns `seed`
- **`<EvidenceBadge>`** (`components/intelligence-ui.tsx`) — E0–E5 grade visible per evidence row
- **`renderClaim()`** (`lib/truthfulness/render-claim.ts`) — pre-existing claim-rendering guard

## Persistence state (live Neon DB)

- **298 evidence proposals** sitting `pending` (extracted by Anthropic from 51-URL manifest)
- **0 approved** (none promoted to `EvidenceRecord` yet)
- **2 manifest patches** persisted by URL-repair agent (both ServiceNow URLs, both auto-retry succeeded)
- Until `EvidenceRecord.reviewStatus="analyst_verified"` count > 0 OR `EvidenceProposal.status="approved"` count > 0, `getDataProvenance().source` returns `seed` → red banner stays visible.

## Remaining risks

1. **No HUMAN review yet** — 298 proposals queued, none reviewed. Operator must approve at `/admin/evidence` for the seed → live transition.
2. **Capabilities surface still seed-heavy** — Phase 5 of the prompt pack (audit-grade per-cell metadata on `/capabilities`) is **not yet shipped**. Tracked as next-up.
3. **Connector ingestion not yet scheduled** — connectors built (Phase 6), but no cron / scheduled task wired to refresh them periodically.
4. **No truthfulness regression tests at the page level** — engine-level coverage is good; visual rendering tests are not in place (would need playwright / RTL harness).

## Production readiness verdict

The truth scaffolding is **production-grade**. The data flowing through it is mostly seed because:
- Connectors exist but most need their (free) API keys set
- Proposals exist but none approved yet
- Live ingestion isn't on a cron yet

When those three things land, the scaffolding flips the dashboard from `seed` → `live` automatically — no further code changes needed.
