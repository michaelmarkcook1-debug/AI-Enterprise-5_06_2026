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
