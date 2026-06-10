// GET /api/market-share — vendor market-share estimates.
// Today: served from the Prisma-backed estimates (seed-confidence).
// Post-spend-cap: same shape, refreshed by the evidence pipeline.
import { NextResponse } from "next/server";
import { listMarketShareEstimates } from "@/lib/intelligence/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const estimates = await listMarketShareEstimates();
  return NextResponse.json({
    provenance: "seed-confidence — pending live refresh once ingestion is enabled",
    asOf: new Date().toISOString(),
    count: estimates.length,
    estimates,
  });
}
