# Data Model and Scoring Guidance

## New Scoring Concepts

### CIO Confidence Score

Composite score showing whether a CIO can reasonably defend the decision.

Suggested weighting:

| Dimension | Weight |
|---|---:|
| Business Case | 20% |
| Urgency / Cost of Inaction | 10% |
| Architecture Rationale | 10% |
| Vendor Selection | 15% |
| Risk Exposure | 15% |
| Risk Mitigation | 10% |
| Value Realisation | 10% |
| Strategic Sustainability | 10% |

### Board Defence Score

Measures how complete and defensible the board case is.

Suggested inputs:

- business case completeness
- risk register completeness
- competitor benchmark availability
- reputation evidence depth
- cost model completeness
- assumption monitoring coverage
- KPI baseline and target quality

### Strategic Sustainability Score

Suggested weighting:

| Dimension | Weight |
|---|---:|
| Moat Strength | 25% |
| Platform Encroachment Risk | 25% |
| Model Dependency Risk | 20% |
| Proprietary Data Advantage | 15% |
| Switching Cost | 10% |
| Ecosystem Strength | 5% |

### AI Disruption Risk

Risk that a vendor's core differentiation is compressed by frontier model, hyperscaler or platform expansion.

Variables:

- feature replicability
- workflow depth
- proprietary data
- integrations
- customer lock-in
- model dependency
- platform adjacency

### Strategic Optionality

Measures whether a decision preserves future flexibility.

Positive factors:

- multi-model support
- open standards
- modular architecture
- data portability
- low switching friction

Negative factors:

- proprietary lock-in
- single model dependency
- opaque data formats
- hard-coded workflows
- difficult exit terms

## Evidence Requirements

Every score should include:

- evidence grade
- source type
- confidence
- freshness
- whether estimated/seed/live
- reason / note

Never show a precise score without uncertainty context.

## MVP Data Approach

Where no live data exists:

- generate estimated values
- label as estimated
- show provenance reason
- allow later replacement by live connectors

## Suggested Type Shapes

```ts
type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";

type DefensibilityScore = {
  value: number;
  confidence: number;
  evidenceGrade: EvidenceGrade;
  status: "live" | "documented" | "estimated" | "seed" | "unknown";
  reason: string;
};

type Assumption = {
  id: string;
  title: string;
  description: string;
  vendorIds: string[];
  status: "stable" | "watch" | "at_risk" | "broken";
  failureTrigger: string;
  currentSignal: string;
  recommendedAction: string;
  evidenceGrade: EvidenceGrade;
};

type RecommendationDrift = {
  recommendationId: string;
  vendorId: string;
  originalScore: number;
  currentScore: number;
  drift: number;
  reason: string;
  action: "monitor" | "reassess_this_quarter" | "reassess_now";
};
```
