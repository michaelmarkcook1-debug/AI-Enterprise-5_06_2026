// Curated analyst-coverage scraper for Investor Tools.
// ─────────────────────────────────────────────────────
// Three-stage tiered pipeline per provider:
//   Stage 1 — Haiku + web_search: raw scraping (search each house, extract facts)
//   Stage 2 — Sonnet:             normalisation (clean, structure, score confidence)
//   Stage 3 — Opus:               analyst voice (what the positioning MEANS for a buyer)
//
// Scrapes ONLY publicly-available pages. The LLM is instructed not to
// fabricate — when no public coverage is found for a house, it is omitted.
//
// Incremental saves per provider: each provider's results are written to
// the live cache immediately after Stage 3, so a cron timeout on provider
// N+1 doesn't lose the completed work for providers 1..N.
// Concurrency is capped at PROVIDER_CONCURRENCY (5) to keep web-search
// API usage well-behaved across the ~35-provider universe.

import Anthropic from "@anthropic-ai/sdk";
import { hasLLM } from "../agents/llm-client";
import { saveAnalystCoverage } from "./live-cache";
import { INVESTMENT_PROVIDERS } from "./seed";
import type { InvestmentProviderProfile } from "./types";

// Three-tier model pipeline. Each tier has a dedicated env knob.
// ANTHROPIC_EXTRACT_MODEL  → Haiku  (web-search ingestion)
// ANTHROPIC_MODEL          → Sonnet (normalisation / confidence scoring)
// ANTHROPIC_ANALYST_MODEL  → Opus   (analyst voice / strategic summary)
const HAIKU_MODEL  = process.env.ANTHROPIC_EXTRACT_MODEL  ?? "claude-haiku-4-5";
const SONNET_MODEL = process.env.ANTHROPIC_MODEL           ?? "claude-sonnet-4-6";
const OPUS_MODEL   = process.env.ANTHROPIC_ANALYST_MODEL   ?? "claude-opus-4-8";

const PROVIDER_CONCURRENCY = 5;

/* ─── Analyst-house manifest ───────────────────────────────────── */

export interface AnalystHouse {
  id: string;
  name: string;
  publicRoot: string;
}

export const ANALYST_HOUSES: AnalystHouse[] = [
  { id: "gartner",    name: "Gartner",      publicRoot: "https://www.gartner.com/reviews/market" },
  { id: "forrester",  name: "Forrester",    publicRoot: "https://www.forrester.com/research" },
  { id: "idc",        name: "IDC",          publicRoot: "https://www.idc.com" },
  { id: "hfs",        name: "HFS Research", publicRoot: "https://www.hfsresearch.com" },
  { id: "nelsonhall", name: "NelsonHall",   publicRoot: "https://research.nelson-hall.com" },
  { id: "isg",        name: "ISG",          publicRoot: "https://isg-one.com" },
];

const HOUSE_IDS = ANALYST_HOUSES.map((h) => h.id);

/* ─── Output shape ─────────────────────────────────────────────── */

export interface AnalystCoverageItem {
  providerId: string;
  houseId: string;
  houseName: string;
  reportTitle: string;
  positioning: string | null;
  reportYear: number | null;
  summary: string;
  strengths: string[];
  cautions: string[];
  sourceUrl: string | null;
  capturedAt: string;
  confidence: number;
}

export interface AnalystCoverageReport {
  providerId: string;
  itemsFound: number;
  housesAttempted: number;
  error: string | null;
}

/* ─── Intermediate pipeline types ────────────────────────────────── */

interface RawHouseItem {
  houseId: string;
  reportTitle: string;
  positioning: string | null;
  reportYear: number | null;
  rawText: string;       // verbatim excerpt from the source page
  strengths: string[];
  cautions: string[];
  sourceUrl: string | null;
}

interface NormalisedHouseItem {
  idx: number;           // 0-based index into rawHouses[]
  confidence: number;
  cleanedStrengths: string[];
  cleanedCautions: string[];
}

/* ─── Tool schemas ──────────────────────────────────────────────── */

const RAW_COVERAGE_SCHEMA = {
  name: "report_raw_coverage",
  description: "Report raw analyst-house coverage data found via web search — factual extraction only.",
  input_schema: {
    type: "object",
    properties: {
      houses: {
        type: "array",
        items: {
          type: "object",
          required: ["houseId", "reportTitle"],
          properties: {
            houseId:     { type: "string", enum: HOUSE_IDS },
            reportTitle: { type: "string" },
            positioning: { type: "string" },
            reportYear:  { type: "integer" },
            rawText:     { type: "string", maxLength: 600, description: "Verbatim excerpt from the source page." },
            strengths:   { type: "array", items: { type: "string" } },
            cautions:    { type: "array", items: { type: "string" } },
            sourceUrl:   { type: "string" },
          },
        },
      },
    },
    required: ["houses"],
  },
} as const;

const NORMALISE_SCHEMA = {
  name: "report_normalised_coverage",
  description: "Normalise each raw coverage item: validate, score confidence, clean strengths/cautions.",
  input_schema: {
    type: "object",
    properties: {
      houses: {
        type: "array",
        items: {
          type: "object",
          required: ["idx", "confidence", "cleanedStrengths", "cleanedCautions"],
          properties: {
            idx:              { type: "integer", description: "0-based index into the raw houses list." },
            confidence:       { type: "integer", minimum: 0, maximum: 100, description: "0-100. Use 80+ only when you fetched a named report page directly. Under 60 for tangential mentions." },
            cleanedStrengths: { type: "array", maxItems: 4, items: { type: "string" } },
            cleanedCautions:  { type: "array", maxItems: 4, items: { type: "string" } },
          },
        },
      },
    },
    required: ["houses"],
  },
} as const;

const SUMMARY_SCHEMA = {
  name: "report_coverage_summaries",
  description: "Write senior analyst voice summaries for each normalised coverage item.",
  input_schema: {
    type: "object",
    properties: {
      houses: {
        type: "array",
        items: {
          type: "object",
          required: ["idx", "summary"],
          properties: {
            idx:     { type: "integer" },
            summary: { type: "string", description: "1-2 sentence senior analyst voice: what this positioning MEANS for an enterprise buyer — not a restatement of the label. Decision-relevant." },
          },
        },
      },
    },
    required: ["houses"],
  },
} as const;

/* ─── Single-provider 3-stage pipeline ─────────────────────────── */

async function fetchCoverageForProvider(
  provider: InvestmentProviderProfile,
): Promise<{ items: AnalystCoverageItem[]; report: AnalystCoverageReport }> {
  if (!hasLLM()) {
    return { items: [], report: { providerId: provider.id, itemsFound: 0, housesAttempted: 0, error: "ANTHROPIC_API_KEY not configured" } };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const houseList = ANALYST_HOUSES.map((h) => `  - ${h.id}: ${h.name} (${h.publicRoot})`).join("\n");

    // ── Stage 1: Haiku + web_search — raw scraping ───────────────
    // Haiku searches each analyst house for the vendor and extracts raw
    // facts: report title, positioning label, year, verbatim text, URL.
    // No interpretation — just find and report what's publicly available.
    const s1 = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 4000,
      system: `You are a web-scraping agent. Search analyst-house websites for publicly available coverage of a specific vendor. Extract raw facts only — do not interpret, score, or paraphrase. Report verbatim text from each page you find.`,
      tools: [
        // allowed_callers: ["direct"] — the 2026-02 web_search tool defaults to
        // requiring programmatic tool calling, unsupported on Haiku (400). Force direct.
        { type: "web_search_20260209", name: "web_search", max_uses: 6, allowed_callers: ["direct"] } as never,
        RAW_COVERAGE_SCHEMA as unknown as Anthropic.Tool,
      ],
      messages: [{
        role: "user",
        content: `Vendor: "${provider.name}" (AI / enterprise software / BPO).

Search these analyst houses for public coverage of this vendor:
${houseList}

For each house, search for: [vendor name] + [house report type], e.g. "Accenture Gartner Magic Quadrant" or "Accenture Forrester Wave".

For each house where you find PUBLIC coverage, extract:
- houseId (one of the ids above)
- reportTitle (verbatim)
- positioning (Leader / Visionary / Strong Performer / etc., or omit if not stated)
- reportYear (YYYY integer)
- rawText (verbatim 2-3 sentence excerpt from the page)
- strengths (raw bullet points from the page, if any)
- cautions (raw cautions/weaknesses, if any)
- sourceUrl (the exact URL you fetched)

Omit a house entirely if you find NO public coverage. Do NOT fabricate. Call report_raw_coverage with your findings.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    const s1block = s1.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_raw_coverage");
    const rawHouses: RawHouseItem[] = ((s1block?.input as { houses?: RawHouseItem[] })?.houses ?? [])
      .filter((h) => HOUSE_IDS.includes(h.houseId) && typeof h.reportTitle === "string");

    if (rawHouses.length === 0) {
      return { items: [], report: { providerId: provider.id, itemsFound: 0, housesAttempted: ANALYST_HOUSES.length, error: null } };
    }

    // ── Stage 2: Sonnet — normalise and score confidence ─────────
    // Sonnet receives the raw house data and assigns confidence scores,
    // cleans up strengths/cautions to 4 items max, and validates the data.
    const rawList = rawHouses
      .map((h, i) => `[${i}] ${h.houseId} | ${h.reportTitle} | ${h.positioning ?? "no label"} (${h.reportYear ?? "year unknown"})\nURL: ${h.sourceUrl ?? "none"}\nText: ${h.rawText ?? ""}\nStrengths: ${(h.strengths ?? []).join("; ")}\nCautions: ${(h.cautions ?? []).join("; ")}`)
      .join("\n\n");

    const s2 = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1500,
      system: "You are a data normalisation agent. Clean and validate analyst-coverage items: score confidence, deduplicate and limit strengths/cautions to 4 items each. No interpretation.",
      tools: [NORMALISE_SCHEMA as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: "report_normalised_coverage" } as unknown as Anthropic.ToolChoice,
      messages: [{
        role: "user",
        content: `Vendor: "${provider.name}"\n\nRaw analyst-house coverage items:\n${rawList}\n\nFor each item (by 0-based index):\n- confidence: 0-100 (80+ = fetched a named report page directly; <60 = only tangential mentions)\n- cleanedStrengths: up to 4 items, verbatim but trimmed\n- cleanedCautions: up to 4 items, verbatim but trimmed\n\nCall report_normalised_coverage.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    const s2block = s2.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_normalised_coverage");
    const normalised: NormalisedHouseItem[] = ((s2block?.input as { houses?: NormalisedHouseItem[] })?.houses ?? [])
      .filter((n) => rawHouses[n.idx] !== undefined);

    if (normalised.length === 0) {
      return { items: [], report: { providerId: provider.id, itemsFound: 0, housesAttempted: ANALYST_HOUSES.length, error: null } };
    }

    // ── Stage 3: Opus — analyst voice summary ────────────────────
    // Opus receives the structured, validated data and writes a 1-2
    // sentence "summary" for each house item: what the positioning MEANS
    // for an enterprise buyer, not a restatement of the quadrant label.
    const structuredList = normalised
      .map((n) => {
        const raw = rawHouses[n.idx]!;
        return `[${n.idx}] ${raw.houseId} | ${raw.reportTitle} | ${raw.positioning ?? "no label"} (${raw.reportYear ?? "year unknown"})\nStrengths: ${n.cleanedStrengths.join("; ") || "none"}\nCautions: ${n.cleanedCautions.join("; ") || "none"}\nSource text: ${raw.rawText ?? ""}`;
      })
      .join("\n\n");

    const s3 = await client.messages.create({
      model: OPUS_MODEL,
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: `You are a senior analyst (Gartner/Forrester/IDC calibre) writing decision-useful coverage summaries. For each house item, write 1-2 sentences explaining what the house's positioning MEANS for an enterprise buyer: capability gaps to probe, commercial leverage to expect, risks to mitigate, who this vendor is right for. Not a restatement of the label. Make "strengths" and "cautions" decision-useful (capability, delivery, commercial).`,
      tools: [SUMMARY_SCHEMA as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: "report_coverage_summaries" } as unknown as Anthropic.ToolChoice,
      messages: [{
        role: "user",
        content: `Vendor: "${provider.name}"\n\nNormalised analyst-house coverage:\n${structuredList}\n\nWrite a summary for each item (by index). Call report_coverage_summaries.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    const s3block = s3.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_coverage_summaries");
    const summaries: { idx: number; summary: string }[] =
      (s3block?.input as { houses?: { idx: number; summary: string }[] })?.houses ?? [];
    const summaryMap = new Map(summaries.map((s) => [s.idx, s.summary]));

    // Merge all three stages into the final AnalystCoverageItem shape.
    const capturedAt = new Date().toISOString();
    const items: AnalystCoverageItem[] = normalised
      .map((n) => {
        const raw = rawHouses[n.idx];
        const house = ANALYST_HOUSES.find((h) => h.id === raw?.houseId);
        if (!raw || !house) return null;
        return {
          providerId: provider.id,
          houseId: raw.houseId,
          houseName: house.name,
          reportTitle: raw.reportTitle,
          positioning: raw.positioning ?? null,
          reportYear: raw.reportYear ?? null,
          summary: summaryMap.get(n.idx) ?? "",
          strengths: n.cleanedStrengths,
          cautions: n.cleanedCautions,
          sourceUrl: raw.sourceUrl ?? null,
          capturedAt,
          confidence: Math.max(0, Math.min(100, Math.round(n.confidence))),
        };
      })
      .filter((item): item is AnalystCoverageItem => item !== null && item.summary.length > 0);

    return { items, report: { providerId: provider.id, itemsFound: items.length, housesAttempted: ANALYST_HOUSES.length, error: null } };

  } catch (err) {
    return { items: [], report: { providerId: provider.id, itemsFound: 0, housesAttempted: ANALYST_HOUSES.length, error: err instanceof Error ? err.message : String(err) } };
  }
}

/**
 * Fetch analyst coverage for every tracked investment provider.
 * Runs up to PROVIDER_CONCURRENCY (5) providers in parallel. Each
 * provider's results are saved incrementally so a cron timeout on a
 * later provider doesn't lose results from earlier ones.
 */
export async function fetchAnalystCoverageForAllProviders(): Promise<{
  items: AnalystCoverageItem[];
  reports: AnalystCoverageReport[];
}> {
  const allItems: AnalystCoverageItem[] = [];
  const allReports: AnalystCoverageReport[] = [];
  const targets = INVESTMENT_PROVIDERS.filter((p) => p.exposureType !== "cash");

  for (let i = 0; i < targets.length; i += PROVIDER_CONCURRENCY) {
    const batch = targets.slice(i, i + PROVIDER_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fetchCoverageForProvider));

    for (const { items, report } of batchResults) {
      allItems.push(...items);
      allReports.push(report);
    }

    // Incremental save: persist this batch's coverage immediately so a
    // timeout processing later batches doesn't discard completed work.
    const batchItems = batchResults.flatMap((r) => r.items);
    if (batchItems.length > 0) {
      await saveAnalystCoverage(batchItems);
    }
  }

  return { items: allItems, reports: allReports };
}
