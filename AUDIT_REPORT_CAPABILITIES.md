# AI Enterprise — Capabilities Surface Audit Report

Date: 2026-05-10
Phase: Master fix prompt pack v1, Phase 5 + Phase 12
Status: partial — schema and rendering enforcement still pending

## What was broken

The `/capabilities` page renders a vendor × capability matrix from the typed
seed module `lib/intelligence/seed-capabilities.ts`. Each cell currently shows
a status + maturity score + simple evidence-grade badge.

Per the master prompt pack §8, every cell needs richer audit-grade metadata:

```
sourceUrl, sourceName, sourceDate, confidenceScore, dataStatus,
freshnessStatus, uncertaintyNote, ProductScope linkage, TruthRecord linkage,
calculation provenance, formula version
```

## What is fixed

- `SeedDataBadge` now visibly screams **NOT LIVE: <source>** in bold red — this propagates to every existing capability cell that uses the badge
- `<NotLiveBanner>` shows globally on `/capabilities` (and every other page) until ≥1 evidence record is analyst-verified or ≥1 proposal approved
- Capability data ingestion is now possible via the `vendorDocs` flow (`lib/sourcing/manifest.ts` + `runner.ts`) — 298 evidence proposals were extracted across 18 vendors during the most recent ingest run
- `EvidenceProposal.subfactor` references capability sub-factors, so approval-time promotion will populate `EvidenceRecord` rows that the capability matrix can read

## What's still seed

- `VendorCapability` schema still has the lighter shape (status / maturityScore / evidenceGrade / lastVerified / notes). Needs upgrade to:
  - `productScopeIds: string[]`
  - `confidenceScore: number`
  - `dataStatus: ModelDataStatus`
  - `freshnessStatus: FreshnessStatus`
  - `sourceIds: string[]`, `sourceUrls: string[]`, `sourceNames: string[]`, `sourceDate: string`
  - `uncertaintyNote: string`
  - `truthRecordIds: string[]`
  - `formulaVersion: string`
  - `calculationTrace: string` (or JSON)
  - `isSeedScore: boolean`, `isCalculated: boolean`, `isVerified: boolean`
- Per-cell UI doesn't yet show: confidence chip, data-status chip, freshness warning, source-link/validation-required, ProductScope mapping
- ProductScope linkage isn't yet enforced as a render gate — capability cells render even when `productScopeIds` is empty

## Tests/build status

- `npm test` → 124/124 across 16 files (was 118 before this session)
- `npx tsc --noEmit` → clean
- No `/capabilities`-specific tests yet (page renders against typed seed only)

## Next steps to close the gap

1. **Schema migration** — extend `VendorCapability` with the 13 new fields (Prisma + types)
2. **Repository upgrade** — `getCapability(vendorId, capabilityId)` joins to `EvidenceRecord` rows by `subfactor` to populate `sourceUrls`/`sourceNames`/`sourceDate`/`isVerified`
3. **Render guard** — capability cell hides when `productScopeIds.length === 0`, shows "Source validation required" instead
4. **UI** — per-cell badges: dataStatus + confidence + freshness warning + source link
5. **Connection panel** — top-of-page strip showing connector status + last fetch + stale source count (already exists at `/admin/data-sources`; surface a read-only summary on `/capabilities` itself)
6. **Tests** — fail when capability lacks source/data-status when meant to render verified

This is a dedicated next-iteration task; the truth scaffolding it depends on
(NotLiveBanner, SeedDataBadge upgrade, evidence proposals in DB, connectors
in place) is now complete.
