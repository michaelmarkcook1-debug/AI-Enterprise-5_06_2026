// Investor-Tools live-data cache.
// ───────────────────────────────
// Persists the daily-refresh output of all four investor-tools live
// modules (financials, valuation, IPO estimator, analyst coverage) to a
// raw SQL table so the read-side pages can hydrate without re-running
// the LLM calls on every request.
//
// Schema choice: a single jsonb-blob row per "kind" (latest snapshot).
// We don't keep history here — that's the daily-refresh-store's job for
// the run log. Tail history of forecasts can be added later by changing
// the upsert to an insert.

import { getPrisma, hasDatabase } from "../prisma";
import type { FinancialMetric, IPOForecast, ValuationMetric } from "./types";
import type { AnalystCoverageItem } from "./analyst-coverage";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "investor_live_snapshot" (
  "kind" text PRIMARY KEY,
  "captured_at" timestamptz NOT NULL DEFAULT now(),
  "payload" jsonb NOT NULL
);
`;

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  if (!hasDatabase()) return;
  try {
    await getPrisma().$executeRawUnsafe(CREATE_SQL);
    tableReady = true;
  } catch {
    // Swallow — caller will see the no-rows fallback.
  }
}

type Kind = "financials" | "valuations" | "ipo_forecasts" | "analyst_coverage";

interface Snapshot<T> {
  kind: Kind;
  capturedAt: string;
  payload: T;
}

async function upsert<T>(kind: Kind, payload: T): Promise<void> {
  if (!hasDatabase()) return;
  await ensureTable();
  try {
    await getPrisma().$executeRaw`
      INSERT INTO "investor_live_snapshot" ("kind", "captured_at", "payload")
      VALUES (${kind}, now(), ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT ("kind") DO UPDATE
        SET "captured_at" = now(), "payload" = EXCLUDED."payload"
    `;
  } catch {
    // Swallow — cache miss is acceptable, pages can fall back to seed.
  }
}

async function load<T>(kind: Kind): Promise<Snapshot<T> | null> {
  if (!hasDatabase()) return null;
  await ensureTable();
  try {
    const rows = await getPrisma().$queryRaw<Array<{ kind: Kind; captured_at: Date; payload: unknown }>>`
      SELECT "kind", "captured_at", "payload"
      FROM "investor_live_snapshot"
      WHERE "kind" = ${kind}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return {
      kind,
      capturedAt: rows[0].captured_at.toISOString(),
      payload: rows[0].payload as T,
    };
  } catch {
    return null;
  }
}

/* ─── Typed read / write helpers ────────────────────────────────── */

export const saveFinancials = (rows: FinancialMetric[]) => upsert("financials", rows);
export const saveValuations = (rows: ValuationMetric[]) => upsert("valuations", rows);
export const saveIpoForecasts = (rows: IPOForecast[]) => upsert("ipo_forecasts", rows);
export const saveAnalystCoverage = (rows: AnalystCoverageItem[]) => upsert("analyst_coverage", rows);

export const loadFinancials = () => load<FinancialMetric[]>("financials");
export const loadValuations = () => load<ValuationMetric[]>("valuations");
export const loadIpoForecasts = () => load<IPOForecast[]>("ipo_forecasts");
export const loadAnalystCoverage = () => load<AnalystCoverageItem[]>("analyst_coverage");
