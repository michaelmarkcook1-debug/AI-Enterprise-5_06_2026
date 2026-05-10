# AI Enterprise — Complete Claude Code Prompt Pack

Prepared for: Mike  
Date: 10 May 2026  
Timezone: Europe/London

## Purpose

This pack consolidates the Claude Code-ready prompts created for AI Enterprise so far.

It includes prompts for:

- Stage 1 stabilisation
- Build/test hardening
- Prisma and font fragility fixes
- `/capabilities` audit and truth-safe upgrade
- Truth Engine implementation
- ProductScope registry
- Commercial LLM Models dashboard
- Free/official data connectors
- Investor Tools and Investment Simulator fixes
- IPO forecasting and post-IPO fluctuation modelling
- Market Signals Engine
- Zero-hallucination and evidence governance

## Recommended order

1. `stage_1_batch/01_MASTER_CONTEXT_PROMPT.md`
2. `stage_1_batch/02_TASK_1_BUILD_TEST_STABILISATION.md`
3. `stage_1_batch/03_TASK_2_CAPABILITIES_AUDIT.md`
4. `stage_1_batch/04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md`
5. `stage_1_batch/05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md`
6. `stage_1_batch/06_TASK_5_CONNECTOR_SCAFFOLD.md`
7. `master_fix_pack/AI_ENTERPRISE_CLAUDE_CODE_MASTER_FIX_PROMPT_PACK_2026-05-10.md`
8. `capabilities_and_connectors/AI_ENTERPRISE_CLAUDE_CODE_CAPABILITIES_FIX_PROMPT_2026-05-10.md`
9. `commercial_models_dashboard/ai_enterprise_claude_code_commercial_models_dashboard_prompt_v2.txt`
10. `investor_tools/ai_enterprise_investor_tools_truth_engine_combined_prompt_pack.txt`
11. `investor_tools/ai_enterprise_combined_investor_tools_truth_engine_ipo_forecast_prompt_pack.txt`
12. `market_signals/ai_enterprise_market_signals_engine_investor_tools_addendum.txt`

## Coaching rule

Use Claude Code for the repair and architecture-stabilisation work first:

```text
source → evidence → claim → calculation → output → chart
```

Switch to Codex only after build, tests, Truth Engine, ProductScope, `/capabilities`, and connector scaffolding are stable.

## Non-negotiable

No prompt in this pack should be used to fabricate live data. All seed, inferred, estimated, stale, or unsupported values must be clearly labelled.
