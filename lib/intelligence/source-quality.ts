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
// URL signal is retail-section paths ONLY ("/deals/", "/coupons/", "?affiliate").
// NOT a bare "-deal" token — real M&A / cloud / power / funding "deal" stories
// (e.g. ".../microsoft-chevron-power-deal") legitimately use it and must not drop.
const ADVERTORIAL_URL = /\/(deals?|coupons?|promo)(\/|$)|[?&]affiliate/i;

/** True when the item reads as a retail/affiliate deal advertorial rather than
 *  vendor news — matched on title phrasing OR a deal/coupon URL path. */
export function isAdvertorialNews(title?: string | null, sourceUrl?: string | null): boolean {
  if (title && ADVERTORIAL_TITLE.test(title)) return true;
  if (sourceUrl && ADVERTORIAL_URL.test(sourceUrl)) return true;
  return false;
}

// ── Non-news doc/marketing/policy FRAGMENT detector ─────────────────────────
// The sourcing pipeline scrapes vendor docs / API changelogs / marketing / policy
// pages and emits each PARAGRAPH as a "news" item ("Databricks: Ship agentic apps
// at scale.", "OpenAI: Prices per 1M tokens.", a Harvey ToS sentence). ~27% of the
// feed. This detector removes them. Design (adversarially validated against the
// live DB, 0 real-headline false positives): a PRESS/NEWSROOM host overrides the
// soft title heuristics — only unambiguous machine output (pillar-update /
// snake_case keys) can drop a press row. On non-press hosts, "Vendor:" prefixes,
// ellipsis-truncated body copy and full declarative sentences are dropped.

// Real publications + vendor newsrooms. Match here ⇒ soft title tells never drop.
const PRESS_HOSTS = [
  "techcrunch.com", "siliconangle.com", "bloomberg.com", "cnbc.com", "theverge.com",
  "wired.com", "reuters.com", "venturebeat.com", "arstechnica.com", "fortune.com",
  "axios.com", "infoworld.com", "technologyreview.com", "betakit.com", "spectrum.ieee.org",
  "businesswire.com", "prnewswire.com", "nvidianews.nvidia.com", "newsroom.ibm.com",
  "newsroom.servicenow.com", "deepmind.google", "ai.meta.com", "metr.org", "releasebot.io",
  "time.com", "nikkei.com", "asia.nikkei.com",
];
// Machine-junk title tells — unambiguous pipeline output, dropped on ANY host.
const PILLAR_UPDATE = /update\s+[—-]\s+(openai|anthropic|google|microsoft|aws|amazon|databricks|oracle|mistral|cohere|meta|nvidia|perplexity|ibm|snowflake|writer|salesforce|servicenow|glean|moveworks|hebbia|lambda|nscale|xai|z\.ai)\s*$/i;
const SNAKE_KEY = /^[a-z0-9]+(_[a-z0-9]+)+(\s|$)/;
// Soft fragment tells — dropped ONLY on a non-press / non-newsroom host.
const VENDOR_COLON = /^(OpenAI|Anthropic|Google|Databricks|Oracle|AWS|Amazon|Microsoft|Meta|Harvey|Hebbia|Writer|Cohere|Mistral|Perplexity|Salesforce|ServiceNow|Snowflake|IBM|Moveworks|Glean|Z\.ai|Alibaba|NVIDIA|Lambda|Nscale):\s/;
const ELLIPSIS_END = /(\.\.\.|…)\s*$/;
const SENTENCE_END = /[a-z,]\.\s*$/;

function newsHost(url?: string | null): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
function isPressHost(host: string): boolean {
  return PRESS_HOSTS.some((h) => host === h || host.endsWith("." + h));
}
function isNewsroomUrl(host: string, url?: string | null): boolean {
  let path = "";
  try { path = new URL(url ?? "").pathname.toLowerCase(); } catch { return false; }
  if (path.includes("/news/") || path.endsWith("/news")) return true;
  if ((host === "openai.com" || host.endsWith(".openai.com")) && path.startsWith("/news")) return true;
  if ((host === "anthropic.com" || host.endsWith(".anthropic.com")) && path.startsWith("/news")) return true;
  return false;
}

/** True when a news row is a machine-scraped doc/marketing/policy FRAGMENT, not a
 *  real news event. Press/newsroom hosts are protected from the soft heuristics. */
export function isNonNewsFragment(item: { title?: string | null; sourceUrl?: string | null }): boolean {
  const title = (item.title ?? "").trim();
  if (!title) return false;
  // Unambiguous machine output — drop regardless of host.
  if (PILLAR_UPDATE.test(title) || SNAKE_KEY.test(title)) return true;
  const host = newsHost(item.sourceUrl);
  if (isPressHost(host) || isNewsroomUrl(host, item.sourceUrl)) return false;
  if (/^(status|trust)\./i.test(host)) return true;
  return VENDOR_COLON.test(title) || ELLIPSIS_END.test(title) || SENTENCE_END.test(title);
}

/** Combined DISPLAY-suppression gate for the public news feed: hide items we
 *  cannot honestly present as vendor competitive-intel — data-vendor "sources",
 *  commerce advertorials, and machine-scraped doc/marketing fragments.
 *  Suppression only (never substitutes a source). */
export function isSuppressedNewsItem(item: {
  sourceName?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
}): boolean {
  return (
    isDataVendorSource(item.sourceName) ||
    isAdvertorialNews(item.title, item.sourceUrl) ||
    isNonNewsFragment(item)
  );
}
