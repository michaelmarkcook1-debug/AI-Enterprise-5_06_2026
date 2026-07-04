/**
 * Reddit — developer-sentiment signal via the OFFICIAL OAuth API (ToS-compliant).
 * ─────────────────────────────────────────────────────────────────────────────
 * Reddit blocks unauthenticated access (public .json → HTTP 403) and its
 * commercial data terms REQUIRE a registered app + OAuth2 credentials. So this
 * connector is gated: without REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET it reports
 * "not_configured" and fetches NOTHING — no fabricated rows, no ToS-violating
 * scraping. When the owner registers a Reddit app and sets the creds, it does a
 * client-credentials token exchange and searches the developer subreddits
 * (r/LocalLLaMA, r/ChatGPTCoding, …) read-only, with the required User-Agent.
 *
 * Consumed by the dev-sentiment model as the 4th source (highest volume floor +
 * brigading dedup — the most gameable source, leashed accordingly).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://www.reddit.com/";
const DOCS = "https://www.reddit.com/dev/api/";
const OAUTH = "https://oauth.reddit.com";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
// A descriptive UA is REQUIRED by Reddit's API rules.
const USER_AGENT = "web:ai-enterprise-peer-sentiment:v1.0 (by /u/ai-enterprise)";

export interface RedditQuery {
  subreddit: string; // e.g. "LocalLLaMA"
  q: string; // search terms
  sort?: "top" | "relevance" | "new";
  t?: "year" | "month" | "all";
  limit?: number;
}
interface RedditRecord {
  title: string;
  score: number;
  numComments: number;
  createdUtc: number;
  permalink: string;
}

function credsConfigured(): boolean {
  return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;
async function getToken(): Promise<string | null> {
  if (!credsConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  cachedToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

export const redditConnector: Connector<RedditQuery, RedditRecord> = {
  health(): ConnectorHealth {
    const configured = credsConfigured();
    const last = getLastFetch("reddit");
    return {
      id: "reddit",
      label: "Reddit (OAuth API)",
      group: "developer",
      tier: "developer_signal",
      requiresKey: true,
      envVars: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
      configured,
      status: configured ? "ok" : "not_configured",
      message: configured
        ? undefined
        : "Reddit blocks unauthenticated access and its data terms require a registered app. Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (register at reddit.com/prefs/apps) to enable dev-sentiment ingestion. Until then: no Reddit rows (never fabricated).",
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: "OAuth: 100 req/min. Client-credentials (read-only). Descriptive User-Agent required.",
      defaultEvidenceGrade: "E3",
      defaultConfidenceFloor: 60,
      description: "Developer-subreddit sentiment for coding models (r/LocalLLaMA, r/ChatGPTCoding, …) — the 4th dev-sentiment source.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: RedditQuery): Promise<FetchResult<RedditRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!credsConfigured()) {
      return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: "REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET not set" };
    }
    if (!query?.subreddit || !query?.q) {
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "subreddit + q required" };
    }
    try {
      const token = await getToken();
      if (!token) {
        recordLastFetch("reddit", { ok: false, error: "token exchange failed" });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "OAuth token exchange failed" };
      }
      const params = new URLSearchParams({
        q: query.q,
        restrict_sr: "1",
        sort: query.sort ?? "top",
        t: query.t ?? "year",
        limit: String(query.limit ?? 10),
      });
      const url = `${OAUTH}/r/${encodeURIComponent(query.subreddit)}/search?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT } });
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("reddit", { ok: false, error });
        return { ok: false, status: res.status === 429 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const j = (await res.json()) as { data?: { children?: { data: Record<string, unknown> }[] } };
      const records: RedditRecord[] = (j.data?.children ?? []).map((c) => ({
        title: String(c.data.title ?? ""),
        score: Number(c.data.score ?? 0),
        numComments: Number(c.data.num_comments ?? 0),
        createdUtc: Number(c.data.created_utc ?? 0),
        permalink: `https://www.reddit.com${String(c.data.permalink ?? "")}`,
      }));
      recordLastFetch("reddit", { ok: true, recordCount: records.length });
      return { ok: true, status: "ok", records, recordCount: records.length, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("reddit", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
