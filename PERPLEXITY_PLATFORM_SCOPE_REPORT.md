# Perplexity Platform Scope Report

Date: 2026-05-11
Pack: `dev-prompts/AI_ENTERPRISE_CLAUDE_CODE_STAGE_2_LINKAGE_BATCH_REV2_2026-05-10/`
Prompt: 09 — Add Perplexity as Platform Vendor Only

## What was added (platform side)

`lib/investor-tools/product-scope.ts` — Perplexity ProductScope expanded
from 4 to 10 source-backed entries (all from `docs.perplexity.ai` or
`www.perplexity.ai`):

| Product | Category | Notes |
|---|---|---|
| Perplexity Enterprise Pro | `enterprise_search` | Pre-existing |
| Perplexity Enterprise Max | `enterprise_search` | NEW |
| Search API | `model_api` | NEW |
| Sonar API | `model_api` | Pre-existing |
| Agent API | `agent_runtime` | NEW — uncertainty note tags hosted third-party model handling |
| Sonar | `model_api` | NEW |
| Sonar Pro | `model_api` | NEW (replaces "Sonar Pro API" wording) |
| Sonar Reasoning Pro | `model_api` | NEW |
| Sonar Deep Research | `enterprise_search` | NEW |
| Real-time web answer/research API | `enterprise_search` | Pre-existing |

Module memberships (per prompt 09):
```ts
modules: [...DEFAULT_MODULES, "News Intelligence"]
// DEFAULT_MODULES = Market Intelligence, Vendor Profiles, Capability
//                   Tracker, Investor Tools
// "Investor Tools" is the navigation label only — runtime exclusion is
// enforced by includeInInvestorTools: false (see below).
```

Flags:
```ts
simulator:    false   // excluded from Investment Simulator
assessment:   true    // included in AI Platform Fit Assessment
investorTools: false  // NEW factory field — excludes from all
                      // Investment Intelligence surfaces
```

A new `investorTools?: boolean` field was added to `ProductSeed`. The
factory reads `seed.investorTools ?? true` so every other vendor's
behaviour is unchanged.

## What was excluded (investor side)

`lib/investing/seed.ts`:

- Removed Perplexity from `IPO_PROCESS_STATES` (was `R2` rumoured).
- Removed Perplexity from `IPO_EVIDENCE_SIGNALS` (was `R1`).
- Removed Perplexity from `IPO_FORECASTS` (was 2028-06 forecast).
- Removed Perplexity from `POST_IPO_FLUCTUATION_BANDS`.
- Removed Perplexity from `EXPOSURE_CLASS_BY_VENDOR` (was
  `vertical_ai_specialist`).
- **Kept** the `provider("perplexity", …)` entry in
  `INVESTMENT_PROVIDERS` so the Commercial Models inventory still
  surfaces Perplexity. The provider description and warning were
  rewritten to explicitly say "Tracked for Commercial Models inventory
  and vendor intelligence only — NOT included in Investor Tools."

## New exclusion registry

`lib/investing/seed.ts` exports two new symbols:

```ts
export const INVESTOR_EXCLUDED_VENDOR_IDS: ReadonlySet<string> = new Set(["perplexity"]);
export function isInvestorTracked(vendorId: string): boolean
```

Any future investor-surface iteration that consumes
`INVESTMENT_PROVIDERS` (Watchlist, IPO Watch, Indirect Exposure Map,
Investor Briefings) should filter through `isInvestorTracked()` before
displaying. Today the exclusion is already enforced by data absence
(no IPO/bands/forecast rows for Perplexity).

## First-party vs third-party distinction (Agent API)

`Agent API` carries an explicit uncertainty note:

> "Hosts third-party models alongside Perplexity's own; tag first-party
> vs hosted_third_party per CommercialModel rules."

This preserves the master-pack rule: "no first-party label on hosted
third-party models." Any future Commercial Model entry for an Agent
API model must carry the `hosted_third_party` tag unless documented as
a Perplexity-owned model.

## Files changed

| File | Change |
|---|---|
| `lib/investor-tools/product-scope.ts` | +6 product entries; new `investorTools` field; flags set |
| `lib/investing/seed.ts` | Provider re-described; 4 investor entries removed; 2 new exports (set + helper) |
| `lib/investing/ipo-forecast.test.ts` | IPO_FORECASTS count threshold 13 → 12 |

## Tests

- All existing 327 tests pass (was 327, unchanged — net 0 from threshold
  decrement balanced by the Perplexity provider entry remaining).
- `Perplexity summary marks refresh required` (model-inventory test)
  continues to pass — the provider entry is preserved so the summary
  appears.
- TypeScript clean.

## Verification commands

```bash
# Confirm Perplexity is in Commercial Models inventory:
npm test -- lib/model-inventory/repository.test.ts

# Confirm IPO Forecasts no longer contains Perplexity:
node -e "import('./generated/prisma/client').then(()=>0); require('tsx/cjs');" 2>/dev/null
# Or simply read lib/investing/seed.ts and grep for 'perplexity' — only the
# provider() entry, INVESTOR_EXCLUDED_VENDOR_IDS, and inline comments should remain.

# Re-run vendor-scoped linkage review:
npx tsx --env-file=.env.local scripts/product-linkage-review.ts --vendor=vendor_perplexity --batch=20
```

## Acceptance criteria

- ✅ Perplexity products are source-backed (every name from docs.perplexity.ai or perplexity.ai).
- ✅ Perplexity included in ProductScope, Capabilities, Commercial Models, Vendor Intelligence, News Intelligence.
- ✅ Perplexity EXCLUDED from Investment Intelligence, Investment Simulator, IPO Watch, Public AI Stocks, Indirect Exposure Map, Investor Briefings, Investor Watchlist.
- ✅ First-party vs hosted third-party distinction recorded on the Agent API scope entry.
- ✅ No public UI changes beyond Perplexity appearing correctly in platform/product/capability surfaces.
- ✅ No truth/evidence standards weakened.
