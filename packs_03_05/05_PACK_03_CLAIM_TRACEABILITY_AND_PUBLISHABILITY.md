# Pack 03 — Claim Traceability and Publishability

## Objective

Make every public claim defensible.

## Claim Types

Track evidence for:

- vendor capability claims
- vendor ranking
- market share estimate
- pricing
- model release
- customer adoption
- security/trust claim
- regulatory risk
- dependency relationship
- strategic sustainability score
- board defence claim
- investor scenario assumption

## Publishability Rules

A claim should be considered publishable only if:

1. It has at least one approved evidence item.
2. Its source licence status permits display or summary.
3. It is not stale.
4. It has a confidence score.
5. It has evidence grade.
6. It has methodology linkage if used in a score.
7. It does not rely solely on seed data unless explicitly labelled.

## Publishability Status

Use:

- Publishable
- Publishable with Caveat
- Internal Only
- Needs Review
- Blocked

## Source Conflict Handling

When sources disagree:

Do not average blindly.

Show:

- claim A
- claim B
- source quality
- date
- confidence
- analyst note
- resolution status

Conflict status:

- unresolved
- resolved by higher-quality source
- resolved by recency
- requires human review

## UI Requirements

Every major score should have:

- "View Evidence" link
- confidence
- source count
- freshness
- publishability status

Every public board/export statement should have:

- citation appendix entry
- evidence appendix entry
- methodology reference

## Acceptance Criteria

- Claims can be marked publishable/internal/blocked.
- Conflicting sources are handled transparently.
- Exported reports include evidence appendix.
- UI does not hide uncertainty.
