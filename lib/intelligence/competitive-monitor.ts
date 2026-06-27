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
import { listIntelligenceVendors } from "./repository";
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
  /** Why this vendor produced no findings without throwing — e.g. the
   *  web-search loop paused (pause_turn) and wasn't resumed, no search ran,
   *  or the search ran but returned nothing recent. Distinguishes a genuine
   *  "quiet day" from a silent web-search/server-tool failure. */
  noFindingsReason?: string;
  /** stop_reason from the Stage-1 (web-search) response, for diagnosis. */
  stopReason?: string;
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
  /** Count of vendors that completed without error but produced no findings. */
  vendorsNoFindings: number;
  /** A representative diagnostic string surfaced to the admin panel so the
   *  "0 findings" state names the actual cause (API error vs paused search vs
   *  quiet day) instead of guessing "key invalid / limit reached". */
  diagnostic: string;
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
    const s1System = `You are a news-extraction agent. Use web_search to find events for the given vendor in the last ${LOOKBACK_DAYS} days, then call report_raw_findings. Extract facts only — do not categorise, score, or interpret. Include a verbatim excerpt from each source page in the snippet field.`;
    const s1Tools = [
      // allowed_callers: ["direct"] — the 2026-02 web_search tool defaults to
      // requiring PROGRAMMATIC tool calling (server-side dynamic filtering),
      // which Haiku 4.5 does not support → 400 invalid_request_error. Forcing
      // direct invocation keeps web_search working on the Haiku extraction tier.
      { type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: MAX_SEARCHES_PER_VENDOR, allowed_callers: ["direct"] } as unknown as Anthropic.Tool,
      RAW_FINDINGS_SCHEMA as unknown as Anthropic.Tool,
    ];
    const s1Messages: Anthropic.MessageParam[] = [{
      role: "user",
      content: `Vendor: ${target.name}${target.aliases.length ? ` (aka ${target.aliases.join(", ")})` : ""}. Domain: ${target.domain}. Today: ${todayIso}.

Search for events in the last ${LOOKBACK_DAYS} days across: new products/models/capabilities, pricing changes, partnerships/integrations, executive changes, analyst mentions, funding rounds.

Use up to ${MAX_SEARCHES_PER_VENDOR} web_search calls. Return up to 6 items via report_raw_findings. For each item set sourceUrl to the exact https:// URL you fetched.`,
    }];

    // The web_search server tool runs a server-side loop that returns
    // stop_reason "pause_turn" when it hits its iteration cap BEFORE the model
    // emits report_raw_findings. Resume the turn by re-sending with the
    // assistant's partial content appended (no extra user turn) until it
    // finishes or we hit the continuation cap. Without this, a paused search
    // silently yields zero findings — which previously looked identical to an
    // outright failure (0 findings, 0 errors) on the admin panel.
    const MAX_PAUSE_CONTINUATIONS = 3;
    let s1stopReason = "";
    const rawBlocks: Anthropic.ToolUseBlock[] = [];
    for (let attempt = 0; attempt <= MAX_PAUSE_CONTINUATIONS; attempt++) {
      const s1 = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 3000,
        system: s1System,
        tools: s1Tools,
        messages: s1Messages,
      } as unknown as Anthropic.MessageCreateParamsNonStreaming);

      stage.haiku.in  += s1.usage.input_tokens;
      stage.haiku.out += s1.usage.output_tokens;
      searchesUsed    += (s1.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
      s1stopReason = s1.stop_reason ?? "";

      for (const b of s1.content) {
        if (b.type === "tool_use" && b.name === "report_raw_findings") rawBlocks.push(b as Anthropic.ToolUseBlock);
      }
      if (s1.stop_reason !== "pause_turn") break;
      s1Messages.push({ role: "assistant", content: s1.content });
    }

    const rawItems: RawFinding[] = rawBlocks
      .flatMap((blk) => ((blk.input as { findings?: RawFinding[] })?.findings ?? []))
      .filter((f) => typeof f.title === "string" && typeof f.sourceUrl === "string"
        && f.sourceUrl.startsWith("https://") && isRecent(f.publishedAt, today));

    if (rawItems.length === 0) {
      // Name the cause so the admin panel stops guessing "key invalid".
      const reason = s1stopReason === "pause_turn"
        ? `web_search still paused after ${MAX_PAUSE_CONTINUATIONS} continuations`
        : searchesUsed === 0
        ? "no web_search performed — web search may be disabled/ungated on this key or plan"
        : "web_search ran but returned no qualifying recent items (possibly a quiet window)";
      return { ...stub, searchesUsed, stageTokens: stage, source: "anthropic",
        tokensIn: stage.haiku.in, tokensOut: stage.haiku.out,
        stopReason: s1stopReason, noFindingsReason: reason };
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
      // tool_choice MUST be "auto" (not a forced tool) whenever `thinking` is
      // enabled — the API rejects forced tool use + thinking with a 400
      // ("Thinking may not be enabled when tool_choice forces tool use"), which
      // was zeroing out EVERY vendor that reached Stage 3. With a single tool +
      // an explicit instruction Opus reliably calls it after thinking; the
      // assembly below tolerates a missed call so a vendor run is never lost.
      tool_choice: { type: "auto" } as unknown as Anthropic.ToolChoice,
      messages: [{
        role: "user",
        content: `Vendor: ${target.name}\n\nClassified findings:\n${clList}\n\nWrite whyItMatters for each (by index). You MUST call report_analysis with one entry per index — do not answer in prose.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    stage.opus.in  += s3.usage.input_tokens;
    stage.opus.out += s3.usage.output_tokens;

    const s3block = s3.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_analysis");
    const analyses: { idx: number; whyItMatters: string }[] =
      (s3block?.input as { findings?: { idx: number; whyItMatters: string }[] })?.findings ?? [];
    const whyMap = new Map(analyses.map((a) => [a.idx, a.whyItMatters]));

    // Keep every classified finding even if Stage 3 (analyst commentary) missed
    // one. Stage 3 uses tool_choice:auto (required alongside thinking), so an
    // occasional missing whyItMatters is possible — but it must NOT discard an
    // otherwise-complete finding (real title, source, dimension, scores).
    const findings: MonitorFinding[] = classified
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
          whyItMatters: whyMap.get(c.idx)
            ?? `Assess the impact on ${target.name}'s competitive position, pricing leverage, and vendor selection.`,
        };
      });

    const tokensIn  = stage.haiku.in  + stage.sonnet.in  + stage.opus.in;
    const tokensOut = stage.haiku.out + stage.sonnet.out + stage.opus.out;
    return { vendorId: target.vendorId, vendorName: target.name, findings, searchesUsed, tokensIn, tokensOut, stageTokens: stage, source: "anthropic" };

  } catch (err) {
    // Capture HTTP status + Anthropic error type, not just the message, so the
    // panel can tell 401 (key invalid) from 429 (rate limit) from 400 billing
    // ("credit balance too low") from 404 (model_not_found).
    const e = err as { status?: number; error?: { type?: string }; type?: string; message?: string };
    const status = e?.status ? `${e.status} ` : "";
    const type = e?.error?.type ?? e?.type ?? "";
    const msg = (err as Error)?.message ?? String(err);
    return { ...stub, source: "anthropic", error: `${status}${type ? type + ": " : ""}${msg}`.slice(0, 300) };
  }
}

// Roles excluded from the competitive NEWS feed (they sit on the market map,
// not the news stream) — matches the documented COMPETITIVE_TARGETS scope.
const NEWS_EXCLUDED_ROLES = new Set(["Investor"]);

/**
 * Resolve the monitor's target set from the LIVE vendor roster, so every vendor
 * in the spine is tracked — and any vendor added later is covered automatically,
 * with no hand-maintained list to fall out of date (non-negotiable: no vendor
 * goes untracked). Curated metadata (aliases/domain) from COMPETITIVE_TARGETS is
 * used where we have it; otherwise a target is derived from the vendor's own
 * name, which web_search resolves to real, cited sources. Pure investors are
 * excluded. Falls back to the static list if the DB is unreachable or empty.
 */
export async function resolveCompetitiveTargets(): Promise<CompetitiveTarget[]> {
  const curatedById = new Map(COMPETITIVE_TARGETS.map((t) => [t.vendorId, t]));
  let vendors: Awaited<ReturnType<typeof listIntelligenceVendors>>;
  try {
    vendors = await listIntelligenceVendors();
  } catch {
    return COMPETITIVE_TARGETS;
  }
  if (!vendors.length) return COMPETITIVE_TARGETS;

  const targets: CompetitiveTarget[] = [];
  for (const v of vendors) {
    const roles = v.roleTags ?? [];
    // Skip pure investors (every role is an excluded role).
    if (roles.length > 0 && roles.every((r) => NEWS_EXCLUDED_ROLES.has(r))) continue;
    const curated = curatedById.get(v.id);
    if (curated) {
      targets.push(curated);
    } else {
      targets.push({
        vendorId: v.id,
        name: v.name,
        aliases: [],
        domain: "",
      });
    }
  }
  return targets;
}

/**
 * Run the competitive-intelligence monitor across all targets, persisting
 * new findings into IntelligenceNewsItem. Idempotent.
 *
 * With no explicit `opts.targets`, the target set is resolved from the LIVE
 * roster (resolveCompetitiveTargets) so the full sweep tracks every vendor,
 * including ones added after this code shipped.
 */
export async function runCompetitiveIntelMonitor(
  now: Date = new Date(),
  opts: { targets?: CompetitiveTarget[] } = {},
): Promise<MonitorRunResult> {
  const ranAt = now.toISOString();
  const targets = opts.targets ?? (await resolveCompetitiveTargets());
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

  // Vendors that completed WITHOUT throwing but produced no findings — the
  // case that previously read as a hard failure on the panel.
  const vendorsNoFindings = results.filter((r) => !r.error && r.findings.length === 0).length;

  // One representative line explaining the run for the admin panel: prefer a
  // real API error (now status+type-tagged), else the most common no-findings
  // reason, else a generic note. Never claim "key invalid" when nothing threw.
  let diagnostic = "";
  if (errors.length > 0) {
    diagnostic = `API error (${errors.length}/${targets.length} vendors): ${errors[0].error}`;
  } else if (vendorsWithFindings === 0 && results.length > 0) {
    const reasons = results.map((r) => r.noFindingsReason).filter((x): x is string => Boolean(x));
    diagnostic = reasons[0]
      ? `No errors thrown; ${reasons[0]}.`
      : "No errors thrown, but all vendors returned zero findings.";
  } else {
    diagnostic = `${vendorsWithFindings}/${targets.length} vendors returned findings.`;
  }

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
    vendorsNoFindings,
    diagnostic,
  };
}
