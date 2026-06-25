# PROMPT 7 — INVESTOR TOOLS

## Objective

Preserve and elevate Investor Tools as a separate workflow.

Investor Tools answers:

> Where should capital be allocated?

This is not the same as CIO decision support.

## Personas

Investor Tools serves:

- venture capital
- private equity
- public market investors
- corporate development
- strategy teams
- M&A teams
- board strategy committees

## Product Separation

Do not bury Investor Tools inside Query, Understand, Assess, Demonstrate or Monitor.

Keep it as a separate top-level or visually separated nav area.

## Investor Questions

Investor Tools should answer:

1. Which vendors are gaining momentum?
2. Which categories are growing fastest?
3. Which vendors are overvalued or under-defended?
4. Which vendors are exposed to model/platform disruption?
5. Which vendors are infrastructure constrained?
6. Which vendors are acquisition targets?
7. Which categories are consolidating?
8. What happens under strategic shock scenarios?

## Required Sections

### 1. Investor Dashboard

- category momentum
- vendor momentum
- valuation / funding proxy where available
- market share movement
- risk-adjusted opportunity

### 2. Investment Intelligence

Track:

- funding
- M&A
- IPO watch
- revenue estimates
- growth estimates
- market share
- product velocity
- hiring velocity if available

### 3. Scenario Simulator

Allow user to select:

- vendor
- category
- shock type
- time horizon
- impact severity

Example shocks:

- Anthropic launches legal workflow agents
- OpenAI cuts enterprise pricing by 40%
- Microsoft bundles AI agents into E5
- NVIDIA supply shock
- EU sovereignty restriction
- major security incident
- acquisition of a key app vendor

Outputs:

- winners
- losers
- affected categories
- exposed vendors
- confidence level

### 4. AI Exposure Map

Track:

- model exposure
- cloud exposure
- GPU / semiconductor exposure
- sovereign exposure
- regulatory exposure
- platform dependency

### 5. Category Analysis

Categories:

- Frontier Models
- Agent Platforms
- AI Applications
- AI Infrastructure
- AI Data Platforms
- AI Security / Governance
- Sovereign AI
- Industry AI Applications

### 6. Vendor Financial Intelligence

Where available or estimated:

- ARR
- revenue growth
- funding
- valuation
- runway
- burn risk
- public market proxy
- acquisition likelihood

## Acceptance Criteria

- Investor Tools is clearly separate from CIO workflow.
- It reuses existing Query/Understand data.
- It includes scenario simulation UI.
- It includes exposure mapping.
- It labels estimated data clearly.
- It does not confuse buying advice with investment advice.
