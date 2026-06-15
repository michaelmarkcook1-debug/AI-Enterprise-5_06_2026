# Redesign spec — port the AR-Superhero design language (SHELVED, revisit later)

> Status: **shelved 2026-06-15** at the owner's request ("functional first, redesign last").
> This captures the extracted target design system + the current-app audit so the
> redesign can be executed later without re-researching. Reference app lives at
> `/Users/michaelcook/Documents/Dev Projects/ar-superhero` (also the Perplexity
> "AnalystGenius AR superhero MVP" link the owner shared).

## Target look (AR-Superhero) — exact tokens

**Aesthetic:** dark-first "premium intelligence dashboard." Cool near-black canvas,
**neon-emerald primary**, **amber/gold accent**, rose destructive. A second cinematic
navy/gold/teal hero variant exists for landing/mission surfaces.

### Palette (dashboard, HSL `H S% L%` used as `hsl(var(--x))`)
Source: `ar-superhero/client/src/index.css:81-145`
- `--background` dark `220 18% 6%` (cool near-black) / light `40 12% 96%`
- `--foreground` dark `40 8% 92%` (warm off-white)
- `--card` dark `220 16% 9%`; `--card-border` dark `220 12% 15%`
- `--primary` **`158 70% 52%`** (neon emerald) — used sparingly: active states, good-status, CTAs
- `--accent` **`35 90% 58%`** (amber/gold)
- `--destructive` `350 75% 58%` (rose); `--muted-foreground` `220 8% 60%`
- `--sidebar` `220 20% 7%`, `--sidebar-border` `220 14% 14%`
- chart palette: green/amber/blue/violet/teal (`index.css:123-127`)

### Cinematic brand hexes (hero/landing)
- Gold (signature) `#a88945` / `#d5b46b` / `#e9d39c`
- Teal `#00a7b7` / `#63d7de`
- Navy bg `#030812` / `#06101e`; cream light `#f4f1ea`

### Typography
- Sans/display/body: **General Sans** (Fontshare) 400/500/600/700; `letter-spacing:-0.005em` body, `-0.02em` headings
- Mono/data: **JetBrains Mono** — all metrics/percent/dates use `tabular-nums` (`.tabular`)
- Eyebrow/overline idiom: ~10.5px, `letter-spacing 0.14em`, uppercase, weight 500, muted

### Radii / shadows / spacing
- Cards `rounded-xl` (12px); buttons/chips `rounded-md` (6px); pills `rounded-full`
- Tailwind radii overridden crisper: lg 9px / md 6px / sm 3px (`tailwind.config.ts:8-12`)
- Shadows restrained (cards `shadow-sm`; depth from borders + elevate overlay)
- Page container `px-5 lg:px-8 py-6 lg:py-8 max-w-[1480px]`; section `space-y-8`; sidebar `w-[244px]`; top bar `h-14`

### Signature moves (what makes it feel premium)
1. Neon-emerald primary on cool near-black, amber/gold as the only secondary accent; primary used sparingly + a `.glow-primary` ring on active nav.
2. **Tinted-ghost everything**: `bg-{color}/10` + `border-{color}/25-35` + solid `text-{color}` (buttons, chips, callout cards, toggles). Almost nothing is a solid fill.
3. **`hover-elevate` overlay system** (`index.css:333-385`): hover/active = a translucent `::after` wash (`--elevate-1 rgba(255,255,255,.035)`, `--elevate-2 .075`) at `inset:-1px`, NOT a colour swap. On every interactive element.
4. Tiny uppercase wide-tracked eyebrow → tight General-Sans heading → JetBrains-Mono tabular number (consistent label→headline→data rhythm).
5. Layered atmospheric backgrounds gated by `prefers-reduced-motion`: blueprint `.bg-grid` (32px), gold+teal radial washes, gradient hairlines, slow orbital rings.

### Component patterns (reimplementable)
- **Card**: `rounded-xl border bg-card border-card-border shadow-sm`, `p-5/p-6`; hero card adds absolute `.bg-grid opacity-[0.35]`; callout = `border-{color}/20 bg-{color}/[0.04]`.
- **Sidebar nav** (`AppShell.tsx:73`): `w-[244px] bg-sidebar border-r`; grouped tiny-uppercase headers; link `rounded-md px-2 py-1.5 text-[13px] hover-elevate`; active = `bg-sidebar-accent font-medium` + icon `text-primary`; count badge `text-[10px] tabular bg-muted/60`.
- **Chip** (`atoms.tsx:9`): `rounded-md border px-2 py-0.5 text-[11px] font-medium`; tone→meaning: green=good/approved, amber=at-risk/restricted, red=blocked, muted=neutral.
- **MetricCard**: uppercase `text-[10.5px] tracking-[0.14em]` label → `text-[28px] font-semibold tabular` value → muted hint; 4-up grid.
- **ReadinessBar**: 5 discrete segments `h-2.5 w-[6px] rounded-[2px]` colour-banded (Strong green → Missing rose).
- **Buttons**: CVA, `min-h-9` (not fixed height), tinted-ghost dominant (`border-primary/35 bg-primary/10 text-primary`).
- **Tables**: header `text-[11px] uppercase tracking-[0.12em] muted`, zebra `idx%2 && bg-card/50`, `tabular` numerics.

Key reference files: `ar-superhero/client/src/index.css`, `tailwind.config.ts`,
`components/{AppShell,MissionShell,Logo}.tsx`, `components/ui/{button,card,badge}.tsx`,
`components/atoms.tsx`, `pages/{Landing,CommandCentre}.tsx`.

## Current-app audit (AI Enterprise) — what to change

- **Tokens** live in `app/globals.css:9-29` (cream `--background:#faf6ec`, navy `--foreground:#13294b`, gold `#b08d2f/#d4af37`, dark `#071827`) + ~130 hardcoded `text-[#...]` arbitrary values across ~24 files. Theme defaults to **dark** (`lib/theme.ts:5`), which is why missing `dark:` variants show as contrast bugs.
- Shared primitives: `components/app-shell.tsx` (PageFrame — gold kicker + serif title), `components/intelligence-ui.tsx` (Panel `bg-[#fffdf7] dark:bg-[#0c2238]`, EvidenceBadge, ScoreBar), `components/TopNav.tsx` (navy bar, gold active underline), `components/collapsible-panel.tsx` (native `<details>` — building block for side menus).
- **Worst dark-contrast offenders** (fix in redesign): `app/investor-tools/signals/MarketSignalsClient.tsx` (31 instances, no PageFrame, raw `CATEGORY_COLORS` hexes), `app/investing/provider/[slug]/page.tsx` (16), `components/query/ExecutiveBrief.tsx` (12), then news/ipo-watch/public/watchlists/vendors/monitor/briefings.
- **Re-theme approach when revisited:** change the CSS variables in `globals.css` once to the AR-Superhero values, add `hover-elevate`/`.bg-grid`/`.eyebrow`/`.tabular` utilities + General Sans + JetBrains Mono, update `Panel`/`PageFrame`/`TopNav`/atoms to the tinted-ghost + eyebrow + mono-numeral patterns, then replace the ~130 hardcoded hexes with the tokens. Consider dark-only to kill the cream + a class of contrast bugs.

## Functional work done alongside (NOT shelved — see git history around 2026-06-15)
- News colour bug, shared semantic-colour module + colour-coding, collapsible
  data-source side menus, assessment v1.3 outputs → board-pack/Monitor/Demonstrate.
