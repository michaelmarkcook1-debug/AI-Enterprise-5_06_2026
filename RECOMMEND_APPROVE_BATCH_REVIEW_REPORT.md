# Recommend-Approve Batch Review Report

Date: 2026-05-12
Scope: New `/admin/evidence/batch` workflow for the 210 `recommend_approve`
rows. Admin-only — no public-UI changes.

## What this ships

A focused admin workflow that lets an operator move through the 210
medium-confidence (`recommend_approve`) rows 20 at a time with five
filter dimensions and three explicit actions per row.

Lives at:
- Server page: `app/admin/evidence/batch/page.tsx`
- Client UI: `app/admin/evidence/batch/BatchReview.tsx`
- API: `app/api/admin/evidence/batch-action/[id]/route.ts`
- Pure logic: `lib/services/batch-review.ts`
- Defer support: `deferProposal()` added to `lib/services/proposal-service.ts`

Entry: link button on the existing `/admin/evidence` page ("Batch
review — recommend_approve cohort (20 at a time)").

## Per-row information

Each card shows everything the operator needs in one place:

- vendor id
- source URL
- excerpt (the raw evidence text)
- proposed grade (E0–E5)
- classifier confidence (%)
- triage lane (recommend_approve) + the top-3 triage reasons
- linkage status — one of `ok`, `ok_uncertain`, `multiple_competing`,
  `no_match`, `no_vendor_products`, `uncertain_top_match`, or
  `linked` (when productScopeIds is non-empty)
- linked product ids count
- data status — `pending` or `deferred`
- evidence grade is shown in the per-row header next to the
  proposed-raw-score line

## Filters

| Filter | Type | Notes |
|---|---|---|
| **Vendor** | Select | Faceted with counts; up to top-30 vendors |
| **Confidence band** | Select | high (≥0.8) / medium (0.6–0.8) / low (<0.6), each with row count |
| **Grade** | Select | E0–E5 faceted with counts |
| **Linkage status** | Select | All 7 status values + `linked`, faceted with counts |
| **Source URL contains** | Text input | Case-insensitive substring; commits on blur |
| **Include deferred** | Checkbox | Off by default — keeps deferred rows out of the working set |

Facets are computed over the **unfiltered** set so the operator
always sees totals when narrowing. Changing any filter resets
pagination offset to 0.

## Three actions per row

| Action | Endpoint | DB effect | Sticky in queue? |
|---|---|---|---|
| **Approve → promote** | `approveProposal()` via `/api/admin/evidence/batch-action/:id` | EvidenceProposal `status="approved"`, EvidenceRecord row created | No — leaves recommend_approve cohort |
| **Defer** | `deferProposal()` via the same endpoint | `status` stays `"pending"`; `reviewNotes` carries the `DEFERRED:` sentinel + `reviewer=<id>` + ISO timestamp + optional reason | Hidden from default view; re-surfaces with "Include deferred" |
| **Reject** | `rejectProposal()` via the same endpoint | `status="rejected"`; never promoted | No |

The defer state is implemented without a schema migration — the
`DEFERRED:` prefix on `reviewNotes` is the canonical signal,
detected by `isDeferred()` in `lib/services/batch-review.ts`. This
preserves the existing `ProposalStatus` enum (`pending` / `approved`
/ `rejected` / `superseded`) and the existing
`approveProposal`/`rejectProposal` invariants.

## Operator-safety guarantees

1. **auto_approve gate unchanged.** The batch-review UI is for the
   `recommend_approve` cohort only. The triage rule still gates
   `auto_approve` strictly (E2+ · ≥0.85 confidence · vendor entity
   match · product linkage · no unsafe category · no fallback).
2. **No public UI changes.** The new surface lives under `/admin/*`.
   The existing `/admin/evidence` single-row review remains.
3. **No schema changes.** Defer uses the existing `reviewNotes` text
   field with a documented `DEFERRED:` prefix.
4. **Approve/reject delegate to existing services.** Whatever
   safety rules `approveProposal()`/`rejectProposal()` already
   enforce continue to apply.
5. **Concurrent-write safe.** The action endpoint refuses to
   approve/reject rows that aren't `status="pending"` (the existing
   service-level guard). The batch UI refreshes after each action
   so a stale row is dropped.

## Tests

`lib/services/batch-review.test.ts` — **25 tests** covering:

- `confidenceBand()` boundaries (0.8 / 0.6 thresholds)
- `isDeferred()` accepts only the documented prefix
- `buildDeferredNotes()` embeds reviewer + ISO timestamp + optional reason
- `matchesFilters()` — vendor / confidence / grade / linkage /
  sourceUrlContains (case-insensitive) / deferred-exclusion
- `buildBatchReviewResult()` — pagination, facets computed over the
  unfiltered set, default limit is 20

Suite: **372 / 372** across 28 files (was 347 — +25 new tests).
TypeScript clean.

## How to use

```
1. Open /admin/evidence/batch (or click the "Batch review" link on
   /admin/evidence).
2. Optionally narrow with the filter bar — vendor / confidence /
   grade / linkage / source URL.
3. For each row, click Approve, Defer, or Reject.
4. Page rolls forward as rows leave the working set; Defer hides
   the row but keeps it pending (recoverable via the "Include
   deferred" toggle).
5. Pagination: Prev/Next 20.
```

URL params are the source of truth — the URL is shareable / deep-
linkable / browser-back-friendly:

```
/admin/evidence/batch?vendor=vendor_writer&confidence=high&offset=0
/admin/evidence/batch?linkage=linked&grade=E3
/admin/evidence/batch?source=trust.openai.com
/admin/evidence/batch?includeDeferred=1
```

## What was NOT built

- No public UI changes beyond a link in the admin-only review page.
- No schema migration — defer rides on reviewNotes.
- No bulk-approve / bulk-reject — every action is per-row to keep
  the audit trail at proposal granularity.
- No new auto-link rules — the linkage column is read-only display
  (the safe-linkage and vendor-wide apply scripts handle linkage
  writes).
- No change to the existing triage rule, the existing single-row
  `/admin/evidence` UI, or the existing approval / rejection
  endpoints.
- No change to the auto_approve threshold — the cohort served by
  batch-review is `recommend_approve` only.

## Acceptance criteria

- ✅ Batch-review workflow for `recommend_approve` rows.
- ✅ 20 rows at a time with vendor, source, excerpt, proposed grade,
  classifier confidence, triage reasons, ProductScope linkage,
  evidence grade, data status.
- ✅ Five filters: vendor, confidence band, grade, linkage status,
  source URL.
- ✅ Three explicit actions: approve, reject, defer.
- ✅ auto_approve gate kept strict (no change).
- ✅ Public-facing UI outside admin unchanged.
- ✅ Report written.
