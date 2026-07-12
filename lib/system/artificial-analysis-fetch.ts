// Live Artificial Analysis Data API fetch — the model_quality source.
// ─────────────────────────────────────────────────────────────────────────────
// Replaces LMArena (lmarena-categories.ts / elo-fetch.ts). Uses the OFFICIAL,
// documented Data API (https://artificialanalysis.ai/data-api/docs) — never
// the artificialanalysis.ai website itself, whose Terms of Use explicitly
// prohibit scraping/automated access and restrict use to personal,
// noncommercial purposes. The Data API is the separate, licensed product
// built for exactly this kind of third-party integration; it requires its
// own API key (ARTIFICIAL_ANALYSIS_API_KEY) and mandates attribution
// ("credit Artificial Analysis as the source") wherever the data is shown —
// every UI surface reading this data must carry that citation.
//
// Response shape verified against the LIVE API (2026-07-08, 548 models):
// per-model fields are NESTED under `evaluations` / `pricing` / `performance`
// objects, and the list is PAGINATED (page_size 200) — both differ from a
// naive reading of the docs, so don't "simplify" back to a flat, single-page
// parse.
//
// Deterministic parse of real published numbers; no LLM, no fabrication. No
// key configured, or the request fails → honest absence (null), never a
// fabricated or stale-defaulted score.

import { ORG_TO_VENDOR, normOrg } from "./elo-fetch";

export const ARTIFICIAL_ANALYSIS_BASE_URL = "https://artificialanalysis.ai/api/v2";
export const ARTIFICIAL_ANALYSIS_SOURCE_URL = "https://artificialanalysis.ai/models";

// Creators Artificial Analysis names differently from the shared Arena org
// map — verified against the live roster (Kimi is Moonshot's model brand;
// TII UAE is the Falcon/G42 line; ServiceNow is a roster vendor Arena never
// listed; "SpaceXAI" is AA's own creator label for xAI's Grok models —
// confirmed 2026-07-12 by fetching the live API and inspecting sample model
// names under that creator: "Grok 4.20 0309 (Reasoning)", "Grok Build 0.1
// 0616", "Grok 4.1 Fast (Reasoning)"). Checked in mapAaModels AFTER
// ORG_TO_VENDOR so the shared map stays the single source for common names.
const AA_CREATOR_TO_VENDOR: Record<string, string> = {
  kimi: "moonshot",
  tiiuae: "g42",
  servicenow: "servicenow",
  spacexai: "xai",
};

/** Raw shape of one model row from GET /language/models/free — verified live
 *  2026-07-08. Treat every leaf as possibly absent. */
export interface AaModelRaw {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  model_creator: { id: string; name: string } | null;
  evaluations: {
    artificial_analysis_intelligence_index: number | null;
    artificial_analysis_coding_index: number | null;
    artificial_analysis_agentic_index: number | null;
  } | null;
  pricing: {
    price_1m_input_tokens: number | null;
    price_1m_output_tokens: number | null;
  } | null;
  performance: {
    median_output_tokens_per_second: number | null;
    median_time_to_first_token_seconds: number | null;
  } | null;
}

/** One roster vendor's real model, ready to feed the blend + seed layers. */
export interface AaModel {
  vendorId: string;
  modelName: string;
  slug: string;
  releaseDate: string | null; // YYYY-MM-DD, real per-model date (unlike LMArena)
  intelligenceIndex: number | null;
  codingIndex: number | null;
  agenticIndex: number | null;
  outputTokensPerSecond: number | null;
  timeToFirstTokenSeconds: number | null;
  priceInputPer1m: number | null;
  priceOutputPer1m: number | null;
}

export interface AaFetchResult {
  models: AaModel[];
  /** Ranked creator names that mapped to no roster vendor — the coverage gap. */
  unmappedCreators: string[];
  sourceUrl: string;
}

export type AaFetchOutcome =
  | { status: "ok"; result: AaFetchResult }
  | { status: "not_configured" } // no ARTIFICIAL_ANALYSIS_API_KEY set
  | { status: "error" }; // network/parse/rate-limit failure — never fabricate

function toIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Parse the raw API rows into roster-mapped models. Pure — no network. */
export function mapAaModels(rows: AaModelRaw[]): AaFetchResult {
  const models: AaModel[] = [];
  const unmapped = new Set<string>();
  for (const r of rows) {
    const creatorName = r.model_creator?.name;
    if (!creatorName) continue;
    const key = normOrg(creatorName);
    const vendorId = ORG_TO_VENDOR[key] ?? AA_CREATOR_TO_VENDOR[key];
    if (!vendorId) {
      unmapped.add(creatorName);
      continue;
    }
    models.push({
      vendorId,
      modelName: r.name,
      slug: r.slug,
      releaseDate: toIsoDate(r.release_date),
      intelligenceIndex: r.evaluations?.artificial_analysis_intelligence_index ?? null,
      codingIndex: r.evaluations?.artificial_analysis_coding_index ?? null,
      agenticIndex: r.evaluations?.artificial_analysis_agentic_index ?? null,
      outputTokensPerSecond: r.performance?.median_output_tokens_per_second ?? null,
      timeToFirstTokenSeconds: r.performance?.median_time_to_first_token_seconds ?? null,
      priceInputPer1m: r.pricing?.price_1m_input_tokens ?? null,
      priceOutputPer1m: r.pricing?.price_1m_output_tokens ?? null,
    });
  }
  return { models, unmappedCreators: [...unmapped].sort(), sourceUrl: ARTIFICIAL_ANALYSIS_SOURCE_URL };
}

interface AaPage {
  pagination?: { page: number; total_pages: number; has_more: boolean };
  data?: AaModelRaw[];
}

// Runaway/quota guard well above the observed 3 pages; free tier allows 100
// requests/day, so even the guard ceiling spends only a tenth of the budget.
const MAX_PAGES = 10;

/**
 * Fetch + parse the live Artificial Analysis language-model roster (ALL
 * pages). Never throws. Returns "not_configured" without any network call
 * when no API key is set (matches the Reddit connector's honest-absence
 * convention), "error" on any network/auth/rate-limit/parse failure — a
 * PARTIAL page set is also an error, since a truncated roster could silently
 * drop a vendor's flagship — or "ok" with the fully-mapped roster.
 */
export async function fetchArtificialAnalysisModels(): Promise<AaFetchOutcome> {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (!apiKey) return { status: "not_configured" };

  try {
    const rows: AaModelRaw[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${ARTIFICIAL_ANALYSIS_BASE_URL}/language/models/free?page=${page}`, {
        headers: { "x-api-key": apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { status: "error" };
      const json = (await res.json()) as AaPage;
      rows.push(...(json.data ?? []));
      if (!json.pagination?.has_more) break;
      if (page === MAX_PAGES) return { status: "error" }; // still more? treat as parse drift
    }
    if (rows.length < 5) return { status: "error" }; // parse almost certainly failed/changed
    const result = mapAaModels(rows);
    return result.models.length > 0 ? { status: "ok", result } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}
