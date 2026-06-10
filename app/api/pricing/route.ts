// GET /api/pricing — vendor-published token list prices.
// Today: static curated list ("Unverified" preserved where no clean
// published line exists). Post-spend-cap: scheduled scrape of vendor
// price pages; same shape.
import { NextResponse } from "next/server";
import { TOKEN_PRICING, TOKEN_PRICING_CAPTURED_AT, TOKEN_PRICING_DISCLAIMER } from "@/lib/model-inventory/token-pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    provenance: TOKEN_PRICING_DISCLAIMER,
    capturedAt: TOKEN_PRICING_CAPTURED_AT,
    asOf: new Date().toISOString(),
    count: TOKEN_PRICING.length,
    rows: TOKEN_PRICING,
  });
}
