# Coaching Guide — Stage 2.1 Linkage Work and When to Switch to Codex

## What Mike should be doing right now

Mike should not be coding blindly. Mike should be supervising the reduction of the queue bottleneck.

The highest-leverage sequence is:

1. Build safe linkage apply.
2. Apply only the strict `ok` rows.
3. Rerun triage.
4. Repair ProductScope for top blocked vendors one at a time.
5. Rerun linkage review vendor-by-vendor.
6. Rerun triage again.
7. Only then decide whether live queue approval is safe.

## What Mike should NOT do right now

- Do not bulk approve `/admin/evidence`.
- Do not go to production.
- Do not add new investor features.
- Do not switch to Codex yet.
- Do not try to fix all vendor scope globally in one pass.

## Stay with Claude Code while

- safe linkage apply is being built
- ProductScope is being repaired
- triage checkpoints are being compared
- evidence admin logic is still moving

Claude Code should remain the lead tool until:
- the linkage bottleneck is reduced
- the queue becomes operationally reviewable
- triage reruns show healthier distributions

## Switch to Codex when

Switch to Codex only after:

- safe linkage apply exists and is tested
- the strict `ok` cohort is applied
- triage rerun shows improved lane distribution
- at least the top 3–5 vendor ProductScope gaps are repaired
- queue review is no longer blocked mostly by missing linkage
- remaining work can be split into discrete modules

Then Codex can take:
- one vendor ProductScope enhancement at a time
- admin queue UX polish
- evidence analytics cards
- connector hardening per source
- batch-review UI improvements
- non-critical dashboard polish

## The practical success test

Claude Code phase complete when:
- `auto_approve` rises above zero or linkage blocker is materially reduced
- `recommend_approve` drops meaningfully
- vendor linkage reports show fewer `no_match` rows
- operator review becomes batchable at speed

Only then should Mike let Codex help in parallel.
