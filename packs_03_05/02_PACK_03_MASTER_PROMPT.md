# Pack 03 Master Prompt — Data Quality, Evidence, Connectors and Provenance

## Objective

Build the truth layer for AI Enterprise.

The product cannot become publishable unless every major score, claim, ranking, recommendation and board-pack statement is traceable to evidence.

Pack 03 should make the platform defensible.

## Core Product Question

> Can we prove why the system reached this conclusion?

## Scope

Implement or strengthen:

1. Source registry
2. Evidence object model
3. Connector registry
4. Evidence ingestion workflow
5. Evidence grading
6. Freshness scoring
7. Confidence scoring
8. Human approval workflow
9. Source conflict handling
10. Claim-to-source traceability
11. Publishability rules
12. Evidence audit trail
13. Stale data warnings
14. Methodology transparency

## Existing Foundations To Reuse

Reuse:

- existing provenance logic
- evidence grading E0–E5
- connector health panel
- admin ingestion pages
- admin evidence pages
- repository layer
- SeedDataBadge
- Confidence
- methodology section
- existing Prisma setup

Do not remove existing evidence labels.

## Required Principle

Every externally visible intelligence claim should eventually be represented as:

```text
Claim → Evidence → Source → Date → Confidence → Freshness → Methodology → Publishability Status
```

## Acceptance Criteria

- Evidence data model exists.
- Source registry exists.
- Each source has type, reliability, licence status and display permission.
- Evidence can be proposed, reviewed and approved.
- Scores can show supporting evidence.
- Stale evidence is flagged.
- Seed/estimated/live data is clearly distinguished.
- Publishability status exists for claims and scores.
- Admin can see connector health and evidence quality.
