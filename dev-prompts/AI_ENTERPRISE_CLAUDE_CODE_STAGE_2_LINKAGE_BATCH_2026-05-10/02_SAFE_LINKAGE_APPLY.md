# Claude Code Prompt 02 — Safe Linkage Apply

Build a safe ProductScope linkage apply path for EvidenceProposal rows.

## Current linkage report

- recommend_approve total: 211
- blocked on linkage: 211
- linkage statuses:
  - ok: 35
  - ok_uncertain: 33
  - multiple_competing: 34
  - no_match: 109

## Task

1. Add an apply-safe-linkages script and/or admin API route.

2. Only apply linkages where ALL are true:
   - linkage status = `ok`
   - confidence >= 0.95
   - no competing match
   - vendor match is exact
   - ProductScope target is source-backed
   - proposal is still pending
   - proposal is not classifier fallback
   - proposal is not disputed
   - proposal does not have unsafe category flags

3. Do NOT apply:
   - ok_uncertain
   - multiple_competing
   - no_match
   - classifier fallback rows
   - unsafe rows

4. Write audit fields:
   - proposalId
   - appliedProductScopeId
   - linkageConfidence
   - linkageReason
   - decidedBy
   - appliedAt

5. Dry-run by default.
6. Add `--live` mode.
7. Add tests proving only safe linkages are applied.
8. Add a small summary report:
   - rows eligible
   - rows applied
   - rows skipped
   - reason buckets for skipped rows

9. Write:
   `SAFE_LINKAGE_APPLY_REPORT.md`

10. Tell Mike the exact commands to run:
```bash
npx tsx scripts/apply-safe-linkages.ts
npx tsx scripts/apply-safe-linkages.ts --live --decided-by="mike@ai.enterprise"
```

## Acceptance criteria

- Safe linkage apply exists.
- Dry-run is default.
- Only the strict `ok` cohort can be applied.
- Tests pass.
- No public UI changes required.
