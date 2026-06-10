// GET /api/uptake?industry=&region= — modelled vendor-adoption shares.
// Today: the May 2026 segment-share model (585 rows, static seed).
// Post-spend-cap: migrate rows to Prisma (VendorUptakeSegment) and refresh
// via the evidence pipeline; this route's shape stays stable either way.
import { NextResponse } from "next/server";
import { aggregateUptake, INDUSTRIES, REGIONS, type Industry, type Region } from "@/lib/intelligence/vendor-uptake-seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const industry = url.searchParams.get("industry") as Industry | null;
  const region = url.searchParams.get("region") as Region | null;
  if (industry && !INDUSTRIES.includes(industry)) {
    return NextResponse.json({ error: `Unknown industry. Valid: ${INDUSTRIES.join(", ")}` }, { status: 400 });
  }
  if (region && !REGIONS.includes(region)) {
    return NextResponse.json({ error: `Unknown region. Valid: ${REGIONS.join(", ")}` }, { status: 400 });
  }
  const rows = aggregateUptake({ industries: industry ? [industry] : undefined, regions: region ? [region] : undefined });
  return NextResponse.json({
    provenance: "MODELLED ESTIMATE — May 2026 segment-share model; directional, not audited market share",
    scope: { industry: industry ?? "all", region: region ?? "all" },
    count: rows.length,
    rows,
  });
}
