# Pack 03 — Source Registry and Connectors

## Objective

Define the source and connector architecture.

AI Enterprise should not be an ungoverned scraper. It should have a controlled, auditable source registry.

## Source Registry

Create a registry of allowed source types.

Each source should define:

- name
- base URL
- source type
- reliability
- licence status
- display permission
- refresh cadence
- owner
- notes

## Suggested Source Categories

### High-Trust Sources

- official vendor documentation
- official pricing pages
- official model cards
- official trust/security pages
- regulatory publications
- public financial filings
- official press releases

### Medium-Trust Sources

- reputable news
- known benchmark organisations
- customer review aggregators
- developer platform metrics
- status pages

### Lower-Trust / Use With Caution

- social media
- forums
- anonymous reviews
- unverified blogs
- scraped job posts
- synthetic estimates

## Connector Health

Each connector should report:

- configured / not configured
- last successful run
- last failure
- error message
- evidence items collected
- stale items
- approval queue count
- rate limit state

## Connector Lifecycle

```text
Configured → Run → Raw Items → Normalised Evidence → Proposed Evidence → Approved Evidence → Published Intelligence
```

## Required Admin Views

### Data Sources

Show:

- source name
- type
- reliability
- licence status
- display allowed
- refresh cadence
- last refresh
- health

### Evidence Queue

Show:

- proposed claim
- vendor/capability affected
- source
- grade
- confidence
- freshness
- approve / reject / needs review

### Evidence Audit

Show:

- score / claim
- supporting evidence
- methodology
- last updated
- reviewer

## Acceptance Criteria

- Source registry exists.
- Connector health is visible.
- Evidence queue exists or current admin evidence page is expanded.
- Licence/display status is tracked.
- Restricted sources are not displayed publicly.
