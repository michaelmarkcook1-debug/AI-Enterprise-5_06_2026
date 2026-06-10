// GET /api/reputation — three-pillar vendor reputation (full seed rows).
// Today: curated static seed. Post-spend-cap: Prisma table refreshed from
// review platforms, developer signals and status pages; same shape.
import { NextResponse } from "next/server";
import { REPUTATION_INDEX, REPUTATION_VENDOR_IDS } from "@/lib/reputation/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = REPUTATION_VENDOR_IDS.map((id) => ({
    vendorId: id,
    customer: REPUTATION_INDEX.customer.get(id) ?? null,
    developer: REPUTATION_INDEX.developer.get(id) ?? null,
    employee: REPUTATION_INDEX.employee.get(id) ?? null,
  }));
  return NextResponse.json({
    provenance: "curated seed — public review, developer and workplace sources; pending live refresh",
    asOf: new Date().toISOString(),
    count: rows.length,
    rows,
  });
}
