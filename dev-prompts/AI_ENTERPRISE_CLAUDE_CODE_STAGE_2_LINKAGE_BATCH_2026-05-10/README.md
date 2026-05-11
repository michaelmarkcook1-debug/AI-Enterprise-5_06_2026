# AI Enterprise — Claude Code Stage 2 Linkage Batch

Prepared for: Mike  
Date: 10 May 2026  
Timezone: Europe/London

## Purpose

This batch is for the next stage after:
- classifier repair
- legacy fallback backfill
- reclassification
- dedup report / exact duplicate merge
- first useful triage output

Current state before this batch:
- `recommend_approve`: 211
- `recommend_reject`: 20
- `human_review_required`: 79
- biggest blocker: missing or weak ProductScope linkage
- linkage statuses:
  - `ok`: 35
  - `ok_uncertain`: 33
  - `multiple_competing`: 34
  - `no_match`: 109

## What this batch does

1. Build a safe linkage apply path for the clean `ok` rows.
2. Repair vendor ProductScope gaps starting with the highest-volume blocked vendors.
3. Re-run triage and evaluate whether the queue is finally ready for operator review at speed.

## Do not use this batch for

- new dashboards
- new charts
- investor feature expansion
- production promotion
- bulk live approval of the evidence queue
- switching to Codex before the queue shape improves

## Recommended order

1. `01_MASTER_CONTEXT.md`
2. `02_SAFE_LINKAGE_APPLY.md`
3. `03_TRIAGE_RERUN_CHECKPOINT.md`
4. `04_VENDOR_SCOPE_GAP_REPAIR_WRITER.md`
5. `05_VENDOR_SCOPE_GAP_REPAIR_MICROSOFT.md`
6. `06_VENDOR_SCOPE_GAP_REPAIR_GOOGLE.md`
7. `07_VENDOR_SCOPE_GAP_REPAIR_ANTHROPIC.md`
8. `08_VENDOR_SCOPE_GAP_REPAIR_OPENAI.md`
9. `09_COACHING_AND_SWITCH_TO_CODEX.md`
