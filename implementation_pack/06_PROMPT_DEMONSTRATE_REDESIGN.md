# PROMPT 5 — DEMONSTRATE Redesign

## Objective

Transform Demonstrate into the flagship CIO Board Defence module.

Demonstrate answers:

> How does the CIO defend the AI stack decision to the board?

## Current Assets

The current `/demonstrate` page includes:

- shortlist summary
- vendor uptake explorer
- token pricing comparison
- three-pillar reputation tracker
- news mentions
- pillar merits

These are valuable but insufficient. They currently provide market ratification. The new Demonstrate must provide board defence.

## New Board Defence Framework

Structure Demonstrate around these board questions:

### 1. Why are we investing?

Outputs:

- business problem
- expected business outcome
- productivity impact
- cost reduction
- revenue growth
- customer experience impact
- employee experience impact

### 2. Why now?

Outputs:

- cost of inaction
- market timing
- competitor movement
- technology maturity
- regulatory timing

### 3. Why this architecture?

Outputs:

- architecture rationale
- alternatives considered
- trade-offs
- integration implications
- optionality impact

### 4. Why these vendors?

Outputs:

- vendor selection rationale
- shortlist comparison
- excluded alternatives
- capability fit
- evidence confidence

### 5. What are competitors doing?

Outputs:

- peer adoption tracker
- competitor AI use cases
- competitor vendor usage where identifiable
- estimated maturity gap
- competitive position

### 6. What is market sentiment?

Use the existing Reputation Tracker.

Outputs:

- developer reputation
- employee reputation
- customer reputation
- analyst / media sentiment if available
- investor confidence if available
- product trust signals

### 7. What could go wrong?

Outputs:

- enterprise risk register
- regulatory risk
- security risk
- model risk
- vendor risk
- adoption risk
- workforce risk
- integration risk
- concentration risk

### 8. How are risks mitigated?

Outputs:

- human-in-the-loop controls
- audit trails
- policy controls
- data controls
- fallback options
- contract protections
- model/vendor diversification

### 9. How will success be measured?

Outputs:

- KPI baseline
- KPI target
- owner
- review cadence
- measurement method

### 10. Will this decision age well?

Outputs:

- strategic sustainability score
- encroachment risk
- dependency risk
- roadmap credibility
- switching cost
- optionality

### 11. What assumptions must remain true?

Outputs:

- explicit assumptions
- evidence behind assumptions
- monitoring signal
- failure trigger
- reassessment recommendation

Example assumption:

```text
Assumption: Harvey retains legal workflow advantage.
Failure trigger: Anthropic or OpenAI launches native legal workflow agents with document review, matter management integration and enterprise controls.
Action: Reassess legal AI stack.
```

## Required Demonstrate Dashboard Sections

1. Board Defence Score
2. CIO Confidence Score
3. Business Case
4. Cost of Inaction
5. Competitor Adoption
6. Recommended Stack
7. Vendor Defence
8. Reputation Intelligence
9. Strategic Sustainability
10. Risk Register
11. Assumption Monitor
12. Board Pack Generator

## Board Pack Generator

Create first-pass UI buttons for:

- Export Executive Summary
- Export Board Pack
- Export Procurement Pack
- Export Risk Review

It is acceptable for MVP export to generate JSON or markdown first, but design UI as if PDF/PPT export will follow.

## Keep Existing Demonstrate Assets

Do not remove:

- VendorUptakeExplorer
- TokenPricingTable
- ReputationTabs
- RestoreShortlistBanner
- shortlist summary
- news mentions
- pillar merits

Instead, reposition them inside the Board Defence Framework.

## Acceptance Criteria

- Demonstrate no longer feels like reputation-only.
- Demonstrate clearly answers board-level questions.
- Existing reputation, pricing and uptake tools remain available.
- CIO Confidence Score is visible.
- Board Defence Score is visible.
- Assumption monitoring appears as a real section.
- Competitor adoption is included.
- Outputs are clearly evidence-graded.
