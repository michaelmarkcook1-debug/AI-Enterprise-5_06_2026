# Hero Hierarchy Update Report

Date: 2026-05-11
Pack: `dev-prompts/AI_ENTERPRISE_CLAUDE_CODE_STAGE_2_LINKAGE_BATCH_REV2_2026-05-10/`
Prompt: 10 — Hero Hierarchy: Assessment First

## Hierarchy applied (per pack README)

**Level 1 — Core hero functions:** Assessment · Vendor Intelligence ·
Capabilities · Briefings.
**Level 2 — Supporting:** Market Tracker · News · Watchlists ·
Commercial Models · Data Sources / Evidence.
**Level 3 — Specialist:** Investor Tools · Investment Intelligence ·
Investment Simulator · IPO Watch · Indirect Exposure Map · Public AI
Stocks.

## Changes (copy + priority only — no visual flourish)

### Front-page hero — `components/AIEnterpriseShell.tsx`

| Element | Before | After |
|---|---|---|
| Subtitle | `Vendor · Investor · Capability Intelligence` | `Assessment · Vendor · Capability · Briefing Intelligence` |
| Lede | `Enterprise AI vendor intelligence — source-cited, evidence-graded, ready for the investment committee.` | `Source-cited, evidence-graded AI vendor intelligence — start with an assessment of your AI platform fit.` |
| Primary CTA (strong) | `Enter portal` → `/dashboard` | **`Take Assessment` → `/assessment`** (was secondary) |
| Secondary CTA | `Take Assessment` → `/assessment` | `Enter portal` → `/dashboard` |

Only the strong-primary visual treatment moved with the swap (pulse
rings, gold/strong dot, weight 700). No new visual elements added.

### Top navigation — `components/TopNav.tsx`

| Element | Before | After |
|---|---|---|
| First visible item after logo | **`Investor Tools` dropdown** (rendered before NAV array, `font-semibold`) | `Assessment` (now item 2 of NAV) |
| Investor Tools placement | First, with `font-semibold` baseline | **Last** in the nav, with `font-medium` baseline matching every other Level-2/3 item |
| NAV order | Dashboard · Vendors · Market Tracker · News · Capabilities · Assessment · Briefings · Watchlists · Admin | Dashboard · **Assessment** · Vendors · Capabilities · Briefings · Market Tracker · News · Watchlists · Admin |

Investor Tools is preserved as an accessible specialist module — the
dropdown still exposes every child route (Investment Intelligence,
Investment Simulator, IPO Watch, etc.). The change is *position* and
*weight*, not removal.

## What was NOT changed

- No new visual flourish (no new icons, banners, or animations).
- No removal of Investor Tools — it remains in the nav as a Level-3
  specialist module.
- No content changes to any of the Investor Tools sub-pages.
- No public route changes.
- The Assessment route (`/assessment`) is unchanged; the change is
  purely entry-point promotion.

## Test/build result

- TypeScript: clean
- Tests: 327 / 327 across 25 files
- No new tests added (copy/order changes; no logic surface to test).

## Files changed

| File | Diff summary |
|---|---|
| `components/AIEnterpriseShell.tsx` | Subtitle reworded; lede reworded; CTAs swapped so Take Assessment is the strong primary |
| `components/TopNav.tsx` | NAV reordered (Assessment promoted to slot 2); Investor Tools dropdown moved from first to last in the nav and demoted from `font-semibold` to `font-medium` |

## Acceptance criteria

- ✅ Assessment is a first-class hero function (strong primary CTA, second nav slot).
- ✅ Investor Tools is presented as Level-3 specialist functionality (last nav slot, non-bold styling, no hero CTA).
- ✅ Investor Tools accessible from navigation (dropdown preserved).
- ✅ Hero focused on Assessment + Vendor + Capability + Briefing.
- ✅ Preferred hero quick actions (Assessment, Vendors, Capabilities, Briefings) all reachable from the hero or the top nav at hero-level weight.
- ✅ No new visual flourish (copy and priority only).
- ✅ Investor Tools NOT removed from the platform.
