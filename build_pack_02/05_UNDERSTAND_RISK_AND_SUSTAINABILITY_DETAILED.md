# Prompt — Detailed Understand Build

## Objective

Enhance `/understand` into a vendor intelligence and strategic sustainability hub.

Understand answers:

> What is this vendor, where does it fit, and how durable is its advantage?

## Existing Strength

The page already includes:

- AI Ecosystem Navigator
- Capability coverage overview
- Data sources and connector health
- Capability matrix
- Vendor universe
- Methodology

Keep this.

## Add New Executive Intelligence Blocks

### 1. Strategic Sustainability Overview

Create a page-level section summarising:

- average sustainability score across tracked vendors
- highest durability vendors
- highest disruption risk vendors
- highest encroachment risk vendors
- highest dependency risk vendors

### 2. Sustainability Scoring

Create `StrategicSustainabilityScore`.

Variables:

- moat strength
- platform encroachment risk
- model dependency risk
- proprietary data advantage
- switching cost
- ecosystem strength
- roadmap credibility

### 3. Platform Encroachment Risk

Create `PlatformEncroachmentRisk`.

Risk that larger model/platform providers absorb the vendor's feature area.

High-risk vendor types:

- prompt wrappers
- narrow copilots
- thin research assistants
- workflow templates without proprietary data
- apps fully dependent on one frontier model

Lower-risk vendor types:

- deeply embedded systems of record
- proprietary data network
- regulated workflow specialist with audit depth
- infrastructure / hardware / cloud capacity

### 4. Dependency Risk

Use Atlas / ExposureMap data.

Show:

- model dependency
- cloud dependency
- GPU dependency
- data dependency
- regulatory/geographic dependency

### 5. Strategic Optionality

Show whether adopting this vendor increases or reduces future flexibility.

### 6. Vendor Universe Additions

Add columns/cards for:

- Sustainability
- Encroachment Risk
- Dependency Risk
- Optionality

If full implementation is too much, add summary badges first.

## Suggested Files

```text
components/understand/StrategicSustainabilityOverview.tsx
components/understand/SustainabilityBadge.tsx
components/understand/EncroachmentRiskBadge.tsx
components/understand/DependencyRiskBadge.tsx
components/understand/OptionalityBadge.tsx
lib/understand/sustainability.ts
lib/understand/sustainability-seed.ts
```

## Acceptance Criteria

- Understand includes sustainability, encroachment and dependency concepts.
- Vendor universe displays at least badges or score summaries.
- Atlas remains accessible.
- Leadership remains accessible.
- Estimated scoring is labelled.

# Next Steps

Proceed to Query detailed build.
