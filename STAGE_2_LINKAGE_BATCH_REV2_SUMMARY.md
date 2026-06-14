# Stage 2 Linkage Batch — REV 2 Execution Summary

Date: 2026-05-11
Pack: `dev-prompts/AI_ENTERPRISE_CLAUDE_CODE_STAGE_2_LINKAGE_BATCH_REV2_2026-05-10/`

## What's new in Rev 2

The base Stage-2 linkage batch (prompts 02–08) was already executed in
commit `0b762fa`. Rev 2 adds **two new prompts**:

- **09** — Add Perplexity as a tracked vendor for platform/product/
  capability surfaces ONLY; exclude from all Investor Tools surfaces.
- **10** — Hero hierarchy: promote Assessment to Level-1 hero status;
  demote Investor Tools to Level-3 specialist.

Plus a re-statement of non-negotiables and the coaching/switch-to-Codex
checklist updated to include Perplexity-correctness and hero-correctness.

## Tasks executed

| # | Prompt | Status | Artefact |
|---|---|---|---|
| 01 | Master context (Rev 2) | Observed | n/a |
| 02 | Safe Linkage Apply | Done in `fbb08e2` | `SAFE_LINKAGE_APPLY_REPORT.md` |
| 03 | Triage Rerun Checkpoint | Done in `0b762fa` | `TRIAGE_RERUN_CHECKPOINT_REPORT.md` |
| 04 | Writer scope gap | Done in `0b762fa` | `WRITER_PRODUCT_SCOPE_GAP_REPORT.md` |
| 05 | Microsoft scope gap | Done in `0b762fa` | `MICROSOFT_PRODUCT_SCOPE_GAP_REPORT.md` |
| 06 | Google scope gap | Done in `0b762fa` | `GOOGLE_PRODUCT_SCOPE_GAP_REPORT.md` |
| 07 | Anthropic scope gap | Done in `0b762fa` | `ANTHROPIC_PRODUCT_SCOPE_GAP_REPORT.md` |
| 08 | OpenAI scope gap | Done in `0b762fa` | `OPENAI_PRODUCT_SCOPE_GAP_REPORT.md` |
| **09** | **Perplexity platform-only** | **NEW — done this commit** | `PERPLEXITY_PLATFORM_SCOPE_REPORT.md` |
| **10** | **Hero hierarchy** | **NEW — done this commit** | `HERO_HIERARCHY_UPDATE_REPORT.md` |
| 11 | Coaching / switch-to-Codex (Rev 2) | Observed | n/a |

## Non-negotiables observed

- ✅ No invented product names — every Perplexity entry from `docs.perplexity.ai` / `perplexity.ai`.
- ✅ No invented capabilities.
- ✅ No auto-link of uncertain rows.
- ✅ No truth/evidence standard weakening.
- ✅ Public UI changed for hero hierarchy ONLY — no other surfaces touched.
- ✅ No bulk evidence-queue approval.
- ✅ Codex not switched to.
- ✅ Perplexity is platform-only; excluded from every investor surface.
- ✅ Assessment is hero-level; Investor Tools is Level-3 specialist.

## Test/build result

- `npx tsc --noEmit` → clean
- `npm test` → **327 / 327** across 25 files

## Codex switch criteria (per `11_COACHING_AND_SWITCH_TO_CODEX.md`)

| Criterion | State |
|---|---|
| safe linkage apply exists and is tested | ✅ |
| strict `ok` cohort is applied | ⏳ pending Mike's `--live` |
| triage rerun shows improved lane distribution | ⏳ pending rerun |
| top 3–5 vendor scope gaps repaired | ✅ Writer + Microsoft + Google + Anthropic + OpenAI |
| queue review not blocked mostly by missing linkage | ⏳ pending dual-apply run |
| Perplexity included platform-only and excluded from Investor Tools | ✅ |
| Assessment restored as hero/core | ✅ |
| remaining work splittable into discrete modules | ✅ |

6 of 8 met. The remaining 2 are Mike-side `--live` operational runs.

## Files changed this commit

| File | Change |
|---|---|
| `lib/investor-tools/product-scope.ts` | +6 Perplexity entries; new `investorTools` factory field; Perplexity flagged out of investor surfaces |
| `lib/investing/seed.ts` | Perplexity removed from IPO/bands/forecast/exposure; provider entry preserved with rewritten description; new `INVESTOR_EXCLUDED_VENDOR_IDS` + `isInvestorTracked()` exports |
| `lib/investing/ipo-forecast.test.ts` | IPO_FORECASTS count threshold 13 → 12 |
| `components/AIEnterpriseShell.tsx` | Hero subtitle reworded; CTAs swapped (Assessment → strong primary) |
| `components/TopNav.tsx` | NAV reordered (Assessment promoted); Investor Tools moved to last slot with non-bold styling |

## Deploy

Per the user request to "deploy all prompts":

```bash
vercel deploy
```

The hero and nav updates will be visible on the new preview URL once
the build finishes (~2 minutes). The Perplexity data changes affect
server-side rendering of Capabilities and Commercial Models pages
(read-only — no migration required).
