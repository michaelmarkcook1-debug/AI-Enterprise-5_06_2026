# Evidence Deduplication Agent — Initial Build

Date: 2026-05-10
Author: Claude Code (auto mode)
Mode: **report-only by default** — no rows merged, no rows deleted.
Scope: `lib/services/dedup.ts`, `lib/services/dedup-runner.ts`,
`scripts/dedup-evidence.ts`, `app/api/admin/evidence/dedup/route.ts`,
`lib/services/dedup.test.ts`.

## Why this exists

The 314-row pending queue almost certainly contains duplicates: the same
vendor doc gets ingested multiple times across runs, the URL-repair agent
re-fetches a relocated page, and the fallback classifier overwrites
nothing on retry. Before any approval workflow runs we need a clear,
auditable view of which proposals are duplicates of each other and which
are merely similar — without trusting the classifier output, which is
itself partially broken (see `CLASSIFIER_FAILURE_REPORT.md`).

## What it does

### 1. Exact duplicate clustering — composite key

A proposal is an **exact duplicate** of another iff every one of these
five fields matches:

| Field | Source / treatment |
|---|---|
| `vendorId` | direct |
| `domain` | direct |
| `subfactor` | direct |
| `canonicalSourceUrl` | URL after `canonicalUrl()` — strips `www.`, lowercases host, drops tracking params (`utm_*`, `gclid`, `fbclid`, `mc_*`, `ref*`, `trk`), drops fragments, strips trailing slash |
| `excerptHash` | SHA-256 of `normaliseExcerpt(text)` — NFKC, lowercase, all non-alphanum collapsed to whitespace, runs collapsed |

The composite key intentionally **excludes** every classifier output
(`classifierConfidence`, `classifierRationale`, `classificationFailure*`,
`confidenceIsFallback`). Identity is by raw evidence, never by
classifier verdict — exactly the user's "prefer raw evidence identity
over classifier output" requirement.

### 2. Near-duplicate clustering — bucketed Jaccard

For each `(vendorId, domain, subfactor, canonicalSourceUrl, capture-week)`
bucket, the runner computes pairwise token-bigram Jaccard similarity
between excerpts. Pairs with similarity ≥ threshold (default 0.85) get
unioned via single-link clustering. Capture-week is the ISO Monday of
the week containing `capturedAt` (UTC, no DST surprises).

Rows that already cluster as exact duplicates are excluded from the near
pass — no double-counting.

### 3. Output (default `report` mode)

```ts
{
  totalInput,                  // proposals scanned
  exactClusterCount,           // groups of 2+ with identical raw identity
  exactDuplicateRows,          // sum of (cluster size - 1)
  nearClusterCount,            // groups whose pairwise Jaccard ≥ 0.85
  nearDuplicateRows,
  safeAutoMergeRows,           // ONLY exact-cluster non-reps where every member has real classifier output
  humanReviewRows,             // every near-dup + every exact-dup with any fallback member
  exactClusters: [...],        // full member list per cluster
  nearClusters:  [...],
}
```

The same JSON ships out of the admin route
(`GET /api/admin/evidence/dedup`) and the CLI (`scripts/dedup-evidence.ts`).

## Operator-safety guarantees

1. **No deletes, ever.** Auto-merge in `exact_merge` mode marks the
   non-representative members `status = "superseded"` (a status that
   already exists on `ProposalStatus`). Their content is preserved.
2. **Report-only by default.** The runner, the API, and the CLI all
   default to `mode: "report"` — `exact_merge` requires the caller to
   pass it explicitly.
3. **Classifier-fallback rows can NEVER auto-merge.** Even when their
   excerpt hash matches a real-classifier row, the runner routes the
   cluster to human review. Locked by 3 invariant tests in
   `dedup.test.ts`. This stops the dedup agent from "cleaning up" rows
   that should be reclassified instead.
4. **Near-duplicates can NEVER auto-merge.** Regardless of mode, near-
   duplicates are always report-only. The threshold (0.85) is high but
   not high enough to be safe for automated collapse.
5. **Public scoring outputs are unaffected.** Superseded
   `EvidenceProposal` rows were never promoted to `EvidenceRecord` —
   `/capabilities`, ranking, and the simulator never see them.
6. **Auto-merge writes an audit breadcrumb.** Each superseded row gets
   `reviewerId = "system:dedup-runner"` (or the caller-supplied id),
   `reviewedAt = now`, and `reviewNotes` recording the representative
   id and canonical URL.

## Representative selection (when auto-merge runs)

Within each exact cluster, the representative is chosen by:

1. Filter to rows with `!classificationFailed && !confidenceIsFallback`.
   If empty → cluster routes to human review (no rep).
2. Among the remainder, highest `classifierConfidence` wins.
3. Tie-break: earliest `capturedAt` (deterministic).

This preserves the rule "never use broken classifier fallback values for
merge logic" — fallbacks are filtered out at step 1; their confidence
is never compared.

## Tests

`lib/services/dedup.test.ts` — **30 tests**, full suite **272 / 272**
across 21 files. Coverage:

- URL canonicalisation (5 tests including www/tracking/trailing-slash)
- Excerpt normalisation + hashing stability (3 tests)
- Jaccard similarity bands (3 tests)
- Capture-week bucketing (1 test, multiple cases)
- Exact clustering (5 tests including cross-vendor / cross-subfactor
  isolation, URL canonicalisation)
- Near clustering (4 tests)
- Representative selection (4 tests)
- Report counts (3 tests)
- **`INVARIANT — fallback rows never auto-merge`** (3 cases)

The invariant block is the operator-safety lock: no matter how a
fallback row sneaks into a cluster, `safeAutoMergeRows` is 0.

## How to run

### Report only (default — recommended first pass)

```bash
npx tsx scripts/dedup-evidence.ts
```

Sample output:

```
─── Evidence dedup report ───
mode                    : REPORT (read-only)
proposals scanned       : 314
exact duplicate clusters: <N>
exact duplicate rows    : <N>
near duplicate clusters : <N>
near duplicate rows     : <N>
SAFE for auto-merge     : <N>      ← only if classifier already re-run
needs human review      : <N>      ← will include all fallback-row clusters
merge actions planned   : <N>
merge actions applied   : 0        ← always 0 in report mode
```

### Scoped report

```bash
npx tsx scripts/dedup-evidence.ts --vendor=msft
npx tsx scripts/dedup-evidence.ts --threshold=0.9
```

### Apply exact merges (opt-in, after reclassification)

```bash
npx tsx scripts/dedup-evidence.ts --exact-merge
```

Recommended sequence:

1. Run reclassification first (`scripts/reclassify-failed-proposals.ts
   --live`) so as many rows as possible carry real classifier output.
2. Run dedup in report mode, eyeball the cluster previews.
3. If clusters look sane, run `--exact-merge`. Near-dups stay report-
   only and need a human pass.

### From the admin API

```bash
curl -H "x-admin-token: $T" /api/admin/evidence/dedup                   # report
curl -X POST -H "x-admin-token: $T" -H "content-type: application/json" \
  -d '{"mode":"exact_merge"}' /api/admin/evidence/dedup                 # apply
```

## What was NOT built (intentional)

- **No near-duplicate auto-merge.** Out of scope per requirements.
- **No public-UI changes.** The admin badge / triage lane UI is
  untouched. The new admin API route is debug-status only.
- **No retroactive backfill on existing EvidenceRecord rows.** Dedup
  only operates on `pending` proposals — promoted EvidenceRecord rows
  are governed by the approval workflow, not by automated dedup.
- **No classifier output trust.** Every `classifierConfidence`,
  `classifierRationale`, etc. is excluded from clustering. They are
  read only when picking a representative inside an already-formed
  cluster of real-classifier rows.

## Recommended sequencing

1. `prisma migrate deploy` (adds the failure-metadata columns from the
   classifier-repair pass).
2. `scripts/reclassify-failed-proposals.ts --live` (clears the 304
   schema_validation rows; lights up real classifier output).
3. `scripts/dedup-evidence.ts` (this one — report only).
4. Eyeball the cluster previews in the report and at
   `/api/admin/evidence/dedup`.
5. `scripts/dedup-evidence.ts --exact-merge` once you're happy.
6. `scripts/triage-evidence.ts` — re-run triage against the cleaned
   queue, expect non-zero `auto_approve` and `recommend_approve` lanes.
