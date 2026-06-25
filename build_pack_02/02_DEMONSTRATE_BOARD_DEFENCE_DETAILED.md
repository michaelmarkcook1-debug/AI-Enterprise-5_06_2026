# Prompt — Detailed Demonstrate Build

## Objective

Rebuild `/demonstrate` into the flagship CIO Board Defence module.

Demonstrate must answer:

> Can the CIO defend this AI stack decision to the board, CFO, procurement, audit and risk committee?

## Current Demonstrate Assets

Preserve and reposition:

- `RestoreShortlistBanner`
- `VendorUptakeExplorer`
- `TokenPricingTable`
- `ReputationTabs`
- shortlist summary
- news mentions
- pillar merits

## New Page Structure

### 1. Executive Defence Summary

Top section with:

- Board Defence Score
- CIO Confidence Score
- Recommendation Status
- Current shortlist
- Main board takeaway

Recommendation status values:

- Defensible
- Defensible with Conditions
- Pilot First
- Reassess
- Do Not Proceed

### 2. Why Invest?

Create `BusinessCasePanel`.

Fields:

- business problem
- intended outcomes
- productivity impact
- cost reduction potential
- revenue potential
- CX / EX impact
- evidence confidence

### 3. Why Now?

Create `CostOfInactionPanel`.

Fields:

- competitor pressure
- labour cost pressure
- margin pressure
- operational inefficiency
- market timing
- regulatory timing
- inaction risk score

### 4. Why This Architecture?

Create `ArchitectureDefencePanel`.

Fields:

- architecture chosen
- alternatives considered
- reason selected
- integration implication
- optionality implication
- lock-in risk
- fallback route

### 5. Why These Vendors?

Create `VendorSelectionDefence`.

Use existing shortlist and pillar scores.

For each vendor show:

- why shortlisted
- strongest evidence
- weakest evidence
- top use cases
- risk flags
- confidence

### 6. What Are Competitors Doing?

Create `CompetitorAdoptionTracker`.

MVP can use seed data.

Fields:

- competitor / peer group
- known or estimated AI maturity
- known use cases
- vendors used if public
- maturity gap
- CIO implication

Seed example:

```ts
[
  {
    peer: "Tier-1 banking peer group",
    maturity: "Advanced",
    useCases: ["Customer service", "Software engineering", "Risk operations"],
    knownVendors: ["Microsoft", "OpenAI", "ServiceNow"],
    implication: "Delaying AI workflow automation increases operating-model gap."
  }
]
```

### 7. Market Sentiment

Use existing Reputation Tracker.

Keep developer, employee and customer reputation.

Add summary cards:

- overall reputation direction
- strongest reputation pillar
- weakest reputation pillar
- warning signals

### 8. What Could Go Wrong?

Create `RiskRegister`.

Risk categories:

- data leakage
- hallucination
- regulatory breach
- security incident
- model dependency
- vendor lock-in
- cost explosion
- adoption failure
- workforce resistance
- integration failure
- reputation risk
- supplier concentration

Fields:

- risk
- severity
- likelihood
- mitigation
- owner
- status

### 9. How Are Risks Mitigated?

Create `RiskMitigationPanel`.

Controls:

- human-in-the-loop approval
- audit trails
- policy controls
- red teaming
- DLP
- role-based access
- fallback process
- vendor exit clause
- model diversification
- monitoring cadence

### 10. How Will Success Be Measured?

Create `ValueRealisationDashboard`.

KPI fields:

- metric
- baseline
- target
- owner
- cadence
- measurement method

KPI examples:

- cost per transaction
- cycle time
- customer response time
- ticket deflection
- employee productivity
- software delivery velocity
- customer satisfaction
- NPS
- error rate

### 11. Will This Decision Age Well?

Create `StrategicSustainabilityPanel`.

Show:

- Strategic Sustainability Score
- Platform Encroachment Risk
- Model Dependency Risk
- Switching Cost
- Optionality
- Reassessment horizon

### 12. What Assumptions Must Remain True?

Create `AssumptionMonitorPanel`.

Each assumption:

- assumption
- reason it matters
- current status
- failure trigger
- monitoring signal
- recommended action

Example:

```text
Assumption: Harvey retains legal workflow differentiation.
Failure trigger: Anthropic/OpenAI release native legal review + matter workflows.
Action: Reassess legal AI stack.
```

### 13. Board Pack Generator

Create `BoardPackGenerator`.

Buttons:

- Export Executive Summary
- Export Board Defence Pack
- Export Procurement Pack
- Export Risk Review

MVP output can be Markdown or JSON download.

## Suggested Files

```text
components/demonstrate/BoardDefenceScore.tsx
components/demonstrate/CIOConfidenceScore.tsx
components/demonstrate/BusinessCasePanel.tsx
components/demonstrate/CostOfInactionPanel.tsx
components/demonstrate/ArchitectureDefencePanel.tsx
components/demonstrate/VendorSelectionDefence.tsx
components/demonstrate/CompetitorAdoptionTracker.tsx
components/demonstrate/RiskRegister.tsx
components/demonstrate/RiskMitigationPanel.tsx
components/demonstrate/ValueRealisationDashboard.tsx
components/demonstrate/StrategicSustainabilityPanel.tsx
components/demonstrate/AssumptionMonitorPanel.tsx
components/demonstrate/BoardPackGenerator.tsx
lib/demonstrate/board-defence.ts
lib/demonstrate/seed.ts
```

## Acceptance Criteria

- `/demonstrate` is board-defence-led.
- Existing reputation, uptake and pricing sections remain.
- Board Defence Score and CIO Confidence Score are visible.
- Assumption monitoring is visible.
- Competitor adoption is visible.
- Risk register is visible.
- Export buttons exist.
- Estimated values are labelled.

# Next Steps

Proceed to Monitor detailed build.
