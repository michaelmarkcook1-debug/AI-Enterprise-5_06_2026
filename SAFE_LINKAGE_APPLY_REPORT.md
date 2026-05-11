# Safe ProductScope Linkage Apply Report

Date: 2026-05-11
Author: Claude Code (auto mode)
Scope: `lib/services/safe-linkage-apply.ts`,
`lib/services/safe-linkage-runner.ts`,
`scripts/apply-safe-linkages.ts`,
`app/api/admin/evidence/apply-linkages/route.ts`,
`lib/services/safe-linkage-apply.test.ts`.

## What this ships

A read-only-by-default planner + apply path that links pending
`EvidenceProposal` rows to a single `ProductScope` **only** when the
existing `suggestLinkage()` rule already marks the suggestion as
`safeToApply: true`. That flag is set if and only if:

- `status === "ok"` (single confident match, no competing alternative)
- `confidence >= 0.95` (exact product name appears in the excerpt)
- second-best suggestion (if any) is `< 0.95` — no tie
- vendor resolves through the canonicaliser (exact vendor match by id
  or `vendor_<id>` alias)
- the product is in the source-backed `PRODUCT_SCOPES` registry

Anything else — `ok_uncertain`, `multiple_competing`, `no_match`,
`uncertain_top_match`, `no_vendor_products` — is **skipped**. Locked
by five `INVARIANT` tests, one per skipped status.

## Eligibility from the May-2026 linkage report

The pre-apply state of the queue:

| Linkage status | Rows | Apply action |
|---|---|---|
| `ok` | **35** | **Eligible** — would be applied in `--live` |
| `ok_uncertain` | 33 | Skipped |
| `multiple_competing` | 34 | Skipped |
| `no_match` | 109 | Skipped (use `apply-vendor-wide-evidence` for trust/security/pricing pages instead) |

Net effect of running `--live` once: **35 rows lose the
`recommend_approve` "product linkage missing" reason** and re-triage
against the next `auto_approve` / `recommend_approve` / etc. classification
based on their underlying confidence + freshness + grade signals.

## How safety is enforced

1. **Pure planner** — `planSafeLinkages(proposals, scopesForVendor)`
   in `lib/services/safe-linkage-apply.ts` is a pure function. It
   inspects each proposal via `suggestLinkage()` and returns
   `{ eligible, skipped, skippedByStatus }`. No DB, no I/O. The
   invariants are unit-testable.
2. **Strict eligibility** — only `status === "ok" && safeToApply`
   rows enter `eligible[]`. Everything else lands in `skipped[]`
   with the original status preserved.
3. **No overwrite** — the DB layer filters `productScopeIds = []`
   before writing, AND re-asserts that filter in the live UPDATE's
   WHERE clause. A concurrent write between SELECT and UPDATE
   cannot smuggle a linkage onto an already-linked row.
4. **Dry-run by default** — runner, CLI, and API all default to
   `dryRun: true`. `--live` must be passed explicitly.
5. **Single product per row** — the safe path only writes ONE
   product id (the eligible suggestion's id). For multi-product
   (vendor-wide) linkages, see `apply-vendor-wide-evidence.ts`.

## Audit fields written

Every decision (dry-run AND live) appends one line to
`data/linkage-apply-audit.jsonl` with this shape:

```json
{
  "timestamp": "2026-05-11T08:31:14.012Z",
  "dryRun": false,
  "decidedBy": "system:safe-linkage-runner",
  "proposalId": "cmoze58yo000j0jwv6sufuutm",
  "vendorId": "vendor_msft",
  "appliedProductScopeId": "msft_microsoft_365_copilot",
  "productName": "Microsoft 365 Copilot",
  "linkageConfidence": 0.95,
  "linkageReason": "exact name match: \"Microsoft 365 Copilot\""
}
```

Covers every audit field the requirement asked for:
- `proposalId` ✓
- `appliedProductScopeId` ✓
- `linkageConfidence` ✓
- `linkageReason` ✓
- `decidedBy` ✓
- `appliedAt` (`timestamp`) ✓

Plus `dryRun` and `productName` for forensic completeness.

The file is gitignored under `/data/`. Append-only.

## Tests

`lib/services/safe-linkage-apply.test.ts` — **8 tests**:

- `INVARIANT — ok_uncertain is NEVER applied`
- `INVARIANT — multiple_competing is NEVER applied`
- `INVARIANT — no_match is NEVER applied`
- `INVARIANT — no_vendor_products is NEVER applied`
- `INVARIANT — uncertain_top_match is NEVER applied`
- `includes status=ok with safeToApply=true`
- `mixed batch — counts correctly across ok / ok_uncertain / multiple_competing / no_match`
- `audit payload shape — every required field populated`

Full suite: **327 / 327** across 25 files. TypeScript clean.

## Public UI

Unchanged. The new admin API endpoint
(`POST /api/admin/evidence/apply-linkages`) is admin-gated debug
status; the `/admin/evidence` review UI is not touched.

## Exact commands for Mike

```bash
# 1. Dry-run — see how many would be applied and to which products.
npx tsx --env-file=.env.local scripts/apply-safe-linkages.ts

# Expected output:
#   ─── Safe linkage apply ───
#   mode               : DRY-RUN
#   eligible (ok)      : 35
#   skipped total      : 176
#     by status:
#       109  no_match
#        34  multiple_competing
#        33  ok_uncertain
#   audit lines        : 35 → /…/data/linkage-apply-audit.jsonl

# 2. Spot-check the sample of 10 eligible rows in the dry-run output.
#    Each line shows: <proposalId>  →  <productName>  (<confidence>%).
#    Confirm they look right.

# 3. Apply.
npx tsx --env-file=.env.local scripts/apply-safe-linkages.ts --live

# Expected: applied to DB : 35

# 4. Re-run triage. The 35 rows previously stuck in recommend_approve
#    with reason "product linkage missing" now flow forward.
npx tsx --env-file=.env.local scripts/triage-evidence.ts

# Optional — same call via admin API:
curl -X POST -H "x-admin-token: $ADMIN_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"dryRun": false, "decidedBy": "mike@ai.enterprise"}' \
  "https://<your-deploy>/api/admin/evidence/apply-linkages" | jq
```

## Sequencing recommendation

Run this in tandem with the vendor-wide apply script — they handle
disjoint subsets of the linkage queue:

```bash
# Bulk: ~109 trust/security/pricing rows → vendor-wide linkage
npx tsx --env-file=.env.local scripts/apply-vendor-wide-evidence.ts --live

# Surgical: 35 exact-name-match rows → single product linkage
npx tsx --env-file=.env.local scripts/apply-safe-linkages.ts --live

# Then see the queue shape
npx tsx --env-file=.env.local scripts/triage-evidence.ts
```

Combined, these two passes should auto-link **~144 of the 211**
`recommend_approve` rows. The remaining **~67** are
`ok_uncertain` (33) + `multiple_competing` (34) — both genuinely
require operator judgement and can be worked through the batch-
review CLI 20 at a time.

## What this did NOT do

- No public-UI changes.
- No changes to the triage rule itself — only the planner reads its
  `safeToApply` invariant.
- No auto-link of any row that isn't an `ok` status with `safeToApply`.
- No vendor-wide bulk linking — that's a separate gesture in
  `apply-vendor-wide-evidence.ts`.
- No retroactive touch on already-linked rows
  (`productScopeIds != []` rows are filtered out by the WHERE clause).
