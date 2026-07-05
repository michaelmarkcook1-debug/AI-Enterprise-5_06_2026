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

// Commerce / affiliate "deal" advertorials. A retailer deal roundup on a site
// that ALSO covers AI (e.g. a ZDNet "…30% off on Amazon" article) can get scraped
// off a generic "latest news" feed, mis-tagged to a vendor, and float on a high
// impact score — but it is NOT vendor competitive-intel. Suppress it. Patterns are
// deliberately narrow so real pricing/funding stories ("cuts API prices 30%",
// "$122B funding round") never match: they key on retail-deal phrasing, not on
// numbers or percentages alone.
const ADVERTORIAL_TITLE =
  /\b(\d+%\s*off|on\s+amazon|prime\s+day|black\s+friday|cyber\s+monday|coupon|promo\s+code|discount\s+code|deal\s+of\s+the\s+day|save\s+\$?\d|\$\d+\s+off)\b/i;
const ADVERTORIAL_URL = /\/(deals?|coupons?|promo)(\/|\b)|-deal\b|[?&]affiliate/i;

/** True when the item reads as a retail/affiliate deal advertorial rather than
 *  vendor news — matched on title phrasing OR a deal/coupon URL path. */
export function isAdvertorialNews(title?: string | null, sourceUrl?: string | null): boolean {
  if (title && ADVERTORIAL_TITLE.test(title)) return true;
  if (sourceUrl && ADVERTORIAL_URL.test(sourceUrl)) return true;
  return false;
}

/** Combined DISPLAY-suppression gate for the public news feed: hide items we
 *  cannot honestly present as vendor competitive-intel — data-vendor "sources"
 *  and commerce advertorials. Suppression only (never substitutes a source). */
export function isSuppressedNewsItem(item: {
  sourceName?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
}): boolean {
  return isDataVendorSource(item.sourceName) || isAdvertorialNews(item.title, item.sourceUrl);
}
