import { NextResponse } from "next/server";
import { getCommercialModels } from "@/lib/model-inventory/repository";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ models: getCommercialModels() });
}
