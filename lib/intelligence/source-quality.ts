// News source-quality gate.
// ──────────────────────────
// "Source-cited" is our core credibility claim, so a breaking-news item must not
// cite a DATA VENDOR (Zoominfo, Flexera, Crunchbase-as-news, PitchBook, …) as its
// news source — those are sales/firmographic databases, not publications, and an
// acquisition rumour "sourced" from one undermines the whole feed. We SUPPRESS
// such items rather than substitute a better source (which would be fabrication).

const DATA_VENDOR_TOKENS = [
  "zoominfo",
  "flexera",
  "crunchbase",
  "pitchbook",
  "owler",
  "tracxn",
  "apollo.io",
  "clearbit",
  "6sense",
  "similarweb",
  "datanyze",
  "lusha",
  "leadiq",
  "rocketreach",
];

/** True when the source is a data/firmographic vendor used AS a news source —
 *  i.e. not a credible publication or company press/IR. Case-insensitive,
 *  substring match so "ZoomInfo Technologies" / "Flexera Software" are caught. */
export function isDataVendorSource(sourceName?: string | null): boolean {
  if (!sourceName) return false;
  const s = sourceName.toLowerCase();
  return DATA_VENDOR_TOKENS.some((t) => s.includes(t));
}
