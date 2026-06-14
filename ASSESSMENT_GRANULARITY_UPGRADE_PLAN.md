# Assessment Granularity Upgrade — Plan

Date: 2026-05-11
Pack: `dev-prompts/AI_ENTERPRISE_POST_ZIP_SUGGESTIONS_PACK_2026-05-10/`
Prompt: 04
Status: **plan-only** per prompt 06 ("plan first, do not implement all in one pass").

## Purpose

Upgrade `/assessment` so it produces enterprise-decision-grade output —
without bloating the first-run experience into an RFP form. Use
progressive disclosure to keep the entry path fast but allow buyers,
procurement, and technical leads to drill deeper.

## Tiered entry paths

| Tier | Time | Inputs | Output Depth |
|---|---|---|---|
| **Quick** | ~2 min | Industry · primary use case · regulated yes/no · deployment urgency | Top recommendation + 2 alternatives + biggest blocker |
| **Guided** | ~5–8 min | Quick fields + workflow criticality · knowledge environment · human-review model · governance strictness | Executive summary + subfactor breakdown + decision blockers + 1 alternative path |
| **Advanced** | ~10–15 min | Guided fields + integration depth · procurement reality · switching-cost tolerance · internal AI maturity + adaptive follow-ups | Full output — every layer including sensitivity analysis + 4 output modes |

The Quick path remains the default entry. Guided unlocks via a "Need
more depth?" link. Advanced unlocks via "Procurement-grade view"
toggle. Form state persists across tiers — a user who upgrades from
Quick to Guided keeps their answers.

## New input dimensions

### 1. Workflow criticality
`internal_productivity` · `internal_decision_support` ·
`customer_facing` · `regulated_decision_support` ·
`autonomous_workflow_execution`

Drives: human-review default, evidence-grade floor for verified
status, blocker severity for missing controls.

### 2. Knowledge / content environment (multi-select)
`short_docs` · `long_docs` · `email_chat` · `code` · `tabular_data` ·
`presentations` · `multimodal` · `web_grounded_research` ·
`internal_enterprise_knowledge`

Drives: capability shortlist (RAG vs search vs document-AI vs
code-AI), product-category emphasis, follow-ups about citations and
provenance.

### 3. Human-review model
`always_human_reviewed` · `sampled_review` · `approval_gate_before_action` ·
`autonomous_low_risk_only` · `autonomous_with_exception_handling`

Drives: agent-governance subfactor weighting, blocker triggers when
selected mode mismatches workflow criticality.

### 4. Integration depth required
`none` · `read_only` · `write_back_required` ·
`workflow_action_execution` · `full_orchestration`

Drives: weighting on `integration_architecture` domain; activates
connector-coverage subfactor; warns when a high-depth requirement
meets a vendor with no documented write-back evidence.

### 5. Governance strictness
`basic_admin` · `enterprise_auditability` · `policy_enforcement` ·
`regulator_grade_evidence` · `sovereignty_restricted_hosting`

Drives: minimum evidence grade for `governance_compliance` domain;
hard-blocker when strictness ≥ `policy_enforcement` and vendor lacks
E3+ governance evidence.

### 6. Procurement / deployment reality
`pilot_only` · `departmental_rollout` · `enterprise_wide_rollout` ·
`production_within_3_months` · `long_buying_cycle_rfp_board`

Drives: deployment-path output; surfaces vendor-maturity blockers
(financial stability, customer reference depth) when long cycle is
selected.

### 7. Switching-cost tolerance
`low_concern` · `moderate` · `high_portability_requirement` ·
`multi_vendor_strategy_required`

Drives: `vendor_maturity_lockin` domain weighting; activates
`multi_vendor_strategy_required` as a hard signal for the
multi-vendor stack recommendation output (see prompt 05 plan).

### 8. Internal AI maturity
`no_internal_team` · `light_experimentation` · `central_platform_team` ·
`mature_eval_governance` · `full_ai_engineering`

Drives: deployment-path output; surfaces "managed service vs
self-host" trade-off; gates whether to recommend developer-AI
products.

## Adaptive follow-up logic

Follow-ups are activated by combinations of the inputs above. Each
follow-up has an explicit trigger predicate. Examples:

| Trigger | Follow-ups |
|---|---|
| `industry ∈ {legal, financial_services, healthcare} AND knowledge_env contains long_docs` | citation provenance · attorney-client privilege handling · client-matter access controls · DMS integration · human review depth |
| `human_review = autonomous_*` AND `governance_strictness ≥ policy_enforcement` | exception handling pattern · revocation / kill-switch · audit-log retention · policy-as-code support · what-if rollback |
| `internal_ai_maturity ∈ {no_internal_team, light_experimentation}` AND `procurement = enterprise_wide_rollout` | managed-service availability · time-to-pilot · partner / SI involvement · training & enablement · success-team support |
| `integration_depth = full_orchestration` | inbound webhook patterns · OAuth/SCIM · per-action approval gates · model-routing flexibility · latency SLOs |
| `governance_strictness = sovereignty_restricted_hosting` | region availability · single-tenant · BYOK · regulator-recognised certifications · model-residency |

Each follow-up has its own progressive disclosure — a user can answer
"I don't know yet" and the assessment will flag the unknown as an
evidence gap rather than a hard input.

## Must-have / preference / disqualifier logic

For governance, integration, and deployment dimensions, allow users
to mark each requirement at one of four severity levels:

| Level | Behaviour |
|---|---|
| `must_have` | Vendor lacking it is filtered to the bottom; warning banner on result |
| `strongly_preferred` | Negative weight in score; visible markdown |
| `nice_to_have` | Small positive bonus where present |
| `disqualifier` | **Hard block** — vendor appears in a separate "Excluded" section with reason. Never silently rebanded into the top three. |

Disqualifiers compose: e.g. "single-tenant deployment required AND
data residency = EU only" produces an intersection filter, with
clear cause text.

## Scoring changes

| Change | Description |
|---|---|
| Per-domain weighting becomes context-dependent | The eight input dimensions above each shift the weight of one or more of the 13 domains. e.g. `workflow_criticality = regulated_decision_support` raises `governance_compliance` weight by 50%. |
| Disqualifier short-circuit | A disqualifier hit forces the vendor into the Excluded section regardless of other strengths. |
| Evidence-grade floor | When `governance_strictness ≥ policy_enforcement`, only E3+ evidence counts toward the `governance_compliance` score. |
| Verbose missing-evidence list | Every score line carries its evidence-id provenance; output displays missing-evidence gaps explicitly per subfactor. |
| Stack-fit bonus | When the input dimensions indicate `multi_vendor_strategy_required`, vendors with strong interoperability evidence get a small bonus. |

## Output layers

The Quick tier shows layer 1 only. Guided shows 1–4. Advanced shows
all 7.

1. **Executive summary** — single paragraph + a one-liner per output mode
2. **Subfactor score breakdown** — every domain × subfactor, with per-cell evidence count
3. **Decision blockers** — disqualifier hits, missing must-haves, regulator gaps
4. **Evidence gaps** — list of unknowns that would change the recommendation if resolved
5. **Deployment path** — pilot → departmental → enterprise milestones, gated on internal-maturity inputs
6. **Sensitivity analysis** — "if you flipped switch X, recommendation Y changes to Z"
7. **Scenario-based recommendations** — recommended stack under three named scenarios (e.g. "fast pilot", "regulated rollout", "multi-vendor")

### Four output modes (rendered side-by-side or as tabs)

| Mode | Voice | Length | Emphasis |
|---|---|---|---|
| **Executive** | C-suite | 1 page | recommendation · trade-offs · time-to-value · biggest risk |
| **Buyer** | Procurement | 2–3 pages | commercial terms · TCO · vendor stability · SLAs · references |
| **Technical** | Platform / architect | 3–4 pages | API contract · evals · model lineage · latency · integration patterns |
| **Procurement** | Governance / compliance | 2–3 pages | certifications · DPA terms · audit logs · data residency · termination clauses |

Each mode is rendered from the same underlying ScoringResult — no
duplicated logic. Templates are deterministic mappers.

## UX implications

- Hero CTA "Take Assessment" → Quick form (current flow).
- Quick result has a "Get more depth" button that re-renders the
  current ScoringResult using Guided inputs (any new fields default
  to "no preference" so the user only fills what matters).
- "Procurement-grade view" toggle on Advanced reveals the Buyer +
  Procurement output modes side-by-side.
- Existing scoring engine output stays backward-compatible — new
  fields are additive on `ScoringResult`.

## Phased implementation order

| Phase | Deliverable | Effort estimate |
|---|---|---|
| **Phase 1** | Quick / Guided / Advanced tier UX + form-state persistence | 2–3 days |
| **Phase 2** | New input dimensions + storage schema (additive on `AssessmentInput`) | 1 day |
| **Phase 3** | Adaptive follow-up engine (rule table + activation predicate) | 2 days |
| **Phase 4** | Must-have / disqualifier severity model + Excluded-section UI | 2 days |
| **Phase 5** | Scoring engine — context-dependent domain weighting | 2 days |
| **Phase 6** | Output layers 1–4 (executive summary, subfactor breakdown, blockers, evidence gaps) | 2 days |
| **Phase 7** | Output layers 5–7 (deployment path, sensitivity, scenarios) | 3 days |
| **Phase 8** | Four output modes (templates + tab UI) | 2 days |
| **Phase 9** | E2E tests + assessment-output golden snapshots | 1 day |

Total: ~17 days of focused work. Phases 1–4 can ship as a v1; phases
5–9 are the depth pass.

## Acceptance criteria for this plan

- ✅ Progressive disclosure preserved (Quick / Guided / Advanced).
- ✅ Adaptive questioning defined with explicit trigger predicates.
- ✅ Eight new input dimensions defined with controlled vocabularies.
- ✅ Output layers defined (7 layers + 4 output modes).
- ✅ Must-have / disqualifier logic defined with severity behaviours.
- ✅ Scoring changes defined (context-weighting, disqualifier
  short-circuit, evidence-grade floors).
- ✅ UX implications stated.
- ✅ Phased implementation order with effort estimates.

## Non-goals (out of scope for this plan)

- No code changes in this commit — plan only.
- No new charts or visual flourish.
- No change to the existing scoring engine's public output shape.
- No change to public scoring outputs (`/capabilities`, ranking).
