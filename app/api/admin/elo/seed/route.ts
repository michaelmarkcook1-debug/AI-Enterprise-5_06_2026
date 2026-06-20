import { type NextRequest, NextResponse } from "next/server";
import { seedEloScores, ARENA_ELO_SOURCE_URL, VENDOR_ELO_MAP, normalizeElo } from "@/lib/system/elo-scores";

export const dynamic = "force-dynamic";

function isCronOrAdminRequest(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const adminKey = process.env.ADMIN_API_KEY ?? "";
  if (adminKey && auth === `Bearer ${adminKey}`) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

export async function GET(req: NextRequest) {
  // Preview mode — return current ELO table without writing anything.
  const preview = Object.fromEntries(
    Object.entries(VENDOR_ELO_MAP).map(([id, data]) => [
      id,
      { ...data, normalizedScore: normalizeElo(data.topTwoAvg) },
    ]),
  );
  return NextResponse.json({ source: ARENA_ELO_SOURCE_URL, vendors: preview });
}

export async function POST(req: NextRequest) {
  if (!isCronOrAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedEloScores();
    return NextResponse.json({
      ok: true,
      source: ARENA_ELO_SOURCE_URL,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[elo/seed] failed:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
