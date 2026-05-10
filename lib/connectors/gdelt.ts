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
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("gdelt", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const json = await res.json() as { articles?: GdeltArticle[] };
      const records: GdeltRecord[] = [{ mode: query.mode ?? "ArtList", articles: json.articles ?? [] }];
      recordLastFetch("gdelt", { ok: true, recordCount: json.articles?.length ?? 0 });
      return { ok: true, status: "ok", records, recordCount: json.articles?.length ?? 0, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("gdelt", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
