# Classifier Failure Report

Date: 2026-05-10
Author: Claude Code (auto mode)
Scope: `lib/agents/evidence-classifier.ts`, `lib/sourcing/runner.ts`,
`lib/services/triage-runner.ts`, `prisma/schema.prisma` + new migration,
new reclassify script, new admin failures route, new tests.

## Root cause

**Prompt/schema mismatch — Zod validation failure.**

The classifier's Zod schema at `lib/agents/evidence-classifier.ts:13` declared:

```ts
rationale: z.string().min(10).max(400)
```

The LLM consistently produces rationales > 400 chars. The Zod parser
threw `too_big` for every such call. The runner caught the throw at
`lib/sourcing/runner.ts:288–292` and returned `{ classification: null }`,
which the persistence step then stamped as `classifierConfidence = 0.5`
(the runner's missing-value fallback). The failure was invisible
downstream — every triage pass reported "low confidence" instead of
"classifier never produced a value".

### Evidence — failure-cause distribution from `logs/sourcing/*.ndjson`

```
TOTAL classify.fail events: 312
  304  zod_too_big (path: rationale, maximum: 400)
    8  credit_balance (Anthropic billing — brief outage during bulk run)
    0  auth_401
    0  rate_limit_429
    0  timeout
    0  model_not_found
    0  no_tool_use
    0  network
    0  unknown
```

97% of failures are the rationale-too-long Zod error. The remaining 3% are
the Anthropic credit-balance outage that happened during the bulk
ingestion campaign earlier in the project.

This is **not** an API/auth/timeout/rate-limit/model issue. Sample error
payload (formatted from log):

```json
[
  {
    "origin": "string",
    "code": "too_big",
    "maximum": 400,
    "inclusive": true,
    "path": ["rationale"],
    "message": "Too big: expected string to have <=400 characters"
  }
]
```

## Why it stayed silent

1. **Catch block too coarse.** `runner.ts:288–292` swallowed every
   `classifyEvidence()` throw and returned `{ classification: null }`.
2. **Fallback masked the failure.** `??  0.5` and `?? proposal.rationale`
   wrote a "looks normal" row to the DB on every failure.
3. **No dedicated failure column.** Nothing on `EvidenceProposal`
   distinguished "real low confidence" from "classifier never ran".
4. **Triage didn't know.** Until the policy-tuning pass added the
   `confidenceIsFallback` flag (heuristic-based), the rule treated 0.5 as
   a real classifier output and routed the bulk to `human_review_required`
   for the wrong reason.

## Affected files

| File | Why |
|---|---|
| `lib/agents/evidence-classifier.ts` | Hard 400-char Zod ceiling |
| `lib/sourcing/runner.ts` (lines 288–322) | Coarse catch + silent 0.5 fallback |
| `prisma/schema.prisma` (`EvidenceProposal`) | No explicit failure columns |
| `lib/services/triage-runner.ts` | Heuristic detection only — no first-class signal |

## Fixes applied

### 1. Raise the Zod ceiling + truncate defensively

`lib/agents/evidence-classifier.ts`

```ts
export const RATIONALE_MAX = 2000;
export const RATIONALE_DISPLAY_MAX = 1500;

rationale: z
  .string()
  .min(10)
  .max(RATIONALE_MAX)
  .transform((s) =>
    s.length > RATIONALE_DISPLAY_MAX
      ? s.slice(0, RATIONALE_DISPLAY_MAX - 14) + "…[truncated]"
      : s,
  ),
```

The JSON-Schema sent to the model is updated in lockstep
(`maxLength: RATIONALE_MAX`). The transform truncates to a sane display
length for downstream renders without rejecting the parse.

### 2. Stop silently degrading to 0.5

`lib/sourcing/runner.ts`

- New exported helper `categoriseClassifyFailure(message)` returns
  `{code: ClassifyFailureCode, reason: string}` for one of:
  `schema_validation` · `credit_balance` · `rate_limit` · `auth` ·
  `model_not_found` · `timeout` · `no_tool_use` · `network` · `unknown`.
- The catch block now logs the failure code in the sourcing event log.
- Persistence stamps the **explicit failure metadata** (see #3) instead
  of pretending the classify succeeded with confidence 0.5.
- Confidence on failure is `0` (not `0.5`) — paired with
  `confidenceIsFallback=true` so the value is unambiguous.

### 3. New explicit columns on `EvidenceProposal`

`prisma/schema.prisma`:

```prisma
classificationFailed         Boolean @default(false)
classificationFailureCode    String?
classificationFailureReason  String?  @db.Text
confidenceIsFallback         Boolean @default(false)
```

Migration: `prisma/migrations/20260510160000_add_classification_failure_fields/migration.sql`.
Backfill clause in the migration marks every existing
`classifier_confidence = 0.5 AND classifier_rationale IS NULL` row as
`classification_failed = true`, `classification_failure_code = 'legacy_fallback_0_5'`
so the legacy heuristic in `lib/services/triage-runner.ts` can be
retired in a follow-up.

### 4. Operator safety preserved

- The triage rule already routes any `confidenceIsFallback=true` row to
  `human_review_required`, regardless of how high or low the stamped
  number is.
- Auto-approve cannot fire on a failed-classify row — the gate now
  reads the new explicit `classificationFailed` field via
  `isClassifierFallback()`.
- Failed rows are clearly marked (`classification_failed`,
  `classification_failure_code`, `classification_failure_reason`) for
  reclassification.

### 5. Reclassification path

`scripts/reclassify-failed-proposals.ts`:

```bash
# Dry-run — counts what would be reclassified, by failure code
npx tsx scripts/reclassify-failed-proposals.ts

# Live — actually re-run the classifier
npx tsx scripts/reclassify-failed-proposals.ts --live

# Scope down for a controlled first pass
npx tsx scripts/reclassify-failed-proposals.ts --live --vendor=msft --limit=10

# Target only the schema-validation failures (recommended first pass —
# these will all clear with the new 2000-char rationale ceiling)
npx tsx scripts/reclassify-failed-proposals.ts --live --code=schema_validation
```

Targets rows where `classificationFailed = true` OR
`confidenceIsFallback = true` OR (legacy) `classifierConfidence = 0.5
AND classifierRationale IS NULL`. Each row is reclassified in isolation;
a single LLM blowup never poisons a batch.

### 6. Reporting

- `GET /api/admin/evidence/failures` (admin-gated) returns counts by
  failure code:
  ```json
  {
    "ok": true,
    "totals": [
      {"code": "legacy_fallback_0_5", "count": 312},
      {"code": "schema_validation", "count": 0}
    ],
    "grandTotal": 312
  }
  ```
- The triage CLI already prints `classifier fallback rows : N` and the
  reason breakdown.
- New helper `getClassifierFailureCounts()` in `triage-runner.ts`.

### 7. Tests

`lib/sourcing/categorise-classify-failure.test.ts` — **14 new tests**:

- Each failure code has a dedicated test with a representative error
  string (including the actual May-2026 Zod payload as the
  `schema_validation` fixture).
- Reason-truncation test (1500-char cap).
- Regression test for the schema fix: 1611-char rationale parses cleanly
  with truncation; 4-char rationale still rejected.

Full suite: **242 / 242** across 20 files. TypeScript clean.

## Public-UI changes

None beyond truthful admin/debug status:

- `/admin/evidence` (existing) shows the triage lane badge per proposal.
- `/api/admin/evidence/failures` (new) is admin-gated — debug status only.
- `/admin/data-sources`, `/capabilities`, public scoring — untouched.

## Exact rerun command for Mike

```bash
# 1. Apply the migration (adds the 4 new columns + backfills the
#    312 legacy fallback rows). Safe — non-destructive ALTER + UPDATE.
DATABASE_URL="$(cat .env.local | grep DATABASE_URL | cut -d= -f2-)" \
  npx prisma migrate deploy

# 2. Confirm the failure-cause counts (should show 312 legacy_fallback_0_5
#    and 0 of everything else, post-migration).
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  https://<your-deploy>/api/admin/evidence/failures | jq

# 3. Dry-run the reclassifier to see the planned work.
npx tsx scripts/reclassify-failed-proposals.ts

# 4. Live reclassify — start scoped to verify the rationale fix.
npx tsx scripts/reclassify-failed-proposals.ts --live --limit=10

# 5. If step 4 shows clean reclassifications, run the full sweep.
npx tsx scripts/reclassify-failed-proposals.ts --live

# 6. Re-run triage; expect non-zero auto_approve / recommend_approve / etc.
npx tsx scripts/triage-evidence.ts
```

Expected post-reclassify triage distribution (estimates based on the two
successful classifications observed at 0.91/0.92):

| Lane | Estimated count |
|---|---|
| auto_approve | 30–60 |
| recommend_approve | 80–150 |
| recommend_reject | 20–40 |
| human_review_required | 80–120 |

Numbers will firm up after the live reclassify completes.

## What did NOT change

- The pure triage rule (`lib/services/triage.ts`) — already had a path
  for `confidenceIsFallback`; no behavioural change.
- Public scoring outputs (`/capabilities`, ranking, simulator).
- Admin UI lane badges in `app/admin/evidence/EvidenceReview.tsx` —
  same lanes, same colours.
- Auto-approve strictness — strictly more conservative now (must also
  pass `!classificationFailed`).
