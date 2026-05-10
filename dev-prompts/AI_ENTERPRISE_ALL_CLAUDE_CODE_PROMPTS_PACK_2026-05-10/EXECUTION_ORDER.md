# Execution Order for Claude Code

## Stage 1 — Stabilise

Run first:

1. `stage_1_batch/01_MASTER_CONTEXT_PROMPT.md`
2. `stage_1_batch/02_TASK_1_BUILD_TEST_STABILISATION.md`
3. `stage_1_batch/03_TASK_2_CAPABILITIES_AUDIT.md`
4. `stage_1_batch/04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md`
5. `stage_1_batch/05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md`
6. `stage_1_batch/06_TASK_5_CONNECTOR_SCAFFOLD.md`

Stop after each task and ask Claude Code for:

```text
1. files changed
2. commands run
3. test/build result
4. remaining risks
5. whether next task is safe
```

## Stage 2 — Master fix pack

Use:

`master_fix_pack/AI_ENTERPRISE_CLAUDE_CODE_MASTER_FIX_PROMPT_PACK_2026-05-10.md`

This consolidates the broader work after Stage 1.

## Stage 3 — Specialist packs

Use only after Stage 1 is clean:

- Commercial LLM Models dashboard
- Investor Tools
- IPO Forecasting
- Market Signals Engine

## Switch to Codex only when

- `npm test` passes
- `npm run build` passes
- TypeScript passes
- Truth Engine helpers exist and are tested
- ProductScope is enforced
- `/capabilities` renders truth-safe data
- connector scaffold exists
- data-source status page exists
- seed data is visibly labelled
