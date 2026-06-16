// News Article Discoverer — Stage 0 of the vendor news sourcing pipeline.
//
// Given the HTML content of a vendor's news or press-release listing page,
// this agent runs two cheap Haiku passes:
//   Pass 1 — extract individual article links, titles, dates, and teasers.
//   Pass 2 — score each article for relevance to our 12 evaluation domains
//             and strategic importance to enterprise AI/BPO intelligence.
//
// Articles below the relevance or importance threshold are discarded HERE,
// before any full-article fetch or expensive extraction pass is triggered.
// This pre-filter is the key cost-control gate for the news pipeline.

import { z } from "zod";
import { extractStructured } from "./llm-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NewsType =
  | "product_launch"
  | "partnership"
  | "financial"
  | "security"
  | "leadership"
  | "market_position"
  | "contract_win"
  | "other";

export interface DiscoveredArticle {
  title: string;
  url: string;
  publishedAt: string | null;
  teaser: string;
  relevanceScore: number;   // 0–100: relevance to 12 enterprise AI evaluation domains
  importanceScore: number;  // 0–100: strategic significance for market intelligence
  newsType: NewsType;
  scoringReason: string;
}

// ─── Pass 1: Article list extraction ─────────────────────────────────────────

const ArticleListSchema = z.object({
  articles: z.array(z.object({
    title: z.string().min(1).max(300),
    url: z.string().min(1).max(2000),
    publishedAt: z.string().nullable().default(null),
    teaser: z.string().max(400).default(""),
  })).max(25),
});

type ArticleList = z.infer<typeof ArticleListSchema>;

const EXTRACT_TOOL = {
  name: "extract_article_list",
  description: "List of news articles extracted from the vendor's news listing page.",
  jsonSchema: {
    type: "object",
    required: ["articles"],
    additionalProperties: false,
    properties: {
      articles: {
        type: "array",
        maxItems: 25,
        items: {
          type: "object",
          required: ["title", "url"],
          properties: {
            title: { type: "string", maxLength: 300 },
            url: { type: "string", maxLength: 2000, description: "Absolute URL. Resolve relative paths using the provided base URL." },
            publishedAt: { type: ["string", "null"], description: "ISO date (YYYY-MM-DD) or null if not visible." },
            teaser: { type: "string", maxLength: 400, description: "1–2 sentence summary from the listing snippet." },
          },
        },
      },
    },
  },
};

const EXTRACT_SYSTEM = `You are a news article list extractor for an enterprise AI market intelligence platform.

Given the HTML content of a vendor's news or press-release listing page, extract individual article entries.

Rules:
- Extract up to 20 articles, newest first.
- For each article: title, absolute URL (resolve relative paths using the provided base URL), ISO publish date (or null), and a 1–2 sentence teaser from any visible snippet.
- SKIP: navigation links, tag pages, author bios, cookie banners, footer links, "category" links.
- Only return actual news articles, press releases, or blog posts.`;

// ─── Pass 2: Relevance + importance scoring ───────────────────────────────────

const ScoredListSchema = z.object({
  scores: z.array(z.object({
    url: z.string(),
    relevanceScore: z.number().min(0).max(100),
    importanceScore: z.number().min(0).max(100),
    newsType: z.enum([
      "product_launch", "partnership", "financial", "security",
      "leadership", "market_position", "contract_win", "other",
    ]),
    scoringReason: z.string().max(250),
  })),
});

type ScoredList = z.infer<typeof ScoredListSchema>;

const SCORE_TOOL = {
  name: "score_articles",
  description: "Relevance and importance scores for each discovered article.",
  jsonSchema: {
    type: "object",
    required: ["scores"],
    additionalProperties: false,
    properties: {
      scores: {
        type: "array",
        items: {
          type: "object",
          required: ["url", "relevanceScore", "importanceScore", "newsType", "scoringReason"],
          properties: {
            url: { type: "string" },
            relevanceScore: { type: "number", minimum: 0, maximum: 100 },
            importanceScore: { type: "number", minimum: 0, maximum: 100 },
            newsType: {
              type: "string",
              enum: ["product_launch", "partnership", "financial", "security",
                     "leadership", "market_position", "contract_win", "other"],
            },
            scoringReason: { type: "string", maxLength: 250 },
          },
        },
      },
    },
  },
};

const SCORE_SYSTEM = `You are an enterprise AI market intelligence analyst scoring vendor news articles.

RELEVANCE (0–100) — how relevant is this article to enterprise AI platform evaluation?
  80–100  Directly concerns AI capabilities, enterprise use cases, security/compliance, pricing, agentic features, API/integration
  60–79   Relevant to vendor market position, enterprise partnerships, financial results, customer wins
  40–59   Tangentially related (general tech, company growth, developer community)
  0–39    Not relevant (unrelated products, HR/culture, sports sponsorship, community events)

IMPORTANCE (0–100) — strategic significance for enterprise AI procurement intelligence:
  80–100  Major product launch, large contract win, security incident, significant pricing change, regulatory action
  60–79   New enterprise capability, notable partnership, leadership change with AI implications, earnings surprise
  40–59   Incremental feature update, minor partnership, general market commentary
  0–39    Routine blog post, pure marketing, redundant re-announcement, fluff

NEWS TYPE — choose the single best fit:
  product_launch   New model, product, or major feature release
  partnership      Integration partnership, technology alliance, reseller agreement
  financial        Earnings, funding round, M&A, revenue milestone
  security         Security incident, compliance certification, audit finding
  leadership       Executive hire, departure, or restructuring
  market_position  Analyst report mention, industry award, competitive positioning
  contract_win     Named enterprise customer win, public sector contract
  other            Anything that doesn't fit the above

Score every article. Most blog posts score 30–60 on importance. Be conservative.`;

// ─── Filters ──────────────────────────────────────────────────────────────────

const RELEVANCE_THRESHOLD = 60;
const IMPORTANCE_THRESHOLD = 40;
const LISTING_CHARS = 25_000;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function discoverNewsArticles(
  vendorId: string,
  pageContent: string,
  pageUrl: string,
): Promise<DiscoveredArticle[]> {
  const truncated = pageContent.slice(0, LISTING_CHARS);

  // Pass 1 — extract article list from listing page HTML
  let articleList: ArticleList;
  try {
    const result = await extractStructured<ArticleList>({
      systemPrompt: EXTRACT_SYSTEM,
      userPrompt: `Base URL: ${pageUrl}\n\n---HTML---\n${truncated}`,
      schema: EXTRACT_TOOL,
      parse: (raw) => ArticleListSchema.parse(raw),
      maxTokens: 3000,
      fallback: () => ({ articles: [] }),
    });
    articleList = result.data;
  } catch (err) {
    // Don't swallow silently — a 401/429/billing failure here would otherwise
    // look identical to "0 articles on a quiet day". Log the (status+type-enriched)
    // error so it surfaces in server logs / Vercel logs.
    console.error(`[news-discoverer] article-list extraction failed for ${vendorId}: ${(err as Error)?.message ?? String(err)}`);
    return [];
  }

  if (articleList.articles.length === 0) return [];

  // Resolve relative URLs against the listing page base
  const resolved = articleList.articles
    .map((a) => ({ ...a, url: resolveUrl(a.url, pageUrl) }))
    .filter((a) => a.url.length > 0);

  if (resolved.length === 0) return [];

  // Pass 2 — score each article for relevance + importance
  const articleDigest = resolved
    .map((a, i) => `${i + 1}. URL: ${a.url}\nTitle: ${a.title}\nTeaser: ${a.teaser}`)
    .join("\n\n");

  let scored: ScoredList;
  try {
    const result = await extractStructured<ScoredList>({
      systemPrompt: SCORE_SYSTEM,
      userPrompt: `Vendor: ${vendorId.replace(/^vendor_/, "")}\n\nArticles to score:\n\n${articleDigest}`,
      schema: SCORE_TOOL,
      parse: (raw) => ScoredListSchema.parse(raw),
      maxTokens: 3000,
      fallback: () => ({ scores: [] }),
    });
    scored = result.data;
  } catch (err) {
    console.error(`[news-discoverer] article scoring failed for ${vendorId}: ${(err as Error)?.message ?? String(err)}`);
    return [];
  }

  // Merge scores back, apply thresholds, sort by importance desc
  const scoreMap = new Map(scored.scores.map((s) => [s.url, s]));
  return resolved
    .map((a): DiscoveredArticle | null => {
      const score = scoreMap.get(a.url);
      if (!score) return null;
      if (score.relevanceScore < RELEVANCE_THRESHOLD) return null;
      if (score.importanceScore < IMPORTANCE_THRESHOLD) return null;
      return {
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
        teaser: a.teaser,
        relevanceScore: score.relevanceScore,
        importanceScore: score.importanceScore,
        newsType: score.newsType,
        scoringReason: score.scoringReason,
      };
    })
    .filter((a): a is DiscoveredArticle => a !== null)
    .sort((a, b) => b.importanceScore - a.importanceScore);
}

// ─── URL resolution ───────────────────────────────────────────────────────────

function resolveUrl(url: string, baseUrl: string): string {
  if (!url) return "";
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = new URL(baseUrl);
    if (url.startsWith("//")) return `${base.protocol}${url}`;
    return new URL(url, baseUrl).href;
  } catch {
    return "";
  }
}
