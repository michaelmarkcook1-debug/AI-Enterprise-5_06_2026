import { NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-sources/[connectorId]
 * Returns the health snapshot of one connector. Cheap — no network calls.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ connectorId: string }> }) {
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) {
    return NextResponse.json({ error: `Unknown connector: ${connectorId}` }, { status: 404 });
  }
  return NextResponse.json({ connectorId, health: connector.health() });
}
