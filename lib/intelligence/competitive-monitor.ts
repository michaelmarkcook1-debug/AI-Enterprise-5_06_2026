// Competitive-intelligence monitor.
// ────────────────────────────────
// For each tracked AI vendor, asks Claude with the web-search server tool to
// surface noteworthy events from the last LOOKBACK_DAYS across six
// dimensions (product launches, pricing changes, partnerships, key hires,
// press coverage, funding rounds). Returned items are upserted into the
// existing IntelligenceNewsItem table so they flow into /news and the
// dashboard "Recent major news" panel without any UI changes.
//
// Mirrors the web-search pattern already established in lib/agents/url-finder.ts.
// Cost-controlled: one Claude call per vendor, web_search budget capped per
// call. Stable IDs (vendor + url + published date) make the upsert idempotent.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { getPrisma, hasDatabase } from "../prisma";
import {
  COMPETITIVE_TARGETS,
  DIMENSION_TO_NEWS_CATEGORY,
  ALL_DIMENSIONS,
  type CompetitiveDimension,
  type CompetitiveTarget,
} from "./competitive-targets";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const WEB_SEARCH_TOOL_TYPE = "web_search_20260209" as const;
const MAX_SEARCHES_PER_VENDOR = 3;
const LOOKBACK_DAYS = 14;
// Cost controls: 4 items + 3 searches per vendor keeps per-run web-search spend
// roughly half the original 6/6 while still covering the six dimensions.
const MAX_ITEMS_PER_VENDOR = 4;

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if ((process.env.NODE_ENV === "test" || process.env.VITEST) && process.env.ALLOW_LIVE_LLM_TESTS !== "1") return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

interface MonitorFinding {
  dimension: CompetitiveDimension;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string; // yyyy-mm-dd from Claude
  impactScore: number; // 0-100
  confidenceScore: number; // 0-100
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  whyItMatters: string;
}

const REPORT_SCHEMA = {
  name: "report_competitive_findings",
  description: "Report noteworthy competitive-intelligence findings for the vendor across the six dimensions.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        maxItems: MAX_ITEMS_PER_VENDOR,
        items: {
          type: "object",
          required: ["dimension", "title", "summary", "sourceName", "sourceUrl", "publishedAt", "impactScore", "confidenceScore", "sentiment", "whyItMatters"],
          properties: {
            dimension: {
              type: "string",
              enum: ALL_DIMENSIONS,
              description: "Which competitive dimension this finding belongs to.",
            },
            title:        { type: "string", minLength: 6, maxLength: 200 },
            summary:      { type: "string", minLength: 30, maxLength: 600, description: "2-3 sentence neutral factual summary." },
            sourceName:   { type: "string", minLength: 2, maxLength: 120, description: "Publication or first-party source name." },
            sourceUrl:    { type: "string", description: "Full https:// URL to the article or announcement." },
            publishedAt:  { type: "string", description: "yyyy-mm-dd publication date." },
            impactScore:  { type: "integer", minimum: 0, maximum: 100, description: "0-100 estimated strategic impact." },
            confidenceScore: { type: "integer", minimum: 0, maximum: 100, description: "0-100 confidence in source + attribution." },
            sentiment:    { type: "string", enum: ["positive", "negative", "neutral", "mixed"] },
            whyItMatters: { type: "string", minLength: 20, maxLength: 360, description: "1-2 sentences on enterprise relevance." },
          },
        },
      },
    },
    required: ["findings"],
  },
} as const;

function systemPrompt(): string {
  return `You are a competitive-intelligence analyst monitoring frontier AI companies for an enterprise-buyer research portal.

Your task: surface up to ${MAX_ITEMS_PER_VENDOR} NOTEWORTHY events from the last ${LOOKBACK_DAYS} days for ONE vendor, across these six dimensions:
  - product_launch  — new model/product releases, major capability additions
  - pricing_change  — pricing tier changes, new SKUs, enterprise plan moves
  - partnership     — strategic partnerships, integrations, channel deals
  - key_hire        — senior leadership hires / departures (VP+ / research leads)
  - press_coverage  — major analyst or press coverage materially shifting narrative
  - funding_round   — capital raises, valuation events, IPO signals

Truth-handling rules (non-negotiable):
1. EVERY finding must cite a real URL you obtained via web_search. Never invent.
2. publishedAt must be inside the last ${LOOKBACK_DAYS} days. Reject older items.
3. Prefer first-party sources (the vendor's own newsroom / docs) when they exist; otherwise reputable trade press.
4. If nothing material happened in a dimension, OMIT findings for that dimension. Returning an empty findings array is acceptable.
5. Use your ${MAX_SEARCHES_PER_VENDOR} web_search budget efficiently — one query per dimension at most.

Always call the report_competitive_findings tool exactly once with your final list.`;
}

function userPrompt(target: CompetitiveTarget, today: string): string {
  const aliases = target.aliases.length ? ` (also known as: ${target.aliases.join(", ")})` : "";
  return `Vendor: ${target.name}${aliases}
Vendor ID: ${target.vendorId}
Primary domain: ${target.domain}
Today's date: ${today}
Lookback window: ${LOOKBACK_DAYS} days

Use web_search to find noteworthy events from the last ${LOOKBACK_DAYS} days for ${target.name} across the six dimensions. Return up to ${MAX_ITEMS_PER_VENDOR} findings via the report_competitive_findings tool.`;
}

export interface VendorMonitorResult {
  vendorId: string;
  vendorName: string;
  findings: MonitorFinding[];
  searchesUsed: number;
  tokensIn: number;
  tokensOut: number;
  source: "anthropic" | "stub";
  error?: string;
}

/** Within the last LOOKBACK_DAYS, inclusive. */
function isRecent(iso: string, today: Date): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const ageDays = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= LOOKBACK_DAYS + 1;
}

async function monitorVendor(target: CompetitiveTarget, today: Date): Promise<VendorMonitorResult> {
  const client = getClient();
  if (!client) {
    return { vendorId: target.vendorId, vendorName: target.name, findings: [], searchesUsed: 0, tokensIn: 0, tokensOut: 0, source: "stub", error: "ANTHROPIC_API_KEY not configured" };
  }

  const todayIso = today.toISOString().slice(0, 10);
  try {
    const message = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 3072,
      system: systemPrompt(),
      tools: [
        { type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: MAX_SEARCHES_PER_VENDOR } as unknown as Anthropic.Tool,
        REPORT_SCHEMA as unknown as Anthropic.Tool,
      ],
      messages: [{ role: "user", content: userPrompt(target, todayIso) }],
    });

    const searchesUsed = (message.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
    const tokensIn  = message.usage.input_tokens;
    const tokensOut = message.usage.output_tokens;

    const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_competitive_findings");
    if (!block) {
      return { vendorId: target.vendorId, vendorName: target.name, findings: [], searchesUsed, tokensIn, tokensOut, source: "anthropic", error: "no report tool call" };
    }

    const raw = block.input as { findings?: Partial<MonitorFinding>[] };
    const findings: MonitorFinding[] = (raw.findings ?? [])
      .filter((f): f is MonitorFinding =>
        typeof f.title === "string"
        && typeof f.summary === "string"
        && typeof f.sourceName === "string"
        && typeof f.sourceUrl === "string"
        && typeof f.publishedAt === "string"
        && typeof f.dimension === "string"
        && typeof f.impactScore === "number"
        && typeof f.confidenceScore === "number"
        && typeof f.sentiment === "string"
        && typeof f.whyItMatters === "string"
        && ALL_DIMENSIONS.includes(f.dimension as CompetitiveDimension)
        && f.sourceUrl.startsWith("https://")
        && isRecent(f.publishedAt, today),
      );

    return { vendorId: target.vendorId, vendorName: target.name, findings, searchesUsed, tokensIn, tokensOut, source: "anthropic" };
  } catch (err) {
    return { vendorId: target.vendorId, vendorName: target.name, findings: [], searchesUsed: 0, tokensIn: 0, tokensOut: 0, source: "anthropic", error: (err as Error).message };
  }
}

/** Deterministic id so re-runs of the monitor upsert rather than duplicate. */
function newsItemId(vendorId: string, url: string, publishedAt: string): string {
  const h = createHash("sha1").update(`${vendorId}|${url}|${publishedAt}`).digest("hex");
  return `compintel_${h.slice(0, 24)}`;
}

// Pricing constants for cost estimation (USD per token).
// Update these if Anthropic changes pricing.
const SONNET_PRICE_IN  = 3.00 / 1_000_000;
const SONNET_PRICE_OUT = 15.00 / 1_000_000;
const HAIKU_PRICE_IN   = 0.80 / 1_000_000;
const HAIKU_PRICE_OUT  = 4.00 / 1_000_000;
const WEB_SEARCH_PRICE = 0.01; // per search request

export interface MonitorRunResult {
  ranAt: string;
  vendorsAttempted: number;
  vendorsWithFindings: number;
  itemsUpserted: number;
  totalSearches: number;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number;
  errors: { vendorId: string; error: string }[];
  source: "anthropic" | "stub";
  modelUsed: string;
}

/**
 * Run the competitive-intelligence monitor across all targets, persisting
 * new findings into IntelligenceNewsItem. Idempotent.
 */
export async function runCompetitiveIntelMonitor(
  now: Date = new Date(),
  opts: { targets?: CompetitiveTarget[] } = {},
): Promise<MonitorRunResult> {
  const ranAt = now.toISOString();
  const targets = opts.targets ?? COMPETITIVE_TARGETS;
  const results = await Promise.all(targets.map((t) => monitorVendor(t, now)));

  const errors = results.flatMap((r) => (r.error ? [{ vendorId: r.vendorId, error: r.error }] : []));
  const totalSearches    = results.reduce((sum, r) => sum + r.searchesUsed, 0);
  const totalTokensIn    = results.reduce((sum, r) => sum + r.tokensIn, 0);
  const totalTokensOut   = results.reduce((sum, r) => sum + r.tokensOut, 0);
  const vendorsWithFindings = results.filter((r) => r.findings.length > 0).length;

  // Estimate cost based on which model was used.
  const isHaiku = DEFAULT_MODEL.includes("haiku");
  const priceIn  = isHaiku ? HAIKU_PRICE_IN  : SONNET_PRICE_IN;
  const priceOut = isHaiku ? HAIKU_PRICE_OUT : SONNET_PRICE_OUT;
  const estimatedCostUsd = parseFloat(
    ((totalTokensIn * priceIn) + (totalTokensOut * priceOut) + (totalSearches * WEB_SEARCH_PRICE)).toFixed(4),
  );

  let itemsUpserted = 0;
  if (hasDatabase()) {
    const prisma = getPrisma();
    for (const r of results) {
      for (const f of r.findings) {
        const id = newsItemId(r.vendorId, f.sourceUrl, f.publishedAt);
        const category = DIMENSION_TO_NEWS_CATEGORY[f.dimension];
        try {
          await prisma.intelligenceNewsItem.upsert({
            where: { id },
            create: {
              id,
              title: f.title,
              summary: f.summary,
              sourceName: f.sourceName,
              sourceUrl: f.sourceUrl,
              publishedAt: new Date(`${f.publishedAt}T00:00:00.000Z`),
              vendors: [r.vendorId],
              categories: [category],
              impactScore: f.impactScore,
              confidenceScore: f.confidenceScore,
              affectedPillars: [],
              whyItMatters: `[${f.dimension.replace(/_/g, " ")}] ${f.whyItMatters}`,
              suggestedScoreImpact: [],
              relatedVendors: [],
              sentiment: f.sentiment,
            },
            update: {
              title: f.title,
              summary: f.summary,
              impactScore: f.impactScore,
              confidenceScore: f.confidenceScore,
              whyItMatters: `[${f.dimension.replace(/_/g, " ")}] ${f.whyItMatters}`,
              sentiment: f.sentiment,
            },
          });
          itemsUpserted += 1;
        } catch (err) {
          errors.push({ vendorId: r.vendorId, error: `upsert: ${(err as Error).message}` });
        }
      }
    }
  }

  const source = results.some((r) => r.source === "anthropic") ? "anthropic" : "stub";

  return {
    ranAt,
    vendorsAttempted: targets.length,
    vendorsWithFindings,
    itemsUpserted,
    totalSearches,
    totalTokensIn,
    totalTokensOut,
    estimatedCostUsd,
    errors,
    source,
    modelUsed: DEFAULT_MODEL,
  };
}
