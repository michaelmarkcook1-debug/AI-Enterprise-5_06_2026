# AI Enterprise Pack 02 — Detailed Build Pack

## Purpose

This is the second Claude Code implementation pack.

Use this after Pack 01 has started or completed the first structural re-architecture:

- `/` routes to `/query`
- Top navigation is changed to:
  - Query
  - Understand
  - Assess
  - Demonstrate
  - Monitor
  - Investor Tools
- Atlas and Leadership are preserved but no longer dominate top-level navigation
- Monitor and Investor Tools exist as routes

Pack 02 goes deeper. It gives Claude Code concrete implementation tasks for:

1. Demonstrate — CIO Board Defence Framework
2. Monitor — Decision Validity and Recommendation Drift
3. Assess — Three-tier assessment product
4. Understand — Strategic Sustainability, Encroachment Risk, Dependency Risk
5. Query — Executive Market Briefing
6. Investor Tools — Scenario Simulator and Capital Allocation View
7. Shared data types, seed data and scoring helpers
8. Acceptance tests

## Critical Instruction

Do not rebuild the app from scratch.

Reuse the existing source:

- `PageFrame`
- `Panel`
- `Metric`
- `ScoreBar`
- `Confidence`
- `SeedDataBadge`
- `OwnershipLegend`
- `VendorNameWithOwnership`
- `VendorUptakeExplorer`
- `TokenPricingTable`
- `ReputationTabs`
- `WatchlistManager`
- `ExposureMapHero`
- `QuadrantChart`
- `lib/intelligence/repository`
- `lib/intelligence/provenance`
- `lib/reputation/seed`
- `lib/model-inventory/token-pricing`

## Build Rule

After every major change:

```bash
npm run build
npm run lint
npm test
```

If a command is unavailable or failing for pre-existing reasons, report the exact failure. Do not hide it.

## Truthfulness Rule

Any estimated, seed or heuristic score must be labelled clearly. Do not present seed data as live verified intelligence.
