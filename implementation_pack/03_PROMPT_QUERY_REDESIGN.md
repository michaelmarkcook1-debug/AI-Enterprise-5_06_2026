# PROMPT 2 — QUERY Redesign

## Objective

Transform Query into the executive AI market intelligence briefing.

Query should answer:

> What is happening in the AI market?

It should not primarily answer:

> Who is ranked first?

Rankings remain useful, but they should support the briefing rather than dominate it.

## Current Assets

The current `/query` page already includes:

- tracked vendors
- signals
- risk radar
- category share
- vendor market share
- AI Atlas / quadrant
- top enterprise AI platform vendors
- winning / losing vendors
- market movers
- category share estimates
- agentic AI momentum
- sector leaders
- commercial models
- news stream

Keep these, but reorder and reframe.

## Target Page Structure

### 1. Executive Market Brief

A top section summarising:

- what changed in the last 24h / 7d / 30d
- top 3 market events
- top 3 vendor signals
- top 3 risk alerts
- one "CIO implication" paragraph

This can initially use existing `dashboard.majorNews`, `dashboard.riskAlerts`, `dashboard.weeklyMovers`, and `generateWeeklyBriefing` if available.

### 2. Market Event Stream

Group events into:

- Product Launches
- Funding
- M&A
- Partnerships
- Regulation
- Model Releases
- Infrastructure / Semiconductor
- Security / Trust Events

If the data model does not yet classify all these, create a classification adapter that maps existing news/event fields to these categories with fallback "Market Signal".

### 3. Momentum Signals

Use existing:

- winning vendors
- losing vendors
- weekly movers
- vendor momentum

Reframe these as market movement signals.

### 4. Regulation and Risk Watch

Use existing risk alerts and provenance.

### 5. AI Atlas Snapshot

Move Atlas/quadrant lower down the page as context, not primary hero.

### 6. Vendor Rankings

Keep but lower down.

### 7. Market Share and Uptake

Keep as supporting evidence. Link to Demonstrate for board defence.

## Required Copy Tone

Replace ranking-centric language with executive-intelligence language.

Examples:

Current:

> Overview the AI market and identify who's winning

Target:

> Track the AI market changes that matter to enterprise strategy, risk and investment timing.

## Acceptance Criteria

- Query page starts with "what changed" not rankings.
- Existing ranking, share, and momentum panels still exist.
- Market signals are grouped by event type.
- Every major panel has a CIO implication statement.
- Seed/estimated status remains visible.
- Page is simpler, not longer.
