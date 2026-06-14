import { NextResponse } from "next/server";
import { dashboardSummary, listConnectorHealth } from "@/lib/connectors/registry";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    summary: dashboardSummary(),
    connectors: listConnectorHealth(),
  });
}
