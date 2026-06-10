# Design Direction — "Evidence Instrument" (10 June 2026)

The brief: slicker, highly sophisticated, modern — without losing the app's
real differentiator, which is visible honesty about data provenance.

**Thesis.** AI Enterprise should feel like a precision instrument for
evidence, not a dashboard product. Every design decision flows from that:
the interface's signature is that *truth-state is always visible*.

**Tokens (existing, now codified).**
- Ink `#18201b` · Paper `#ffffff` / Night `#0c1220–#071827` · Hairline
  `#dfe4da` / `zinc-800` · Moss-muted `#697362` · Emerald `#059669/#6EE7B7`
  (positive/identity) · Rose `#dc2626` (risk) · Gold `#F5C451` (confidential
  / investor surfaces only).
- Type: current sans for UI; **mono for every numeral** (already a motif —
  enforce everywhere); 10px uppercase wide-tracked micro-labels for
  structure. Numerals are the protagonist; labels whisper.

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
