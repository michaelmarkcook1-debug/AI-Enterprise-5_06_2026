import { NextResponse } from "next/server";
import { getAllVendorSummaries, getDashboardSummary } from "@/lib/model-inventory/repository";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    summary: getDashboardSummary(),
    vendors: getAllVendorSummaries(),
  });
}
