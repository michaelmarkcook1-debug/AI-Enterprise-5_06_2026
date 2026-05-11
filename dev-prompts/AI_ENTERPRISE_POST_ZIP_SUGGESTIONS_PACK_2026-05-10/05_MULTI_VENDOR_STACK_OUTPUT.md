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
