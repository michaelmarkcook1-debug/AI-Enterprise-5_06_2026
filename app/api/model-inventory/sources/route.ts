import { NextResponse } from "next/server";
import { getCommercialModelSources } from "@/lib/model-inventory/repository";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ sources: getCommercialModelSources() });
}
