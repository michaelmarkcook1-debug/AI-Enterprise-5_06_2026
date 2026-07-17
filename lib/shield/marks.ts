// Shared render vocabulary for Shield marks — one definition, two surfaces.
// ─────────────────────────────────────────────────────────────────────────────
// The standalone Trust Rank (/shield) and the shortlist panel both draw these.
// They live here so a glyph or a tone can never mean one thing on one screen and
// something else on another — a ✗ on the ledger and a ✗ in a board pack have to
// be the same claim.
//
// The GLYPH is the primary channel; colour only reinforces it. That ordering is
// deliberate: it survives colour-blindness and the greyscale printer a board
// pack eventually meets.

import type { MarkState } from "./data";

export const MARK_GLYPH: Record<MarkState, string> = {
  protective: "✓",
  conditional: "◐",
  adverse: "✗",
  unverified: "—",
};

export const MARK_TONE: Record<MarkState, string> = {
  protective: "border-[#3f9d76]/50 text-[#2f8f66] dark:text-[#3f9d76]",
  conditional: "border-[#d4af37]/50 text-[#b08d2f] dark:text-[#d4af37]",
  adverse: "border-[#c2410c]/40 text-[#c2410c] dark:border-[#ea7317]/40 dark:text-[#ea7317]",
  unverified: "border-black/12 text-[#123d2c]/40 dark:border-white/12 dark:text-[#eef3f8]/35",
};

/** Plain-English state, for tooltips and for export where colour is lost. */
export const MARK_MEANING: Record<MarkState, string> = {
  protective: "Protective — verified in the vendor's own words",
  conditional: "Conditional — protection exists but is gated (approval, tier, or mitigations)",
  adverse: "Adverse — a verified fact that works against you",
  unverified: "No receipt yet — a gap in our checking, not a verdict on the vendor",
};
