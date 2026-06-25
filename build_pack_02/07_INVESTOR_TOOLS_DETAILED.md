# Prompt — Detailed Investor Tools Build

## Objective

Create or enhance `/investor-tools` as a separate workflow.

Investor Tools answers:

> Where should capital be allocated?

Do not mix this with CIO buying recommendations.

## Page Sections

### 1. Investor Dashboard

Top cards:

- Category Momentum
- Vendor Momentum
- Disruption Risk
- Infrastructure Exposure
- Funding / M&A Signals
- Watchlist

### 2. Category Opportunity Map

Categories:

- frontier models
- agent platforms
- AI applications
- industry AI applications
- AI infrastructure
- data platforms
- governance/security
- sovereign AI

Show for each:

- growth momentum
- competition intensity
- defensibility
- platform encroachment risk
- capital intensity
- likely consolidation

### 3. Scenario Simulator

Create `ScenarioSimulator`.

Inputs:

- shock type
- affected vendor/category
- severity
- time horizon

Shock types:

- frontier model release
- pricing collapse
- hyperscaler bundling
- security incident
- regulation shock
- GPU supply shock
- acquisition
- major customer loss
- open-source disruption

Outputs:

- likely winners
- likely losers
- category impact
- confidence
- investment implication

### 4. Exposure Map

Reuse Atlas / ExposureMap.

Show:

- model exposure
- cloud exposure
- GPU exposure
- semiconductor exposure
- sovereign exposure
- regulatory exposure

### 5. Vendor Financial Intelligence

MVP seed estimates:

- funding stage
- estimated ARR band
- growth band
- capital intensity
- acquisition likelihood
- IPO likelihood
- runway risk

### 6. Investor Watchlist

Reuse WatchlistManager if possible or create simplified investor watchlist.

## Suggested Files

```text
app/investor-tools/page.tsx
components/investor/InvestorDashboard.tsx
components/investor/CategoryOpportunityMap.tsx
components/investor/ScenarioSimulator.tsx
components/investor/InvestorExposureMap.tsx
components/investor/VendorFinancialIntelligence.tsx
lib/investor/seed.ts
lib/investor/scenario-simulator.ts
```

## Acceptance Criteria

- Investor Tools exists and is separate.
- It does not read like CIO procurement advice.
- It includes scenario simulation UI.
- It includes exposure intelligence.
- It labels financial estimates clearly.

# Next Steps

Proceed to shared types and QA.
