import { NextResponse } from "next/server";

// RETIRED 2026-07-19 — the MANUAL Arena ELO seed is removed.
// ─────────────────────────────────────────────────────────────────────────────
// This endpoint (and its admin button) called seedEloScores(), which wrote each
// vendor's overallScore DIRECTLY from the hand-authored VENDOR_ELO_MAP snapshot
// (speculative model names, fixed anchors). That is a fabrication-risk path and
// it presented ELO as a current primary scoring method, which it is not.
//
// What model-quality scoring actually is: the Artificial Analysis Intelligence /
// Coding / Agentic indices are the primary, cited source (model_quality_benchmarks
// in daily-refresh; preferred at read-time by model-quality-blend). A LIVE-fetched
// openlm.ai ELO pillar (seedEloPillarScores) is retained ONLY as a labelled
// read-time fallback for vendors Artificial Analysis doesn't cover, maintained by
// the nightly refresh — so there is nothing to seed manually here.
//
// Stub refuses so no bookmarked call can resurrect the synthetic-overallScore path.

export const dynamic = "force-dynamic";

const GONE = {
  error: "retired",
  message:
    "The manual Arena ELO seed is removed. Model-provider quality is scored from the Artificial Analysis indices (nightly refresh), with a live-fetched ELO pillar as a labelled fallback only — there is no manual ELO seed to run.",
};

export function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export function POST() {
  return NextResponse.json(GONE, { status: 410 });
}
