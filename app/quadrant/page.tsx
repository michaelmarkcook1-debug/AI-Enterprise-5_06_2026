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
  searchParams: Promise<{ days?: string; executeCut?: string; visionCut?: string }>;
}

function parseNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export default async function QuadrantPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const windowDays = parseNumber(params.days, 14, 1, 365);
  const executeCut = parseNumber(params.executeCut, 60, 1, 99);
  const visionCut = parseNumber(params.visionCut, 60, 1, 99);

  const data = await buildQuadrantData({ windowDays, executeCut, visionCut });

  return (
    <PageFrame
      title="AI Atlas"
      kicker="Enhance × Innovate"
      description="Position of every tracked vendor on the AI Atlas two axes. Enhance folds in evidence depth, reliability + enterprise-control pillars, industry breadth, and risk drag. Innovate folds in momentum, business-fit + market-strength pillars, use-case breadth, and share drift. Vendors on the dashboard's 'Who's losing' list are mechanically pushed out of the Leaders quadrant. Arrows show movement since the prior snapshot."
    >
      <QuadrantChart data={data} />
    </PageFrame>
  );
}
