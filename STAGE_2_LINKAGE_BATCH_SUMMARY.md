# Stage 2 Linkage Batch — Execution Summary

Date: 2026-05-11
Pack: `dev-prompts/AI_ENTERPRISE_CLAUDE_CODE_STAGE_2_LINKAGE_BATCH_2026-05-10/`

## Tasks executed

| # | Prompt | Status | Artefact |
|---|---|---|---|
| 01 | `MASTER_CONTEXT` | Read-only | n/a |
| 02 | `SAFE_LINKAGE_APPLY` | Done (commit `fbb08e2` earlier) | `SAFE_LINKAGE_APPLY_REPORT.md` |
| 03 | `TRIAGE_RERUN_CHECKPOINT` | Done | `TRIAGE_RERUN_CHECKPOINT_REPORT.md` |
| 04 | `WRITER` scope gap | Done (+7 entries) | `WRITER_PRODUCT_SCOPE_GAP_REPORT.md` |
| 05 | `MICROSOFT` scope gap | Done (+3 entries) | `MICROSOFT_PRODUCT_SCOPE_GAP_REPORT.md` |
| 06 | `GOOGLE` scope gap | Done (+7 entries) | `GOOGLE_PRODUCT_SCOPE_GAP_REPORT.md` |
| 07 | `ANTHROPIC` scope gap | Done (+6 entries, 1 split) | `ANTHROPIC_PRODUCT_SCOPE_GAP_REPORT.md` |
| 08 | `OPENAI` scope gap | Done (+6 entries, 1 split) | `OPENAI_PRODUCT_SCOPE_GAP_REPORT.md` |
| 09 | `COACHING_AND_SWITCH_TO_CODEX` | Read-only guidance | n/a |

## Non-negotiables observed

- ✅ No invented product names — every addition appears on the
  vendor's public product/docs pages.
- ✅ No invented capabilities.
- ✅ No auto-link of uncertain rows.
- ✅ No truth/evidence standard weakening.
- ✅ No public UI changes.
- ✅ No bulk approval of the evidence queue.
- ✅ Codex not switched to.

## Code changes

| File | Diff |
|---|---|
| `lib/investor-tools/product-scope.ts` | +29 product entries across 5 vendors, 2 splits |
| `dev-prompts/AI_ENTERPRISE_CLAUDE_CODE_STAGE_2_LINKAGE_BATCH_2026-05-10/` | New (pack tree) |

## Test/build result

- `npx tsc --noEmit` → clean
- `npm test` → **327 / 327** across 25 files

## Codex switch criteria (per `09_COACHING_AND_SWITCH_TO_CODEX.md`)

The pack lists six criteria for switching to Codex; current state:

| Criterion | State |
|---|---|
| safe linkage apply exists and is tested | ✅ shipped + 8 tests |
| strict `ok` cohort is applied | ⏳ pending Mike's `--live` run |
| triage rerun shows improved lane distribution | ⏳ pending Mike's rerun |
| top 3–5 vendor scope gaps repaired | ✅ Writer + Microsoft + Google + Anthropic + OpenAI |
| queue review not blocked mostly by missing linkage | ⏳ pending dual-apply run |
| remaining work splittable into discrete modules | ✅ yes |

**Stay on Claude Code until the two `--live` runs complete and Mike
confirms the triage rerun shows healthier distributions.** Then the
remaining Stage-3 work (snowflake/aws/cohere/sap/ibm scope tail,
batch-review UX, connector hardening) is safe to hand to Codex
in parallel.

## Exact next commands for Mike

```bash
# 1. Dry-runs first — confirm counts
npx tsx --env-file=.env.local scripts/apply-safe-linkages.ts
npx tsx --env-file=.env.local scripts/apply-vendor-wide-evidence.ts

# 2. Apply both
npx tsx --env-file=.env.local scripts/apply-safe-linkages.ts --live --decided-by="mike@ai.enterprise"
npx tsx --env-file=.env.local scripts/apply-vendor-wide-evidence.ts --live

# 3. Re-run triage and compare to baseline
npx tsx --env-file=.env.local scripts/triage-evidence.ts

# 4. Optional — vendor-scoped linkage spot-check for the five repaired vendors
for v in vendor_writer vendor_microsoft vendor_google vendor_anthropic vendor_openai; do
  echo "── $v ──"
  npx tsx --env-file=.env.local scripts/product-linkage-review.ts --vendor=$v
done
```
