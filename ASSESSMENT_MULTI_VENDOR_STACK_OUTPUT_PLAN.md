# Assessment Multi-Vendor Stack Output — Plan

Date: 2026-05-11
Pack: `dev-prompts/AI_ENTERPRISE_POST_ZIP_SUGGESTIONS_PACK_2026-05-10/`
Prompt: 05
Status: **plan-only** per prompt 06.

## Problem this solves

The current assessment returns a single winner. That's unrealistic for
most enterprise AI rollouts — the real decision is which **stack** of
vendors to combine across roles (platform anchor, model layer,
workflow orchestrator, knowledge layer, data/AI platform, specialist).
A buyer picks Microsoft as platform anchor AND OpenAI as model layer
AND ServiceNow for workflow AND Snowflake for data — there is no
"winner" of the assessment as a whole.

The single-winner output is also wrong in the **opposite** direction
for cases where one vendor genuinely covers the use case. The new
output must support **both** modes without forcing the wrong shape.

## New output hierarchy

### Level 1 — Primary platform anchor
The main enterprise platform or anchor. Always returned. Picked from
the set of `platform_anchor`-categorised vendors weighted against the
assessment inputs.

### Level 2 — Recommended supporting vendors by role
Returned only when the assessment indicates a multi-role stack is
needed. Each role is filled by the highest-scoring vendor in that
role category. Roles:

- `primary_model_provider` (one vendor)
- `primary_orchestration_workflow_vendor` (one vendor)
- `primary_knowledge_search_vendor` (one vendor)
- `primary_data_ai_platform` (one vendor)
- `optional_specialist_vendor[]` (zero or more)

### Level 3 — Alternative stack
A second viable architecture surfaced when the top-2 stacks are
within a configurable margin (default 10% score gap). Shows the same
role structure with the second-choice vendor per role.

### Level 4 — Integration / overlap / blocker analysis
Renders five dimensions for the recommended stack:

| Dimension | What it shows |
|---|---|
| **Overlap risk** | Roles where two recommended vendors compete (e.g. anchor + orchestration both offer agents) |
| **Integration complexity** | Number of cross-vendor connectors required; documented integration depth |
| **Lock-in implications** | Per-vendor switching cost; multi-vendor strategy compatibility |
| **Governance consistency** | Whether all stack members meet the assessment's governance-strictness threshold |
| **Evidence still missing** | The shortlist of unknowns that would change the stack recommendation if resolved |

## Role categories

Every product in `PRODUCT_SCOPES` carries a `productCategory`. The
plan introduces a `roleCategory` mapping (computed, not stored) from
`productCategory` to one of the role buckets:

| productCategory | roleCategory |
|---|---|
| `enterprise_assistant` | `platform_anchor` |
| `cloud_ai_platform` | `platform_anchor` |
| `model_api`, `foundation_model` | `model_layer` |
| `agent_platform`, `agent_runtime` | `workflow_orchestrator` |
| `agent_governance`, `governance_control`, `security_ai` | `governance_layer` (cross-cutting; NOT a stack slot) |
| `enterprise_search`, `rag_knowledge` | `knowledge_layer` |
| `data_ai_platform` | `data_ai_platform` |
| `coding_agent`, `developer_ai` | `specialist_vendor` |
| `workflow_ai`, `crm_ai`, `hr_ai`, `legal_ai`, `finance_ai` | `specialist_vendor` |
| `ai_compute`, `ai_infrastructure`, `ai_networking`, `semiconductor_equipment` | `infrastructure_only` (NOT a stack slot) |
| `investment_exposure`, `ipo_watch`, `indirect_exposure` | NOT a stack slot (investor surfaces only) |
| `sovereign_ai`, `other` | `specialist_vendor` |

Vendors flagged `infrastructure_only` (AMD, ASML, Arm, Broadcom,
Cerebras, Hebbia, Rogo) are NEVER eligible as a stack slot — they
were already short-circuited in `capabilityRenderState()`.

## When to return one anchor vs full stack

The stack-recommendation logic uses this decision tree:

```
  1. If switching_cost_tolerance = multi_vendor_strategy_required
     → return full Level-2 stack (anchor + supporting roles).

  2. If integration_depth ∈ {full_orchestration, workflow_action_execution}
     OR governance_strictness ∈ {regulator_grade_evidence, sovereignty_restricted_hosting}
     → return full Level-2 stack.

  3. If a single vendor scores ≥ 0.85 across all in-scope role
     categories AND no disqualifier hits
     → return Level-1 only (single anchor is enough).

  4. Otherwise → return Level-1 + relevant Level-2 roles where the
     anchor's role-fit score for that role is < 0.7.
```

This honours both rules in prompt 05: never force a multi-vendor stack
where one vendor covers the use case; never force a single-winner
where the stack is clearly needed.

## Stack-recommendation logic (pseudocode)

```ts
function recommendStack(input: AssessmentInput, scoredVendors: ScoredVendor[]): StackRecommendation {
  const anchor = pickAnchor(scoredVendors, input);
  const fullStackRequired = needsFullStack(input);
  const roleFills: RoleAssignment[] = [];

  if (fullStackRequired) {
    for (const role of REQUIRED_ROLES) {
      const candidates = scoredVendors.filter((v) => roleCategoryFor(v) === role);
      const top = pickWithBlockers(candidates, input);
      if (top) roleFills.push({ role, vendor: top, reason: explainRoleFit(top, role, input) });
    }
  } else {
    // Anchor-led: only fill roles where the anchor's role-fit is weak.
    for (const role of REQUIRED_ROLES) {
      const anchorRoleFit = roleFitScore(anchor, role);
      if (anchorRoleFit < 0.7) {
        const candidates = scoredVendors.filter((v) => v.id !== anchor.id && roleCategoryFor(v) === role);
        const top = pickWithBlockers(candidates, input);
        if (top) roleFills.push({ role, vendor: top, reason: explainRoleFit(top, role, input) });
      }
    }
  }

  const alternative = pickAlternativeStack(anchor, roleFills, scoredVendors, input);
  const analysis = analyseStack(anchor, roleFills, input);

  return { anchor, roleFills, alternative, analysis };
}
```

## Why each vendor is in the stack

For every role assignment, the output explains the choice in three
clauses:

1. **What this vendor covers in the role** — concrete capability
   evidence from `EvidenceRecord` rows linked to the vendor's
   relevant `productScopeIds`.
2. **Why it beats the alternative** — score delta + the top three
   subfactor wins.
3. **What's still unverified** — `missingEvidence` and
   `validationSteps` from the underlying ScoringResult.

This output is text-only — no charts. It reads as analyst prose, not
as a scorecard.

## What still needs validation

For each recommendation, surface:

- Evidence gaps (per role)
- ProductScope coverage gaps that would change the role-fit score
- Disqualifier risks where evidence is currently `documented` but the
  governance-strictness requirement is `regulator_grade_evidence`
  (i.e. needs upgrade to E5)
- Integration friction items (cross-vendor connectors not documented)

## Scoring implications

The current scoring engine produces one `finalScore` per vendor. The
multi-vendor stack output requires:

| New score | Computed how |
|---|---|
| **Anchor score** | Existing `finalScore`, but only over `platform_anchor` candidates |
| **Role-fit score** (per role per vendor) | Weighted average of the subfactors that map to that role category |
| **Stack-compatibility score** | Penalty matrix for overlapping roles, integration friction, lock-in disagreement, governance inconsistency |
| **Interoperability score** | Per-vendor — extracted from existing `integration_architecture` domain |

Stack-compatibility is computed AFTER the per-role winners are picked
— it does not feed back into individual vendor scores (which would
violate the "vendor is judged on merit" rule).

## UI implications

- The current `/assessment` result page currently shows a single
  vendor card list. Replace with a **two-column layout**:
  - Left: anchor + role assignments as labelled cards (anchor card is
    visually dominant; role cards are smaller)
  - Right: Level-3 alternative stack (collapsed; expand on click) + Level-4 analysis
- Per-role cards show: vendor name, role, role-fit score, one-sentence
  reason, "why this over alternatives" expandable, missing-evidence
  count badge.
- Single-anchor case: hide the role-cards column entirely; show only
  the anchor card. Pre-existing single-winner UX is preserved when
  appropriate.
- No new charts.

## Scoring engine changes (deferred — not in this plan's scope)

Implementing this plan requires:

1. `roleCategoryFor(vendorId)` and `roleFitScore(vendor, role)`
   helpers in `lib/scoring/` (new file).
2. Extension of `ScoringResult` to include per-role-fit scores.
3. Extension of `AssessmentInput` to take the eight new input
   dimensions from the granularity-upgrade plan.
4. `recommendStack()` orchestrator in
   `lib/assessment/stack-recommendation.ts` (new file).
5. `analyseStack()` for the Level-4 analysis.

The implementation order is in the granularity plan — phases 4–7
cover the changes this plan needs.

## Acceptance criteria for this plan

- ✅ New output hierarchy defined (Levels 1–4).
- ✅ Role categories defined with explicit mapping from `productCategory`.
- ✅ Stack-recommendation logic defined (decision tree + pseudocode).
- ✅ When to return one anchor vs full stack defined.
- ✅ Why-this-vendor explanation defined (3 clauses).
- ✅ Scoring implications defined (4 new score types).
- ✅ UI implications defined (no new charts).
- ✅ Singular-anchor output preserved for cases where one vendor covers the use case.
- ✅ Full-stack output triggered when multiple functional roles are required.

## Non-goals

- No code changes in this commit — plan only.
- No change to existing `/capabilities` or vendor-page UI.
- No change to public scoring outputs.
- No new investor-side logic.
