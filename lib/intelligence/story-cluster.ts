// Story-level clustering for the news feed.
// ───────────────────────────────────────────────────────────────────────────
// WHY: the ingest dedup key is sha1(vendorId | sourceUrl | publishedDay), which
// is URL-level idempotency, not story-level. One event covered by two
// publishers yields two rows — e.g. Latent.Space "[AINews] Claude Opus 5:
// Fable-level performance at Opus price" and Bloomberg "Anthropic launches
// Claude Opus 5 model at half the price of Fable 5" are the same launch. The
// reader sees the same story two or three times.
//
// This clusters at READ time. Nothing is deleted and no citation is lost: each
// cluster keeps every member, so the UI can show one headline with "+2 more
// sources" and still link all of them. Ingestion, the DB, and provenance are
// untouched.
//
// CONSERVATIVE BY DESIGN: merging two genuinely different stories is a worse
// failure than showing a duplicate — it would hide a real event. So every
// signal must agree (shared vendor, tight date window, high title overlap, and
// ≥2 distinctive shared tokens) before two items merge. When in doubt they stay
// separate. This is under-clustering on purpose.

export interface ClusterableNews {
  id: string;
  title: string;
  publishedAt: string;
  vendors: string[];
  sourceName: string;
  sourceUrl?: string;
}

export interface NewsCluster<T extends ClusterableNews> {
  /** The item to display. */
  lead: T;
  /** Same-event reports from other outlets — kept in full, never discarded. */
  duplicates: T[];
  /** Distinct publishers across the whole cluster, lead first. */
  sources: { name: string; url?: string }[];
}

const DAY = 86_400_000;

// Function words + newsroom filler that carry no subject signal.
const STOP = new Set([
  "a", "an", "the", "at", "of", "to", "in", "on", "for", "with", "and", "or", "its", "it",
  "is", "are", "as", "by", "from", "that", "this", "these", "those", "be", "been", "was",
  "were", "will", "has", "have", "had", "says", "said", "after", "over", "amid", "into",
  "up", "down", "out", "than", "then", "but", "not", "no", "how", "why", "what", "who",
  "report", "reports", "reportedly", "exclusive", "update", "updated", "breaking",
]);

/** Strip outlet tags ("[AINews]"), trailing " — Publisher", punctuation, case. */
export function normaliseTitle(title: string): string {
  return title
    .replace(/^\s*[[(][^\])]{1,24}[\])]\s*/, "") // leading [AINews] / (Exclusive)
    .replace(/\s+[|–—-]\s+[^|–—-]{2,40}$/, "") // trailing " — Publisher"
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(title: string): string[] {
  return normaliseTitle(title)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Tokens specific enough to anchor a match — long words, or figures like "5"/"205". */
function distinctive(set: Set<string>): Set<string> {
  return new Set([...set].filter((t) => t.length >= 4 || /^\d+$/.test(t)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

interface Prepared<T> {
  item: T;
  tokenSet: Set<string>;
  distinct: Set<string>;
  time: number;
  vendors: Set<string>;
  bracketed: boolean;
}

function prepare<T extends ClusterableNews>(item: T): Prepared<T> {
  const set = new Set(tokens(item.title));
  const t = Date.parse(item.publishedAt);
  return {
    item,
    tokenSet: set,
    distinct: distinctive(set),
    time: Number.isNaN(t) ? 0 : t,
    vendors: new Set(item.vendors ?? []),
    bracketed: /^\s*[[(]/.test(item.title),
  };
}

export interface ClusterOptions {
  /** Max gap between two reports of the same event. Default 3 days. */
  windowDays?: number;
  /** Title-token Jaccard needed to merge when the vendor is confirmed. Default 0.5. */
  threshold?: number;
}

function sameStory<T extends ClusterableNews>(a: Prepared<T>, b: Prepared<T>, opts: Required<ClusterOptions>): boolean {
  // 1. Same event window.
  if (Math.abs(a.time - b.time) > opts.windowDays * DAY) return false;

  // 2. Subject agreement. Both tagged and sharing no vendor → different subjects.
  //    If either is untagged we can't confirm the subject, so demand a stricter
  //    title match rather than guessing.
  let threshold = opts.threshold;
  if (a.vendors.size > 0 && b.vendors.size > 0) {
    let overlap = false;
    for (const v of a.vendors) if (b.vendors.has(v)) { overlap = true; break; }
    if (!overlap) return false;
  } else {
    threshold = Math.max(threshold, 0.62);
  }

  // 3. Headline overlap.
  if (jaccard(a.tokenSet, b.tokenSet) < threshold) return false;

  // 4. At least two distinctive anchors in common — blocks merges that ride on
  //    generic verbs alone ("launches", "raises").
  let anchors = 0;
  for (const t of a.distinct) if (b.distinct.has(t)) anchors += 1;
  return anchors >= 2;
}

/**
 * Group same-event reports. Input order is preserved for the resulting leads,
 * so an upstream ranking (impact, recency) still drives the feed.
 *
 * Members are compared against the cluster LEAD only, never transitively —
 * chained similarity is how clustering drifts into merging unrelated stories.
 */
export function clusterNewsStories<T extends ClusterableNews>(
  items: T[],
  options: ClusterOptions = {},
): NewsCluster<T>[] {
  const opts: Required<ClusterOptions> = {
    windowDays: options.windowDays ?? 3,
    threshold: options.threshold ?? 0.5,
  };

  const groups: Prepared<T>[][] = [];
  for (const item of items) {
    const p = prepare(item);
    const hit = groups.find((g) => sameStory(g[0], p, opts));
    if (hit) hit.push(p);
    else groups.push([p]);
  }

  return groups.map((g) => {
    // Lead = the clearest headline: prefer one without an outlet tag prefix,
    // then the earliest report (whoever broke it), then a stable id tiebreak.
    const ordered = [...g].sort((x, y) => {
      if (x.bracketed !== y.bracketed) return x.bracketed ? 1 : -1;
      if (x.time !== y.time) return x.time - y.time;
      return x.item.id.localeCompare(y.item.id);
    });
    const lead = ordered[0].item;
    const duplicates = ordered.slice(1).map((p) => p.item);

    const sources: { name: string; url?: string }[] = [];
    const seen = new Set<string>();
    for (const it of [lead, ...duplicates]) {
      const key = (it.sourceName || "").toLowerCase();
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      sources.push({ name: it.sourceName, url: it.sourceUrl });
    }
    return { lead, duplicates, sources };
  });
}
