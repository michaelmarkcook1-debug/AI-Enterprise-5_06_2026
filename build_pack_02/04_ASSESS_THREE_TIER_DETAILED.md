# Prompt — Detailed Assess Build

## Objective

Refactor `/assess` into a three-tier assessment product.

Assess answers:

> What should my organisation deploy?

## Required Tiers

### Tier 1 — Opportunity Assessment

Question:

> Where should we start?

Inputs:

- industry
- company size
- geography
- objectives
- priority functions
- AI maturity
- risk appetite
- regulatory exposure

Outputs:

- AI Readiness Score
- Opportunity Heatmap
- Top 5 AI opportunities
- Top 5 risks
- recommended AI categories
- recommended next step

### Tier 2 — Strategy Assessment

Question:

> What should we deploy?

Inputs:

- current tech estate
- data environment
- cloud preference
- identity/security requirements
- use cases
- integration needs
- deployment model
- workforce readiness

Outputs:

- recommended architecture
- recommended AI stack
- vendor shortlist
- implementation roadmap
- sustainability score
- dependency risk
- cost range

### Tier 3 — Procurement Assessment

Question:

> Should we buy this?

Inputs:

- vendor shortlist
- compliance requirements
- security controls
- SLA requirements
- data residency
- auditability
- exit requirements
- procurement constraints
- cost model

Outputs:

- Procurement Score
- Business Value Score
- Enterprise Readiness Score
- Risk Score
- Strategic Sustainability Score
- CIO Confidence Score
- Recommendation:
  - Proceed
  - Proceed with Conditions
  - Pilot First
  - Do Not Proceed

## Page Structure

1. Assessment Tier Selector
2. Tier-specific form
3. Results preview
4. Recommended stack
5. Risk and sustainability summary
6. Send to Demonstrate button

## Required Components

```text
components/assess/AssessmentTierSelector.tsx
components/assess/OpportunityAssessmentForm.tsx
components/assess/StrategyAssessmentForm.tsx
components/assess/ProcurementAssessmentForm.tsx
components/assess/AssessmentResults.tsx
components/assess/RecommendedStack.tsx
components/assess/SendToDemonstrate.tsx
lib/assessment/tier-scoring.ts
lib/assessment/assessment-seed.ts
```

## Preserve Existing

Keep existing `AssessForm` working if possible, but wrap or split it into the three-tier model.

Do not remove:

- industries
- use cases
- objectives
- ecosystems
- vendor shortlist
- risk radar
- briefing context

## URL Flow to Demonstrate

When assessment produces shortlist, create link:

```text
/demonstrate?vendors=openai,anthropic,microsoft&industries=banking&useCases=customer-service
```

Also store in `sessionStorage` as currently supported by `RestoreShortlistBanner`.

## Acceptance Criteria

- `/assess` clearly shows three tiers.
- Tier 1 is quick.
- Tier 2 is strategy-depth.
- Tier 3 is procurement-depth.
- Results can flow into Demonstrate.
- Existing data remains labelled by confidence/provenance.

# Next Steps

Proceed to Understand detailed build.
