import type { Metadata } from "next";
import { PageFrame } from "@/components/app-shell";
import DataSourceRail from "@/components/data-source-rail";
import { OwnershipLegend } from "@/components/ownership-indicator";
import { getEntities, computeWinningByLayer } from "@/lib/intelligence/entities-adapter";
import { generateWeeklyBriefing } from "@/lib/intelligence/briefings";
import { getBreakingNews } from "@/lib/intelligence/repository";
import QueryV2Client from "./QueryV2Client";
import AnalystInsight from "@/components/analyst-insight";
import CollapsiblePanel from "@/components/collapsible-panel";
import BreakingNewsCard from "@/components/query/BreakingNewsCard";
import { queryInsight } from "@/lib/insights/tab-insights";

export const metadata: Metadata = {
  title: "Query V2 — AI Enterprise",
  description: "Role-aware enterprise AI market intelligence by platform, model, application, infrastructure, hardware, investor, and ecosystem layer.",
};

export const dynamic = "force-dynamic";

export default async function QueryV2Page() {
  // Single source of truth: the live database spine. Numbers are derived from
  // live ingestion (scores, momentum, pillars, market share, ranking snapshots).
  const entities = await getEntities();
  const winningByLayer = computeWinningByLayer(entities);
  // Weekly market overview — moved here from Assess (12 Jun 2026) so the
  // market read lives where the market data lives. Breaking-news card sits
  // alongside it: last-7-day, impact-filtered AI-market stories.
  const [brief, breakingNews] = await Promise.all([
    generateWeeklyBriefing().catch(() => null),
    getBreakingNews({ days: 7, minImpact: 55, limit: 6 }).catch(() => null),
  ]);

  // Analyst insight — derived from the same entities the tab renders
  const byRole = (role: string) => entities.filter((e) => e.primaryRole === role).length;
  const insightParagraph = queryInsight({
    totalEntities: entities.length,
    platforms: byRole("Platform Vendor"),
    models: byRole("Model Provider"),
    applications: byRole("Application Vendor"),
    avgLeadership: entities.length > 0 ? Math.round(entities.reduce((s, e) => s + e.leadershipScore, 0) / entities.length) : 0,
    evidenceConfidence: entities.length > 0 ? Math.round(entities.reduce((s, e) => s + e.confidence, 0) / entities.length) : 0,
    highRisk: entities.filter((e) => e.risk === "high").length,
  });

  return (
    <PageFrame
      aside={<DataSourceRail tab="query" />}
      title="Query"
      kicker="Explore who matters in enterprise AI — by role, layer and momentum"
      description="AI Enterprise separates vendors by what they actually do: platforms, models, applications, infrastructure, investors, hardware and ecosystem dependencies."
    >
      <AnalystInsight paragraph={insightParagraph} />

      {/* Market overview + breaking news, side by side. The weekly executive
          briefing (relocated from Assess) explains the "why" behind the
          rankings; the breaking-news card carries last-7-day, impact-filtered
          market events. */}
      {(brief || breakingNews) && (
        <div className="mb-6 grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
          {brief && (
            <CollapsiblePanel title="Market overview" summary={brief.title} defaultOpen>
              <div className="space-y-4">
                <ul className="space-y-3 pl-1">
                  {brief.executiveSummary.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-6 font-semibold text-[#15263c] dark:text-[#eef3f8]">
                      <span className="mt-1 shrink-0 text-[#a07f1f] dark:text-[#d4af37]">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-l-4 border-[#a07f1f] py-1 pl-3 text-sm font-semibold leading-6 text-[#13294b] dark:border-[#d4af37] dark:text-[#eef3f8]">
                  {brief.boardTakeaway}
                </div>
              </div>
            </CollapsiblePanel>
          )}
          {breakingNews && <BreakingNewsCard news={breakingNews} />}
        </div>
      )}

      <div className="mb-5">
        <OwnershipLegend />
      </div>
      <QueryV2Client entities={entities} winningByLayer={winningByLayer} />
    </PageFrame>
  );
}
