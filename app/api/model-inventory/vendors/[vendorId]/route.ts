import { NextResponse } from "next/server";
import { INVESTMENT_PROVIDERS } from "@/lib/investing/seed";
import {
  getModelsByVendor,
  getVendorModelSummary,
  groupModelsByOwnership,
} from "@/lib/model-inventory/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ vendorId: string }> },
) {
  const { vendorId } = await context.params;
  const vendor = INVESTMENT_PROVIDERS.find((p) => p.id === vendorId);
  if (!vendor) {
    return NextResponse.json({ error: "Unknown vendor" }, { status: 404 });
  }
  const models = getModelsByVendor(vendorId);
  const summary = getVendorModelSummary(vendorId, vendor.name);
  return NextResponse.json({
    vendor: { id: vendor.id, name: vendor.name },
    summary,
    models,
    grouped: groupModelsByOwnership(models),
  });
}
