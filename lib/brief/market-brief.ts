// The Brief — a market-wide "since you last looked" digest of REAL dated signals.
// ──────────────────────────────────────────────────────────────────────────────
// The daily-return lever: what's actually moved in the enterprise-AI market that
// a returning reader hasn't seen. Aggregates ONLY real, dated, cited events from
// readers that already gate their own honesty:
//   • NEWS      — getBreakingNews(), strictly re-filtered to the window here so a
//                 stale fallback item can never be mis-dated as "this week".
//   • NEW MODELS— getLiveModelInventory(), a model's real per-model release date.
//   • HORIZON   — legislative instruments by their real inForceDate (a compliance
//                 event), NEVER their asOf (our re-verify date) — so nothing reads
//                 as "changed this week" that merely got re-checked.
//
// HARD RULE: every item carries a real date + a real source. No fabricated
// movement, no estimate, no seed. An empty window renders an honest empty state
// upstream — never a filler item. Pure reads; writes nothing; no LLM.
//
// "Since you last looked": the content window is a fixed 7 days (so the brief is
// never empty on a quick re-visit), and the visitor's last-visit timestamp (a
// cookie, passed in as `since`) only drives the "N new since you last looked"
// highlight — it never hides older-but-still-recent items.

import { getBreakingNews } from "@/lib/intelligence/repository";
import { getLiveModelInventory } from "@/lib/model-inventory/live";
import { LEGISLATIVE_INSTRUMENTS, JURISDICTION_LABEL } from "@/lib/legislative/instruments";

export interface BriefItem {
  kind: "news" | "model";
  title: string;
  /** ISO date of the real event (news publish date / model release date). */
  date: string;
  href: string;
  /** href points at an external cited source (open in a new tab). */
  external: boolean;
  sourceLabel: string;
  /** Published after the visitor's last look — drives the "new" highlight. */
  isNew: boolean;
}

export interface HorizonItem {
  shortName: string;
  name: string;
  inForceDate: string;
  jurisdictionLabel: string;
  sourceUrl: string;
  /** in-force date is still in the future (vs already in force). */
  upcoming: boolean;
}

export interface MarketBrief {
  items: BriefItem[];
  horizon: HorizonItem[];
  windowDays: number;
  /** "since your last visit" | "in the last 7 days" — honest to what we know. */
  sinceLabel: string;
  /** # of items newer than the visitor's last look. */
  newCount: number;
  /** true when we had a real, past last-visit anchor ≥1 day ago. */
  personalised: boolean;
}

const DAY = 86_400_000;
const WINDOW_DAYS = 7;
const MAX_ITEMS = 10;

export async function getMarketBrief({
  since,
  now = new Date(),
}: {
  since: Date | null;
  now?: Date;
}): Promise<MarketBrief> {
  const nowMs = now.getTime();
  const windowStart = nowMs - WINDOW_DAYS * DAY;
  // A real, sane, past last-visit anchor (ignore future/garbage cookie values).
  const sinceMs = since && !Number.isNaN(since.getTime()) && since.getTime() < nowMs ? since.getTime() : null;

  const [news, inv] = await Promise.all([
    getBreakingNews({ days: WINDOW_DAYS, limit: 12 }).catch(() => null),
    getLiveModelInventory(now).catch(() => null),
  ]);

  const items: BriefItem[] = [];

  // NEWS — strictly within the window; a cited source URL is mandatory.
  for (const n of news?.items ?? []) {
    const t = Date.parse(n.publishedAt);
    if (Number.isNaN(t) || t < windowStart) continue;
    if (!n.sourceUrl || !n.sourceUrl.startsWith("http")) continue;
    items.push({
      kind: "news",
      title: n.title,
      date: n.publishedAt,
      href: n.sourceUrl,
      external: true,
      sourceLabel: n.sourceName || "source",
      isNew: sinceMs != null && t > sinceMs,
    });
  }

  // NEW MODELS — real per-model release date within the window.
  for (const m of inv?.models ?? []) {
    if (!m.publishDate) continue;
    const t = Date.parse(m.publishDate);
    if (Number.isNaN(t) || t < windowStart) continue;
    items.push({
      kind: "model",
      title: `${m.vendorName} — ${m.modelName}`,
      date: m.publishDate,
      href: "/models",
      external: false,
      sourceLabel: "Artificial Analysis",
      isNew: sinceMs != null && t > sinceMs,
    });
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const capped = items.slice(0, MAX_ITEMS);
  const newCount = capped.filter((i) => i.isNew).length;

  // REGULATORY HORIZON — real in-force dates near now (past 45d … next 270d),
  // soonest first. inForceDate is a real compliance event (not asOf).
  const horizon: HorizonItem[] = LEGISLATIVE_INSTRUMENTS.filter((i) => {
    if (!i.inForceDate) return false;
    const t = Date.parse(i.inForceDate);
    return !Number.isNaN(t) && t >= nowMs - 45 * DAY && t <= nowMs + 270 * DAY;
  })
    .sort((a, b) => (a.inForceDate! < b.inForceDate! ? -1 : 1))
    .slice(0, 3)
    .map((i) => ({
      shortName: i.shortName,
      name: i.name,
      inForceDate: i.inForceDate!,
      jurisdictionLabel: JURISDICTION_LABEL[i.jurisdiction] ?? i.jurisdiction,
      sourceUrl: i.citation.url,
      upcoming: Date.parse(i.inForceDate!) > nowMs,
    }));

  const personalised = sinceMs != null && nowMs - sinceMs >= DAY;

  return {
    items: capped,
    horizon,
    windowDays: WINDOW_DAYS,
    sinceLabel: personalised ? "since your last visit" : `in the last ${WINDOW_DAYS} days`,
    newCount,
    personalised,
  };
}
