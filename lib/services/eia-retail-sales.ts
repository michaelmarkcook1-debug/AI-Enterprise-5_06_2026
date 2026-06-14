// Example EIA usage — Electricity Retail Sales.
// ──────────────────────────────────────────────
// Wraps the EIA connector with a typed call against the
// `electricity/retail-sales` route. Provides both:
//   - `getRetailSalesMetadata()` — describes the route's schema (no data)
//   - `getRetailSalesData(opts)` — fetches actual sales values
//
// Use case in AI Enterprise: AI data-centre energy demand vs.
// regional/sector electricity supply trends. Feeds the AI-infrastructure
// constraint signals in the Capabilities pillar
// `vendor_maturity_lockin / cost_finops` and the Investment Intelligence
// post-IPO modelling for AI-infrastructure exposure vendors (NVIDIA,
// AMD, AVGO, ASML, Cerebras).

import { eiaConnector, normaliseEiaRows, safeNumber, type EiaRow, type EiaRecord } from "../connectors/eia";
import { normaliseFetchResult, type NormalisedEvidenceSource } from "../evidence/normalise";
import type { FetchResult } from "../connectors/types";

const ROUTE_DATA = "electricity/retail-sales/data";
const ROUTE_METADATA = "electricity/retail-sales";

export interface RetailSalesQuery {
  /** EIA series frequency. Default "monthly". */
  frequency?: "monthly" | "annual";
  /** State id (USPS code) e.g. "CA"; omit for all states. */
  stateId?: string;
  /** Sector id (e.g. "ALL", "RES", "COM", "IND"); omit for all sectors. */
  sectorId?: string;
  /** Start period (YYYY-MM for monthly, YYYY for annual). */
  start?: string;
  /** End period. */
  end?: string;
  /** Number of rows to return. EIA default ~5000; we ask for a sane page. */
  length?: number;
  /** Sort key — default `period` descending. */
  sortDescBy?: string;
}

export interface RetailSalesPoint {
  period: string;
  stateId?: string;
  sectorId?: string;
  /** Numeric price in cents/kWh (already normalised through safeNumber). */
  priceCentsPerKwh: number | null;
  /** Numeric sales in million-kWh. */
  salesMillionKwh: number | null;
  /** Numeric revenue in million-dollars. */
  revenueMillionDollars: number | null;
  /** Customers count, where reported. */
  customers: number | null;
  /** Raw row for callers that need to inspect every column. */
  raw: EiaRow;
}

/** Pull the schema/metadata for the retail-sales route. EIA returns the
 * `frequency`, `data` columns, and `facets` available — useful for
 * building filter UI without guessing field names. */
export async function getRetailSalesMetadata(): Promise<FetchResult<EiaRecord>> {
  return eiaConnector.fetch({ route: ROUTE_METADATA });
}

/** Pull actual retail-sales values, normalised to `RetailSalesPoint`. */
export async function getRetailSalesData(opts: RetailSalesQuery = {}): Promise<{
  fetch: FetchResult<EiaRecord>;
  evidence: NormalisedEvidenceSource | null;
  points: RetailSalesPoint[];
}> {
  const params: Record<string, string | number> = {
    frequency: opts.frequency ?? "monthly",
    "data[0]": "price",
    "data[1]": "sales",
    "data[2]": "revenue",
    "data[3]": "customers",
    "sort[0][column]": opts.sortDescBy ?? "period",
    "sort[0][direction]": "desc",
    length: opts.length ?? 50,
  };
  if (opts.stateId) params["facets[stateid][]"] = opts.stateId;
  if (opts.sectorId) params["facets[sectorid][]"] = opts.sectorId;
  if (opts.start) params.start = opts.start;
  if (opts.end) params.end = opts.end;

  const fetch = await eiaConnector.fetch({ route: ROUTE_DATA, params });
  const evidence = fetch.ok
    ? normaliseFetchResult(eiaConnector.health(), fetch, { sourceDate: fetch.fetchedAt })
    : null;
  const rows: EiaRow[] = fetch.records[0]?.rows ?? [];
  const points = rows.map(rowToPoint);
  return { fetch, evidence, points };
}

function rowToPoint(r: EiaRow): RetailSalesPoint {
  return {
    period: typeof r.period === "string" ? r.period : String(r.period ?? ""),
    stateId: typeof r.stateid === "string" ? r.stateid : undefined,
    sectorId: typeof r.sectorid === "string" ? r.sectorid : undefined,
    priceCentsPerKwh: safeNumber((r as Record<string, unknown>).price),
    salesMillionKwh: safeNumber((r as Record<string, unknown>).sales),
    revenueMillionDollars: safeNumber((r as Record<string, unknown>).revenue),
    customers: safeNumber((r as Record<string, unknown>).customers),
    raw: r,
  };
}

/** Re-export the normaliser so tests can use it without importing two
 * modules. */
export { normaliseEiaRows };
