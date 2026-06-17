// Returns the timestamp of the most-recent successful daily refresh
// plus ingestion health metadata (% completeness, failed steps, run
// type). Used by the TopNav "Data refreshed" badge and the admin
// Ingestion Health panel.

import { getLastRefreshedAt } from "@/lib/system/daily-refresh";
import { getLastRefreshRun } from "@/lib/system/daily-refresh-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Known full-pipeline step names (in runDailyRefresh order). Keep in sync with
 *  lib/system/daily-refresh.ts — used for crash detection + expectedSteps. */
const FULL_PIPELINE_STEPS = [
  "sourcing", "safe_linkage", "triage", "projection", "derive_scores",
  "ranking_snapshot", "competitive_intel", "market_news", "sourcing_news",
  "investor_tools_refresh", "reputation_github", "macro_signals", "watchlist_alerts",
];

interface StepRaw {
  step: string;
  ok: boolean;
  durationMs: number;
  summary?: Record<string, unknown>;
  error?: string;
}

function parseSteps(raw: unknown): StepRaw[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is StepRaw =>
      typeof s === "object" && s !== null && typeof (s as StepRaw).step === "string",
  );
}

/**
 * Classify a run as "full_pipeline", "admin_ingestion", "sourcing_rolling",
 * or "unknown" based on step names.
 */
function classifyRun(steps: StepRaw[]): string {
  if (steps.length === 0) return "unknown";
  if (steps.length === 1) {
    const name = steps[0].step;
    if (name === "admin_ingestion") return "admin_ingestion";
    if (name === "sourcing_rolling") return "sourcing_rolling";
    return "lightweight";
  }
  // Full pipeline has ≥5 steps matching the known set.
  const knownHits = steps.filter((s) => FULL_PIPELINE_STEPS.includes(s.step)).length;
  return knownHits >= 5 ? "full_pipeline" : "partial";
}

export async function GET(): Promise<Response> {
  const [lastRefreshedAt, lastRun] = await Promise.all([
    getLastRefreshedAt(),
    getLastRefreshRun(),
  ]);

  // Build ingestion health from the last run.
  let ingestionHealth: {
    runType: string;
    stepsTotal: number;
    stepsOk: number;
    percentComplete: number;
    failedSteps: string[];
    crashed: boolean;
    expectedSteps: number;
    runId: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number;
  } | null = null;

  if (lastRun) {
    const steps = parseSteps(lastRun.steps);
    const okCount = steps.filter((s) => s.ok).length;
    const failedNames = steps.filter((s) => !s.ok).map((s) => s.step);
    const pct = steps.length > 0 ? Math.round((okCount / steps.length) * 100) : 0;

    // Detect incomplete/crashed runs: a full pipeline has 10 steps.
    // If ok=false and steps < 10, the run crashed before finishing.
    const runType = classifyRun(steps);
    const crashed = !lastRun.ok && runType === "full_pipeline" && steps.length < FULL_PIPELINE_STEPS.length;

    ingestionHealth = {
      runType,
      stepsTotal: steps.length,
      stepsOk: okCount,
      percentComplete: pct,
      failedSteps: failedNames,
      crashed,
      expectedSteps: runType === "full_pipeline" ? FULL_PIPELINE_STEPS.length : steps.length,
      runId: lastRun.id,
      startedAt: lastRun.startedAt,
      finishedAt: lastRun.finishedAt,
      durationMs: lastRun.durationMs,
    };
  }

  return Response.json({
    lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
    ingestionHealth,
  });
}
