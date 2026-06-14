# Legacy Fallback Backfill Report

Date: 2026-05-10
Author: Claude Code (auto mode)
Scope: `prisma/migrations/20260510160000_add_classification_failure_fields/migration.sql`,
new `lib/services/legacy-fallback-backfill.ts`,
new `scripts/backfill-legacy-fallback-proposals.ts`,
new `lib/services/legacy-fallback-backfill.test.ts`.

## Root cause

The migration shipped in `20260510160000_add_classification_failure_fields`
backfilled with this WHERE clause:

```sql
WHERE "classifier_confidence" = 0.5
  AND "classifier_rationale" IS NULL;
```

But `classifier_rationale IS NULL` is **only** true for rows persisted
*after* the May-2026 runner repair (`?? null`). Every one of the 312
legacy fallback rows was persisted by the **pre-fix** runner, which used
`?? proposal.rationale` — falling through to the extractor's hand-
written rationale. Those rows therefore have **non-null** rationales
that look real, and the migration's `IS NULL` gate skipped all of them.

Empirical confirmation:

| `classifier_confidence` | rows | `classifier_rationale` |
|---|---|---|
| `0.5` exact | 312 | non-null (extractor's text) |
| `0.91` | 1 | classifier-written |
| `0.92` | 1 | classifier-written |

After the migration ran, all four new columns on the 312 rows are still
their defaults: `classification_failed = false`,
`confidence_is_fallback = false`, `classification_failure_code = NULL`,
`classification_failure_reason = NULL`. The triage runner falls back to
the legacy 0.5-exact heuristic in code (which works), but the DB itself
never got the canonical truth and downstream consumers reading
`classification_failed` from Prisma get the wrong answer.

## Matching heuristic (correct version)

A row is a legacy fallback iff **all** of the following hold:

| Field | Required value |
|---|---|
| `status` | `pending` |
| `classifierConfidence` | exact `0.5` |
| `classificationFailed` | `false` or `null` |
| `confidenceIsFallback` | `false` or `null` |
| `classificationFailureCode` | `null` |

This:

- Matches the 312 legacy rows.
- Excludes the 2 real-classifier rows (`0.91`, `0.92`) — fails the exact-0.5 check.
- Excludes any row already backfilled (the `classificationFailed=true`
  / `confidenceIsFallback=true` / `failureCode IS NOT NULL` checks make
  the script idempotent — re-running is a no-op).
- Excludes `approved` / `rejected` / `superseded` rows so we never
  mutate a record that's already past the approval gate.

Implemented as `isLegacyFallbackRow()` in
`lib/services/legacy-fallback-backfill.ts` and shared between the
script and the test suite.

## Backfill payload

```ts
{
  classificationFailed:        true,
  confidenceIsFallback:        true,
  classificationFailureCode:   "legacy_fallback_0_5",
  classificationFailureReason: "Legacy fallback confidence row created
                                before failure metadata existed",
}
```

The payload constants are exported from
`lib/services/legacy-fallback-backfill.ts` so any future migration /
admin tool uses the same string.

## Rows affected

Per the user's reported state of the production DB:

| Row group | Count | Action |
|---|---|---|
| `status=pending`, `classifierConfidence=0.5`, no failure metadata | 312 | **Will be backfilled** |
| `status=pending`, `classifierConfidence=0.91` (real classifier) | 1 | **Untouched** |
| `status=pending`, `classifierConfidence=0.92` (real classifier) | 1 | **Untouched** |
| Other statuses (approved/rejected/superseded) | n/a | **Untouched** |

The script's pre-flight summary prints the candidate counts before
applying anything, and the `--live` UPDATE re-asserts the heuristic in
the WHERE clause so a concurrent write between SELECT and UPDATE can't
slip a not-actually-legacy row through.

## Tests

`lib/services/legacy-fallback-backfill.test.ts` — **10 tests**:

- Matches the documented heuristic.
- Treats `null` and `false` the same on the boolean-or-null columns.
- Does NOT match real classifier rows (0.91, 0.92).
- Does NOT match rows already backfilled (any of the three signals).
- Does NOT match non-pending rows.
- Does NOT match a near-miss confidence (0.50001, 0.49999).
- Simulated batch: 2 legacy + 6 disqualified → counts only 2.

Suite: 282 / 282 across 22 files. tsc clean.

## Why a script, not a second migration

A migration runs once, in a fixed window, against whatever the
production schema happens to be. A standalone script:

- Defaults to **dry-run** so the operator sees the planned change first.
- Is **idempotent** — safe to re-run.
- Can be **scoped** (`--vendor=msft`) for a controlled first pass.
- Lives next to its tests; the heuristic is unit-tested.
- Survives schema drift — if a future migration adds another column
  the heuristic is unaffected.

## Public-UI changes

None. This script touches `EvidenceProposal` failure-metadata columns
only. `/capabilities`, ranking, the simulator, the `/admin/evidence`
review UI — all read the same columns the runner already reads, so the
only visible change is that the admin failures route
(`/api/admin/evidence/failures`) will now correctly report
`legacy_fallback_0_5: 312` instead of `0`.

## Exact commands Mike should run next

```bash
# 1. Confirm the dry-run plan against the live DB.
npx tsx scripts/backfill-legacy-fallback-proposals.ts

# Expected:
#   pending @ 0.5 candidates      : 312
#     → match legacy heuristic    : 312
#     → already marked / coded    : 0
#   pending NOT @ 0.5 (preserved) : 2

# 2. Apply.
npx tsx scripts/backfill-legacy-fallback-proposals.ts --live

# Expected:
#   Backfilled rows               : 312

# 3. Verify via the admin failures endpoint.
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  https://<your-deploy>/api/admin/evidence/failures | jq

# Expected:
#   {"ok":true,"hasDatabase":true,
#    "totals":[{"code":"legacy_fallback_0_5","count":312}],
#    "grandTotal":312}

# 4. Reclassify the now-explicitly-flagged rows.
npx tsx scripts/reclassify-failed-proposals.ts --live

# Expected: 304 schema_validation rows clear with the new 2000-char
#           rationale ceiling; the 8 credit_balance failures retry and
#           clear assuming credits are loaded.

# 5. Re-run dedup against rows that now carry real classifier output.
npx tsx scripts/dedup-evidence.ts

# 6. Re-run triage; auto_approve / recommend_approve / recommend_reject
#    all reachable now.
npx tsx scripts/triage-evidence.ts
```

Re-running the backfill script is a no-op once step 2 has applied —
the heuristic excludes any row already carrying
`classificationFailed=true` or `classificationFailureCode IS NOT NULL`.
