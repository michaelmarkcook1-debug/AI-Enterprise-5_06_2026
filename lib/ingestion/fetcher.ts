// Phase 5: Public-data fetcher.
// Wraps `fetch` with timeouts, basic HTML→text normalisation, and a hash for change detection.

import { createHash } from "node:crypto";

export interface FetchedSource {
  url: string;
  fetchedAt: string;
  contentType: string;
  rawText: string;
  contentHash: string;
  byteLength: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 1_500_000;

const USER_AGENT = "EnterpriseAI-RankingEngine/1.0 (+ingestion)";

export async function fetchSource(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<FetchedSource> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.5" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    const contentType = res.headers.get("content-type") ?? "text/plain";
    const buf = await res.arrayBuffer();
    const sliced = buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(sliced);
    const text = contentType.includes("text/html") ? htmlToText(raw) : raw;
    return {
      url,
      fetchedAt: new Date().toISOString(),
      contentType,
      rawText: text,
      contentHash: createHash("sha256").update(text).digest("hex"),
      byteLength: buf.byteLength,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Minimal HTML → text. Strips scripts/styles, decodes a few common entities,
// collapses whitespace. Good enough for trust centres / docs / status pages
// without pulling in a full DOM parser.
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?(p|div|li|h[1-6]|tr|br|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
