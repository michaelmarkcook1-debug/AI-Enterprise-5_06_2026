import { type NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { seedEloScores, seedEloPillarScores, ARENA_ELO_SOURCE_URL, VENDOR_ELO_MAP, normalizeElo } from "@/lib/system/elo-scores";

export const dynamic = "force-dynamic";

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
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Durable path: write the model_quality pillar so derive-scores folds ELO
    // into overallScore on every recompute. Also nudge overallScore directly so
    // the change is visible before the next derive run.
    const pillarResult = await seedEloPillarScores();
    const result = await seedEloScores();
    return NextResponse.json({
      ok: true,
      source: ARENA_ELO_SOURCE_URL,
      modelQualityPillar: pillarResult,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[elo/seed] failed:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
