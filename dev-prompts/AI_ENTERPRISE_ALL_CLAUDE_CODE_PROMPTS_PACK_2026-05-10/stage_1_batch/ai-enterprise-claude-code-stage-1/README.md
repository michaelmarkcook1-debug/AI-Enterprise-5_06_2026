# AI Enterprise — Claude Code Stage 1 Prompt Pack

Prepared for: Mike  
Date: 10 May 2026  
Purpose: Stabilise AI Enterprise before scaling development with Codex.

## What this batch is for

This is the first Claude Code batch for AI Enterprise.

It focuses on:

1. Build and test stability.
2. Prisma client and dependency failures.
3. Google Fonts build fragility.
4. `/capabilities` audit.
5. Truth Engine enforcement.
6. ProductScope linkage.
7. EvidenceSource / TruthRecord metadata.
8. Source-backed capability rendering.
9. Connector architecture scaffolding.
10. Clear stopping rules before switching to Codex.

## What this batch is not for

Do not use this batch to build new dashboards, new charts, more investor UX, or extra visual features.

The priority is:

```text
source → evidence → claim → calculation → output → chart
```

Until that pipeline is working, more UI will only increase the mess.

## Recommended usage

Run these prompts in Claude Code one at a time.

Start with:

```text
01_MASTER_CONTEXT_PROMPT.md
```

Then:

```text
02_TASK_1_BUILD_TEST_STABILISATION.md
03_TASK_2_CAPABILITIES_AUDIT.md
04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md
05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md
06_TASK_5_CONNECTOR_SCAFFOLD.md
```

Use:

```text
07_COACHING_AND_SWITCH_TO_CODEX.md
```

to decide when to stop using Claude Code as the lead and start using Codex for parallel implementation.
