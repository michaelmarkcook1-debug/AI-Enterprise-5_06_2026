// Live Arena ELO fetch — replaces the hand-maintained snapshot.
// ─────────────────────────────────────────────────────────────
// Fetches openlm.ai/chatbot-arena/ (a static HTML <table class=sortable>),
// parses every ranked model's Arena Elo + organization, maps each org to a
// roster vendor id, and returns the top-2 Elo average per vendor. Deterministic
// parse — no LLM, no fabrication: it reads the real published numbers. Vendors
// whose org isn't on the leaderboard (or isn't in the roster) get nothing —
// honest absence, not an invented score.
//
// Used by seedEloPillarScores() as the PRIMARY source; the static VENDOR_ELO_MAP
// in elo-scores.ts is the fallback if the fetch/parse fails.

export const ARENA_ELO_SOURCE_URL = "https://openlm.ai/chatbot-arena/";

export interface EloVendorEntry {
  topTwoAvg: number;
  top1: string;
  top2: string;
  models: number;
}

/** Normalised org/name string → roster vendor id. Unknown orgs are skipped. */
const ORG_TO_VENDOR: Record<string, string> = {
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
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function normOrg(o: string): string {
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

/** Group parsed rows by roster vendor → top-2 Elo average per vendor. */
export function mapRowsToVendors(rows: ArenaRow[]): Map<string, EloVendorEntry> {
  const byVendor = new Map<string, { model: string; elo: number }[]>();
  for (const r of rows) {
    const vid = ORG_TO_VENDOR[normOrg(r.org)];
    if (!vid) continue;
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
  return out;
}

/**
 * Fetch + parse the live Arena leaderboard → top-2 Elo per roster vendor.
 * Returns null on any failure (network, parse, or a suspiciously small parse)
 * so the caller can fall back to the static map. Never throws.
 */
export async function fetchArenaElo(): Promise<Map<string, EloVendorEntry> | null> {
  try {
    const res = await fetch(ARENA_ELO_SOURCE_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; AnalystGenius/1.0)", accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const rows = parseArenaLeaderboard(await res.text());
    if (rows.length < 20) return null; // parse almost certainly failed/changed
    const mapped = mapRowsToVendors(rows);
    return mapped.size > 0 ? mapped : null;
  } catch {
    return null;
  }
}
