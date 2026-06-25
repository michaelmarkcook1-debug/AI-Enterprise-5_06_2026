# Recommended Claude Code Run Order

Do not feed all prompts at once unless using a strong agentic workflow.

Use this sequence.

## Run 1 — Product Spine

Use:

- `01_MASTER_IMPLEMENTATION_PROMPT.md`
- `02_PROMPT_PRODUCT_SPINE.md`

Goal:

- navigation
- `/` redirect
- `/monitor`
- `/investor-tools`
- Atlas/Leadership repositioning

## Run 2 — Query

Use:

- `03_PROMPT_QUERY_REDESIGN.md`

Goal:

- Query becomes executive market briefing.

## Run 3 — Understand

Use:

- `04_PROMPT_UNDERSTAND_REDESIGN.md`

Goal:

- strategic sustainability
- dependency risk
- encroachment risk
- vendor viability

## Run 4 — Assess

Use:

- `05_PROMPT_ASSESS_REDESIGN.md`

Goal:

- three assessment tiers.

## Run 5 — Demonstrate

Use:

- `06_PROMPT_DEMONSTRATE_REDESIGN.md`

Goal:

- board defence framework.

## Run 6 — Monitor

Use:

- `07_PROMPT_MONITOR.md`

Goal:

- decision validity monitoring.

## Run 7 — Investor Tools

Use:

- `08_PROMPT_INVESTOR_TOOLS.md`

Goal:

- investor-specific workflow.

## Run 8 — UI/UX and QA

Use:

- `11_UX_UI_GUIDELINES.md`
- `12_ACCEPTANCE_TEST_PLAN.md`

Goal:

- polish
- test
- verify no regressions

## Important

After each run:

1. Build.
2. Test.
3. Review changed files.
4. Check route loads.
5. Check data labels.
6. Commit before next run.
