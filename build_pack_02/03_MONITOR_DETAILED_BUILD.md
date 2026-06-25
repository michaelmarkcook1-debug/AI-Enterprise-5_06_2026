# Prompt — Detailed Monitor Build

## Objective

Build `/monitor` into the continuous decision-validity layer.

Monitor answers:

> Is the AI recommendation still valid?

## Page Structure

### 1. Monitor Executive Summary

Top cards:

- Active Recommendations
- Recommendations At Risk
- Broken Assumptions
- Reassessment Required
- New Vendor Signals
- New Regulatory Signals

### 2. Recommendation Drift

Create `RecommendationDriftTable`.

Fields:

- recommendation
- vendor / stack
- original score
- current score
- drift
- drift reason
- severity
- recommended action

Severity:

- Stable
- Watch
- Reassess This Quarter
- Reassess Now

### 3. Assumption Monitor

Create `AssumptionMonitor`.

Fields:

- assumption
- linked vendor / workflow
- status
- trigger
- current signal
- confidence
- action

Statuses:

- Stable
- Watch
- At Risk
- Broken

### 4. Vendor Change Feed

Create `VendorChangeFeed`.

Use existing news and momentum.

Categories:

- model release
- product release
- funding
- M&A
- partnership
- leadership
- pricing
- security
- regulation
- reputation

### 5. Regulation Watch

Create `RegulationWatch`.

MVP seed categories:

- EU AI Act
- UK AI regulation
- US federal/state regulation
- financial services
- healthcare
- public sector
- defence
- data residency / sovereignty

### 6. Reputation Shift Monitor

Reuse reputation seed data.

Show:

- developer shift
- employee shift
- customer shift
- warning signals

### 7. Reassessment Queue

Create `ReassessmentQueue`.

Fields:

- item
- trigger
- affected vendors
- affected workflow
- urgency
- recommended next step

### 8. Watchlist Manager

Move or duplicate existing `WatchlistManager` into Monitor as the setup/control area.

## Suggested Files

```text
app/monitor/page.tsx
components/monitor/MonitorSummary.tsx
components/monitor/RecommendationDriftTable.tsx
components/monitor/AssumptionMonitor.tsx
components/monitor/VendorChangeFeed.tsx
components/monitor/RegulationWatch.tsx
components/monitor/ReputationShiftMonitor.tsx
components/monitor/ReassessmentQueue.tsx
lib/monitor/seed.ts
lib/monitor/scoring.ts
```

## Seed Example

```ts
export const MONITOR_ASSUMPTIONS = [
  {
    id: "legal-workflow-durability",
    title: "Specialist legal AI vendors retain workflow differentiation",
    status: "watch",
    trigger: "Frontier model vendor launches native legal review and matter workflows",
    currentSignal: "Frontier vendors expanding agent workflow surfaces",
    action: "Monitor Harvey, Anthropic and OpenAI legal workflow releases",
    confidence: 62
  }
];
```

## Acceptance Criteria

- `/monitor` loads.
- Recommendation drift appears.
- Assumption monitoring appears.
- Reassessment queue appears.
- Watchlists are accessible.
- Existing data labels and provenance are preserved.
- MVP seed data is clearly labelled.

# Next Steps

Proceed to Assess detailed build.
