# AI Enterprise Source Audit — Dashboard, Capabilities, Data Integration

Date: 10 May 2026  
Prepared for: Mike

## Live deployment access

The Vercel deployment returned:

```text
HTTP/2 401
_vercel_sso_nonce=...
```

Conclusion: the live deployment is protected by Vercel SSO / deployment protection. External live-page audit is blocked unless protection is removed or an authenticated session is supplied.

## Source package audited

Uploaded package:

```text
/mnt/data/ai-enterpise-source.zip
```

Unpacked audit directory:

```text
/mnt/data/ai-enterpise-source-audit
```

## Commands run

```bash
npm ci --ignore-scripts --no-audit --no-fund --silent
npm test -- --run --reporter=dot
DATABASE_URL='postgresql://user:pass@localhost:5432/db' npm run build
npm test -- --run lib/model-inventory/repository.test.ts lib/truthfulness/render-claim.test.ts lib/investor-tools/product-scope.test.ts lib/investor-tools/state.test.ts lib/market-signals/engine.test.ts --reporter=dot
```

## Test results

Full test suite:

```text
14 test files passed
1 test suite failed
117 tests passed
```

Failure:

```text
Cannot find module '../generated/prisma/client' imported from lib/prisma.ts
```

Targeted non-Prisma tests:

```text
5 test files passed
62 tests passed
```

Targeted passing areas:

- model inventory repository
- truthfulness claim rendering
- investor tools product scope
- investor tools simulation state
- market signals engine

## Build result

Production build failed.

Build blockers:

1. Missing generated Prisma client:

```text
Module not found: Can't resolve '../generated/prisma/client'
```

2. `prisma generate` also failed in this environment because Prisma attempted to fetch engine binaries from:

```text
https://binaries.prisma.sh/...
```

and DNS/network access failed.

3. Next.js Google fonts also failed in this offline environment:

```text
Failed to fetch Cormorant Garamond
Failed to fetch Geist
Failed to fetch Geist Mono
```

This may work on Vercel, but it is a build fragility. For production resilience, use locally hosted fonts or CSS/system-font fallback.

## Dashboard status

`/dashboard` includes:

- market dashboard
- top vendors
- winning/losing vendors
- market movers
- market share by category
- `CommercialModelsCard`

The commercial model inventory feature is materially better than the general capabilities page because it has:

- model source metadata
- ownership separation
- first-party vs hosted third-party logic
- source registry
- evidence grades
- confidence scores
- stale/refresh flags
- tests

## Commercial model inventory audit

Strong points:

- `CommercialModel` includes source/evidence/data-status fields.
- `CommercialModelSource` exists.
- Repository has truth gates:
  - `isVerified`
  - `isFirstParty`
  - `isHostedThirdParty`
  - `isActive`
  - `isStaleModel`
- Hosted third-party models are not counted as first-party.
- Infrastructure-only vendors can show an appropriate state.
- Dashboard card includes source-backed seed inventory label.
- Client UI includes filters for:
  - vendor
  - ownership
  - stage
  - category
  - commercial availability
  - evidence
  - data status

Remaining concern:

The model inventory is still seed/static repository data. It has source URLs, but the code does not yet prove that those sources were fetched or validated live.

Verdict:

```text
Good scaffold. Not yet live-evidence grade.
```

## Capabilities page audit

Current `/capabilities` is weaker.

It renders:

- capability matrix
- vendors
- capability score bars
- evidence badges

But it does not currently render:

- source URL
- source name
- source date
- data status
- stale status
- confidence score
- calculation provenance
- product-scope mapping
- uncertainty note
- seed/static warning per capability cell

The capability data comes from:

```text
lib/intelligence/seed-capabilities.ts
```

Each `VendorCapability` has:

- vendorId
- capabilityId
- status
- maturityScore
- evidenceGrade
- lastVerified
- notes

But it lacks:

- sourceIds
- sourceUrls
- sourceNames
- productScopeIds
- confidenceScore
- dataStatus beyond limited EvidenceStatus
- freshnessStatus
- formulaVersion
- calculationTrace
- truthRecordIds

Verdict:

```text
/capabilities is not audit-grade yet. It is a seed capability matrix with evidence badges, not a source-backed capability intelligence surface.
```

## Data connections audit

Current implemented connection layer:

- Generic `fetchSource(url)` for HTML/JSON/text fetching.
- Generic ingestion service that fetches vendor sources and passes content to evidence extraction.
- Market Signals engine exists but uses seed signals.
- Truthfulness registry exists but mostly references prompt-pack seed controls.
- Evidence and claim API routes exist.
- Admin ingestion routes exist.
- Prisma schema includes database models for vendors/evidence/scoring/etc.

Missing or incomplete data connectors:

- SEC EDGAR / `data.sec.gov`
- FRED
- BLS
- BEA
- EIA
- Treasury Fiscal Data
- Alpha Vantage
- GDELT
- GitHub API
- Congress.gov
- Federal Register / Regulations.gov
- vendor model catalogue live/API verification
- pricing page ingestion
- trust centre ingestion
- subprocessor page ingestion
- product release/changelog ingestion
- data source status dashboard

Current state:

```text
The app has the architecture to ingest sources, but not the full free-source connector suite.
```

## Calculation audit

Known calculation components:

- market intelligence metrics
- model inventory ownership/verification counters
- truthfulness render guard
- investor simulation state
- market signals engine
- assessment scoring engine

Capabilities score issue:

The capability maturity scores are manually seeded. They are not yet calculated from product-scope evidence, source freshness, verified feature status, or tests.

Required future state:

```text
capabilityScore = productScopeEvidence + capabilityStatus + sourceFreshness + sourceConfidence + testEvidence + uncertaintyPenalty
```

## Production blockers

### Blocker 1 — generated Prisma client missing

Current import:

```ts
import { PrismaClient } from "../generated/prisma/client";
```

But generated Prisma client is not present in the source package.

Fix options:

1. Add `prebuild` and `pretest` scripts to run `prisma generate`.
2. Ensure Vercel can run `prisma generate`.
3. Do not rely on committed generated client unless intentionally versioned.
4. If generated client cannot be generated in CI, add a Prisma-free seed fallback path for all no-DB routes/tests.
5. Fix `prisma.config.ts` so `DATABASE_URL` is not required just to generate in non-DB test contexts, if feasible.

### Blocker 2 — Google fonts create offline build fragility

Current build fails when Google font fetch is blocked.

Fix options:

1. Use system font fallback.
2. Self-host fonts.
3. Avoid `next/font/google` for production-critical builds.
4. Add local fallback if Google fetch fails.

### Blocker 3 — `/capabilities` lacks full Truth Engine data

The current page is useful visually but not production truth-safe.

Required fix:

Every capability cell must include source/evidence/data-status metadata or show unknown/source validation required.

## Recommended fix order

1. Fix Prisma generation/build path.
2. Remove external Google-font build dependency or self-host fonts.
3. Upgrade `VendorCapability` type to include source/evidence/truth metadata.
4. Add ProductScope mapping to capabilities.
5. Add `/capabilities` data-status/source/confidence/stale/uncertainty UI.
6. Add capability calculation provenance.
7. Add data-source status panel.
8. Add first connector suite:
   - SEC
   - FRED
   - BLS
   - EIA
   - Alpha Vantage
   - GDELT
   - GitHub
   - vendor docs/model catalogue fetcher
9. Add tests for source-backed capability rendering.
10. Redeploy with Vercel protection disabled for external audit, or share authenticated preview flow.

## Hard conclusion

AI Enterprise is progressing well structurally, especially around the model inventory and investor tools. But `/capabilities` still needs the truth/evidence layer applied properly.

The product is not yet “live data intelligence.” It is currently:

```text
seed intelligence + some truth-safe scaffolding + partial model inventory provenance
```

To become audit-grade:

```text
source -> evidence -> claim -> calculation -> output -> chart
```

must be enforced across `/capabilities`, not only in model inventory.
