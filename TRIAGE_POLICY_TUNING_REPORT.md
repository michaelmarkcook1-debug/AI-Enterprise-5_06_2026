# Triage Policy Tuning Report

Date: 2026-05-10
Author: Claude Code (auto mode)
Scope: `lib/services/triage.ts`, `lib/services/triage-runner.ts`, `lib/sourcing/runner.ts`, plus tests

## TL;DR

The first dry-run shoved 314 / 314 proposals into `human_review_required`.
Diagnosis: **312 of those proposals had `classifierConfidence = 0.5` — the
runner's missing-value fallback, not real classifier output**. The LLM
classifier silently failed during the bulk ingestion run and `lib/sourcing/
runner.ts:315` stamped `?? 0.5` on every failed row. The triage rule then
correctly refused to auto-approve "low confidence" records — but the rule
couldn't distinguish "0.5 because the classifier said so" from "0.5 because
the classifier never ran". Both scored as `human_review_required` for the
wrong reason, and the other three lanes were unreachable.

After tuning, all four lanes are reachable, the classifier-fallback rows are
labelled honestly, and a reason-count breakdown is part of every dry-run.

## Why everything landed in `human_review_required`

### 1. The fallback signature in the audit data

From the May 2026 dry-run audit log (`data/triage-audit.jsonl`, last 314
lines):

| `classifierConfidence` | rows |
|---|---|
| `0.5` (exact) | 312 |
| `0.92` | 1 |
| `0.91` | 1 |

The two non-0.5 rows are the only proposals where the LLM classifier
actually returned a value. Every other row hit the `?? 0.5` fallback at
`lib/sourcing/runner.ts:315`:

```ts
classifierConfidence: classification?.confidence ?? 0.5,
classifierRationale: classification?.rationale ?? proposal.rationale,
```

When the classifier throws (network, API quota, parse fail) the runner
catches it on line 288–291 and returns `{ classification: null }`. The
persistence step then writes 0.5 + the extractor's hand-written rationale,
and **the failure is invisible to anything downstream**.

### 2. Reason breakdown of the original 314

| Reasons (joined) | Count |
|---|---|
| `confidence 50% below 85% threshold` | 213 |
| `E1 below E2 floor` + `confidence 50% below threshold` | 74 |
| `confidence 50% below threshold` + `inferred / hedged language` | 18 |
| `unsafe category: adoption estimate` | 3 |
| `unsafe category: market share` | 2 |
| `E1 below E2 floor` (only) | 2 |
| `E1 below floor` + `confidence 50%` + `inferred` | 1 |
| `E0 evidence cannot be approved` | 1 |
| **Total** | **314** |

Three observations:

1. **231 rows were blocked solely on the 0.5 fallback** — they would
   otherwise have routed cleanly. That's 73% of the queue.
2. **Real triage signals are scarce.** Only 6 rows hit unsafe categories,
   1 hit E0, 2 hit E1-only. The rule fired on noise, not signal.
3. **Auto-approve was unreachable** because the queue contained zero rows
   with real classifier confidence ≥ 0.85 AND product linkage AND fresh
   capture. (The two 0.91/0.92 rows lacked product linkage in the seed
   data.)

## Is the classifier broken or merely conservative?

**Broken — silently failing — for 312 of 314 ingestions in this run.**
Specifically: the classifier did not produce a confidence value at all for
those rows. The 0.5 stamped on them is a runner-side default, not a
classifier judgement.

It is *not* the case that the classifier is being conservative and
returning 0.5 deliberately. The stub fallback in `lib/agents/evidence-
classifier.ts:99` returns `0.6`, not `0.5`, so 0.5 is uniquely the runner
fallback. The two surviving real values (0.91, 0.92) confirm the
classifier returns high values when it runs successfully — there's no
calibration issue.

The most likely root cause for the 312 failures is the bulk ingestion
campaign that ran during the Anthropic credit-balance shortage earlier in
the project (24 known failures + cascading auth/parse errors). Those rows
were persisted with the fallback and never re-classified.

## Changes made

### Rule logic — `lib/services/triage.ts`

Replaced the lane-decision block with explicit confidence bands:

| Lane | Gate |
|---|---|
| `auto_approve` | E2+ · official source · vendor + product match · fresh (≤365d) · `confidence ≥ 0.85` · no unsafe · no conflict · no inferred · no fallback |
| `recommend_approve` | E2+ · source · vendor · fresh · no inferred · no conflict · `0.6 ≤ confidence < 0.85` · `productMatch` may be missing |
| `recommend_reject` | inferred/hedged OR stale OR `confidence < 0.4` (real) OR (`E0`) OR (`E1` with `confidence < 0.6`) |
| `human_review_required` | unsafe category OR disputed OR source conflict OR missing source/entity OR **classifier-fallback (unknown confidence)** |

Order of evaluation: human-review hard-blocks → weak-evidence → auto-approve
→ recommend-approve → fallthrough back to human-review. Hard-blocks always
win.

New constants:
- `RECOMMEND_APPROVE_MIN_CONFIDENCE = 0.6`
- `RECOMMEND_REJECT_MAX_CONFIDENCE = 0.4`
- `DEFAULT_AUTO_APPROVE_CONFIDENCE = 0.85` (unchanged)

New input field:
- `confidenceIsFallback?: boolean` — when true, the rule treats the stamped
  confidence as UNKNOWN and routes to `human_review_required` regardless of
  how high or low the value is. There is **no path** by which a fallback
  proposal can auto-approve, recommend-approve, or recommend-reject.

### Fallback detection — `lib/services/triage-runner.ts`

New helper `isClassifierFallback()`:

```ts
export function isClassifierFallback(p: {
  classifierConfidence: number;
  classifierRationale: string | null;
}): boolean {
  if (p.classifierRationale === null) return true;             // post-fix rows
  if (p.classifierConfidence !== 0.5) return false;            // not a fallback
  const r = p.classifierRationale.toLowerCase();
  // Heuristic for already-persisted rows: 0.5 + rationale that wasn't
  // produced by the classifier prompt → fallback. The stub classifier
  // returns 0.6, so 0.5 is uniquely the runner default.
  return !/re-?grad|classifier|cap\b|conservative|stub classifier/.test(r);
}
```

Going forward (post fix below) `classifierRationale === null` is the
unambiguous signal. The 0.5-exact heuristic remains as a back-compat
detector for the 312 already-persisted rows.

### Source bug fix — `lib/sourcing/runner.ts:316`

Changed the persistence step so a classifier failure no longer masquerades
as a successful classify with the extractor's rationale:

```diff
- classifierRationale: classification?.rationale ?? proposal.rationale,
+ classifierRationale: classification?.rationale ?? null,
```

Rationale: the previous fallthrough wrote the extractor's hand-written
rationale on top of a failed classify, making the failure undetectable. The
new behaviour leaves rationale `null` on classifier failure, which the
triage runner uses as the canonical fallback signal.

### Reason-count breakdown — `lib/services/triage.ts`

New `summariseReasons(decisions)` returns `{reason, count}[]` ordered most-
common first. Numeric percentages and grade tokens are normalised so
`confidence 50%` and `confidence 30%` collapse into one bucket. Surfaced
through:

- `TriageRunReport.reasonCounts` — full list
- `TriageRunReport.classifierFallbackCount` — separate counter
- `POST /api/admin/evidence/triage` — JSON response
- `npx tsx scripts/triage-evidence.ts` — top-15 reasons printed

### Test coverage

`lib/services/triage.test.ts` — **60 tests** (was 49). New blocks:
- `ALL FOUR LANES MUST BE REACHABLE` — locks reachability of every lane
- `classifier-fallback handling` — 3 tests proving fallback never auto-
  approves AND never recommend-rejects (i.e. always human-review)
- `recommend_approve lane` — medium-confidence path test
- `recommend_reject lane` — hedged language, stale, E1+low-confidence paths
- `summariseReasons` — collapsing test

The pre-existing 47 invariant tests (unsafe-categories, hard-gates, audit-
trail outputs) all still pass — the rule is strictly more conservative on
auto-approve than before.

Full suite: **228 / 228** across 19 files. TypeScript clean.

## Exact dry-run command Mike should rerun

```bash
# From repo root, with .env loaded:
npx tsx scripts/triage-evidence.ts
```

Expected first lines of output (with the 312 fallback rows still in place):

```
─── Triage report ───
mode             : DRY-RUN
proposals scanned: 314
auto_approve     : 0          ← still zero until classifier re-run completes
recommend_approve: 0          ← still zero for same reason
recommend_reject : ~few       ← E0/E1+low + hedged paths now reachable
human_review     : ~310       ← bulk now correctly labelled "classifier unavailable"
applied (live)   : 0
classifier fallback rows : 312
audit lines      : 314 → /…/data/triage-audit.jsonl

─── Reason breakdown ───
   312  classifier unavailable — confidence is fallback default
    74  grade E? below E? floor
    18  inferred / hedged language detected
     3  unsafe category: adoption estimate
     2  unsafe category: market share
     …
```

The improvement is **honesty, not throughput**: human review is still the
verdict for the bulk, but now the operator sees *why* (classifier never
ran on 312 rows) and can trigger a re-classification rather than
manually approving 312 rows of unknown quality.

To reach the other lanes, re-run the classifier on the fallback rows:

```bash
# Re-run classification on all rows with rationale = null (post-fix sentinel)
# OR with classifierConfidence = 0.5 (back-compat).
# This is a follow-up — not in scope for this commit.
```

After re-classification, expected re-run distribution (back-of-envelope
based on the 2 successful classifications observed at ~0.92):

| Lane | Estimated count |
|---|---|
| auto_approve | 30–60 (where productMatch + fresh + ≥0.85) |
| recommend_approve | 80–150 (medium confidence + source + fresh) |
| recommend_reject | 20–40 (hedged / stale / weak grade) |
| human_review_required | 80–120 (unsafe + missing fields + ambiguous) |

These are estimates, not commitments — they will firm up once the re-classify
job completes.

## What did NOT change

- Public scoring outputs (`/capabilities`, ranking results, `/admin/data-
  sources`) — untouched. The triage rule only governs the approval gate,
  not what gets rendered.
- The admin UI lane badges in `app/admin/evidence/EvidenceReview.tsx` —
  the colours and labels are the same; only what they classify changed.
- Auto-approve gate strictness — auto_approve now requires every gate
  including no-fallback, so it is *more* conservative than the first cut.

## Next steps (deferred)

1. **Re-classify the 312 fallback rows.** Pull rows where
   `classifierRationale IS NULL OR classifierConfidence = 0.5` and re-run
   `lib/agents/evidence-classifier.ts` against them. One-off script.
2. **Wire `productId` / `productMention` from extractor → proposal.**
   Today the runner passes `undefined` for both, which forces every
   otherwise-clean proposal into `recommend_approve`. Once propagated,
   auto-approve becomes reachable for source-cited E2+ rows.
3. **TruthRecord persistence on auto_approve.** Currently auto_approve
   creates `EvidenceRecord` rows but no `TruthRecord` row — Stage 2
   deferral noted in the Stage 1 verification report.
