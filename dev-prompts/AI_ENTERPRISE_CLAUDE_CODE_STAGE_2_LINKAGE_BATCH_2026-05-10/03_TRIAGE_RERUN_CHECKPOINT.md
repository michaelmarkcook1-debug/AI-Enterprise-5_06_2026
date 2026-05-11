# Claude Code Prompt 03 — Triage Rerun Checkpoint

After safe linkage apply, rerun triage and produce a checkpoint report.

## Task

1. Run or simulate the next triage dry-run using the current DB state.
2. Report:
   - proposals scanned
   - auto_approve
   - recommend_approve
   - recommend_reject
   - human_review_required
   - classifier fallback rows
   - reason breakdown

3. Compare against the prior baseline:
   - auto_approve: 0
   - recommend_approve: 211
   - recommend_reject: 20
   - human_review_required: 79

4. State clearly:
   - whether the queue improved
   - whether ProductScope linkage is still the dominant blocker
   - whether more vendor scope repair is needed before live approval
   - whether the queue is ready for operator review in batches

5. Write:
   `TRIAGE_RERUN_CHECKPOINT_REPORT.md`

## Acceptance criteria

- Report exists.
- Before/after comparison is explicit.
- No invented counts.
- No live approval performed.
