// Market news ingestion pipeline.
//
// Pulls AI/tech news RSS feeds (see ai-news-manifest.ts), scores each item
// for enterprise relevance with Haiku, tags which tracked vendors are
// mentioned, then upserts high-scoring items to IntelligenceNewsItem.
//
// This complements the vendor-specific competitive-intel monitor:
//   competitive-monitor.ts  → per-vendor web-search, 3-stage Haiku/Sonnet/Opus
//   market-news-runner.ts   → broad AI press RSS, Haiku batch scoring
//
// Both write to IntelligenceNewsItem with idempotent SHA1-keyed upserts.
// Neither touches EvidenceProposal (these are news signals, not vendor evidence).

import Anthropic from "@anthropic-ai/sdk";
import { createHash, randomUUID } from "node:crypto";
import { fetchAndParseRss, type RssItem } from "./rss-parser";
import { AI_NEWS_SOURCES, TRACKED_VENDOR_NAMES } from "./ai-news-manifest";
import { hasLLM } from "../agents/llm-client";
import { hasDatabase, getPrisma } from "../prisma";
import { logEvent } from "./logger";

const HAIKU_MODEL = "claude-haiku-4-5";
// Items must reach this score to be written to IntelligenceNewsItem.
const MIN_IMPACT = 45;
// How many days back to look in each feed (keeps cost bounded).
const LOOKBACK_DAYS = 3;
// Hard cap per run — prevents a very active news day from blowing the budget.
const MAX_ITEMS_TO_SCORE = 40;
// How many RSS items to send in each Haiku batch (fits comfortably in 4096 tokens).
const BATCH_SIZE = 10;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MarketNewsRunResult {
  feedsAttempted: number;
  feedsFetched: number;
  itemsCandidates: number;
  itemsDedupSkipped: number;
  itemsScored: number;
  itemsUpserted: number;
  errors: string[];
  durationMs: number;
}

interface ScoredItem {
  item: RssItem;
  impactScore: number;
  relevantVendorIds: string[];
  categories: string[];
  whyItMatters: string;
  keep: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function marketNewsId(url: string, publishedAt: string): string {
  const h = createHash("sha1").update(`mkt:${url}:${publishedAt}`).digest("hex").slice(0, 16);
  return `mkt_${h}`;
}

function cutoffDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - LOOKBACK_DAYS);
  return d;
}

const NAME_TO_ID = Object.fromEntries(
  Object.entries(TRACKED_VENDOR_NAMES).map(([id, name]) => [name.toLowerCase(), id]),
);

// ── Haiku batch scoring ────────────────────────────────────────────────────────

async function scoreBatch(items: RssItem[], client: Anthropic): Promise<ScoredItem[]> {
  const vendorList = Object.values(TRACKED_VENDOR_NAMES).join(", ");
  const prompt = `You are an enterprise AI industry analyst. Score each article for enterprise relevance.

Tracked vendors: ${vendorList}

For each article return a JSON object (one per article, same order):
- impactScore: integer 0-100 (significance for enterprise AI buyers/analysts)
- relevantVendors: string[] (only names from the tracked list explicitly mentioned or clearly implied)
- categories: string[] (one or more: product_launch | pricing_change | partnership | key_hire | funding_round | regulatory | press_coverage)
- whyItMatters: string (max 240 chars — the SO-WHAT for an enterprise AI buyer or competitive analyst)
- keep: boolean (false if article is off-topic, consumer-focused, or irrelevant to enterprise AI)

Return a JSON array only — no markdown fences.

Articles:
${items.map((it, i) => `[${i}] "${it.title}"\nSource: ${it.sourceName}\nExcerpt: ${it.description.slice(0, 200)}`).join("\n\n")}`;

  try {
    const msg = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
    const parsed = JSON.parse(clean) as Array<{
      impactScore?: number;
      relevantVendors?: string[];
      categories?: string[];
      whyItMatters?: string;
      keep?: boolean;
    }>;

    return items.map((item, i) => {
      const r = parsed[i] ?? {};
      return {
        item,
        impactScore: Math.min(100, Math.max(0, Number(r.impactScore ?? 0))),
        relevantVendorIds: (r.relevantVendors ?? [])
          .map((n) => NAME_TO_ID[n.toLowerCase()])
          .filter((id): id is string => Boolean(id)),
        categories: r.categories?.length ? r.categories : ["press_coverage"],
        whyItMatters: (r.whyItMatters ?? "").slice(0, 360),
        keep: r.keep !== false,
      };
    });
  } catch (err) {
    console.error("[market-news-runner] Haiku batch failed", err);
    // On failure mark all as don't-keep to avoid persisting unscored items
    return items.map((item) => ({
      item, impactScore: 0, relevantVendorIds: [], categories: ["press_coverage"],
      whyItMatters: "", keep: false,
    }));
  }
}

// ── Main entry point ───────────────────────────────────────────────────────────

export async function runMarketNewsIngestion(): Promise<MarketNewsRunResult> {
  const start = Date.now();
  const errors: string[] = [];
  let feedsFetched = 0;
  const runId = `mktrun_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

  await logEvent({
    ts: new Date().toISOString(),
    runId,
    event: "market_news.run.start",
    data: { feeds: AI_NEWS_SOURCES.length, lookbackDays: LOOKBACK_DAYS },
  });

  // 1. Fetch all feeds in parallel, filter to lookback window
  const cutoff = cutoffDate();
  const rawFetches = await Promise.allSettled(
    AI_NEWS_SOURCES.map((src) =>
      fetchAndParseRss(src.feedUrl).then((items) => ({ src, items })),
    ),
  );

  const allItems: RssItem[] = [];
  for (const r of rawFetches) {
    if (r.status === "fulfilled") {
      feedsFetched++;
      const fresh = r.value.items.filter((it) => new Date(it.publishedAt) >= cutoff);
      allItems.push(...fresh);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push(`feed: ${msg}`);
    }
  }

  // 2. Dedup across feeds by URL (keep first seen, newest-publish wins when re-sorted)
  const byUrl = new Map<string, RssItem>();
  const sorted = [...allItems].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  for (const item of sorted) {
    if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  }
  const deduped = [...byUrl.values()].slice(0, MAX_ITEMS_TO_SCORE);

  // 3. Skip URLs already in IntelligenceNewsItem
  let toScore = deduped;
  let dedupSkipped = 0;
  if (hasDatabase()) {
    const prisma = getPrisma();
    const existing = await prisma.intelligenceNewsItem.findMany({
      where: { sourceUrl: { in: deduped.map((i) => i.url) } },
      select: { sourceUrl: true },
    });
    const knownUrls = new Set(
      (existing as { sourceUrl: string | null }[])
        .map((e) => e.sourceUrl)
        .filter((u): u is string => Boolean(u)),
    );
    const fresh = deduped.filter((i) => !knownUrls.has(i.url));
    dedupSkipped = deduped.length - fresh.length;
    toScore = fresh;
  }

  if (toScore.length === 0 || !hasLLM()) {
    return {
      feedsAttempted: AI_NEWS_SOURCES.length, feedsFetched,
      itemsCandidates: allItems.length, itemsDedupSkipped: dedupSkipped,
      itemsScored: 0, itemsUpserted: 0, errors,
      durationMs: Date.now() - start,
    };
  }

  // 4. Score in batches with Haiku
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const scored: ScoredItem[] = [];
  for (let i = 0; i < toScore.length; i += BATCH_SIZE) {
    const batch = toScore.slice(i, i + BATCH_SIZE);
    const results = await scoreBatch(batch, anthropic);
    scored.push(...results);
  }

  const relevant = scored.filter((s) => s.keep && s.impactScore >= MIN_IMPACT);

  // 5. Upsert to IntelligenceNewsItem
  let upserted = 0;
  if (hasDatabase() && relevant.length > 0) {
    const prisma = getPrisma();
    for (const s of relevant) {
      try {
        const id = marketNewsId(s.item.url, s.item.publishedAt);
        await prisma.intelligenceNewsItem.upsert({
          where: { id },
          create: {
            id,
            title: s.item.title.slice(0, 500),
            summary: s.item.description.slice(0, 1000),
            sourceName: s.item.sourceName,
            sourceUrl: s.item.url,
            publishedAt: new Date(s.item.publishedAt),
            vendors: s.relevantVendorIds,
            categories: s.categories,
            impactScore: s.impactScore,
            confidenceScore: 65,
            whyItMatters: s.whyItMatters,
            affectedPillars: [],
            suggestedScoreImpact: [],
            relatedVendors: [],
            sentiment: "neutral",
          },
          update: {
            impactScore: s.impactScore,
            whyItMatters: s.whyItMatters,
            categories: s.categories,
            vendors: s.relevantVendorIds,
          },
        });
        upserted++;
      } catch (err) {
        errors.push(`upsert: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await logEvent({
    ts: new Date().toISOString(),
    runId,
    event: "market_news.run.summary",
    data: { feedsFetched, candidates: allItems.length, dedupSkipped, scored: scored.length, relevant: relevant.length, upserted },
  });

  return {
    feedsAttempted: AI_NEWS_SOURCES.length,
    feedsFetched,
    itemsCandidates: allItems.length,
    itemsDedupSkipped: dedupSkipped,
    itemsScored: scored.length,
    itemsUpserted: upserted,
    errors,
    durationMs: Date.now() - start,
  };
}
