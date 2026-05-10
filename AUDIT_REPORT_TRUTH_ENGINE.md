# Truth Engine Audit

Date: 2026-05-10
Prepared for: Mike
Pack: Stage 1 batch · Task 3 (`04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md`)

## Models added/changed

| Type | Path | Status |
|---|---|---|
| `TruthRecord` | `lib/truthfulness/truth-engine.ts` (new this pass) | ✅ minimum contract from spec |
| `TruthDataStatus` | same file | ✅ 10-state union: verified · documented · tested · estimated · inferred · seed · stale · disputed · unknown · unsupported |
| `TruthFreshnessStatus` | same file | ✅ fresh · aging · stale · unknown |
| `TruthBadgeProps` | same file | ✅ `{label, tone, title}` shape consumable by any UI lib |
| `EvidenceSource` (in DB) | `prisma/schema.prisma` | ✅ pre-existing — covers id / entity / source / date / publisher / official / primary / licensed / grade / confidence / freshness / notes |
| `NormalisedEvidenceSource` (in-memory connector output) | `lib/evidence/normalise.ts` | ✅ pre-existing — produced by every connector via `normaliseFetchResult()` |

## Rendering guards (helpers)

All four spec helpers added in `lib/truthfulness/truth-engine.ts`:

| Helper | Returns | Behaviour |
|---|---|---|
| `canRenderAsVerified(record)` | `boolean` | Strict gate. False unless: E3+ AND sourceIds non-empty AND dataStatus ∈ {verified, documented, tested} AND confidence ≥ 60 AND freshness ≠ stale |
| `truthDisplayStatus(record)` | `string` | Short UI label. `unsupported` always returns `"Unknown"`; missing-source on a "verified-claiming" status returns `"Source validation required"`; stale freshness on a non-stale record returns `"Stale"` |
| `truthBadgeProps(record)` | `TruthBadgeProps` | `{label, tone, title}`. Tone scale `ok / info / warn / bad / neutral` — 1:1 mappable to any palette. Low confidence on documented → "Documented (low confidence)" tone warn |
| `requiresValidation(record)` | `boolean` | True for disputed / unsupported / missing-sources / verified-claiming-but-failing-gate |

Plus the convenience helper `isHighConfidence(record)` — true only when verified + fresh + confidence ≥ 75.

## Evidence grades

Locked on the existing `EvidenceGrade` union (`lib/types.ts`) — `E0 | E1 | E2 | E3 | E4 | E5`. The truth-engine helpers respect the standard rank:

| Grade | Rendering allowed |
|---|---|
| E0 | Never as verified. Always renders Unknown / requires validation. |
| E1 | Vendor claim only. Never verified. Documented label gated additionally on dataStatus + sources. |
| E2 | Public documentation. Documented at most. |
| E3 | Public test / sandbox / API verification. Verified gate eligible. |
| E4 | Production customer evidence. Verified eligible. |
| E5 | Independent audit / verified benchmark / filing. Verified eligible. |

## Data statuses

Behavioural matrix locked by tests:

| dataStatus | Verified gate | Display label | requiresValidation |
|---|---|---|---|
| verified | yes (if other gates pass) | `Verified` | no |
| documented | yes (if other gates pass) | `Verified` or `Documented` | only when gate fails |
| tested | yes | `Verified` or `Tested` | only when gate fails |
| estimated | no | `Estimated` | no |
| inferred | no | `Inferred` | no |
| seed | no | `Seed` | no |
| stale | no | `Stale` | no |
| disputed | **never** | `Disputed` | **always** |
| unknown | no | `Unknown` | no |
| unsupported | **never** | **`Unknown`** (renamed for safety) | **always** |

## Tests

`lib/truthfulness/truth-engine.test.ts` — **24 tests** covering the seven required paths:

- ✅ Verified path (E3 + E5; documented + verified status)
- ✅ Seed path
- ✅ Stale path (both `dataStatus: "stale"` and `freshnessStatus: "stale"`)
- ✅ Unsupported path (always renders Unknown)
- ✅ Missing source path (validation required)
- ✅ Disputed path (always requires validation, tone bad)
- ✅ Low-confidence path (`Documented (low confidence)`, tone warn)

Plus boundary tests: every grade × every dataStatus, isHighConfidence threshold, and explicit tests for the rules locked in the module's docstring.

## Blocked unsupported outputs

Per the live test suite, the following can never produce a verified rendering, regardless of other fields:

- `evidenceGrade: "E0"` — fails grade rank check
- `dataStatus: "seed"` / `"unknown"` / `"unsupported"` / `"disputed"` / `"stale"` — fails status check
- `sourceIds.length === 0` — fails source presence check
- `confidenceScore < 60` — fails low-confidence check
- `freshnessStatus: "stale"` — fails freshness check

## Remaining risks

1. **TruthRecord persistence not wired.** The type + helpers exist, but no code path currently writes a `TruthRecord` row when an `EvidenceRecord` is approved. Stage 2 work: emit one TruthRecord per approved EvidenceRecord and link it back to the entity it claims about.
2. **Module not yet adopted by every render site.** `lib/intelligence/capabilities-truthfulness.ts` has its own `capabilityRenderState()` that overlaps with the new helpers. They agree on rules — both have tests — but the duplication should be reconciled in a Stage 2 refactor: the capabilities helper should compose the truth-engine helpers rather than encode rules itself.
3. **Helper not exposed in legacy `intelligence-ui` badge.** `SeedDataBadge` uses its own seed/live binary flag rather than the full `truthBadgeProps()`. The badge works (and is bold-red on seed); the next iteration should accept a TruthRecord directly so it benefits from the four-state rule set.

## Final verdict

Truth Engine **minimum contract is in place and tested**. Any consumer that wraps its data into a `TruthRecord` and asks the four helpers gets the correct render-state. The remaining work is adoption (rewiring existing UI sites to consume these helpers) + persistence (TruthRecord DB rows) — both Stage 2 deferrals. No unsupported claim can render as fact through this module today.
