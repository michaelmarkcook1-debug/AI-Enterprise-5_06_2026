// Competitive-intelligence monitor.
// ────────────────────────────────
// Three-stage tiered pipeline per vendor:
//   Stage 1 — Haiku + web_search: raw ingestion (search and extract facts)
//   Stage 2 — Sonnet:             classification (dimension, scores, summary)
//   Stage 3 — Opus:               analyst commentary (whyItMatters — the SO-WHAT)
//
// Separating the stages means Haiku handles the bulk of web-search tokens
// (cheap), Sonnet structures the findings (medium), and Opus only writes
// the high-value analyst commentary (expensive but short). Quality is
// higher because Opus reasons over pre-structured, pre-filtered data.
//
// Mirrors the web-search pattern in lib/agents/url-finder.ts.
// Stable IDs (vendor + url + published date) make the upsert idempotent.

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

// Three-tier model pipeline. Each tier has a dedicated env knob.
// ANTHROPIC_EXTRACT_MODEL   → Haiku (ingestion / web-search extraction)
// ANTHROPIC_MODEL           → Sonnet (classification / scoring)
// ANTHROPIC_INTEL_MODEL     → Opus   (analyst commentary / "why it matters")
const HAIKU_MODEL  = process.env.ANTHROPIC_EXTRACT_MODEL ?? "claude-haiku-4-5";
const SONNET_MODEL = process.env.ANTHROPIC_MODEL         ?? "claude-sonnet-4-6";
const OPUS_MODEL   = process.env.ANTHROPIC_INTEL_MODEL   ?? "claude-opus-4-8";
const WEB_SEARCH_TOOL_TYPE = "web_search_20260209" as const;
const MAX_SEARCHES_PER_VENDOR = 3;
const LOOKBACK_DAYS = 14;
const MAX_ITEMS_PER_VENDOR = 4;

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if ((process.env.NODE_ENV === "test" || process.env.VITEST) && process.env.ALLOW_LIVE_LLM_TESTS !== "1") return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/* ─── Intermediate pipeline types ────────────────────────────── */

interface RawFinding {
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string; // yyyy-mm-dd
  snippet: string;     // verbatim excerpt, max 500 chars
}

interface ClassifiedFinding {
  idx: number; // 0-based index into the raw findings array
  dimension: CompetitiveDimension;
  impactScore: number;
  confidenceScore: number;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  summary: string;
}

interface MonitorFinding {
  dimension: CompetitiveDimension;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  impactScore: number;
  confidenceScore: number;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  whyItMatters: string;
}

/* ─── Tool schemas ─────────────────────────────────────────────── */

const RAW_FINDINGS_SCHEMA = {
  name: "report_raw_findings",
  description: "Report raw news items from web search — factual extraction only, no categorisation or analysis.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          required: ["title", "sourceName", "sourceUrl", "publishedAt", "snippet"],
          properties: {
            title:       { type: "string", maxLength: 200 },
            sourceName:  { type: "string", maxLength: 120 },
            sourceUrl:   { type: "string" },
            publishedAt: { type: "string", description: "yyyy-mm-dd" },
            snippet:     { type: "string", maxLength: 500, description: "Verbatim 1-3 sentence excerpt from the source page." },
          },
        },
      },
    },
    required: ["findings"],
  },
} as const;

const CLASSIFY_SCHEMA = {
  name: "report_classified_findings",
  description: "Classify each raw finding into a competitive dimension with impact/confidence scores.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["idx", "dimension", "impactScore", "confidenceScore", "sentiment", "summary"],
          properties: {
            idx:             { type: "integer", description: "0-based index from the raw findings list." },
            dimension:       { type: "string", enum: ALL_DIMENSIONS },
            impactScore:     { type: "integer", minimum: 0, maximum: 100, description: "0-100 estimated strategic impact." },
            confidenceScore: { type: "integer", minimum: 0, maximum: 100, description: "0-100 source quality and attribution." },
            sentiment:       { type: "string", enum: ["positive", "negative", "neutral", "mixed"] },
            summary:         { type: "string", minLength: 30, maxLength: 600, description: "2-3 sentence neutral factual summary." },
          },
        },
      },
    },
    required: ["findings"],
  },
} as const;

const ANALYSIS_SCHEMA = {
  name: "report_analysis",
  description: "Report analyst commentary (whyItMatters) for each classified finding.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["idx", "whyItMatters"],
          properties: {
            idx:          { type: "integer", description: "0-based index matching the classified findings." },
            whyItMatters: { type: "string", minLength: 20, maxLength: 360, description: "Senior analyst voice: the SO-WHAT for an enterprise buyer or competing service provider." },
          },
        },
      },
    },
    required: ["findings"],
  },
} as const;

/* ─── Pricing constants ─────────────────────────────────────────── */

const HAIKU_PRICE_IN   = 0.80 / 1_000_000;
const HAIKU_PRICE_OUT  = 4.00 / 1_000_000;
const SONNET_PRICE_IN  = 3.00 / 1_000_000;
const SONNET_PRICE_OUT = 15.00 / 1_000_000;
const OPUS_PRICE_IN    = 5.00 / 1_000_000;
const OPUS_PRICE_OUT   = 25.00 / 1_000_000;
const WEB_SEARCH_PRICE = 0.01;

interface TierTokens { in: number; out: number }
interface StageTokens { haiku: TierTokens; sonnet: TierTokens; opus: TierTokens }

/* ─── Public types ──────────────────────────────────────────────── */

export interface VendorMonitorResult {
  vendorId: string;
  vendorName: string;
  findings: MonitorFinding[];
  searchesUsed: number;
  tokensIn: number;
  tokensOut: number;
  stageTokens: StageTokens;
  source: "anthropic" | "stub";
  error?: string;
}

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

/* ─── Helpers ───────────────────────────────────────────────────── */

function isRecent(iso: string, today: Date): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const ageDays = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= LOOKBACK_DAYS + 1;
}

function newsItemId(vendorId: string, url: string, publishedAt: string): string {
  const h = createHash("sha1").update(`${vendorId}|${url}|${publishedAt}`).digest("hex");
  return `compintel_${h.slice(0, 24)}`;
}

/* ─── 3-stage vendor monitor ────────────────────────────────────── */

async function monitorVendor(target: CompetitiveTarget, today: Date): Promise<VendorMonitorResult> {
  const client = getClient();
  const zeroTokens: StageTokens = {
    haiku:  { in: 0, out: 0 },
    sonnet: { in: 0, out: 0 },
    opus:   { in: 0, out: 0 },
  };
  const stub: VendorMonitorResult = {
    vendorId: target.vendorId, vendorName: target.name, findings: [],
    searchesUsed: 0, tokensIn: 0, tokensOut: 0, stageTokens: zeroTokens,
    source: "stub",
  };
  if (!client) return { ...stub, error: "ANTHROPIC_API_KEY not configured" };

  const todayIso = today.toISOString().slice(0, 10);
  const stage: StageTokens = { haiku: { in: 0, out: 0 }, sonnet: { in: 0, out: 0 }, opus: { in: 0, out: 0 } };
  let searchesUsed = 0;

  try {
    // ── Stage 1: Haiku + web_search — raw ingestion ──────────────
    // Haiku does the web searches and extracts factual items. No
    // interpretation — just find, fetch, and report raw excerpts.
    const s1 = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 3000,
      system: `You are a news-extraction agent. Use web_search to find events for the given vendor in the last ${LOOKBACK_DAYS} days, then call report_raw_findings. Extract facts only — do not categorise, score, or interpret. Include a verbatim excerpt from each source page in the snippet field.`,
      tools: [
        { type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: MAX_SEARCHES_PER_VENDOR } as unknown as Anthropic.Tool,
        RAW_FINDINGS_SCHEMA as unknown as Anthropic.Tool,
      ],
      messages: [{
        role: "user",
        content: `Vendor: ${target.name}${target.aliases.length ? ` (aka ${target.aliases.join(", ")})` : ""}. Domain: ${target.domain}. Today: ${todayIso}.

Search for events in the last ${LOOKBACK_DAYS} days across: new products/models/capabilities, pricing changes, partnerships/integrations, executive changes, analyst mentions, funding rounds.

Use up to ${MAX_SEARCHES_PER_VENDOR} web_search calls. Return up to 6 items via report_raw_findings. For each item set sourceUrl to the exact https:// URL you fetched.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    stage.haiku.in  += s1.usage.input_tokens;
    stage.haiku.out += s1.usage.output_tokens;
    searchesUsed    += (s1.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;

    const s1block = s1.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_raw_findings");
    const rawItems: RawFinding[] = ((s1block?.input as { findings?: RawFinding[] })?.findings ?? [])
      .filter((f) => typeof f.title === "string" && typeof f.sourceUrl === "string"
        && f.sourceUrl.startsWith("https://") && isRecent(f.publishedAt, today));

    if (rawItems.length === 0) {
      return { ...stub, searchesUsed, stageTokens: stage, source: "anthropic",
        tokensIn: stage.haiku.in, tokensOut: stage.haiku.out };
    }

    // ── Stage 2: Sonnet — classify and score ─────────────────────
    // Sonnet receives the raw factual items and assigns each a competitive
    // dimension, impact/confidence scores, sentiment, and a clean summary.
    // No web search, no interpretation — just structured classification.
    const rawList = rawItems
      .map((f, i) => `[${i}] ${f.title}\nSource: ${f.sourceName} | ${f.publishedAt}\n${f.snippet}`)
      .join("\n\n");

    const s2 = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 2000,
      system: "You are a competitive-intelligence classifier. Classify each raw news item into the correct competitive dimension with scores. Neutral and factual — no analyst commentary or interpretation.",
      tools: [CLASSIFY_SCHEMA as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: "report_classified_findings" } as unknown as Anthropic.ToolChoice,
      messages: [{
        role: "user",
        content: `Vendor: ${target.name}\n\nRaw news items:\n${rawList}\n\nFor each item (by 0-based index):\n- dimension: product_launch | pricing_change | partnership | key_hire | press_coverage | funding_round\n- impactScore 0-100 (strategic market impact)\n- confidenceScore 0-100 (source quality and attribution)\n- sentiment: positive | negative | neutral | mixed\n- summary: 2-3 sentence neutral factual summary\n\nOmit items that don't clearly fit any dimension.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    stage.sonnet.in  += s2.usage.input_tokens;
    stage.sonnet.out += s2.usage.output_tokens;

    const s2block = s2.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_classified_findings");
    const classified: ClassifiedFinding[] = ((s2block?.input as { findings?: ClassifiedFinding[] })?.findings ?? [])
      .filter((c) => ALL_DIMENSIONS.includes(c.dimension as CompetitiveDimension) && rawItems[c.idx] !== undefined);

    if (classified.length === 0) {
      const tokensIn  = stage.haiku.in  + stage.sonnet.in;
      const tokensOut = stage.haiku.out + stage.sonnet.out;
      return { ...stub, searchesUsed, stageTokens: stage, source: "anthropic", tokensIn, tokensOut };
    }

    // ── Stage 3: Opus — analyst commentary ───────────────────────
    // Opus receives pre-structured, pre-filtered findings and writes the
    // "whyItMatters" analyst brief for each. Adaptive thinking lets Opus
    // reason about leverage and implications before committing to text.
    const clList = classified
      .map((c) => `[${c.idx}] ${rawItems[c.idx]!.title} (${c.dimension}, impact=${c.impactScore})\n${c.summary}`)
      .join("\n\n");

    const s3 = await client.messages.create({
      model: OPUS_MODEL,
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: `You are a senior competitive-intelligence analyst (Gartner/Forrester calibre). For each finding, write "whyItMatters": 1-2 sentences (max 360 chars) on the SO-WHAT for an enterprise buyer or competing service provider — who gains leverage, what shifts in vendor selection/pricing power/switching cost, and what the reader should DO next. Be specific and falsifiable. No filler ("this is significant", "remains to be seen").`,
      tools: [ANALYSIS_SCHEMA as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: "report_analysis" } as unknown as Anthropic.ToolChoice,
      messages: [{
        role: "user",
        content: `Vendor: ${target.name}\n\nClassified findings:\n${clList}\n\nWrite whyItMatters for each (by index). Use report_analysis.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    stage.opus.in  += s3.usage.input_tokens;
    stage.opus.out += s3.usage.output_tokens;

    const s3block = s3.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_analysis");
    const analyses: { idx: number; whyItMatters: string }[] =
      (s3block?.input as { findings?: { idx: number; whyItMatters: string }[] })?.findings ?? [];
    const whyMap = new Map(analyses.map((a) => [a.idx, a.whyItMatters]));

    const findings: MonitorFinding[] = classified
      .filter((c) => whyMap.has(c.idx))
      .slice(0, MAX_ITEMS_PER_VENDOR)
      .map((c) => {
        const raw = rawItems[c.idx]!;
        return {
          dimension: c.dimension,
          title: raw.title,
          summary: c.summary,
          sourceName: raw.sourceName,
          sourceUrl: raw.sourceUrl,
          publishedAt: raw.publishedAt,
          impactScore: c.impactScore,
          confidenceScore: c.confidenceScore,
          sentiment: c.sentiment,
          whyItMatters: whyMap.get(c.idx)!,
        };
      });

    const tokensIn  = stage.haiku.in  + stage.sonnet.in  + stage.opus.in;
    const tokensOut = stage.haiku.out + stage.sonnet.out + stage.opus.out;
    return { vendorId: target.vendorId, vendorName: target.name, findings, searchesUsed, tokensIn, tokensOut, stageTokens: stage, source: "anthropic" };

  } catch (err) {
    return { ...stub, source: "anthropic", error: (err as Error).message };
  }
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
  const totalSearches       = results.reduce((s, r) => s + r.searchesUsed, 0);
  const totalTokensIn       = results.reduce((s, r) => s + r.tokensIn,  0);
  const totalTokensOut      = results.reduce((s, r) => s + r.tokensOut, 0);
  const vendorsWithFindings = results.filter((r) => r.findings.length > 0).length;

  // Accurate tiered cost: sum tokens per model tier across all vendor runs.
  const tH = {
    in:  results.reduce((s, r) => s + r.stageTokens.haiku.in,  0),
    out: results.reduce((s, r) => s + r.stageTokens.haiku.out, 0),
  };
  const tS = {
    in:  results.reduce((s, r) => s + r.stageTokens.sonnet.in,  0),
    out: results.reduce((s, r) => s + r.stageTokens.sonnet.out, 0),
  };
  const tO = {
    in:  results.reduce((s, r) => s + r.stageTokens.opus.in,  0),
    out: results.reduce((s, r) => s + r.stageTokens.opus.out, 0),
  };
  const estimatedCostUsd = parseFloat((
    tH.in * HAIKU_PRICE_IN   + tH.out * HAIKU_PRICE_OUT   +
    tS.in * SONNET_PRICE_IN  + tS.out * SONNET_PRICE_OUT  +
    tO.in * OPUS_PRICE_IN    + tO.out * OPUS_PRICE_OUT    +
    totalSearches * WEB_SEARCH_PRICE
  ).toFixed(4));

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
    modelUsed: `${HAIKU_MODEL}→${SONNET_MODEL}→${OPUS_MODEL}`,
  };
}
