// Curated analyst-coverage scraper for Investor Tools.
// ─────────────────────────────────────────────────────
// Most analyst houses (Gartner, Forrester, IDC, HFS, NelsonHall, ISG)
// gate their full reports behind paywalls, but PUBLICLY publish
// summaries, ratings tables, and press releases on their own sites
// and via vendor co-marketing pages. This module pulls those public
// summaries via Claude with the web_search tool, normalises them, and
// stores them for the Investor Tools surfaces.
//
// Outputs go to a JSON cache that the daily-refresh orchestrator
// persists (no DB schema change needed — same approach as the rest of
// the Investor Tools live data).
//
// IMPORTANT: this scrapes ONLY publicly-available pages. The LLM is
// instructed not to fabricate or guess — when no public coverage is
// found for a given vendor + house, the entry is omitted.

import Anthropic from "@anthropic-ai/sdk";
import { hasLLM } from "../agents/llm-client";
import { INVESTMENT_PROVIDERS } from "./seed";
import type { InvestmentProviderProfile } from "./types";

// Analyst coverage synthesises how Gartner/Forrester/IDC/HFS/NelsonHall/ISG
// position a vendor — the core "expert insight" surface — so it runs on the
// frontier model. Dedicated knob (not the shared ANTHROPIC_MODEL) defaulting to
// Opus 4.8 so a global Sonnet/Haiku setting can't quietly downgrade it.
const DEFAULT_MODEL = process.env.ANTHROPIC_ANALYST_MODEL ?? "claude-opus-4-8";

/* ─── Curated analyst-house manifest ────────────────────────────── */

export interface AnalystHouse {
  id: string;
  name: string;
  /** Public landing URL — Claude starts its search here. */
  publicRoot: string;
}

export const ANALYST_HOUSES: AnalystHouse[] = [
  { id: "gartner",      name: "Gartner",        publicRoot: "https://www.gartner.com/reviews/market" },
  { id: "forrester",    name: "Forrester",      publicRoot: "https://www.forrester.com/research" },
  { id: "idc",          name: "IDC",            publicRoot: "https://www.idc.com" },
  { id: "hfs",          name: "HFS Research",   publicRoot: "https://www.hfsresearch.com" },
  { id: "nelsonhall",   name: "NelsonHall",     publicRoot: "https://research.nelson-hall.com" },
  { id: "isg",          name: "ISG",            publicRoot: "https://isg-one.com" },
];

/* ─── Normalised output shape ───────────────────────────────────── */

export interface AnalystCoverageItem {
  providerId: string;
  houseId: string;
  houseName: string;
  /** Most recent report title or named position the LLM surfaced. */
  reportTitle: string;
  /** e.g. "Leader", "Strong Performer", "Major Contender", "Niche". */
  positioning: string | null;
  /** Year of the most recent report the LLM cited. */
  reportYear: number | null;
  /** Plain-English summary of how the house positions the vendor. */
  summary: string;
  /** Verbatim strengths the house calls out (if any). */
  strengths: string[];
  /** Verbatim cautions the house calls out (if any). */
  cautions: string[];
  /** URL the LLM cited as the public source. */
  sourceUrl: string | null;
  capturedAt: string;
  /** 0..100. Set lower when the LLM admits it couldn't find a recent direct source. */
  confidence: number;
}

export interface AnalystCoverageReport {
  providerId: string;
  itemsFound: number;
  housesAttempted: number;
  error: string | null;
}

/* ─── LLM call: one provider, all six houses in one prompt ─────── */

interface LlmCoverageItem {
  houseId: string;
  reportTitle: string;
  positioning: string | null;
  reportYear: number | null;
  summary: string;
  strengths: string[];
  cautions: string[];
  sourceUrl: string | null;
  confidence: number;
}

async function fetchCoverageForProvider(
  provider: InvestmentProviderProfile,
): Promise<{ items: AnalystCoverageItem[]; report: AnalystCoverageReport }> {
  if (!hasLLM()) {
    return {
      items: [],
      report: {
        providerId: provider.id,
        itemsFound: 0,
        housesAttempted: 0,
        error: "ANTHROPIC_API_KEY not configured",
      },
    };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const houseList = ANALYST_HOUSES.map((h) => `  - ${h.id}: ${h.name} (${h.publicRoot})`).join("\n");
    // Adaptive thinking + high effort so Opus 4.8 actually reasons about how each
    // house positions the vendor rather than skimming the page. max_tokens raised
    // to leave room for the (hidden) thinking pass plus up to six house items.
    // `as unknown as ...` cast mirrors the web_search tool cast — the pinned SDK
    // types lag these GA params; the API accepts them.
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 } as never],
      messages: [{
        role: "user",
        content: `For the vendor "${provider.name}" (AI / enterprise software), search the PUBLIC pages of the six analyst houses below for the most recent named report or rating that mentions this vendor. Use the web_search tool. Look for Gartner Magic Quadrant / Peer Insights, Forrester Wave, IDC MarketScape, HFS Top 10, NelsonHall NEAT, ISG Provider Lens.

Houses:
${houseList}

For each house, return at most ONE item — the most recent public coverage. If nothing public is found, OMIT that house from the array.

Return ONLY a JSON array, no markdown, no preamble:
[
  {
    "houseId": "<one of the ids above>",
    "reportTitle": "<verbatim report title>",
    "positioning": "<Leader | Strong Performer | Visionary | Challenger | Niche | etc., or null>",
    "reportYear": <YYYY integer or null>,
    "summary": "<1-2 sentence neutral summary of how the house positions this vendor>",
    "strengths": ["<verbatim strength 1>", "<verbatim strength 2>"],
    "cautions": ["<verbatim caution 1>"],
    "sourceUrl": "<URL you actually fetched>",
    "confidence": <0..100 integer>
  }
]

Critical:
  - Do NOT fabricate or guess. If no public source mentions the vendor, omit the entry.
  - Cite the URL you actually opened via web_search.
  - Be conservative on confidence: <60 if you only found tangential mentions, 80+ only when you actually fetched a named report page.
  - Write the "summary" in a senior analyst voice: what the house's positioning actually MEANS for an enterprise buyer choosing this vendor — not a restatement of the quadrant label. Make "strengths"/"cautions" decision-useful (capability, delivery, commercial), and quote the house's own language where you can.`,
      }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);
    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("\n");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return {
        items: [],
        report: {
          providerId: provider.id,
          itemsFound: 0,
          housesAttempted: ANALYST_HOUSES.length,
          error: "LLM returned no parseable JSON",
        },
      };
    }
    const parsed = JSON.parse(match[0]) as LlmCoverageItem[];
    const capturedAt = new Date().toISOString();
    const items: AnalystCoverageItem[] = parsed
      .filter((it) => ANALYST_HOUSES.some((h) => h.id === it.houseId))
      .map((it) => {
        const house = ANALYST_HOUSES.find((h) => h.id === it.houseId)!;
        return {
          providerId: provider.id,
          houseId: it.houseId,
          houseName: house.name,
          reportTitle: it.reportTitle,
          positioning: it.positioning,
          reportYear: it.reportYear,
          summary: it.summary,
          strengths: Array.isArray(it.strengths) ? it.strengths.slice(0, 4) : [],
          cautions: Array.isArray(it.cautions) ? it.cautions.slice(0, 4) : [],
          sourceUrl: it.sourceUrl,
          capturedAt,
          confidence: Math.max(0, Math.min(100, Math.round(it.confidence ?? 0))),
        };
      });
    return {
      items,
      report: {
        providerId: provider.id,
        itemsFound: items.length,
        housesAttempted: ANALYST_HOUSES.length,
        error: null,
      },
    };
  } catch (err) {
    return {
      items: [],
      report: {
        providerId: provider.id,
        itemsFound: 0,
        housesAttempted: ANALYST_HOUSES.length,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Fetch analyst coverage for every tracked investment provider that
 * isn't cash or a pure pass-through. Concurrency is capped at 1 so we
 * don't burn through API limits in a burst — each provider triggers
 * up to 6 web searches.
 */
export async function fetchAnalystCoverageForAllProviders(): Promise<{
  items: AnalystCoverageItem[];
  reports: AnalystCoverageReport[];
}> {
  const items: AnalystCoverageItem[] = [];
  const reports: AnalystCoverageReport[] = [];
  const targets = INVESTMENT_PROVIDERS.filter((p) => p.exposureType !== "cash");
  for (const provider of targets) {
    const { items: providerItems, report } = await fetchCoverageForProvider(provider);
    items.push(...providerItems);
    reports.push(report);
  }
  return { items, reports };
}
