// On-demand live recompute — the "see the app move now" trigger.
// ──────────────────────────────────────────────────────────────
// Runs ONLY the recompute half of the daily pipeline against evidence that is
// already in the DB — no sourcing, no LLM calls, no cost. Use it to watch the
// whole app react after evidence is verified, without waiting for the 03:05 cron:
//
//   verified evidence → projector (capabilities + news + PILLAR SCORES)
//     → deriveVendorScores (overall / confidence / momentum)
//     → ranking snapshot (so movement arrows + trend lines advance)
//
// Returns the score shifts so the operator can see exactly what moved.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { getPrisma, hasDatabase } from "@/lib/prisma";
import { projectEvidenceToIntelligence, projectEvidenceToPillarScores } from "@/lib/services/intelligence-projector";
import { deriveVendorScores } from "@/lib/system/derive-scores";
import { seedModelQualityPillar } from "@/lib/system/model-quality-seed";
import { deriveMarketShareMovement } from "@/lib/system/derive-market-share";
import { captureRankingSnapshots } from "@/lib/intelligence/ranking-snapshots";
import { detectCategoryChanges } from "@/lib/services/category-change";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) return Response.json({ skipped: "no_database" }, { status: 200 });

  const now = new Date();
  const prisma = getPrisma();
  try {
    const projection = await projectEvidenceToIntelligence(prisma);
    const pillars = await projectEvidenceToPillarScores(prisma, now);
    // Refresh the model_quality pillar from the persisted Artificial Analysis
    // benchmarks BEFORE derive, so overallScore folds current model quality in the
    // same run (replaces the retired Arena-ELO pillar refresh).
    const mqPillar = await seedModelQualityPillar();
    // Raise admin-review proposals for any vendor whose new capabilities imply a
    // role it doesn't hold (never auto-applied — surfaces in /admin/category-changes).
    const categoryChanges = await detectCategoryChanges();
    const derive = await deriveVendorScores(now);
    const shareMovement = await deriveMarketShareMovement(now);
    const snapshot = await captureRankingSnapshots(now);

    return Response.json({
      ok: true,
      ranAt: now.toISOString(),
      shareMovement: { rowsUpdated: shareMovement.rowsUpdated, topMovers: shareMovement.topMovers },
      projection: {
        scannedEvidenceRows: projection.scannedEvidenceRows,
        capabilitiesUpserted: projection.capabilitiesUpserted,
        newsUpserted: projection.newsUpserted,
      },
      pillars: {
        pillarRowsUpserted: pillars.pillarRowsUpserted,
        vendorsTouched: pillars.vendorsTouched,
        shifts: pillars.shifts,
      },
      modelQuality: {
        pillarsUpdated: mqPillar.updated,
        skippedNoIntelligenceIndex: mqPillar.skipped,
        stalePillarsCleared: mqPillar.cleared,
      },
      scores: {
        vendorsUpdated: derive.vendorsUpdated,
        momentumRowsUpdated: derive.momentumRowsUpdated,
        scoreShifts: derive.scoreShifts,
      },
      categoryChangeProposals: {
        scanned: categoryChanges.scanned,
        created: categoryChanges.created,
        createdFor: categoryChanges.createdFor,
      },
      snapshot,
      note:
        projection.scannedEvidenceRows === 0
          ? "No analyst_verified evidence yet — scores hold at their baseline. Verified evidence accrues once sourcing runs (API limit lifted) and triage auto-approves E2+ proposals."
          : undefined,
    });
  } catch (err) {
    console.error("[admin/recompute] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
