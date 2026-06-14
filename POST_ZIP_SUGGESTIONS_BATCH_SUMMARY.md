# Post-Zip Suggestions Pack — Execution Summary

Date: 2026-05-11
Pack: `dev-prompts/AI_ENTERPRISE_POST_ZIP_SUGGESTIONS_PACK_2026-05-10/`

## Tasks executed

| # | Prompt | Status | Artefact |
|---|---|---|---|
| 01 | Master Context | Observed | n/a |
| 02 | Perplexity Platform Only | Shipped in `e0804ab` + boundary tests added this commit | `PERPLEXITY_PLATFORM_SCOPE_REPORT.md`; `lib/investor-tools/perplexity-scope-boundaries.test.ts` |
| 03 | Hero Hierarchy (Assessment First) | Shipped in `e0804ab` | `HERO_HIERARCHY_UPDATE_REPORT.md` |
| 04 | Assessment Granularity Upgrade | Plan written this commit | `ASSESSMENT_GRANULARITY_UPGRADE_PLAN.md` |
| 05 | Multi-Vendor Stack Output | Plan written this commit | `ASSESSMENT_MULTI_VENDOR_STACK_OUTPUT_PLAN.md` |
| 06 | Implementation Order / Acceptance | Observed (coaching note) | n/a |

Per prompt 06's explicit instruction — "Do not try to implement all
of this in one pass. Plan first, then phase it" — prompts 04 and 05
shipped as planning documents only. The granularity-upgrade plan
includes a 9-phase implementation order with effort estimates; the
stack-output plan defers code changes to the same phasing.

## Code changes in this commit

| File | Change |
|---|---|
| `lib/investor-tools/perplexity-scope-boundaries.test.ts` | New — 14 tests locking the platform-included / investor-excluded contract |

No source-code changes — the Perplexity / hero changes shipped in
`e0804ab` (Stage 2 Rev2). This commit adds explicit test coverage
plus the two planning documents.

## Test/build result

- `npx tsc --noEmit` → clean
- `npm test` → **341 / 341** across 26 files (was 327 — +14 boundary tests)

## Acceptance criteria (per prompt 06)

**Perplexity:**
- ✅ Present in ProductScope / Commercial Models / Capabilities
- ✅ Absent from Investor Tools (`includeInInvestorTools = false`; `INVESTOR_EXCLUDED_VENDOR_IDS` carries `perplexity`; absent from `IPO_PROFILES` / `IPO_EVIDENCE_QUALITY` / `IPO_FORECASTS` / `POST_IPO_FLUCTUATION_BANDS`)
- ✅ Tests prove scope boundaries — `lib/investor-tools/perplexity-scope-boundaries.test.ts`

**Hero hierarchy:**
- ✅ Assessment visible in hero copy (subtitle + lede) and hero CTA (strong primary)
- ✅ Investor Tools not hero-prominent (last nav slot, non-bold)
- ✅ Nav still contains Investor Tools dropdown

**Assessment granularity:**
- ✅ Plan document exists
- ✅ Progressive disclosure preserved (Quick / Guided / Advanced tiers)
- ✅ Adaptive questioning defined (rule-based follow-up triggers)
- ✅ Eight new input dimensions defined with controlled vocabularies
- ✅ Output layers defined (7 layers + 4 output modes)

**Multi-vendor stack:**
- ✅ Plan document exists
- ✅ Singular provider output is no longer the universal default — explicit decision tree picks between one-anchor and full-stack modes
- ✅ Role categories defined (with `productCategory` → role mapping)
- ✅ Stack logic defined (anchor → role-fills → alternative → analysis)
- ✅ Blocker / integration analysis included (Level-4 output)

## Coaching note observed (prompt 06)

> "The product gets much stronger by:
>   - asking better questions
>   - returning more realistic recommendations
>   - showing decision-grade blockers and evidence gaps
> not by adding more charts."

The granularity plan explicitly avoids new charts. The stack-output
plan is text-only — anchor card + role cards + analysis prose.

## What's next

When you're ready to start implementing the assessment upgrade,
Phase 1 of `ASSESSMENT_GRANULARITY_UPGRADE_PLAN.md` is the natural
entry point (~2–3 days). Phases 1–4 ship as a v1 (better questions
+ disqualifier logic + new output structure). Phases 5–9 are the
depth pass (scoring engine + stack output + output modes).

Or, per the Codex switch checklist, this is also a natural handoff
point — the planning work is done in Claude Code; phased implementation
of the planned scope is suitable for Codex to take one phase at a time.
