# PROMPT 6 — MONITOR

## Objective

Create Monitor as a first-class component.

Monitor answers:

> Is the AI decision still valid?

## Product Logic

AI recommendations are perishable. A stack recommendation that is valid today may degrade in six months if:

- a frontier model releases a new workflow capability
- a vendor loses reputation
- regulation changes
- a security incident occurs
- a competitor adopts faster
- a pricing model changes
- a vendor is acquired
- a dependency becomes risky

## Current Assets To Reuse

- WatchlistManager
- listWatchlists
- listNewsItems
- listVendorMomentum
- getMarketDashboard
- risk alerts
- provenance
- reputation seed data
- vendor scores
- pricing table
- Atlas dependencies

## Monitor Page Structure

### 1. Recommendation Validity

Show current state:

- active recommendations
- recommended stack
- last assessment date
- current confidence
- drift since assessment

### 2. Recommendation Drift

Track score movement:

```text
Vendor: Harvey
Original Recommendation Score: 91
Current Score: 72
Drift: -19
Reason: platform encroachment risk increased
Trigger: frontier model legal workflow release
Action: Reassess legal AI strategy
```

### 3. Assumption Failures

For each stored assumption:

- assumption
- status
- linked evidence
- failure trigger
- current signal
- action

Statuses:

- Stable
- Watch
- At Risk
- Broken

### 4. Vendor Change Monitor

Track:

- product launches
- funding events
- M&A
- leadership changes
- outages
- security events
- pricing changes
- customer wins/losses

### 5. Regulation Monitor

Track:

- EU AI Act changes
- UK regulation
- US regulation
- industry-specific regulation
- sovereignty requirements

### 6. Reputation Monitor

Track:

- developer reputation shifts
- employee reputation shifts
- customer reputation shifts
- media/analyst sentiment shifts

### 7. Competitor Movement

Track:

- competitor adoption
- peer use cases
- vendor choices
- industry maturity changes

### 8. Reassessment Queue

A prioritised queue:

- Reassess Now
- Reassess This Quarter
- Monitor Only

## Acceptance Criteria

- `/monitor` exists and loads.
- It reuses existing watchlist and market data.
- It includes recommendation drift.
- It includes assumption monitoring.
- It includes reassessment triggers.
- It does not require perfect live data in MVP; estimated/seed data must be labelled.
- It becomes a credible retention layer.
