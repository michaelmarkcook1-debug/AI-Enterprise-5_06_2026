# Phase 1A — Assessment Granularity Upgrade · Implementation Report

Date: 2026-05-12
Pack reference: `ASSESSMENT_GRANULARITY_UPGRADE_PLAN.md` (Phase 1A)
Status: shipped

## Stage-2 Rev2 checklist — close-out

Before starting Phase 1A I ran the remaining two live-apply steps
from the Stage-2 Rev2 switch checklist:

| Step | Result |
|---|---|
| `apply-safe-linkages.ts` (dry-run) | **0 eligible** — the Stage-2 vendor-scope additions moved formerly-`ok` rows into `multiple_competing` (more competition = more disambiguation). Nothing to apply on this path right now. |
| `apply-vendor-wide-evidence.ts` (dry-run) | **88 candidates** across 12 vendors (writer=8, openai=15, cohere=12, harvey=8, snow=7, sap=7, databricks=6, mistral=6, anthropic=6, msft=6, ibm=4, googl=3). Live execution blocked by the per-deploy safety gate — needs you to run `--live` once. |
| `triage-evidence.ts` (rerun checkpoint) | 310 scanned · auto_approve=0 · recommend_approve=211 · recommend_reject=20 · human_review=79 · classifier fallback rows=0. "product linkage missing" reason dropped 211 → 175 (36 rows now carry productScopeIds; the rest still need the vendor-wide --live or manual confirmation). |

The triage shape is unchanged at the lane level because the productScopeIds-based
linkage requires the vendor-wide live run to populate. Once you run:

```bash
npx tsx --env-file=.env.local scripts/apply-vendor-wide-evidence.ts --live
npx tsx --env-file=.env.local scripts/triage-evidence.ts
```

the auto_approve lane should rise off zero.

## Phase 1A — what shipped

Three progressive-disclosure entry tiers added to `/assessment` with
form-state persistence. Existing 4-step wizard is preserved verbatim
as the **Quick** tier (default). Guided and Advanced are accessible
from the tier picker and surface placeholder depth-cards explaining
what arrives in Phase 1B.

### Files changed

| File | Change |
|---|---|
| `lib/assessment/tiers.ts` | New — `AssessmentTier` type, `TIERS` metadata, `parseTier()`, `isAssessmentTier()`, `ASSESSMENT_FORM_STATE_KEY` constant |
| `lib/assessment/tiers.test.ts` | New — 6 tests locking tier ids, order, default, and parse semantics |
| `app/assessment/page.tsx` | Reads `?tier=` query param, renders the new `TierBar`, passes `tier` to `AssessForm`. Description copy updated to lead with depth choice. |
| `app/assessment/TierBar.tsx` | New client component — 3 selectable cards (Quick / Guided / Advanced) with active styling, time estimates, descriptions; updates URL via `router.replace` so state is shareable |
| `app/assess/AssessForm.tsx` | Accepts new `tier` prop; reads sessionStorage on mount via `loadPersisted()`; writes on every state change via `savePersisted()`; renders tier-specific depth-placeholder card on the final step |
| `lib/investor-tools/perplexity-scope-boundaries.test.ts` | Fixed property name (`id` → `providerId`) to match the actual type definitions — the earlier commit had a typo that surfaced when tsc re-validated |

### What was implemented

1. **Tier model** (`lib/assessment/tiers.ts`) — single source of truth
   for the three tiers. Stable sessionStorage key. Pure functions
   safe to use in server and client.

2. **TierBar** — sticky-position-friendly tier picker rendered above
   the wizard. Active tier highlighted with the brand `#192319`
   (light) / white (dark) treatment. Time estimate + description per
   tier surfaced for clarity. Switching tier updates `?tier=` so the
   URL is shareable / deep-linkable.

3. **Form-state persistence** — `useEffect` writes the full input set
   to `sessionStorage` whenever any field changes. On mount the form
   hydrates from sessionStorage before falling back to defaults.
   Wrapped in try/catch so private-browsing modes that disable
   sessionStorage degrade gracefully.

4. **Tier-aware depth cards** — Guided shows a sky-blue card on the
   final step explaining what Phase 1B adds. Advanced shows an
   amber card. Quick shows neither (clean existing flow).

5. **Existing behaviour preserved** — Quick tier = the existing
   4-step wizard exactly as before. All current submit logic,
   validation, scoring API call, results route — untouched.

### What was intentionally deferred

| Deferred to | Item |
|---|---|
| Phase 1B | Adaptive follow-up rule engine (per the granularity plan's rule table) |
| Phase 1B | Eight new input dimensions (workflow criticality, knowledge env, human-review model, integration depth, governance strictness, procurement reality, switching-cost tolerance, internal AI maturity) |
| Phase 1B | Must-have / preferred / nice-to-have / disqualifier severity model |
| Phase 1B | Context-dependent domain weighting in the scoring engine |
| Phase 1C | Seven output layers (executive summary, subfactor breakdown, blockers, evidence gaps, deployment path, sensitivity, scenarios) |
| Phase 1C | Four output modes (Executive / Buyer / Technical / Procurement) |
| Phase 1D | Stack-based recommendation output per `ASSESSMENT_MULTI_VENDOR_STACK_OUTPUT_PLAN.md` |

Per the brief: no adaptive logic tree, no full stack-output, no
scoring-engine changes. The deferred items are visible to the user
via the depth-card placeholders so the gesture is honest rather than
silent.

### Operator-safety / hierarchy invariants preserved

- ✅ Assessment is the first-class hero CTA (hero shipped in `e0804ab`,
  unchanged this commit).
- ✅ Investor Tools is the last nav slot, non-bold (also `e0804ab`).
- ✅ Public scoring outputs unchanged — `/capabilities`, ranking,
  simulator, vendor pages all unaffected.
- ✅ Existing assessment scoring + results-page rendering untouched.

## Test / build result

- `npx tsc --noEmit` → clean
- `npm test` → **347 / 347** across 27 files (was 341)
- New tests:
  - `lib/assessment/tiers.test.ts` — 6 tests locking tier id set,
    display order, default, parse semantics (rejects bogus / null /
    casing-mismatched inputs).

## What should go to Codex next

Per the Stage-2 Rev2 switch checklist, Claude Code's planning phase
is complete and 6/8 switch criteria are met. The remaining two
(`apply-vendor-wide-evidence --live` and the post-apply triage
rerun) are Mike-side operational runs that don't need Claude Code.

Codex is well-suited to take these phase items, one phase at a time:

| Phase | Task | Why Codex |
|---|---|---|
| 1B | Adaptive follow-up engine: rule-table parser + activation predicate evaluator | Isolated module; well-specified by the plan's trigger table; pure-function-friendly |
| 1B | Eight new input dimensions: form fields, storage schema, persistence keys | Small, well-defined, fits in one PR per dimension |
| 1B | Must-have / disqualifier severity model + Excluded-section UI | Self-contained scoring + UI change |
| 1C | Output layer 1 (executive summary) + layer 2 (subfactor breakdown) | Renderer-only; reads existing ScoringResult; deterministic |
| 1C | Four output modes via deterministic templates | Pure transformation of the same ScoringResult |
| 1D | `roleCategoryFor()` + `roleFitScore()` helpers; stack-recommendation orchestrator | Per the stack-output plan; specs are already there |
| Tail | Snowflake / AWS / Cohere / SAP / IBM vendor-scope expansions (per Stage-2 Rev2 summary) | One vendor per PR; same pattern as the writer/msft/google/anthropic/openai work already shipped |

Each item above has a written plan/contract — Codex can take one,
implement, run tests, and ship without re-deriving the design.

## Acceptance criteria (per the brief)

- ✅ Tiered assessment flow implemented (Quick / Guided / Advanced).
- ✅ Form-state persistence so an operator can move through tiers without losing state.
- ✅ Existing assessment behaviour preserved as the default Quick path.
- ✅ Full adaptive logic tree NOT implemented (deferred to Phase 1B with visible placeholder).
- ✅ Full stack-output NOT implemented (deferred to Phase 1D with visible placeholder).
- ✅ Scoring models NOT changed.
- ✅ Assessment is first-class hero/core function (unchanged).
- ✅ Investor Tools is Level-3 specialist functionality (unchanged).
- ✅ Report written: this document.
