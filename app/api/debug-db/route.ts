import { NextResponse } from "next/server";
import { getPrisma, hasDatabase } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ status: "no_db", message: "DATABASE_URL not set" });
  }

  const results: Record<string, unknown> = { status: "ok", hasDb: true };

  try {
    const prisma = getPrisma();
    const count = await prisma.intelligenceVendor.count();
    results.vendorCount = count;
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    results.status = "error";
    results.errorName = e.name;
    results.errorMessage = e.message;
    results.errorCode = "code" in e ? (e as any).code : undefined;
    results.errorStack = e.stack?.split("\n").slice(0, 5);
  }

  try {
    const prisma = getPrisma();
    const mCount = await prisma.vendorMomentum.count();
    results.momentumCount = mCount;
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    results.momentumError = { name: e.name, message: e.message };
  }

  return NextResponse.json(results);
}
