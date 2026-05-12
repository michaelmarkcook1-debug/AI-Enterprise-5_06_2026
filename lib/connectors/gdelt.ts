/**
 * GDELT — global news/event monitoring. No API key required.
 * Treat as SIGNAL not proof — must not become a verified factual claim.
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
const HOME = "https://www.gdeltproject.org/";
const DOCS = "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/";
const API = "https://api.gdeltproject.org/api/v2/doc/doc";
export interface GdeltQuery { query: string; mode?: "ArtList" | "TimelineVolRaw" | "TimelineTone"; maxRecords?: number; format?: "json" | "csv"; }
interface GdeltArticle { url?: string; title?: string; seendate?: string; domain?: string; tone?: number }
interface GdeltRecord { mode: string; articles: GdeltArticle[] }
export const gdeltConnector: Connector<GdeltQuery, GdeltRecord> = {
  health(): ConnectorHealth {
    const last = getLastFetch("gdelt");
    return {
      id: "gdelt", label: "GDELT (Global Database of Events, Language, and Tone)", group: "news_event", tier: "reputable_news",
      requiresKey: false, envVars: [], configured: true, status: "ok",
      homepageUrl: HOME, apiDocsUrl: DOCS,
      rateLimitNotes: "Public, no key. Polite use expected.",
      defaultEvidenceGrade: "E2", defaultConfidenceFloor: 50,
      description: "Global news + event monitoring. Treat as signal — never as verified fact.",
      lastFetchAt: last?.at, lastFetchOk: last?.ok, lastFetchError: last?.error, lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: GdeltQuery): Promise<FetchResult<GdeltRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.query) return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "query required" };
    const params = new URLSearchParams({
      query: query.query,
      mode: query.mode ?? "ArtList",
      maxrecords: String(query.maxRecords ?? 25),
      format: query.format ?? "json",
    });
    const url = `${API}?${params.toString()}`;
    // GDELT routinely takes 10–30s, has an undocumented per-query
    // soft rate limit, AND occasionally drops connections at the TLS
    // layer when called from undici (Node's fetch implementation).
    // Direct curl from the same host typically works fine. Strategy:
    //   - 45s timeout to bound worst case
    //   - one automatic retry on a generic "fetch failed" undici error
    //   - rate-limit detection (HTTP 429 OR HTML response)
    const TIMEOUT_MS = 45_000;
    const MAX_ATTEMPTS = 2;
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        const isRate = res.status === 429;
        recordLastFetch("gdelt", { ok: false, error });
        return {
          ok: false,
          status: isRate ? "rate_limited" : "error",
          records: [], recordCount: 0, fetchedAt, error, sourceUrl: url,
        };
      }
      // Detect HTML rate-limit pages (GDELT returns 200 + HTML, not JSON,
      // when it soft-rate-limits a query).
      const text = await res.text();
      if (text.trimStart().startsWith("<") || text.startsWith("Your search")) {
        const snippet = text.slice(0, 120).replace(/\s+/g, " ");
        recordLastFetch("gdelt", { ok: false, error: `rate_limited: ${snippet}` });
        return {
          ok: false,
          status: "rate_limited",
          records: [], recordCount: 0, fetchedAt, sourceUrl: url,
          error: `GDELT returned non-JSON (rate-limit page): ${snippet}`,
        };
      }
      const json = JSON.parse(text) as { articles?: GdeltArticle[] };
      const records: GdeltRecord[] = [{ mode: query.mode ?? "ArtList", articles: json.articles ?? [] }];
      recordLastFetch("gdelt", { ok: true, recordCount: json.articles?.length ?? 0 });
      return { ok: true, status: "ok", records, recordCount: json.articles?.length ?? 0, fetchedAt, sourceUrl: url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isAbort = e instanceof Error && e.name === "AbortError";
      lastError = isAbort ? `gdelt fetch timed out after ${TIMEOUT_MS}ms` : msg;
      // Retry only on generic undici "fetch failed" — not on timeouts.
      const isTransport = msg === "fetch failed" || /TLS|ECONNRESET|ENOTFOUND|UND_ERR/.test(msg);
      if (attempt < MAX_ATTEMPTS && isTransport && !isAbort) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      recordLastFetch("gdelt", { ok: false, error: lastError });
      return {
        ok: false,
        status: isAbort ? "rate_limited" : "error",
        records: [], recordCount: 0, fetchedAt, error: lastError,
      };
    } finally {
      clearTimeout(timer);
    }
    } // for-attempt
    // Shouldn't reach here, but TS wants a return.
    return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: lastError };
  },
};
