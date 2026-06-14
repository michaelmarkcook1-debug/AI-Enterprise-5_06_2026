# Claude Code Fix Prompt — AI Enterprise Capabilities + Build + Data Connectors

Mike wants this fixed, tested, and made audit-grade.

## Current confirmed blockers

1. Full test suite fails because `lib/prisma.ts` imports `../generated/prisma/client`, but the generated Prisma client is not present.
2. `prisma generate` requires `DATABASE_URL` and may fail in restricted environments because Prisma downloads engine binaries.
3. `npm run build` fails due missing Prisma client and external Google font fetching.
4. `/capabilities` uses seed capability scores with limited evidence metadata.
5. `/capabilities` does not yet render source URL, source name, source date, data status, stale status, uncertainty, confidence, or calculation provenance per capability.
6. The app has a generic ingestion fetcher, but not full free-source connectors.

## Immediate tasks

### 1. Fix build/test reliability

- Add a safe Prisma generation strategy.
- Add `prebuild` and `pretest` if appropriate.
- Ensure `prisma generate` can run in CI/Vercel.
- If Prisma client is unavailable, tests that do not require DB should not fail.
- Consider moving Prisma imports behind dynamic import or DB-only modules so seed-mode tests/builds can pass.
- Remove or self-host `next/font/google` dependencies, or provide local/system fallback so builds do not fail when Google Fonts are unreachable.

Acceptance:
- `npm test` passes.
- `npm run build` passes.
- `npx tsc --noEmit` passes if configured.

### 2. Make `/capabilities` truth-safe

Upgrade `VendorCapability` to include:

- sourceIds
- sourceUrls
- sourceNames
- sourceDate
- confidenceScore
- dataStatus
- freshnessStatus
- uncertaintyNote
- productScopeIds
- truthRecordIds
- formulaVersion
- calculationTrace
- lastVerified

Add UI per capability cell:

- evidence grade badge
- data status badge
- confidence score
- stale warning
- source link or “Source validation required”
- uncertainty note on hover/click
- “Seed score — not verified” where applicable

Acceptance:
- No capability score renders without dataStatus.
- No capability score renders without evidenceGrade.
- No capability score renders as verified unless source metadata exists.
- Seed capability values show seed/estimated labels.

### 3. Add ProductScope mapping

Every capability must map to one or more ProductScope records.

If missing:
- show “Capability cannot be displayed: missing product-scope record”
- do not display as a scored capability

Acceptance:
- every rendered capability has ProductScope linkage
- tests fail when capability lacks ProductScope

### 4. Add calculation provenance

Capability maturity scores should show:

- whether manually seeded or calculated
- input source records
- formula version
- formula summary
- last computed at
- confidence

If still seed:
- display “Seed score — not verified”
- do not allow it to appear as live intelligence

### 5. Add data-source connector scaffolding

Create connector interfaces for:

- SEC EDGAR / data.sec.gov
- FRED
- BLS
- BEA
- EIA
- Treasury Fiscal Data
- Alpha Vantage
- GDELT
- GitHub
- Congress.gov
- Federal Register / Regulations.gov
- Vendor official docs/model catalogue fetcher

Each connector must include:

- health check
- API key detection if required
- fetch function or explicit stub
- normalisation into EvidenceSource/TruthRecord
- rate-limit notes
- stale/freshness classification
- error handling

Do not fake successful connections.

If missing API key:
`Configured: false — API key required`

### 6. Add `/data-sources` or `/admin/data-sources`

Display:

- connector name
- status
- requires API key?
- configured?
- last fetch
- last error
- records fetched
- freshness status
- confidence impact

### 7. Add tests

Add tests for:

- no capability renders as verified without source metadata
- seed scores display seed label
- stale capability displays stale warning
- hosted third-party model not counted as vendor-owned
- ProductScope missing blocks capability display
- Prisma-free seed-mode tests pass
- build does not depend on Google Fonts being reachable
- connector health statuses are truthful
- missing API keys do not pretend to work

## Non-negotiable rule

Do not fabricate live data.

If data is missing, show:

- Unknown
- Source validation required
- Seed data — not verified
- API key required
- Connector not implemented

## Desired final state

The `/capabilities` page should be a truth-safe capability intelligence surface, not a static seed matrix.

Pipeline:

source -> evidence -> claim -> calculation -> output -> chart
