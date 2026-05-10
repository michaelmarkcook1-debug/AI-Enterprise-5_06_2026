import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Refresh stub. Returns explicit not-implemented payload per prompt v2 rules:
 * the endpoint must NEVER fake refresh behaviour. Replace once real ingestion
 * is wired (SEC EDGAR/official model-list endpoints/etc.).
 */
export function POST() {
  return NextResponse.json(
    {
      status: "not_implemented",
      message: "Model inventory refresh is not implemented. No data was changed.",
    },
    { status: 501 },
  );
}
