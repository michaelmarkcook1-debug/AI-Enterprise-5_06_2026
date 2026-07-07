/**
 * Hugging Face Hub — developer-sentiment signal via the OFFICIAL public REST API.
 * ─────────────────────────────────────────────────────────────────────────────
 * No auth required for public model metadata (downloads / likes) — the Hub API
 * (`huggingface.co/api/models`) is free, documented, and explicitly designed for
 * this kind of read (https://huggingface.co/docs/hub/api). Rate limit is IP-based
 * (~500 req/5min unauthenticated); an optional HUGGINGFACE_TOKEN raises it but is
 * NOT required — so unlike Reddit this source needs no owner setup to go live.
 *
 * Consumed by the dev-sentiment model as the "real open-model adoption" source:
 * cumulative downloads + likes across a vendor's official org, filtered to
 * text-generation-capable models (see lib/dev-sentiment/data.ts for the exact
 * filter + citation). Downloads measure ADOPTION; likes are the anti-gaming
 * floor metric (an HF like requires an authenticated account click — much
 * harder to mass-fake than a download count, which can be inflated by mirrors/
 * CI pulls).
 */
import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://huggingface.co/";
const DOCS = "https://huggingface.co/docs/hub/api";
const API = "https://huggingface.co/api/models";
const USER_AGENT = "ai-enterprise-dev-sentiment/1.0 (+https://huggingface.co)";

export interface HuggingFaceQuery {
  /** Official HF org/author, e.g. "meta-llama", "deepseek-ai", "Qwen", "mistralai". */
  author: string;
  limit?: number;
}
export interface HuggingFaceModelRecord {
  id: string;
  downloads: number;
  likes: number;
  pipelineTag: string | null;
  tags: string[];
}

function authHeaders(): Record<string, string> {
  const token = process.env.HUGGINGFACE_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT } : { "User-Agent": USER_AGENT };
}

export const huggingFaceConnector: Connector<HuggingFaceQuery, HuggingFaceModelRecord> = {
  health(): ConnectorHealth {
    const last = getLastFetch("huggingface");
    return {
      id: "huggingface",
      label: "Hugging Face Hub (public API)",
      group: "developer",
      tier: "developer_signal",
      requiresKey: false,
      envVars: ["HUGGINGFACE_TOKEN"],
      configured: true, // public endpoint — usable with no token
      status: "ok",
      message: process.env.HUGGINGFACE_TOKEN
        ? undefined
        : "No HUGGINGFACE_TOKEN set — using the unauthenticated rate limit (~500 req/5min), which is sufficient for periodic org-catalog pulls. Set HUGGINGFACE_TOKEN to raise the limit.",
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: "Unauthenticated: ~500 req/5min per IP (fixed window, per HF's ratelimit response header). Optional token raises it.",
      defaultEvidenceGrade: "E3",
      defaultConfidenceFloor: 60,
      description: "Real open-model adoption for coding/developer models — cumulative downloads + likes across a vendor's official HF org, the 5th dev-sentiment source (open-weight vendors only).",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },
  async fetch(query?: HuggingFaceQuery): Promise<FetchResult<HuggingFaceModelRecord>> {
    const fetchedAt = new Date().toISOString();
    if (!query?.author) {
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "author required" };
    }
    try {
      const params = new URLSearchParams({ author: query.author, limit: String(query.limit ?? 1000) });
      const url = `${API}?${params.toString()}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("huggingface", { ok: false, error });
        return { ok: false, status: res.status === 429 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const j = (await res.json()) as { id?: string; downloads?: number; likes?: number; pipeline_tag?: string; tags?: string[] }[];
      const records: HuggingFaceModelRecord[] = (Array.isArray(j) ? j : []).map((m) => ({
        id: String(m.id ?? ""),
        downloads: Number(m.downloads ?? 0),
        likes: Number(m.likes ?? 0),
        pipelineTag: m.pipeline_tag ?? null,
        tags: Array.isArray(m.tags) ? m.tags : [],
      }));
      recordLastFetch("huggingface", { ok: true, recordCount: records.length });
      return { ok: true, status: "ok", records, recordCount: records.length, fetchedAt, sourceUrl: `https://huggingface.co/${query.author}` };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("huggingface", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
