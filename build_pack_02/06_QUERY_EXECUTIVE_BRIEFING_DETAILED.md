# Prompt — Detailed Query Build

## Objective

Refactor `/query` into an executive AI market briefing.

Query answers:

> What changed in the AI market that matters to enterprise decision-makers?

## Current Problem

The current Query page has too much ranking/share content near the top.

That is useful, but the page should first behave like an executive briefing.

## New Top Sections

### 1. Executive Market Brief

Create a top panel with:

- "What changed"
- "Why it matters"
- "CIO implication"
- "What to watch next"

Use existing:

- major news
- risk alerts
- weekly movers
- momentum

### 2. Market Events by Type

Group news/signals into:

- Model Releases
- Product Launches
- Funding
- M&A
- Partnerships
- Regulation
- Infrastructure
- Security / Trust
- Market Adoption

### 3. CIO Signal Radar

Cards:

- Adoption acceleration
- Platform encroachment
- Cost pressure
- Sovereignty / regulation
- Vendor concentration
- Security / trust

### 4. What Changed Since Last Snapshot

Use existing movers and momentum.

Show:

- biggest positive moves
- biggest negative moves
- category changes
- risk changes

## Move Lower

Keep but move lower:

- vendor market share pie
- top vendor leaderboard
- category market share
- quadrant / atlas chart
- commercial models

## Suggested Components

```text
components/query/ExecutiveMarketBrief.tsx
components/query/MarketEventGroups.tsx
components/query/CIOSignalRadar.tsx
components/query/SnapshotChangeSummary.tsx
lib/query/event-classification.ts
```

## Acceptance Criteria

- Query opens with executive market intelligence.
- Rankings remain but are secondary.
- Each signal has a CIO implication.
- Seed/estimated data remains labelled.
- Page is not more cluttered than before.

# Next Steps

Proceed to Investor Tools detailed build.
