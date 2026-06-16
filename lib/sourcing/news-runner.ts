// Vendor news / press-release sourcing pipeline.
//
// This pipeline extends the standard ingestion runner with a pre-filter stage
// specific to news listing pages:
//
//   Stage 0a  Fetch the vendor's news listing page.
//   Stage 0b  Haiku discovers individual article URLs and scores each for
//             relevance (≥ 60) and importance (≥ 40). Articles below the
//             threshold are discarded HERE — before fetching or LLM cost.
//   Stage 0c  Dedup: query EvidenceProposal.sourceUrl to skip articles
//             already ingested in a previous run.
//   Stage 1   Fetch each fresh article's full content.
//   Stage 2   Haiku extracts evidence proposals.
//   Stage 3   Haiku classifies each proposal (same as standard pipeline).
//   Stage 4   Persist proposals with the article URL as sourceUrl.
//
// Only press_release entries in the SOURCE_MANIFEST are processed.

import { randomUUID } from "node:crypto";
import { fetchSource } from "../ingestion/fetcher";
import { extractEvidence } from "../agents/evidence-extractor";
import { classifyEvidence } from "../agents/evidence-classifier";
import { hasLLM } from "../agents/llm-client";
import { hasDatabase, getPrisma } from "../prisma";
import { logEvent } from "./logger";
import { SOURCE_MANIFEST } from "./manifest";
import { categoriseClassifyFailure } from "./runner";
import { discoverNewsArticles, type DiscoveredArticle } from "../agents/news-discoverer";
import { fetchAndParseRss } from "./rss-parser";

// Maximum articles ingested per listing page per cron run.
// Guards against cost blowout if a vendor has 50+ recent articles.
const MAX_ARTICLES_PER_RUN = 5;

// ─── Result types ─────────────────────────────────────────────────────────────

export interface NewsArticleOutcome {
  url: string;
  title: string;
  status: "ok" | "fetch_failed" | "extract_failed" | "skipped_dedup";
  proposalsExtracted: number;
  proposalsPersisted: number;
  importanceScore: number;
  durationMs: number;
  error?: string;
}

export interface NewsListingOutcome {
  listingUrl: string;
  listingFetchOk: boolean;
  articlesDiscovered: number;
  articlesPassedFilter: number;
  articlesDedupSkipped: number;
  articlesIngested: number;
  proposalsExtracted: number;
  proposalsPersisted: number;
  articles: NewsArticleOutcome[];
  durationMs: number;
}

export interface NewsRunResult {
  runId: string;
  vendorId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  llmSource: "anthropic" | "stub";
  databaseConfigured: boolean;
  listings: NewsListingOutcome[];
  totals: {
    articlesDiscovered: number;
    articlesIngested: number;
    proposalsExtracted: number;
    proposalsPersisted: number;
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runNewsSourcing(vendorId: string): Promise<NewsRunResult> {
  const runId = `nsrun_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const startedAt = new Date();
  const llmSource: "anthropic" | "stub" = hasLLM() ? "anthropic" : "stub";
  const databaseConfigured = hasDatabase();

  await logEvent({
    ts: startedAt.toISOString(),
    runId,
    event: "news.run.start",
    data: { vendorId, llmSource, databaseConfigured },
  });

  // All press_release entries in the manifest for this vendor
  const entries = SOURCE_MANIFEST.filter(
    (e) => e.vendorId === vendorId && e.category === "press_release",
  );

  const listings: NewsListingOutcome[] = [];
  for (const entry of entries) {
    if (entry.rssUrl) {
      // Fast path: structured RSS feed skips Haiku article-discovery (stages 0a/0b).
      listings.push(await processRssListing(runId, vendorId, entry.rssUrl, entry.url, databaseConfigured));
    } else {
      listings.push(await processOneListing(runId, vendorId, entry.url, databaseConfigured));
    }
  }

  const finishedAt = new Date();
  const totals = {
    articlesDiscovered: listings.reduce((s, l) => s + l.articlesDiscovered, 0),
    articlesIngested:   listings.reduce((s, l) => s + l.articlesIngested, 0),
    proposalsExtracted: listings.reduce((s, l) => s + l.proposalsExtracted, 0),
    proposalsPersisted: listings.reduce((s, l) => s + l.proposalsPersisted, 0),
  };

  await logEvent({
    ts: finishedAt.toISOString(),
    runId,
    event: "news.run.summary",
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    data: { vendorId, totals },
  });

  return {
    runId,
    vendorId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    llmSource,
    databaseConfigured,
    listings,
    totals,
  };
}

// ─── RSS fast-path ────────────────────────────────────────────────────────────
// Replaces stages 0a + 0b (HTML fetch + Haiku discovery) with a direct RSS
// parse. The structured feed gives us article URLs and titles immediately;
// we go straight to per-article ingestion (stages 1–4).

async function processRssListing(
  runId: string,
  vendorId: string,
  rssUrl: string,
  fallbackUrl: string,
  persist: boolean,
): Promise<NewsListingOutcome> {
  const listingStart = Date.now();
  const base = { runId, vendorId, listingUrl: rssUrl };

  await logEvent({ ts: new Date().toISOString(), ...base, event: "news.rss.fetch.start" });

  let discovered: DiscoveredArticle[];
  try {
    const items = await fetchAndParseRss(rssUrl);
    // Convert RSS items to DiscoveredArticle shape — RSS items are pre-curated
    // so we score them highly; importanceScore 75 keeps them above the dedup
    // threshold without spending Haiku tokens on discovery scoring.
    discovered = items.slice(0, 20).map((it) => ({
      title: it.title,
      url: it.url,
      publishedAt: it.publishedAt,
      teaser: it.description.slice(0, 300),
      relevanceScore: 80,
      importanceScore: 75,
      newsType: "other" as const,
      scoringReason: "Vendor's own RSS feed — directly curated source.",
    }));
    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "news.rss.fetch.ok",
      data: { itemsInFeed: items.length, afterCap: discovered.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({ ts: new Date().toISOString(), ...base, event: "news.rss.fetch.fail", error: message });
    // Graceful fallback: run the HTML listing pipeline instead
    await logEvent({ ts: new Date().toISOString(), ...base, event: "news.rss.fallback", data: { fallbackUrl } });
    return processOneListing(runId, vendorId, fallbackUrl, persist);
  }

  if (discovered.length === 0) {
    return {
      listingUrl: rssUrl, listingFetchOk: true,
      articlesDiscovered: 0, articlesPassedFilter: 0,
      articlesDedupSkipped: 0, articlesIngested: 0,
      proposalsExtracted: 0, proposalsPersisted: 0,
      articles: [], durationMs: Date.now() - listingStart,
    };
  }

  // Stage 0c: Dedup — same as HTML path
  let toIngest = discovered;
  let dedupSkipped = 0;

  if (persist && hasDatabase()) {
    const prisma = getPrisma();
    const candidateUrls = discovered.map((a) => a.url);
    const existing = await prisma.evidenceProposal.findMany({
      where: { vendorId, sourceUrl: { in: candidateUrls } },
      select: { sourceUrl: true },
      distinct: ["sourceUrl"],
    });
    const knownUrls = new Set(
      (existing as { sourceUrl: string | null }[])
        .map((e) => e.sourceUrl)
        .filter((u): u is string => Boolean(u)),
    );
    const fresh = discovered.filter((a) => !knownUrls.has(a.url));
    dedupSkipped = discovered.length - fresh.length;
    toIngest = fresh.slice(0, MAX_ARTICLES_PER_RUN);
  } else {
    toIngest = discovered.slice(0, MAX_ARTICLES_PER_RUN);
  }

  // Stages 1–4: same article ingestion as HTML path
  const articleOutcomes: NewsArticleOutcome[] = [];
  for (const article of toIngest) {
    articleOutcomes.push(await ingestOneArticle(runId, vendorId, article, persist && hasDatabase()));
  }

  const proposalsExtracted = articleOutcomes.reduce((s, o) => s + o.proposalsExtracted, 0);
  const proposalsPersisted = articleOutcomes.reduce((s, o) => s + o.proposalsPersisted, 0);
  const articlesIngested = articleOutcomes.filter((o) => o.status === "ok").length;

  return {
    listingUrl: rssUrl,
    listingFetchOk: true,
    articlesDiscovered: discovered.length,
    articlesPassedFilter: discovered.length,
    articlesDedupSkipped: dedupSkipped,
    articlesIngested,
    proposalsExtracted,
    proposalsPersisted,
    articles: articleOutcomes,
    durationMs: Date.now() - listingStart,
  };
}

// ─── Per-listing orchestration ────────────────────────────────────────────────

async function processOneListing(
  runId: string,
  vendorId: string,
  listingUrl: string,
  persist: boolean,
): Promise<NewsListingOutcome> {
  const listingStart = Date.now();
  const base = { runId, vendorId, listingUrl };

  // Stage 0a: Fetch listing page
  await logEvent({ ts: new Date().toISOString(), ...base, event: "news.listing.fetch.start" });
  let listingContent: string;
  try {
    const fetched = await fetchSource(listingUrl);
    listingContent = fetched.rawText;
    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "news.listing.fetch.ok",
      data: { bytes: fetched.byteLength },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({ ts: new Date().toISOString(), ...base, event: "news.listing.fetch.fail", error: message });
    return {
      listingUrl, listingFetchOk: false,
      articlesDiscovered: 0, articlesPassedFilter: 0,
      articlesDedupSkipped: 0, articlesIngested: 0,
      proposalsExtracted: 0, proposalsPersisted: 0,
      articles: [], durationMs: Date.now() - listingStart,
    };
  }

  // Stage 0b: Discover + score articles (Haiku, two passes)
  if (!hasLLM()) {
    await logEvent({ ts: new Date().toISOString(), ...base, event: "news.discovery.skipped", data: { reason: "no_llm" } });
    return {
      listingUrl, listingFetchOk: true,
      articlesDiscovered: 0, articlesPassedFilter: 0,
      articlesDedupSkipped: 0, articlesIngested: 0,
      proposalsExtracted: 0, proposalsPersisted: 0,
      articles: [], durationMs: Date.now() - listingStart,
    };
  }

  const discovered = await discoverNewsArticles(vendorId, listingContent, listingUrl);
  await logEvent({
    ts: new Date().toISOString(), ...base,
    event: "news.discovery.ok",
    data: {
      discovered: discovered.length,
      articles: discovered.map((a) => ({
        url: a.url, title: a.title.slice(0, 80),
        relevance: a.relevanceScore, importance: a.importanceScore,
        type: a.newsType,
      })),
    },
  });

  if (discovered.length === 0) {
    return {
      listingUrl, listingFetchOk: true,
      articlesDiscovered: 0, articlesPassedFilter: 0,
      articlesDedupSkipped: 0, articlesIngested: 0,
      proposalsExtracted: 0, proposalsPersisted: 0,
      articles: [], durationMs: Date.now() - listingStart,
    };
  }

  // Stage 0c: Dedup — skip articles already in EvidenceProposal.sourceUrl
  let toIngest = discovered;
  let dedupSkipped = 0;

  if (persist && hasDatabase()) {
    const prisma = getPrisma();
    const candidateUrls = discovered.map((a) => a.url);
    const existing = await prisma.evidenceProposal.findMany({
      where: { vendorId, sourceUrl: { in: candidateUrls } },
      select: { sourceUrl: true },
      distinct: ["sourceUrl"],
    });
    const knownUrls = new Set(
      (existing as { sourceUrl: string | null }[])
        .map((e) => e.sourceUrl)
        .filter((u): u is string => Boolean(u)),
    );
    const fresh = discovered.filter((a) => !knownUrls.has(a.url));
    dedupSkipped = discovered.length - fresh.length;

    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "news.dedup.ok",
      data: { total: discovered.length, fresh: fresh.length, skipped: dedupSkipped },
    });

    toIngest = fresh.slice(0, MAX_ARTICLES_PER_RUN);
  } else {
    toIngest = discovered.slice(0, MAX_ARTICLES_PER_RUN);
  }

  // Stages 1–4: Ingest each fresh article
  const articleOutcomes: NewsArticleOutcome[] = [];
  for (const article of toIngest) {
    articleOutcomes.push(
      await ingestOneArticle(runId, vendorId, article, persist && hasDatabase()),
    );
  }

  const proposalsExtracted = articleOutcomes.reduce((s, o) => s + o.proposalsExtracted, 0);
  const proposalsPersisted = articleOutcomes.reduce((s, o) => s + o.proposalsPersisted, 0);
  const articlesIngested = articleOutcomes.filter((o) => o.status === "ok").length;

  return {
    listingUrl,
    listingFetchOk: true,
    articlesDiscovered: discovered.length,
    articlesPassedFilter: discovered.length,
    articlesDedupSkipped: dedupSkipped,
    articlesIngested,
    proposalsExtracted,
    proposalsPersisted,
    articles: articleOutcomes,
    durationMs: Date.now() - listingStart,
  };
}

// ─── Per-article ingestion (Stages 1–4) ──────────────────────────────────────

async function ingestOneArticle(
  runId: string,
  vendorId: string,
  article: DiscoveredArticle,
  shouldPersist: boolean,
): Promise<NewsArticleOutcome> {
  const articleStart = Date.now();
  const base = { runId, vendorId, articleUrl: article.url };

  // Stage 1: Fetch full article content
  await logEvent({ ts: new Date().toISOString(), ...base, event: "news.article.fetch.start" });
  let fetched;
  try {
    fetched = await fetchSource(article.url);
    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "news.article.fetch.ok",
      data: { bytes: fetched.byteLength },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({ ts: new Date().toISOString(), ...base, event: "news.article.fetch.fail", error: message });
    return {
      url: article.url, title: article.title,
      status: "fetch_failed", proposalsExtracted: 0, proposalsPersisted: 0,
      importanceScore: article.importanceScore,
      durationMs: Date.now() - articleStart, error: message,
    };
  }

  // Stage 2: Extract evidence proposals (Haiku)
  let extraction;
  try {
    extraction = await extractEvidence({
      vendorName: vendorId,
      vendorCategory: "press_release",
      sourceCategory: "press_release",
      sourceUrl: article.url,
      rawContent: fetched.rawText,
    });
    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "news.article.extract.ok",
      data: { proposalsCount: extraction.data.proposals.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({ ts: new Date().toISOString(), ...base, event: "news.article.extract.fail", error: message });
    return {
      url: article.url, title: article.title,
      status: "extract_failed", proposalsExtracted: 0, proposalsPersisted: 0,
      importanceScore: article.importanceScore,
      durationMs: Date.now() - articleStart, error: message,
    };
  }

  // Stage 3: Classify each proposal (Haiku)
  const classifications = await Promise.all(
    extraction.data.proposals.map(async (proposal) => {
      try {
        const result = await classifyEvidence({
          vendorName: vendorId,
          sourceCategory: "press_release",
          sourceUrl: article.url,
          proposal,
        });
        return { proposal, classification: result.data, failure: null as null | ReturnType<typeof categoriseClassifyFailure> };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { proposal, classification: null, failure: categoriseClassifyFailure(message) };
      }
    }),
  );

  // Stage 4: Persist
  let persistedCount = 0;
  if (shouldPersist) {
    try {
      const prisma = getPrisma();
      const job = await prisma.ingestionJob.create({
        data: { vendorId, status: "ready_for_review" },
      });
      const now = new Date();
      const rows = classifications.map(({ proposal, classification, failure }) => ({
        jobId: job.id,
        vendorId,
        domain: proposal.domain,
        subfactor: proposal.subfactor,
        excerpt: proposal.excerpt,
        proposedGrade: classification?.finalGrade ?? proposal.proposedGrade,
        proposedRawScore: classification?.finalRawScore ?? proposal.proposedRawScore,
        sourceUrl: article.url,
        capturedAt: now,
        classifierConfidence: classification?.confidence ?? 0,
        classifierRationale: classification?.rationale ?? null,
        classificationFailed: classification === null,
        classificationFailureCode: failure?.code ?? null,
        classificationFailureReason: failure?.reason ?? null,
        confidenceIsFallback: classification === null,
        status: "pending" as const,
      }));
      const created = await prisma.evidenceProposal.createMany({ data: rows });
      persistedCount = created.count;
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          rawContent: fetched.rawText.slice(0, 200_000),
          rawContentHash: fetched.contentHash,
          proposalsCount: persistedCount,
          finishedAt: new Date(),
        },
      });
      await logEvent({
        ts: new Date().toISOString(), ...base,
        event: "news.article.persist.ok",
        data: { jobId: job.id, persistedCount },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent({ ts: new Date().toISOString(), ...base, event: "news.article.persist.fail", error: message });
    }
  }

  return {
    url: article.url,
    title: article.title,
    status: "ok",
    proposalsExtracted: extraction.data.proposals.length,
    proposalsPersisted: persistedCount,
    importanceScore: article.importanceScore,
    durationMs: Date.now() - articleStart,
  };
}
