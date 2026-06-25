# Acceptance Test Plan

## Build Tests

Run:

```bash
npm install
npm run build
npm run lint
npm test
```

If tests are not configured, document current status rather than pretending they pass.

## Route Smoke Tests

Verify these routes load:

- `/`
- `/query`
- `/understand`
- `/assess`
- `/demonstrate`
- `/monitor`
- `/investor-tools`
- `/atlas`
- `/quadrant`
- `/admin`

## Navigation Tests

Verify top nav contains:

- Query
- Understand
- Assess
- Demonstrate
- Monitor
- Investor Tools

Verify top nav does not primarily show:

- Atlas
- Leadership

Atlas and Leadership should remain accessible from Understand.

## Data Truthfulness Tests

Verify:

- seed data labelled
- estimated data labelled
- provenance visible
- confidence visible
- E0-E5 methodology preserved
- no "live" claim where source is seed/estimated

## Product Tests

### Query

Must answer:

- What changed?
- What matters?
- What should the CIO watch?

### Understand

Must answer:

- What is this vendor?
- Where does it fit?
- What are its dependencies?
- What risks exist?

### Assess

Must answer:

- Where should we start?
- What should we deploy?
- Should we buy this?

### Demonstrate

Must answer:

- Why this decision?
- Why now?
- Why these vendors?
- What are competitors doing?
- What could go wrong?
- How is risk mitigated?
- How is success measured?

### Monitor

Must answer:

- Is the recommendation still valid?
- Which assumptions are weakening?
- What requires reassessment?

### Investor Tools

Must answer:

- Which vendors/categories are investable?
- What scenarios change the market?
- What exposure risks exist?

## Regression Tests

Ensure existing components still render:

- AIAtlasClient
- QuadrantChart
- UnderstandTabs
- AssessForm
- WatchlistManager
- ReputationTabs
- VendorUptakeExplorer
- TokenPricingTable
- VendorSharePie
