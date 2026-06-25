# MASTER PROMPT — AI Enterprise Re-Architecture

You are working on the existing AI Enterprise Next.js app.

## Objective

Reframe the app from an Atlas-first AI market intelligence portal into a CIO Decision Intelligence Platform.

The product should support this executive workflow:

```text
QUERY → UNDERSTAND → ASSESS → DEMONSTRATE → MONITOR
```

With a separated secondary workflow:

```text
INVESTOR TOOLS
```

## Current App Assets To Preserve

The existing app already includes valuable components and should not be rebuilt from scratch.

Preserve and reuse:

- `/query`
- `/understand`
- `/assess`
- `/demonstrate`
- `/atlas`
- `/quadrant`
- `components/atlas/AIAtlasClient.tsx`
- `components/query/VendorSharePie`
- `components/demonstrate/VendorUptakeExplorer`
- `components/demonstrate/TokenPricingTable`
- `components/demonstrate/RestoreShortlistBanner`
- `app/reputation/ReputationTabs`
- `components/understand/UnderstandTabs`
- `components/dashboard/ExposureMapHero`
- `app/watchlists/WatchlistManager`
- `lib/intelligence/repository`
- `lib/intelligence/provenance`
- `lib/intelligence/metrics`
- `lib/intelligence/quadrant`
- `lib/reputation/seed`
- `lib/model-inventory/token-pricing`
- evidence grading and provenance logic

## Required New Product Structure

### Query

Question answered:

> What is happening in the AI market?

### Understand

Question answered:

> What is this vendor and where does it fit?

### Assess

Question answered:

> What should my organisation deploy?

### Demonstrate

Question answered:

> How does the CIO defend this decision to the board?

### Monitor

Question answered:

> Is the recommendation still valid?

### Investor Tools

Question answered:

> Where should capital be allocated?

## Required First-Pass Code Changes

1. Change `/` redirect from `/atlas` to `/query`.
2. Update `TopNav` to show:
   - Query
   - Understand
   - Assess
   - Demonstrate
   - Monitor
   - Investor Tools
3. Remove Atlas and Leadership from primary top nav.
4. Retain Atlas and Leadership as sublinks / cards inside Understand.
5. Add `/monitor` route.
6. Add `/investor-tools` route if it does not already exist.
7. Keep existing UI components working.
8. Ensure build passes.

## Acceptance Criteria

- `npm run build` passes.
- `/query`, `/understand`, `/assess`, `/demonstrate`, `/monitor`, `/investor-tools` load.
- `/atlas` and `/quadrant` still exist.
- No seed/estimated data is represented as verified.
- Top-level navigation reflects CIO decision lifecycle.
