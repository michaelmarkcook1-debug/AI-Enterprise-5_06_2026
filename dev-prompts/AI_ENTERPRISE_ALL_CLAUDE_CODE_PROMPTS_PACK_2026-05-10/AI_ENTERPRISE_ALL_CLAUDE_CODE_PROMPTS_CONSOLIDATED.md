# AI Enterprise — All Claude Code Prompts Consolidated

Prepared for: Mike



---

## EXECUTION_ORDER.md

# Execution Order for Claude Code

## Stage 1 — Stabilise

Run first:

1. `stage_1_batch/01_MASTER_CONTEXT_PROMPT.md`
2. `stage_1_batch/02_TASK_1_BUILD_TEST_STABILISATION.md`
3. `stage_1_batch/03_TASK_2_CAPABILITIES_AUDIT.md`
4. `stage_1_batch/04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md`
5. `stage_1_batch/05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md`
6. `stage_1_batch/06_TASK_5_CONNECTOR_SCAFFOLD.md`

Stop after each task and ask Claude Code for:

```text
1. files changed
2. commands run
3. test/build result
4. remaining risks
5. whether next task is safe
```

## Stage 2 — Master fix pack

Use:

`master_fix_pack/AI_ENTERPRISE_CLAUDE_CODE_MASTER_FIX_PROMPT_PACK_2026-05-10.md`

This consolidates the broader work after Stage 1.

## Stage 3 — Specialist packs

Use only after Stage 1 is clean:

- Commercial LLM Models dashboard
- Investor Tools
- IPO Forecasting
- Market Signals Engine

## Switch to Codex only when

- `npm test` passes
- `npm run build` passes
- TypeScript passes
- Truth Engine helpers exist and are tested
- ProductScope is enforced
- `/capabilities` renders truth-safe data
- connector scaffold exists
- data-source status page exists
- seed data is visibly labelled


---

## README.md

# AI Enterprise — Complete Claude Code Prompt Pack

Prepared for: Mike  
Date: 10 May 2026  
Timezone: Europe/London

## Purpose

This pack consolidates the Claude Code-ready prompts created for AI Enterprise so far.

It includes prompts for:

- Stage 1 stabilisation
- Build/test hardening
- Prisma and font fragility fixes
- `/capabilities` audit and truth-safe upgrade
- Truth Engine implementation
- ProductScope registry
- Commercial LLM Models dashboard
- Free/official data connectors
- Investor Tools and Investment Simulator fixes
- IPO forecasting and post-IPO fluctuation modelling
- Market Signals Engine
- Zero-hallucination and evidence governance

## Recommended order

1. `stage_1_batch/01_MASTER_CONTEXT_PROMPT.md`
2. `stage_1_batch/02_TASK_1_BUILD_TEST_STABILISATION.md`
3. `stage_1_batch/03_TASK_2_CAPABILITIES_AUDIT.md`
4. `stage_1_batch/04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md`
5. `stage_1_batch/05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md`
6. `stage_1_batch/06_TASK_5_CONNECTOR_SCAFFOLD.md`
7. `master_fix_pack/AI_ENTERPRISE_CLAUDE_CODE_MASTER_FIX_PROMPT_PACK_2026-05-10.md`
8. `capabilities_and_connectors/AI_ENTERPRISE_CLAUDE_CODE_CAPABILITIES_FIX_PROMPT_2026-05-10.md`
9. `commercial_models_dashboard/ai_enterprise_claude_code_commercial_models_dashboard_prompt_v2.txt`
10. `investor_tools/ai_enterprise_investor_tools_truth_engine_combined_prompt_pack.txt`
11. `investor_tools/ai_enterprise_combined_investor_tools_truth_engine_ipo_forecast_prompt_pack.txt`
12. `market_signals/ai_enterprise_market_signals_engine_investor_tools_addendum.txt`

## Coaching rule

Use Claude Code for the repair and architecture-stabilisation work first:

```text
source → evidence → claim → calculation → output → chart
```

Switch to Codex only after build, tests, Truth Engine, ProductScope, `/capabilities`, and connector scaffolding are stable.

## Non-negotiable

No prompt in this pack should be used to fabricate live data. All seed, inferred, estimated, stale, or unsupported values must be clearly labelled.


---

## audits/AI_ENTERPRISE_SOURCE_AUDIT_REPORT_2026-05-10.md

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


---

## capabilities_and_connectors/AI_ENTERPRISE_CLAUDE_CODE_CAPABILITIES_FIX_PROMPT_2026-05-10.md

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


---

## capabilities_and_connectors/ai_enterprise_capabilities_data_audit_and_free_connectors_prompt.txt

AI ENTERPRISE — FULL DATA CONNECTION AUDIT + FREE SOURCE IMPLEMENTATION PROMPT
================================================================================
Date: 9 May 2026
Timezone: Europe/London
Prepared for: Mike

Purpose
-------
This prompt is for Claude Code / Codex / development agents working inside AI Enterprise.

It audits the current data posture and instructs agents to replace seed/static capability data with source-backed integrations wherever free or official data sources exist.

Critical premise:
AI Enterprise must not present static seed data as live intelligence. Every dashboard, capability, assessment, investor, simulator, news, model inventory, and briefing output must be backed by a source, evidence grade, confidence score, freshness status, and data-status label.

The deployed /capabilities page must be audited and converted from a static capability table into a live/source-backed capability intelligence surface.

================================================================================
SECTION 1 — LIVE URL AUDIT LIMITATION
================================================================================

The product owner asked to audit:
https://ranking-engine-greix3nc5-michaelmarkcook1-debugs-projects.vercel.app/capabilities

If a development agent can access the URL locally or in Vercel, run the live audit below.

If the URL is not reachable from the agent environment:
- do not invent observations
- inspect the codebase instead
- run local app
- run API tests
- compare rendered /capabilities output against data repositories
- mark live-browser audit as blocked

Required audit modes:
1. Live deployed audit
2. Local app audit
3. API/data route audit
4. Repository/data-source audit
5. Calculation audit
6. Truth/evidence audit

================================================================================
SECTION 2 — WHAT TO TEST ON /capabilities
================================================================================

Audit /capabilities for:

1. Data source type
- Is it using static seed JSON?
- Is it using a database?
- Is it using live source connectors?
- Is it using official vendor docs?
- Is it using model APIs?
- Is it using old scraped data?
- Is it mixing seed and live data without labels?

2. Capability correctness
Every displayed capability must have:
- vendorId
- vendorName
- productScopeId
- capabilityName
- capabilityCategory
- capabilityStatus
- maturityScore
- evidenceGrade
- confidenceScore
- sourceIds
- sourceUrls
- lastVerifiedAt
- freshnessStatus
- uncertaintyNote

3. Product scope alignment
Every capability must map to a product in ProductScopeRegistry.

If a capability appears without a ProductScopeRegistry entry:
Show error:
“Capability cannot be displayed: missing product-scope record.”

4. Evidence status
Capabilities must display one of:
- verified
- documented
- tested
- estimated
- inferred
- seed
- stale
- unknown
- disputed

5. Ownership distinction
For model/platform capabilities:
- first-party model
- hosted third-party model
- marketplace model
- orchestration layer
- infrastructure exposure
must be separated.

Example:
AWS hosting Claude on Bedrock is not AWS owning Claude.
Azure hosting OpenAI/Anthropic/xAI models is not Microsoft owning those models.
Oracle hosting Cohere/Mistral/xAI models is not Oracle owning those models.

6. Score calculation
Check whether maturity scores and confidence scores are:
- calculated
- manually seeded
- inferred
- tested
- verified

If a score is not calculated, mark:
“Seed score — not verified.”

7. Data freshness
Any capability older than freshness window must show stale.

Recommended freshness windows:
- model availability: 14-30 days
- vendor capability/product docs: 30-90 days
- market share/adoption: 30-90 days
- public financials: after each quarterly release
- IPO rumours: 7 days
- pricing pages: 14-30 days
- trust/security docs: 90 days unless changed

8. UI honesty
No card, graph, or table may imply “current live market truth” if data is static.

================================================================================
SECTION 3 — DATA REQUIREMENT MAP
================================================================================

AI Enterprise data needs fall into these groups:

A. Vendor/Product/Capability Data
B. Commercial model inventory
C. Security/trust/privacy/governance data
D. Market-share/adoption data
E. News/functionality intelligence
F. Financial fundamentals
G. Public stock prices and market data
H. Macro/economic regime data
I. Political/regulatory signals
J. Energy/infrastructure signals
K. Developer/community signals
L. IPO/private-company data
M. Investment simulator assumptions
N. Evidence/claim registry

Each group needs source-backed connectors.

================================================================================
SECTION 4 — FREE / OFFICIAL DATA CONNECTIONS
================================================================================

Implement connectors in priority order.

4.1 SEC EDGAR / data.sec.gov
----------------------------
Use for:
- public-company filings
- 10-K / 10-Q / 8-K / S-1 / 20-F / 6-K
- XBRL financial facts
- RPO/backlog where tagged
- revenue, margins, cash flow, capex
- IPO filings
- company metadata and ticker/CIK mapping

Connection:
- data.sec.gov/submissions/CIK##########.json
- data.sec.gov/api/xbrl/companyfacts/CIK##########.json
- data.sec.gov/api/xbrl/companyconcept/CIK##########/{taxonomy}/{tag}.json

Requirements:
- set compliant User-Agent header
- respect SEC fair access
- cache responses
- store source URLs
- evidenceGrade E5 for filings and XBRL facts
- freshness high for recent filings

4.2 FRED API
------------
Use for:
- interest rates
- Fed funds
- treasury yields
- unemployment
- CPI/PCE series where available
- financial conditions
- VIX if available via FRED series
- macro regime

Connection:
- https://api.stlouisfed.org/fred/series/observations
- requires FRED API key
- supports json via file_type=json
- use series IDs such as DFF, SOFR, DGS10, UNRATE, CPIAUCSL, PCEPI, GDP, NFCI where relevant

Store:
- series_id
- observations
- date
- value
- source
- confidence

4.3 BLS Public Data API
-----------------------
Use for:
- CPI
- PPI
- unemployment
- payrolls
- labour costs
- wages
- employment sectors

Connection:
- https://api.bls.gov/publicAPI/v2/timeseries/data/
- v1 can be used without registration for simpler/recent series
- v2 registration improves limits and features

Store:
- seriesID
- year
- period
- value
- footnotes

4.4 BEA API
-----------
Use for:
- GDP
- personal consumption
- business investment
- industry GDP
- fixed investment
- national accounts
- regional economic data

Connection:
- BEA API requires key/registration
- use BEA datasets/methods for NIPA, GDP, Regional, Industry, Fixed Assets

Store:
- dataset
- table
- line item
- period
- value

4.5 EIA API
-----------
Use for:
- electricity prices
- power generation
- natural gas
- energy prices
- grid/power signals
- data-centre energy constraint proxy

Connection:
- EIA API v2
- API key required
- examples under api.eia.gov/v2

Store:
- dataset route
- frequency
- period
- value
- geography

4.6 Treasury Fiscal Data API
----------------------------
Use for:
- Treasury yields/interest costs where applicable
- federal debt
- fiscal conditions
- public finance signals
- exchange rates where Treasury rates are useful

Connection:
- https://api.fiscaldata.treasury.gov/services/api/fiscal_service/
- no API key required
- supports JSON/CSV/XML

4.7 Alpha Vantage
-----------------
Use for:
- public stock prices
- daily time series
- company overview
- income statement / balance sheet / cash flow
- market news and sentiment
- top gainers/losers
- market status
- fundamentals
- some options data depending tier

Connection:
- requires free API key
- https://www.alphavantage.co/query
- functions:
  - TIME_SERIES_DAILY
  - GLOBAL_QUOTE
  - OVERVIEW
  - INCOME_STATEMENT
  - BALANCE_SHEET
  - CASH_FLOW
  - NEWS_SENTIMENT
  - TOP_GAINERS_LOSERS
  - MARKET_STATUS
  - LISTING_STATUS

Caution:
- free tier may be rate limited
- realtime/advanced options may require paid plan
- label data freshness and entitlement

4.8 GDELT DOC / Context APIs
----------------------------
Use for:
- broad public news signal monitoring
- market talk proxy
- geopolitical/regulatory media signal
- vendor news velocity
- event detection
- entity news timeline

Connection:
- GDELT DOC 2.0 API supports JSON output
- GDELT Context 2.0 API supports sentence-level snippets

Caution:
- use as signal source, not factual proof
- confidence medium/low unless corroborated
- do not let GDELT alone establish factual claims

4.9 GitHub REST API
-------------------
Use for:
- open-source repo activity
- developer adoption signals
- commit velocity
- releases
- forks/stars/issues where relevant
- public SDK activity
- open-source model/tool maturity

Connection:
- GitHub REST API
- stats endpoints may return 202 while computing
- unauthenticated access possible for public resources but rate limited
- authenticated token improves rate limit

Use for:
- Mistral open model repos if relevant
- OpenAI/Anthropic/Google/AWS SDKs
- MLflow/Databricks public projects
- model/tool ecosystem proxies

4.10 Congress.gov API
---------------------
Use for:
- US legislative signals affecting AI, chips, privacy, export controls, public procurement
- congressional bills/resolutions

Connection:
- https://api.data.gov/congress/v3
- requires data.gov API key
- JSON/XML

4.11 Federal Register / Regulations.gov
---------------------------------------
Use for:
- regulatory proposals
- executive orders
- federal AI rules
- agency notices
- export-control notices
- public comments

Connections:
- Federal Register API
- Regulations.gov API may require API key

4.12 Official Vendor Docs / Model Catalogues
--------------------------------------------
Use for:
- commercial model inventory
- model availability
- product capability
- enterprise controls
- pricing pages
- trust centres
- subprocessor lists
- API docs
- changelogs/release notes

Connection type:
- official docs scraper
- RSS where available
- sitemap crawl where permitted
- API endpoints where available

Priority official model sources:
- OpenAI model docs and /v1/models
- Anthropic /v1/models
- Google Gemini API model docs
- Google Vertex AI model docs
- Mistral model docs / list models API
- Cohere model docs
- xAI model docs
- AWS Bedrock model catalogue
- Azure AI Foundry model catalogue
- IBM watsonx foundation model docs
- Oracle OCI Generative AI model docs
- Salesforce Agentforce supported model docs
- ServiceNow LLM docs
- Writer model docs
- Glean LLM admin docs
- Harvey model-use docs
- NVIDIA NIM/AI Enterprise docs

4.13 Company IR / Press / Trust Sources
---------------------------------------
Use for:
- official product announcements
- earnings releases
- revenue/RPO/backlog
- pricing changes
- trust/security claims
- compliance claims
- subprocessor lists
- data handling claims

Connection:
- official company RSS if present
- investor relations pages
- press release feeds
- trust centre scraping

Evidence:
- official company sources are documented but not necessarily independently verified
- evidenceGrade usually E2/E3, filings E5

================================================================================
SECTION 5 — DATA CONNECTION ARCHITECTURE
================================================================================

Create these layers:

1. Connector Layer
Each connector fetches raw source data:
- secConnector
- fredConnector
- blsConnector
- beaConnector
- eiaConnector
- fiscalDataConnector
- alphaVantageConnector
- gdeltConnector
- githubConnector
- regulatoryConnector
- vendorDocsConnector

2. Normalisation Layer
Transforms raw data into:
- EvidenceSource
- TruthRecord
- MarketSignal
- FinancialMetric
- ProductScopeItem
- CommercialModel
- CapabilityRecord
- NewsSignal
- InvestmentSignal

3. Evidence Layer
Assigns:
- evidenceGrade
- confidenceScore
- dataStatus
- freshnessStatus
- uncertaintyNote

4. Calculation Layer
Computes:
- capability maturity
- vendor momentum
- market regime
- investment score
- IPO forecast
- post-IPO bands
- simulator scenarios
- risk-return scatter data
- confidence heatmaps

5. Cross-Feed Validation Layer
Checks:
- input -> calculation -> output consistency
- stale chart data
- missing source records
- outdated seed data
- invalid portfolio universe
- unsupported claim rendering

6. UI Rendering Layer
All UI components must use truth-safe rendering:
- badge status
- confidence
- source tooltip
- uncertainty note
- freshness warning

================================================================================
SECTION 6 — CAPABILITIES PAGE TARGET STATE
================================================================================

The /capabilities page should not just show a static list.

It should show:

1. Capability Overview
- total vendors tracked
- products in scope
- capabilities tracked
- verified capabilities
- documented capabilities
- seed/inferred capabilities
- stale capabilities
- unknown capabilities

2. Capability Matrix
Rows:
- vendors/products

Columns:
- models
- assistant
- RAG/knowledge
- agents
- governance
- security
- integrations
- cost controls
- deployment
- portability
- investor data
- IPO signals

Each cell:
- score
- evidence grade
- confidence
- status
- last verified
- source link

3. Capability Drilldown
On click:
- capability description
- product scope mapping
- evidence records
- calculation method
- current source
- stale/uncertainty warnings
- vendor-owned vs hosted/orchestrated distinction

4. Connection Status Panel
Show:
- source connector status
- last successful fetch
- next refresh
- failures
- stale source count
- missing source count

5. Data Integrity Panel
Show:
- seed data still in use
- unsupported claims blocked
- stale data blocked
- cross-feed errors
- failed connectors
- confidence distribution

================================================================================
SECTION 7 — CALCULATION AUDIT REQUIREMENTS
================================================================================

Audit and test all calculations:

Capability maturity:
- input: product scope + evidence + feature status + source freshness
- output: maturityScore 0-100
- must show formula

Evidence confidence:
- input: evidenceGrade + sourceType + freshness + corroboration
- output: confidenceScore 0-100

Market momentum:
- input: news velocity + product release velocity + adoption proxies + customer signals + financial signals
- output: momentumScore

Investment scoring:
- input: AI provider quality + financials + valuation + catalysts + risk + confidence
- output: investmentAttractivenessScore

IPO forecast:
- input: evidence quality + funding + financial readiness + rumour quality + market regime
- output: estimated window, not factual date

Simulator:
- input: selected vendors + universe + allocation + shocks + assumptions
- output: scenario paths, risk score, drawdown, scatter chart

Every calculation should store:
- input snapshot
- formula version
- output value
- confidence
- stateHash
- calculation timestamp

================================================================================
SECTION 8 — CLAUDE CODE IMPLEMENTATION PROMPT
================================================================================

Use this task inside Claude Code:

You are inside the AI Enterprise codebase. Run a full audit of /capabilities and the platform data integrations.

Do not invent findings. If the deployed URL is unreachable, say so and audit the codebase/local app instead.

Tasks:
1. Inspect /capabilities route and components.
2. Identify all data sources used by /capabilities.
3. Identify all seed/static JSON used.
4. Identify any API routes used by /capabilities.
5. Identify any calculations used for capability scores.
6. Check whether every displayed capability maps to a ProductScope record.
7. Check whether every displayed capability has EvidenceSource/TruthRecord metadata.
8. Check whether every score has a formula and calculation provenance.
9. Check whether stale/seed/estimated data is labelled in UI.
10. Check whether hosted third-party models are separated from first-party models.
11. Check whether capability counts exclude unknown/deprecated/hosted-third-party where appropriate.
12. Run npm test.
13. Run npm run build.
14. Run npx tsc --noEmit if configured.
15. Produce AUDIT_REPORT_CAPABILITIES.md with:
    - passed checks
    - failed checks
    - unsupported claims
    - seed data still used
    - missing connectors
    - broken calculations
    - stale data risks
    - recommended fixes
16. Implement fixes where safe:
    - add data-status badges
    - add source/evidence display
    - add product-scope validation
    - add connection status panel
    - add tests
17. Do not remove existing features.
18. Do not fabricate live data.

Acceptance criteria:
- /capabilities renders.
- every displayed capability has dataStatus.
- every displayed capability has evidenceGrade.
- every displayed capability has source metadata or Unknown/Requires validation.
- build passes.
- tests pass.
- audit report is written.

================================================================================
SECTION 9 — FREE DATA SOURCE CONNECTION PROMPT
================================================================================

Use this task after the audit:

Implement the first version of AI Enterprise free data connectors.

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
- Vendor official docs/model catalogue scrapers

Do not require every connector to be fully working on first pass.
Implement:
- connector interface
- environment variable config
- health check
- fetch stub or working minimal fetch
- response normalisation
- EvidenceSource creation
- TruthRecord creation
- error handling
- rate-limit awareness
- freshness status
- tests for at least connector health and normalisation

Required files:
- lib/connectors/types.ts
- lib/connectors/sec.ts
- lib/connectors/fred.ts
- lib/connectors/bls.ts
- lib/connectors/eia.ts
- lib/connectors/alphaVantage.ts
- lib/connectors/gdelt.ts
- lib/connectors/github.ts
- lib/connectors/vendorDocs.ts
- lib/evidence/normalise.ts
- lib/evidence/freshness.ts
- lib/evidence/confidence.ts
- app/api/data-sources/status/route.ts
- app/api/data-sources/refresh/route.ts

Add /data-sources or advanced /admin/data-sources page if quick.

Show:
- connector name
- status
- requires API key?
- last fetch
- last error
- records fetched
- confidence impact
- freshness status

Do not fake successful connections.
If missing API key, show:
“Configured: false — API key required.”

================================================================================
SECTION 10 — ENVIRONMENT VARIABLES
================================================================================

Recommended env vars:

FRED_API_KEY=
BLS_API_KEY=
BEA_API_KEY=
EIA_API_KEY=
ALPHA_VANTAGE_API_KEY=
CONGRESS_API_KEY=
GITHUB_TOKEN=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
MISTRAL_API_KEY=
COHERE_API_KEY=
XAI_API_KEY=
SEC_USER_AGENT="AI Enterprise contact@example.com"

Rules:
- do not commit real keys
- docs should explain which are optional
- official docs scraping should work without API keys where pages are public
- model API endpoints require vendor keys
- no key means connector status = not_configured

================================================================================
SECTION 11 — PRODUCTION DATA PRIORITY
================================================================================

Priority 1 — Truth engine and source metadata
- EvidenceSource
- TruthRecord
- dataStatus badges
- seed/stale labels
- unsupported claim blocking

Priority 2 — Model/product/capability data
- official vendor docs
- model catalogues
- ProductScope registry
- CommercialModel inventory

Priority 3 — Financial and investment data
- SEC
- Alpha Vantage
- company IR pages
- earnings releases

Priority 4 — Macro and market regime
- FRED
- BLS
- BEA
- Treasury
- EIA

Priority 5 — News and signals
- GDELT
- company news
- regulatory feeds

Priority 6 — Community/developer adoption
- GitHub
- review/marketplace proxies
- job postings if later implemented

================================================================================
SECTION 12 — HARD TRUTH
================================================================================

If /capabilities currently renders seed data without source metadata, it is not ready.

If scores are manually assigned without calculation provenance, they are not audit-grade.

If model ownership is not separated from hosting, the product will mislead executives.

If investment simulator outputs are not linked to evidence and market signals, they are scenario toys, not intelligence.

The immediate objective is not to add more charts.
The immediate objective is to wire truthful data flow:
source -> evidence -> claim -> calculation -> output -> chart.

================================================================================
END
================================================================================


---

## commercial_models_dashboard/ai_enterprise_claude_code_commercial_models_dashboard_prompt_v2.txt

AI ENTERPRISE — CLAUDE CODE PROMPT PACK v2
Commercial LLM Models Dashboard + Truth-Safe Model Inventory
Date: 8 May 2026
Timezone: Europe/London

Prepared for: Mike

================================================================================
CLAUDE CODE MASTER TASK
================================================================================

You are working inside the AI Enterprise codebase.

Task:
Add a dashboard module at /dashboard that shows the specific commercially available LLMs, foundation models, model APIs, hosted models, and model-access routes tracked by AI Enterprise for every company currently in scope.

This must be production-safe, source-backed, and truth-safe.

The module must be called:

Commercial LLM Models by Vendor

Core outcome:
Executives visiting AI Enterprise should be able to see, for each tracked company:
- which commercial LLM/model products are owned by that company
- which third-party models are hosted, brokered, or orchestrated by that company
- which models are API-accessible, enterprise-only, preview, beta, deprecated, retired, unknown, or source-refresh required
- which entries are verified/documented versus seed/inferred/unknown
- which sources support each model entry
- what uncertainty remains

Critical:
Never invent model names.
Never invent model ownership.
Never invent model availability.
Never invent model IDs.
Never invent source URLs.
Never treat marketplace/hosted models as vendor-owned.
Never display seed or inferred data as verified.

If the app cannot verify a model from an official source, show:
“Model inventory unavailable — source validation required.”

================================================================================
LANGUAGE AND NAMING
================================================================================

When addressing the product owner in docs or comments, use “Mike”.

Do not refer to Mike as “the user”.

For product UX, use neutral terms such as:
- executive
- portal operator
- viewer
- customer
- account owner
- assessment operator

Avoid casual wording in UI.

================================================================================
TRUTH ENGINE REQUIREMENT
================================================================================

This feature must use the AI Enterprise truth/evidence model.

Every displayed model record must include:

CommercialModel:
- id
- vendorId
- vendorName
- ownerVendorId
- ownerVendorName
- hostingVendorId
- hostingVendorName
- modelName
- modelId
- modelFamily
- modelCategory
- modality
- availabilityStage
- commercialAvailability
- ownershipType
- accessChannel
- contextWindow
- inputModalities
- outputModalities
- toolSupport
- pricingSummary
- sourceIds
- sourceUrls
- sourceNames
- sourceDate
- capturedAt
- evidenceGrade
- confidenceScore
- dataStatus
- uncertaintyNote
- lifecycleStatus
- deprecationDate
- lastVerifiedAt

CommercialModelSource:
- id
- vendorId
- sourceName
- sourceUrl
- sourceType
- capturedAt
- sourceDate
- evidenceGrade
- confidenceScore
- freshnessStatus
- notes

ownershipType:
- first_party
- hosted_third_party
- marketplace
- byollm
- open_weight
- underlying_product_model
- unknown

availabilityStage:
- ga
- preview
- beta
- deprecated
- retired
- unknown

commercialAvailability:
- commercially_available
- commercially_available_preview
- enterprise_only
- api_available
- hosted_on_marketplace
- underlying_product_model
- not_commercially_available
- unknown

modelCategory:
- llm_text
- multimodal
- reasoning
- coding
- embedding
- reranking
- guardrail_safety
- speech_audio
- image_generation
- video_generation
- ocr_document_ai
- time_series
- domain_specific
- unknown

dataStatus:
- verified
- documented
- estimated
- inferred
- seed
- stale
- unknown
- disputed

Evidence grades:
- E0: no evidence
- E1: vendor claim only
- E2: public documentation
- E3: public API/model-list verification
- E4: production customer evidence
- E5: independent audit, verified benchmark, filing, or third-party validation

Source types:
- official_model_docs
- official_api_models_endpoint
- official_model_catalog
- official_product_docs
- official_marketplace_docs
- official_pricing_page
- reputable_news
- seed_placeholder
- unknown

Rules:
1. A model cannot render as verified unless evidenceGrade is E3 or higher and sourceIds exist.
2. A model cannot count as first-party unless ownerVendorId equals vendorId.
3. Hosted third-party models must show original owner and hosting platform separately.
4. Deprecated/retired models must not count as active.
5. Preview/beta models must show preview/beta badge.
6. Unknown records must not be shown as active commercial models.
7. If a source is stale, show stale badge and reduce confidence.
8. If sources conflict, show disputed badge and uncertainty note.

================================================================================
DASHBOARD UI REQUIREMENT
================================================================================

On /dashboard add a card:

Title:
Commercial LLM Models by Vendor

Subtitle:
Source-backed model availability, separated by owned models, hosted third-party models, and uncertain entries.

Card summary should show:
- total tracked vendors
- vendors with source-backed first-party models
- vendors with hosted third-party models
- vendors with unknown/unverified model inventory
- stale inventory count
- latest source refresh date

Each vendor row should show:
- vendor name
- first-party active commercial model count
- hosted third-party model count
- preview/beta count
- deprecated/retired count
- primary model families
- confidence score
- data status
- last verified date
- uncertainty badge
- expand button

Expanded vendor row should show table:
- Model
- Model ID
- Owner
- Hosted by
- Category
- Modality
- Stage
- Commercial availability
- Evidence grade
- Confidence
- Source
- Uncertainty note

Add filters:
- vendor
- ownershipType
- availabilityStage
- modelCategory
- commercialAvailability
- evidenceGrade
- dataStatus

UI style:
- match AI Enterprise dashboard
- executive-grade cards
- confidence badges
- evidence labels
- no spreadsheet feel in default view
- table only in expanded/advanced view
- responsive layout

If a model is hosted but not owned:
Display badge:
Hosted third-party — not vendor-owned.

If no source-backed first-party model exists:
Display:
No source-backed first-party commercial LLM model currently recorded.

If source is missing:
Display:
Model inventory unavailable — source validation required.

================================================================================
API REQUIREMENTS
================================================================================

Add API routes:

GET /api/model-inventory
Returns all CommercialModel records.

GET /api/model-inventory/vendors
Returns grouped vendor summaries.

GET /api/model-inventory/vendors/[vendorId]
Returns full model inventory for a vendor.

GET /api/model-inventory/sources
Returns source registry.

POST /api/model-inventory/refresh
Stub only unless actual ingestion exists.
If not implemented, return:
{ "status": "not_implemented", "message": "Model inventory refresh is not implemented. No data was changed." }

Do not fake refresh behaviour.

================================================================================
SOURCE-BACKED INITIAL MODEL INVENTORY SEED RULES
================================================================================

Seed data is allowed only for development.

All seed records must include:
- dataStatus = seed or documented
- evidenceGrade = E2 unless verified by live API/model endpoint
- confidenceScore = 50-80 depending on source strength
- uncertaintyNote
- sourceUrl
- capturedAt
- lastVerifiedAt = null unless actually verified

Do not display seed records as verified.

During implementation, if official source pages can be fetched, update seed records to documented.
If API/model endpoints are reachable and verified, update evidenceGrade to E3.

================================================================================
SOURCE LIST BY VENDOR
================================================================================

Use these as starting source URLs. Do not assume completeness. Verify during implementation.

OpenAI:
- https://developers.openai.com/api/docs/models
- https://platform.openai.com/docs/models

Anthropic:
- https://docs.anthropic.com/en/docs/about-claude/models/overview
- https://docs.anthropic.com/en/api/models-list

Google / Alphabet:
- https://cloud.google.com/vertex-ai/generative-ai/docs/models
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models
- https://ai.google.dev/gemini-api/docs/models

Mistral AI:
- https://docs.mistral.ai/models
- https://docs.mistral.ai/models/overview

Cohere:
- https://docs.cohere.com/docs/models
- https://docs.cohere.com/v2/docs/models

xAI:
- https://x.ai/api
- https://docs.x.ai/overview
- https://docs.x.ai/docs/models

AWS / Amazon Bedrock:
- https://docs.aws.amazon.com/bedrock/latest/userguide/models.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html

Microsoft / Azure AI Foundry:
- https://azure.microsoft.com/products/ai-model-catalog/
- https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/overview
- https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners

IBM:
- https://www.ibm.com/products/watsonx-ai/foundation-models
- https://www.ibm.com/docs/en/watsonx/saas?topic=models-foundation

Oracle / OCI Generative AI:
- https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm
- https://docs.public.content.oci.oraclecloud.com/en-us/iaas/Content/generative-ai/xai-models.htm

Salesforce / Agentforce:
- https://developer.salesforce.com/docs/ai/agentforce/guide/supported-models.html
- https://developer.salesforce.com/docs/ai/agentforce/guide/trust.html
- https://developer.salesforce.com/docs/einstein/genai/guide/supported-models.html

ServiceNow:
- https://www.servicenow.com/docs/r/intelligent-experiences/servicenow-large-language-model-now-llm/exploring-large-language-models.html
- https://newsroom.servicenow.com/press-releases/details/2023/ServiceNow-launches-Now-Assist-for-ITSM-CSM-HRSD-and-Creator-to-embed-generative-AI-across-all-workflows-on-the-Now-Platform-09-20-2023-traffic/default.aspx

Writer:
- https://dev.writer.com/home/models
- https://dev.writer.com/home/models-overview

Moveworks:
- https://www.moveworks.com/us/en/resources/blog/introducing-moveworks-llm-movelm

Glean:
- https://docs.glean.com/administration/llms
- https://www.glean.com/product/ai-search

Harvey:
- https://help.harvey.ai/articles/what-ai-models-does-harvey-use

Perplexity:
- official Perplexity Enterprise Pro docs
- official Sonar API docs

NVIDIA:
- official NVIDIA AI Enterprise docs
- official NVIDIA NIM docs
- official NVIDIA NeMo docs
- official Nemotron model docs
- AWS Bedrock model catalogue where NVIDIA-hosted models appear

AMD / Broadcom / ASML / Arm:
- treat as infrastructure/investment exposure unless official commercial LLM/model API source exists.

================================================================================
INITIAL VENDOR HANDLING RULES
================================================================================

OpenAI:
- Treat OpenAI as first-party model provider.
- Pull active models from official model docs/API if possible.
- Do not hard-code model list as verified without source.
- If docs and API disagree, mark disputed and prefer live API if available.

Anthropic:
- Treat Claude models as Anthropic-owned.
- If available through AWS Bedrock or Vertex AI, owner remains Anthropic and host is AWS/Google.
- Prefer Anthropic model list endpoint where possible.

Google:
- Treat Gemini as Google-owned.
- Treat Gemma as Google open-weight model family where source confirms.
- Separate GA vs Preview.
- Separate language, image, video, medical/domain models.

Mistral:
- Treat Mistral model families as Mistral-owned.
- Separate premier/open/labs/deprecated if source provides that lifecycle.
- Keep model versions.

Cohere:
- Treat Command, Embed, Rerank, Aya families as Cohere-owned.
- If available on Bedrock/Azure/Oracle, owner remains Cohere.
- Separate generative, embedding, rerank, multilingual/domain models.

xAI:
- Treat Grok model families as xAI-owned.
- Use official xAI docs only for active model availability.
- Mark retired models as retired.

AWS:
- Treat Amazon Nova and Titan as Amazon-owned.
- Treat Bedrock-hosted models by Anthropic, Cohere, Mistral, Meta, DeepSeek, Qwen, NVIDIA, OpenAI, Google, xAI etc. as hosted third-party.
- Do not count hosted third-party models as Amazon first-party.

Microsoft:
- Treat Phi/MAI models as Microsoft-owned where official source confirms commercial availability.
- Treat OpenAI/Anthropic/Cohere/Mistral/Meta/DeepSeek/xAI/NVIDIA models in Azure AI Foundry as hosted/partner models.
- Do not count OpenAI/Anthropic/xAI models as Microsoft-owned.

IBM:
- Treat Granite families as IBM-owned.
- Separate Granite LLMs, code models, guardian/safety models, vision, and time-series.
- Treat non-IBM models in watsonx as hosted third-party.

Oracle:
- Do not assume Oracle-owned general commercial LLM unless official source lists one.
- Treat Cohere/Google/Meta/Mistral/xAI models in OCI as hosted third-party.
- Oracle is host/orchestrator for those models.

Salesforce:
- Treat Salesforce as application/orchestration/trust layer unless official current docs confirm Salesforce-owned commercial model.
- Salesforce Default model and supported provider options must be source-backed.
- If XGen/xLAM appear only in research/engineering content, mark research/uncertain, not active commercial customer model.

ServiceNow:
- Treat Now LLM as ServiceNow first-party/domain-specific LLM only where official docs confirm.
- Treat third-party provider/model access through Now LLM Service as hosted/orchestrated, not ServiceNow-owned.

Writer:
- Treat Palmyra models as Writer-owned where official docs confirm.
- Mark deprecated models as deprecated if docs say so.

Moveworks:
- Treat MoveLM as Moveworks-owned only if source confirms.
- If MoveLM is underlying product model and not customer-selectable API, mark commercialAvailability = underlying_product_model.

Glean:
- Treat Glean as model hub/orchestration/search provider unless official source confirms Glean-owned model.
- Supported OpenAI/Google/Anthropic/Amazon/Meta models remain owned by their original providers.

Harvey:
- Treat Harvey as orchestration/application vendor.
- Models used by Harvey remain owned by Anthropic/OpenAI/Google/etc.
- Display “models used by Harvey,” not “Harvey-owned models.”

Perplexity:
- Include Sonar models only if official Sonar API docs confirm model names and commercial API access.
- If official source unavailable, show source refresh required.

NVIDIA:
- Treat NVIDIA Nemotron models/NIM model endpoints as NVIDIA-owned where official source confirms.
- Treat NVIDIA as infrastructure/model-platform provider, not general SaaS assistant vendor.

AMD / Broadcom / ASML / Arm:
- Do not show first-party commercial LLM models unless official source confirms.
- Show infrastructure/investment exposure note.

================================================================================
TEST REQUIREMENTS
================================================================================

Add tests:

Truth and counting:
- no model renders as verified without sourceIds
- seed records show seed label
- deprecated/retired models not counted as active
- hosted third-party not counted as first-party
- unknown records not counted as commercial models
- stale records show stale label

Ownership:
- AWS-hosted Anthropic/Cohere/Mistral models keep original owner
- Azure-hosted OpenAI/Anthropic/etc keep original owner
- Oracle-hosted Cohere/Google/Mistral/xAI models keep original owner
- Glean/Harvey/Salesforce orchestration does not reassign ownership

UI:
- /dashboard renders Commercial LLM Models by Vendor card
- expansion table renders source metadata
- unknown vendor state works
- filters work
- data-status badges visible

API:
- /api/model-inventory returns model records
- /api/model-inventory/vendors returns grouped summaries
- /api/model-inventory/sources returns source registry

No-hallucination:
- fake source URL in seed data should fail test
- model without evidenceGrade should fail validation
- first-party count must exclude hosted third-party models

================================================================================
IMPLEMENTATION ORDER
================================================================================

1. Inspect current AI Enterprise codebase.
2. Locate /dashboard route and shared dashboard card components.
3. Add CommercialModel and CommercialModelSource types.
4. Add model inventory seed data with source URLs and seed/documented status.
5. Add repository/helper functions:
   - getCommercialModels()
   - getVendorModelSummary()
   - getModelsByVendor()
   - groupModelsByOwnership()
   - activeModelCount()
   - hostedThirdPartyCount()
   - verifiedModelCount()
   - staleInventoryCount()
6. Add API routes.
7. Add dashboard card.
8. Add expandable vendor model table.
9. Add filters.
10. Add tests.
11. Run:
   - npm test
   - npm run build
   - npx tsc --noEmit if available
12. Fix all errors.
13. Do not remove Investor Tools, Assessment, Truth Engine, Product Scope Registry, or existing dashboard features.

================================================================================
FINAL ACCEPTANCE CRITERIA
================================================================================

Feature is complete when:

- /dashboard shows Commercial LLM Models by Vendor card.
- Each tracked company has either:
  - source-backed first-party model records
  - hosted third-party model records
  - unknown/source-refresh-required state
  - infrastructure-only note
- Hosted third-party models are not counted as vendor-owned.
- Every model has source/evidence/data-status metadata.
- No seed data is displayed as verified.
- Deprecated models are visibly marked and excluded from active counts.
- Tests pass.
- Build passes.
- No fake sources are present.
- No unsupported model claims are visible.

Final instruction:
If unsure, mark unknown. Do not invent.


---

## investor_tools/ai_enterprise_combined_investor_tools_truth_engine_ipo_forecast_prompt_pack.txt

AI ENTERPRISE — INVESTOR TOOLS + TRUTH ENGINE FULL DEVELOPMENT PROMPT PACK
=========================================================================
Date: 7 May 2026
Timezone: Europe/London

Purpose
-------
This is a single development-agent prompt pack for upgrading AI Enterprise with:

1. A strict no-hallucination / truthfulness layer across the entire platform.
2. A complete AI product/service scope registry by vendor.
3. A consolidated “Investor Tools” top-navigation tab.
4. Investment Intelligence and Investment Simulator as dropdown/submodule options under Investor Tools.
5. Simulator functionality fixes requested by the product owner.
6. Graphing, validation, data lineage, and cross-feed integrity rules.
7. Development-agent instructions for preventing false, unsupported, stale, or misleading outputs.

This file is intended to be handed to Codex, Claude Code, or another development agent.

Critical product rule:
AI Enterprise must never present unsupported, inferred, stale, estimated, or seed data as verified fact.

============================================================
SECTION 1 — GLOBAL TRUTHFULNESS / NO-HALLUCINATION REQUIREMENT
============================================================

You are developing AI Enterprise.

Absolute rule:
No hallucinations, false claims, fake citations, fake sources, fake market share, fake product availability, fake pricing, fake investment data, fake IPO data, or unsupported vendor claims may appear anywhere in the product.

This applies across:
- vendor profiles
- market dashboard
- market share tracker
- product/capability tracker
- news intelligence
- platform assessment
- Investment Intelligence
- Investment Simulator
- IPO Watch
- Indirect Exposure Map
- executive briefings
- charts and graphs
- exports
- advanced drill-downs
- seed data
- mock data
- API responses

Implement a “Truth Engine” layer.

The Truth Engine must enforce the following:

1. Every factual claim must carry a data status:
   - verified
   - documented
   - tested
   - estimated
   - inferred
   - seed
   - stale
   - unknown
   - unsupported

2. Every material claim must carry:
   - sourceName
   - sourceUrl, where available
   - sourceType
   - capturedAt
   - sourceDate, if available
   - evidenceGrade
   - confidenceScore
   - lastVerified
   - freshnessStatus

3. Never display unsupported claims as fact.
   If a claim lacks evidence, display:
   - “Unknown”
   - “Not verified”
   - “Evidence not available”
   - “Requires validation”

4. Never invent:
   - market share
   - adoption percentages
   - pricing
   - customer counts
   - product capabilities
   - IPO timing
   - IPO valuations
   - investment returns
   - funding data
   - financial metrics
   - source URLs
   - citations
   - regulatory compliance status

5. If the system cannot verify a claim, it must:
   - withhold the claim from the default UI, or
   - display it with an explicit uncertainty label.

6. Seed data must always be labelled as:
   - “Seed data — for prototype modelling only”
   - “Not verified”
   - “Replace with source-backed data before production”

7. Estimated data must always be labelled as:
   - “Estimated”
   - “Methodology available”
   - “Confidence: low/medium/high”
   - “Not a verified company disclosure”

8. Inferred data must always be labelled as:
   - “Inferred from public/proxy signals”
   - “Not directly confirmed by vendor”
   - “Requires validation”

9. If data is stale, display:
   - “Stale — refresh required”
   - Do not use stale data for high-confidence scoring.

10. If the platform detects a missing or contradictory data path, display an error:
   - “Data integrity error: this input did not propagate to [function/output].”
   - “Ranking suspended until the cross-feed error is resolved.”
   - “Simulation output may be invalid — required variable missing.”

Evidence grades:
- E0: no evidence
- E1: vendor claim only
- E2: public documentation
- E3: public test, sandbox/API verification, or agent test
- E4: production customer evidence
- E5: independent audit, verified benchmark, filing, audited report, or third-party validation

Source types:
- official_vendor_doc
- official_vendor_help
- official_pricing_page
- official_trust_center
- official_filing
- regulator_filing
- earnings_release
- investor_presentation
- reputable_news
- analyst_report_licensed
- public_proxy
- user_uploaded_evidence
- buyer_test
- seed_data
- unknown

Freshness rules:
- Current product capability data should be refreshed every 30-90 days.
- Market share/adoption data should be refreshed every 30-90 days.
- Financial data should be refreshed after each reporting period.
- IPO rumour data should be refreshed weekly when active.
- Any source older than 12 months should receive a freshness penalty unless the fact is stable.

Build a central TruthRecord model:
- id
- entityType
- entityId
- claim
- value
- sourceType
- sourceName
- sourceUrl
- sourceDate
- capturedAt
- lastVerified
- evidenceGrade
- confidenceScore
- freshnessStatus
- dataStatus
- uncertaintyNotes
- validationRequired
- blockingStatus

All AI Enterprise output components must consume TruthRecords or explicitly mark data as seed/unknown.

============================================================
SECTION 2 — AI PRODUCT / SERVICE SCOPE REGISTRY BY VENDOR
============================================================

Build a Product Scope Registry across the entire AI Enterprise platform.

Purpose:
List exactly which AI products, services, models, tools, or platform capabilities are being measured, analysed, and assessed for each vendor.

Each product-scope item must include:
- vendorId
- vendorName
- productName
- productCategory
- productDescription
- measurementScope
- includedInModules
- sourceStatus
- sourceName
- sourceUrl
- evidenceGrade
- confidenceScore
- uncertaintyNotes
- lastVerified

Product categories:
- enterprise_assistant
- model_api
- foundation_model
- agent_platform
- agent_runtime
- coding_agent
- enterprise_search
- rag_knowledge
- governance_control
- security_control
- ai_development_platform
- ai_infrastructure
- ai_chip_infrastructure
- data_ai_platform
- workflow_ai
- vertical_ai
- investment_exposure
- ipo_watch
- indirect_exposure
- other

Included modules:
- Market Dashboard
- Vendor Intelligence
- News Intelligence
- Capability Tracker
- Enterprise Assessment
- Market Tracker
- Investor Tools
- Investment Intelligence
- Investment Simulator
- IPO Watch
- Indirect Exposure Map
- Briefings

Important:
Do not assume a product is in scope unless it is explicitly listed in the registry.
If a vendor product is uncertain, list it with sourceStatus = uncertain and dataStatus = requires_validation.

Baseline product scope list:
The following should be added as initial source-backed or source-needed seed entries. Development agents must verify before production use.

1. OpenAI
Measure and assess:
- ChatGPT Enterprise
- ChatGPT Business
- ChatGPT Edu, if education-sector assessment is enabled
- ChatGPT agent / agents in ChatGPT
- Codex / Codex seat / Codex coding agent
- OpenAI API / Responses API / model APIs
- Deep research
- Data analysis
- File uploads / projects / canvas / apps / connectors
- Image generation
- Sora / video generation where available
- Enterprise admin, SSO, SCIM, RBAC, analytics, data controls
Uncertainties:
- Exact current model availability changes frequently and must be source-verified.
- Sora enterprise packaging and availability must be separately verified.
- API model naming must be treated as live-source data, not hard-coded.

2. Microsoft
Measure and assess:
- Microsoft 365 Copilot
- Microsoft Copilot Studio
- Microsoft Agent 365
- Microsoft 365 E7 / Frontier Suite, where available
- Azure AI Foundry
- Foundry Models
- Azure OpenAI in Foundry Models
- Azure AI Foundry Agent Service
- GitHub Copilot
- Dynamics 365 AI agents / Copilot capabilities
- Power Platform AI / Copilot Studio
- Azure AI Search
- Microsoft Purview / Entra / Defender / Intune as AI governance/security adjacency
Uncertainties:
- Agent 365 licensing and availability must be source-verified by region and edition.
- Frontier Suite/E7 packaging must be source-verified before production use.
- Model availability in Foundry changes frequently and must be pulled from live docs/catalogue.

3. Google / Alphabet
Measure and assess:
- Gemini Enterprise
- Google Agentspace, now treated as part of Gemini Enterprise where source confirms
- Gemini models
- Vertex AI
- Vertex AI Agent Builder
- Agent Development Kit / ADK
- Agent2Agent / A2A protocol
- Gemini Code Assist
- NotebookLM agents / Deep Research agents where included in Gemini Enterprise
- Model Garden
- Model Armor
- BigQuery AI / data grounding integrations
- Google Workspace Gemini
Uncertainties:
- Whether NotebookLM and Deep Research are available in a specific enterprise edition must be source-verified.
- Agentspace migration/continuity should be shown with current source status.
- Product names and packaging may differ by Google Cloud vs Google Workspace.

4. Anthropic
Measure and assess:
- Claude Enterprise / Claude for Work Enterprise
- Claude Team / premium seats, where relevant
- Claude models
- Anthropic API / Messages API
- Claude Code
- Claude Code for Team/Enterprise
- Tool use
- Computer use
- Text editor tool
- Citations
- Batch processing
- Extended context features where available
- Artifacts, where relevant to Claude user plans
Uncertainties:
- Claude model names, context limits, and platform availability change and must be live-verified.
- Claude Enterprise vs Team/Premium packaging must be source-verified.
- Computer use and beta tools must be clearly marked beta where applicable.

5. AWS / Amazon
Measure and assess:
- Amazon Bedrock
- Amazon Bedrock Marketplace
- Amazon Bedrock Agents
- Amazon Bedrock Knowledge Bases
- Amazon Bedrock Guardrails
- Amazon Bedrock Managed Agents powered by OpenAI, where available/preview
- OpenAI models on Bedrock, where available/preview
- Codex on Bedrock, where available/preview
- Amazon Q Business
- Amazon Q Developer
- Amazon SageMaker AI
- SageMaker AI model customization agentic experience
- AWS Trainium
- AWS Inferentia
- AWS Neuron SDK
Uncertainties:
- OpenAI on Bedrock / Codex / Managed Agents preview status must be verified and labelled.
- Region availability and preview/GA status must be source-verified.
- Trainium/Inferentia product generations must be source-verified.

6. Salesforce
Measure and assess:
- Agentforce
- Agentforce Guardrails
- Einstein AI
- Einstein Trust Layer
- Data Cloud
- Salesforce Platform AI capabilities
- Agentforce for Service / Sales / IT Service where in scope
- AI CRM platform capabilities
Uncertainties:
- Exact Agentforce product names and SKUs must be verified.
- Agentforce ARR/deals/customer metrics must only appear if sourced from official filings/releases or reputable reporting.
- Do not infer adoption from product marketing.

7. ServiceNow
Measure and assess:
- Now Assist
- AI Control Tower
- Action Fabric
- ServiceNow AI agents / agentic workflows
- Workflow Data Fabric
- ServiceNow platform governance and orchestration capabilities
- ITSM/HR/service AI capabilities
Uncertainties:
- Action Fabric and AI Control Tower availability/GA status must be source-verified.
- Agent governance capabilities should be verified against official docs/release notes.

8. Oracle
Measure and assess:
- OCI Enterprise AI
- OCI Generative AI
- OCI Data Science
- OCI AI Infrastructure
- Agent Hub, if available/preview
- AI Vector Search in Oracle AI Database
- Oracle AI Database / Autonomous AI Database Select AI
- HeatWave GenAI
- Oracle Fusion Cloud AI agents / embedded AI where in scope
Uncertainties:
- Agent Hub availability and beta status must be verified.
- Oracle app-level AI products should be separated from OCI/infrastructure products.

9. SAP
Measure and assess:
- SAP Business AI
- Joule
- Joule Agents
- Joule Studio
- Joule Studio code editor
- Joule Studio CLI
- SAP Signavio + Joule
- SAP BTP AI capabilities
- SAP CX / Engagement Cloud AI agents
- SAP S/4HANA Cloud embedded AI
- SAP SuccessFactors embedded AI where in scope
Uncertainties:
- Joule Agent counts and availability must be source-verified.
- Joule Studio release status must be verified.
- Different SAP products may have different regional/edition availability.

10. IBM
Measure and assess:
- watsonx.ai
- watsonx Orchestrate
- watsonx.data
- Granite models
- Granite Guardian
- watsonx Code Assistant
- IBM Bob, if available
- IBM Concert
- IBM Sovereign Core
- Red Hat Enterprise Linux AI
- IBM agent orchestration/control plane capabilities
Uncertainties:
- IBM Bob and next-gen watsonx Orchestrate preview/GA status must be verified.
- Product naming can shift across IBM announcements and product pages; verify before production display.

11. Snowflake
Measure and assess:
- Snowflake Cortex AI
- Snowflake Intelligence
- Cortex Analyst
- Cortex Search
- Cortex Agents / data agents, if available
- Cortex Code, if available
- Snowflake Arctic models, if in scope
- Snowflake Data Cloud AI capabilities
Uncertainties:
- Some capabilities may be preview/region-dependent.
- Snowflake Intelligence/Cortex Code availability must be verified before production.

12. Databricks
Measure and assess:
- Mosaic AI
- Mosaic AI Model Serving
- Foundation Model APIs
- Foundation Model Fine-tuning
- Mosaic AI Agent Framework / agents, where available
- Genie / Databricks Assistant, where applicable
- Unity Catalog AI model access
- MLflow / model lifecycle
- Lakehouse monitoring and governance capabilities
Uncertainties:
- Product names such as Agent Bricks/Agent Framework must be verified before inclusion.
- Supported models in Foundation Model APIs change frequently and must not be hard-coded.

13. Cohere
Measure and assess:
- North
- Compass
- Command models
- Embed
- Rerank
- Tool Use / agentic workflows
- VPC/on-prem/dedicated Model Vault deployment options
Uncertainties:
- North and Compass packaging and availability must be source-verified.
- Model version names and deployment options change and must be live-verified.

14. Mistral AI
Measure and assess:
- Le Chat
- Le Chat Enterprise
- Mistral Studio
- Mistral Vibe
- Mistral API
- Mistral models
- custom agents
- libraries/RAG
- connectors/MCP connectors
- Admin control plane
- self-hosted / cloud / serverless deployment options
Uncertainties:
- Le Chat Enterprise edition capabilities and availability must be verified.
- Model names and deprecations must not be hard-coded.

15. Perplexity
Measure and assess:
- Perplexity Enterprise Pro
- Sonar API
- Sonar models
- Perplexity answer engine / enterprise search
- internal knowledge / trusted web source search where source confirms
Uncertainties:
- Enterprise data retention, deletion, and security claims must be source-verified.
- Model lineup and API names must be kept current.

16. xAI
Measure and assess:
- Grok app / Grok in X, where relevant
- xAI API
- Grok models
- Grok voice models
- Grok image/OCR capabilities where available
- tool use / function calling / structured outputs
Uncertainties:
- xAI model names and retirements change quickly; must be live-verified.
- Enterprise readiness should not be assumed from API availability.

17. Glean
Measure and assess:
- Glean Search
- Glean enterprise AI assistant/work AI
- Glean agents, where source confirms
- enterprise connectors
- permissions-aware search
- workflow/knowledge capabilities
Uncertainties:
- Exact agent product names and packaging must be verified.
- Adoption/customer numbers must not be inferred from marketing claims.

18. Moveworks
Measure and assess:
- Moveworks AI Assistant Platform
- Moveworks Reasoning Engine
- MoveLM, where relevant
- Agent Studio
- employee support AI for IT/HR/Finance/Sales/Marketing/Engineering
- search and action workflow platform
Uncertainties:
- Product/package names and Fortune/customer metrics must be verified.
- ServiceNow acquisition/ownership status, if relevant, must be source-verified before display.

19. Writer
Measure and assess:
- WRITER AI Studio
- Palmyra models
- Writer agents
- governance/supervision layer
- enterprise agent building and deployment capabilities
Uncertainties:
- Palmyra model versions and AI Studio packaging must be verified.
- Customer/product claims must carry source confidence.

20. Harvey
Measure and assess:
- Harvey Assistant
- Harvey Vault
- Harvey Agent Builder
- Workflow Agents
- Library
- legal research/drafting/analysis platform
Uncertainties:
- Workflow Builder naming changed to Agent Builder; maintain alias mapping and show current verified name.
- Legal-specific product scope should be verified from Harvey docs/help centre.

21. Hebbia
Measure and assess:
- Hebbia Matrix
- Matrix Agent
- institutional intelligence platform
- multi-agent workflow execution
- multimodal document/data analysis
- finance/legal/corporate workflows
Uncertainties:
- Hebbia uses product marketing language that must be clearly separated from independently verified performance.
- Claims like AUM, token counts, and production use cases must be source-labelled and confidence-scored.

22. Rogo
Measure and assess:
- Rogo finance AI platform
- Rogo agents
- financial workflow automation
- financial data integrations
- investment memos, Excel models, diligence materials, slide/deck workflows
Uncertainties:
- User counts, daily query counts, and institution counts must be source-labelled.
- Bespoke deployment model may make standardised comparison harder.

23. Nvidia
Measure and assess:
- NVIDIA AI Enterprise
- NVIDIA NIM
- NVIDIA NeMo
- NVIDIA Blueprints
- NVIDIA Omniverse
- NVIDIA Run:ai
- NVIDIA Enterprise AI Factory
- NVIDIA Nemotron models
- GPU/data-centre infrastructure as investment exposure
Uncertainties:
- Nvidia is primarily an AI infrastructure/platform enabler, not an enterprise SaaS assistant vendor.
- Product availability varies by deployment and partner ecosystem.

24. AMD
Measure and assess:
- AMD ROCm
- AMD ROCm for AI
- AMD Instinct accelerators
- ROCm Operations Platform
- AI/HPC software stack
Uncertainties:
- AMD is primarily AI infrastructure/chip exposure in Investor Tools.
- Application/platform capabilities should not be overstated beyond ROCm/accelerator ecosystem.

25. Broadcom
Measure and assess:
- AI infrastructure and networking exposure
- custom silicon / ASIC exposure, where source-backed
- VMware/private cloud AI adjacency, where source-backed
Uncertainties:
- Do not include product claims without specific sources.
- Treat as investment infrastructure exposure unless specific AI platform products are sourced.

26. ASML
Measure and assess:
- semiconductor equipment exposure
- AI chip supply-chain exposure
- indirect/private AI exposure only where investment/strategic relationship is source-backed
Uncertainties:
- ASML is not an AI platform provider.
- Treat as investment infrastructure/supply-chain exposure, not enterprise AI platform capability.

27. Cerebras
Measure and assess:
- Cerebras AI chip/inference/training systems
- AI infrastructure IPO watch
- hardware/software stack where source-backed
Uncertainties:
- IPO data must use S-1/official filing if available; rumours must be rumour-labelled.
- Customer concentration and financials require filing validation.

28. Datacenter / cloud infra adjacency
If providers such as CoreWeave or other GPU clouds are later added:
- treat as AI infrastructure/investment exposure
- require source-backed financial, capacity, and customer concentration data
- do not compare as enterprise AI software platform unless product scope supports it

============================================================
SECTION 3 — INVESTOR TOOLS NAVIGATION STRUCTURE
============================================================

Change the navigation structure.

Current issue:
Investment Intelligence and Investment Simulator are separate top-level concepts.

Required update:
Create one top-level navigation tab titled:

Investor Tools

Investor Tools must be a dropdown menu.

Dropdown options:
1. Investment Intelligence
2. Investment Simulator
3. Public AI Stocks
4. IPO Watch
5. Indirect Exposure Map
6. Investment Briefings
7. Investor Watchlist

Routes:
- /investor-tools
- /investor-tools/intelligence
- /investor-tools/simulator
- /investor-tools/public
- /investor-tools/ipo-watch
- /investor-tools/exposure-map
- /investor-tools/briefings
- /investor-tools/watchlist

Redirect old routes:
- /investing -> /investor-tools/intelligence
- /investing/simulator -> /investor-tools/simulator
- /investing/public -> /investor-tools/public
- /investing/ipo-watch -> /investor-tools/ipo-watch
- /investing/exposure-map -> /investor-tools/exposure-map

UI requirement:
Investor Tools dropdown must visually match the parent AI Enterprise navigation style.

============================================================
SECTION 4 — INVESTMENT SIMULATOR FUNCTIONALITY FIXES
============================================================

The following updates apply only to the Investment Simulator.

4.1 Manual allocation must include vendor selection
--------------------------------------------------

When allocationStyle = manual:

Show a follow-on dropdown/multiselect:
- label: Select vendors
- supports public direct vendors, private watchlist vendors, indirect exposure vendors, and cash
- filtered by Investment Universe
- every selected vendor must appear in allocation table
- every allocation row must include:
  - vendor
  - ticker/private status
  - exposure type
  - investability status
  - allocation %
  - amount
  - evidence status
  - warning if not directly investable

Validation:
- allocations must total 100%, or 100% including cash reserve
- if allocations do not total 100%, show error immediately
- if private_inaccessible is selected in a direct portfolio, show error or force watchlist/indirect mode
- if IPO watch vendor is selected, label as IPO watch not currently directly investable

4.2 Add single-stock investment portfolio option
------------------------------------------------

Add allocationStyle option:
- single_stock

When allocationStyle = single_stock:
- show dropdown: Select one public direct vendor/ticker
- allow optional compare-against benchmark:
  - AI platform basket
  - AI infrastructure basket
  - market index placeholder
  - cash
- output charts should focus on one holding:
  - scenario fan chart
  - drawdown chart
  - risk radar
  - catalyst timeline
  - valuation risk
  - confidence heatmap for that provider
- do not allow private_inaccessible or IPO_watch as “single stock”
- if user wants IPO candidate, route to IPO Simulator mode instead

4.3 Investment Universe separation must be accurate
---------------------------------------------------

Current issue:
When selecting IPO Watch, public direct vendors like Amazon and Microsoft are included in the portfolio.

Fix:
Investment Universe must hard-filter vendors by investabilityStatus and exposureClass.

InvestmentUniverse options:

1. public_only
Allowed:
- public_direct
- etf_indirect if enabled
Excluded:
- ipo_watch
- private_inaccessible
- accredited_only

2. public_and_indirect
Allowed:
- public_direct
- public_indirect
- etf_indirect
Excluded:
- ipo_watch unless “include IPO watchlist” is explicitly toggled
- private_inaccessible

3. ipo_watch
Allowed:
- ipo_watch only
- private companies with IPOProfile
Excluded:
- public_direct tickers such as Amazon, Microsoft, Alphabet, Nvidia
- public companies may appear only in “indirect exposure context” sidebar, not portfolio allocation

4. speculative_all
Allowed:
- public_direct
- public_indirect
- ipo_watch
- accredited_only watchlist items
Excluded:
- not_legitimately_accessible as direct allocation
Rules:
- private_inaccessible can appear only as watchlist/exposure node, not direct holding

5. single_stock
Allowed:
- public_direct only

Create function:
filterInvestmentUniverse(universe, providers)

Add tests:
- IPO watch universe must contain no public_direct vendors
- public_only must contain no ipo_watch vendors
- single_stock must contain only public_direct vendors
- private_inaccessible must never be directly investable
- indirect exposure nodes cannot be mistaken for direct holdings

4.4 Apply Shock function must include time period and randomised shock
---------------------------------------------------------------------

Current issue:
Apply shock lacks timing and shock detail.

Fix:
Add shock controls:
- shockMode:
  - manual
  - randomised
- shockYear:
  - user-selectable from year 1 to horizonYears
  - if randomised, randomly choose integer year between 1 and horizonYears
- shockType:
  - valuation_compression
  - capex_spike
  - cloud_growth_slowdown
  - regulatory_shock
  - ipo_lockup_selloff
  - infrastructure_shortage
  - model_commoditisation
  - enterprise_adoption_slowdown
  - market_liquidity_shock
  - ai_safety_incident
- shockSeverity:
  - low
  - medium
  - high
  - severe
  - if randomised, randomly choose using weighted probabilities

When Apply Shock is clicked:
- generate shock object:
  - id
  - shockType
  - shockLabel
  - shockDescription
  - shockYear
  - shockSeverity
  - affectedExposureClasses
  - affectedProviders
  - scenarioImpact
  - generatedAt
  - randomSeed
- show visible shock banner:
  “Shock applied in Year {shockYear}: {shockLabel} — {severity}.”
- update scenario fan chart immediately
- update drawdown chart immediately
- update contribution waterfall immediately
- update risk radar immediately
- update provider table immediately

Randomisation:
Use deterministic seeded random if possible so results are reproducible.
If not, show generatedAt and randomSeed.

4.5 Info buttons next to every variable input
---------------------------------------------

Add info (i) buttons/tooltips next to all variable input options.

Required inputs:
- startingCapital
- horizonYears
- riskProfile
- allocationStyle
- investmentUniverse
- selectedVendors
- region
- includePrivateExposure
- rebalanceFrequency
- cashReservePct
- shockMode
- shockYear
- shockType
- shockSeverity
- valuationCompressionPct
- capexSpikePct
- cloudGrowthSlowdownPct
- regulatoryShockSeverity
- ipoLockupSelloffPct
- infrastructureShortageSeverity
- modelCommoditisationSeverity
- enterpriseAdoptionSlowdownPct
- singleStockTicker

Each info button must explain:
- what the variable means
- how it affects outputs
- whether it affects charts
- whether it affects risk scores
- whether it changes universe filtering
- any important limitation

Tooltip example:
Investment Universe:
“Controls which providers are eligible for portfolio allocation. IPO Watch contains only private or pre-IPO candidates and does not include public stocks such as Microsoft or Amazon. Public companies may still appear as indirect exposure routes.”

4.6 Cross-feed integrity and immediate output updates
-----------------------------------------------------

Comprehensively ensure all variable input and functionality/output cross-feeds accurately and truthfully into relevant functions and outputs immediately.

Implement a CrossFeedValidator.

Every input must declare:
- id
- dependentFunctions
- dependentOutputs
- chartsAffected
- requiredFor
- validationRules

Every output must declare:
- id
- requiredInputs
- sourceFunctions
- dataDependencies
- staleIfInputsChange

On any input change:
- recalculate dependent functions
- update dependent outputs immediately
- mark stale outputs as stale until recalculation completes
- if recalculation fails, show error
- if a required variable does not feed into a dependent output, show error

Error examples:
- “Cross-feed error: allocationStyle changed but portfolio holdings did not update.”
- “Cross-feed error: shockYear changed but scenario fan chart still uses old shock timing.”
- “Cross-feed error: Investment Universe = IPO Watch but public_direct vendors remain in portfolio.”
- “Data integrity error: selectedVendors does not match allocation table.”
- “Simulation blocked: private_inaccessible provider selected as direct holding.”

Add tests:
- changing investmentUniverse updates available vendors
- changing allocationStyle updates the correct subform
- selecting manual vendors updates allocation table
- applying shock updates all scenario charts
- changing riskProfile updates risk score and radar
- changing horizonYears updates x-axis and scenario paths
- selecting single_stock updates all outputs to one-provider mode
- invalid cross-feed produces visible error

4.7 Auto-scale risk/return scatterplot axes
-------------------------------------------

Current issue:
Risk/return scatterplot has poor vendor spread/readability.

Fix:
Implement dynamic axis scaling.

Function:
calculateScatterAxisDomain(points)

Inputs:
- riskScore
- returnScore / upsideScore
- allocationWeight
- confidence

Rules:
- compute min/max for x and y
- add padding of 8-12%
- if spread is too narrow, enforce minimum domain width
- if all points cluster tightly, use zoomed domain rather than 0-100
- add outlier handling:
  - if one outlier dominates, use compressed scale or annotation
- allow toggle:
  - “Zoom to spread”
  - “Show full 0-100 scale”

Default:
- Zoom to spread enabled

Axis labels:
- X: Risk score
- Y: Upside / investment attractiveness

Tooltip must include:
- provider
- allocation
- risk score
- upside score
- confidence
- investability status
- evidence grade
- main risk

4.8 Color-code indirect exposure network lines by vendor
--------------------------------------------------------

Current issue:
Indirect exposure network connecting lines need vendor-specific colour coding.

Fix:
In the Indirect Exposure Network graphic:
- assign a stable colour to each top/public vendor node
- all edges from a top/public vendor to lower/private/underlying AI providers use that vendor colour
- lower/private provider nodes can have neutral fill or their own accent border
- edge thickness = exposureStrength
- edge opacity = evidenceConfidence
- dashed edge = inferred/estimated exposure
- solid edge = documented/verified exposure
- dotted edge = uncertain/low confidence exposure

Terminology:
- top vendors = public/direct investable providers or primary holding nodes
- bottom vendors = private/underlying/indirect AI providers or IPO watch nodes

Example:
- MSFT -> OpenAI line uses Microsoft colour
- AMZN -> Anthropic and OpenAI lines use Amazon colour
- GOOGL -> Anthropic line uses Google colour
- NVDA -> frontier AI labs line uses Nvidia colour
- ORCL -> Stargate/OpenAI infrastructure exposure line uses Oracle colour

Tooltip for edge:
- source vendor
- target vendor
- exposure type
- exposure strength
- revenue linkage
- dilution penalty
- confidence
- evidence status
- warning: “Indirect exposure is not direct ownership.”

Add legend:
- colour = public/top vendor
- thickness = exposure strength
- opacity = confidence
- dashed = inferred
- solid = documented/verified
- dotted = uncertain

============================================================
SECTION 5 — INVESTOR TOOLS DATA MODELS
============================================================

Update or create these models.

InvestorToolNavItem:
- id
- label
- route
- dropdownGroup
- description

InvestmentProviderProfile:
- id
- providerId
- name
- slug
- ticker
- exposureClass
- exposureType
- publicStatus
- investabilityStatus
- productScopeIds
- aiProviderQualityScore
- investmentAttractivenessScore
- shortTermCatalystScore
- longTermHoldScore
- speculativeUpsideScore
- ipoReadinessScore
- ipoPricingRisk
- retailAccessScore
- valuationRiskScore
- liquidityRiskScore
- capexRiskScore
- regulatoryRiskScore
- infrastructureDependencyScore
- aiCapitalEfficiencyScore
- hypePenalty
- evidenceConfidence
- evidenceGrade
- keyThesis
- mainRisk
- dataStatus
- lastUpdated
- truthRecordIds

InvestmentUniverseFilter:
- universeId
- allowedInvestabilityStatuses
- excludedInvestabilityStatuses
- allowedExposureClasses
- excludedExposureClasses
- warnings

SimulationInputDependency:
- inputId
- dependentFunctions
- dependentOutputs
- chartsAffected
- requiredFor
- validationRules

SimulationOutputDependency:
- outputId
- requiredInputs
- sourceFunctions
- dataDependencies
- staleIfInputsChange

ShockEvent:
- id
- shockMode
- shockType
- shockLabel
- shockDescription
- shockYear
- shockSeverity
- affectedExposureClasses
- affectedProviders
- scenarioImpact
- generatedAt
- randomSeed
- truthRecordIds

InfoTooltip:
- inputId
- title
- description
- affects
- limitations
- examples

ScatterAxisDomain:
- xMin
- xMax
- yMin
- yMax
- xPadding
- yPadding
- zoomMode
- outlierMode

IndirectExposureEdge:
- sourceVendorId
- targetVendorId
- exposureType
- exposureStrength
- revenueLinkage
- dilutionPenalty
- confidence
- evidenceStatus
- lineColor
- lineStyle
- lineWidth
- opacity

ProductScopeItem:
- id
- vendorId
- vendorName
- productName
- productCategory
- productDescription
- measurementScope
- includedInModules
- sourceStatus
- sourceName
- sourceUrl
- evidenceGrade
- confidenceScore
- uncertaintyNotes
- lastVerified
- truthRecordIds

============================================================
SECTION 6 — API ROUTES
============================================================

Add or update:

Investor Tools:
- GET /api/investor-tools/nav
- GET /api/investor-tools/product-scope
- GET /api/investor-tools/product-scope/[vendorId]

Investment Intelligence:
- GET /api/investor-tools/intelligence
- GET /api/investor-tools/public
- GET /api/investor-tools/ipo-watch
- GET /api/investor-tools/exposure-map
- GET /api/investor-tools/briefings
- GET /api/investor-tools/watchlist

Investment Simulator:
- GET /api/investor-tools/simulator/providers
- POST /api/investor-tools/simulator/filter-universe
- POST /api/investor-tools/simulator/simulate
- POST /api/investor-tools/simulator/apply-shock
- POST /api/investor-tools/simulator/validate-cross-feed
- GET /api/investor-tools/simulator/tooltips
- POST /api/investor-tools/simulator/scatter-domain
- GET /api/investor-tools/simulator/exposure-network

Truth Engine:
- GET /api/truth/claims
- GET /api/truth/claims/[id]
- POST /api/truth/validate
- POST /api/truth/flag-unsupported
- GET /api/truth/stale
- POST /api/truth/refresh-required

============================================================
SECTION 7 — TESTING REQUIREMENTS
============================================================

Add tests for:

Truth Engine:
- unsupported claims are not shown as verified
- seed data is labelled as seed
- stale data receives freshness penalty
- missing sourceUrl/sourceName lowers confidence
- contradictory claims trigger validationRequired
- unknown fields display “Unknown” not invented values

Product Scope Registry:
- every vendor has product scope entries or explicit “scope unknown”
- every product has dataStatus and evidenceGrade
- uncertain products display uncertaintyNotes
- no product appears in assessment if not in ProductScopeRegistry
- product names are not hard-coded into UI without registry entries

Investor Tools navigation:
- Investor Tools appears as top-level tab
- dropdown includes Investment Intelligence and Investment Simulator
- old /investing routes redirect to /investor-tools routes

Simulator:
- manual allocation shows vendor selection dropdown
- selected vendors populate allocation table
- single_stock mode allows only public_direct vendors
- IPO watch excludes Amazon, Microsoft, Alphabet, Nvidia, and other public_direct providers
- public_only excludes ipo_watch/private_inaccessible
- private_inaccessible cannot be a direct holding
- Apply Shock generates shockType, shockYear, shockSeverity, and randomSeed
- shockYear affects scenario path at correct time period
- info buttons exist for all variable inputs
- changing every input updates dependent outputs
- invalid cross-feed shows visible error
- risk/return scatterplot auto-scales axes
- indirect exposure lines are colour-coded per top/public vendor
- edge opacity and line style reflect confidence/evidence status

Charts:
- allocation donut uses updated allocations
- scenario fan chart updates when shock applied
- drawdown chart updates when shock applied
- contribution waterfall updates when inputs change
- confidence heatmap reflects evidence grades
- risk radar reflects risk inputs
- scatterplot uses dynamic axis domain

============================================================
SECTION 8 — UX REQUIREMENTS
============================================================

General:
- UI must match parent AI Enterprise portal.
- Use same typography, cards, badges, spacing, navigation, confidence labels, and executive dashboard feel.
- Do not create a disconnected investment-app design.

Investor Tools dropdown:
- title: Investor Tools
- dropdown options clear and scannable
- active subpage highlighted

Simulator:
- Every variable input has info tooltip.
- Inputs have immediate validation.
- Outputs show recalculating/stale/error states.
- Data status badges visible on every chart/table.
- Charts should be highly attractive, readable, and polished.
- Graphs should align with AI Enterprise visual ethos:
  - restrained executive colours
  - high contrast
  - clear legends
  - confidence labels
  - source labels
  - minimal clutter
  - drill-down on hover/click

Required warning text:
“This module is for market intelligence and hypothetical scenario modelling only. It is not financial advice. Outputs are based on estimated or seed assumptions unless explicitly marked verified. Future returns are not guaranteed.”

Additional warning:
“Private companies and IPO watchlist providers may not be directly investable by retail users.”

Additional warning:
“Indirect exposure is not the same as direct ownership of the private AI provider.”

============================================================
SECTION 9 — DEVELOPMENT ORDER
============================================================

Recommended build order:

1. Implement Truth Engine models and data-status badges.
2. Implement Product Scope Registry.
3. Add Investor Tools top-level dropdown navigation.
4. Move/redirect investment pages under /investor-tools.
5. Fix Investment Universe filtering.
6. Add manual vendor selection subform.
7. Add single-stock portfolio mode.
8. Add info tooltips for all inputs.
9. Add shock randomisation with shockYear and shockType.
10. Add CrossFeedValidator and visible integrity errors.
11. Add dynamic scatterplot axis scaling.
12. Add colour-coded indirect exposure network edges.
13. Update seed data with ProductScopeRegistry links.
14. Add tests.
15. Run build and fix TypeScript/lint/test failures.
16. Document remaining uncertain data and required source validation.

============================================================
SECTION 10 — FINAL DELIVERY REQUIREMENTS
============================================================

Deliver:

- one Investor Tools top-nav dropdown
- Investment Intelligence under Investor Tools
- Investment Simulator under Investor Tools
- Product Scope Registry page or advanced table
- No-hallucination Truth Engine
- data-status badges everywhere
- source/evidence/confidence tracking
- simulator fixes requested by product owner
- highly attractive graphs aligned with AI Enterprise
- test suite covering truthfulness, filtering, shock logic, cross-feed integrity, and graph logic
- README update
- architecture notes
- TODO list for unresolved product-scope uncertainties

Final instruction:
If any output cannot be supported by source-backed, clearly labelled seed, estimated, inferred, documented, tested, or verified data, the product must show “Unknown” or “Requires validation.” It must never fill the gap with invented content.





=========================================================================================
ADDENDUM — IPO FORECASTING + POST-IPO PRICE FLUCTUATION MODEL
=========================================================================================
Date: 8 May 2026
Timezone: Europe/London

Purpose
-------
This addendum upgrades the AI Enterprise Investor Tools module with a deeper IPO forecasting and post-IPO fluctuation model.

This must be implemented as part of:
- Investor Tools
- IPO Watch
- Investment Intelligence
- Investment Simulator
- Provider Investment Profiles
- Executive Briefings

Critical truthfulness rule:
Do not invent IPO dates, share prices, offer prices, valuations, sources, S-1 filings, lock-up terms, or price forecasts.

Where there is no S-1/F-1, official price range, lock-up term, offer price, audited financials, or confirmed listing date, the app must display:
- modelled estimate
- not factual listing date
- confidence level
- evidence grade
- source trail
- uncertainty note

The app must never present modelled IPO forecasts as fact.

Required user-facing warning:
“This is a modelled IPO forecast, not a factual listing date or investment recommendation. Timing and price bands are based on public signals, evidence confidence, and scenario assumptions. They should be updated when an S-1/F-1, price range, float, lock-up terms, or audited financials become available.”

=========================================================================================
SECTION 1 — IPO FORECASTING OBJECTIVE
=========================================================================================

Build an IPO Forecasting model that estimates:

1. Expected IPO month or credible IPO window.
2. IPO evidence quality.
3. IPO readiness.
4. IPO pricing risk.
5. Post-IPO behaviour forecast.
6. Month 1 to Month 10 expected fluctuation bands after listing.
7. Whether month-level forecasting should be disabled due to insufficient evidence.
8. What data is missing and what would change the forecast.

The model must output percentage bands relative to the IPO offer price, not absolute share prices, unless a verified offer price exists.

Example:
M1: +20% to +85%

This means:
“If the IPO offer price is $100, the modelled one-month trading range is approximately $120 to $185.”

It does not mean:
“The share price will be $120 to $185.”

=========================================================================================
SECTION 2 — IPO EVIDENCE QUALITY MODEL
=========================================================================================

Create an IPOEvidenceQuality model.

Rumour quality scale:

R0 — No credible IPO signal
R1 — General market speculation
R2 — Reputable report, vague timing
R3 — Reputable reports with timing or valuation detail
R4 — Reported bankers, advisers, filing preparation, roadshow, or price-range process
R5 — S-1/F-1 filed, confidential filing confirmed, or active IPO marketing confirmed

Only R4 and R5 should materially increase IPO readiness.

IPO evidence fields:
- providerId
- rumourQuality
- sourceIds
- sourceNames
- sourceUrls
- sourceDates
- evidenceGrade
- confidenceScore
- filingStatus
- officialFilingUrl
- hasConfirmedS1
- hasConfirmedPriceRange
- hasConfirmedFloat
- hasConfirmedLockup
- hasAuditedFinancials
- uncertaintyNote
- forecastPermitted

Rules:
- If rumourQuality <= R1, do not provide a specific IPO month.
- If rumourQuality = R2, provide only a broad window.
- If rumourQuality = R3, provide an estimated month with low/medium-low confidence.
- If rumourQuality >= R4, provide estimated month and post-IPO bands.
- If no credible IPO evidence exists, display “No reliable month-level IPO forecast available.”

=========================================================================================
SECTION 3 — IPO TIMING FORECAST MODEL
=========================================================================================

Create an IPO timing forecast engine.

Inputs:
- rumourQuality
- currentFundingStage
- latestValuation
- latestFundingDate
- revenueScale
- revenueGrowth
- grossMarginAvailable
- fcfPathAvailable
- publicMarketWindowScore
- marketSentimentScore
- companyCapitalNeed
- reportedBankerOrAdvisorActivity
- reportedRoadshowActivity
- S1Status
- strategicFundingAvailability
- companyStatedPreferencePrivateVsPublic
- sectorIPOComparables
- regulatoryOrLegalOverhang

Output:
- estimatedIpoMonth
- credibleWindowStart
- credibleWindowEnd
- confidence
- forecastStatus
- forecastDisabledReason
- sourceIds
- uncertaintyNotes

Forecast status values:
- active_process
- likely_near_term
- plausible_watch
- broad_window_only
- no_reliable_month_estimate
- not_modelled_standalone
- disabled_until_filing

=========================================================================================
SECTION 4 — CURRENT PRIVATE AI FIRM IPO FORECAST SEED MODEL
=========================================================================================

Create seed IPOForecast records for the following firms.

Important:
All records must be labelled:
- dataStatus: estimated
- forecastStatus: model_estimate_not_fact
- sourceRequired: true
- confidence as specified
- no dollar share prices unless verified offering price exists

The current seed estimates are based on public signals and must be replaced/refreshed with source-backed records in production.

1. Cerebras
- estimatedIpoMonth: 2026-05
- credibleWindowStart: 2026-05
- credibleWindowEnd: 2026-05
- confidence: high
- rumourQuality: R4_or_R5
- forecastStatus: active_process
- behaviourForecast: speculative_ai_infrastructure
- notes: closest near-term IPO; active roadshow/price-range signal required for production source validation

2. OpenAI
- estimatedIpoMonth: 2027-05
- credibleWindowStart: 2026-12
- credibleWindowEnd: 2027-09
- confidence: medium_low
- rumourQuality: R3_or_R4
- forecastStatus: model_estimate_not_fact
- behaviourForecast: mega_hype_valuation_sensitive
- notes: possible H2 2026 filing reports; listing date not confirmed; valuation and compute-cost risk high

3. Anthropic
- estimatedIpoMonth: 2027-09
- credibleWindowStart: 2026-12
- credibleWindowEnd: 2027-12
- confidence: medium_low
- rumourQuality: R3
- forecastStatus: model_estimate_not_fact
- behaviourForecast: high_quality_compute_and_valuation_risk
- notes: large private fundraising may delay IPO; compute dependency and valuation risk high

4. Databricks
- estimatedIpoMonth: 2027-11
- credibleWindowStart: 2027-05
- credibleWindowEnd: 2028-04
- confidence: medium
- rumourQuality: R2_or_R3
- forecastStatus: model_estimate_not_fact
- behaviourForecast: software_compounder_candidate
- notes: best fundamental software IPO candidate if valuation is disciplined

5. Cohere
- estimatedIpoMonth: 2027-12
- credibleWindowStart: 2027-09
- credibleWindowEnd: 2028-06
- confidence: medium_low
- rumourQuality: R2
- forecastStatus: model_estimate_not_fact
- behaviourForecast: enterprise_ai_valuation_dependent
- notes: plausible enterprise AI IPO watch; scale smaller than mega labs

6. Harvey
- estimatedIpoMonth: 2028-06
- credibleWindowStart: 2028-01
- credibleWindowEnd: 2029-12
- confidence: low_medium
- rumourQuality: R1_or_R2
- forecastStatus: model_estimate_not_fact
- behaviourForecast: vertical_ai_tam_proof_needed
- notes: strong legal AI vertical; no confirmed IPO process

7. Glean
- estimatedIpoMonth: 2028-09
- credibleWindowStart: 2028-01
- credibleWindowEnd: 2029-12
- confidence: low_medium
- rumourQuality: R1
- forecastStatus: model_estimate_not_fact
- behaviourForecast: enterprise_knowledge_layer_watch
- notes: platform-suite competition risk

8. Mistral
- estimatedIpoMonth: 2028-11
- credibleWindowStart: 2028-01
- credibleWindowEnd: 2029-12
- confidence: low_medium
- rumourQuality: R1
- forecastStatus: model_estimate_not_fact
- behaviourForecast: sovereign_ai_strategic_bet
- notes: strategic funding route may precede IPO

9. Perplexity
- estimatedIpoMonth: 2028-06
- credibleWindowStart: 2028-01
- credibleWindowEnd: 2029-12
- confidence: low
- rumourQuality: R1
- forecastStatus: model_estimate_not_fact
- behaviourForecast: search_answer_engine_volatility
- notes: monetisation, competition, and legal/search risk must be validated

10. Writer
- estimatedIpoMonth: 2029-09
- credibleWindowStart: 2029-01
- credibleWindowEnd: 2030-12
- confidence: low
- rumourQuality: R0_or_R1
- forecastStatus: model_estimate_not_fact
- behaviourForecast: enterprise_agentic_watch
- notes: no credible near-term IPO process signal

11. Hebbia
- estimatedIpoMonth: null
- credibleWindowStart: null
- credibleWindowEnd: null
- confidence: very_low
- rumourQuality: R0
- forecastStatus: no_reliable_month_estimate
- behaviourForecast: too_early
- notes: disable month-level price model until IPO signal quality improves

12. Rogo
- estimatedIpoMonth: null
- credibleWindowStart: null
- credibleWindowEnd: null
- confidence: very_low
- rumourQuality: R0
- forecastStatus: no_reliable_month_estimate
- behaviourForecast: too_early
- notes: disable month-level price model until IPO signal quality improves

13. xAI standalone
- estimatedIpoMonth: null
- credibleWindowStart: null
- credibleWindowEnd: null
- confidence: medium
- rumourQuality: R0_standalone
- forecastStatus: not_modelled_standalone
- behaviourForecast: spacex_linked_only
- notes: do not model xAI standalone IPO unless credible standalone filing emerges

=========================================================================================
SECTION 5 — POST-IPO PRICE FLUCTUATION BAND MODEL
=========================================================================================

Build a PostIPOFluctuationBand model.

Important:
These are percentage bands relative to the IPO offer price.
They are not share-price predictions.
They are not guaranteed returns.
They must be labelled as modelled estimates.

PostIPOFluctuationBand:
- providerId
- relativeTo: ipo_offer_price
- monthNumber
- lowPct
- highPct
- confidence
- dataStatus
- sourceIds
- uncertaintyNote

General drivers:
- IPO demand
- offer price vs private valuation
- float size
- lock-up terms
- first earnings timing
- institutional allocation
- retail allocation
- valuation multiple
- gross margin
- free cash flow path
- compute/capex commitments
- customer concentration
- legal/regulatory overhang
- market sentiment
- AI sector volatility

Do not output bands if:
- rumourQuality <= R1
- forecastStatus = no_reliable_month_estimate
- forecastStatus = not_modelled_standalone
- confidence = very_low

Instead show:
“Post-IPO fluctuation model disabled until IPO signal quality improves.”

=========================================================================================
SECTION 6 — SEED POST-IPO BANDS
=========================================================================================

Create seed bands below. Label all as modelled estimates.

Cerebras:
M1 +20 to +85
M2 +5 to +75
M3 -5 to +70
M4 -15 to +65
M5 -25 to +55
M6 -40 to +45
M7 -30 to +55
M8 -25 to +65
M9 -20 to +70
M10 -20 to +75

OpenAI:
M1 +25 to +110
M2 +10 to +95
M3 -5 to +80
M4 -15 to +70
M5 -25 to +60
M6 -45 to +50
M7 -40 to +60
M8 -35 to +75
M9 -30 to +85
M10 -25 to +95

Anthropic:
M1 +15 to +85
M2 +5 to +75
M3 -10 to +65
M4 -20 to +55
M5 -30 to +50
M6 -45 to +45
M7 -35 to +55
M8 -30 to +65
M9 -25 to +75
M10 -20 to +85

Databricks:
M1 +10 to +45
M2 +5 to +45
M3 0 to +45
M4 -5 to +45
M5 -10 to +40
M6 -20 to +35
M7 -15 to +45
M8 -10 to +50
M9 -10 to +55
M10 -5 to +60

Cohere:
M1 +5 to +35
M2 -5 to +35
M3 -10 to +35
M4 -15 to +35
M5 -20 to +30
M6 -30 to +25
M7 -25 to +35
M8 -20 to +40
M9 -15 to +45
M10 -15 to +50

Harvey:
M1 +10 to +50
M2 0 to +45
M3 -10 to +40
M4 -15 to +35
M5 -25 to +30
M6 -35 to +25
M7 -30 to +35
M8 -25 to +40
M9 -20 to +45
M10 -15 to +50

Glean:
M1 0 to +35
M2 -5 to +35
M3 -10 to +30
M4 -15 to +30
M5 -20 to +25
M6 -30 to +20
M7 -25 to +30
M8 -20 to +35
M9 -15 to +40
M10 -10 to +45

Mistral:
M1 +5 to +45
M2 0 to +40
M3 -10 to +35
M4 -15 to +35
M5 -20 to +30
M6 -30 to +25
M7 -25 to +35
M8 -20 to +40
M9 -15 to +45
M10 -10 to +50

Perplexity:
M1 +15 to +80
M2 0 to +70
M3 -15 to +55
M4 -25 to +45
M5 -35 to +35
M6 -50 to +25
M7 -45 to +35
M8 -40 to +45
M9 -35 to +55
M10 -30 to +65

Writer:
M1 0 to +30
M2 -5 to +30
M3 -10 to +30
M4 -15 to +25
M5 -20 to +25
M6 -30 to +20
M7 -25 to +30
M8 -20 to +35
M9 -15 to +40
M10 -10 to +45

Hebbia:
Disable post-IPO bands.
Display: “No reliable month-level IPO forecast available.”

Rogo:
Disable post-IPO bands.
Display: “No reliable month-level IPO forecast available.”

xAI standalone:
Disable post-IPO bands.
Display: “xAI standalone IPO is not modelled. Use SpaceX-linked exposure if credible SpaceX IPO route emerges.”

=========================================================================================
SECTION 7 — IPO CHARTS AND UI
=========================================================================================

Build an IPO Forecast UI under Investor Tools.

Routes:
- /investor-tools/ipo-watch
- /investor-tools/ipo-watch/[providerSlug]

Components:
1. IPO Timing Table
2. IPO Confidence Badge
3. Rumour Quality Badge
4. Month-Level Forecast Chart
5. Post-IPO Fluctuation Band Chart
6. Lock-Up Risk Marker
7. Evidence Panel
8. Missing Data Checklist
9. Disable-State Component for insufficient evidence

Charts:
- IPO forecast timeline
- 1–10 month fluctuation band chart
- confidence heatmap
- valuation risk vs IPO readiness scatter
- post-IPO behaviour classification chart

Post-IPO fluctuation chart:
- x-axis: M1 to M10
- y-axis: percentage movement vs IPO offer price
- show low/high range as a band
- show zero line
- show lock-up risk zone around M5–M7 if lock-up unknown or typical
- label as modelled estimate
- no dollar prices unless offer price is verified

Tooltip:
- provider
- month
- lowPct
- highPct
- confidence
- uncertainty note
- source status

=========================================================================================
SECTION 8 — DATA NEEDED TO IMPROVE FORECAST
=========================================================================================

For each IPO watch provider, track missing data:

- S-1/F-1 filing
- confidential filing confirmation
- offer price range
- share count
- free float
- lock-up terms
- underwriters
- revenue / ARR
- gross margin
- free cash flow path
- compute commitments
- customer concentration
- net revenue retention
- use of proceeds
- insider selling
- related-party transactions
- regulatory/legal issues
- first earnings date
- public market conditions

Create MissingIPODataChecklist:
- providerId
- missingItem
- importance
- blockingStatus
- howItChangesForecast
- lastCheckedAt

If critical items are missing:
- lower confidence
- widen post-IPO bands
- show warning

=========================================================================================
SECTION 9 — TEST REQUIREMENTS
=========================================================================================

Add tests:

IPO forecast:
- R0/R1 companies do not get month-level forecast
- R4/R5 companies can get month-level forecast
- no verified offer price means no dollar share price
- disabled companies show disabled forecast message
- xAI standalone is not modelled
- Hebbia and Rogo bands are disabled

Post-IPO bands:
- all active band providers have M1-M10
- lowPct <= highPct
- chart uses percentage relative to offer price
- lock-up zone appears for M5-M7 when lock-up is unknown
- confidence labels render
- source/evidence labels render

Truthfulness:
- no IPO estimate renders without dataStatus
- no price path renders as guaranteed
- no source-less factual claim appears in IPO UI
- stale IPO rumour data reduces confidence

=========================================================================================
SECTION 10 — CODEX IMPLEMENTATION ORDER
=========================================================================================

1. Add IPO forecast types.
2. Add seed IPO forecast data.
3. Add post-IPO band data.
4. Add truth labels and forecast warnings.
5. Build /investor-tools/ipo-watch table.
6. Build provider IPO detail page.
7. Add post-IPO fluctuation band chart.
8. Add missing data checklist.
9. Add tests.
10. Run build and fix TypeScript/lint/test failures.

=========================================================================================
FINAL DEVELOPMENT AGENT INSTRUCTION
=========================================================================================

Never invent IPO dates, share prices, offer prices, valuations, sources, or filings.

If the data is not available:
- say unknown
- disable forecast
- show missing data
- lower confidence

The system must be more willing to show “No reliable forecast” than to produce false precision.



---

## investor_tools/ai_enterprise_investor_tools_truth_engine_combined_prompt_pack.txt

AI ENTERPRISE — INVESTOR TOOLS + TRUTH ENGINE FULL DEVELOPMENT PROMPT PACK
=========================================================================
Date: 7 May 2026
Timezone: Europe/London

Purpose
-------
This is a single development-agent prompt pack for upgrading AI Enterprise with:

1. A strict no-hallucination / truthfulness layer across the entire platform.
2. A complete AI product/service scope registry by vendor.
3. A consolidated “Investor Tools” top-navigation tab.
4. Investment Intelligence and Investment Simulator as dropdown/submodule options under Investor Tools.
5. Simulator functionality fixes requested by the product owner.
6. Graphing, validation, data lineage, and cross-feed integrity rules.
7. Development-agent instructions for preventing false, unsupported, stale, or misleading outputs.

This file is intended to be handed to Codex, Claude Code, or another development agent.

Critical product rule:
AI Enterprise must never present unsupported, inferred, stale, estimated, or seed data as verified fact.

============================================================
SECTION 1 — GLOBAL TRUTHFULNESS / NO-HALLUCINATION REQUIREMENT
============================================================

You are developing AI Enterprise.

Absolute rule:
No hallucinations, false claims, fake citations, fake sources, fake market share, fake product availability, fake pricing, fake investment data, fake IPO data, or unsupported vendor claims may appear anywhere in the product.

This applies across:
- vendor profiles
- market dashboard
- market share tracker
- product/capability tracker
- news intelligence
- platform assessment
- Investment Intelligence
- Investment Simulator
- IPO Watch
- Indirect Exposure Map
- executive briefings
- charts and graphs
- exports
- advanced drill-downs
- seed data
- mock data
- API responses

Implement a “Truth Engine” layer.

The Truth Engine must enforce the following:

1. Every factual claim must carry a data status:
   - verified
   - documented
   - tested
   - estimated
   - inferred
   - seed
   - stale
   - unknown
   - unsupported

2. Every material claim must carry:
   - sourceName
   - sourceUrl, where available
   - sourceType
   - capturedAt
   - sourceDate, if available
   - evidenceGrade
   - confidenceScore
   - lastVerified
   - freshnessStatus

3. Never display unsupported claims as fact.
   If a claim lacks evidence, display:
   - “Unknown”
   - “Not verified”
   - “Evidence not available”
   - “Requires validation”

4. Never invent:
   - market share
   - adoption percentages
   - pricing
   - customer counts
   - product capabilities
   - IPO timing
   - IPO valuations
   - investment returns
   - funding data
   - financial metrics
   - source URLs
   - citations
   - regulatory compliance status

5. If the system cannot verify a claim, it must:
   - withhold the claim from the default UI, or
   - display it with an explicit uncertainty label.

6. Seed data must always be labelled as:
   - “Seed data — for prototype modelling only”
   - “Not verified”
   - “Replace with source-backed data before production”

7. Estimated data must always be labelled as:
   - “Estimated”
   - “Methodology available”
   - “Confidence: low/medium/high”
   - “Not a verified company disclosure”

8. Inferred data must always be labelled as:
   - “Inferred from public/proxy signals”
   - “Not directly confirmed by vendor”
   - “Requires validation”

9. If data is stale, display:
   - “Stale — refresh required”
   - Do not use stale data for high-confidence scoring.

10. If the platform detects a missing or contradictory data path, display an error:
   - “Data integrity error: this input did not propagate to [function/output].”
   - “Ranking suspended until the cross-feed error is resolved.”
   - “Simulation output may be invalid — required variable missing.”

Evidence grades:
- E0: no evidence
- E1: vendor claim only
- E2: public documentation
- E3: public test, sandbox/API verification, or agent test
- E4: production customer evidence
- E5: independent audit, verified benchmark, filing, audited report, or third-party validation

Source types:
- official_vendor_doc
- official_vendor_help
- official_pricing_page
- official_trust_center
- official_filing
- regulator_filing
- earnings_release
- investor_presentation
- reputable_news
- analyst_report_licensed
- public_proxy
- user_uploaded_evidence
- buyer_test
- seed_data
- unknown

Freshness rules:
- Current product capability data should be refreshed every 30-90 days.
- Market share/adoption data should be refreshed every 30-90 days.
- Financial data should be refreshed after each reporting period.
- IPO rumour data should be refreshed weekly when active.
- Any source older than 12 months should receive a freshness penalty unless the fact is stable.

Build a central TruthRecord model:
- id
- entityType
- entityId
- claim
- value
- sourceType
- sourceName
- sourceUrl
- sourceDate
- capturedAt
- lastVerified
- evidenceGrade
- confidenceScore
- freshnessStatus
- dataStatus
- uncertaintyNotes
- validationRequired
- blockingStatus

All AI Enterprise output components must consume TruthRecords or explicitly mark data as seed/unknown.

============================================================
SECTION 2 — AI PRODUCT / SERVICE SCOPE REGISTRY BY VENDOR
============================================================

Build a Product Scope Registry across the entire AI Enterprise platform.

Purpose:
List exactly which AI products, services, models, tools, or platform capabilities are being measured, analysed, and assessed for each vendor.

Each product-scope item must include:
- vendorId
- vendorName
- productName
- productCategory
- productDescription
- measurementScope
- includedInModules
- sourceStatus
- sourceName
- sourceUrl
- evidenceGrade
- confidenceScore
- uncertaintyNotes
- lastVerified

Product categories:
- enterprise_assistant
- model_api
- foundation_model
- agent_platform
- agent_runtime
- coding_agent
- enterprise_search
- rag_knowledge
- governance_control
- security_control
- ai_development_platform
- ai_infrastructure
- ai_chip_infrastructure
- data_ai_platform
- workflow_ai
- vertical_ai
- investment_exposure
- ipo_watch
- indirect_exposure
- other

Included modules:
- Market Dashboard
- Vendor Intelligence
- News Intelligence
- Capability Tracker
- Enterprise Assessment
- Market Tracker
- Investor Tools
- Investment Intelligence
- Investment Simulator
- IPO Watch
- Indirect Exposure Map
- Briefings

Important:
Do not assume a product is in scope unless it is explicitly listed in the registry.
If a vendor product is uncertain, list it with sourceStatus = uncertain and dataStatus = requires_validation.

Baseline product scope list:
The following should be added as initial source-backed or source-needed seed entries. Development agents must verify before production use.

1. OpenAI
Measure and assess:
- ChatGPT Enterprise
- ChatGPT Business
- ChatGPT Edu, if education-sector assessment is enabled
- ChatGPT agent / agents in ChatGPT
- Codex / Codex seat / Codex coding agent
- OpenAI API / Responses API / model APIs
- Deep research
- Data analysis
- File uploads / projects / canvas / apps / connectors
- Image generation
- Sora / video generation where available
- Enterprise admin, SSO, SCIM, RBAC, analytics, data controls
Uncertainties:
- Exact current model availability changes frequently and must be source-verified.
- Sora enterprise packaging and availability must be separately verified.
- API model naming must be treated as live-source data, not hard-coded.

2. Microsoft
Measure and assess:
- Microsoft 365 Copilot
- Microsoft Copilot Studio
- Microsoft Agent 365
- Microsoft 365 E7 / Frontier Suite, where available
- Azure AI Foundry
- Foundry Models
- Azure OpenAI in Foundry Models
- Azure AI Foundry Agent Service
- GitHub Copilot
- Dynamics 365 AI agents / Copilot capabilities
- Power Platform AI / Copilot Studio
- Azure AI Search
- Microsoft Purview / Entra / Defender / Intune as AI governance/security adjacency
Uncertainties:
- Agent 365 licensing and availability must be source-verified by region and edition.
- Frontier Suite/E7 packaging must be source-verified before production use.
- Model availability in Foundry changes frequently and must be pulled from live docs/catalogue.

3. Google / Alphabet
Measure and assess:
- Gemini Enterprise
- Google Agentspace, now treated as part of Gemini Enterprise where source confirms
- Gemini models
- Vertex AI
- Vertex AI Agent Builder
- Agent Development Kit / ADK
- Agent2Agent / A2A protocol
- Gemini Code Assist
- NotebookLM agents / Deep Research agents where included in Gemini Enterprise
- Model Garden
- Model Armor
- BigQuery AI / data grounding integrations
- Google Workspace Gemini
Uncertainties:
- Whether NotebookLM and Deep Research are available in a specific enterprise edition must be source-verified.
- Agentspace migration/continuity should be shown with current source status.
- Product names and packaging may differ by Google Cloud vs Google Workspace.

4. Anthropic
Measure and assess:
- Claude Enterprise / Claude for Work Enterprise
- Claude Team / premium seats, where relevant
- Claude models
- Anthropic API / Messages API
- Claude Code
- Claude Code for Team/Enterprise
- Tool use
- Computer use
- Text editor tool
- Citations
- Batch processing
- Extended context features where available
- Artifacts, where relevant to Claude user plans
Uncertainties:
- Claude model names, context limits, and platform availability change and must be live-verified.
- Claude Enterprise vs Team/Premium packaging must be source-verified.
- Computer use and beta tools must be clearly marked beta where applicable.

5. AWS / Amazon
Measure and assess:
- Amazon Bedrock
- Amazon Bedrock Marketplace
- Amazon Bedrock Agents
- Amazon Bedrock Knowledge Bases
- Amazon Bedrock Guardrails
- Amazon Bedrock Managed Agents powered by OpenAI, where available/preview
- OpenAI models on Bedrock, where available/preview
- Codex on Bedrock, where available/preview
- Amazon Q Business
- Amazon Q Developer
- Amazon SageMaker AI
- SageMaker AI model customization agentic experience
- AWS Trainium
- AWS Inferentia
- AWS Neuron SDK
Uncertainties:
- OpenAI on Bedrock / Codex / Managed Agents preview status must be verified and labelled.
- Region availability and preview/GA status must be source-verified.
- Trainium/Inferentia product generations must be source-verified.

6. Salesforce
Measure and assess:
- Agentforce
- Agentforce Guardrails
- Einstein AI
- Einstein Trust Layer
- Data Cloud
- Salesforce Platform AI capabilities
- Agentforce for Service / Sales / IT Service where in scope
- AI CRM platform capabilities
Uncertainties:
- Exact Agentforce product names and SKUs must be verified.
- Agentforce ARR/deals/customer metrics must only appear if sourced from official filings/releases or reputable reporting.
- Do not infer adoption from product marketing.

7. ServiceNow
Measure and assess:
- Now Assist
- AI Control Tower
- Action Fabric
- ServiceNow AI agents / agentic workflows
- Workflow Data Fabric
- ServiceNow platform governance and orchestration capabilities
- ITSM/HR/service AI capabilities
Uncertainties:
- Action Fabric and AI Control Tower availability/GA status must be source-verified.
- Agent governance capabilities should be verified against official docs/release notes.

8. Oracle
Measure and assess:
- OCI Enterprise AI
- OCI Generative AI
- OCI Data Science
- OCI AI Infrastructure
- Agent Hub, if available/preview
- AI Vector Search in Oracle AI Database
- Oracle AI Database / Autonomous AI Database Select AI
- HeatWave GenAI
- Oracle Fusion Cloud AI agents / embedded AI where in scope
Uncertainties:
- Agent Hub availability and beta status must be verified.
- Oracle app-level AI products should be separated from OCI/infrastructure products.

9. SAP
Measure and assess:
- SAP Business AI
- Joule
- Joule Agents
- Joule Studio
- Joule Studio code editor
- Joule Studio CLI
- SAP Signavio + Joule
- SAP BTP AI capabilities
- SAP CX / Engagement Cloud AI agents
- SAP S/4HANA Cloud embedded AI
- SAP SuccessFactors embedded AI where in scope
Uncertainties:
- Joule Agent counts and availability must be source-verified.
- Joule Studio release status must be verified.
- Different SAP products may have different regional/edition availability.

10. IBM
Measure and assess:
- watsonx.ai
- watsonx Orchestrate
- watsonx.data
- Granite models
- Granite Guardian
- watsonx Code Assistant
- IBM Bob, if available
- IBM Concert
- IBM Sovereign Core
- Red Hat Enterprise Linux AI
- IBM agent orchestration/control plane capabilities
Uncertainties:
- IBM Bob and next-gen watsonx Orchestrate preview/GA status must be verified.
- Product naming can shift across IBM announcements and product pages; verify before production display.

11. Snowflake
Measure and assess:
- Snowflake Cortex AI
- Snowflake Intelligence
- Cortex Analyst
- Cortex Search
- Cortex Agents / data agents, if available
- Cortex Code, if available
- Snowflake Arctic models, if in scope
- Snowflake Data Cloud AI capabilities
Uncertainties:
- Some capabilities may be preview/region-dependent.
- Snowflake Intelligence/Cortex Code availability must be verified before production.

12. Databricks
Measure and assess:
- Mosaic AI
- Mosaic AI Model Serving
- Foundation Model APIs
- Foundation Model Fine-tuning
- Mosaic AI Agent Framework / agents, where available
- Genie / Databricks Assistant, where applicable
- Unity Catalog AI model access
- MLflow / model lifecycle
- Lakehouse monitoring and governance capabilities
Uncertainties:
- Product names such as Agent Bricks/Agent Framework must be verified before inclusion.
- Supported models in Foundation Model APIs change frequently and must not be hard-coded.

13. Cohere
Measure and assess:
- North
- Compass
- Command models
- Embed
- Rerank
- Tool Use / agentic workflows
- VPC/on-prem/dedicated Model Vault deployment options
Uncertainties:
- North and Compass packaging and availability must be source-verified.
- Model version names and deployment options change and must be live-verified.

14. Mistral AI
Measure and assess:
- Le Chat
- Le Chat Enterprise
- Mistral Studio
- Mistral Vibe
- Mistral API
- Mistral models
- custom agents
- libraries/RAG
- connectors/MCP connectors
- Admin control plane
- self-hosted / cloud / serverless deployment options
Uncertainties:
- Le Chat Enterprise edition capabilities and availability must be verified.
- Model names and deprecations must not be hard-coded.

15. Perplexity
Measure and assess:
- Perplexity Enterprise Pro
- Sonar API
- Sonar models
- Perplexity answer engine / enterprise search
- internal knowledge / trusted web source search where source confirms
Uncertainties:
- Enterprise data retention, deletion, and security claims must be source-verified.
- Model lineup and API names must be kept current.

16. xAI
Measure and assess:
- Grok app / Grok in X, where relevant
- xAI API
- Grok models
- Grok voice models
- Grok image/OCR capabilities where available
- tool use / function calling / structured outputs
Uncertainties:
- xAI model names and retirements change quickly; must be live-verified.
- Enterprise readiness should not be assumed from API availability.

17. Glean
Measure and assess:
- Glean Search
- Glean enterprise AI assistant/work AI
- Glean agents, where source confirms
- enterprise connectors
- permissions-aware search
- workflow/knowledge capabilities
Uncertainties:
- Exact agent product names and packaging must be verified.
- Adoption/customer numbers must not be inferred from marketing claims.

18. Moveworks
Measure and assess:
- Moveworks AI Assistant Platform
- Moveworks Reasoning Engine
- MoveLM, where relevant
- Agent Studio
- employee support AI for IT/HR/Finance/Sales/Marketing/Engineering
- search and action workflow platform
Uncertainties:
- Product/package names and Fortune/customer metrics must be verified.
- ServiceNow acquisition/ownership status, if relevant, must be source-verified before display.

19. Writer
Measure and assess:
- WRITER AI Studio
- Palmyra models
- Writer agents
- governance/supervision layer
- enterprise agent building and deployment capabilities
Uncertainties:
- Palmyra model versions and AI Studio packaging must be verified.
- Customer/product claims must carry source confidence.

20. Harvey
Measure and assess:
- Harvey Assistant
- Harvey Vault
- Harvey Agent Builder
- Workflow Agents
- Library
- legal research/drafting/analysis platform
Uncertainties:
- Workflow Builder naming changed to Agent Builder; maintain alias mapping and show current verified name.
- Legal-specific product scope should be verified from Harvey docs/help centre.

21. Hebbia
Measure and assess:
- Hebbia Matrix
- Matrix Agent
- institutional intelligence platform
- multi-agent workflow execution
- multimodal document/data analysis
- finance/legal/corporate workflows
Uncertainties:
- Hebbia uses product marketing language that must be clearly separated from independently verified performance.
- Claims like AUM, token counts, and production use cases must be source-labelled and confidence-scored.

22. Rogo
Measure and assess:
- Rogo finance AI platform
- Rogo agents
- financial workflow automation
- financial data integrations
- investment memos, Excel models, diligence materials, slide/deck workflows
Uncertainties:
- User counts, daily query counts, and institution counts must be source-labelled.
- Bespoke deployment model may make standardised comparison harder.

23. Nvidia
Measure and assess:
- NVIDIA AI Enterprise
- NVIDIA NIM
- NVIDIA NeMo
- NVIDIA Blueprints
- NVIDIA Omniverse
- NVIDIA Run:ai
- NVIDIA Enterprise AI Factory
- NVIDIA Nemotron models
- GPU/data-centre infrastructure as investment exposure
Uncertainties:
- Nvidia is primarily an AI infrastructure/platform enabler, not an enterprise SaaS assistant vendor.
- Product availability varies by deployment and partner ecosystem.

24. AMD
Measure and assess:
- AMD ROCm
- AMD ROCm for AI
- AMD Instinct accelerators
- ROCm Operations Platform
- AI/HPC software stack
Uncertainties:
- AMD is primarily AI infrastructure/chip exposure in Investor Tools.
- Application/platform capabilities should not be overstated beyond ROCm/accelerator ecosystem.

25. Broadcom
Measure and assess:
- AI infrastructure and networking exposure
- custom silicon / ASIC exposure, where source-backed
- VMware/private cloud AI adjacency, where source-backed
Uncertainties:
- Do not include product claims without specific sources.
- Treat as investment infrastructure exposure unless specific AI platform products are sourced.

26. ASML
Measure and assess:
- semiconductor equipment exposure
- AI chip supply-chain exposure
- indirect/private AI exposure only where investment/strategic relationship is source-backed
Uncertainties:
- ASML is not an AI platform provider.
- Treat as investment infrastructure/supply-chain exposure, not enterprise AI platform capability.

27. Cerebras
Measure and assess:
- Cerebras AI chip/inference/training systems
- AI infrastructure IPO watch
- hardware/software stack where source-backed
Uncertainties:
- IPO data must use S-1/official filing if available; rumours must be rumour-labelled.
- Customer concentration and financials require filing validation.

28. Datacenter / cloud infra adjacency
If providers such as CoreWeave or other GPU clouds are later added:
- treat as AI infrastructure/investment exposure
- require source-backed financial, capacity, and customer concentration data
- do not compare as enterprise AI software platform unless product scope supports it

============================================================
SECTION 3 — INVESTOR TOOLS NAVIGATION STRUCTURE
============================================================

Change the navigation structure.

Current issue:
Investment Intelligence and Investment Simulator are separate top-level concepts.

Required update:
Create one top-level navigation tab titled:

Investor Tools

Investor Tools must be a dropdown menu.

Dropdown options:
1. Investment Intelligence
2. Investment Simulator
3. Public AI Stocks
4. IPO Watch
5. Indirect Exposure Map
6. Investment Briefings
7. Investor Watchlist

Routes:
- /investor-tools
- /investor-tools/intelligence
- /investor-tools/simulator
- /investor-tools/public
- /investor-tools/ipo-watch
- /investor-tools/exposure-map
- /investor-tools/briefings
- /investor-tools/watchlist

Redirect old routes:
- /investing -> /investor-tools/intelligence
- /investing/simulator -> /investor-tools/simulator
- /investing/public -> /investor-tools/public
- /investing/ipo-watch -> /investor-tools/ipo-watch
- /investing/exposure-map -> /investor-tools/exposure-map

UI requirement:
Investor Tools dropdown must visually match the parent AI Enterprise navigation style.

============================================================
SECTION 4 — INVESTMENT SIMULATOR FUNCTIONALITY FIXES
============================================================

The following updates apply only to the Investment Simulator.

4.1 Manual allocation must include vendor selection
--------------------------------------------------

When allocationStyle = manual:

Show a follow-on dropdown/multiselect:
- label: Select vendors
- supports public direct vendors, private watchlist vendors, indirect exposure vendors, and cash
- filtered by Investment Universe
- every selected vendor must appear in allocation table
- every allocation row must include:
  - vendor
  - ticker/private status
  - exposure type
  - investability status
  - allocation %
  - amount
  - evidence status
  - warning if not directly investable

Validation:
- allocations must total 100%, or 100% including cash reserve
- if allocations do not total 100%, show error immediately
- if private_inaccessible is selected in a direct portfolio, show error or force watchlist/indirect mode
- if IPO watch vendor is selected, label as IPO watch not currently directly investable

4.2 Add single-stock investment portfolio option
------------------------------------------------

Add allocationStyle option:
- single_stock

When allocationStyle = single_stock:
- show dropdown: Select one public direct vendor/ticker
- allow optional compare-against benchmark:
  - AI platform basket
  - AI infrastructure basket
  - market index placeholder
  - cash
- output charts should focus on one holding:
  - scenario fan chart
  - drawdown chart
  - risk radar
  - catalyst timeline
  - valuation risk
  - confidence heatmap for that provider
- do not allow private_inaccessible or IPO_watch as “single stock”
- if user wants IPO candidate, route to IPO Simulator mode instead

4.3 Investment Universe separation must be accurate
---------------------------------------------------

Current issue:
When selecting IPO Watch, public direct vendors like Amazon and Microsoft are included in the portfolio.

Fix:
Investment Universe must hard-filter vendors by investabilityStatus and exposureClass.

InvestmentUniverse options:

1. public_only
Allowed:
- public_direct
- etf_indirect if enabled
Excluded:
- ipo_watch
- private_inaccessible
- accredited_only

2. public_and_indirect
Allowed:
- public_direct
- public_indirect
- etf_indirect
Excluded:
- ipo_watch unless “include IPO watchlist” is explicitly toggled
- private_inaccessible

3. ipo_watch
Allowed:
- ipo_watch only
- private companies with IPOProfile
Excluded:
- public_direct tickers such as Amazon, Microsoft, Alphabet, Nvidia
- public companies may appear only in “indirect exposure context” sidebar, not portfolio allocation

4. speculative_all
Allowed:
- public_direct
- public_indirect
- ipo_watch
- accredited_only watchlist items
Excluded:
- not_legitimately_accessible as direct allocation
Rules:
- private_inaccessible can appear only as watchlist/exposure node, not direct holding

5. single_stock
Allowed:
- public_direct only

Create function:
filterInvestmentUniverse(universe, providers)

Add tests:
- IPO watch universe must contain no public_direct vendors
- public_only must contain no ipo_watch vendors
- single_stock must contain only public_direct vendors
- private_inaccessible must never be directly investable
- indirect exposure nodes cannot be mistaken for direct holdings

4.4 Apply Shock function must include time period and randomised shock
---------------------------------------------------------------------

Current issue:
Apply shock lacks timing and shock detail.

Fix:
Add shock controls:
- shockMode:
  - manual
  - randomised
- shockYear:
  - user-selectable from year 1 to horizonYears
  - if randomised, randomly choose integer year between 1 and horizonYears
- shockType:
  - valuation_compression
  - capex_spike
  - cloud_growth_slowdown
  - regulatory_shock
  - ipo_lockup_selloff
  - infrastructure_shortage
  - model_commoditisation
  - enterprise_adoption_slowdown
  - market_liquidity_shock
  - ai_safety_incident
- shockSeverity:
  - low
  - medium
  - high
  - severe
  - if randomised, randomly choose using weighted probabilities

When Apply Shock is clicked:
- generate shock object:
  - id
  - shockType
  - shockLabel
  - shockDescription
  - shockYear
  - shockSeverity
  - affectedExposureClasses
  - affectedProviders
  - scenarioImpact
  - generatedAt
  - randomSeed
- show visible shock banner:
  “Shock applied in Year {shockYear}: {shockLabel} — {severity}.”
- update scenario fan chart immediately
- update drawdown chart immediately
- update contribution waterfall immediately
- update risk radar immediately
- update provider table immediately

Randomisation:
Use deterministic seeded random if possible so results are reproducible.
If not, show generatedAt and randomSeed.

4.5 Info buttons next to every variable input
---------------------------------------------

Add info (i) buttons/tooltips next to all variable input options.

Required inputs:
- startingCapital
- horizonYears
- riskProfile
- allocationStyle
- investmentUniverse
- selectedVendors
- region
- includePrivateExposure
- rebalanceFrequency
- cashReservePct
- shockMode
- shockYear
- shockType
- shockSeverity
- valuationCompressionPct
- capexSpikePct
- cloudGrowthSlowdownPct
- regulatoryShockSeverity
- ipoLockupSelloffPct
- infrastructureShortageSeverity
- modelCommoditisationSeverity
- enterpriseAdoptionSlowdownPct
- singleStockTicker

Each info button must explain:
- what the variable means
- how it affects outputs
- whether it affects charts
- whether it affects risk scores
- whether it changes universe filtering
- any important limitation

Tooltip example:
Investment Universe:
“Controls which providers are eligible for portfolio allocation. IPO Watch contains only private or pre-IPO candidates and does not include public stocks such as Microsoft or Amazon. Public companies may still appear as indirect exposure routes.”

4.6 Cross-feed integrity and immediate output updates
-----------------------------------------------------

Comprehensively ensure all variable input and functionality/output cross-feeds accurately and truthfully into relevant functions and outputs immediately.

Implement a CrossFeedValidator.

Every input must declare:
- id
- dependentFunctions
- dependentOutputs
- chartsAffected
- requiredFor
- validationRules

Every output must declare:
- id
- requiredInputs
- sourceFunctions
- dataDependencies
- staleIfInputsChange

On any input change:
- recalculate dependent functions
- update dependent outputs immediately
- mark stale outputs as stale until recalculation completes
- if recalculation fails, show error
- if a required variable does not feed into a dependent output, show error

Error examples:
- “Cross-feed error: allocationStyle changed but portfolio holdings did not update.”
- “Cross-feed error: shockYear changed but scenario fan chart still uses old shock timing.”
- “Cross-feed error: Investment Universe = IPO Watch but public_direct vendors remain in portfolio.”
- “Data integrity error: selectedVendors does not match allocation table.”
- “Simulation blocked: private_inaccessible provider selected as direct holding.”

Add tests:
- changing investmentUniverse updates available vendors
- changing allocationStyle updates the correct subform
- selecting manual vendors updates allocation table
- applying shock updates all scenario charts
- changing riskProfile updates risk score and radar
- changing horizonYears updates x-axis and scenario paths
- selecting single_stock updates all outputs to one-provider mode
- invalid cross-feed produces visible error

4.7 Auto-scale risk/return scatterplot axes
-------------------------------------------

Current issue:
Risk/return scatterplot has poor vendor spread/readability.

Fix:
Implement dynamic axis scaling.

Function:
calculateScatterAxisDomain(points)

Inputs:
- riskScore
- returnScore / upsideScore
- allocationWeight
- confidence

Rules:
- compute min/max for x and y
- add padding of 8-12%
- if spread is too narrow, enforce minimum domain width
- if all points cluster tightly, use zoomed domain rather than 0-100
- add outlier handling:
  - if one outlier dominates, use compressed scale or annotation
- allow toggle:
  - “Zoom to spread”
  - “Show full 0-100 scale”

Default:
- Zoom to spread enabled

Axis labels:
- X: Risk score
- Y: Upside / investment attractiveness

Tooltip must include:
- provider
- allocation
- risk score
- upside score
- confidence
- investability status
- evidence grade
- main risk

4.8 Color-code indirect exposure network lines by vendor
--------------------------------------------------------

Current issue:
Indirect exposure network connecting lines need vendor-specific colour coding.

Fix:
In the Indirect Exposure Network graphic:
- assign a stable colour to each top/public vendor node
- all edges from a top/public vendor to lower/private/underlying AI providers use that vendor colour
- lower/private provider nodes can have neutral fill or their own accent border
- edge thickness = exposureStrength
- edge opacity = evidenceConfidence
- dashed edge = inferred/estimated exposure
- solid edge = documented/verified exposure
- dotted edge = uncertain/low confidence exposure

Terminology:
- top vendors = public/direct investable providers or primary holding nodes
- bottom vendors = private/underlying/indirect AI providers or IPO watch nodes

Example:
- MSFT -> OpenAI line uses Microsoft colour
- AMZN -> Anthropic and OpenAI lines use Amazon colour
- GOOGL -> Anthropic line uses Google colour
- NVDA -> frontier AI labs line uses Nvidia colour
- ORCL -> Stargate/OpenAI infrastructure exposure line uses Oracle colour

Tooltip for edge:
- source vendor
- target vendor
- exposure type
- exposure strength
- revenue linkage
- dilution penalty
- confidence
- evidence status
- warning: “Indirect exposure is not direct ownership.”

Add legend:
- colour = public/top vendor
- thickness = exposure strength
- opacity = confidence
- dashed = inferred
- solid = documented/verified
- dotted = uncertain

============================================================
SECTION 5 — INVESTOR TOOLS DATA MODELS
============================================================

Update or create these models.

InvestorToolNavItem:
- id
- label
- route
- dropdownGroup
- description

InvestmentProviderProfile:
- id
- providerId
- name
- slug
- ticker
- exposureClass
- exposureType
- publicStatus
- investabilityStatus
- productScopeIds
- aiProviderQualityScore
- investmentAttractivenessScore
- shortTermCatalystScore
- longTermHoldScore
- speculativeUpsideScore
- ipoReadinessScore
- ipoPricingRisk
- retailAccessScore
- valuationRiskScore
- liquidityRiskScore
- capexRiskScore
- regulatoryRiskScore
- infrastructureDependencyScore
- aiCapitalEfficiencyScore
- hypePenalty
- evidenceConfidence
- evidenceGrade
- keyThesis
- mainRisk
- dataStatus
- lastUpdated
- truthRecordIds

InvestmentUniverseFilter:
- universeId
- allowedInvestabilityStatuses
- excludedInvestabilityStatuses
- allowedExposureClasses
- excludedExposureClasses
- warnings

SimulationInputDependency:
- inputId
- dependentFunctions
- dependentOutputs
- chartsAffected
- requiredFor
- validationRules

SimulationOutputDependency:
- outputId
- requiredInputs
- sourceFunctions
- dataDependencies
- staleIfInputsChange

ShockEvent:
- id
- shockMode
- shockType
- shockLabel
- shockDescription
- shockYear
- shockSeverity
- affectedExposureClasses
- affectedProviders
- scenarioImpact
- generatedAt
- randomSeed
- truthRecordIds

InfoTooltip:
- inputId
- title
- description
- affects
- limitations
- examples

ScatterAxisDomain:
- xMin
- xMax
- yMin
- yMax
- xPadding
- yPadding
- zoomMode
- outlierMode

IndirectExposureEdge:
- sourceVendorId
- targetVendorId
- exposureType
- exposureStrength
- revenueLinkage
- dilutionPenalty
- confidence
- evidenceStatus
- lineColor
- lineStyle
- lineWidth
- opacity

ProductScopeItem:
- id
- vendorId
- vendorName
- productName
- productCategory
- productDescription
- measurementScope
- includedInModules
- sourceStatus
- sourceName
- sourceUrl
- evidenceGrade
- confidenceScore
- uncertaintyNotes
- lastVerified
- truthRecordIds

============================================================
SECTION 6 — API ROUTES
============================================================

Add or update:

Investor Tools:
- GET /api/investor-tools/nav
- GET /api/investor-tools/product-scope
- GET /api/investor-tools/product-scope/[vendorId]

Investment Intelligence:
- GET /api/investor-tools/intelligence
- GET /api/investor-tools/public
- GET /api/investor-tools/ipo-watch
- GET /api/investor-tools/exposure-map
- GET /api/investor-tools/briefings
- GET /api/investor-tools/watchlist

Investment Simulator:
- GET /api/investor-tools/simulator/providers
- POST /api/investor-tools/simulator/filter-universe
- POST /api/investor-tools/simulator/simulate
- POST /api/investor-tools/simulator/apply-shock
- POST /api/investor-tools/simulator/validate-cross-feed
- GET /api/investor-tools/simulator/tooltips
- POST /api/investor-tools/simulator/scatter-domain
- GET /api/investor-tools/simulator/exposure-network

Truth Engine:
- GET /api/truth/claims
- GET /api/truth/claims/[id]
- POST /api/truth/validate
- POST /api/truth/flag-unsupported
- GET /api/truth/stale
- POST /api/truth/refresh-required

============================================================
SECTION 7 — TESTING REQUIREMENTS
============================================================

Add tests for:

Truth Engine:
- unsupported claims are not shown as verified
- seed data is labelled as seed
- stale data receives freshness penalty
- missing sourceUrl/sourceName lowers confidence
- contradictory claims trigger validationRequired
- unknown fields display “Unknown” not invented values

Product Scope Registry:
- every vendor has product scope entries or explicit “scope unknown”
- every product has dataStatus and evidenceGrade
- uncertain products display uncertaintyNotes
- no product appears in assessment if not in ProductScopeRegistry
- product names are not hard-coded into UI without registry entries

Investor Tools navigation:
- Investor Tools appears as top-level tab
- dropdown includes Investment Intelligence and Investment Simulator
- old /investing routes redirect to /investor-tools routes

Simulator:
- manual allocation shows vendor selection dropdown
- selected vendors populate allocation table
- single_stock mode allows only public_direct vendors
- IPO watch excludes Amazon, Microsoft, Alphabet, Nvidia, and other public_direct providers
- public_only excludes ipo_watch/private_inaccessible
- private_inaccessible cannot be a direct holding
- Apply Shock generates shockType, shockYear, shockSeverity, and randomSeed
- shockYear affects scenario path at correct time period
- info buttons exist for all variable inputs
- changing every input updates dependent outputs
- invalid cross-feed shows visible error
- risk/return scatterplot auto-scales axes
- indirect exposure lines are colour-coded per top/public vendor
- edge opacity and line style reflect confidence/evidence status

Charts:
- allocation donut uses updated allocations
- scenario fan chart updates when shock applied
- drawdown chart updates when shock applied
- contribution waterfall updates when inputs change
- confidence heatmap reflects evidence grades
- risk radar reflects risk inputs
- scatterplot uses dynamic axis domain

============================================================
SECTION 8 — UX REQUIREMENTS
============================================================

General:
- UI must match parent AI Enterprise portal.
- Use same typography, cards, badges, spacing, navigation, confidence labels, and executive dashboard feel.
- Do not create a disconnected investment-app design.

Investor Tools dropdown:
- title: Investor Tools
- dropdown options clear and scannable
- active subpage highlighted

Simulator:
- Every variable input has info tooltip.
- Inputs have immediate validation.
- Outputs show recalculating/stale/error states.
- Data status badges visible on every chart/table.
- Charts should be highly attractive, readable, and polished.
- Graphs should align with AI Enterprise visual ethos:
  - restrained executive colours
  - high contrast
  - clear legends
  - confidence labels
  - source labels
  - minimal clutter
  - drill-down on hover/click

Required warning text:
“This module is for market intelligence and hypothetical scenario modelling only. It is not financial advice. Outputs are based on estimated or seed assumptions unless explicitly marked verified. Future returns are not guaranteed.”

Additional warning:
“Private companies and IPO watchlist providers may not be directly investable by retail users.”

Additional warning:
“Indirect exposure is not the same as direct ownership of the private AI provider.”

============================================================
SECTION 9 — DEVELOPMENT ORDER
============================================================

Recommended build order:

1. Implement Truth Engine models and data-status badges.
2. Implement Product Scope Registry.
3. Add Investor Tools top-level dropdown navigation.
4. Move/redirect investment pages under /investor-tools.
5. Fix Investment Universe filtering.
6. Add manual vendor selection subform.
7. Add single-stock portfolio mode.
8. Add info tooltips for all inputs.
9. Add shock randomisation with shockYear and shockType.
10. Add CrossFeedValidator and visible integrity errors.
11. Add dynamic scatterplot axis scaling.
12. Add colour-coded indirect exposure network edges.
13. Update seed data with ProductScopeRegistry links.
14. Add tests.
15. Run build and fix TypeScript/lint/test failures.
16. Document remaining uncertain data and required source validation.

============================================================
SECTION 10 — FINAL DELIVERY REQUIREMENTS
============================================================

Deliver:

- one Investor Tools top-nav dropdown
- Investment Intelligence under Investor Tools
- Investment Simulator under Investor Tools
- Product Scope Registry page or advanced table
- No-hallucination Truth Engine
- data-status badges everywhere
- source/evidence/confidence tracking
- simulator fixes requested by product owner
- highly attractive graphs aligned with AI Enterprise
- test suite covering truthfulness, filtering, shock logic, cross-feed integrity, and graph logic
- README update
- architecture notes
- TODO list for unresolved product-scope uncertainties

Final instruction:
If any output cannot be supported by source-backed, clearly labelled seed, estimated, inferred, documented, tested, or verified data, the product must show “Unknown” or “Requires validation.” It must never fill the gap with invented content.


---

## investor_tools/ai_enterprise_zero_hallucination_investor_tools_combined_prompt_pack.txt

AI ENTERPRISE — ZERO-HALLUCINATION INVESTOR TOOLS + PRODUCT SCOPE DEVELOPMENT PROMPT PACK
=========================================================================================
Date: 7 May 2026
Timezone: Europe/London

Purpose
-------
This is a single consolidated prompt pack for development agents working on AI Enterprise.

It combines:
1. Strict no-hallucination / no-false-output rules for the entire AI Enterprise platform.
2. A vendor/product inventory covering the AI products, services, platforms, models, agents, and infrastructure exposures currently in scope.
3. The Investor Tools module, combining Investment Intelligence and Investment Simulator under one parent tab.
4. Updates and fixes to simulator functionality.
5. Data integrity, cross-feed validation, graphing requirements, and UI/UX alignment with the parent AI Enterprise portal.

Use this as the controlling prompt for development agents.

Critical Product Name
---------------------
Use the parent portal name: AI Enterprise.

If existing code has the misspelling “AI Enterpise”, preserve legacy IDs only where needed to avoid breaking routes/data.
User-facing labels should use “AI Enterprise” unless product owner explicitly says otherwise.

=========================================================================================
SECTION 1 — ABSOLUTE TRUTHFULNESS / NO-HALLUCINATION POLICY
=========================================================================================

Primary instruction:
AI Enterprise must never present hallucinated, false, unverified, outdated, or unsupported claims as fact.

Every claim shown in the UI must be backed by a structured evidence record or clearly labelled as:
- seed data
- estimated
- inferred
- unverified
- needs validation
- unknown

No unlabelled factual claim may appear in:
- dashboards
- provider profiles
- investment outputs
- simulator outputs
- charts
- hover tooltips
- news cards
- executive briefings
- exports
- PDFs
- board packs
- API responses intended for display

Hard rule:
If a value or claim has no supporting source, display “Unknown”, “Not enough evidence”, or “Seed estimate — not verified”.
Do not invent missing numbers.

Required data-status labels:
- seed
- estimated
- inferred
- documented
- tested
- verified
- stale
- disputed
- unknown

Required evidence grades:
- E0: no evidence
- E1: vendor claim only
- E2: public documentation
- E3: public test, agent test, sandbox/API verification
- E4: production customer evidence
- E5: independent audit, verified benchmark, or third-party validation

All rendered claims must include:
- claimId
- entityId
- entityType
- claimText
- value
- unit
- dataStatus
- evidenceGrade
- confidenceScore
- sourceIds
- sourceUrls
- sourceNames
- sourceDates
- capturedAt
- lastVerifiedAt
- staleAfter
- uncertaintyNote
- isEstimated
- isSeedData
- isUserGenerated
- isModelGenerated

If a claim is model-generated, it must have:
- source claims used
- confidence score
- reasoning summary
- uncertainty note
- no unsupported extrapolation

Do not allow LLM outputs into production views unless the output is traceable to evidence records.

=========================================================================================
SECTION 2 — ZERO-HALLUCINATION ENGINEERING REQUIREMENTS
=========================================================================================

Build or enforce the following truthfulness architecture:

1. Evidence Registry
--------------------
Create a central evidence registry.

Every source must be stored as:
EvidenceSource:
- id
- entityType
- entityId
- sourceType
- sourceName
- sourceUrl
- sourceDate
- capturedAt
- publisher
- isOfficialSource
- isPrimarySource
- isLicensedSource
- evidenceGrade
- confidenceScore
- freshnessStatus
- notes

2. Claim Registry
-----------------
Create a claim registry that maps every platform-visible claim to evidence.

Claim:
- id
- entityType
- entityId
- claimType
- claimText
- numericValue
- unit
- period
- geography
- sourceIds
- evidenceGrade
- confidenceScore
- dataStatus
- uncertaintyNote
- createdAt
- updatedAt
- lastVerifiedAt
- expiryDate

3. Claim Rendering Guard
------------------------
Create a UI helper:
renderClaim(claim)

Rules:
- If evidenceGrade = E0, render as “Unknown” unless explicitly seed.
- If isSeedData = true, show “Seed estimate — not verified”.
- If staleAfter < today, show “Stale data — refresh required”.
- If confidenceScore < 40, show “Low confidence”.
- If sources conflict, show “Conflicting sources”.
- Do not suppress uncertainty notes.

4. No Unsupported Outputs
-------------------------
No component may display:
- market share
- adoption percentage
- valuation
- revenue
- ARR
- product availability
- IPO probability
- investment ranking
- product capability
- customer count
- benchmark score
- provider claim
without evidence metadata.

5. CI / Test Requirements
-------------------------
Add tests that fail when:
- a UI component renders a numeric data point without source metadata
- a vendor product appears without a productScope record
- simulator output changes without state/hash update
- chart data is stale or mismatched
- private company is treated as directly investable
- IPO watch includes public companies as direct holdings
- shock output does not show shock timing and shock details
- scatter chart axes fail to recompute after data changes
- a briefing includes unsourced statements
- seed data is displayed without a seed/estimated label

=========================================================================================
SECTION 3 — PLATFORM-WIDE VENDOR / PRODUCT SCOPE INVENTORY
=========================================================================================

Create a structured ProductScope registry covering all AI products, services, platforms, models, agents, infrastructure products, and investment exposures measured within AI Enterprise.

Important:
This initial scope is not guaranteed exhaustive. Each product entry must include source status and uncertainty.

ProductScope:
- id
- vendorId
- vendorName
- productName
- productCategory
- productType
- moduleCoverage
- measuredInModules
- evidenceStatus
- confidenceScore
- sourceIds
- uncertaintyNote
- includeInAssessment
- includeInMarketIntelligence
- includeInInvestorTools
- includeInSimulator

Product categories:
- enterprise_assistant
- model_api
- coding_agent
- agent_platform
- agent_governance
- enterprise_search
- rag_knowledge
- data_ai_platform
- cloud_ai_platform
- workflow_ai
- crm_ai
- hr_ai
- legal_ai
- finance_ai
- developer_ai
- security_ai
- ai_infrastructure
- ai_compute
- ai_networking
- semiconductor_equipment
- sovereign_ai
- investment_exposure

Initial vendor/product inventory
--------------------------------

1. OpenAI
Products / capabilities in scope:
- ChatGPT Enterprise
- ChatGPT Business
- ChatGPT Edu
- ChatGPT agent
- Deep Research
- Codex
- OpenAI API / Responses API
- enterprise connectors
- file uploads / data analysis / canvas / search / advanced voice / image generation
- Sora / video generation where relevant
- models exposed in ChatGPT/API where officially available
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- News Intelligence
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Exact current model availability changes frequently.
- Sora and image/video features may vary by plan, geography, and date.
- Enterprise product availability and limits must be source-refreshed before rendering.

2. Microsoft
Products / capabilities in scope:
- Microsoft 365 Copilot
- Microsoft Agent 365
- Microsoft 365 E7 / Frontier Suite
- Work IQ
- Microsoft Entra
- Microsoft Defender
- Microsoft Intune
- Microsoft Purview
- Azure AI / Azure AI Foundry if present in codebase
- Azure Copilot
- Copilot Studio
- GitHub Copilot if included in vendor/product map
- Dynamics 365 AI / Power Platform AI if included later
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Product naming and packaging may evolve.
- Some Microsoft AI capabilities overlap across M365, Azure, GitHub, Dynamics, and Power Platform.
- Use product-specific source records to avoid double counting.

3. Google / Alphabet
Products / capabilities in scope:
- Gemini Enterprise
- Gemini models
- Vertex AI
- Vertex AI Studio
- Vertex AI Agent Builder
- Agent Development Kit
- Agent Engine
- Agent Garden
- Model Garden
- Gemini for Google Workspace if included
- Google Gen AI SDK migration-related developer tooling
- TPU / Google Cloud AI infrastructure exposure for Investor Tools
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Gemini Enterprise, Vertex AI, and Workspace Gemini must be treated as related but distinct products.
- Some agent capabilities may be preview/beta and must be labelled accordingly.

4. AWS / Amazon
Products / capabilities in scope:
- Amazon Bedrock
- Amazon Bedrock Marketplace
- Amazon SageMaker AI
- Amazon SageMaker Unified Studio
- Amazon Q Business
- Amazon Q Developer
- Amazon Nova
- Amazon Titan
- Trainium
- Inferentia
- AWS AI infrastructure
- Bedrock model providers including Anthropic, Cohere, Mistral, Meta, OpenAI open-weight models, etc. where source-supported
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Model provider availability in Bedrock changes frequently.
- Distinguish AWS-native products from third-party models hosted through AWS.
- Do not count third-party models as AWS-owned products.

5. Anthropic
Products / capabilities in scope:
- Claude
- Claude Enterprise / Team where source-supported
- Claude API
- Claude Code
- Claude model family
- Claude connectors / enterprise usage where source-supported
- Claude Managed Agents / Claude Cowork only if source-confirmed
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- News Intelligence
- Investor Tools
- Investment Simulator
Uncertainties:
- Managed Agents / Cowork naming and availability must be verified.
- Some reported products may be beta, research preview, or media-reported only.
- Do not treat media-reported product names as verified without official source.

6. Salesforce
Products / capabilities in scope:
- Agentforce
- Agentforce 360
- Agentforce Builder
- Agentforce Voice
- Agent Script
- Atlas Reasoning Engine
- Einstein
- Data Cloud / Data 360
- Slack AI / Slack integrations where source-supported
- Salesforce AI CRM
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Salesforce product naming shifted around Agentforce, Agentforce 360, Einstein, and Data 360.
- Verify exact current packaging and revenue disclosure before using investment outputs.

7. ServiceNow
Products / capabilities in scope:
- ServiceNow AI Platform
- Now Assist
- AI Control Tower
- Action Fabric
- MCP Server
- AI Gateway
- AI Agent Advisor
- AI-powered setup
- AI-powered center
- Evaluation Suite
- Autonomous Workforce
- Otto
- Project Arc
- ServiceNow AI specialists
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Some features announced at Knowledge 2026 are rolling availability, Innovation Lab, or future GA.
- Label availability stage.

8. Oracle
Products / capabilities in scope:
- Oracle Fusion Agentic Applications
- Fusion Agentic Applications for CX
- Fusion Agentic Applications for HR
- Oracle AI Agent Studio for Fusion Applications
- Agentic Applications Builder
- OCI Generative AI
- Oracle Fusion Cloud Applications AI features
- Oracle Cloud Infrastructure AI/data-centre exposure for Investor Tools
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Distinguish Oracle application agents from OCI model/platform services.
- Availability varies by product family and region.

9. SAP
Products / capabilities in scope:
- SAP Business AI
- Joule
- Joule Agents
- Joule Studio
- Joule Studio code editor
- Joule Studio CLI
- Joule Skills
- SAP Signavio + Joule
- SAP CX / Engagement Cloud agent integrations
- SAP BTP AI-related capabilities where source-supported
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Exact number of Joule agents/skills changes.
- Verify current availability and scope by SAP application.

10. IBM
Products / capabilities in scope:
- IBM watsonx
- IBM watsonx Orchestrate
- IBM Bob
- IBM Concert
- watsonx.data context layer
- IBM Confluent integration / real-time AI-ready data foundation
- IBM Sovereign Core
- hybrid cloud AI management
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Some Think 2026 capabilities may be private preview or announced but not GA.
- Label availability.

11. Snowflake
Products / capabilities in scope:
- Snowflake Cortex AI
- Snowflake Intelligence
- Cortex Agents
- Cortex Analyst
- Cortex Search
- Cortex AI Functions
- Cortex Code
- Snowflake AI Data Cloud
- Project SnowWork only if source-confirmed
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Some products may be preview/research preview.
- Distinguish Cortex AI suite from Snowflake Intelligence and Cortex Code.

12. Databricks
Products / capabilities in scope:
- Databricks Data Intelligence Platform
- Mosaic AI
- Agent Bricks
- Genie
- Lakebase
- MLflow evaluation
- Unity Catalog governance
- AI Gateway
- MCP catalog/support where source-supported
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Some Agent Bricks capabilities may be beta/preview.
- Verify availability by cloud and workspace.

13. Cohere
Products / capabilities in scope:
- North
- Compass
- Command
- Embed
- Rerank
- Model Vault / deployment options where source-supported
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Exact product packaging and plan availability must be verified.

14. Mistral AI
Products / capabilities in scope:
- Le Chat
- Le Chat Enterprise
- Studio
- Mistral API / La Plateforme
- Mistral Vibe
- Admin
- Mistral models
- custom agents
- code interpreter / web search / document analysis / Canvas where source-supported
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Product names and capabilities change quickly.
- Enterprise features, remote agents, and work mode must be source-confirmed before display.

15. Glean
Products / capabilities in scope:
- Glean Assistant
- Glean Agents
- Glean Search
- Glean Protect
- enterprise work AI platform
- enterprise connectors/search across SaaS tools
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Exact product packaging and AI agent functionality should be verified from official source.

16. Moveworks
Products / capabilities in scope:
- Moveworks AI Assistant Platform
- Reasoning Engine
- AI Agent Marketplace
- business initiative agent bundles
- integrations across HR, IT, Finance, Procurement, Engineering, Sales, Marketing, etc.
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools if applicable
Uncertainties:
- Customer/adoption figures must be source dated.
- Marketplace agent counts may change.

17. Writer
Products / capabilities in scope:
- Writer AI Studio
- Palmyra-powered agents
- Writer Knowledge Graph if source-supported
- governance and agent lifecycle features
- enterprise agent platform
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools / Simulator if included as private watch
Uncertainties:
- Product naming and model-family availability must be verified.

18. Harvey
Products / capabilities in scope:
- Harvey Assistant
- Harvey Vault
- Harvey Workflow Agents
- Harvey Agents
- Agent Builder
- History
- Library
- Microsoft 365 Copilot integration
- legal/professional services AI workflows
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools
- Investment Simulator
Uncertainties:
- Daily task counts, customer counts, and valuation must be source-dated.
- Product availability may be restricted to legal/professional-services customers.

19. Hebbia
Products / capabilities in scope:
- Hebbia Matrix
- multi-step workflow AI
- multimodal reasoning
- citations / transparent agent actions
- enterprise integrations
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment
- Capability Tracker
- Investor Tools / Simulator if included as private watch
Uncertainties:
- Product scope and customer usage figures must be verified.

20. Rogo
Products / capabilities in scope:
- Rogo financial AI platform
- autonomous financial agents
- financial data/platform integrations
- institutional outputs such as Excel models, investment memos, diligence materials, slide decks
Measured in:
- Market Intelligence
- Vendor Profiles
- AI Platform Fit Assessment for finance use cases
- Investor Tools / Simulator if included as private watch
Uncertainties:
- Product documentation depth is limited.
- Verify product modules, customers, and funding before investment outputs.

21. Perplexity
Products / capabilities in scope:
- Perplexity Enterprise Pro where source-supported
- Sonar API
- Sonar Pro API
- real-time web answer/research API with citations
Measured in:
- Market Intelligence
- Capability Tracker
- Investor Tools / Simulator if included
Uncertainties:
- Enterprise product naming and plan details must be source-confirmed.
- API features and pricing change.

22. xAI
Products / capabilities in scope:
- Grok
- Grok API if officially source-confirmed
- Grok on X
- Grok coding/API features only if official source-confirmed
Measured in:
- Market Intelligence
- News/Risk Intelligence
- Investor Tools / Simulator if included
Uncertainties:
- Treat non-official reports as unverified.
- Grok product capabilities and enterprise suitability require official confirmation.
- Content-safety/regulatory risk must be tracked.

23. NVIDIA
Products / capabilities in scope:
- NVIDIA GPUs / Blackwell / Blackwell Ultra where source-supported
- NVIDIA DGX
- DGX SuperPOD
- NVIDIA NIM
- NVIDIA NeMo
- NVIDIA AI Enterprise if included
- NVIDIA Enterprise AI Factory / validated designs where source-supported
- NVIDIA networking / AI infrastructure exposure
Measured in:
- Market Intelligence
- Infrastructure Intelligence
- Investor Tools
- Investment Simulator
Uncertainties:
- Distinguish NVIDIA as infrastructure enabler, not general enterprise AI platform provider.

24. AMD
Products / capabilities in scope:
- AMD Instinct accelerators where source-supported
- Ryzen AI
- Ryzen AI PRO
- Ryzen AI Max+
- Ryzen AI Halo
- ROCm
- EPYC AI infrastructure exposure where source-supported
Measured in:
- Infrastructure Intelligence
- Investor Tools
- Investment Simulator
Uncertainties:
- Distinguish client AI chips from data-centre AI accelerators.
- Verify AI accelerator product names separately.

25. Broadcom
Products / capabilities in scope:
- Tomahawk 6
- Jericho4
- AI networking/switching/routing for scale-up and scale-out clusters
- co-packaged optics / AI networking where source-supported
Measured in:
- Infrastructure Intelligence
- Investor Tools
- Investment Simulator
Uncertainties:
- Broadcom is an AI infrastructure enabler, not an enterprise AI software provider.
- Avoid comparing software capabilities against software vendors.

26. ASML
Products / capabilities in scope:
- EUV lithography systems
- High-NA EUV / EXE systems
- DUV lithography where relevant
- semiconductor manufacturing exposure for AI chips
Measured in:
- Infrastructure Intelligence
- Investor Tools
- Investment Simulator
Uncertainties:
- ASML is a semiconductor equipment supplier, not an AI software provider.
- Use only as indirect AI infrastructure exposure.

27. Arm
Products / capabilities in scope:
- Arm compute/IP exposure for AI workloads where source-supported
- AI edge/mobile/server architecture exposure where source-supported
Measured in:
- Infrastructure Intelligence
- Investor Tools
- Investment Simulator
Uncertainties:
- Product-level AI scope must be source-confirmed before detailed provider scoring.

=========================================================================================
SECTION 4 — SOURCE / UNCERTAINTY RULES FOR PRODUCT INVENTORY
=========================================================================================

For every ProductScope item:
- If official source confirms it, mark evidenceStatus = documented.
- If media source reports it but no official source confirms it, mark evidenceStatus = inferred or unverified.
- If only seed data exists, mark evidenceStatus = seed.
- If product name has changed or availability is unclear, mark uncertaintyNote.
- If availability is preview/beta/Innovation Lab/research preview, display this clearly.
- If product is third-party-hosted on a cloud marketplace, distinguish owner vs host.

Do not double count:
- OpenAI models hosted in AWS Bedrock as AWS-owned models.
- Anthropic Claude available on AWS/Google as AWS/Google-owned models.
- Salesforce/Google joint integrations as standalone products unless separately productized.
- Infrastructure exposure as software-platform capability.

=========================================================================================
SECTION 5 — INVESTOR TOOLS NAVIGATION UPDATE
=========================================================================================

Combine Investment Intelligence and Investment Simulator under one top-level tab titled:

Investor Tools

Navigation:
- Investor Tools
  - Investment Intelligence
  - Public AI Stocks
  - IPO Watch
  - Exposure Map
  - Investment Simulator
  - Investor Briefing
  - Investor Watchlist

Routes:
- /investor-tools
- /investor-tools/intelligence
- /investor-tools/public
- /investor-tools/ipo-watch
- /investor-tools/exposure-map
- /investor-tools/simulator
- /investor-tools/briefing
- /investor-tools/watchlist

If existing code uses /investing routes, keep redirects or aliases:
- /investing -> /investor-tools
- /investing/simulator -> /investor-tools/simulator

UI:
- Investor Tools should be one tab in the AI Enterprise top navigation.
- Dropdown should appear on hover and click.
- Use parent portal styling.
- Do not create a separate visual identity.

=========================================================================================
SECTION 6 — INVESTMENT INTELLIGENCE FUNCTIONALITY
=========================================================================================

Investment Intelligence must include:
- AI Provider Quality Score
- Investment Attractiveness Score
- Short-Term Catalyst Score
- Long-Term Hold Score
- Speculative Upside Score
- IPO Readiness Score
- IPO Pricing Risk
- Post-IPO Behaviour Forecast
- Retail Access / Investability Score
- Indirect Exposure Score
- AI Capital Efficiency Score
- Hype Penalty
- Valuation Discipline Score
- Financial Data Confidence Score

Core rule:
A strong AI provider is not automatically a strong investment.

Separate:
1. AI Provider Quality
2. Investment Attractiveness
3. Investability / Access
4. Time Horizon Fit
5. Confidence / Evidence Quality

Do not output direct buy/sell advice.

Allowed language:
- “ranks highest under this model”
- “watchlist candidate”
- “valuation-sensitive”
- “requires evidence validation”
- “not directly investable”
- “speculative”
- “higher conviction under available evidence”

Disallowed language:
- “buy”
- “sell”
- “guaranteed return”
- “sure thing”
- “risk-free”
- “will outperform”

=========================================================================================
SECTION 7 — SIMULATOR UPDATES ONLY
=========================================================================================

The following updates apply specifically to the Investment Simulator.

7.1 Manual allocation style vendor dropdown
-------------------------------------------
When allocationStyle = manual:
- Show a follow-on dropdown/multi-select to select vendors.
- User must be able to add holdings one by one.
- Each selected vendor shows:
  - ticker or private status
  - exposure type
  - investability status
  - allocation %
  - amount
  - confidence
  - warning if not directly investable
- Validate total allocation + cash reserve = 100%.
- If not 100%, show error and disable simulation run.

Manual allocation flow:
1. User selects manual allocation.
2. Vendor selection dropdown appears.
3. User selects eligible vendors based on investmentUniverse.
4. User enters allocation weights.
5. System validates eligibility and totals.
6. Charts update immediately.

7.2 Investment Universe separation fix
--------------------------------------
Investment Universe must accurately separate vendors.

InvestmentUniverse options and rules:

public_only:
- Include only public_direct investabilityStatus.
- Examples: MSFT, GOOGL, AMZN, NVDA, ORCL, NOW, CRM, SNOW, SAP, IBM, ASML, AMD, AVGO, ARM if seeded.
- Exclude OpenAI, Anthropic, Databricks, Cerebras, Harvey, Cohere, Mistral, Glean, Perplexity, xAI, Writer, Hebbia, Rogo.
- Do not include IPO watch private companies.
- Do not include private_inaccessible.

public_and_indirect:
- Include public_direct companies.
- Show indirect exposure links to private providers.
- User can allocate to public tickers only.
- Private companies may appear in exposure map but not as direct holdings.

ipo_watch:
- Include IPO watch/private candidates only.
- Examples: OpenAI, Anthropic, Databricks, Cerebras, Harvey, Cohere, Mistral, Glean, Perplexity, xAI, Writer, Hebbia, Rogo.
- Do not include Amazon, Microsoft, Alphabet, Nvidia, Oracle, or other public companies as direct portfolio holdings.
- If user wants indirect exposure to IPO watch names, direct them to public_and_indirect.
- IPO watch holdings must show “not directly investable unless IPO/access event occurs”.

speculative_all:
- Include high-beta public names + IPO watch names + indirect exposure options.
- Direct private allocations disabled unless investabilityStatus permits.
- Private names can appear as scenario/watchlist items, not ordinary tradable holdings.

Error condition:
If investmentUniverse = ipo_watch and a public company appears as direct portfolio holding, show:
“Universe error: IPO Watch cannot include public direct holdings. Select Public + Indirect for public exposure to private AI providers.”

7.3 Apply Shock function
------------------------
Apply Shock must indicate:
- shock type
- shock severity
- time period when shock occurs
- affected holdings
- affected exposure classes
- affected outputs
- confidence

Shock timing:
- Randomise shock timing within selected horizon.
- Allow deterministic random seed for reproducibility.
- Example: Year 2, Quarter 3.
- Display visually on scenario fan chart and drawdown chart.

Shock types:
- valuation compression
- capex spike
- cloud growth slowdown
- regulatory shock
- IPO lock-up selloff
- infrastructure shortage
- model commoditisation
- enterprise adoption slowdown
- security incident
- AI litigation event
- interest-rate shock
- data-centre energy constraint

Shock generator:
generateRandomShock(horizonYears, selectedUniverse, riskProfile, seed)

Must return:
- shockId
- shockType
- shockLabel
- shockDescription
- shockYear
- shockQuarter
- severity
- affectedProviderIds
- affectedExposureClasses
- parameterImpacts
- displayMessage

Example display:
“Shock applied: Valuation compression event in Year 2 Q3. Affected: AI infrastructure and IPO watch holdings. Stress-case valuation multiple reduced by 22%.”

7.4 Info buttons
----------------
Insert info (i) buttons next to every variable input.

Every info button should explain:
- what the variable means
- how it affects the simulation
- whether it affects eligibility, scoring, or charts
- any limitation or uncertainty

Inputs requiring info buttons:
- startingCapital
- horizonYears
- riskProfile
- allocationStyle
- investmentUniverse
- region
- includePrivateExposure
- rebalanceFrequency
- cashReservePct
- vendor selection
- allocation %
- risk shocks
- scenario type
- confidence score
- evidence grade
- IPO readiness
- valuation risk
- long-term hold score
- speculative upside score
- indirect exposure score

7.5 Cross-feed integrity
------------------------
Comprehensively ensure all variable input and functionality/output cross-feeds accurately and truthfully into relevant functions and outputs immediately.

Create a central simulation state model:
SimulationState:
- input
- eligibleUniverse
- selectedHoldings
- allocationValidation
- scenarioAssumptions
- shocks
- computedPaths
- computedScores
- chartData
- evidenceStatus
- errors
- lastUpdatedAt
- stateHash

Every output must derive from current SimulationState.

No stale output allowed.

When any input changes:
- recompute eligibleUniverse
- recompute holdings validation
- recompute allocation totals
- recompute scenario assumptions
- recompute portfolio scores
- recompute scenario paths
- recompute drawdown
- recompute chart data
- recompute confidence
- update stateHash
- update UI immediately

If any output cannot be recomputed:
Show error:
“Simulation integrity error: output is not synced with current inputs.”

Do not silently use stale values.

Cross-feed tests:
- changing riskProfile updates scenario returns and risk radar
- changing investmentUniverse updates eligible vendor dropdown
- changing allocation updates donut, scatter, fan chart, drawdown, scores
- applying shock updates fan chart, drawdown, waterfall, risk radar
- selecting ipo_watch removes public stocks from direct holdings
- selecting public_only removes private/IPO watch names
- changing horizon updates scenario path length and x-axis
- changing cashReserve updates allocation donut and portfolio values
- changing evidence confidence updates confidence heatmap and confidence-adjusted returns

7.6 Scatter plot auto-scaling
-----------------------------
Automatically adjust x and y axes of the risk/return scatter plot to increase vendor spread and readability.

Implement:
calculateScatterDomain(points, axis, options)

Rules:
- Use min/max of visible points.
- Add 12% padding.
- Enforce minimum axis spread of 20 points.
- If values are tightly clustered, expand domain around median.
- Clamp final domain to 0-100 unless out-of-range mode is enabled.
- Avoid all bubbles overlapping.
- Add deterministic small jitter only where labels overlap, but do not distort tooltip values.
- Recompute axes after:
  - investmentUniverse change
  - riskProfile change
  - shock applied
  - manual allocation change
  - selected vendor change

Tooltip must always show true values, not jittered visual positions.

Error condition:
If scatter points are all identical or invalid, show:
“Scatter plot has insufficient spread. Displaying expanded axis for readability.”

=========================================================================================
SECTION 8 — SIMULATOR GRAPHING REQUIREMENTS
=========================================================================================

Graphs must align with AI Enterprise UI/UX ethos:
- clean executive dashboard style
- high contrast but restrained colours
- rounded cards
- clear legends
- confidence badges
- hover tooltips
- source/evidence status
- responsive layouts
- no clutter
- no misleading axes
- no unsupported data

Graph components:
1. Portfolio Allocation Donut
2. Scenario Fan Chart
3. Risk-Return Scatterplot
4. Exposure Network Graph
5. IPO Lifecycle Timeline
6. Drawdown Chart
7. Stacked Exposure Bar
8. Confidence Heatmap
9. Contribution Waterfall
10. Risk Radar

Every graph must show:
- dataStatus
- confidence
- scenario assumptions link or drawer
- “estimated/seed” label where relevant

Do not show graphs from missing data.
If data is missing, show an empty state with what data is required.

=========================================================================================
SECTION 9 — SIMULATOR DATA VALIDATION
=========================================================================================

Validation rules:
- Manual allocations must total 100% including cash reserve.
- Cannot allocate directly to private_inaccessible providers.
- Cannot allocate directly to IPO watch providers unless in ipo_watch scenario mode and clearly marked not currently tradable.
- IPO Watch universe cannot include public direct holdings.
- Public Only universe cannot include private providers.
- Public + Indirect can show private exposure map but allocations must be to public instruments only.
- Speculative All must warn when including non-public names.
- All provider scores must have evidence metadata.
- All generated scenario assumptions must be marked seed/estimated unless validated.
- Shock timing must be shown and saved.
- Chart data must match current simulation state hash.
- If any mismatch is detected, block output and show error.

=========================================================================================
SECTION 10 — INVESTOR TOOLS DATA MODELS
=========================================================================================

Update/add these TypeScript/database models.

InvestorToolNav:
- id
- label
- route
- children

InvestmentProviderProfile:
- id
- providerId
- name
- slug
- ticker
- exposureClass
- exposureType
- publicStatus
- investabilityStatus
- aiProviderQualityScore
- investmentAttractivenessScore
- shortTermCatalystScore
- longTermHoldScore
- speculativeUpsideScore
- ipoReadinessScore
- ipoPricingRisk
- retailAccessScore
- valuationRiskScore
- liquidityRiskScore
- capexRiskScore
- regulatoryRiskScore
- infrastructureDependencyScore
- aiCapitalEfficiencyScore
- hypePenalty
- evidenceConfidence
- evidenceGrade
- keyThesis
- mainRisk
- dataStatus
- lastUpdated
- productScopeIds

ProductScope:
- id
- vendorId
- vendorName
- productName
- productCategory
- productType
- moduleCoverage
- measuredInModules
- evidenceStatus
- confidenceScore
- sourceIds
- uncertaintyNote
- includeInAssessment
- includeInMarketIntelligence
- includeInInvestorTools
- includeInSimulator

SimulationState:
- input
- eligibleUniverse
- selectedHoldings
- allocationValidation
- scenarioAssumptions
- shocks
- computedPaths
- computedScores
- chartData
- evidenceStatus
- errors
- lastUpdatedAt
- stateHash

SimulationInput:
- startingCapital
- horizonYears
- riskProfile
- allocationStyle
- investmentUniverse
- region
- includePrivateExposure
- rebalanceFrequency
- cashReservePct
- selectedVendorIds
- manualAllocations

SimulationHolding:
- providerId
- ticker
- name
- weightPct
- amount
- exposureType
- investabilityStatus
- isDirectlyInvestable
- confidence
- evidenceGrade
- warning

ShockEvent:
- shockId
- shockType
- shockLabel
- shockDescription
- shockYear
- shockQuarter
- severity
- affectedProviderIds
- affectedExposureClasses
- parameterImpacts
- displayMessage
- randomSeed

ChartData:
- chartId
- chartType
- simulationStateHash
- data
- generatedAt
- sourceIds
- confidenceScore
- dataStatus

=========================================================================================
SECTION 11 — API ROUTES
=========================================================================================

Investor Tools:
- GET /api/investor-tools/products
- GET /api/investor-tools/providers
- GET /api/investor-tools/providers/[slug]
- GET /api/investor-tools/public
- GET /api/investor-tools/ipo-watch
- GET /api/investor-tools/exposure-map
- GET /api/investor-tools/briefing
- GET /api/investor-tools/scores

Simulator:
- GET /api/investor-tools/simulator/eligible-universe
- POST /api/investor-tools/simulator/simulate
- POST /api/investor-tools/simulator/apply-random-shock
- POST /api/investor-tools/simulator/validate
- POST /api/investor-tools/simulator/save
- GET /api/investor-tools/simulator/[id]

Evidence:
- GET /api/evidence/sources
- GET /api/evidence/claims
- POST /api/evidence/validate-claim

=========================================================================================
SECTION 12 — TEST REQUIREMENTS
=========================================================================================

Add tests for:

Truthfulness:
- claim without source cannot render as verified
- seed data always shows seed/estimated label
- stale source shows stale warning
- unknown product does not appear in product scope without uncertainty
- LLM-generated brief cannot include unsupported factual claim

Product inventory:
- every vendor has at least one ProductScope record
- every product has evidenceStatus and uncertaintyNote
- every product has module coverage
- third-party hosted models are not counted as cloud-owned models

Investor Tools:
- Investment Intelligence and Simulator appear under Investor Tools dropdown
- legacy /investing routes redirect or alias correctly
- provider pages show product scope and evidence

Simulator:
- manual allocation shows vendor dropdown
- manual allocations validate total allocation
- public_only excludes private/IPO watch
- ipo_watch excludes public stocks
- public_and_indirect allows public holdings and private exposure graph
- random shock includes time period and shock details
- shock changes scenario output
- info buttons exist for all variables
- state hash changes when inputs change
- charts block stale data
- scatter axes auto-scale to improve spread
- chart tooltips show true values

=========================================================================================
SECTION 13 — REQUIRED UI COPY
=========================================================================================

Global investor disclaimer:
“Investor Tools are for market intelligence and hypothetical scenario modelling only. They are not financial advice. Outputs are based on documented, estimated, inferred, or seed data as labelled. Future returns are not guaranteed.”

Private company warning:
“Private companies and IPO watchlist providers may not be directly investable by retail users.”

Indirect exposure warning:
“Indirect exposure is not the same as direct ownership of the private AI provider.”

Seed data warning:
“This view includes seed or estimated data. Replace with verified evidence before using for final decisions.”

Simulation integrity error:
“Simulation integrity error: output is not synced with current inputs. Please review highlighted fields or rerun the simulation.”

Universe error:
“Universe error: IPO Watch cannot include public direct holdings. Select Public + Indirect for public exposure to private AI providers.”

=========================================================================================
SECTION 14 — DEVELOPMENT PRIORITY ORDER
=========================================================================================

1. Add no-hallucination evidence and claim schema.
2. Add ProductScope registry.
3. Add product inventory seed data with uncertainty labels.
4. Add Investor Tools dropdown navigation.
5. Merge Investment Intelligence and Investment Simulator under Investor Tools.
6. Fix investment universe filtering.
7. Add manual allocation vendor dropdown flow.
8. Add simulator state model and cross-feed validation.
9. Add random shock generator with time period display.
10. Add info buttons to all simulator inputs.
11. Add chart data state hashes and stale-output prevention.
12. Add scatter auto-scaling.
13. Add product inventory page/table in advanced/backend view.
14. Add tests.
15. Only then expand live ingestion.

=========================================================================================
FINAL DEVELOPMENT AGENT INSTRUCTION
=========================================================================================

Do not prioritise new visual features over truthfulness.

The order of importance is:
1. Truthfulness and source traceability.
2. Correct product/vendor scope.
3. Accurate universe filtering and simulator state integrity.
4. Clear confidence and uncertainty labelling.
5. Beautiful AI Enterprise-consistent visuals.
6. Advanced graphing and market intelligence polish.

Never invent.
Never silently fill missing data.
Never present seed values as verified.
Never allow stale simulator outputs.
Never treat private companies as directly investable unless legitimate access is explicitly modelled.


---

## market_signals/ai_enterprise_market_signals_engine_investor_tools_addendum.txt

AI ENTERPRISE — MARKET SIGNALS ENGINE ADDENDUM FOR INVESTOR TOOLS
==================================================================
Date: 9 May 2026
Timezone: Europe/London

Purpose
-------
This prompt pack adds a Market Signals Engine to AI Enterprise Investor Tools.

The current Investment Intelligence and Investment Simulator are too dependent on provider fundamentals, IPO mechanics, and seed assumptions. To better model share-price fluctuation, IPO volatility, market movement, and investor sentiment, the investment tab must ingest and score broader signals:

- current events
- macroeconomic indicators
- political and regulatory movements
- market talk
- analyst/market sentiment
- options/volatility signals
- sector momentum
- company-specific news
- AI infrastructure signals
- legal/litigation signals
- geopolitical/export-control signals
- cloud/capex/data-centre signals
- AI adoption and enterprise demand signals

Critical instruction:
Never hallucinate, invent, or imply unsupported causal relationships.
All signals must be source-backed, confidence-scored, time-stamped, and labelled as verified, documented, inferred, estimated, seed, stale, disputed, or unknown.

This module must improve Investment Intelligence and the Investment Simulator while also feeding the wider AI Enterprise platform:
- Market Dashboard
- Vendor Profiles
- News Intelligence
- Market Tracker
- Capability Tracker
- Investor Tools
- Executive Briefings
- Watchlists

============================================================
SECTION 1 — PRODUCT OBJECTIVE
============================================================

Add a new backend layer called:

Market Signals Engine

Purpose:
Convert public and reliably sourced external signals into structured, confidence-weighted inputs for:

1. Short-term catalyst scores
2. Long-term hold scores
3. speculative upside scores
4. IPO month forecasts
5. post-IPO 1-10 month fluctuation bands
6. investment simulator scenarios
7. randomised shock generation
8. who-is-winning / who-is-losing dashboard
9. vendor momentum
10. risk radar
11. executive investment briefings

The Market Signals Engine must not directly say:
“Buy”, “sell”, “guaranteed”, “certain”, “will rise”, or “will fall”.

It may say:
- “This signal increases short-term volatility risk.”
- “This signal widens the modelled fluctuation band.”
- “This signal shifts the base-case centre upward/downward.”
- “Confidence is low because source quality is weak.”
- “This signal is market talk and should not override verified filings or official data.”

============================================================
SECTION 2 — SIGNAL CATEGORIES
============================================================

Create signal categories.

1. Macro Signals
----------------
Examples:
- interest rates
- expected rate cuts/hikes
- CPI / PCE inflation
- unemployment / payrolls
- GDP growth
- yield curve
- credit spreads
- VIX / volatility regime
- USD strength
- liquidity / financial conditions
- PMIs / business surveys
- consumer sentiment

Effect:
Macro signals affect valuation multiples, risk appetite, IPO windows, technology multiples, and high-beta AI names.

2. Political / Regulatory Signals
---------------------------------
Examples:
- AI regulation
- export controls
- chip restrictions
- antitrust investigations
- privacy/data regulation
- public-sector procurement
- defence/critical-infrastructure policy
- tariffs
- tax policy
- election-cycle risk
- government AI investment

Effect:
Political/regulatory signals affect provider risk, infrastructure access, semiconductor supply chains, AI platform adoption, valuation multiples, and IPO timing.

3. Market Sentiment / Market Talk
---------------------------------
Examples:
- high-quality financial news
- analyst commentary
- credible market reports
- earnings-call commentary
- IPO market chatter
- social/media discussion
- search trends
- review/forum sentiment
- developer/community chatter
- institutional positioning if available

Effect:
Market talk can affect short-term volatility and sentiment but must have lower confidence than filings, earnings releases, official statements, or audited data.

Rule:
Market talk must never override verified fundamentals.

4. Company-Specific Signals
---------------------------
Examples:
- earnings releases
- revenue guidance
- AI ARR disclosure
- RPO/backlog
- product launches
- customer wins/losses
- executive changes
- outages
- security incidents
- litigation
- strategic partnerships
- cloud/GPU/data-centre commitments
- model releases
- pricing changes
- product deprecations

Effect:
Company-specific signals affect provider momentum, investment attractiveness, short-term catalysts, valuation risk, and simulator shocks.

5. AI Sector Signals
--------------------
Examples:
- frontier-model releases
- model benchmark shifts
- coding-agent adoption
- enterprise AI adoption
- cloud AI growth
- data-centre capex
- GPU supply
- energy/power constraints
- AI chip export controls
- AI safety incidents
- AI litigation
- enterprise agent adoption
- agent protocol developments

Effect:
Sector signals affect the whole AI investment universe and may trigger class-level adjustments.

6. Financial Market Signals
---------------------------
Examples:
- share-price momentum
- beta
- volatility
- options implied volatility
- put/call ratio
- short interest, if available
- institutional holdings
- insider transactions
- ETF flows, if available
- IPO index performance
- SaaS/software multiples
- semiconductor index performance
- cloud/infrastructure index performance

Effect:
These feed risk/return scatterplots, fluctuation bands, and simulator volatility.

7. Energy / Infrastructure Signals
----------------------------------
Examples:
- power prices
- data-centre capacity
- grid constraints
- cloud capex
- GPU delivery timelines
- energy regulatory constraints
- natural gas/electricity prices
- data-centre permitting

Effect:
These matter especially for OpenAI, Anthropic, Oracle, Amazon, Alphabet, Microsoft, Nvidia, CoreWeave/Cerebras-style names, and any AI infrastructure provider.

============================================================
SECTION 3 — DATA SOURCES AND RELIABILITY
============================================================

Use source-backed data only.

Recommended source classes:

Official / high confidence:
- SEC EDGAR / data.sec.gov
- company earnings releases
- investor presentations
- official company blogs/docs
- official government economic APIs
- central bank data
- BLS
- FRED
- BEA
- EIA
- official regulatory filings
- official court/regulatory releases

Medium confidence:
- reputable financial news
- recognised business press
- analyst reports where licensed
- exchange data
- Nasdaq Data Link / market data providers
- Alpha Vantage or other market data APIs
- GDELT for broad news-event monitoring

Lower confidence:
- social media
- Reddit
- X
- forums
- unsourced market chatter
- anonymous reports
- search trend proxies
- app/review trends

Rule:
Each source type must receive a default trust level.
Do not use low-confidence sources to create factual claims.
Use low-confidence sources only to:
- widen volatility bands
- trigger watchlist alerts
- lower confidence
- suggest validation
- flag market chatter

============================================================
SECTION 4 — SIGNAL DATA MODEL
============================================================

Create MarketSignal model:

MarketSignal:
- id
- signalType
- signalCategory
- title
- summary
- entityIds
- entityTypes
- vendorIds
- tickers
- affectedExposureClasses
- affectedModules
- sourceId
- sourceName
- sourceUrl
- sourceType
- sourceDate
- capturedAt
- evidenceGrade
- confidenceScore
- dataStatus
- sentiment
- direction
- magnitude
- timeHorizon
- volatilityImpact
- valuationImpact
- revenueImpact
- marginImpact
- ipoWindowImpact
- liquidityImpact
- regulatoryImpact
- infrastructureImpact
- politicalRiskImpact
- notes
- uncertaintyNote
- requiresHumanReview

signalType options:
- macro
- political_regulatory
- market_sentiment
- company_specific
- ai_sector
- financial_market
- energy_infrastructure
- legal_litigation
- ipo_specific
- social_market_talk

direction:
- positive
- negative
- mixed
- neutral
- unknown

timeHorizon:
- intraday
- short_term
- medium_term
- long_term
- structural

dataStatus:
- verified
- documented
- tested
- estimated
- inferred
- seed
- stale
- disputed
- unknown

============================================================
SECTION 5 — SIGNAL IMPACT SCORING
============================================================

Create SignalImpactScore.

Inputs:
- signal magnitude
- source confidence
- recency
- relevance to vendor/exposure class
- entity match quality
- market regime
- historical sensitivity
- source reliability
- corroboration count
- contradiction count

SignalImpactScore =
magnitude
× relevance
× confidence
× recencyWeight
× corroborationWeight
× marketRegimeWeight
- contradictionPenalty
- stalePenalty

Output:
- impactScore 0-100
- confidenceScore 0-100
- affectedScoreFields
- explanation
- uncertaintyNote

Affected score fields:
- shortTermCatalystScore
- longTermHoldScore
- speculativeUpsideScore
- ipoReadinessScore
- ipoPricingRiskScore
- postIpoBandWidth
- postIpoBandCenter
- valuationRiskScore
- infrastructureDependencyScore
- aiCapitalEfficiencyScore
- marketMomentumScore
- sentimentScore
- volatilityScore
- riskRadarScore

============================================================
SECTION 6 — MARKET REGIME ENGINE
============================================================

Create MarketRegime model.

MarketRegime:
- id
- periodStart
- periodEnd
- riskAppetite
- rateRegime
- inflationRegime
- growthRegime
- creditRegime
- volatilityRegime
- techMultipleRegime
- ipoWindowQuality
- aiSentimentRegime
- infrastructureConstraintRegime
- confidenceScore
- sourceIds

riskAppetite:
- risk_on
- neutral
- risk_off

rateRegime:
- easing
- stable
- tightening
- uncertain

inflationRegime:
- disinflation
- stable
- reacceleration
- shock

growthRegime:
- expansion
- softening
- recession_risk
- contraction

volatilityRegime:
- low
- normal
- elevated
- stressed

ipoWindowQuality:
- open
- selective
- difficult
- closed

Effect:
MarketRegime feeds:
- valuation multipliers
- IPO timing forecasts
- post-IPO band widths
- simulator expected returns
- risk shock likelihood
- market dashboard “who’s winning/losing”

============================================================
SECTION 7 — PRICE FLUCTUATION BAND ADJUSTMENT MODEL
============================================================

Current post-IPO bands are too static.
Add Market Signal adjustments.

BaseBand:
- lowPct
- highPct
- centerPct
- widthPct

AdjustedBand =
BaseBand
+ centreShift
+ widthExpansion
+ eventShockAdjustments
+ regimeAdjustment
+ confidenceAdjustment

centreShift =
sum(signalImpact.directionalScore × vendorSensitivity × evidenceConfidence)

widthExpansion =
baseWidth
× (1 + volatilityRegimeFactor + eventDensityFactor + confidencePenalty + marketTalkPenalty)

Rules:
- High-quality positive revenue/catalyst signal may shift band centre upward.
- High-quality negative regulatory/legal signal may shift centre downward.
- Low-confidence market talk should mainly widen band, not move centre aggressively.
- Macro risk-off regime widens bands and shifts high-beta names downward.
- Risk-on AI sentiment narrows downside and raises upside for high-beta names.
- Stale or unsupported signals cannot move centre; they can only reduce confidence.

Do not forecast exact share prices unless verified offer price or current price exists.

============================================================
SECTION 8 — PUBLIC STOCK PRICE SIMULATION ADJUSTMENT
============================================================

For public AI providers, add signal-adjusted simulation.

Inputs:
- currentPrice, if available from sourced market data
- historical returns
- volatility
- beta
- market regime
- AI exposure score
- valuation risk
- catalyst score
- macro signals
- company-specific signals
- sector signals
- sentiment signals
- shock events

SignalAdjustedReturn =
baseReturn
+ aiCatalystImpact
+ macroImpact
+ companySignalImpact
+ sectorMomentumImpact
+ sentimentImpact
- valuationRiskPenalty
- regulatoryRiskPenalty
- capexRiskPenalty
- confidencePenalty

SignalAdjustedVolatility =
baseVolatility
+ eventDensityImpact
+ marketTalkImpact
+ ipoRiskImpact
+ macroVolatilityImpact
+ confidencePenalty

Charts affected:
- scenario fan chart
- drawdown chart
- risk-return scatterplot
- contribution waterfall
- risk radar
- confidence heatmap
- shock timeline

============================================================
SECTION 9 — MARKET TALK HANDLING
============================================================

Market talk must be included but treated cautiously.

MarketTalkSignal:
- id
- platform
- query
- entity
- volumeScore
- sentimentScore
- noveltyScore
- repetitionScore
- botRiskScore
- sourceConfidence
- dataStatus
- derivedFrom
- uncertaintyNote

Use cases:
- early warning
- sentiment shift
- volatility widening
- watchlist alert
- human review trigger

Do not use market talk alone to:
- claim market share
- claim revenue
- claim IPO timing
- claim product availability
- move investment ranking materially
- declare winner/loser status

Market talk can:
- widen post-IPO bands
- increase volatility
- flag a watch item
- reduce confidence
- trigger a “market chatter detected” label

============================================================
SECTION 10 — POLITICAL / REGULATORY EVENT HANDLING
============================================================

Political/regulatory signals must be categorised by direct relevance.

RegulatoryEvent:
- ai_regulation
- chip_export_control
- antitrust
- privacy_data
- public_procurement
- defence_policy
- tax_policy
- tariff_trade
- election_risk
- energy_permitting
- data_centre_policy

Each event should map to affected vendors/exposure classes:
- AI labs
- cloud providers
- chip suppliers
- semiconductor equipment
- software platforms
- public-sector AI
- healthcare/financial AI
- sovereign AI providers

Impact:
- revenue opportunity
- margin risk
- market access risk
- valuation risk
- IPO window risk
- customer adoption risk
- supply chain risk

If political event source is partisan/commentary:
- mark sourceType = commentary
- lower confidence
- require corroboration

============================================================
SECTION 11 — DATA PIPELINE
============================================================

Build the Market Signals Engine pipeline:

1. Source Ingestion
- APIs
- RSS/news feeds
- official filings
- official economic releases
- market data
- regulatory feeds
- manual analyst entries

2. Source Normalisation
- convert all sources to EvidenceSource
- assign evidenceGrade
- assign sourceType
- assign freshness status

3. Entity Resolution
- map signal to vendors, tickers, private firms, products, sectors, exposure classes

4. Signal Classification
- macro / political / market talk / company / AI sector / financial / energy

5. Impact Scoring
- calculate magnitude, direction, horizon, confidence, affected outputs

6. Cross-Feed Update
- update Investor Tools
- update Simulator
- update Market Dashboard
- update Vendor Profiles
- update Watchlists
- update Briefings

7. Audit Log
- record what changed
- record why score changed
- store before/after values
- preserve source trail

============================================================
SECTION 12 — SOURCE CONNECTOR PRIORITIES
============================================================

Implement connectors in stages.

Stage 1 — low-risk public official sources:
- SEC data.sec.gov for submissions/XBRL
- FRED for macro data
- BLS for CPI/jobs/labour data
- EIA for energy/power/oil/gas data
- official company press releases / RSS
- official investor relations pages

Stage 2 — financial and market APIs:
- Alpha Vantage or equivalent for prices, news sentiment, fundamentals, options data
- Nasdaq Data Link for market datasets where licensed
- Cboe or vendor-provided VIX/options data where licensed
- exchange feeds where licensed

Stage 3 — event/news intelligence:
- GDELT DOC/Context APIs
- reputable news APIs
- licensed analyst/news sources

Stage 4 — low-confidence market talk:
- Reddit API
- X API or approved social feeds
- Google Trends or search-interest proxies where terms allow
- developer/community forums
- review sites

Do not block product launch waiting for all connectors.
Start with source-backed official data and seed model placeholders clearly labelled.

============================================================
SECTION 13 — OUTPUT CHANGES IN INVESTOR TOOLS
============================================================

Add these outputs.

Investment Dashboard:
- Current Market Regime
- AI Sentiment Regime
- Signal-adjusted winners and losers
- Top current catalysts
- Top regulatory risks
- Top macro risks
- Biggest signal-driven score moves
- Market talk watchlist, low confidence

Provider Investment Page:
- Signal timeline
- Signal-adjusted scores
- Current-event risk summary
- Macro sensitivity
- Political/regulatory sensitivity
- Market-talk sentiment
- Source confidence by signal type
- What changed since last update

Investment Simulator:
- Signal-adjusted fan chart toggle
- Shock timeline
- Macro overlay
- Political/regulatory overlay
- Market-talk volatility overlay
- Current-event waterfall
- Signal confidence heatmap
- Scenario assumptions drawer

IPO Watch:
- Signal-adjusted IPO timing
- IPO window quality
- post-IPO band adjustments
- lock-up risk if known
- market regime impact
- IPO market sentiment
- missing data checklist

============================================================
SECTION 14 — GRAPH REQUIREMENTS
============================================================

Add attractive AI Enterprise-style graphs:

1. Market Regime Ribbon
Shows risk-on/risk-off, rates, inflation, volatility, IPO window quality over time.

2. Signal Timeline
Shows macro, political, company, and market-talk events by date.

3. Signal Impact Waterfall
Shows which signals moved expected return/volatility.

4. Event Heatmap
Rows: vendors.
Columns: macro, political, market talk, company news, AI sector, infrastructure.
Values: impact score/confidence.

5. Sentiment vs Evidence Scatter
X-axis: sentiment strength.
Y-axis: evidence confidence.
Purpose: prevent weak market chatter from looking like fact.

6. IPO Band Adjustment Chart
Shows base post-IPO bands vs signal-adjusted bands.

7. Volatility Expansion Chart
Shows which events widened uncertainty.

8. Cross-Platform Signal Feed
Shows which signals affected:
- Investment Intelligence
- Simulator
- Market Dashboard
- Vendor Profile
- Watchlist

============================================================
SECTION 15 — TESTING REQUIREMENTS
============================================================

Add tests:

Truthfulness:
- unsupported market talk cannot render as fact
- low-confidence signal cannot shift centre beyond defined cap
- stale macro data cannot update high-confidence regime
- missing source lowers confidence
- conflicting sources show disputed status

Signal engine:
- macro signal updates market regime
- regulatory signal maps to affected vendors
- company-specific signal updates provider page and simulator
- market talk only widens volatility unless corroborated
- event density expands band width
- positive high-confidence catalyst shifts centre upward
- negative high-confidence risk shifts centre downward

Simulator:
- applying market regime changes scenario fan chart
- applying regulatory shock changes risk radar
- signal-adjusted toggle changes scenario output
- chart data uses latest stateHash
- old chart data is marked stale

IPO:
- market regime affects IPO window quality
- IPO bands adjust with signals
- no offer price means no dollar price forecast
- missing S-1 data keeps confidence limited

Dashboard:
- “who’s winning” only updates when signal confidence threshold is met
- “market talk detected” appears separately from verified news
- source confidence visible in every signal card

============================================================
SECTION 16 — DEVELOPMENT ORDER
============================================================

1. Add MarketSignal model.
2. Add MarketRegime model.
3. Add source connector interface.
4. Add official-source placeholder connectors.
5. Add SignalImpactScore function.
6. Add market regime calculation.
7. Add signal-adjusted post-IPO band model.
8. Add signal-adjusted public stock simulator.
9. Add market talk handling with strict low-confidence rules.
10. Add political/regulatory event mapping.
11. Add Market Signals UI components.
12. Add graphs.
13. Add tests.
14. Wire signals into:
   - Investor Tools
   - Simulator
   - IPO Watch
   - Vendor Profiles
   - Market Dashboard
   - Briefings

============================================================
SECTION 17 — FINAL DEVELOPMENT AGENT INSTRUCTION
============================================================

Do not overfit, overclaim, or invent causal certainty.

Market signals improve modelling; they do not create truth.

Every signal must have:
- source
- date
- confidence
- evidence grade
- affected outputs
- uncertainty note

If a signal cannot be sourced, it cannot affect factual output.

Low-confidence market talk may increase volatility or trigger watchlist review, but it must not become a factual claim or dominate the model.

The product must be willing to say:
“Not enough evidence to adjust forecast.”

That is better than a false forecast.


---

## master_fix_pack/AI_ENTERPRISE_CLAUDE_CODE_MASTER_FIX_PROMPT_PACK_2026-05-10.md

AI ENTERPRISE — CLAUDE CODE MASTER FIX + BUILD PROMPT PACK
============================================================
Date: 10 May 2026
Timezone: Europe/London
Prepared for: Mike

Purpose
-------
This is the consolidated Claude Code prompt pack for fixing, hardening, and extending AI Enterprise.

It combines all known fixes and required changes from the recent audit, product direction, Investor Tools work, simulator fixes, IPO forecasting, market signals, product-scope inventory, commercial model inventory, and data-source connector plans.

Use this as the controlling Claude Code prompt pack.

Product context
---------------
AI Enterprise is intended to be an executive-grade enterprise AI market intelligence portal.

It includes:
- Dashboard
- Vendor Intelligence
- Market Tracker
- News Intelligence
- Capabilities
- Assessment
- Briefings
- Watchlists
- Investor Tools

Investor Tools includes:
- Investment Intelligence
- Investment Simulator
- Public AI Stocks
- IPO Watch
- Indirect Exposure Map
- Investment Briefings
- Investor Watchlist

Core product principle
----------------------
AI Enterprise must be truthful, evidence-backed, confidence-scored, and source-aware.

No hallucinated, unsupported, stale, fake, or unverified output may appear as fact.

If data is missing, stale, seed, inferred, or unverified, the interface must say so.

================================================================================
SECTION 1 — ABSOLUTE NON-NEGOTIABLE TRUTH RULES
================================================================================

AI Enterprise must never present unsupported claims as fact.

This applies to:
- vendor capabilities
- product availability
- commercial LLM model lists
- model ownership
- hosted third-party model availability
- investment scores
- market share
- adoption percentages
- IPO forecasts
- post-IPO price fluctuation bands
- pricing
- revenue / ARR
- financial metrics
- source citations
- dashboard summaries
- executive briefings
- charts
- tooltips
- API responses

Required data labels:
- verified
- documented
- tested
- estimated
- inferred
- seed
- stale
- disputed
- unknown
- unsupported

Required evidence grades:
- E0: no evidence
- E1: vendor claim only
- E2: public documentation
- E3: public test, sandbox/API verification, or live API/model-list verification
- E4: production customer evidence
- E5: independent audit, verified benchmark, filing, audited report, or third-party validation

Every material rendered claim must have:
- entityId
- entityType
- claimText or claimValue
- sourceIds
- sourceName
- sourceUrl where available
- sourceType
- sourceDate where available
- capturedAt
- lastVerifiedAt
- evidenceGrade
- confidenceScore
- dataStatus
- freshnessStatus
- uncertaintyNote

If evidence is missing:
- show "Unknown"
- show "Source validation required"
- show "Seed data — not verified"
- do not invent values

If data is stale:
- show stale badge
- reduce confidence
- block high-confidence use

If data conflicts:
- show disputed badge
- show uncertainty note
- require human review before using in high-confidence outputs

================================================================================
SECTION 2 — CURRENT CONFIRMED ISSUES FROM SOURCE AUDIT
================================================================================

Known deployment issue:
- Live Vercel URL returns HTTP/2 401 with _vercel_sso_nonce.
- The deployed app is protected by Vercel SSO/deployment protection.
- Do not claim live-page audit success unless deployment protection is removed or authenticated access is available.

Known source/build issues:
1. Full test suite fails because lib/prisma.ts imports:
   ../generated/prisma/client
   but generated Prisma client is not present.

2. prisma generate may fail in restricted environments because:
   - DATABASE_URL may be required
   - Prisma may need to fetch binaries from binaries.prisma.sh

3. npm run build may fail because of missing Prisma client.

4. Next.js build may fail in restricted/offline environments because next/font/google tries to fetch:
   - Geist
   - Geist Mono
   - Cormorant Garamond

5. /capabilities currently relies heavily on seed capability data:
   lib/intelligence/seed-capabilities.ts

6. /capabilities currently lacks full audit-grade metadata per capability:
   - sourceUrl
   - sourceName
   - sourceDate
   - confidenceScore
   - dataStatus
   - freshnessStatus
   - uncertaintyNote
   - ProductScope linkage
   - TruthRecord linkage
   - calculation provenance
   - formula version

7. Commercial LLM model inventory is stronger than /capabilities, but still seed/static unless live validation is wired.

8. Free-source connector suite is not yet fully implemented.

Primary target state:
source -> evidence -> claim -> calculation -> output -> chart

================================================================================
SECTION 3 — CLAUDE CODE OPERATING INSTRUCTIONS
================================================================================

Before making changes:
1. Inspect the repo.
2. Identify package manager and app framework.
3. Find relevant routes:
   - /dashboard
   - /capabilities
   - /investor-tools
   - /investor-tools/simulator
   - /investor-tools/ipo-watch
   - /api routes
4. Run:
   - npm test, if configured
   - npm run build, if configured
   - npx tsc --noEmit, if configured
5. Record failures before fixing.

Never:
- delete existing product modules
- remove Investor Tools
- remove Assessment
- remove Truth Engine scaffolding
- remove ProductScope registry
- remove CommercialModel inventory
- fabricate live data
- mark seed data as verified
- count hosted third-party models as first-party
- treat private IPO-watch companies as directly investable

Always:
- preserve current functionality unless broken
- add tests for fixes
- write audit notes
- keep data-source truthfulness visible
- prefer "Unknown" over invented values

================================================================================
SECTION 4 — PHASE 1: FIX BUILD AND TEST RELIABILITY
================================================================================

Goal:
The repo must build and test reliably before deeper feature work.

Tasks:
1. Fix Prisma client generation/import strategy.
2. Ensure tests that do not require DB can run without generated Prisma client.
3. Consider one of:
   - run prisma generate before build/test
   - fix prisma output path
   - avoid importing Prisma in seed/static routes
   - dynamically import Prisma only in DB-specific modules
   - add DB-free repository fallback for seed mode
4. Ensure Vercel build can generate Prisma client if DB is configured.
5. Ensure local/offline build does not fail unnecessarily.

Prisma guidance:
- If generated client path is configured to generated/prisma/client, ensure it is generated before build.
- Add prebuild/pretest scripts if appropriate.
- If DATABASE_URL is needed only for Prisma config, provide safe handling.
- Do not commit secrets.
- Document required env vars.

Google font guidance:
- Remove next/font/google dependency if it causes build fragility.
- Prefer local fonts or system font fallback.
- If custom fonts are needed, self-host them.
- Do not rely on runtime access to Google Fonts for production-critical builds.

Acceptance:
- npm test passes.
- npm run build passes.
- npx tsc --noEmit passes if configured.
- No unsupported runtime dependency on Google Fonts.
- No import error for ../generated/prisma/client.

================================================================================
SECTION 5 — PHASE 2: IMPLEMENT / HARDEN TRUTH ENGINE
================================================================================

Goal:
All rendered data must have truth/evidence metadata or be marked unknown.

Create or harden central models:

EvidenceSource:
- id
- entityType
- entityId
- sourceType
- sourceName
- sourceUrl
- sourceDate
- capturedAt
- publisher
- isOfficialSource
- isPrimarySource
- isLicensedSource
- evidenceGrade
- confidenceScore
- freshnessStatus
- notes

TruthRecord:
- id
- entityType
- entityId
- claimType
- claimText
- numericValue
- unit
- period
- geography
- sourceIds
- evidenceGrade
- confidenceScore
- dataStatus
- freshnessStatus
- uncertaintyNote
- createdAt
- updatedAt
- lastVerifiedAt
- expiryDate

Render guard:
Create a helper such as renderClaim() or TruthBadge.

Rules:
- E0 cannot render as verified.
- seed data must show seed label.
- stale data must show stale label.
- confidence below threshold shows low-confidence badge.
- conflicting sources show disputed badge.
- missing source shows source validation required.
- unsupported facts render unknown, not guessed.

Acceptance:
- Any chart/table/card with numbers shows confidence/data status.
- Unsupported claims are blocked or labelled unknown.
- Tests cover seed/stale/unknown/verified/disputed paths.

================================================================================
SECTION 6 — PHASE 3: PRODUCT SCOPE REGISTRY
================================================================================

Goal:
Every AI product, model, service, and capability measured in AI Enterprise must be listed in a ProductScope registry.

ProductScopeItem:
- id
- vendorId
- vendorName
- productName
- productCategory
- productDescription
- measurementScope
- includedInModules
- sourceStatus
- sourceName
- sourceUrl
- evidenceGrade
- confidenceScore
- uncertaintyNotes
- lastVerified
- truthRecordIds

Product categories:
- enterprise_assistant
- model_api
- foundation_model
- agent_platform
- agent_runtime
- coding_agent
- enterprise_search
- rag_knowledge
- governance_control
- security_control
- ai_development_platform
- ai_infrastructure
- ai_chip_infrastructure
- data_ai_platform
- workflow_ai
- vertical_ai
- investment_exposure
- ipo_watch
- indirect_exposure
- other

Rules:
- No capability can render unless mapped to ProductScope.
- Unknown or uncertain products must show sourceStatus = uncertain or source validation required.
- Hosted third-party models must not be counted as vendor-owned.
- Infrastructure vendors must not be compared as enterprise assistant vendors unless ProductScope supports it.

Baseline vendors/products in scope:
OpenAI:
- ChatGPT Enterprise
- ChatGPT Business
- ChatGPT Edu
- ChatGPT agent
- Codex
- OpenAI API / Responses API / model APIs
- Deep Research
- Data Analysis
- file uploads/projects/canvas/apps/connectors
- image generation
- Sora/video generation where source-confirmed
- enterprise admin/SSO/SCIM/RBAC/data controls

Microsoft:
- Microsoft 365 Copilot
- Copilot Studio
- Agent 365
- Microsoft 365 E7 / Frontier Suite where source-confirmed
- Azure AI Foundry
- Foundry Models
- Azure OpenAI in Foundry Models
- Azure AI Foundry Agent Service
- GitHub Copilot
- Dynamics 365 AI agents/Copilot capabilities
- Power Platform AI
- Azure AI Search
- Purview/Entra/Defender/Intune AI governance adjacency

Google:
- Gemini Enterprise
- Google Agentspace where source-confirmed
- Gemini models
- Vertex AI
- Vertex AI Agent Builder
- Agent Development Kit
- Agent2Agent protocol
- Gemini Code Assist
- Model Garden
- Model Armor
- BigQuery AI / grounding integrations
- Google Workspace Gemini

Anthropic:
- Claude Enterprise / Claude for Work
- Claude Team
- Claude models
- Anthropic API / Messages API
- Claude Code
- Claude Code for Team/Enterprise
- tool use
- computer use
- text editor tool
- citations
- batch processing
- extended context where source-confirmed

AWS:
- Amazon Bedrock
- Bedrock Marketplace
- Bedrock Agents
- Bedrock Knowledge Bases
- Bedrock Guardrails
- Bedrock Managed Agents powered by OpenAI where source-confirmed
- OpenAI models on Bedrock where source-confirmed
- Codex on Bedrock where source-confirmed
- Amazon Q Business
- Amazon Q Developer
- Amazon SageMaker AI
- SageMaker model/customisation agentic experience
- Trainium
- Inferentia
- Neuron SDK

Salesforce:
- Agentforce
- Agentforce Guardrails
- Einstein AI
- Einstein Trust Layer
- Data Cloud
- Salesforce Platform AI capabilities
- Agentforce Service/Sales/IT where source-confirmed

ServiceNow:
- Now Assist
- AI Control Tower
- Action Fabric
- ServiceNow AI agents
- Workflow Data Fabric
- ITSM/HR/service AI capabilities

Oracle:
- OCI Generative AI
- OCI Data Science
- OCI AI Infrastructure
- AI Vector Search
- Oracle AI Database / Autonomous AI Database Select AI
- HeatWave GenAI
- Fusion Cloud AI agents

SAP:
- SAP Business AI
- Joule
- Joule Agents
- Joule Studio
- SAP Signavio + Joule
- SAP BTP AI
- SAP S/4HANA Cloud embedded AI
- SuccessFactors embedded AI

IBM:
- watsonx.ai
- watsonx Orchestrate
- watsonx.data
- Granite models
- Granite Guardian
- watsonx Code Assistant
- IBM Concert
- IBM Sovereign Core
- Red Hat Enterprise Linux AI

Snowflake:
- Cortex AI
- Snowflake Intelligence
- Cortex Analyst
- Cortex Search
- Cortex Agents where source-confirmed
- Cortex Code where source-confirmed
- Arctic models where source-confirmed

Databricks:
- Mosaic AI
- Mosaic AI Model Serving
- Foundation Model APIs
- Foundation Model Fine-tuning
- Mosaic AI Agent Framework where source-confirmed
- Genie / Databricks Assistant
- Unity Catalog AI governance
- MLflow model lifecycle

Cohere:
- North
- Compass
- Command models
- Embed
- Rerank
- Tool Use / agents
- dedicated/VPC deployment options

Mistral:
- Le Chat
- Le Chat Enterprise
- Mistral Studio
- Mistral Vibe
- Mistral API
- Mistral models
- custom agents
- connectors/MCP
- admin controls

Perplexity:
- Perplexity Enterprise Pro
- Sonar API
- Sonar models
- enterprise search/answer workflows

xAI:
- Grok app / Grok in X where relevant
- xAI API
- Grok models
- voice/image/OCR/tool use where source-confirmed

Glean:
- Glean Search
- enterprise AI assistant/work AI
- Glean agents where source-confirmed
- enterprise connectors/permissions-aware search

Moveworks:
- AI Assistant Platform
- Reasoning Engine
- MoveLM where source-confirmed
- Agent Studio
- IT/HR/Finance/employee support agents

Writer:
- WRITER AI Studio
- Palmyra models
- Writer agents
- governance/supervision layer

Harvey:
- Harvey Assistant
- Harvey Vault
- Harvey Agent Builder
- Workflow Agents
- Library
- legal research/drafting/analysis platform

Hebbia:
- Hebbia Matrix
- Matrix Agent
- institutional intelligence workflows
- multimodal document/data analysis

Rogo:
- Rogo finance AI platform
- Rogo agents
- financial workflow automation
- data integrations

Nvidia:
- NVIDIA AI Enterprise
- NIM
- NeMo
- Blueprints
- Omniverse
- Run:ai
- Nemotron where source-confirmed
- GPU/data-centre infrastructure exposure

AMD:
- ROCm
- Instinct accelerators
- ROCm Operations Platform
- AI/HPC software stack

Broadcom:
- AI networking/custom silicon/infrastructure exposure where source-confirmed

ASML:
- semiconductor equipment exposure
- EUV/High-NA EUV
- AI chip supply-chain exposure

Arm:
- AI edge/mobile/server architecture exposure where source-confirmed

Cerebras:
- Cerebras AI systems
- wafer-scale AI chip/inference/training systems
- IPO watch infrastructure exposure

Acceptance:
- Every displayed capability has ProductScope linkage.
- Missing ProductScope blocks display or shows validation error.
- ProductScope page/table exists in advanced/admin view.

================================================================================
SECTION 7 — PHASE 4: COMMERCIAL LLM MODELS DASHBOARD
================================================================================

Goal:
On /dashboard show Commercial LLM Models by Vendor.

Keep/improve existing card.

CommercialModel:
- id
- vendorId
- vendorName
- ownerVendorId
- ownerVendorName
- hostingVendorId
- hostingVendorName
- modelName
- modelId
- modelFamily
- modelCategory
- modality
- availabilityStage
- commercialAvailability
- ownershipType
- accessChannel
- contextWindow
- inputModalities
- outputModalities
- toolSupport
- pricingSummary
- sourceIds
- sourceUrls
- sourceNames
- sourceDate
- capturedAt
- evidenceGrade
- confidenceScore
- dataStatus
- uncertaintyNote
- lifecycleStatus
- deprecationDate
- lastVerifiedAt

Rules:
- hosted third-party models are not first-party
- deprecated/retired models are excluded from active counts
- source-backed only for verified/documented
- seed/source-needed states visible
- infrastructure vendors can show no first-party LLM/source validation required

API routes:
- GET /api/model-inventory
- GET /api/model-inventory/vendors
- GET /api/model-inventory/vendors/[vendorId]
- GET /api/model-inventory/sources
- POST /api/model-inventory/refresh

Acceptance:
- Dashboard card renders.
- Expanding a vendor shows source/evidence data.
- Hosted third-party ownership is clear.
- Tests prove AWS/Azure/Oracle/Glean/Harvey orchestration does not transfer ownership.

================================================================================
SECTION 8 — PHASE 5: CAPABILITIES PAGE AUDIT-GRADE UPGRADE
================================================================================

Goal:
Upgrade /capabilities from seed matrix into source-backed capability intelligence surface.

Current issue:
VendorCapability has limited fields:
- vendorId
- capabilityId
- status
- maturityScore
- evidenceGrade
- lastVerified
- notes

Required upgraded VendorCapability:
- vendorId
- capabilityId
- productScopeIds
- status
- maturityScore
- evidenceGrade
- confidenceScore
- dataStatus
- freshnessStatus
- sourceIds
- sourceUrls
- sourceNames
- sourceDate
- lastVerified
- uncertaintyNote
- truthRecordIds
- formulaVersion
- calculationTrace
- isSeedScore
- isCalculated
- isVerified

Capability cell UI:
- status
- score
- evidence badge
- data-status badge
- confidence
- stale warning
- source link or source validation required
- uncertainty tooltip
- seed score warning
- product mapping

Capability overview:
- total vendors
- products in scope
- capabilities tracked
- verified capabilities
- documented capabilities
- seed/inferred capabilities
- stale capabilities
- unknown capabilities

Connection/Data panel:
- connector status
- last fetch
- stale sources
- missing sources
- seed data still in use
- unsupported claims blocked

Acceptance:
- no capability score renders as verified without source metadata
- seed scores visibly marked
- stale warning visible
- ProductScope linkage enforced
- tests fail if capability lacks source/data status

================================================================================
SECTION 9 — PHASE 6: FREE / OFFICIAL DATA CONNECTORS
================================================================================

Goal:
Establish source connectors for all major AI Enterprise data needs.

Data groups:
A. Vendor/Product/Capability data
B. Commercial model inventory
C. Security/trust/privacy/governance data
D. Market-share/adoption data
E. News/functionality intelligence
F. Financial fundamentals
G. Public stock prices and market data
H. Macro/economic regime data
I. Political/regulatory signals
J. Energy/infrastructure signals
K. Developer/community signals
L. IPO/private-company data
M. Investment simulator assumptions
N. Evidence/claim registry

Create connector files:
- lib/connectors/types.ts
- lib/connectors/sec.ts
- lib/connectors/fred.ts
- lib/connectors/bls.ts
- lib/connectors/bea.ts
- lib/connectors/eia.ts
- lib/connectors/fiscalData.ts
- lib/connectors/alphaVantage.ts
- lib/connectors/gdelt.ts
- lib/connectors/github.ts
- lib/connectors/congress.ts
- lib/connectors/federalRegister.ts
- lib/connectors/vendorDocs.ts
- lib/evidence/normalise.ts
- lib/evidence/freshness.ts
- lib/evidence/confidence.ts

Create API:
- GET /api/data-sources/status
- POST /api/data-sources/refresh
- GET /api/data-sources/[connectorId]

Required connectors:

1. SEC EDGAR / data.sec.gov
Use for filings, XBRL facts, S-1/IPO, 10-K/10-Q/8-K.
No API key required.
Use compliant User-Agent env:
SEC_USER_AGENT="AI Enterprise contact@example.com"

2. FRED
Use for rates, yields, unemployment, CPI/PCE proxies, financial conditions.
Requires FRED_API_KEY.

3. BLS
Use for CPI, PPI, unemployment, payrolls, wages.
BLS_API_KEY optional/registration depending usage.

4. BEA
Use for GDP, consumption, investment, industry data.
Requires BEA_API_KEY.

5. EIA
Use for energy/power/data-centre energy constraints.
Requires EIA_API_KEY.

6. Treasury Fiscal Data
Use for fiscal/rates/public finance data.
No API key.

7. Alpha Vantage
Use for public equities, fundamentals, news/sentiment, market status.
Requires ALPHA_VANTAGE_API_KEY.

8. GDELT
Use for public news/event monitoring.
No key for core APIs.
Treat as signal, not proof.

9. GitHub REST API
Use for developer/community/open-source signals.
GITHUB_TOKEN optional but recommended.

10. Congress.gov
Use for AI/chip/privacy/export-control legislation.
Requires CONGRESS_API_KEY.

11. Federal Register / Regulations.gov
Use for regulatory notices/rules.
Regulations.gov may require key.

12. Vendor official docs/model catalogues
Use for product/model/capability verification.

Connector requirements:
- health check
- configured status
- fetch method or explicit not_implemented
- normalisation into EvidenceSource/TruthRecord
- source URL stored
- confidence and freshness applied
- error handling
- rate-limit notes
- no fake successful status

Data sources page:
- connector name
- status
- configured?
- requires API key?
- last fetch
- last error
- records fetched
- confidence impact
- freshness status

Acceptance:
- missing API key shows not_configured
- no connector fakes live data
- connector status page renders
- tests cover connector status and normalisation

================================================================================
SECTION 10 — PHASE 7: INVESTOR TOOLS NAVIGATION AND TRUTHFULNESS
================================================================================

Goal:
Consolidate investment features under Investor Tools.

Navigation:
Investor Tools dropdown:
- Investment Intelligence
- Investment Simulator
- Public AI Stocks
- IPO Watch
- Indirect Exposure Map
- Investment Briefings
- Investor Watchlist

Routes:
- /investor-tools
- /investor-tools/intelligence
- /investor-tools/simulator
- /investor-tools/public
- /investor-tools/ipo-watch
- /investor-tools/exposure-map
- /investor-tools/briefings
- /investor-tools/watchlist

Redirect old routes:
- /investing -> /investor-tools/intelligence
- /investing/simulator -> /investor-tools/simulator
- /investing/public -> /investor-tools/public
- /investing/ipo-watch -> /investor-tools/ipo-watch
- /investing/exposure-map -> /investor-tools/exposure-map

Investor Tools warning:
"This module is for market intelligence and hypothetical scenario modelling only. It is not financial advice. Outputs are based on documented, estimated, inferred, or seed data as labelled. Future returns are not guaranteed."

No buy/sell language.
Use:
- ranks highest under this model
- watchlist candidate
- valuation-sensitive
- requires validation
- not directly investable
- speculative

Acceptance:
- dropdown works
- old routes redirect/alias
- warnings visible
- evidence/confidence labels visible

================================================================================
SECTION 11 — PHASE 8: INVESTMENT SIMULATOR FIXES
================================================================================

Goal:
Implement all requested simulator fixes.

Required fixes:

1. Manual allocation vendor dropdown
When allocationStyle = manual:
- show vendor dropdown/multiselect
- filter by investmentUniverse
- selected vendors populate allocation table
- validate allocation total = 100 including cash reserve
- warn on non-directly investable vendors

2. Single-stock portfolio mode
Add allocationStyle = single_stock.
- allow only public_direct vendors/tickers
- focus charts on one holding
- disallow private/IPO watch as single stock

3. Correct investment universe filtering
public_only:
- only public_direct / optional ETF
- exclude IPO/private

public_and_indirect:
- allow public holdings
- show private indirect exposure map
- no direct private holdings

ipo_watch:
- only IPO/private candidates
- exclude public direct holdings like Microsoft/Amazon
- public companies can appear only in indirect exposure context/sidebar

speculative_all:
- allow high-beta public + IPO watch
- private direct disabled unless access is legitimate

single_stock:
- public_direct only

4. Apply Shock randomisation and timing
ShockEvent must include:
- shockType
- shockLabel
- shockDescription
- shockYear
- shockQuarter if used
- shockSeverity
- affectedProviders
- affectedExposureClasses
- randomSeed
- generatedAt
- parameterImpacts

Display:
"Shock applied in Year {shockYear}: {shockLabel} — {severity}."

5. Info buttons next to all inputs
Add tooltips for:
- startingCapital
- horizonYears
- riskProfile
- allocationStyle
- investmentUniverse
- selectedVendors
- region
- includePrivateExposure
- rebalanceFrequency
- cashReservePct
- shockMode
- shockYear
- shockType
- shockSeverity
- all shock sliders
- singleStockTicker

6. Cross-feed integrity
Create SimulationState and CrossFeedValidator.

SimulationState:
- input
- eligibleUniverse
- selectedHoldings
- allocationValidation
- scenarioAssumptions
- shocks
- computedPaths
- computedScores
- chartData
- evidenceStatus
- errors
- lastUpdatedAt
- stateHash

On any input change:
- recompute eligible universe
- recompute allocations
- recompute scores
- recompute paths
- recompute charts
- update stateHash
- block stale outputs

Error:
"Simulation integrity error: output is not synced with current inputs."

7. Scatter plot auto-scaling
Implement dynamic axis calculation:
- min/max visible points
- 8-12% padding
- minimum domain spread
- zoom-to-spread default
- toggle full 0-100 scale
- tooltips show true values

8. Indirect exposure network line colours
- colour edges by top/public vendor
- edge thickness by exposure strength
- opacity by confidence
- dashed = inferred
- solid = documented/verified
- dotted = uncertain
- tooltip explains indirect exposure is not direct ownership

Acceptance:
- all simulator tests pass
- universe filtering fixed
- no public stocks in IPO watch direct portfolio
- graph updates after input changes
- shock timing visible
- info buttons present

================================================================================
SECTION 12 — PHASE 9: IPO FORECASTING AND POST-IPO BANDS
================================================================================

Goal:
Implement truthful IPO forecasting.

Do not invent IPO dates or share prices.

IPO forecast must output:
- estimatedIpoMonth, if defensible
- credibleWindowStart
- credibleWindowEnd
- confidence
- rumourQuality
- forecastStatus
- missing data
- post-IPO fluctuation bands as % relative to offer price

Do not output dollar prices unless verified offer price exists.

Rumour quality:
- R0 no credible signal
- R1 general speculation
- R2 reputable report, vague timing
- R3 reputable reports with timing/valuation detail
- R4 bankers/advisers/filing prep/roadshow/price range
- R5 S-1/F-1 filed or active marketing confirmed

Rules:
- R0/R1: no specific month
- R2: broad window only
- R3: estimated month with low/medium-low confidence
- R4/R5: estimated month and post-IPO bands
- no reliable evidence: disable forecast

Provider seed forecast states:
- Cerebras: May 2026, high confidence, active process
- OpenAI: May 2027 estimate, medium-low
- Anthropic: Sep 2027 estimate, medium-low
- Databricks: Nov 2027 estimate, medium
- Cohere: Dec 2027 estimate, medium-low
- Harvey: Jun 2028 estimate, low-medium
- Glean: Sep 2028 estimate, low-medium
- Mistral: Nov 2028 estimate, low-medium
- Perplexity: Jun 2028 estimate, low
- Writer: Sep 2029 estimate, low
- Hebbia: no reliable month, disable
- Rogo: no reliable month, disable
- xAI standalone: not modelled, SpaceX-linked only

Required UI warning:
"This is a modelled IPO forecast, not a factual listing date or investment recommendation. Timing and price bands are based on public signals, evidence confidence, and scenario assumptions. They should be updated when an S-1/F-1, price range, float, lock-up terms, or audited financials become available."

Acceptance:
- no offer price means no dollar prices
- disabled companies show no reliable forecast
- post-IPO bands labelled estimated
- lock-up risk zone displayed M5-M7 if lock-up unknown
- tests for R0/R1 disabling

================================================================================
SECTION 13 — PHASE 10: MARKET SIGNALS ENGINE
================================================================================

Goal:
Add signals that improve investment, IPO, simulator, dashboard, and vendor-momentum outputs.

MarketSignal:
- id
- signalType
- signalCategory
- title
- summary
- entityIds
- vendorIds
- tickers
- affectedExposureClasses
- affectedModules
- sourceId
- sourceName
- sourceUrl
- sourceType
- sourceDate
- capturedAt
- evidenceGrade
- confidenceScore
- dataStatus
- sentiment
- direction
- magnitude
- timeHorizon
- volatilityImpact
- valuationImpact
- revenueImpact
- marginImpact
- ipoWindowImpact
- liquidityImpact
- regulatoryImpact
- infrastructureImpact
- politicalRiskImpact
- uncertaintyNote
- requiresHumanReview

Signal categories:
- macro
- political_regulatory
- market_sentiment
- company_specific
- ai_sector
- financial_market
- energy_infrastructure
- legal_litigation
- ipo_specific
- social_market_talk

Rules:
- market talk cannot render as fact
- low-confidence market talk can widen volatility or trigger watchlist, not drive factual claims
- high-confidence official company/filing data can move score centres
- stale data cannot update high-confidence regime

MarketRegime:
- riskAppetite
- rateRegime
- inflationRegime
- growthRegime
- creditRegime
- volatilityRegime
- techMultipleRegime
- ipoWindowQuality
- aiSentimentRegime
- infrastructureConstraintRegime
- confidenceScore

Use signals to adjust:
- short-term catalyst score
- long-term hold score
- speculative score
- IPO readiness/pricing risk
- post-IPO bands
- simulator returns/volatility
- dashboard winners/losers
- vendor momentum
- briefings/watchlists

Acceptance:
- signal source metadata required
- low-confidence signal does not over-move rankings
- tests for macro/regulatory/company/market-talk signals

================================================================================
SECTION 14 — PHASE 11: TEST PLAN
================================================================================

Add/ensure tests for:

Build/test reliability:
- Prisma-free seed-mode tests pass
- app build does not fail due Google fonts
- generated Prisma client path issue fixed

Truth engine:
- unsupported claims not verified
- seed data labelled seed
- stale data warning
- conflicting claims disputed
- missing source lowers confidence

Product scope:
- every displayed capability has ProductScope
- missing ProductScope blocks or flags display
- uncertain products show uncertainty

Capabilities:
- no capability score verified without source
- seed scores display seed label
- confidence displayed
- source link or validation required displayed
- ProductScope mapping visible

Commercial model inventory:
- hosted third-party not counted first-party
- deprecated models excluded active count
- AWS/Azure/Oracle/Glean/Harvey ownership correct
- infrastructure-only vendors state correct

Investor Tools:
- dropdown exists
- old routes redirect
- warnings visible
- no buy/sell language

Simulator:
- manual vendor dropdown works
- single_stock only public_direct
- IPO watch excludes public stocks
- shock timing shown
- cross-feed validator blocks stale output
- scatter axes auto-scale
- indirect exposure lines colour-coded

IPO:
- R0/R1 disables month forecast
- no verified offer price means no dollar price
- M1-M10 bands labelled estimates
- missing data checklist visible

Market signals:
- unsupported market talk not fact
- signal impacts logged
- source confidence applied

Connectors:
- missing API keys show not_configured
- health check works
- normalisation creates EvidenceSource/TruthRecord
- no fake successful connections

================================================================================
SECTION 15 — PHASE 12: FINAL REPORTING
================================================================================

Write reports:

1. AUDIT_REPORT_CAPABILITIES.md
- what was broken
- what is fixed
- unsupported claims found
- seed data still used
- missing connectors
- stale data
- tests/build status
- next steps

2. AUDIT_REPORT_DATA_CONNECTIONS.md
- connector list
- configured status
- missing env vars
- implemented vs stub
- last fetch status
- data groups covered
- data gaps

3. AUDIT_REPORT_TRUTH_ENGINE.md
- claim/evidence architecture
- blocked unsupported outputs
- remaining risks
- production readiness assessment

4. RELEASE_NOTES.md
- summary of changes
- known limitations
- deployment notes

================================================================================
SECTION 16 — FINAL ACCEPTANCE CRITERIA
================================================================================

The work is accepted when:

- npm test passes
- npm run build passes
- TypeScript passes if configured
- /dashboard renders
- /capabilities renders truth-safe capability data
- Commercial LLM Models card renders
- Investor Tools dropdown works
- Investment Simulator fixes work
- ProductScope registry exists
- source/evidence/data-status metadata visible
- data-source connector status page exists
- unsupported claims render unknown or validation required
- seed data is never labelled verified
- hosted third-party models are not counted as first-party
- private IPO companies are not treated as directly investable
- audit reports are written

Final instruction:
Do not optimise for more charts before fixing truth and data provenance.
The product only becomes valuable when the data pipeline is trustworthy.

End of prompt pack.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/01_MASTER_CONTEXT_PROMPT.md

# Claude Code Prompt 01 — Master Context

You are working inside the AI Enterprise codebase for Mike.

AI Enterprise is an executive-grade market intelligence platform for enterprise AI.

It includes:
- Dashboard
- Vendor Intelligence
- Market Tracker
- News Intelligence
- Capabilities
- Assessment
- Briefings
- Watchlists
- Investor Tools

Investor Tools includes:
- Investment Intelligence
- Investment Simulator
- Public AI Stocks
- IPO Watch
- Indirect Exposure Map
- Investment Briefings
- Investor Watchlist

## Core problem

The product still relies too heavily on seed/static data.

The priority is not new UI. The priority is making the platform truth-safe and source-backed.

The target architecture is:

```text
source → evidence → claim → calculation → output → chart
```

## Non-negotiable rule

No hallucinated, unsupported, stale, fake, or unverified output may appear as fact.

If data is missing, stale, seed, inferred, or unverified, the app must say so.

Use labels:
- verified
- documented
- tested
- estimated
- inferred
- seed
- stale
- disputed
- unknown
- unsupported

Evidence grades:
- E0: no evidence
- E1: vendor claim only
- E2: public documentation
- E3: public test, sandbox/API verification, or live API/model-list verification
- E4: production customer evidence
- E5: independent audit, verified benchmark, filing, audited report, or third-party validation

## Current known issues from audit

1. Full test suite failed because `lib/prisma.ts` imports `../generated/prisma/client`, but the generated Prisma client is missing.
2. `prisma generate` may fail in restricted environments because of `DATABASE_URL` and Prisma binary downloads.
3. `npm run build` may fail because of missing Prisma client.
4. Next.js build may fail because `next/font/google` tries to fetch Google Fonts.
5. `/capabilities` uses seed capability data from `lib/intelligence/seed-capabilities.ts`.
6. `/capabilities` lacks audit-grade metadata per capability:
   - sourceUrl
   - sourceName
   - sourceDate
   - confidenceScore
   - dataStatus
   - freshnessStatus
   - uncertaintyNote
   - ProductScope linkage
   - TruthRecord linkage
   - calculation provenance
   - formula version
7. Commercial LLM model inventory is better structured but still needs live verification.
8. Free-source connector suite is not fully implemented.

## Operating instruction

Before making changes:
1. Inspect the repo.
2. Identify package manager and framework.
3. Find routes:
   - `/dashboard`
   - `/capabilities`
   - `/investor-tools`
   - `/api/*`
4. Run:
   - `npm test`
   - `npm run build`
   - `npx tsc --noEmit` if configured
5. Record failures.
6. Fix only what is in the current prompt.
7. Add or update tests.
8. Never fabricate live data.

## Do not

- Do not remove existing modules.
- Do not add new visual features before fixing data provenance.
- Do not label seed data as verified.
- Do not treat hosted third-party models as first-party.
- Do not treat private IPO-watch companies as directly investable.
- Do not suppress uncertainty notes.

## First outcome expected

A stable repo where test/build failures are known or fixed, and where `/capabilities` can be upgraded without making the data problem worse.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/02_TASK_1_BUILD_TEST_STABILISATION.md

# Claude Code Prompt 02 — Task 1: Build and Test Stabilisation

Mike wants the codebase stabilised before any new feature work.

## Scope

Fix build/test reliability only.

Known blockers:
1. Missing generated Prisma client.
2. Prisma import path: `../generated/prisma/client`.
3. Prisma generation may require `DATABASE_URL`.
4. Google Fonts may break builds in restricted/offline environments.
5. Some tests fail due Prisma import even when they do not need DB.

## Tasks

1. Run:
   ```bash
   npm test
   npm run build
   npx tsc --noEmit
   ```
   If any command is unavailable, record that.

2. Inspect:
   - `lib/prisma.ts`
   - `prisma/schema.prisma`
   - `prisma.config.ts`
   - `package.json`
   - Next font imports
   - app layout files

3. Fix Prisma strategy.

Preferred outcome:
- `prisma generate` runs before build where needed.
- Generated client output path matches import path.
- Non-DB tests do not fail because Prisma client is missing.
- DB-only modules import Prisma lazily or behind a repository boundary.
- Seed/static routes can run without live DB.

Acceptable fixes:
- Add `prebuild` / `pretest` if appropriate.
- Add generated client output config if missing.
- Move Prisma import behind DB-only function.
- Add safe fallback repository for seed mode.
- Ensure `DATABASE_URL` requirements are documented.

4. Fix Google Font build fragility.

Preferred outcome:
- Remove `next/font/google` dependency.
- Use local fonts or system font stack.
- Build does not depend on fetching Google Fonts.

5. Re-run:
   ```bash
   npm test
   npm run build
   npx tsc --noEmit
   ```

6. Write or update:
   ```text
   AUDIT_REPORT_BUILD_STABILITY.md
   ```

Include:
- commands run
- failures before fix
- changes made
- remaining issues
- exact pass/fail status

## Acceptance criteria

- `npm test` passes, or any remaining failures are unrelated and documented.
- `npm run build` passes.
- TypeScript passes if configured.
- No missing Prisma generated client import error.
- No Google Font fetch dependency blocks the build.
- No new product features added.

## Important

Do not fabricate DB state.
Do not add fake data.
Do not touch investment or dashboard UI unless required for build stability.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/03_TASK_2_CAPABILITIES_AUDIT.md

# Claude Code Prompt 03 — Task 2: /capabilities Data Flow Audit

Do not implement fixes yet unless they are tiny and safe.

Audit the `/capabilities` page and write a report.

## Tasks

1. Locate:
   - `/capabilities` route
   - all components it uses
   - all API routes it calls
   - all repositories/data files it imports

2. Determine whether `/capabilities` uses:
   - seed JSON
   - database records
   - live connectors
   - static in-memory arrays
   - API routes
   - generated calculations

3. For every displayed capability, identify whether it has:
   - vendorId
   - productScopeId(s)
   - capabilityName
   - capabilityCategory
   - capabilityStatus
   - maturityScore
   - evidenceGrade
   - confidenceScore
   - dataStatus
   - sourceIds
   - sourceUrls
   - sourceNames
   - sourceDate
   - lastVerifiedAt
   - freshnessStatus
   - uncertaintyNote
   - calculationTrace
   - formulaVersion
   - truthRecordIds

4. Identify:
   - unsupported claims
   - seed scores
   - stale dates
   - missing source fields
   - missing ProductScope mapping
   - missing TruthRecord mapping
   - manually assigned scores
   - calculations with no provenance
   - UI labels that imply verified data when it is seed/static

5. Check whether hosted third-party model/platform capabilities are separated from first-party capabilities.

6. Write:

```text
AUDIT_REPORT_CAPABILITIES.md
```

Report sections:
- data sources used
- route/component map
- seed/static data found
- unsupported claims
- missing metadata
- missing ProductScope links
- missing TruthRecord links
- calculation gaps
- UI honesty issues
- recommended fixes
- priority order

## Acceptance criteria

- Audit report exists.
- Report is specific, file-based, and honest.
- No invented observations.
- No claim of live data if only seed data exists.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md

# Claude Code Prompt 04 — Task 3: Truth Engine Minimum Contract

Implement the minimum Truth Engine contract needed to make `/capabilities` and future modules truth-safe.

## Goal

All rendered material data must have:
- data status
- evidence grade
- confidence
- source/evidence metadata or unknown/validation-required label

## Models

Create or harden these types/models.

### EvidenceSource

```ts
type EvidenceSource = {
  id: string;
  entityType: string;
  entityId: string;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  sourceDate?: string;
  capturedAt: string;
  publisher?: string;
  isOfficialSource?: boolean;
  isPrimarySource?: boolean;
  isLicensedSource?: boolean;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  freshnessStatus: FreshnessStatus;
  notes?: string;
};
```

### TruthRecord

```ts
type TruthRecord = {
  id: string;
  entityType: string;
  entityId: string;
  claimType: string;
  claimText: string;
  numericValue?: number;
  unit?: string;
  period?: string;
  geography?: string;
  sourceIds: string[];
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  dataStatus: DataStatus;
  freshnessStatus: FreshnessStatus;
  uncertaintyNote?: string;
  createdAt: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
  expiryDate?: string;
};
```

### Enums

```ts
type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";

type DataStatus =
  | "verified"
  | "documented"
  | "tested"
  | "estimated"
  | "inferred"
  | "seed"
  | "stale"
  | "disputed"
  | "unknown"
  | "unsupported";

type FreshnessStatus = "fresh" | "aging" | "stale" | "unknown";
```

## Rendering helpers

Create helpers:

```ts
canRenderAsVerified(record: TruthRecord): boolean
truthDisplayStatus(record: TruthRecord): string
truthBadgeProps(record: TruthRecord): BadgeProps
requiresValidation(record: TruthRecord): boolean
```

Rules:
- E0 cannot render as verified.
- Seed data must show seed label.
- Stale data must show stale label.
- Low confidence must show warning.
- Missing sourceIds must show source validation required.
- Disputed data must show disputed badge.
- Unsupported data must render Unknown, not as a fact.

## Tests

Add tests for:
- verified path
- seed path
- stale path
- unsupported path
- missing source path
- disputed path
- low-confidence path

## Acceptance criteria

- Truth Engine helpers exist.
- Tests pass.
- Existing UI can consume these helpers.
- No new fake data.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md

# Claude Code Prompt 05 — Task 4: Upgrade /capabilities to Truth-Safe Capability Intelligence

Upgrade `/capabilities` from seed capability matrix to truth-safe capability intelligence.

## Required data type

Upgrade or create:

```ts
type CapabilityRecord = {
  id: string;
  vendorId: string;
  vendorName: string;
  capabilityId: string;
  capabilityName: string;
  capabilityCategory: string;
  productScopeIds: string[];
  status: "available" | "preview" | "partial" | "unknown" | "deprecated" | "not_available";
  maturityScore?: number;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  dataStatus: DataStatus;
  freshnessStatus: FreshnessStatus;
  sourceIds: string[];
  sourceUrls?: string[];
  sourceNames?: string[];
  sourceDate?: string;
  lastVerifiedAt?: string;
  uncertaintyNote?: string;
  truthRecordIds: string[];
  formulaVersion?: string;
  calculationTrace?: CalculationTrace;
  isSeedScore: boolean;
  isCalculated: boolean;
  isVerified: boolean;
};
```

```ts
type CalculationTrace = {
  formulaVersion: string;
  inputTruthRecordIds: string[];
  inputValues: Record<string, unknown>;
  outputValue: number;
  confidenceScore: number;
  computedAt: string;
};
```

## ProductScope linkage

Every capability must map to at least one ProductScope item.

If missing:
- do not show as verified
- show “Capability source validation required”
- block or warn in UI
- fail tests if marked verified

## UI requirements

Every capability cell or row must display:
- status
- score
- evidence badge
- data-status badge
- confidence score
- source link or “Source validation required”
- stale warning if stale
- uncertainty tooltip
- seed warning if seed
- calculation/provenance drawer if available

## Seed data handling

If current seed data is retained:
- mark `dataStatus = "seed"`
- mark `isSeedScore = true`
- mark `confidenceScore <= 50` unless source-backed
- show “Seed score — not verified”

Do not let seed data appear as live intelligence.

## Capability overview

Add or update summary cards:
- total vendors
- products in scope
- capabilities tracked
- verified capabilities
- documented capabilities
- seed/inferred capabilities
- stale capabilities
- unknown capabilities
- unsupported claims blocked

## Tests

Add tests:
- no capability renders verified without sourceIds
- seed capability shows seed label
- stale capability shows stale label
- missing ProductScope blocks verified display
- capability with E0 renders Unknown / requires validation
- capability score displays confidence
- source metadata appears in drilldown

## Acceptance criteria

- `/capabilities` renders.
- All capability records have dataStatus and evidenceGrade.
- Seed values are clearly labelled.
- Source validation gaps are visible.
- Tests pass.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/06_TASK_5_CONNECTOR_SCAFFOLD.md

# Claude Code Prompt 06 — Task 5: Free/Official Data Connector Scaffold

Build the connector scaffold for AI Enterprise.

Do not attempt to fully implement every connector in one pass. Build truthful connector status and minimal safe fetching where possible.

## Connector interface

Create:

```text
lib/connectors/types.ts
```

Interface:

```ts
export interface DataConnector {
  id: string;
  name: string;
  category: ConnectorCategory;
  requiresApiKey: boolean;
  configured(): boolean;
  healthCheck(): Promise<ConnectorHealth>;
  fetch(params: unknown): Promise<SourceSnapshot[]>;
  normalise(snapshot: SourceSnapshot): Promise<EvidenceSource[]>;
}
```

Types:
- ConnectorCategory
- ConnectorHealth
- SourceSnapshot
- ConnectorRun
- ConnectorStatus

## Connector files

Create or scaffold:

```text
lib/connectors/sec.ts
lib/connectors/fred.ts
lib/connectors/bls.ts
lib/connectors/bea.ts
lib/connectors/eia.ts
lib/connectors/fiscalData.ts
lib/connectors/alphaVantage.ts
lib/connectors/gdelt.ts
lib/connectors/github.ts
lib/connectors/congress.ts
lib/connectors/federalRegister.ts
lib/connectors/vendorDocs.ts
lib/evidence/normalise.ts
lib/evidence/freshness.ts
lib/evidence/confidence.ts
```

## Required behaviour

If connector needs an API key and it is missing:
```json
{
  "status": "not_configured",
  "message": "API key required"
}
```

Do not fake successful connections.

If fetch is not implemented:
```json
{
  "status": "not_implemented",
  "message": "Connector scaffold exists but fetch is not implemented."
}
```

## Priority connectors

1. SEC EDGAR / data.sec.gov
   - no API key
   - uses SEC_USER_AGENT
   - filings, company facts, S-1

2. FRED
   - FRED_API_KEY
   - macro regime

3. Alpha Vantage
   - ALPHA_VANTAGE_API_KEY
   - prices/fundamentals/news sentiment

4. GDELT
   - no key for core APIs
   - news/event signal

5. GitHub
   - optional GITHUB_TOKEN
   - developer/community signals

6. Vendor Docs
   - public docs fetcher
   - commercial model inventory and capabilities

## API routes

Add:

```text
GET /api/data-sources/status
POST /api/data-sources/refresh
GET /api/data-sources/[connectorId]
```

## Data Sources page

Create one of:

```text
/data-sources
/admin/data-sources
```

Show:
- connector name
- category
- configured
- status
- last run
- last success
- last error
- records fetched
- freshness
- requires API key

## Tests

Add tests:
- missing key shows not_configured
- no connector fakes success
- SEC connector has compliant User-Agent requirement
- normalise returns EvidenceSource shape
- status API renders connector statuses

## Acceptance criteria

- connector status page exists
- connectors truthfully report configured/not configured
- no fake live data
- tests pass


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/07_COACHING_AND_SWITCH_TO_CODEX.md

# Coaching Guide — How Mike Should Run Stage 1 and When to Switch to Codex

## The stage we are in

We are not in scale-building mode yet.

We are in **repair and architecture stabilisation mode**.

That means Claude Code should lead until the truth/data architecture is stable.

## Your role, Mike

Act like a product owner and technical reviewer.

Do not ask Claude Code to “build the whole product.”
Ask it to complete one bounded stage at a time.

Good instruction style:

```text
Do only Task 1. Fix build/test reliability. Do not add new UI.
```

Bad instruction style:

```text
Fix everything and make it production ready.
```

The second will create sprawl.

## Stage 1 order

Run prompts in this order:

1. Master context
2. Build/test stabilisation
3. /capabilities audit
4. Truth Engine minimum contract
5. /capabilities truth-safe upgrade
6. Connector scaffold

## Stop after each task

After each prompt, ask Claude Code:

```text
Summarise:
1. files changed
2. commands run
3. tests/build result
4. remaining risks
5. whether the next task is safe
```

Do not continue if build/test stability gets worse.

## When to stay with Claude Code

Keep Claude Code leading while work is:

- debugging build failures
- fixing Prisma
- fixing TypeScript architecture
- tracing data flow
- auditing sources
- enforcing ProductScope / TruthRecord logic
- refactoring `/capabilities`
- writing audit reports
- making critical sequencing decisions

Claude Code is better here because it can work locally, inspect files, run commands, and reason across the codebase.

## When to switch to Codex

Switch to Codex when these are true:

1. `npm test` passes.
2. `npm run build` passes.
3. TypeScript passes.
4. `/capabilities` renders truth-safe data.
5. ProductScope is enforced.
6. Truth Engine helpers exist and are tested.
7. Data-source connector interface exists.
8. There is a connector status page.
9. Seed data is visibly labelled.
10. Remaining tasks can be split into independent modules.

Codex is better once tasks are discrete and parallel.

## Best Codex tasks after Stage 1

Use Codex for parallel, PR-shaped tasks:

```text
Implement the SEC connector only. Do not touch unrelated files.
```

```text
Implement the FRED connector only. Add tests and status integration.
```

```text
Implement the Alpha Vantage connector only.
```

```text
Implement the GDELT connector only.
```

```text
Build the capability evidence drawer UI only.
```

```text
Build the data-source status dashboard UI only.
```

```text
Implement vendor docs connector for OpenAI model catalogue only.
```

## Do not switch to Codex too early

If you switch now, Codex may add more feature code on top of weak seed data. That makes the app look better but less trustworthy.

Your current danger is feature sprawl.

The discipline is:

```text
truth first, connectors second, features third.
```

## Your success checklist before Codex

Use this checklist.

- [ ] Build passes
- [ ] Tests pass
- [ ] Prisma issue fixed
- [ ] Google font issue fixed
- [ ] Truth Engine helpers implemented
- [ ] ProductScope registry implemented
- [ ] /capabilities upgraded
- [ ] Seed labels visible
- [ ] Source validation required labels visible
- [ ] Connector interface implemented
- [ ] Data-source status page exists
- [ ] Audit reports written

When at least the first 10 are done, Codex can start helping.

## Coach's blunt advice

Do not let either Claude Code or Codex seduce you with nice UI before the data layer is credible.

AI Enterprise’s advantage is not more cards.

Its advantage is:

```text
credible, source-backed AI market intelligence.
```

Every development decision should protect that.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/08_REPORT_TEMPLATES.md

# Report Templates

## AUDIT_REPORT_BUILD_STABILITY.md

```md
# Build Stability Audit

Date:
Prepared for: Mike

## Commands run

## Initial failures

## Root causes

## Files changed

## Fixes applied

## Final test/build status

## Remaining risks

## Recommendation
```

## AUDIT_REPORT_CAPABILITIES.md

```md
# Capabilities Data Flow Audit

Date:
Prepared for: Mike

## Route audited

## Components

## Data sources

## Seed/static data found

## Missing evidence fields

## ProductScope gaps

## TruthRecord gaps

## Calculation provenance gaps

## UI honesty issues

## Unsupported claims

## Recommended fixes

## Priority order

## Final verdict
```

## AUDIT_REPORT_TRUTH_ENGINE.md

```md
# Truth Engine Audit

Date:
Prepared for: Mike

## Models added/changed

## Rendering guards

## Evidence grades

## Data statuses

## Tests

## Blocked unsupported outputs

## Remaining risks

## Final verdict
```

## AUDIT_REPORT_CONNECTORS.md

```md
# Data Connector Audit

Date:
Prepared for: Mike

## Connectors implemented

## Connectors scaffolded

## Connectors not configured

## API keys required

## Health status

## Evidence normalisation

## Known limitations

## Next connector priorities
```


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/09_COMMANDS_CHECKLIST.md

# Commands Checklist

Run from project root unless otherwise stated.

## Baseline

```bash
pwd
ls
cat package.json
npm test
npm run build
npx tsc --noEmit
```

## Prisma checks

```bash
ls prisma
cat prisma/schema.prisma
cat prisma.config.ts 2>/dev/null || true
grep -R "generated/prisma/client" -n .
grep -R "new PrismaClient" -n lib app prisma .
npx prisma generate
```

## Font checks

```bash
grep -R "next/font/google" -n app components lib .
grep -R "Cormorant\|Geist" -n app components lib .
```

## Capabilities data flow

```bash
grep -R "seed-capabilities" -n .
grep -R "VendorCapability" -n .
grep -R "capabilities" -n app lib components | head -100
```

## Truth/evidence

```bash
grep -R "EvidenceSource" -n .
grep -R "TruthRecord" -n .
grep -R "evidenceGrade" -n lib app components | head -100
grep -R "dataStatus" -n lib app components | head -100
```

## Model inventory

```bash
grep -R "CommercialModel" -n .
grep -R "model-inventory" -n .
```

## Investor Tools

```bash
grep -R "investor-tools" -n app lib components .
grep -R "simulator" -n app lib components | head -100
```

## Connector status

```bash
grep -R "connector" -n lib app | head -100
grep -R "data-sources" -n app lib components .
```

## After every task

```bash
npm test
npm run build
npx tsc --noEmit
```

If any fail, stop and fix before moving on.


---

## stage_1_batch/ai-enterprise-claude-code-stage-1/README.md

# AI Enterprise — Claude Code Stage 1 Prompt Pack

Prepared for: Mike  
Date: 10 May 2026  
Purpose: Stabilise AI Enterprise before scaling development with Codex.

## What this batch is for

This is the first Claude Code batch for AI Enterprise.

It focuses on:

1. Build and test stability.
2. Prisma client and dependency failures.
3. Google Fonts build fragility.
4. `/capabilities` audit.
5. Truth Engine enforcement.
6. ProductScope linkage.
7. EvidenceSource / TruthRecord metadata.
8. Source-backed capability rendering.
9. Connector architecture scaffolding.
10. Clear stopping rules before switching to Codex.

## What this batch is not for

Do not use this batch to build new dashboards, new charts, more investor UX, or extra visual features.

The priority is:

```text
source → evidence → claim → calculation → output → chart
```

Until that pipeline is working, more UI will only increase the mess.

## Recommended usage

Run these prompts in Claude Code one at a time.

Start with:

```text
01_MASTER_CONTEXT_PROMPT.md
```

Then:

```text
02_TASK_1_BUILD_TEST_STABILISATION.md
03_TASK_2_CAPABILITIES_AUDIT.md
04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md
05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md
06_TASK_5_CONNECTOR_SCAFFOLD.md
```

Use:

```text
07_COACHING_AND_SWITCH_TO_CODEX.md
```

to decide when to stop using Claude Code as the lead and start using Codex for parallel implementation.
