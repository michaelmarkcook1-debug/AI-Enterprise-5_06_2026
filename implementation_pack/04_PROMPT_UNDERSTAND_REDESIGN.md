# PROMPT 3 — UNDERSTAND Redesign

## Objective

Make Understand the definitive AI vendor intelligence layer.

Understand answers:

> What is this vendor and where does it fit in the AI ecosystem?

## Current Assets

The current `/understand` page already has strong foundations:

- Capability coverage overview
- Connector health / data provenance
- Capability matrix
- Vendor universe
- AI Ecosystem Navigator
- Methodology
- Evidence grading E0-E5
- Six-pillar framework

Preserve all of this.

## Required Additions

### 1. Strategic Sustainability

Add a new score concept:

```text
Strategic Sustainability Score
```

Purpose:

> Likelihood the vendor's current advantage remains defensible over 6, 12 and 24 months.

Suggested variables:

- moat strength
- platform encroachment risk
- model dependency risk
- proprietary data advantage
- switching costs
- ecosystem strength
- roadmap credibility

### 2. Platform Encroachment Risk

Purpose:

> Risk that a frontier model or hyperscaler absorbs the vendor's differentiated capability.

Example:

- Harvey may be strong today.
- But if Anthropic launches native legal workflows, Harvey's advantage could compress.

Risk levels:

- Low
- Medium
- High
- Critical

### 3. Dependency Risk

Expose ecosystem dependencies:

- model provider dependency
- cloud dependency
- GPU / semiconductor dependency
- data provider dependency
- hyperscaler dependency
- sovereign/geopolitical dependency

The existing Atlas relationship model is a good starting point.

### 4. Vendor Viability

Add vendor health signals:

- funding
- revenue maturity
- profitability if known
- customer base
- leadership stability
- partner ecosystem
- enterprise delivery record

### 5. AI Disruption Risk

Purpose:

> Risk that this vendor is disrupted by the next frontier model release or AI platform capability expansion.

### 6. Strategic Optionality

Purpose:

> Does adopting this vendor increase or reduce the buyer's future options?

High optionality examples:

- open standards
- multi-model support
- portable data
- modular architecture

Low optionality examples:

- proprietary lock-in
- opaque data formats
- single-model dependency
- hard-to-exit workflow embedding

## Vendor Profile Template

Every vendor profile should eventually include:

1. Overview
2. Primary AI category
3. Secondary categories
4. Capabilities
5. Key use cases
6. Dependencies
7. Competitive set
8. Reputation
9. Strategic sustainability
10. Encroachment risk
11. Dependency risk
12. Vendor viability
13. Evidence grade
14. CIO recommendation
15. Investor relevance where applicable

## Acceptance Criteria

- Understand still includes capability matrix and vendor universe.
- Atlas is accessible from Understand.
- Leadership Matrix is accessible from Understand.
- At least first-pass strategic sustainability, dependency risk and encroachment risk sections are visible.
- These new scores are clearly marked as estimated if not evidence-backed.
- Evidence labels remain visible.
