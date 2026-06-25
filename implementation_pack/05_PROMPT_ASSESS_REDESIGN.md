# PROMPT 4 — ASSESS Redesign

## Objective

Rebuild Assess around a three-tier assessment model.

Assess answers:

> What should this organisation deploy?

## Current Assets

The current `/assess` page includes:

- executive briefing
- confidence note
- assessment form
- tier bar
- industry inputs
- use cases
- objectives
- ecosystems
- vendor options
- risk radar
- watchlists

Preserve these, but reorganise into three clear assessment products.

## New Assessment Tiers

### Tier 1 — AI Opportunity Assessment

Question:

> Where should we start?

Audience:

- CIO
- COO
- business leader
- innovation team
- functional leader

Time:

5-10 minutes

Inputs:

- industry
- company size
- geography
- primary objectives
- priority functions
- regulatory exposure
- AI maturity
- risk appetite

Outputs:

- AI Readiness Score
- Opportunity Heatmap
- Top opportunity areas
- Top risk areas
- Suggested AI categories
- "Start here" recommendation

Example output:

```text
Highest priority AI opportunity: Customer Service Automation
Expected value: High
Risk: Medium
Recommended category: Agentic customer operations platform
```

### Tier 2 — AI Strategy Assessment

Question:

> What should we deploy?

Audience:

- CIO
- CTO
- enterprise architect
- AI CoE
- transformation office

Time:

20-30 minutes

Inputs:

- existing tech estate
- data architecture
- cloud preference
- identity/security requirements
- workflows
- use cases
- deployment constraints
- integration needs
- workforce readiness

Outputs:

- recommended architecture
- recommended AI stack
- vendor shortlist
- strategic sustainability view
- dependency map
- implementation roadmap
- estimated cost range

### Tier 3 — AI Procurement Assessment

Question:

> Should we buy this?

Audience:

- CIO
- procurement
- legal
- security
- risk
- CFO

Time:

60-120 minutes

Inputs:

- vendor shortlist
- RFP requirements
- security requirements
- compliance requirements
- contractual constraints
- data residency
- auditability
- SLA requirements
- exit requirements
- cost model

Outputs:

- procurement score
- business value score
- enterprise readiness score
- risk score
- strategic sustainability score
- CIO confidence score
- recommendation:
  - Proceed
  - Proceed with Conditions
  - Pilot First
  - Do Not Proceed

## Scoring Dimensions

Use the following CIO-oriented dimensions:

1. Business Value
2. Risk
3. Security
4. Governance
5. Integration
6. Adoption
7. Scalability
8. Vendor Risk
9. Cost
10. Workforce Impact
11. Sovereignty
12. Strategic Sustainability
13. Strategic Optionality

## Acceptance Criteria

- Assess clearly presents three tiers.
- Existing assessment form is reused where possible.
- User can choose tier.
- Outputs flow into Demonstrate via URL params or stored shortlist.
- Tier 1 is quick and easy.
- Tier 3 is procurement-grade.
- No false precision: use confidence and evidence grades.
