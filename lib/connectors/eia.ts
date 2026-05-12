/**
 * EIA — US Energy Information Administration (API v2).
 * Power, electricity, oil, gas, capacity. Critical for AI-infrastructure
 * energy-constraint signals (data-centre power, regional grid load).
 *
 * Docs: https://www.eia.gov/opendata/documentation.php
 * Register for a free key: https://www.eia.gov/opendata/register.php
 * Required env: EIA_API_KEY — passed in the URL as `api_key=...` per EIA docs.
 *
 * IMPORTANT — value normalisation:
 *   EIA returns numeric series values as STRINGS (e.g. "13245.6"). Any
 *   downstream code that does arithmetic on `value` MUST go through
 *   `safeNumber()` below or accept that arithmetic will silently produce
 *   string-concatenation bugs. The normalised record carries both the raw
 *   string AND the parsed number so consumers can choose.
 */

import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://www.eia.gov/";
const DOCS = "https://www.eia.gov/opendata/documentation.php";
const API = "https://api.eia.gov/v2";

export const EIA_API_BASE = API;
export const EIA_NOT_CONFIGURED_MESSAGE = "EIA_API_KEY is required";

export interface EiaQuery {
  /** Route under `/v2/`, e.g. `electricity/retail-sales/data`. */
  route: string;
  /** Free-form query params; EIA expects values like `frequency=monthly` and
   * `data[0]=price`. Caller is responsible for matching the route's schema. */
  params?: Record<string, string | number>;
}

export interface EiaRow {
  /** Period stamp from EIA (e.g. "2024-12" for monthly, "2024" for annual). */
  period?: string;
  /** Region/sector/series id from EIA (varies by route). */
  stateid?: string;
  sectorid?: string;
  /** Raw value as returned by EIA — usually a string. NEVER do maths on this. */
  value?: string | number | null;
  /** Parsed numeric value, or null if the raw value didn't parse cleanly. */
  valueNumber?: number | null;
  /** Echo any other fields the route returns. */
  [key: string]: unknown;
}

export interface EiaRecord {
  route: string;
  rows: EiaRow[];
  /** Total row count reported by EIA (often > rows.length when paginated). */
  total?: number;
}

/** Safely coerce an EIA value to a number. Returns null if the input is null,
 * undefined, empty, or NaN — never throws. EIA frequently returns strings
 * like "13245.6" or "." (sentinel for missing) — both must be tolerated. */
export function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed === "" || trimmed === "." || trimmed === "NA") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Normalise an EIA raw payload into rows with both raw and parsed values. */
export function normaliseEiaRows(raw: unknown): EiaRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const value = row.value ?? null;
    return {
      ...row,
      value: value as EiaRow["value"],
      valueNumber: safeNumber(value),
    } satisfies EiaRow;
  });
}

export const eiaConnector: Connector<EiaQuery, EiaRecord> = {
  health(): ConnectorHealth {
    const key = process.env.EIA_API_KEY;
    const last = getLastFetch("eia");
    return {
      id: "eia",
      label: "EIA (Energy Information Administration)",
      group: "energy",
      tier: "official_government",
      requiresKey: true,
      envVars: ["EIA_API_KEY"],
      configured: Boolean(key),
      status: key ? "ok" : "not_configured",
      message: key ? undefined : EIA_NOT_CONFIGURED_MESSAGE,
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: "Generous limits — free key required at eia.gov/opendata/register.php.",
      defaultEvidenceGrade: "E5",
      defaultConfidenceFloor: 92,
      description: "Power, electricity, oil, gas, capacity. Critical for AI data-centre energy constraint signals.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },

  async fetch(query?: EiaQuery): Promise<FetchResult<EiaRecord>> {
    const fetchedAt = new Date().toISOString();
    const key = process.env.EIA_API_KEY;
    if (!key) {
      // Strict: do NOT fake success. The health check + this branch carry the
      // canonical not-configured signal so admin UI / status routes show the
      // truth.
      return {
        ok: false,
        status: "not_configured",
        records: [],
        recordCount: 0,
        fetchedAt,
        error: EIA_NOT_CONFIGURED_MESSAGE,
      };
    }
    if (!query?.route) {
      return {
        ok: false,
        status: "error",
        records: [],
        recordCount: 0,
        fetchedAt,
        error: "route required (e.g. 'electricity/retail-sales/data')",
      };
    }
    const params = new URLSearchParams({ api_key: key });
    Object.entries(query.params ?? {}).forEach(([k, v]) => params.set(k, String(v)));
    const url = `${API}/${query.route}?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("eia", { ok: false, error });
        return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const json = (await res.json()) as {
        response?: { data?: unknown[]; total?: number | string };
      };
      const rows = normaliseEiaRows(json.response?.data);
      const total = safeNumber(json.response?.total) ?? undefined;
      const records: EiaRecord[] = [{ route: query.route, rows, total }];
      recordLastFetch("eia", { ok: true, recordCount: rows.length });
      return {
        ok: true,
        status: "ok",
        records,
        recordCount: rows.length,
        fetchedAt,
        sourceUrl: url,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("eia", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
