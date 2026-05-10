import { NextResponse } from "next/server";
import { CONNECTORS, listConnectorHealth } from "@/lib/connectors/registry";
import { normaliseFetchResult } from "@/lib/evidence/normalise";

export const dynamic = "force-dynamic";

interface RefreshBody {
  connectorId?: string;
  query?: unknown;
}

/**
 * POST /api/data-sources/refresh
 * Body: { connectorId, query? }
 *
 * Triggers one connector. Without connectorId, returns 400 (no full-fanout
 * fan-fetch yet — too easy to burn quotas accidentally).
 */
export async function POST(request: Request) {
  let body: RefreshBody = {};
  try { body = await request.json(); } catch { /* ignore */ }
  if (!body.connectorId) {
    return NextResponse.json({
      status: "error",
      message: "connectorId required. List available IDs at GET /api/data-sources/status.",
      available: listConnectorHealth().map((h) => h.id),
    }, { status: 400 });
  }
  const connector = CONNECTORS[body.connectorId];
  if (!connector) {
    return NextResponse.json({ status: "error", message: `Unknown connector: ${body.connectorId}` }, { status: 404 });
  }
  const health = connector.health();
  if (!health.configured) {
    return NextResponse.json({
      status: "not_configured",
      connectorId: body.connectorId,
      message: `Connector requires env vars: ${health.envVars.join(", ")}`,
      health,
    }, { status: 412 });
  }
  const result = await connector.fetch(body.query);
  const evidence = normaliseFetchResult(health, result);
  return NextResponse.json({
    connectorId: body.connectorId,
    result: { ok: result.ok, status: result.status, recordCount: result.recordCount, error: result.error, sourceUrl: result.sourceUrl, fetchedAt: result.fetchedAt },
    evidence,
  });
}
