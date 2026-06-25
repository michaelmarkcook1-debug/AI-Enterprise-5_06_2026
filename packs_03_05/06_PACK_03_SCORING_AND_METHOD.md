# Pack 03 — Scoring and Methodology Hardening

## Objective

Make AI Enterprise scores methodologically defensible.

## Scores To Formalise

1. Vendor Overall Score
2. Capability Score
3. Momentum Score
4. Strategic Sustainability Score
5. Platform Encroachment Risk
6. Dependency Risk
7. AI Disruption Risk
8. CIO Confidence Score
9. Board Defence Score
10. Procurement Score
11. Investor Opportunity Score

## Score Requirements

Every score must define:

- input variables
- weights
- evidence requirements
- freshness requirements
- confidence calculation
- penalty rules
- missing-data behaviour
- seed/estimated behaviour

## Missing Data Rules

Do not silently treat missing data as zero unless methodologically justified.

Use:

- unknown
- insufficient evidence
- estimated
- not applicable

## Example: Strategic Sustainability Score

```text
Strategic Sustainability =
  Moat Strength × 25%
+ Platform Encroachment Defence × 25%
+ Dependency Resilience × 20%
+ Proprietary Data Advantage × 15%
+ Switching Cost × 10%
+ Ecosystem Strength × 5%
```

Penalty rules:

- subtract for single-model dependency
- subtract for low evidence confidence
- subtract for stale evidence
- subtract for thin workflow differentiation

## Example: Board Defence Score

```text
Board Defence Score =
  Business Case Completeness × 20%
+ Risk Register Completeness × 15%
+ Vendor Evidence Depth × 15%
+ Competitor Benchmark Availability × 10%
+ Reputation Evidence × 10%
+ Cost Model Completeness × 10%
+ Assumption Monitoring Coverage × 10%
+ KPI Quality × 10%
```

## Acceptance Criteria

- Scoring methodology is visible.
- Major scores use shared helpers.
- Scores include confidence and evidence grade.
- Missing data does not create fake precision.
