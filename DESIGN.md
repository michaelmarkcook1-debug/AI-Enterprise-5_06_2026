---
name: AI Enterprise
description: Independent, evidence-based rankings of enterprise AI vendors — every score source-cited, every edge on the dependency graph carries its own reference.
colors:
  ink-navy: "#13294b"
  ink-navy-deep: "#0a1f38"
  page-dark: "#071827"
  page-cream: "#faf6ec"
  panel-cream: "#fdfaf1"
  gold: "#d4af37"
  gold-muted: "#b08d2f"
  border-cream: "#e6dcc3"
  border-navy: "#1d3a57"
  muted-blue: "#8fa5bb"
  muted-warm: "#4c5d75"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, \"Times New Roman\", serif"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  wordmark:
    fontFamily: "Plus Jakarta Sans, -apple-system, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Sans, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Sans, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.08em"
  data:
    fontFamily: "Geist Mono, \"SFMono-Regular\", Consolas, monospace"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.page-dark}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  button-primary-hover:
    backgroundColor: "#e8c95c"
  card:
    backgroundColor: "{colors.page-cream}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: AI Enterprise

## 1. Overview

**Creative North Star: "The Ratings Agency"**

AI Enterprise reads like a credit-rating desk for the enterprise-AI market, not a SaaS product marketing itself. Deep institutional navy carries the weight of the page — the same register as a bond prospectus or an analyst's terminal — with a single disciplined gold accent standing in for the seal of authority: the mark that says *verified, source-backed, stand behind it*. The product's own words earn this directly — "Independent · Evidence-Based · Source-Cited" is the literal hero copy, not ad language, and the whole visual system should read as the graphic expression of that sentence. Editorial serif (Cormorant Garamond) is reserved for headlines and hero numerals only, the way a research note sets its thesis statement in a serif and its data tables in a plain grotesque; everything that is UI — labels, buttons, data, navigation — stays in a clean, quiet sans so it never competes with the serif's authority. This system explicitly rejects the SaaS-cream-and-gradient default: no gradient text, no glassmorphism, no hero-metric clichés, no tiny-eyebrow-on-every-section scaffolding. Restraint is the credibility signal. Dark is the resting state, not a "mode" bolted on — the product is designed to be read the way a terminal is read, and light is the accommodation, not the default.

**Key Characteristics:**
- Institutional navy ground, gold reserved for authority signals (CTAs, citations-live badge, the brand mark) — never decoration
- One serif voice for editorial headlines; one sans voice for every interactive and data surface
- Flat by default; shadow appears only where something is genuinely floating above the page (the AI launcher, a modal), never as card decoration
- Semantic color (live/seed/warning) is entirely separate from the gold brand accent — calm green for verified data, restrained rose for anything not yet live, by deliberate design (see the Elevation and Do's/Don'ts sections)

## 2. Colors

A two-color system — institutional navy and credentialed gold — carried by a warm cream ground in light mode and a near-black navy ground in dark mode (the product default).

### Primary
- **Ledger Navy** (`#13294b`): the canonical ink/foreground token (`--foreground` in `globals.css`). This is the source-of-truth navy — see the Ink Navy Rule below for a known drift worth resolving.
- **Deep Navy** (`#0a1f38`): panel and card backgrounds inside dark surfaces (the Ask AI panel, primary nav).
- **Page Navy** (`#071827`): the dark-mode page background — near-black, not pure black, so gold and white text keep a soft glow rather than a harsh punch.

### Secondary
- **Credentialed Gold** (`#d4af37`): the single accent. Primary CTAs ("Get the market read"), the live-launcher's status dot, focus rings, text selection. This is the "seal of authority" color — it marks something as verified or actionable, never decorative.
- **Muted Gold** (`#b08d2f`): the light-mode variant of the same role — gold reads brighter and more saturated against dark navy than it does against warm cream, so the light-mode token is deliberately dialed back to hold the same visual weight.

### Neutral
- **Warm Cream** (`#faf6ec`): the light-mode page background — the product's only concession to a "warm neutral," and it's genuinely warm-toned by brand intent (paired with navy and gold, in the tradition of a formal letterhead), not the AI-default cream-on-nothing.
- **Panel Cream** (`#fdfaf1`): a one-step-lighter tint for panels sitting on the cream ground.
- **Border Cream** (`#e6dcc3`) / **Border Navy** (`#1d3a57`): hairline dividers and card borders, one per mode.
- **Muted Blue** (`#8fa5bb`) / **Muted Warm** (`#4c5d75`): secondary text — captions, timestamps, byline metadata. Dark-mode muted text is the cool blue-gray; light-mode muted text leans warmer, toward the navy.

### Named Rules
**The One Accent Rule.** Gold appears on CTAs, live-status indicators, citations, and the brand mark — never as a decorative fill, a card background, or a section divider. If gold is covering more than a button or a badge, it's being used wrong.

**The Calm Green Rule.** Live, source-backed data is marked with a quiet emerald badge (Tailwind `emerald-500`/`emerald-800`), never gold and never a loud green. "Not yet live" data is marked in a restrained rose (`rose-400`/`rose-900`), not a screaming red. The absence of alarming color anywhere on the page is itself the trust signal — a page that's shouting about its own accuracy reads as less credible, not more.

**The Ink Navy Rule (currently violated, worth fixing).** `globals.css` names `#13294b` as the canonical `--foreground` ink token, but the actual pervasive component value — copy-pasted as a local `MUTED`/text-color constant across 250+ files — is `#15263c`, a visibly different navy. Treat `#13294b` as normative going forward; new components should reference it (or the CSS variable) rather than propagating the drifted value.

## 3. Typography

**Display Font:** Cormorant Garamond (with Georgia, "Times New Roman", serif fallback)
**Wordmark Font:** Plus Jakarta Sans, 700/800 (with system-ui fallback)
**Body/UI Font:** Geist Sans (with Arial, Helvetica fallback)
**Data/Mono Font:** Geist Mono (with SFMono-Regular, Consolas fallback)

**Character:** An editorial serif thesis statement over a quiet, almost invisible sans workhorse. The serif is never used for anything a user needs to scan quickly — it's reserved for the one or two sentences per page meant to be *read*, the way a research note's headline is set apart from its body.

### Hierarchy
- **Display** (Cormorant Garamond, 400, `clamp(1.75rem, 4vw, 2.75rem)`, line-height 1.1): page mastheads and hero statements only — e.g. "Who the enterprise-AI market runs on — and who's coming for them." Never used for UI chrome, labels, or data.
- **Headline** (Geist Sans, 700, `text-xl`–`text-2xl`): section headers within a page (card titles, panel headers).
- **Title** (Geist Sans, 600, `text-sm`–`text-lg`): component-level headings — a card's own title, a table's header row.
- **Body** (Geist Sans, 400, `text-sm`, line-height 1.6): the dominant text size in the product by a wide margin (nearly 600 instances) — descriptions, prose, list content. Caps at 65–75ch on long-form copy.
- **Label** (Geist Sans, 700, `text-[11px]`, uppercase, `tracking-wide`/`tracking-wider`): category tags, status pills, table column headers. `text-xs` (785 instances) is the single most common size in the app — this is a dense, data-forward product and most of what's on screen is metadata, not prose.
- **Data** (Geist Mono, tabular-nums): scores, percentages, dates, Elo/index values — anywhere digits need to line up in a column.

### Named Rules
**The One Serif Rule.** Cormorant Garamond appears once or twice per page, on the single most important sentence. If a page has three or four serif headings competing for attention, none of them read as important — cut it back to one.

## 4. Elevation

Flat by default, tonal layering for most surfaces — real box-shadow is reserved for chrome that is *actually* floating above the page (the Ask AI launcher, its panel, an occasional destructive-confirm modal), not applied decoratively to cards. `shadow-sm` accounts for the large majority of shadow usage in the app; `shadow-lg`/`xl`/`2xl` appear only a couple dozen times total, exactly where something needs to visually detach from the page.

### Shadow Vocabulary
- **Resting** (no shadow): the default for cards and panels. Depth comes from a translucent surface tint (`bg-white/60` light, `bg-white/5` dark) over a hairline border, not a shadow.
- **Subtle** (`shadow-sm`): a light lift for interactive rows and secondary buttons — barely perceptible, a hint rather than a statement.
- **Floating** (`shadow-lg`/`shadow-xl`): reserved for genuinely fixed-position chrome — the Ask AI launcher and its panel, toasts, dropdown menus. This is the visual cue that an element is temporarily suspended above the document, not part of its flow.

### Named Rules
**The Floating-Only Rule.** A strong shadow on an element that scrolls with the page (a card, a table row) is always wrong here — reserve `shadow-lg`+ for `position: fixed`/`sticky` chrome exclusively.

## 5. Components

### Buttons
- **Shape:** fully rounded (`rounded-full`) — the dominant radius in the app at 343 instances, well ahead of any other value.
- **Primary:** solid gold fill (`bg-[#d4af37]` dark-mode / `bg-[#b08d2f]` light-mode), navy text, `px-3.5 py-1.5`, `text-xs font-semibold`. Used for the single highest-priority action per view — "Get the market read," "Ask AI," a form submit.
- **Hover:** a lighter gold shift (`#e8c95c`) — the button gets brighter, not darker, on hover, matching a "warming up" metaphor rather than a "pressing down" one.
- **Secondary/Ghost:** navy or transparent background, gold or navy border at low opacity, used for anything not the page's primary action.

### Cards / Containers
- **Corner style:** `rounded-xl` (12px) — the dominant card radius (108 instances), never larger than `rounded-2xl` (16px) anywhere in the app.
- **Background:** translucent tint over the page color — `bg-white/60` in light mode, `bg-white/5` in dark mode — so cards read as a subtle layer above the page rather than a hard-edged box.
- **Border:** always present, always hairline — `border-black/10` light / `border-white/10` dark.
- **Internal padding:** `p-5` (20px) is the standard; `p-4` for denser, secondary cards.
- **Shadow:** none at rest (see Elevation).

### Status Pills (signature component)
The `SeedDataBadge` pattern is the product's most distinctive component and directly encodes its core promise. A small pill (`rounded` not `rounded-full`, `px-1.5 py-0.5`, `text-[11px] font-bold uppercase`) paired with a 6px dot: emerald + a solid dot for "Live source," restrained rose + a pulsing dot for "Seed estimate." Every data-derived surface in the product should carry one of these, visibly, rather than asserting freshness in prose.

### Navigation
- **Style:** solid deep-navy bar (`bg-[#0a1622]`-ish), the wordmark (Plus Jakarta Sans 800) beside the triangular brand mark, primary links in Geist Sans at `text-sm`, the gold CTA pill at the trailing edge.
- **Mobile:** collapses to a hamburger menu at a bordered icon-button (no visible link list) rather than trying to fit the full nav.

### Floating Chat Launcher (signature component)
`position: fixed`, bottom-right, icon-only at rest (44×44, gold dot on deep navy) so its footprint never meaningfully obscures scrolling content beneath it — expands to a labelled pill only on hover/focus or while its panel is open, when context already makes the control obvious.

## 6. Do's and Don'ts

### Do:
- **Do** reserve gold (`#d4af37`/`#b08d2f`) for CTAs, live-status, citations, and the brand mark — nothing else.
- **Do** use Cormorant Garamond sparingly — one serif statement per page, everything else in Geist Sans.
- **Do** keep cards flat (translucent tint + hairline border, no shadow) and save real shadows for `fixed`/`sticky` chrome only.
- **Do** cap card corners at `rounded-xl` (12px); `rounded-full` is reserved for pills, badges, and buttons.
- **Do** pair every data-derived claim with a visible source citation and, where relevant, a `SeedDataBadge` — this is the product's core credibility mechanism, not a nice-to-have.
- **Do** default new surfaces to dark mode and verify light mode separately — dark is the product's resting state, not an afterthought.

### Don't:
- **Don't** use gradient text (`background-clip: text`), glassmorphism, or the hero-metric-with-gradient-accent SaaS template — none of these appear anywhere in the product today and they should stay out.
- **Don't** add a tiny uppercase eyebrow above every section. One is a brand device (the homepage's "Independent · Evidence-Based · Source-Cited"); on every panel it becomes scaffolding — this has already crept into the admin tooling and shouldn't spread further.
- **Don't** use a side-stripe (`border-l-2`/`border-l-4`) as a decorative accent on cards or callouts — full borders, background tints, or nothing.
- **Don't** pair a 1px border with a wide (16px+) drop shadow on the same element ("ghost card") — pick one.
- **Don't** introduce a third navy value. The app already has an unresolved drift between `#13294b` (the root token) and `#15263c` (the pervasive component value) — new work should consolidate toward `#13294b`, not add a third variant.
- **Don't** let muted/secondary text opacity drop below what clears 4.5:1 against its background in light mode — the light-mode muted-text token was previously under this floor (4.09:1) and was corrected to `/65` opacity; hold that line.
