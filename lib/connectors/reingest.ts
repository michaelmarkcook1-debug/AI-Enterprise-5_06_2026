/**
 * One-time reingest / connectivity probe across every data-source connector.
 *
 * Powers the "Reingest sources now" button on /admin/data-sources. For each
 * connector it:
 *   - reads health() (cheap env-check, no network)
 *   - if NOT configured → reports not_configured honestly (never a fake "ok")
 *   - if configured → runs a small, representative real fetch (the probe below)
 *     and reports the true status + record count + any error
 *
 * The probe queries are the SAME shapes the connectors expect in production
 * (matched to each connector's Query interface), so a green result here means
 * the source genuinely connected and returned rows — not a synthetic success.
 * A connector with no probe is reported as "skipped" (we did not test it),
 * never as ok.
 */

import { CONNECTORS } from "./registry";
import type { ConnectorStatus } from "./types";

/** Representative, low-cost real queries — one per connector. */
const PROBE_QUERIES: Record<string, unknown> = {
  // Filings
  sec: { cik: "320193", resource: "submissions" }, // Apple Inc.
  // Macro
  fred: { seriesId: "FEDFUNDS", limit: 1 },
  bls: { seriesIds: ["CUUR0000SA0"] }, // CPI-U, all items
  bea: { datasetName: "NIPA", tableName: "T10101", frequency: "Q", year: "2023" },
  // NB: no `page[size]` — URLSearchParams encodes the brackets (page%5Bsize%5D),
  // which Treasury's router 404s on. A bracket-free query returns 200 + rows.
  // Treasury deprecated the v1 path for this dataset (v1 → HTTP 404); v2 is the
  // current endpoint and returns rows (verified against the live API 2026-07-01).
  fiscalData: { endpoint: "/v2/accounting/od/debt_to_penny", params: { sort: "-record_date" } },
  // Energy
  eia: { route: "electricity/retail-sales/data", params: { frequency: "monthly", "data[0]": "price", length: 1 } },
  // Markets
  alphaVantage: { fn: "GLOBAL_QUOTE", symbol: "NVDA" },
  yahooFinance: { resource: "quote", symbols: ["NVDA"] },
  // News / events
  gdelt: { query: "artificial intelligence", maxRecords: 1 },
  // Regulatory / policy
  congress: { path: "/bill", params: { limit: "1" } },
  federalRegister: { path: "/documents.json", params: { per_page: "1", "conditions[term]": "artificial intelligence" } },
  // Developer
  github: { path: "/repos/openai/openai-python" },
  // NB: vendorDocs (the LLM extractor) is intentionally NOT probed here — a probe
  //     would spend Anthropic tokens and isn't a connectivity check. It reports
  //     "skipped" (honest: not tested), never a faked ok.
};

export type ReingestStatus = ConnectorStatus | "skipped";

export interface ReingestRow {
  id: string;
  label: string;
  group: string;
  configured: boolean;
  status: ReingestStatus;
  recordCount: number;
  error?: string;
  /** env vars needed to enable this connector (shown when not_configured). */
  envVars: string[];
  requiresKey: boolean;
}

export interface ReingestResult {
  ranAt: string;
  attempted: number;     // connectors we actually fetched
  ok: number;            // fetched + returned ok
  notConfigured: number; // missing env vars — user action required
  failed: number;        // configured but the fetch errored / rate-limited
  skipped: number;       // configured but no probe defined
  rows: ReingestRow[];
}

/**
 * Probe every connector concurrently and return honest per-connector results.
 * @param opts.onlyUnconfigured  when true, only report the not-configured
 *   connectors (the "4 not working") and skip the real fetches — useful for a
 *   quick "what still needs a key?" check without spending any quota.
 */
export async function reingestAllConnectors(
  opts: { onlyUnconfigured?: boolean } = {},
): Promise<ReingestResult> {
  const ranAt = new Date().toISOString();

  const rows = await Promise.all(
    Object.values(CONNECTORS).map(async (c): Promise<ReingestRow> => {
      const health = c.health();
      const base = {
        id: health.id,
        label: health.label,
        group: health.group,
        envVars: health.envVars,
        requiresKey: health.requiresKey,
      };

      // Not configured — surface the env vars needed, never fake a fetch.
      if (!health.configured) {
        return { ...base, configured: false, status: "not_configured", recordCount: 0, error: health.message };
      }

      if (opts.onlyUnconfigured) {
        return { ...base, configured: true, status: "skipped", recordCount: 0 };
      }

      const probe = PROBE_QUERIES[health.id];
      if (probe === undefined) {
        return { ...base, configured: true, status: "skipped", recordCount: 0, error: "no probe query defined" };
      }

      try {
        const r = await c.fetch(probe);
        return {
          ...base,
          configured: true,
          status: r.status,
          recordCount: r.recordCount,
          error: r.error,
        };
      } catch (e) {
        return { ...base, configured: true, status: "error", recordCount: 0, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  return {
    ranAt,
    attempted: rows.filter((r) => r.configured && r.status !== "skipped").length,
    ok: rows.filter((r) => r.status === "ok").length,
    notConfigured: rows.filter((r) => r.status === "not_configured").length,
    failed: rows.filter((r) => r.configured && (r.status === "error" || r.status === "rate_limited")).length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    rows,
  };
}
