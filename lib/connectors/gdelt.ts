/**
 * GDELT — global news/event monitoring. No API key required.
 * Treat as SIGNAL not proof — must not become a verified factual claim.
 *
 * Transport: uses Node's built-in `https.request` rather than the
 * global `fetch()` (undici). GDELT's TLS handshake / response stream
 * is reliably handled by Node core but consistently drops via undici
 * on some networks ("fetch failed" after 10–22s). Direct curl from
 * the same host returns 200 in ~10–15s, so the API is fine — the
 * issue is the runtime's HTTP client.
 */
import * as https from "node:https";
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

/** Minimal https.get wrapper that returns the response body as a
 * string. Honest about transport: timeout, max redirects, identity
 * encoding (no gzip — fewer ways for undici-style failures to creep
 * back in). */
function httpsGetText(url: string, timeoutMs: number): Promise<{ status: number; statusText: string; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          "User-Agent": "AIEnterpise/1.0 (+https://www.aienterpise.app)",
          Accept: "application/json,text/plain,*/*",
          "Accept-Encoding": "identity",
          Connection: "close",
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Single-hop redirect support (GDELT occasionally 30x's).
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          httpsGetText(new URL(res.headers.location, url).toString(), timeoutMs).then(resolve).catch(reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error(`https request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}
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
    // 45s timeout · 2 attempts · rate-limit detection (429 OR HTML).
    // Uses httpsGetText (Node core https) above — bypasses undici's
    // fetch() because undici reliably drops the GDELT TLS handshake
    // on some networks while curl + Node's core https client work
    // fine from the same host.
    const TIMEOUT_MS = 45_000;
    const MAX_ATTEMPTS = 2;
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await httpsGetText(url, TIMEOUT_MS);
      if (res.status < 200 || res.status >= 300) {
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
      const text = res.body;
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
      const isTimeout = msg.includes("timed out");
      lastError = msg;
      // Retry on transient transport failures, not on timeouts.
      const isTransport = /ECONNRESET|ENOTFOUND|EAI_AGAIN|TLS|socket hang up/.test(msg);
      if (attempt < MAX_ATTEMPTS && isTransport && !isTimeout) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      recordLastFetch("gdelt", { ok: false, error: lastError });
      return {
        ok: false,
        status: isTimeout ? "rate_limited" : "error",
        records: [], recordCount: 0, fetchedAt, error: lastError,
      };
    }
    } // for-attempt
    // Shouldn't reach here, but TS wants a return.
    return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: lastError };
  },
};
