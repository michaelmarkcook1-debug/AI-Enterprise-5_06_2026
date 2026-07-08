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
// Deterministic parse of real published numbers; no LLM, no fabrication. No
// key configured, or the request fails → honest absence (null), never a
// fabricated or stale-defaulted score.

import { ORG_TO_VENDOR, normOrg } from "./elo-fetch";

export const ARTIFICIAL_ANALYSIS_BASE_URL = "https://artificialanalysis.ai/api/v2";
export const ARTIFICIAL_ANALYSIS_SOURCE_URL = "https://artificialanalysis.ai/models";

/** Raw shape of one model row from GET /language/models/free (documented free-tier fields only — treat everything as possibly absent rather than assume Pro+-only fields are present). */
export interface AaModelRaw {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  model_creator: { id: string; name: string; country?: string } | null;
  artificial_analysis_intelligence_index: number | null;
  artificial_analysis_coding_index: number | null;
  artificial_analysis_agentic_index: number | null;
  median_output_tokens_per_second: number | null;
  median_time_to_first_token_seconds: number | null;
  price_1m_input_tokens: number | null;
  price_1m_output_tokens: number | null;
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
    const vendorId = ORG_TO_VENDOR[normOrg(creatorName)];
    if (!vendorId) {
      unmapped.add(creatorName);
      continue;
    }
    models.push({
      vendorId,
      modelName: r.name,
      slug: r.slug,
      releaseDate: toIsoDate(r.release_date),
      intelligenceIndex: r.artificial_analysis_intelligence_index,
      codingIndex: r.artificial_analysis_coding_index,
      agenticIndex: r.artificial_analysis_agentic_index,
      outputTokensPerSecond: r.median_output_tokens_per_second,
      priceInputPer1m: r.price_1m_input_tokens,
      priceOutputPer1m: r.price_1m_output_tokens,
    });
  }
  return { models, unmappedCreators: [...unmapped].sort(), sourceUrl: ARTIFICIAL_ANALYSIS_SOURCE_URL };
}

/**
 * Fetch + parse the live Artificial Analysis language-model roster. Never
 * throws. Returns "not_configured" without any network call when no API key
 * is set (matches the Reddit connector's honest-absence convention), "error"
 * on any network/auth/rate-limit/parse failure, or "ok" with the mapped
 * roster. A suspiciously small response (parse likely broke) is also
 * reported as "error" rather than a thin, misleading result.
 */
export async function fetchArtificialAnalysisModels(): Promise<AaFetchOutcome> {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (!apiKey) return { status: "not_configured" };

  try {
    const res = await fetch(`${ARTIFICIAL_ANALYSIS_BASE_URL}/language/models/free`, {
      headers: { "x-api-key": apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { status: "error" };
    const json = (await res.json()) as { data?: AaModelRaw[] } | AaModelRaw[];
    const rows = Array.isArray(json) ? json : (json.data ?? []);
    if (rows.length < 5) return { status: "error" }; // parse almost certainly failed/changed
    const result = mapAaModels(rows);
    return result.models.length > 0 ? { status: "ok", result } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}
