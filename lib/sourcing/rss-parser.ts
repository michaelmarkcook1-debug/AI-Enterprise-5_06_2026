// Minimal RSS 2.0 / Atom feed parser — no external dependencies.
// Handles both formats via regex extraction (DOMParser not available in Node).

export interface RssItem {
  title: string;
  url: string;
  publishedAt: string;   // ISO-8601
  description: string;   // plain-text excerpt (HTML stripped)
  sourceName: string;    // feed-level title
  feedUrl: string;       // which feed this came from
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  // Matches <tag>content</tag> and <tag><![CDATA[content]]></tag>
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>\\s]*(?:\\s+[^>]*?)?\\s${attr}="([^"]*)"`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  try { return new Date(raw).toISOString(); } catch { return new Date().toISOString(); }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

// ── Parsers ────────────────────────────────────────────────────────────────────

function parseRss2(xml: string, feedUrl: string, feedTitle: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    // <link> in RSS2 can be followed immediately by text or CDATA
    const link =
      extractTag(block, "link") ||
      // <guid isPermaLink="true"> fallback
      (/isPermaLink="true"/.test(block) ? extractTag(block, "guid") : "") ||
      extractAttr(block, "enclosure", "url");
    const title = extractTag(block, "title");
    if (!link || !title) continue;
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "dc:date") || extractTag(block, "published");
    const description = extractTag(block, "content:encoded") || extractTag(block, "description");
    items.push({ title, url: link, publishedAt: parseDate(pubDate), description: stripHtml(description), sourceName: feedTitle, feedUrl });
  }
  return items;
}

function parseAtom(xml: string, feedUrl: string, feedTitle: string): RssItem[] {
  const items: RssItem[] = [];
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const link = extractAttr(block, "link", "href") || extractTag(block, "id");
    const title = extractTag(block, "title");
    if (!link || !title) continue;
    const pubDate = extractTag(block, "published") || extractTag(block, "updated");
    const description = extractTag(block, "summary") || extractTag(block, "content");
    items.push({ title, url: link, publishedAt: parseDate(pubDate), description: stripHtml(description), sourceName: feedTitle, feedUrl });
  }
  return items;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function parseRssFeed(xml: string, feedUrl: string): RssItem[] {
  // Feed-level title (first <title> before any <item>/<entry>)
  const feedTitle = extractTag(xml.split(/<item|<entry/i)[0], "title") || new URL(feedUrl).hostname;
  const isAtom = xml.includes("<feed") && xml.includes("<entry");
  return isAtom ? parseAtom(xml, feedUrl, feedTitle) : parseRss2(xml, feedUrl, feedTitle);
}

export async function fetchAndParseRss(
  feedUrl: string,
  signal?: AbortSignal,
): Promise<RssItem[]> {
  const res = await fetch(feedUrl, {
    signal,
    headers: {
      "User-Agent": "AI-Enterprise-NewsBot/1.0",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) throw new Error(`RSS ${res.status} ${feedUrl}`);
  const xml = await res.text();
  return parseRssFeed(xml, feedUrl);
}
