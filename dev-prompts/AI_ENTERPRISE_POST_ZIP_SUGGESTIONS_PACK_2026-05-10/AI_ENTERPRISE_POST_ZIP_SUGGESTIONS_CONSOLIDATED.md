# AI Enterprise — Post-Zip Suggestions Consolidated

Prepared for: Mike



---

## README.md

# AI Enterprise — Post-Zip Suggestions Pack

Prepared for: Mike  
Date: 10 May 2026  
Timezone: Europe/London

## Purpose

This pack consolidates the AI Enterprise suggestions made after the last Stage 2 linkage batch zip.

It includes:

1. Perplexity inclusion as a platform vendor only
2. Explicit exclusion of Perplexity from Investor Tools / Investor Intelligence
3. Hero hierarchy update with Assessment as a first-class hero function
4. Investor Intelligence positioned as a third-level specialist function
5. Assessment granularity upgrade plan
6. Multi-vendor stack recommendation output model instead of single-provider output
7. Suggested implementation order and acceptance criteria

## What's in here

- `01_MASTER_CONTEXT.md`
- `02_PERPLEXITY_PLATFORM_ONLY.md`
- `03_HERO_HIERARCHY_ASSESSMENT_FIRST.md`
- `04_ASSESSMENT_GRANULARITY_UPGRADE.md`
- `05_MULTI_VENDOR_STACK_OUTPUT.md`
- `06_IMPLEMENTATION_ORDER_AND_ACCEPTANCE.md`
- `AI_ENTERPRISE_POST_ZIP_SUGGESTIONS_CONSOLIDATED.md`

## Why this matters

AI Enterprise is moving from a generic scoring prototype toward a more real-world enterprise decision platform.

These updates push it in that direction by:
- correcting vendor scope boundaries
- fixing product hierarchy
- making Assessment the clear hero function
- improving the granularity of questions and outputs
- replacing unrealistic single-winner output with stack-based recommendations


---

## 01_MASTER_CONTEXT.md

# Claude Code Prompt 01 — Master Context for Post-Zip Suggestions

You are working inside the AI Enterprise codebase for Mike.

This prompt batch covers the next strategic product refinements after the previous Stage 2 linkage zip.

## Core product stance

AI Enterprise should be:
- an enterprise AI decision platform first
- evidence-backed
- source-aware
- truth-safe
- decision-grade

It should not read primarily as:
- an investor app
- a generic ranking toy
- a single-provider recommendation engine

## Key changes in this batch

1. Perplexity should be included as a platform/product vendor only.
2. Perplexity should be excluded from Investor Tools.
3. Assessment should be a first-class hero function.
4. Investor Intelligence should be treated as a third-level specialist function.
5. Assessment should become more granular in both questions and outputs.
6. Assessment should return a recommended stack / architecture, not just one provider.

## Non-negotiable rules

- Do not invent products, scope, or capabilities.
- Do not weaken truth or evidence rules.
- Do not let Investor Tools become the core product story.
- Do not keep single-provider output as the only default for enterprise assessment.


---

## 02_PERPLEXITY_PLATFORM_ONLY.md

# Claude Code Prompt 02 — Add Perplexity as Platform Vendor Only

Update AI Enterprise so Perplexity is included from the platform/product/capability lens only.

## Include Perplexity in:
- ProductScope
- Commercial Model Inventory
- Capabilities
- Vendor Intelligence
- News Intelligence
- Market Dashboard where product/model coverage is relevant

## Exclude Perplexity from:
- Investor Tools
- Investment Intelligence
- Investment Simulator
- Public AI Stocks
- IPO Watch
- Indirect Exposure Map
- Investor Briefings
- Investor Watchlist
- all investment scoring
- all valuation / post-IPO / share-price logic
- all portfolio universes

## Product scope guidance

Use only source-backed official Perplexity sources.

Include if source-backed:
- Enterprise Pro
- Enterprise Max
- Search API
- Sonar API
- Agent API
- Sonar
- Sonar Pro
- Sonar Reasoning Pro
- Sonar Deep Research

## Rules

- First-party Perplexity models must be officially documented.
- Third-party models available through Agent API must be marked hosted_third_party or equivalent.
- Agent API is a product, not a model.
- Do not treat Perplexity as investable or IPO-trackable inside Investor Tools.

## Deliverables

1. Add/update ProductScope entries for `vendor_perplexity`
2. Add/update CommercialModel records for first-party Perplexity models
3. Add/update Capability records for Perplexity
4. Add tests proving Perplexity is present in platform modules and absent from Investor Tools modules
5. Write:
   `PERPLEXITY_PLATFORM_SCOPE_REPORT.md`


---

## 03_HERO_HIERARCHY_ASSESSMENT_FIRST.md

# Claude Code Prompt 03 — Hero Hierarchy: Assessment First

Update AI Enterprise hierarchy so the hero reflects the correct product story.

## Rules

1. Assessment must be a first-class hero/core function.
2. Investor Intelligence / Investor Tools must be a third-level specialist function.
3. Remove Investor Tools from hero quick actions and hero value proposition.
4. Keep Investor Tools in navigation, but with reduced visual priority.
5. Hero should focus on:
   - Assessment
   - Vendor Intelligence
   - Capabilities
   - Briefings
   - evidence-backed market intelligence

## Preferred hierarchy

### Level 1 — Core hero functions
- Assessment
- Vendor Intelligence
- Capabilities
- Briefings

### Level 2 — Supporting platform functions
- Market Tracker
- News Intelligence
- Watchlists
- Commercial Models
- Data Sources / Evidence

### Level 3 — Specialist functions
- Investor Tools
- Investment Intelligence
- Investment Simulator
- IPO Watch
- Indirect Exposure Map
- Public AI Stocks

## Preferred hero quick actions
- Assessment
- Vendors
- Capabilities
- Briefings

## Preferred hero framing
AI Enterprise helps executives:
- assess AI platforms
- compare vendor capabilities
- track market movement
- review evidence-backed intelligence
- generate executive briefings

## Deliverables

1. Update hero copy
2. Update hero CTA priority
3. Reduce Investor Tools prominence in hero
4. Keep Investor Tools available in nav
5. Write:
   `HERO_HIERARCHY_UPDATE_REPORT.md`


---

## 04_ASSESSMENT_GRANULARITY_UPGRADE.md

# Claude Code Prompt 04 — Assessment Granularity Upgrade

Upgrade AI Enterprise Assessment so it feels like a real-world enterprise decision product.

## Goal

Add more granularity to:
1. the questions asked
2. the outputs returned

Do this without turning the first-run experience into a huge RFP form.

## Principle

Use progressive disclosure:

### Quick Assessment
~2 minutes
- fast triage
- minimal required inputs

### Guided Assessment
~5–8 minutes
- adaptive follow-up questions
- decision-shaping detail

### Advanced Assessment
~10–15 minutes
- procurement / technical / regulated-deployment depth

## Add missing input dimensions

1. Workflow criticality
- internal productivity
- internal decision support
- customer-facing
- regulated decision support
- autonomous workflow execution

2. Knowledge / content environment
- short documents
- long documents
- emails/chat
- code
- tabular data
- presentations
- multimodal content
- web-grounded research
- internal enterprise knowledge

3. Human review model
- always human-reviewed
- sampled review
- approval gate before action
- autonomous low-risk only
- autonomous with exception handling

4. Integration depth required
- no integrations
- read-only
- write-back required
- workflow/action execution
- full orchestration

5. Governance strictness
- basic admin controls okay
- enterprise auditability required
- policy enforcement required
- regulator-grade evidence needed
- sovereignty / restricted hosting required

6. Procurement / deployment reality
- pilot only
- departmental rollout
- enterprise-wide rollout
- production within 3 months
- long buying cycle / RFP / board scrutiny

7. Switching cost tolerance
- low concern
- moderate
- high portability requirement
- multi-vendor strategy required

8. Internal AI maturity
- no internal AI team
- light experimentation
- central platform team
- mature eval/governance function
- full AI engineering capability

## Add conditional follow-up logic

Assessment must ask adaptive follow-ups based on answers.

Examples:
- if legal/high confidentiality/document-heavy → ask about citations, privilege, access controls, DMS, human review
- if developer/API-first → ask about model routing, latency, evals, portability, tool use

## Add must-have / preference / disqualifier logic

For important dimensions allow:
- must-have
- strongly preferred
- nice-to-have
- disqualifier

Disqualifiers should not simply reduce score slightly; they should visibly block or warn.

## Output granularity must improve

Add output layers:
1. Executive summary
2. Subfactor score breakdown
3. Decision blockers
4. Evidence gaps
5. Deployment path
6. Sensitivity analysis
7. Scenario-based recommendations
8. Output modes:
   - Executive
   - Buyer
   - Technical
   - Procurement

## Deliverable

Write:
`ASSESSMENT_GRANULARITY_UPGRADE_PLAN.md`

Must include:
- new question architecture
- adaptive logic
- scoring changes
- output changes
- UX implications
- phased implementation order


---

## 05_MULTI_VENDOR_STACK_OUTPUT.md

# Claude Code Prompt 05 — Multi-Vendor Stack Recommendation Output

Replace the unrealistic default of a single-provider output with a stack-based recommendation model.

## Problem

Providing just one provider is usually illogical because not all vendors do everything.

Most real enterprise decisions require a combination of:
- platform anchor
- model layer
- orchestration / workflow layer
- knowledge / search layer
- data / AI layer
- specialist layer

## New output model

Assessment should return:

### Level 1 — Primary platform anchor
The main enterprise platform or anchor vendor.

### Level 2 — Recommended supporting vendors by role
Examples:
- primary model provider
- primary orchestration / agent workflow vendor
- primary knowledge/search vendor
- primary data/AI platform
- optional specialist vendor

### Level 3 — Alternative stack
A second viable architecture if priorities shift.

### Level 4 — Integration / overlap / blocker analysis
Show:
- overlap risk
- integration complexity
- lock-in implications
- governance consistency
- evidence still missing

## Role categories

Use role categories like:
- platform_anchor
- model_layer
- workflow_orchestrator
- knowledge_layer
- data_ai_platform
- specialist_vendor

## Rules

1. Do not force a multi-vendor stack where one vendor genuinely covers the use case well.
2. Do not force a single-winner answer where a stack is clearly needed.
3. Allow “best primary platform anchor” as a singular output when appropriate.
4. Allow stack outputs when multiple functional roles are required.
5. Show why each vendor is in the stack.
6. Show what still needs validation before a real deployment decision.

## Example output framing

Recommended AI stack:
- Platform anchor: Microsoft
- Model layer: OpenAI
- Agent workflow layer: ServiceNow
- Knowledge layer: Glean
- Data/AI platform: Snowflake

Why this stack:
Best fit for governance-heavy M365-first enterprise rollout with knowledge retrieval and controlled action workflows.

## Scoring changes

Move from:
- one overall vendor competition pool

to:
- category-specific scoring
- role-fit scoring
- stack-compatibility scoring

Include:
- interoperability
- overlap
- lock-in
- governance consistency
- deployment friction

## Deliverable

Write:
`ASSESSMENT_MULTI_VENDOR_STACK_OUTPUT_PLAN.md`

Must include:
- new output hierarchy
- role categories
- stack recommendation logic
- when to return one anchor vs full stack
- scoring implications
- UI implications


---

## 06_IMPLEMENTATION_ORDER_AND_ACCEPTANCE.md

# Claude Code Prompt 06 — Implementation Order and Acceptance Criteria

This file tells Claude Code what to do first.

## Implementation order

1. Add Perplexity as platform-only vendor
2. Update hero hierarchy so Assessment is clearly first-class
3. Write the assessment granularity upgrade plan
4. Write the multi-vendor stack output plan
5. Only after planning, begin implementation in phases:
   - adaptive questions
   - must-have/disqualifier logic
   - subfactor output breakdown
   - blockers / evidence gaps
   - stack recommendation layer
   - output modes

## Acceptance criteria

Perplexity:
- present in ProductScope/platform modules
- absent from Investor Tools
- tests prove scope boundaries

Hero hierarchy:
- Assessment visible in hero copy and hero actions
- Investor Tools not hero-prominent
- nav still contains Investor Tools

Assessment granularity:
- plan document exists
- progressive disclosure preserved
- adaptive questioning defined
- new input dimensions defined
- output layers defined

Multi-vendor stack:
- plan document exists
- singular provider output is no longer treated as universal default
- role categories defined
- stack logic defined
- blocker/integration analysis included

## Coaching note

Do not try to implement all of this in one pass.
Plan first, then phase it.

The product gets much stronger by:
- asking better questions
- returning more realistic recommendations
- showing decision-grade blockers and evidence gaps

not by adding more charts.
