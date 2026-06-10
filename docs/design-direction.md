# Design Direction — "Evidence Instrument" (10 June 2026)

The brief: slicker, highly sophisticated, modern — without losing the app's
real differentiator, which is visible honesty about data provenance.

**Thesis.** AI Enterprise should feel like a precision instrument for
evidence, not a dashboard product. Every design decision flows from that:
the interface's signature is that *truth-state is always visible*.

**Tokens (navy / gold / cream rebrand, 10 June 2026).**
- Ink `#13294b` (`#0f2240` display) · Paper `#faf6ec` page / `#fffdf7` panel ·
  Night `#071827` page / `#0c2238` panel / `#081c30` recessed · Hairline
  `#e3d9c0` light / `#1d3a57` dark · Muted ink `#3f5068` (light) / `#a7bacd`
  (dark) — never lower-contrast than these for body-size text · Gold
  `#b08d2f` base, `#d4af37` bright, `#e8c95c` on-dark — THE accent: masthead
  rules, active states, key numerals, layer-band titles · Emerald/rose/amber
  reserved for data semantics (positive / risk / caution) only.
- The TopNav masthead is brand navy `#0a1f38` in BOTH themes; active tab =
  gold underline. Role/category colour appears only in charts (scatter
  fills, dots) — table chips are neutral outline + colour dot.
- Type: **Cormorant Garamond (`--font-cormorant`, `.font-display`) for page
  mastheads only**; sans for UI; **mono for every numeral**; 10–11px
  uppercase wide-tracked micro-labels for structure (gold for kickers,
  muted ink for panel titles). Numerals are the protagonist; labels whisper.
- Notices/banners: no tinted boxes — quiet `border-l-2` gold-rule notes.

**Signature element: TrendSpark** (`components/trend-spark.tsx`).
A quiet 64×20 sparkline that on hover/focus raises a card showing window,
start → end, delta — and the series' *provenance* (captured snapshots vs
reconstructed). Honesty as micro-interaction. Use beside scores wherever a
history exists; never render below two real points.

**Density rule: collapsed ≠ empty.** `CollapsiblePanel` carries one derived
stat in its collapsed summary, so a closed section still informs. Primary
question of the tab stays open; reference material collapses.

**Navigation: lifecycle + library.** Five lifecycle tabs are the product;
reference surfaces live under the Library menu. Nothing renders as a
cross-category rank or quadrant.

**Next passes for Claude Code** (in priority order): apply CollapsiblePanel
treatment to Demonstrate's lower sections; per-cell derivation tooltips on
score tables (reuse TrendSpark's card pattern); sticky in-page section nav
on the two longest tabs; motion pass — 150ms ease transitions only, respect
prefers-reduced-motion (TrendSpark and Library menu already comply).
