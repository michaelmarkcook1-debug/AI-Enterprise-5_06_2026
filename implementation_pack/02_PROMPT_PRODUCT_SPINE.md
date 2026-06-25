# PROMPT 1 — Product Spine Re-Architecture

## Objective

Refactor the platform navigation and landing structure so the app clearly communicates one product with multiple executive workflows.

## Current Problem

The app currently behaves like an Atlas-first market intelligence product.

That makes sense for exploration, but the strategic product is now a CIO Decision Intelligence Platform.

## Target Navigation

Primary nav:

```text
Query
Understand
Assess
Demonstrate
Monitor
```

Secondary nav item, visually separated:

```text
Investor Tools
```

## Implementation Tasks

### 1. Home Redirect

Change `app/page.tsx`:

Current:

```tsx
redirect("/atlas")
```

Target:

```tsx
redirect("/query")
```

### 2. Top Navigation

Update `components/TopNav.tsx`.

Current primary nav includes:

```text
AI Atlas
Query
Understand
Assess
Demonstrate
Leadership
```

Target nav:

```text
Query
Understand
Assess
Demonstrate
Monitor
Investor Tools
```

Investor Tools should be visually separated where possible. If layout is tight, keep it in the nav but style it slightly differently, for example with a subdued gold accent.

### 3. Retain Atlas

Do not delete `/atlas`.

Add clear access to Atlas from Understand, either:

- a prominent "Open AI Ecosystem Navigator" button
- a card in Understand
- a tab within Understand

### 4. Retain Leadership Matrix

Do not delete `/quadrant`.

Move it into Understand as:

```text
Leadership Matrix
```

or:

```text
Vendor Leadership Matrix
```

### 5. Add Monitor Route

Create:

```text
app/monitor/page.tsx
```

Use existing data from:

- watchlists
- risk alerts
- news items
- vendor momentum
- provenance

The first version may be static/derived from existing repositories.

### 6. Add Investor Tools Route

Create or expose:

```text
app/investor-tools/page.tsx
```

Use existing ranking, market share, momentum, Atlas and exposure map foundations.

## UX Requirements

- Keep app simple.
- Do not make users think in terms of internal modules.
- Every nav item must answer a clear executive question.
- Do not overload the top nav.
- Preserve dark-first premium design.

## Acceptance Criteria

- `/` routes to `/query`.
- Top nav matches target structure.
- `/atlas` still works.
- `/quadrant` still works.
- `/monitor` loads.
- `/investor-tools` loads.
- No existing pages are broken.
- Build passes.
