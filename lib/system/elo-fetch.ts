// Arena org→vendor map (+ dormant live Arena-ELO fetch/parse).
// ─────────────────────────────────────────────────────────────
// RETIRED as a scoring source 2026-07-19: model_quality now comes solely from
// Artificial Analysis (model-quality-blend / seedModelQualityPillar), and the ELO
// pillar + its manual seed (elo-scores.ts) were deleted. This module is RETAINED
// only for its org→vendor mapping (ORG_TO_VENDOR / normOrg), which
// artificial-analysis-fetch.ts reuses to map AA's model-creator names to roster
// vendor ids.
//
// The fetch/parse helpers below (fetchArenaElo, parseArenaLeaderboard,
// mapRowsToVendors, ARENA_ELO_SOURCE_URL) have NO remaining caller — they no
// longer feed any score. Kept as dormant, deterministic (no-LLM) reference until
// a follow-up removes them; they read the real published numbers, never invent.

export const ARENA_ELO_SOURCE_URL = "https://openlm.ai/chatbot-arena/";

export interface EloVendorEntry {
  topTwoAvg: number;
  top1: string;
  top2: string;
  models: number;
}

/** Normalised org/name string → roster vendor id. Unknown orgs are skipped.
 *  Exported so the LMArena category fetcher maps orgs identically. */
export const ORG_TO_VENDOR: Record<string, string> = {
  anthropic: "anthropic",
  openai: "openai",
  google: "google", googledeepmind: "google", deepmind: "google",
  xai: "xai",
  zai: "zai", zhipu: "zai", zhipuai: "zai",
  alibaba: "alibaba", alibabacloud: "alibaba", qwen: "alibaba", tongyi: "alibaba",
  meta: "meta", metaai: "meta",
  deepseek: "deepseek",
  moonshot: "moonshot", moonshotai: "moonshot",
  minimax: "minimax",
  mistral: "mistral", mistralai: "mistral",
  cohere: "cohere",
  microsoft: "microsoft",
  perplexity: "perplexity", perplexityai: "perplexity",
  ibm: "ibm",
  ai21: "ai21", ai21labs: "ai21",
  tii: "g42", g42: "g42", falcon: "g42",
  writer: "writer",
  sakana: "sakana", sakanaai: "sakana",
  // Roster model vendors with Arena-ranked models (added after a roster audit —
  // each id is a real platform vendor; harmless if not currently ranked).
  nvidia: "nvidia",
  databricks: "databricks",
  snowflake: "snowflake",
  amazon: "aws", aws: "aws", amazonbedrock: "aws", // Amazon Nova → roster id "aws"
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
export function normOrg(o: string): string {
  return o.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface ArenaRow { model: string; org: string; elo: number; }

/** Parse the openlm.ai sortable leaderboard table. Model = td[1], Arena Elo =
 *  td[2] (first <code>), Organization = second-to-last td (License is last). */
export function parseArenaLeaderboard(html: string): ArenaRow[] {
  const table = html.match(/<table class=sortable[\s\S]*?<\/table>/i)?.[0] ?? "";
  if (!table) return [];
  const rows = table.match(/<tr>[\s\S]*?<\/tr>/gi) ?? [];
  const out: ArenaRow[] = [];
  for (const row of rows) {
    const tds = row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi);
    if (!tds || tds.length < 4) continue; // header (<th>) + malformed rows skipped
    const model = stripTags(tds[1]);
    const elo = parseInt(stripTags(tds[2]), 10);
    const org = stripTags(tds[tds.length - 2]);
    if (!model || !org || !Number.isFinite(elo) || elo < 200 || elo > 3000) continue;
    out.push({ model, org, elo });
  }
  return out;
}

export interface MappedArena {
  vendors: Map<string, EloVendorEntry>;
  /** Distinct org names that ARE ranked on Arena but map to no roster vendor —
   *  the coverage gap. Surfaced so a newly-relevant vendor is never silently
   *  dropped: when one of these is actually on the platform roster, add it to
   *  ORG_TO_VENDOR. */
  unmappedOrgs: string[];
  totalRanked: number;
}

/** Group parsed rows by roster vendor → top-2 Elo average per vendor, and
 *  collect the ranked orgs that mapped to nothing (the coverage gap). */
export function mapRowsToVendors(rows: ArenaRow[]): MappedArena {
  const byVendor = new Map<string, { model: string; elo: number }[]>();
  const unmapped = new Map<string, number>(); // normalised org → count (dedup display)
  for (const r of rows) {
    const vid = ORG_TO_VENDOR[normOrg(r.org)];
    if (!vid) {
      unmapped.set(r.org, (unmapped.get(r.org) ?? 0) + 1);
      continue;
    }
    const arr = byVendor.get(vid) ?? [];
    arr.push({ model: r.model, elo: r.elo });
    byVendor.set(vid, arr);
  }
  const out = new Map<string, EloVendorEntry>();
  for (const [vid, models] of byVendor) {
    models.sort((a, b) => b.elo - a.elo);
    const top = models.slice(0, 2);
    const topTwoAvg = Math.round((top.reduce((s, m) => s + m.elo, 0) / top.length) * 10) / 10;
    out.set(vid, {
      topTwoAvg,
      top1: `${top[0].model} (${top[0].elo})`,
      top2: top[1] ? `${top[1].model} (${top[1].elo})` : "(single ranked model)",
      models: models.length,
    });
  }
  return { vendors: out, unmappedOrgs: [...unmapped.keys()].sort(), totalRanked: rows.length };
}

/**
 * Fetch + parse the live Arena leaderboard → top-2 Elo per roster vendor.
 * Returns null on any failure (network, parse, or a suspiciously small parse)
 * so the caller can fall back to the static map. Never throws.
 */
export async function fetchArenaElo(): Promise<MappedArena | null> {
  try {
    const res = await fetch(ARENA_ELO_SOURCE_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; AnalystGenius/1.0)", accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const rows = parseArenaLeaderboard(await res.text());
    if (rows.length < 20) return null; // parse almost certainly failed/changed
    const mapped = mapRowsToVendors(rows);
    return mapped.vendors.size > 0 ? mapped : null;
  } catch {
    return null;
  }
}
