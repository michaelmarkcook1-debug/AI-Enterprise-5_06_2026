# Claude Code Prompt 01 — Stage 2 Linkage Context (Rev 2)

You are working inside the AI Enterprise codebase for Mike.

Current verified position:
- build/tests are stable
- Truth Engine exists
- ProductScope exists
- triage pipeline is no longer broken
- classifier fallback issue is repaired enough to produce meaningful lanes
- exact duplicate merge logic exists
- product-linkage review exists

Current triage dry-run:
- proposals scanned: 310
- auto_approve: 0
- recommend_approve: 211
- recommend_reject: 20
- human_review_required: 79
- classifier fallback rows: 0

Current linkage distribution:
- ok: 35
- ok_uncertain: 33
- multiple_competing: 34
- no_match: 109

Interpretation:
The main blocker is ProductScope linkage, not the classifier pipeline.

## Non-negotiable rules

- Do not invent product names.
- Do not invent capabilities.
- Do not auto-link uncertain rows.
- Do not weaken truth/evidence standards to reduce queue size.
- Do not change public UI unless explicitly asked.
- Do not bulk-approve the evidence queue.
- Do not switch to Codex yet.
- Perplexity is a platform vendor only, not an investor vendor.
- Assessment is a hero/core function.
- Investor Intelligence is a third-level specialist function.

## Goal of this stage

Reduce the blocked queue safely by:
1. applying only safe linkages
2. fixing ProductScope gaps for top blocked vendors
3. rerunning triage
4. checking whether `auto_approve` rises and `recommend_approve` drops

The target remains:

```text
source → evidence → claim → calculation → output → chart
```
