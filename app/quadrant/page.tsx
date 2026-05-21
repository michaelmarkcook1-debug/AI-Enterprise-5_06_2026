// Quadrant view — analyst-style 2x2 of overallScore × momentumScore.
//
// Renders the current position of every tracked vendor and an arrow from
// its position N days ago (when a stored ranking snapshot exists).
// Pulls all data via buildQuadrantData; force-dynamic so the chart
// reflects the latest derive_scores + ranking_snapshot output from the
// daily refresh.

import { PageFrame } from "@/components/app-shell";
import { buildQuadrantData } from "@/lib/intelligence/quadrant";
import QuadrantChart from "@/components/quadrant/QuadrantChart";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ days?: string; scoreCut?: string; momentumCut?: string }>;
}

function parseNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export default async function QuadrantPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const windowDays = parseNumber(params.days, 14, 1, 365);
  const scoreCut = parseNumber(params.scoreCut, 60, 1, 99);
  // Default 60: matches the dashboard's "Who's losing" momentum
  // threshold so losing-list vendors mechanically land left of the cut.
  const momentumCut = parseNumber(params.momentumCut, 60, 1, 99);

  const data = await buildQuadrantData({ windowDays, scoreCut, momentumCut });

  return (
    <PageFrame
      title="Vendor quadrant"
      kicker="Score × momentum, with trajectory"
      description="Position of every tracked vendor across overall ranking score (Y) and momentum (X). Arrows show movement since the prior snapshot. Cuts and timeframe are configurable via the controls below — they encode 'who's now a Leader / Challenger / Established / on the Watch list'."
    >
      <QuadrantChart data={data} />
    </PageFrame>
  );
}
