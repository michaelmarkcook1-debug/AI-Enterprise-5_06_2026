// GET /api/market-share — vendor Market Share Est. (directional estimates).
// `listMarketShareEstimates` drops seed-signed rows, so this returns only real,
// recalculated estimates; each row carries its own `source` + `methodology`.
import { NextResponse } from "next/server";
import { listMarketShareEstimates } from "@/lib/intelligence/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const estimates = await listMarketShareEstimates();
  return NextResponse.json({
    label: "Market Share Est.",
    provenance:
      "Directional estimate — derived from real cited signals (reviewed evidence, dependencies, adoption, momentum), normalised within category and recalculated each refresh. NOT measured revenue or audited market share. See each row's source + methodology.",
    asOf: new Date().toISOString(),
    count: estimates.length,
    estimates,
  });
}
