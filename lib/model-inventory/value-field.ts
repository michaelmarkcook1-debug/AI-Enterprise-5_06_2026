// Live cost-vs-capability field for the /models value scatter.
// ──────────────────────────────────────────────────────────────────────────
// Reads the SAME cited Artificial Analysis free Data API already credited on the
// models page, through the shared PURE parser (mapAaModels) — no second parse to
// drift. Cached at Next's Data-Cache layer (revalidate 6h) so a page view spends
// no live quota on a warm cache and the free tier's 100-req/day budget is never
// at risk. Honest: a model becomes a point ONLY when it publishes BOTH a real
// input price AND a real intelligence index — no imputed price, no default
// score. Returns null on no-key / fetch failure, so the scatter renders its own
// insufficient-evidence state rather than a fabricated field.
//
// FIREWALL: read-only; writes nothing; touches no vendor score. Every point
// traces to the Artificial Analysis source URL (mandatory attribution).

import {
  ARTIFICIAL_ANALYSIS_BASE_URL,
  ARTIFICIAL_ANALYSIS_SOURCE_URL,
  mapAaModels,
  type AaModelRaw,
} from "@/lib/system/artificial-analysis-fetch";

export interface ValuePoint {
  vendorId: string;
  modelName: string;
  /** Artificial Analysis Intelligence Index. */
  intelligence: number;
  /** $ per 1M input tokens. */
  priceInput1m: number;
  priceOutput1m: number | null;
  /** Median output tokens/sec (throughput), when published. */
  tokPerSec: number | null;
  /** Median time-to-first-token seconds (latency), when published. */
  ttftSec: number | null;
  releaseDate: string | null;
}

export interface ValueField {
  points: ValuePoint[];
  sourceUrl: string;
}

const MAX_PAGES = 10;

/**
 * Fetch the cited AA free roster and reduce to the priced-and-scored field.
 * Never throws; null on no-key / any fetch or parse failure.
 */
export async function getModelValueField(): Promise<ValueField | null> {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (!apiKey) return null;
  try {
    const rows: AaModelRaw[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${ARTIFICIAL_ANALYSIS_BASE_URL}/language/models/free?page=${page}`, {
        headers: { "x-api-key": apiKey, accept: "application/json" },
        // Next Data Cache: one upstream read per 6h window, shared across renders.
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { pagination?: { has_more?: boolean }; data?: AaModelRaw[] };
      rows.push(...(json.data ?? []));
      if (!json.pagination?.has_more) break;
      if (page === MAX_PAGES) return null; // still more → treat as parse drift
    }
    if (rows.length < 5) return null;

    const { models } = mapAaModels(rows);
    const points: ValuePoint[] = models
      .filter((m) => m.priceInputPer1m != null && m.priceInputPer1m > 0 && m.intelligenceIndex != null)
      .map((m) => ({
        vendorId: m.vendorId,
        modelName: m.modelName,
        intelligence: m.intelligenceIndex as number,
        priceInput1m: m.priceInputPer1m as number,
        priceOutput1m: m.priceOutputPer1m,
        tokPerSec: m.outputTokensPerSecond,
        ttftSec: m.timeToFirstTokenSeconds,
        releaseDate: m.releaseDate,
      }))
      // Cheapest first, then most capable — a stable order for the frontier walk.
      .sort((a, b) => a.priceInput1m - b.priceInput1m || b.intelligence - a.intelligence);

    return points.length > 0 ? { points, sourceUrl: ARTIFICIAL_ANALYSIS_SOURCE_URL } : null;
  } catch {
    return null;
  }
}

/**
 * The efficiency frontier: a model is "best value at its capability" when no
 * *cheaper* model is at least as intelligent. Walking price ascending and
 * tracking the running-max intelligence yields that staircase deterministically.
 * Returns the SAME point objects flagged, so callers can style frontier vs
 * dominated without a second lookup.
 */
export function markFrontier(points: ValuePoint[]): Array<ValuePoint & { frontier: boolean }> {
  const byPrice = [...points].sort((a, b) => a.priceInput1m - b.priceInput1m || b.intelligence - a.intelligence);
  let bestIntel = -Infinity;
  const flag = new Map<ValuePoint, boolean>();
  for (const p of byPrice) {
    if (p.intelligence > bestIntel) {
      flag.set(p, true);
      bestIntel = p.intelligence;
    } else {
      flag.set(p, false);
    }
  }
  return points.map((p) => ({ ...p, frontier: flag.get(p) ?? false }));
}
