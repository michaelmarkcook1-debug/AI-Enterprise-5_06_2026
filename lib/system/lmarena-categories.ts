// Live LMArena category leaderboards fetch (the official HF dataset).
// ─────────────────────────────────────────────────────────────────────────────
// Source: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset
// API:    https://datasets-server.huggingface.co/rows (public JSON, paged)
//
// Pulls the per-CATEGORY Elo leaderboards (coding, hard prompts, overall,
// instruction-following from the `text` arena; overall from the `vision` arena)
// and returns each roster vendor's TOP ranked model per category. Same provider
// as the headline Arena Elo (elo-fetch.ts), just more capability dimensions — so
// model-quality can be a multi-benchmark blend instead of one number. Deterministic
// parse of real published numbers; no LLM, no fabrication. Vendors/orgs not on a
// leaderboard simply get nothing for that category (honest absence).

import { ORG_TO_VENDOR, normOrg } from "./elo-fetch";
import { MODEL_QUALITY_CATEGORIES, type MqCategory } from "./model-quality-blend";

export const LMARENA_DATASET = "lmarena-ai/leaderboard-dataset";
export const LMARENA_SOURCE_URL = "https://lmarena.ai/leaderboard";
// Two HF datasets-server endpoints:
//  • /filter (server-side WHERE) — used for the `text` arena so we pull ONLY the
//    category we need (a few hundred rows) instead of paging all ~9k rows.
//  • /rows  — fallback (e.g. the `vision` config returns 500 to /filter), paged
//    and filtered client-side. A small arena, so this is cheap.
const FILTER_API = "https://datasets-server.huggingface.co/filter";
const ROWS_API = "https://datasets-server.huggingface.co/rows";

interface HfRow {
  model_name: string;
  organization: string;
  rating: number;
  category: string;
  vote_count: number | null;
  leaderboard_publish_date: string | null;
}

/** One vendor's best model in one category. */
export interface VendorCategoryRating {
  category: MqCategory;
  rating: number;
  modelName: string;
  voteCount: number | null;
  publishDate: string | null;
}

export interface LmarenaCategoryResult {
  /** vendorId → its top model per category (only categories it is ranked in). */
  vendors: Map<string, VendorCategoryRating[]>;
  /** Distinct ranked orgs that map to no roster vendor — the coverage gap. */
  unmappedOrgs: string[];
  /** Configs that actually returned data this run (for diagnostics). */
  configsLoaded: string[];
  sourceUrl: string;
}

// The (config, sourceCategory) pairs we need, derived from the blend definition so
// the fetch and the score stay in lock-step. e.g. text/coding, vision/overall.
const REQUIRED: { config: "text" | "vision"; sourceCategory: string; key: MqCategory }[] =
  MODEL_QUALITY_CATEGORIES.map((c) => ({ config: c.config, sourceCategory: c.sourceCategory, key: c.key }));

async function fetchJsonWithRetry(url: string): Promise<{ rows?: { row: HfRow }[]; num_rows_total?: number }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "AnalystGenius/1.0" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return (await res.json()) as { rows?: { row: HfRow }[]; num_rows_total?: number };
      // 4xx other than 429 won't fix on retry → fail fast so the caller can fall back.
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); // linear backoff
  }
  throw lastErr ?? new Error("fetch failed");
}

async function pageEndpoint(buildUrl: (offset: number, length: number) => string): Promise<HfRow[]> {
  const out: HfRow[] = [];
  let offset = 0;
  const length = 100;
  for (;;) {
    const json = await fetchJsonWithRetry(buildUrl(offset, length));
    const rows = json.rows ?? [];
    for (const r of rows) out.push(r.row);
    offset += length;
    if (rows.length === 0 || offset >= (json.num_rows_total ?? 0)) break;
    if (offset > 20000) break; // safety bound
  }
  return out;
}

// Fetch one (config, leaderboard category). PRIMARY: server-side /filter (only the
// category we need). FALLBACK: paged /rows with a client-side category filter (the
// `vision` config 500s on /filter). Throws only if BOTH fail → caller skips just
// this category (lower coverage, never a fabricated value).
async function fetchCategoryRows(config: string, sourceCategory: string): Promise<HfRow[]> {
  const where = encodeURIComponent(`"category"='${sourceCategory}'`);
  try {
    const rows = await pageEndpoint(
      (offset, length) =>
        `${FILTER_API}?dataset=${encodeURIComponent(LMARENA_DATASET)}&config=${config}&split=latest&where=${where}&offset=${offset}&length=${length}`,
    );
    if (rows.length > 0) return rows;
    // empty filter result (unexpected) → try /rows below
  } catch {
    // fall through to /rows
  }
  const all = await pageEndpoint(
    (offset, length) =>
      `${ROWS_API}?dataset=${encodeURIComponent(LMARENA_DATASET)}&config=${config}&split=latest&offset=${offset}&length=${length}`,
  );
  return all.filter((r) => r.category === sourceCategory);
}

/**
 * Fetch the LMArena category leaderboards and reduce to each roster vendor's TOP
 * model per required category. Each category is fetched INDEPENDENTLY (server-side
 * filtered) so one category failing only drops that category (lower coverage,
 * never a fabricated value). Returns null only when EVERY category fails.
 */
export async function fetchLmarenaCategories(): Promise<LmarenaCategoryResult | null> {
  const vendors = new Map<string, VendorCategoryRating[]>();
  const unmapped = new Set<string>();
  const loaded = new Set<string>();

  // Sequential (a handful of small requests) — gentle on the API, fully tolerant.
  for (const { config, sourceCategory, key } of REQUIRED) {
    let rows: HfRow[];
    try {
      rows = await fetchCategoryRows(config, sourceCategory);
    } catch {
      continue; // honest absence for this category
    }
    loaded.add(`${config}/${sourceCategory}`);
    const best = new Map<string, HfRow>();
    for (const r of rows) {
      if (r.category !== sourceCategory) continue;
      if (!Number.isFinite(r.rating) || r.rating < 200 || r.rating > 3000) continue;
      const vid = ORG_TO_VENDOR[normOrg(r.organization)];
      if (!vid) {
        unmapped.add(r.organization);
        continue;
      }
      const cur = best.get(vid);
      if (!cur || r.rating > cur.rating) best.set(vid, r);
    }
    for (const [vid, r] of best) {
      const arr = vendors.get(vid) ?? [];
      arr.push({
        category: key,
        rating: r.rating,
        modelName: r.model_name,
        voteCount: r.vote_count ?? null,
        publishDate: r.leaderboard_publish_date ?? null,
      });
      vendors.set(vid, arr);
    }
  }

  if (vendors.size === 0) return null;
  return {
    vendors,
    unmappedOrgs: [...unmapped].sort(),
    configsLoaded: [...loaded],
    sourceUrl: LMARENA_SOURCE_URL,
  };
}
